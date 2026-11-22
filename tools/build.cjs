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
const freightRole=firstRoom+training.surfaces.length,freightFaces=new Array(11).fill(0);
const chamberFaces=require('./chamber.cjs').groups.map(()=>0);
const foyerFaces=require('./foyer.cjs').groups.map(()=>0),firstFoyer=freightRole+1+chamberFaces.length;
for(const cell of Object.values(appearances)){
  for(const [,count,role] of cell.near||[]){
    if(role>=firstFoyer){foyerFaces[role-firstFoyer]+=count;continue}
    if(role>freightRole){chamberFaces[role-freightRole-1]+=count;continue}
    if(role===freightRole)continue;
    if(role>=firstRoom)trainingFaces[role-firstRoom]+=count;
    else if(role>=firstCabinet)cabinetFaces[role-firstCabinet]+=count;
  }
}
assert.deepEqual(trainingFaces,[7001+8370+1456,2861+88,4*64+2*92,2*856+1332,5558,9563,5868]);
assert.deepEqual(chamberFaces,[1048+967,9563,630+228,2*(132+127+94+218+135),386,3245,1678,1392]);
assert.deepEqual(foyerFaces,[2363+171,1085,6461,70*4+206,4053,1392+50+568,3*123+469,1085,6461,6461]);
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
function freightStyles(paint,vertices){
  if(!paint)return;
  const packed=Buffer.from(paint.bytes,'base64'),style=new Uint8Array(vertices);
  let last=0,offset=0;
  for(const [start,count] of paint.spans){
    assert(Number.isInteger(start)&&Number.isInteger(count)&&start>=last&&count>0&&start+count<=vertices);
    last=start+count;
    for(let i=start;i<last;i++,offset+=4){
      style[i]=packed[offset+3];
      assert(style[i]>=1&&style[i]<=10);
    }
  }
  assert.equal(offset,packed.length);
  return style;
}
function meshEnd(bytes, offset, runs = [],paint,near=false) {
  const vertices = bytes.readUInt32LE(offset);
  const indices = bytes.readUInt32LE(offset + 4);
  assert(vertices > 0 && indices > 0 && indices % 3 === 0);
  const styles=freightStyles(paint,vertices),indexSize=vertices>65535?4:2,indexStart=offset+32+vertices*7;
  let last = 0;
  for (const [face, count, role] of runs) {
    assert(Number.isInteger(face) && Number.isInteger(count) && count > 0 && face >= last);
    last = face + count;
    assert(last <= indices / 3 && Number.isInteger(role) && role>=1 && role<firstFoyer+foyerFaces.length, 'Invalid triangle material range');
    if(role===freightRole){
      assert(styles);
      for(let f=face;f<last;f++){
        const p=indexStart+3*f*indexSize,style=styles[bytes.readUIntLE(p,indexSize)];
        assert(style&&style===styles[bytes.readUIntLE(p+indexSize,indexSize)]&&style===styles[bytes.readUIntLE(p+indexSize*2,indexSize)]);
        if(near)freightFaces[style]++;
      }
    }
    if(role>=firstCabinet&&role<firstRoom)checkCabinetFrame(bytes,offset,vertices,face,count,role);
  }
  return offset + 32 + vertices * 7 + indices * (vertices > 65535 ? 4 : 2);
}
const overview = gunzipSync(read('data/overview.gz'));
let overviewOffset = 0;
for (const cell of cells) {
  const mesh = gunzipSync(read('data/' + cell.file));
  const finish=appearances[cell.file]||{};
  assert.equal(meshEnd(mesh,0,finish.near,finish.nearFreight,true),mesh.length,cell.file);
  if(cell.overview)overviewOffset=meshEnd(overview,overviewOffset,finish.far,finish.farFreight);
}
assert.deepEqual(freightFaces,[0,618*138,357*134,260*120,325*136,217*316,2*120,2*120,7*138,6*134,5*324]);
assert.equal(read('data/freight-finish.webp').subarray(8,12).toString(),'WEBP');
for(const name of ['chamber','chamber-materials'])assert.equal(read('data/'+name+'.webp').subarray(8,12).toString(),'WEBP');
assert.equal(read('data/foyer-finish.webp').subarray(8,12).toString(),'WEBP');
const foyer=json('foyer.json');
assert.equal(foyer.panes.length,14);
for(const [left,right,base,head,z] of foyer.panes){
  assert(left>=65.65&&right<=81.26&&right>left&&head>base&&z>45.40&&z<45.58);
  assert(head<=-25.7||base>=-25.5||right<=69.68||left>=77.28);
}
const door=foyer.panes.filter(p=>p[4]<45.5).sort((a,b)=>a[0]-b[0]);
assert.equal(door.length,2);
assert(Math.abs(door[1][0]-door[0][1]-2.94)<.01);
assert(foyer.suit.eye.length===3&&foyer.suit.axes.length===3&&foyer.suit.axes.every(row=>Math.abs(Math.hypot(...row)-1)<.0001));
assert.deepEqual(foyer.frames.map(f=>[f.instance,f.reference]),[[10536,8795],[10603,8689],[15819,8689]]);
assert(foyer.frames.every(f=>f.matrix.length===16&&f.matrix.every(Number.isFinite)));
const chamber=json('chamber-study.json');
assert(chamber.eye.length===3&&chamber.eye.every(Number.isFinite)&&chamber.rotation.length===3&&chamber.rotation.every(row=>row.length===3&&Math.abs(Math.hypot(...row)-1)<.001));
assert(chamber.width>0&&chamber.height>0&&chamber.focal>0);
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
