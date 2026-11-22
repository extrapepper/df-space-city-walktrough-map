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
const hall=json('blue-hall.json');
assert.deepEqual(hall.views.map(p=>p.panorama),['6b6c845d019e43c8baa72dcb93fca777','96a3781d154448d4a1940f50c8aab69e']);
for(const v of hall.views){
  assert(v.eye.length===3&&v.eye.every(Number.isFinite)&&v.focal>0&&v.principal.length===2);
  assert(v.rotation.length===3&&v.rotation.every(row=>row.length===3&&Math.abs(Math.hypot(...row)-1)<.00001));
}
const blueAtlas=read('data/blue-hall.webp');
assert.equal(blueAtlas.subarray(8,16).toString(),'WEBPVP8X');
assert(blueAtlas[20]&16,'H3 atlas requires radial depths in alpha');
assert.equal(blueAtlas.readUIntLE(24,3)+1,2048);
assert.equal(blueAtlas.readUIntLE(27,3)+1,2048);
assert.equal(read('data/blue-reflectors.webp').subarray(8,12).toString(),'WEBP');
const trainingFaces=training.surfaces.map(()=>0);
const freightRole=firstRoom+training.surfaces.length,paintedFaces=new Array(33).fill(0);
const chamberFaces=require('./chamber.cjs').groups.map(()=>0);
const foyerFaces=require('./foyer.cjs').groups.map(()=>0),firstFoyer=freightRole+1+chamberFaces.length;
const commandFaces=require('./command.cjs').groups.map(()=>0),firstCommand=firstFoyer+foyerFaces.length;
const officeRole=firstCommand+commandFaces.length;
const serverRole=officeRole+1,labServerRole=serverRole+1;
const suiteFaces=require('./suite.cjs').groups.map(()=>0),firstSuite=labServerRole+1;
const strappedCrateRole=firstSuite+suiteFaces.length;
const palmRole=strappedCrateRole+1,palms=json('palms.json'),palmShapes=require('./palms.cjs');
const dorm=json('dorm.json'),dormRoles=new Array(dorm.windows.length+1+dorm.rooms.length+2).fill(0);
const doorRole=palmRole+dormRoles.length;
const launchFaces=require('./launch.cjs').groups.map(()=>0);
assert.deepEqual(dorm.rooms.map(r=>r.id),[7159,7160,7161]);
assert.deepEqual(dorm.doors.map(d=>d.id),[7110,7088,7091]);
assert.deepEqual([865,866,867].map(h=>dorm.windows.filter(w=>w.hull===h).length),[5,5,3]);
for(const d of dorm.doors)for(const segment of d.segments){
  assert.equal(segment.vertices.length,24);assert.equal(segment.indices.length,36);
  assert(segment.vertices.every(Number.isFinite)&&segment.indices.every(i=>Number.isInteger(i)&&i>=0&&i<8));
}
const dormCam=json('dorm-camera.json');
assert(dormCam.focal>0&&dormCam.rotation.length===3&&dormCam.eye.every(Number.isFinite));
for(const file of ['dorm-bedroom.webp','dorm-furniture.webp','dorm-oak.webp'])assert.equal(read('data/'+file).subarray(8,12).toString(),'WEBP');
assert.deepEqual(palmShapes.counts.map((_,k)=>palms.native.filter(t=>t.hull===1384+k).length),palmShapes.counts);
assert(palms.native.every((t,i)=>t.id===12947+i));
assert.equal(palms.courtyard.length,4);
const controlCamera=json('survey-cameras.json').find(p=>p.name==='control');
const crownPixels=[[194,240],[241,218],[423,215],[495,258]];
palms.courtyard.forEach((tree,i)=>{
  const d=tree.tip.map((v,k)=>v-controlCamera.eye[k]);
  const [x,y,z]=controlCamera.rotation.map(row=>row.reduce((sum,k,j)=>sum+k*d[j],0));
  const [u,v]=crownPixels[i];
  assert(z>0&&Math.hypot(x/z*controlCamera.focal+controlCamera.width/2-u,
    y/z*controlCamera.focal+controlCamera.height/2-v)<1.2,'Forecourt crown misses the filmed trunk');
});
for(const t of [...palms.native,...palms.courtyard]){
  assert(t.foot.length===3&&t.tip.length===3&&[...t.foot,...t.tip].every(Number.isFinite));
  assert(t.tip[1]-t.foot[1]>2.7&&t.tip[1]-t.foot[1]<21);
}
const frond=read('data/palm-frond.webp');
assert.equal(frond.subarray(8,16).toString(),'WEBPVP8X');
assert(frond[20]&16,'The palm leaflets require alpha');
assert.equal(read('data/palm-bark.webp').subarray(8,12).toString(),'WEBP');
const steps=read('data/forecourt-steps.webp');
assert.equal(steps.subarray(8,16).toString(),'WEBPVP8L');
const stepSize=steps.readUInt32LE(21);
assert.equal(1+(stepSize&16383),200);
assert.equal(1+((stepSize>>>14)&16383),96);
let labServerFaces=0,palmFaces=0;
for(const cell of Object.values(appearances)){
  for(const [,count,role] of cell.near||[]){
    if(role>doorRole){launchFaces[role-doorRole-1]+=count;continue}
    if(role>palmRole){dormRoles[role-palmRole-1]+=count;continue}
    if(role===palmRole){palmFaces+=count;continue}
    if(role===strappedCrateRole)continue;
    if(role>=firstSuite){suiteFaces[role-firstSuite]+=count;continue}
    if(role===labServerRole){labServerFaces+=count;continue}
    if(role===officeRole||role===serverRole)continue;
    if(role>=firstCommand){commandFaces[role-firstCommand]+=count;continue}
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
assert.deepEqual(commandFaces,[494,6*56,122]);
assert.equal(labServerFaces,106+156);
assert.equal(palmFaces,palmShapes.counts.reduce((sum,n,i)=>sum+n*palmShapes.faces[i],0));
assert.deepEqual(dormRoles,[...dorm.windows.map(w=>({865:48,866:24,867:12})[w.hull]),9*88,210,210,210,3*(40+400),3*3*12]);
assert.deepEqual(launchFaces,[1435,1696,1334,4*1050,2856,1428]);
const recovery=json('launch-return.json'),{profile,offsets,pose}=recovery;
assert.equal(offsets.length,61);assert(offsets.every((v,i)=>Number.isFinite(v)&&(!i||v<=offsets[i-1])));
assert(Math.abs(offsets[recovery.referenceFrame])<.001&&Math.abs(offsets.at(-1)+profile[0][0]+6.48)<.02);
assert(profile.every(([y,r],i)=>Number.isFinite(y)&&r>0&&r<4.2&&(!i||y>profile[i-1][0])));
assert.equal(pose.width,720);assert.equal(pose.height,405);assert(pose.eye.length===3&&pose.focal>0);
for(const kind of ['ring','deck','arm','vehicle','return','mast','zinc','lattice'])assert.equal(read('data/launch-'+kind+'.webp').subarray(8,12).toString(),'WEBP');
const horizon=json('horizon.json'),island=horizon.island;
for(const row of [horizon.inner,horizon.lower,horizon.crest]){
  assert.equal(row.length,horizon.angles);assert(row.every(Number.isFinite));
}
assert(island.start<island.end&&island.crest.length===island.crestRadii.length);
assert(island.crest.every(Number.isFinite)&&island.crestRadii.every(r=>r>island.footRadius&&r<horizon.radius));
for(const name of ['horizon-range','horizon-island','horizon-sky','horizon-ground','office-outlook']){
  assert.equal(read('data/'+name+'.webp').subarray(8,12).toString(),'WEBP');
}
const offshore=gunzipSync(read('data/offshore.gz'));
assert.equal(meshEnd(offshore,0),offshore.length);
assert.equal(offshore.readUInt32LE(4),3*(1334+2856));
// Compare the mast tips and island skyline to their traced image coordinates.
function projectToPhoto(camera,point){
  const delta=point.map((v,i)=>v-camera.eye[i]);
  const [x,y,z]=camera.rotation.map(row=>row.reduce((sum,v,i)=>sum+v*delta[i],0));
  if(z<=0)return null;
  return [camera.width/2+camera.focal*x/z,camera.height/2+camera.focal*y/z];
}
const tower=json('launch-mast.json'),launchWorld=require('./launch.cjs').world;
function checkTowerPhoto(camera,[u,h,f],pixel,tolerance){
  const {x,z}=launchWorld(u,f),actual=projectToPhoto(camera,[x,h,z]);
  assert(actual&&Math.hypot(actual[0]-pixel[0],actual[1]-pixel[1])<tolerance,'Mast misses filmed position '+pixel);
}
for(const [i,pixel] of [[290.5,65.2],[444.4,39.5],[443,67.8],[322,134.5],[295,137.2]].entries()){
  checkTowerPhoto(tower.camera,tower.plate[i],pixel,.1);
}
for(const [i,pixel] of [[249,59],[273,68],[276,146],[257,149]].entries())checkTowerPhoto(tower.camera,tower.housing[i],pixel,.1);
for(const [side,camera,pixels,limit] of [
  [-1,tower.camera,[[249.5,350],[169.5,371],[365.5,568.5]],2],
  [1,pose,[[345.5,237.7],[350.4,241.2],[383.3,289]],4]
]){
  for(const [i,[level,edge]] of [[0,0],[0,1],[1,0]].entries()){
    const anchor=[side*tower.mountU[level],tower.height[level],tower.front[level]+edge*tower.width[level]];
    checkTowerPhoto(camera,anchor,pixels[i],limit);
  }
}
for(const [i,[u,v]] of [[357.5,110],[378.5,126.4],[390.2,135.5]].entries()){
  const tip=[-135,103.1,368].map((n,j)=>n+(i+1)*horizon.mastSpacing[j]);
  const [x,y]=projectToPhoto(horizon.guideCamera,tip);
  assert(Math.hypot(x-u,y-v)<4,'Offshore tower misses exterior photo');
}
const islandRidge=island.crest.map((y,i)=>{
  const angle=(island.start+(island.end-island.start)*i/(island.crest.length-1))*Math.PI/180;
  return [island.crestRadii[i]*Math.sin(angle),y,-island.crestRadii[i]*Math.cos(angle)];
});
for(const [camera,marks] of [[horizon.windowCamera,[[288,172],[369,158],[428,190]]],[pose,[[95,245],[134,254]]]]){
  const line=islandRidge.map(p=>projectToPhoto(camera,p)).filter(Boolean).sort((a,b)=>a[0]-b[0]);
  for(const [u,v] of marks){
    const i=line.findIndex(p=>p[0]>=u);assert(i>0,'Island misses photo');
    const [x0,y0]=line[i-1],[x1,y1]=line[i];
    assert(Math.abs(y0+(y1-y0)*(u-x0)/(x1-x0)-v)<6,'Island silhouette misses photo');
  }
}
assert.deepEqual(suiteFaces,[3047,4*509+2*383,2*364,2*178,2152+2510]);
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
      assert(style[i]>=1&&style[i]<paintedFaces.length);
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
    assert(last <= indices / 3 && Number.isInteger(role) && role>=1 && role<=doorRole+launchFaces.length, 'Invalid triangle material range');
    if(role===freightRole||role===officeRole||role===serverRole||role===strappedCrateRole){
      assert(styles);
      for(let f=face;f<last;f++){
        const p=indexStart+3*f*indexSize,style=styles[bytes.readUIntLE(p,indexSize)];
        assert(style&&style===styles[bytes.readUIntLE(p+indexSize,indexSize)]&&style===styles[bytes.readUIntLE(p+indexSize*2,indexSize)]);
        assert.equal(role,style===32?strappedCrateRole:style>=24?serverRole:style>10?officeRole:freightRole);
        if(near)paintedFaces[style]++;
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
assert.deepEqual(paintedFaces,[0,618*138,357*134,260*120,325*136,217*316,2*120,2*120,7*138,6*134,3*324,
  99*202,84*417,118*34,49*322,322,322,0,4*28,3*28,3*78,426+3*496,28+12*2,2*78,
  23*170,127*58,2*324,8*12,192,6*12,2*12,3*12,30*28]);
assert.equal(read('data/server-finish.webp').subarray(8,12).toString(),'WEBP');
assert.equal(read('data/suite-finish.webp').subarray(8,12).toString(),'WEBP');
const terminalFrames=json('server-terminals.json');
assert.deepEqual(terminalFrames.map(t=>t.id),[13450,15508,18207,18306,18307,18732,18735,18811]);
for(const f of terminalFrames){
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  assert(f.foot.length===3&&f.foot.every(Number.isFinite));
  assert([f.right,f.up,f.front].every(v=>Math.abs(dot(v,v)-1)<.00001));
  assert(Math.abs(dot(f.right,f.front))+Math.abs(dot(f.up,f.front))+Math.abs(dot(f.up,f.right))<.00001);
}
assert.equal(read('data/command-finish.webp').subarray(8,12).toString(),'WEBP');
const wallScreen=json('command-screens.json');
assert.equal(wallScreen.indices.length,322*3);
assert.equal(wallScreen.positions.length,wallScreen.paint.length);
assert(wallScreen.positions.every(Number.isFinite)&&wallScreen.indices.every(i=>Number.isInteger(i)&&i>=0&&i*3<wallScreen.positions.length));
assert(wallScreen.paint.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
assert.deepEqual(wallScreen.copies,[[-3.68,14],[-2.45,17],[-1.22,14],[1.23,17]]);
assert.deepEqual(wallScreen.planters.map(p=>p.map(v=>Math.round(v*10))),[[516,-231,178],[599,-231,178]]);
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
