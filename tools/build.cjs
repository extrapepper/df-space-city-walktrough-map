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
const cabinets = json('vending.json');
assert.equal(cabinets.length,45);
assert.equal(new Set(cabinets.map(c=>c.instance)).size,cabinets.length);
for(const c of cabinets){
  assert(c.localFromWorld.length===16 && c.localFromWorld.every(Number.isFinite) && typeof c.juice==='boolean');
}
for(const [id,juice] of [[5808,false],[5810,false],[9095,true]])assert.equal(cabinets.find(c=>c.instance===id)?.juice,juice);
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
const cabinetFaces=new Array(cabinets.length).fill(0),firstCabinet=5+cabins.length;
const training=json('training-rooms.json'),firstRoom=firstCabinet+cabinets.length;
assert.equal(training.surfaces.length,7);
assert.equal(training.windows.length,20);
assert.equal(training.windows.filter(p=>p[2]>21.64).length,10);
assert.equal(new Set(training.windows.map(p=>p.slice(0,3).join(','))).size,20);
for(const [x,y,z,tx,tz,w,h] of training.windows){
  assert(Math.abs(Math.hypot(tx,tz)-1)<.001&&Math.abs(y+24.93)<.03);
  assert(w>1.18&&w<1.34&&h>1.75&&h<1.81&&Math.abs(Math.hypot(x+58.39,z-21.64)-11.55)<.14);
}
assert(training.eye.every(Number.isFinite)&&training.focal>0&&training.depth[1]>training.depth[0]);
const trainingFaces=training.surfaces.map(()=>0);
for(const cell of Object.values(appearances)){
  for(const [,count,role] of cell.near||[]){
    if(role>=firstRoom)trainingFaces[role-firstRoom]+=count;
    else if(role>=firstCabinet)cabinetFaces[role-firstCabinet]+=count;
  }
}
assert.deepEqual(trainingFaces,[7001+8370+1456,2861+88,4*64+2*92,2*856+1332,5558,9563,5868]);
cabinetFaces.forEach((n,i)=>assert.equal(n,227,'Vending machine '+cabinets[i].instance));
const knownCells = new Set(cells.map(cell => cell.file));
for (const file of Object.keys(appearances)) assert(knownCells.has(file), file);
function checkCabinetFrame(bytes,offset,vertices,first,count,role){
  const cabinet=cabinets[role-firstCabinet],m=cabinet.localFromWorld;
  const positions=offset+32,indices=positions+vertices*7,indexSize=vertices>65535?4:2;
  const lo=[0,1,2].map(k=>bytes.readFloatLE(offset+8+4*k));
  const step=lo.map((v,k)=>(bytes.readFloatLE(offset+20+4*k)-v)/65535);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=first*3;i<(first+count)*3;i++){
    const v=bytes.readUIntLE(indices+i*indexSize,indexSize);
    const [x,y,z]=lo.map((origin,k)=>origin+step[k]*bytes.readUInt16LE(positions+v*6+2*k));
    for(let k=0;k<3;k++){
      const local=x*m[k]+y*m[k+4]+z*m[k+8]+m[k+12];
      min[k]=Math.min(min[k],local);max[k]=Math.max(max[k],local);
    }
  }
  const measured=[-.806,-.436,0,.791,.622,2.4];
  assert([...min,...max].every((v,k)=>Math.abs(v-measured[k])<.012),'Misaligned cabinet '+cabinet.instance);
}
function meshEnd(bytes, offset, runs = []) {
  const vertices = bytes.readUInt32LE(offset);
  const indices = bytes.readUInt32LE(offset + 4);
  assert(vertices > 0 && indices > 0 && indices % 3 === 0);
  let last = 0;
  for (const [face, count, role] of runs) {
    assert(Number.isInteger(face) && Number.isInteger(count) && count > 0 && face >= last);
    last = face + count;
    assert(last <= indices / 3 && Number.isInteger(role) && role>=1 && role<firstRoom+training.surfaces.length, 'Invalid triangle material range');
    if(role>=firstCabinet&&role<firstRoom)checkCabinetFrame(bytes,offset,vertices,face,count,role);
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
const basin=JSON.parse(gunzipSync(read('data/basin.gz'))),rings=basin.profiles;
assert(basin.layers.length && basin.layers[0][0]<-89 && basin.layers.at(-1)[1]===basin.full);
for(const [i,[lo,hi,a,b]] of basin.layers.entries()){
  assert(hi>lo && (!i||basin.layers[i-1][1]===lo) && rings[a] && rings[b]);
}
for(const ring of rings)assert(ring.length===256&&ring.every(cm=>cm>400&&cm<3200));
assert(nearRoles.has(4+cabins.length));
for(const file of ['flood-console.webp','flood-housing.webp','vending-finish.webp'])assert(read('data/'+file).length>0,file);
for(const file of ['blue-room','centrifuge','centrifuge-study','training-materials','switch-finish','centrifuge-switch','blue-switch','testbay-exit'])assert(read('data/'+file+'.webp').subarray(8,12).toString()==='WEBP',file);
const sites=json('extraction.json');
assert.equal(sites.length,8);assert.equal(new Set(sites.map(site=>site.id)).size,sites.length);
const switchHousing=json('switch-housing.json');
assert.equal(sites.filter(site=>site.instance).length,4);
assert.deepEqual(switchHousing.map(p=>p.hull),[1406,1406,1407,1408,1409,1410,1411,1412,1413,1414,1415,1416,1417,1417,1418,1419]);
for(const part of switchHousing)assert(part.vertices.every(Number.isFinite)&&part.indices.every(i=>Number.isInteger(i)&&i>=0&&i<part.vertices.length/3));
for(const site of sites){
  if(site.panel)assert(site.panel.length===3&&site.panel.every(Number.isFinite)&&Math.hypot(...site.normal)===1);
  else assert(Number.isFinite(site.mapX)&&Number.isFinite(site.mapY));
}
const landings = json('landings.json');
require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'landings.cjs'),'--check-ladders'],{stdio:'inherit'});
for (const point of json('regions.json')) assert(landings[point.name]?.length, point.name);
for (const stem of ['satellite.webp', 'survey-depth.png', 'survey-photos.webp', 'surfaces-color.webp', 'surfaces-normal.webp', 'office-seats.webp', 'office-study.json', 'office-globe.webp', 'sculpture-finish.webp', 'sculpture-reference.webp', 'lab-coatings.webp', 'buoyancy-finish.webp', 'buoyancy.webp', 'buoyancy-lower.webp']) {
  assert(read('data/' + stem).length > 0, stem);
}
console.log('Static site ready in dist. Verified ' + cells.length + ' scene cells and ' + Object.keys(landings).length + ' landmarks.');
