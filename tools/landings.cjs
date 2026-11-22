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
const propViews=[
  {region:'中控区',label:'楼前双层集装箱',x:7.74,z:-179.11,probeY:-32.5,yaw:-.3927,pitch:.14,reach:7.3},
  {region:'中控桥',label:'桥面运输箱',x:4,z:-122.11,probeY:-24,yaw:1.1781,pitch:-.12,reach:3.0},
  {region:'中心花园',label:'货箱间通道',x:36.73,z:118.14,probeY:-33,yaw:1.1781,pitch:-.14,reach:3.35},
  {region:'浮力室',label:'门厅宇航服展台',x:-76.742,z:-68.923,probeY:-29.3,yaw:-.733,pitch:.095,reach:3.59},
  {region:'浮力室',label:'门厅发动机展台',x:-65.9,z:-69.7,probeY:-29.3,yaw:-1.0761,pitch:.095,reach:5.34},
  {region:'水平试车场',label:'横置发动机',x:159.694,z:238.188,probeY:-30.85,yaw:Math.PI/2,pitch:.099,reach:3.94}
];
function propStop(view){
  const stop=viewStop(view),eye=new THREE.Vector3(stop.x,stop.y+1.7,stop.z);
  const direction=new THREE.Vector3(-Math.sin(stop.yaw)*Math.cos(stop.pitch),Math.sin(stop.pitch),-Math.cos(stop.yaw)*Math.cos(stop.pitch));
  const hit=rays(tiles,eye,direction,view.reach+1.3)[0];
  if(!hit||hit.distance<view.reach-.5)throw Error('Obstructed prop at '+view.label);
  return stop;
}
const chamberViews=[
  {label:'试验台南侧',x:36.55,z:20.54,probeY:-28,yaw:-.325,pitch:.30,panorama:'7dcb597ea0214feeacd3096cd4d6223b'},
  {label:'圆形舱门',x:55,z:12,probeY:-28,yaw:-.309,pitch:.52,panorama:'9975712dcc694b5085cae9c63e1c3f31'},
  {label:'蓝色试验舱门槛',x:41.4,z:-1.15,probeY:-28,yaw:0,pitch:.09,panorama:'9975712dcc694b5085cae9c63e1c3f31'},
  {label:'正门玻璃入口',x:73.46,z:48.3,probeY:-29.3,yaw:0,pitch:.06,panorama:'c5864a8a9e814e15b7f3c4ed33d5bd90',detail:'从两扇玻璃门之间进大厅。左边是宇航服，右边是发动机。顺着左墙上的 STAIRS 标记可以找到楼梯间。'},
  {label:'门厅宇航服展台',x:69.35,z:37.0,probeY:-29.3,yaw:1.78,pitch:.11,panorama:'c5864a8a9e814e15b7f3c4ed33d5bd90'},
  {label:'门厅发动机展台',x:70.8,z:39.8,probeY:-29.3,yaw:-1.31,pitch:.12,panorama:'c5864a8a9e814e15b7f3c4ed33d5bd90'},
  {label:'一楼楼梯入口',x:60,z:33.04,probeY:-29.3,yaw:Math.PI/2,pitch:.06,panorama:'ebba6be3a12d46d7a97cfdd93d591ebc',detail:'从读卡柱之间进入。右转上短梯可到试验大厅。左转上长梯，在半层平台折返，走完第二段楼梯后直行，进入二楼指挥室。'},
  {label:'二楼指挥室观察窗',x:53.20,z:23.90,probeY:-22.5,yaw:-.114,pitch:.03,panorama:'514be042bb094cb9a26226f7211bbe6c',detail:'窗上排着五块显示屏。站在工作桌后向外看，可以找到一楼的圆形试验舱门。西墙的大灯箱靠近楼梯入口。'},
  {label:'二楼指挥室西墙灯箱',x:55.50,z:22.20,probeY:-22.5,yaw:Math.PI/2,pitch:.08,panorama:'514be042bb094cb9a26226f7211bbe6c',detail:'面向 HAAVK 灯箱时，左手边的门通往楼梯。转身沿中央浅色地砖走，可以到房间另一端。'}
];
const serverViews=[
  {region:'黑室',label:'指挥室东门',x:65.9,z:21.96,probeY:-22.5,yaw:-Math.PI/2,pitch:.015,panorama:'22ae16c3020f46dabecf26c79f95153e',detail:'直行穿过黑色门框就到服务器房。进门后向左绕过第一排机柜，靠近百叶窗的一侧有两台倒下的窄柜。'},
  {region:'黑室',label:'二楼倾倒机柜',x:74.55,z:19.26,probeY:-22.5,yaw:-.36,pitch:.04,panorama:'6fb90a34511b4c1585c00042248ac7b7'},
  {region:'黑室',label:'服务器房中央通道',x:80.38,z:24.36,probeY:-22.5,yaw:.059,pitch:.015,panorama:'a6bf3a6a39ae45d8a79e8ab5dd81d987',detail:'左右两组长机柜之间可以通行。前方绿墙边有一台带亮屏的设备。从机柜任意一端绕回西侧，都能回到指挥室。'},
  {region:'离心机室',label:'二楼服务器房西门',x:-71.3,z:6.92,probeY:-18.8,yaw:-Math.PI/2,pitch:.01,panorama:'9b32501a53ed48969d23a8b42bf41227',detail:'从西门直走，右侧有窄屏服务器。保持前进，靠近横在过道上的倒柜时按空格跳过去。走到房间另一头向右转，可从南门出去。'},
  {region:'离心机室',label:'二楼服务器房南门',x:-43.61,z:11.8,probeY:-18.8,yaw:0,pitch:.01,panorama:'ba5895cb58084d80909825493a761db5',detail:'穿过门洞后向左转。沿两排机柜之间的过道向西走，可以返回西门。'},
  {region:'蓝室',label:'二楼机柜区北门',x:47,z:-45.4,probeY:-18.8,yaw:Math.PI,pitch:.015,detail:'穿过北门向左转，沿两列机柜之间的过道往东走。遇到横倒的窄柜，保持移动并按空格起跳。'}
];
function interiorStop(view){return {...viewStop(view),...(view.panorama?{panorama:view.panorama}:{}),...(view.detail?{detail:view.detail}:{})}}
const suiteViews=[
  {label:'会客厅台阶',x:1.13,z:-13.71,yaw:Math.PI,pitch:.12,panorama:'0ebda5a2944147c39ba3fc88362ab9f1',detail:'沿两座花池之间的七级台阶上行，穿过 OFFICE 门框就进了办公室。转身可以看见中央的 HAAVK 斜柱。'},
  {label:'会客厅 H2 走廊口',x:-11.1,z:-16.50,yaw:Math.PI/2,pitch:.04,panorama:'fbe5ce1483be4de5926aee37dcd4db2b',detail:'穿过 H2 门，正前方是浮力室标志，走廊在这里向右转。回到会客厅后，朝两座花池中间走可以进办公室。'},
  {label:'会客厅 H4 走廊口',x:12.75,z:-16.50,yaw:-Math.PI/2,pitch:.04,panorama:'6d9425144fa14c48969fe0e9c00a457a',detail:'穿过 H4 门，正前方是黑室标志。回到会客厅后，中央斜柱和花池之间的台阶可以帮助辨别方向。'},
  {label:'会客厅中央斜柱',x:5.00,z:-16.00,yaw:.648,pitch:.21,panorama:'0ebda5a2944147c39ba3fc88362ab9f1'},
  {label:'会客厅沙发区',x:5.00,z:-23.65,yaw:-.875,pitch:.09,panorama:'ffb46101b5b4448b9c47337644089600',detail:'北墙装着两幅发光的设备图，两侧各有两张长沙发、一张扶手椅和一张圆茶几。沿斜柱侧面走回大厅即可找到办公室台阶。'}
].map(v=>({...v,probeY:-8.20}));
const bridgeEntries=[
  {region:'黑室',label:'四楼总裁连廊入口',x:32.76,z:19.29,probeY:-8.14,yaw:Math.PI/2,pitch:0,detail:'穿过门框后右转向北，沿玻璃连廊绕过货箱。约 36 米后向左转，穿过 H4 门进入会客厅。花池之间的七级台阶通往办公室。'},
  {region:'浮力室',label:'四楼总裁连廊入口',x:-30.46,z:-52.96,probeY:-8.14,yaw:-Math.PI/2,pitch:0,panorama:'be36e178aacc4e8790d2c829b4fdf395',detail:'穿过门框后右转向南，沿玻璃连廊绕过货箱。约 36 米后向左转，穿过 H2 门进入会客厅。花池之间的七级台阶通往办公室。'}
];
const officeWalks=new Map([
  ['西侧层间梯',[[32.76,8],[32.76,19.29],[27.79,19.29],[27.79,2.2],[26.46,2.2],[26.46,-16.5],[6,-16.5],[6,-13.4],[1.13,-13.4],[1.13,-5.4]]],
  ['东侧层间梯',[[-30.46,-41.76],[-30.46,-52.96],[-25.98,-52.96],[-25.98,-48.68],[-24.68,-48.68],[-24.68,-16.5],[-3.5,-16.5],[-3.5,-13.4],[1.13,-13.4],[1.13,-5.4]]]
]);
function verifySuite(stops){
  const panoramas=JSON.parse(fs.readFileSync(path.join(folder,'room-views.json')))['总裁室'];
  for(const v of suiteViews){
    if(!panoramas.some(p=>p.id===v.panorama))throw Error('Missing lobby panorama '+v.label);
    require('node:assert/strict').deepEqual(stops['总裁室'].find(s=>s.label===v.label),interiorStop(v));
  }
  for(const v of bridgeEntries)require('node:assert/strict').deepEqual(stops[v.region].find(s=>s.label===v.label),interiorStop(v));
  const corridors=Array.from(officeWalks.values(),p=>p.slice(0,-1));
  corridors.push([[5,-23.65],[5,-16.5]]);
  // Each list samples the middle of all seven windows along one bridge.
  const bridges=[
    {x:27,glassX:24.655,zs:[-8,-4,0,5,9,16,21]},
    {x:-25,glassX:-22.391,zs:[-24,-30,-34,-39,-44,-49,-54]}
  ];
  for(const {x,glassX,zs} of bridges){
    const direction=new THREE.Vector3(Math.sign(glassX-x),0,0);
    for(const z of zs){
      const pane=rays(tiles,new THREE.Vector3(x,-7.8,z),direction,4)[0];
      if(!pane||Math.abs(pane.point.x-glassX)>.016)throw Error('Missing executive bridge window at '+x+', '+z);
    }
  }
  for(const path of corridors)for(let i=1;i<path.length;i++){
    const [ax,az]=path[i-1],[bx,bz]=path[i];
    const len=Math.hypot(bx-ax,bz-az),direction=new THREE.Vector3((bx-ax)/len,0,(bz-az)/len);
    for(const side of [-.30,0,.30]){
      const x=ax+side*direction.z,z=az-side*direction.x;
      for(const height of [.35,1.64]){
        const wall=rays(tiles,new THREE.Vector3(x,-9.57+height,z),direction,len)[0];
        if(wall)throw Error('Obstructed executive corridor at '+wall.point.toArray().join(', '));
      }
      for(let k=0;k<=Math.ceil(len/.25);k++){
        const d=Math.min(k*.25,len),p=new THREE.Vector3(x+d*direction.x,-9.26,z+d*direction.z);
        const hit=rays(tiles,p,down,.55)[0];
        if(!hit||Math.abs(hit.point.y+9.57)>.13||rays(tiles,p,up,1.55).length)throw Error('Broken executive lobby floor');
      }
    }
  }
  for(const x of [.80,1.13,1.46]){
    let y=-9.574,rises=0;
    for(let i=0;i<=80;i++){
      const z=-13.4+i*.10,p=new THREE.Vector3(x,y+.29,z),floor=rays(tiles,p,down,.49)[0];
      if(!floor||floor.point.y<y-.02||floor.point.y>y+.19)throw Error('Broken office entrance stair');
      if(floor.point.y>y+.12)rises++;
      y=floor.point.y;p.y=y+.04;
      if(rays(tiles,p,up,1.88).length)throw Error('Low office doorway');
    }
    if(rises!==7||Math.abs(y+8.398)>.012)throw Error('Office staircase height changed');
  }
}
function verifyChamber(stops){
  const panoramas=JSON.parse(fs.readFileSync(path.join(folder,'room-views.json')))['黑室'];
  for(const v of chamberViews){
    if(!panoramas.some(s=>s.id===v.panorama))throw Error('Missing panorama for '+v.label);
    require('node:assert/strict').deepEqual(stops['黑室'].find(s=>s.label===v.label),interiorStop(v));
  }
  for(const x of [40.8,41.4,42]){
    const ground=z=>rays(tiles,new THREE.Vector3(x,-28.1,z),down,1.5)[0]?.point.y;
    const rise=ground(-3.15)-ground(-2.5);
    if(!(rise>.70&&rise<.76))throw Error('H4 test chamber sill height changed');
    for(const y of [-28.08,-27.25,-26.25]){
      if(rays(tiles,new THREE.Vector3(x,y,-1.15),new THREE.Vector3(0,0,-1),5).length)throw Error('Blocked H4 test chamber opening');
    }
  }
  // Follow the entrance and the first two flights using successive floor
  // samples. A ray from roof level would land on overlapping upper stairs.
  const route=[[73.46,48.3],[73.46,33.04],[55.05,33.04],
    [55.05,12],[55.05,33.04],[55.05,42.5],[52.35,42.5],[52.35,31.2],
    [52.35,25.5],[53.20,23.90],[55.50,22.20]];
  let height=stops['黑室'].find(s=>s.label==='正门玻璃入口').y;
  for(let j=1;j<route.length;j++){
    const [sx,sz]=route[j-1],[ex,ez]=route[j],steps=Math.ceil(Math.hypot(ex-sx,ez-sz)/.20);
    for(let k=1;k<=steps;k++){
      const x=sx+(ex-sx)*k/steps,z=sz+(ez-sz)*k/steps;
      const floor=rays(tiles,new THREE.Vector3(x,height+.42,z),down,.9)[0];
      if(!floor||Math.abs(floor.point.y-height)>.25||Math.abs(floor.face.normal.y)<.55)throw Error('Discontinuous H4 entrance route');
      height=floor.point.y;
      if(rays(tiles,new THREE.Vector3(x,height+.05,z),up,1.91).length)throw Error('Low ceiling on H4 stairs');
    }
    if(j===3&&Math.abs(height+29.09)>.035)throw Error('H4 pressure hatch approach changed');
    if(j===5&&Math.abs(height+26.529)>.035)throw Error('H4 first landing changed');
    if(j===7&&Math.abs(height+23.972)>.035)throw Error('H4 return landing changed');
  }
  if(Math.abs(height+23.648)>.035)throw Error('H4 command room floor changed');
  const eye=new THREE.Vector3(53.2,height+1.70,23.9),toHatch=new THREE.Vector3(58.58,-19.22,1.15).sub(eye);
  const depth=toHatch.length(),hub=rays(tiles,eye,toHatch.normalize(),depth+1)[0];
  if(!hub||Math.abs(hub.distance-depth)>.24)throw Error('H4 observation window has lost sight of the hatch');
}
function verifyServerRooms(stops){
  const panoramas=JSON.parse(fs.readFileSync(path.join(folder,'room-views.json')));
  for(const view of serverViews){
    if(view.panorama&&!panoramas[view.region].some(v=>v.id===view.panorama))throw Error('Missing server room panorama '+view.label);
    require('node:assert/strict').deepEqual(stops[view.region].find(s=>s.label===view.label),interiorStop(view));
  }
  const paths=[
    [-23.648,[[53.2,23.9],[65.9,23.9],[65.9,21.96],[71.1,21.96],[71.1,19.22],[80.38,19.22],
       [80.38,24.36],[75,24.6],[71.1,24.6],[71.1,21.96],[68,21.96]]],
    [-20.128,[[-71.3,6.92],[-56.94,6.92]]],[-20.128,[[-43.61,11.8],[-43.61,6.92],[-54.68,6.92]]],
    [-20.128,[[47,-45.4],[47,-40.7],[63.78,-40.7]]],[-20.128,[[65.83,-40.7],[75.5,-40.7]]]
  ];
  for(const [base,points] of paths)for(let i=1;i<points.length;i++){
    const [ax,az]=points[i-1],[bx,bz]=points[i];
    const len=Math.hypot(bx-ax,bz-az),steps=Math.ceil(len/.15),nx=(bz-az)/len,nz=(ax-bx)/len;
    const along=new THREE.Vector3(-nz,0,nx);
    for(const side of [-.27,0,.27])for(const h of [.46,1.5]){
      if(rays(tiles,new THREE.Vector3(ax+side*nx,base+h,az+side*nz),along,len).length)
        throw Error('Wall across server room walking route');
    }
    for(let j=0;j<=steps;j++)for(const side of [-.29,0,.29]){
      const x=ax+(bx-ax)*j/steps+side*nx,z=az+(bz-az)*j/steps+side*nz;
      const floor=rays(tiles,new THREE.Vector3(x,base+.32,z),down,.63)[0];
      if(!floor||Math.abs(floor.point.y-base)>.07||Math.abs(floor.face.normal.y)<.85||
          rays(tiles,new THREE.Vector3(x,floor.point.y+.04,z),up,1.91).length)
        throw Error('Obstructed server aisle at '+x+', '+z);
    }
  }
  // These two fallen cabinets cross the centre line. Sample the actual
  // obstacle tops separately from the standing floor on either approach.
  for(const [xs,z,lo,hi] of [[[-55.95,-55.72,-55.49],6.92,.62,.72],[[64.62,64.8,65.02],-40.7,.60,.64]]){
    for(const x of xs){
      const top=rays(tiles,new THREE.Vector3(x,-18.3,z),down,2.2)[0];
      if(!top||top.point.y+20.128<lo||top.point.y+20.128>hi||
        rays(tiles,new THREE.Vector3(x,top.point.y+.035,z),up,2.1).length)
        throw Error('Server aisle obstacle or overhead clearance changed');
    }
  }
}
const ladders=measureRoutes({THREE,tiles,rays,up,down,water:zlib.gunzipSync(fs.readFileSync(path.join(folder,'water.gz')))});
for(const r of ladders){
  const path=officeWalks.get(r.name);
  if(!path)continue;
  if(Math.hypot(path[0][0]-(r.x-.77*r.nx),path[0][1]-(r.z-.77*r.nz))>.03)throw Error('Office path misses ladder landing');
  r.officePath=path;
}
const ladderFile=path.join(folder,'ladders.json');
const extraction=JSON.parse(fs.readFileSync(path.join(folder,'extraction.json'),'utf8'));
function extractionStop(site){
  const {label,probeY}=site.landing;
  if(!site.panel)return viewStop({...site.landing,x:(site.mapX-668650)/100,z:(site.mapY+452830)/100});
  const [px,py,pz]=site.panel,[nx,nz]=site.normal;
  const reach=2.2,x=px+reach*nx,z=pz+reach*nz,yaw=Math.atan2(nx,nz);
  const stop=viewStop({label,x,z,probeY,yaw,pitch:0});
  const depth=site.instance ? .36 : .24;
  stop.pitch=+Math.atan2(py-stop.y-1.70,reach-depth).toFixed(4);
  const eye=new THREE.Vector3(x,stop.y+1.70,z),toward=new THREE.Vector3(px+nx*depth,py,pz+nz*depth).sub(eye);
  const distance=toward.length();
  if(rays(tiles,eye,toward.normalize(),distance-.08).length)throw Error('Obstructed switch at '+label);
  const back=rays(tiles,new THREE.Vector3(px+nx*.55,py,pz+nz*.55),new THREE.Vector3(-nx,0,-nz),.66)[0];
  if(!back||(!site.instance&&Math.abs(back.distance-.55)>.06))throw Error('Missing mounting surface at '+label);
  return stop;
}
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
  const stops=JSON.parse(fs.readFileSync(path.join(folder,'landings.json')));
  verifyChamber(stops);
  verifyServerRooms(stops);
  verifySuite(stops);
  console.log('Verified the H2 and H4 ladder-to-office walks, seven entrance steps and the seating aisle.');
  console.log('Verified the H4 server aisle loop and access through the H1 west, H1 south and H3 north doors.');
  console.log('Verified H4 entrance, both stair flights, command room, hatch sightline and test-bay sill.');
  for(const view of propViews)require('node:assert/strict').deepEqual(stops[view.region].find(s=>s.label===view.label),propStop(view));
  for(const site of extraction.filter(site=>site.landing)){
    const actual=stops[site.region].find(stop=>stop.label===site.landing.label);
    require('node:assert/strict').deepEqual(actual,extractionStop(site));
  }
  console.log('Verified extraction platforms, switch mounts and walking sightlines.');
  return;
}
fs.writeFileSync(ladderFile,JSON.stringify(ladders));
const out={};for(const r of regions){
  out[r.name]=buildStops(r);
  if(views[r.name])out[r.name].push(viewStop(views[r.name]));
  for(const view of propViews.filter(v=>v.region===r.name))out[r.name].push(propStop(view));
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
      yaw:yaw+Math.PI,pitch:-.48,...(route.headroom?{crouch:true}:{}),
      ...(name==='西侧层间梯'?{detail:'从梯口向南约 11 米，右边的门通往四楼连廊。进门后右转向北，沿玻璃窗走到尽头，再左转进入总裁室会客厅。'}:{}),
      ...(name==='东侧层间梯'?{detail:'从梯口向北约 11 米，右边的门通往四楼连廊。进门后右转向南，沿玻璃窗走到尽头，再左转进入总裁室会客厅。'}:{})});
  }
  if(r.name==='码头区')out[r.name].push(viewStop({label:'南侧平台售货机',x:-48.655,z:140.532,probeY:-31.86,yaw:-.6285,pitch:-.1151}));
  if(r.name==='黑室')out[r.name].push(viewStop({label:'器材架旁售货机',x:54.770,z:22.709,probeY:-27.65,yaw:1.986,pitch:-.12}));
  out[r.name].push(...serverViews.filter(v=>v.region===r.name).map(interiorStop));
  out[r.name].push(...bridgeEntries.filter(v=>v.region===r.name).map(interiorStop));
  if(r.name==='总裁室'){
    out[r.name].push(...suiteViews.map(interiorStop),
      interiorStop({label:'沙发间木道',x:1.13,z:13.2,probeY:-6.85,yaw:0,pitch:.09,panorama:'d9886183b0ca44d4af9a591605a39fd5',detail:'穿过两排沙发之间的木地板向前，走上矮台阶可以抵达金属雕塑。'}),
      {...viewStop({label:'2024 · 全息地球仪',x:3.65,z:4.0,probeY:-6.65,yaw:2.31,pitch:.14}),officeYear:2024,detail:'按照 2024 年官方画面摆放全息地球仪。重新选择沙发间木道可回到开放的中央过道。'});
  }
  if(r.name==='黑室')out[r.name].unshift(...chamberViews.map(interiorStop));
  if(r.name==='离心机室'){
    out[r.name].push(viewStop({label:'A 门入口',x:-45.75,z:19.65,probeY:-28.95,yaw:Math.PI/2,pitch:0}));
    out[r.name].push(viewStop({label:'转臂训练舱',x:-62.8,z:15.6,probeY:-28.95,yaw:-2.94,pitch:.14}));
  }
  if(r.name==='蓝室'){
    out[r.name].push(viewStop({label:'下沉平台上沿',x:74,z:-49,probeY:-28.9,yaw:.72,pitch:.46}));
    out[r.name].push(viewStop({label:'试验台上层回廊',x:78.8,z:-69.5,probeY:-18.7,yaw:2.19,pitch:-.21}));
  }
  for(const site of extraction.filter(site=>site.region===r.name&&site.landing))out[r.name].push(extractionStop(site));
  console.log(r.name,out[r.name].map(l=>l.y));
}
fs.writeFileSync(path.join(folder,'landings.json'),JSON.stringify(out));
