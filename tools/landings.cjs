/* Derive landing points from full-resolution geometry, with clearance in a human-sized
   volume. The heights are mesh surface elevations, not game floor numbers. */
const fs=require('node:fs'), path=require('node:path'), zlib=require('node:zlib');
const THREE=require('../dist/vendor/three.min.js');
const vm=require('node:vm');
const scope={THREE,console,performance};vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../dist/vendor/bvh.js'),'utf8'),scope);
const lib=scope.MeshBVHLib;
const folder=path.resolve(__dirname,'../dist/data');
const tiles=JSON.parse(fs.readFileSync(path.join(folder,'cells.json')));
const regions=JSON.parse(fs.readFileSync(path.join(folder,'regions.json'),'utf8').replace(/^\uFEFF/,''));
const down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
const {measureRoutes}=require('./ladder-routes.cjs');
const ray=new THREE.Raycaster();THREE.Mesh.prototype.raycast=lib.acceleratedRaycast;
function load(tile) {
  if(tile.mesh)return tile.mesh;
  const buf=zlib.gunzipSync(fs.readFileSync(path.join(folder,tile.file)));
  const n=buf.readUInt32LE(0),t=buf.readUInt32LE(4),pos=new Float32Array(3*n),idx=new Uint32Array(t);
  let p=32;
  for(let i=0;i<n*3;i++,p+=2){const k=i%3;pos[i]=tile.min[k]+buf.readUInt16LE(p)/65535*(tile.max[k]-tile.min[k])}
  p+=n;
  for(let i=0;i<t;i++,p+=n>65535?4:2)idx[i]=n>65535?buf.readUInt32LE(p):buf.readUInt16LE(p);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(idx,1));
  g.boundsTree=new lib.MeshBVH(g);tile.mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));return tile.mesh;
}
function rays(near,origin,dir,max,first=true){
  ray.set(origin,dir);ray.near=.02;ray.far=max;ray.firstHitOnly=first;
  const hits=[];const end=origin.clone().addScaledVector(dir,max);
  for(const t of near){
    if((Math.max(origin.x,end.x)<t.min[0])||(Math.min(origin.x,end.x)>t.max[0])||(Math.max(origin.z,end.z)<t.min[2])||(Math.min(origin.z,end.z)>t.max[2]))continue;
    load(t).raycast(ray,hits);
  }
  return hits.sort((a,b)=>a.distance-b.distance);
}
function findStops(region,requiredHeight=null){
  const cx=(region.mapX-668650)/100,cz=(region.mapY+452830)/100;
  const near=tiles.filter(t=>t.max[0]>cx-50&&t.min[0]<cx+50&&t.max[2]>cz-50&&t.min[2]<cz+50);
  const cand=[];
  for(const radius of [0,4,8,13,19,25])for(let a=0;a<(radius?12:1);a++){
    const x=cx+radius*Math.cos(a*Math.PI/6),z=cz+radius*Math.sin(a*Math.PI/6), dir=new THREE.Vector3();
    const stack=rays(near,new THREE.Vector3(x,114,z),down,159,false);
    let last=999;
    for(const floor of stack){
      const y=floor.point.y;if(last-y<.3||Math.abs(floor.face.normal.y)<.94)continue;last=y;
      if(requiredHeight!==null&&Math.abs(y-requiredHeight)>.32)continue;
      if(rays(near,new THREE.Vector3(x,y+.03,z),up,1.95).length)continue;
      let clearance=100, yaw=0,best=0;
      for(let i=0;i<12;i++){
        const angle=i*Math.PI/6;
        dir.set(-Math.sin(angle),0,-Math.cos(angle));
        const d=rays(near,new THREE.Vector3(x,y+1.4,z),dir,32)[0]?.distance??32;
        clearance=Math.min(d,clearance);
        const alignment=(Math.cos(angle)*Math.cos(Math.atan2(x-cx,z-cz))+Math.sin(angle)*Math.sin(Math.atan2(x-cx,z-cz)));
        const score=d*(.85+.15*alignment);
        if(score>best){best=score;yaw=angle}
      }
      if(clearance<1.5||best<7)continue;
      const stable=[[1.1,0],[-1.1,0],[0,1.1],[0,-1.1]].every(([dx,dz])=>{
        const p=new THREE.Vector3(x+dx,y+.38,z+dz), landing=rays(near,p,down,.8)[0];
        return landing&&Math.abs(landing.point.y-y)<.23&&!rays(near,new THREE.Vector3(p.x,y+.1,p.z),up,1.85).length;
      });
      if(stable)cand.push({x,y,z,yaw,score:Math.min(8,clearance)*.5+Math.min(20,best)*.08-radius*.44});
    }
  }
  const levels=[];
  for(const c of cand.sort((a,b)=>b.score-a.score)){
    if(!levels.some(s=>Math.abs(s.y-c.y)<3.4))levels.push(c);
    if(levels.length>=5)break;
  }
  for(const c of levels)delete c.score;
  return levels.sort((a,b)=>a.y-b.y).map(c=>Object.fromEntries(Object.entries(c).map(([k,v])=>[k,+v.toFixed(3)])));
}
function buildStops(region){
  if(!region.anchors)return findStops(region);
  const confirmed=region.anchors.map(anchor=>{
    if(anchor.water){
      const b=zlib.gunzipSync(fs.readFileSync(path.join(folder,'water.gz')));
      const size=b.readUInt32LE(),origin=b.readFloatLE(4),spacing=b.readFloatLE(8);
      const i=Math.floor((anchor.z-origin)/spacing)*size+Math.floor((anchor.x-origin)/spacing);
      if(!b[16+i])throw Error('Water start falls outside the harbor');
      return {...anchor,y:b.readFloatLE(12)};
    }
    const wanted=anchor.mapHeight/100+190;
    const stop=findStops(anchor,wanted)[0];
    if(!stop)throw Error('Could not place a walker at '+anchor.label);
    return {...stop,label:anchor.label};
  });
  if(!region.includeOtherLevels)return confirmed;
  return confirmed.concat(findStops(region).filter(stop=>confirmed.every(s=>Math.abs(s.y-stop.y)>=3.4)));
}
// Walkable approaches to the window bays and the office sculpture, in scene metres.
const views={
  '中控区':{label:'南侧斜窗',x:-26,z:-211.5,probeY:-12,yaw:Math.PI,pitch:-.23},
  '宿舍区':{label:'弧窗客房',x:-183.7,z:-108.9,probeY:-15.2,yaw:Math.PI/2,pitch:-.04},
  '总裁室':{label:'雕塑前厅',x:5.4,z:3.8,probeY:-5,yaw:1.05,pitch:.09}
};
function viewStop({label,x,z,probeY,yaw,pitch}){
  const origin=new THREE.Vector3(x,probeY,z);
  const floor=rays(tiles,origin,down,5)[0];
  if(!floor||Math.abs(floor.face.normal.y)<.94)throw Error('Missing floor at '+label);
  origin.y=floor.point.y+.03;
  if(rays(tiles,origin,up,1.95).length)throw Error('Insufficient headroom at '+label);
  return {label,x,y:+floor.point.y.toFixed(3),z,yaw:+yaw.toFixed(4),pitch};
}
const ladders=measureRoutes({THREE,tiles,rays,up,down,water:zlib.gunzipSync(fs.readFileSync(path.join(folder,'water.gz')))});
const ladderFile=path.join(folder,'ladders.json');
if(process.argv.includes('--check-ladders')){
  require('node:assert/strict').deepEqual(JSON.parse(fs.readFileSync(ladderFile)),ladders);
  console.log('Verified '+ladders.length+' ladder shafts, end supports and clearances against the collision meshes.');
  const study=JSON.parse(fs.readFileSync(path.join(folder,'training-rooms.json')));
  const eye=new THREE.Vector3(...study.eye);
  for(const point of [[-58.39,-24.93,21.64],[-47.55,-25.27,23.20]]){
    const dir=new THREE.Vector3(...point).sub(eye),distance=dir.length();
    if(rays(tiles,eye,dir.normalize(),distance-.80).length)throw Error('Centrifuge reference view is obstructed');
  }
  const cross=new THREE.Vector3(-1,0,0);
  for(const z of [19.40,19.65,19.90])for(const y of [-30.04,-29.35,-28.68]){
    if(rays(tiles,new THREE.Vector3(-45.75,y,z),cross,3.5).length)throw Error('Blocked A door');
  }
  console.log('Verified the centrifuge camera sightlines and walking clearance through A door.');
  return;
}
fs.writeFileSync(ladderFile,JSON.stringify(ladders));
const out={};for(const r of regions){
  out[r.name]=buildStops(r);
  if(views[r.name])out[r.name].push(viewStop(views[r.name]));
  if(r.name==='浮力室'){
    out[r.name].unshift(
      viewStop({label:'池沿吊架',x:-43,z:-52,probeY:-27,yaw:2.18265,pitch:-.1274}),
      viewStop({label:'深潜池下层',x:-56,z:-39,probeY:-39,yaw:-2.1588,pitch:.19})
    );
    out[r.name].splice(2,0,viewStop({label:'注水控制台 · S8',x:-43.65,z:-53.17,probeY:-27.3,yaw:2.38,pitch:-.25}));
    out[r.name].splice(3,0,viewStop({label:'池底黄梯',x:-46.60,z:-43.49,probeY:-39.6,yaw:0,pitch:.16}));
  }
  for(const route of ladders.filter(l=>l.region===r.name)){
    const {name,x,z,nx,nz}=route,yaw=Math.atan2(nx,nz);
    if(name!=='池底黄梯'&&name!=='池沿黄梯'){
      out[r.name].push({label:name+(route.water?' · 水面':' · 梯脚'),x:x+nx*.67,z:z+nz*.67,
        y:route.bottom,yaw,pitch:.28,...(route.water?{water:true}:{})});
    }
    out[r.name].push({label:name+' · 上口',x:x-nx*.77,z:z-nz*.77,y:route.top,
      yaw:yaw+Math.PI,pitch:-.48,...(route.headroom?{crouch:true}:{})});
  }
  if(r.name==='码头区')out[r.name].push(viewStop({label:'南侧平台售货机',x:-48.655,z:140.532,probeY:-31.86,yaw:-.6285,pitch:-.1151}));
  if(r.name==='黑室')out[r.name].push(viewStop({label:'器材架旁售货机',x:54.770,z:22.709,probeY:-27.65,yaw:1.986,pitch:-.12}));
  if(r.name==='离心机室'){
    out[r.name].push(viewStop({label:'A 门入口',x:-45.75,z:19.65,probeY:-28.95,yaw:Math.PI/2,pitch:0}));
    out[r.name].push(viewStop({label:'转臂训练舱',x:-62.8,z:15.6,probeY:-28.95,yaw:-2.94,pitch:.14}));
  }
  if(r.name==='蓝室'){
    out[r.name].push(viewStop({label:'下沉平台上沿',x:74,z:-49,probeY:-28.9,yaw:.72,pitch:.46}));
    out[r.name].push(viewStop({label:'试验台上层回廊',x:78.8,z:-69.5,probeY:-18.7,yaw:2.19,pitch:-.21}));
  }
  console.log(r.name,out[r.name].map(l=>l.y));
}
fs.writeFileSync(path.join(folder,'landings.json'),JSON.stringify(out));
