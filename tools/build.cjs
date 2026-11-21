const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const assert = require('node:assert/strict');
const site = path.resolve(__dirname, '../dist');
const read = name => fs.readFileSync(path.join(site, name));
const json = name => JSON.parse(read('data/' + name));
const html = read('index.html').toString();

for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (url.startsWith('data:') || url.startsWith('https:')) continue;
  assert(!url.startsWith('/'), 'Project Pages requires a relative URL: ' + url);
  const bytes = read(url);
  if (url.endsWith('.js')) new vm.Script(bytes.toString(), { filename: url });
}

const cells = json('cells.json');
const cabins = json('lab-equipment.json');
assert.equal(new Set(cabins.map(c=>c.instance)).size,cabins.length);
for(const c of cabins){
  assert(c.center.length===3 && c.basis.length===3 && c.basis.every(row=>row.length===3));
  assert([...c.center,...c.basis.flat(),c.halfLength].every(Number.isFinite) && c.halfLength>0 && [0,1].includes(c.kind));
}
const room=json('buoyancy-study.json');
for(const view of [room,room.dry]){
  assert(view.depth[1]>0 && view.photoFocal.every(v=>v>0) && view.principal.every(v=>v>0 && v<1));
  assert(view.rect[0]>=0 && view.rect[1]>=0 && view.rect[2]>0 && view.rect[3]>0);
  assert(view.rect[0]+view.rect[2]<=1 && view.rect[1]+view.rect[3]<=1);
}
const appearances = JSON.parse(gunzipSync(read('data/appearance.gz')));
const nearRoles=new Set(Object.values(appearances).flatMap(cell=>(cell.near||[]).map(run=>run[2])));
cabins.forEach((c,i)=>assert(nearRoles.has(4+i),'Missing measured cabin '+c.instance));
const knownCells = new Set(cells.map(cell => cell.file));
for (const file of Object.keys(appearances)) assert(knownCells.has(file), file);
function meshEnd(bytes, offset, runs = []) {
  const vertices = bytes.readUInt32LE(offset);
  const indices = bytes.readUInt32LE(offset + 4);
  assert(vertices > 0 && indices > 0 && indices % 3 === 0);
  let last = 0;
  for (const [face, count, role] of runs) {
    assert(Number.isInteger(face) && Number.isInteger(count) && count > 0 && face >= last);
    last = face + count;
    assert(last <= indices / 3 && Number.isInteger(role) && role>=1 && role<4+cabins.length, 'Invalid triangle material range');
  }
  return offset + 32 + vertices * 7 + indices * (vertices > 65535 ? 4 : 2);
}
const overview = gunzipSync(read('data/overview.gz'));
let overviewOffset = 0;
for (const cell of cells) {
  const mesh = gunzipSync(read('data/' + cell.file));
  assert.equal(meshEnd(mesh, 0, appearances[cell.file]?.near), mesh.length, cell.file);
  if (cell.overview) overviewOffset = meshEnd(overview, overviewOffset, appearances[cell.file]?.far);
}
assert.equal(overviewOffset, overview.length);
assert.equal(gunzipSync(read('data/height.gz')).length, 1024 * 1024 * 2);
const water = gunzipSync(read('data/water.gz'));
assert.equal(water.length, 16 + water.readUInt32LE(0) ** 2);
const landings = json('landings.json');
for (const point of json('regions.json')) assert(landings[point.name]?.length, point.name);
for (const stem of ['satellite.webp', 'survey-depth.png', 'survey-photos.webp', 'surfaces-color.webp', 'surfaces-normal.webp', 'office-seats.webp', 'office-study.json', 'office-globe.webp', 'sculpture-finish.webp', 'sculpture-reference.webp', 'lab-coatings.webp', 'buoyancy-finish.webp', 'buoyancy.webp', 'buoyancy-lower.webp']) {
  assert(read('data/' + stem).length > 0, stem);
}
console.log('Static site ready in dist. Verified ' + cells.length + ' scene cells and ' + Object.keys(landings).length + ' landmarks.');
