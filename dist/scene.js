'use strict';
const viewport=$('viewport'), stage=$('stage');
let gl, scene, camera, material, tiles=[], heights, atlas, grid, dirty=true;
let radius=1050, azimuth=.68, pitch=.78, target, flyYaw=0, flyPitch=0, groundVelocity=0, transition=null;
let arrivalSerial=0,awaitingLanding=false;
let jumpPending=false;
let glReady=false, detailClock=0, activeLoads=0, frameNum=0;
const rays=[], keys=new Set(), pointers=new Map(), resident=new Set();
const DEG=Math.PI/180;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const palette=[[.39,.42,.30],[.48,.48,.43],[.70,.71,.64],[.47,.55,.56],[.46,.51,.47],[.60,.51,.40],[.51,.57,.59],[.61,.62,.56]];
const vertexShader=`
attribute float regionColor;
varying float category;
varying vec3 world;
void main(){
  category=regionColor;
  world=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const fragmentShader=`
uniform sampler2D chart;
uniform sampler2D elevation;
uniform sampler2D surveyPhotos;
uniform sampler2D surveyDepth;
uniform vec3 surveyEye[SURVEY_COUNT];
uniform mat3 surveyAxes[SURVEY_COUNT];
uniform vec2 surveyFocal[SURVEY_COUNT];
uniform vec4 surveyBounds[SURVEY_COUNT];
uniform vec4 surveyRect[SURVEY_COUNT];
uniform float enableSurvey;
uniform float submerged;
uniform vec3 immersionTint;
uniform float immersionLevel;
uniform float contours;
uniform vec3 colors[8];
varying vec3 world;
varying float category;
float roof(vec2 p){
 vec4 packedHeight=texture2D(elevation,clamp((p+512.5)/1024.,0.,1.));
 return (dot(packedHeight.rg,vec2(255.,65280.))-32768.)*.01;
}
${architecturalSurfaces}
${labProjection}
vec3 registeredSurface(vec3 shaded, vec3 normal) {
 if(enableSurvey<.5)return shaded;
 for(int i=0;i<SURVEY_COUNT;i++){
   vec4 box=surveyBounds[i];
   if(world.x<box.x || world.x>box.y || world.z<box.z || world.z>box.w)continue;
   vec3 local=surveyAxes[i]*(world-surveyEye[i]);
   if(local.z<=0.)continue;
   vec2 pixel=local.xy/local.z*surveyFocal[i]+.5;
   if(any(lessThan(pixel,vec2(0.)))||any(greaterThan(pixel,vec2(1.))))continue;
   vec2 uv=surveyRect[i].xy+pixel*surveyRect[i].zw;
   vec3 sampleDepth=texture2D(surveyDepth,uv).rgb;
   float metres=dot(sampleDepth.rg,vec2(2.55,652.8));
   float visibility=sampleDepth.b*(1.-smoothstep(.10,.55,abs(local.z-metres)));
   float angle=abs(dot(normal,normalize(surveyEye[i]-world)));
   shaded=mix(shaded,texture2D(surveyPhotos,uv).rgb,visibility*smoothstep(.12,.38,angle));
 }
 return shaded;
}
void main(){
 vec3 n=normalize(cross(dFdx(world),dFdy(world)));
 if(officeGlazing())discard;
 if(n.y<0. && category<.5)n=-n;
 vec2 uv=(world.xz-vec2(6.87,63.8025))/1308.85742+.5;
 vec3 ortho=texture2D(chart,uv).rgb;
 float satellite=dot(ortho,vec3(.30,.52,.18));
 float high=roof(world.xz);
 float exterior=(1.-smoothstep(.5,9.,max(0.,high-world.y)));
 float up=abs(n.y);
 vec3 base=colors[int(floor(category+.5))];
 float water=smoothstep(.009,.035,ortho.b-ortho.r)*(1.-smoothstep(.085,.23,satellite));
 if(category<.5){
   base=mix(vec3(.29,.30,.24),vec3(.58,.58,.46),clamp(satellite*3.0,0.,1.));
   base=mix(base,vec3(.12,.25,.25),water);
 }else{
   base=mix(base,vec3(.27,.32,.31)+vec3(.85,.83,.74)*sqrt(satellite),up*exterior*.95);
 }
 float sun=dot(n,normalize(vec3(-.52,.90,-.36)));
 float shade=clamp(.79+.34*sun,.50,1.17);
 float shadow=0.;
 for(int i=1;i<=5;i++){
    float d=float(i*i)*1.6;
    float obstacle=roof(world.xz+vec2(-.72,-.52)*d)-world.y-d*.88;
    shadow=max(shadow,smoothstep(.7,4.,obstacle));
 }
 base=finishedSurface(base*shade,n,exterior,ortho);
 base*=mix(1.,.74,shadow*exterior);
 if(category<.5){
    float edge=abs(fract(world.y/5.+.5)-.5)/max(fwidth(world.y/5.),.001);
    base=mix(base,base*.72,(1.-smoothstep(.1,1.,edge))*contours*.56*(1.-water)*smoothstep(30.,130.,distance(cameraPosition,world)));
 }
 float noise=fract(sin(dot(floor(world*19.),vec3(.19,3.19,7.41)))*471.37);
 base+=.016*(noise-.5);
 base=registeredSurface(base,n);
 base=labFinish(base,world,n);
 float fall=smoothstep(360.,650.,length((world.xz-vec2(0.,22.))*vec2(1.18,.9)));
 base=mix(base,vec3(.115,.153,.135),fall*.89);
 float wetPath=distance(cameraPosition,world)*clamp((immersionLevel-cameraPosition.y)/max(.001,world.y-cameraPosition.y),0.,1.);
 float haze=submerged*(1.-exp(-.046*wetPath));
 gl_FragColor=vec4(mix(base,immersionTint,haze),1.);
}`;
async function inflated(file) {
  const reply=await fetch('data/'+file);
  if(!reply.ok) throw Error('地图文件读取失败 '+file);
  const bytes=await reply.arrayBuffer();
  const tag=new Uint8Array(bytes,0,Math.min(3,bytes.byteLength));
  if(tag[0]!==0x1f || tag[1]!==0x8b || tag[2]!==8)return bytes;
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
async function jsonFile(file){const res=await fetch('data/'+file);if(!res.ok)throw Error(file);return res.json()}
function topAt(x,z){const col=clamp(Math.round(x+512),0,1023),row=clamp(Math.round(z+512),0,1023);return Math.max(-96,(heights?.[row*1024+col]??-3800)*.01)}
function readMesh(view,offset,surfaceRuns){
  let p=offset;
  const uint=()=>{const v=view.getUint32(p,true);p+=4;return v};
  const float=()=>{const v=view.getFloat32(p,true);p+=4;return v};
  const n=uint(),t=uint(),lo=[float(),float(),float()],hi=[float(),float(),float()];
  const pos=new Float32Array(n*3);
  for(let i=0;i<pos.length;i++,p+=2){const k=i%3;pos[i]=lo[k]+view.getUint16(p,true)*(hi[k]-lo[k])/65535}
  const color=new Uint8Array(view.buffer,p,n);p+=n;
  const index=n>65535?new Uint32Array(t):new Uint16Array(t);
  for(let i=0;i<t;i++,p+=index.BYTES_PER_ELEMENT)index[i]=n>65535?view.getUint32(p,true):view.getUint16(p,true);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('regionColor',new THREE.BufferAttribute(Uint8Array.from(color),1));
  geo.setIndex(new THREE.BufferAttribute(surfaceRuns?applySurfaceRuns(geo,index,surfaceRuns):index,1));
  geo.boundingBox=new THREE.Box3(new THREE.Vector3(...lo),new THREE.Vector3(...hi));
  geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,surfaceRuns?architecturalMaterials:material);
  if(geo.boundingBox.intersectsBox(poolRoomBounds))mesh.layers.enable(poolReflectionLayer);
  return {mesh,offset:p};
}
async function initialize3D(){
  gl=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:true});
  gl.setPixelRatio(Math.min(devicePixelRatio,1.6));viewport.append(gl.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(39,1,.12,5000);
  target=new THREE.Vector3(0,-25,24);
  const [field,manifest,overview,water,appearance,cabins,basin,routes]=await Promise.all([inflated('height.gz'),jsonFile('cells.json'),inflated('overview.gz'),inflated('water.gz'),inflated('appearance.gz'),jsonFile('lab-equipment.json'),inflated('basin.gz'),jsonFile('ladders.json')]);
  ladders=routes;
  const finishes=JSON.parse(new TextDecoder().decode(appearance));
  const photo=new THREE.Texture(atlas);
  photo.flipY=false;photo.needsUpdate=true;
  heights=new Int16Array(field);
  const rgba=new Uint8Array(1024*1024*4);
  heights.forEach((h,i)=>{const v=h+32768;rgba[4*i]=v&255;rgba[4*i+1]=v>>8;rgba[4*i+3]=255});
  const texture=new THREE.DataTexture(rgba,1024,1024);texture.needsUpdate=true;
  material=new THREE.ShaderMaterial({vertexShader,fragmentShader,side:THREE.DoubleSide,extensions:{derivatives:true},uniforms:{chart:{value:photo},elevation:{value:texture},contours:{value:1},colors:{value:palette.map(a=>new THREE.Vector3(...a))}}});
  material.defines={SURVEY_COUNT:1};
  Object.assign(material.uniforms,labUniforms);
  Object.assign(material.uniforms,{
    surveyPhotos:{value:null},surveyDepth:{value:null},finishColor:{value:null},finishNormal:{value:null},seatPhoto:{value:null},finishReady:{value:0},
    surveyEye:{value:[new THREE.Vector3()]},surveyAxes:{value:[new THREE.Matrix3()]},
    surveyFocal:{value:[new THREE.Vector2()]},surveyBounds:{value:[new THREE.Vector4()]},
    surveyRect:{value:[new THREE.Vector4()]},enableSurvey:{value:0}
  });
  architecturalMaterials=makeArchitecturalMaterials(material,cabins);
  loadSurveyTextures().catch(error=>console.warn('部分实景纹理加载失败',error));
  loadFinishes().catch(error=>console.warn('近景材质加载失败',error));
  loadLabFinish().catch(error=>console.warn('浮力室材质加载失败',error));
  const view=new DataView(overview);let p=0;
  tiles=manifest.map(cell=>{
    cell.surfaces=finishes[cell.file];
    if(cell.overview){const result=readMesh(view,p,cell.surfaces?.far);cell.low=result.mesh;p=result.offset;scene.add(cell.low)}
    cell.bbox=new THREE.Box3(new THREE.Vector3(...cell.min),new THREE.Vector3(...cell.max));
    return cell;
  });
  if(p!==overview.byteLength)throw Error('场景分区索引不一致');
  THREE.Mesh.prototype.raycast=MeshBVHLib.acceleratedRaycast;
  installHarbor(water);
  installPool(JSON.parse(new TextDecoder().decode(basin)));
  installOffice().catch(error=>console.warn('总裁室陈设加载失败',error));
  grid=new THREE.GridHelper(3200,128,0x48584c,0x374238);grid.position.y=-95;scene.add(grid);
  glReady=hasGL=true;resize3D();home3D();orbitCamera();
}
const surveyViews=new Map();
async function loadSurveyTextures(){
  const loader=new THREE.TextureLoader();
  const [poses,color,depth]=await Promise.all([
    jsonFile('survey-cameras.json'),loader.loadAsync('data/survey-photos.webp'),
    loader.loadAsync('data/survey-depth.png')
  ]);
  for(const texture of [color,depth]){
    texture.flipY=false;texture.needsUpdate=true;
  }
  depth.generateMipmaps=false;
  depth.magFilter=depth.minFilter=THREE.NearestFilter;
  const u=material.uniforms;
  u.surveyPhotos.value=color;u.surveyDepth.value=depth;
  u.surveyAxes.value=poses.map(p=>new THREE.Matrix3().set(...p.rotation.flat()));
  u.surveyEye.value=poses.map(p=>new THREE.Vector3(...p.eye));
  u.surveyFocal.value=poses.map(p=>new THREE.Vector2(p.focal/p.width,p.focal/p.height));
  u.surveyBounds.value=poses.map(p=>new THREE.Vector4(...p.bounds));
  u.surveyRect.value=poses.map(p=>new THREE.Vector4(...p.rect));
  for(const pose of poses)surveyViews.set(pose.name,pose);
  material.defines.SURVEY_COUNT=poses.length;
  u.enableSurvey.value=1;material.needsUpdate=true;dirty=true;
}
function visitSurvey(pose){
  changeView('fly');
  camera.position.fromArray(pose.eye);
  const [right,downward,forward]=pose.rotation;
  const orientation=new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...right),new THREE.Vector3(...downward).negate(),new THREE.Vector3(...forward).negate()
  );
  camera.quaternion.setFromRotationMatrix(orientation);
  flyPitch=camera.rotation.x;flyYaw=camera.rotation.y;
  const fitHeight=Math.max(pose.height,pose.width/camera.aspect);
  camera.fov=2*Math.atan(fitHeight/(2*pose.focal))/DEG;
  camera.updateProjectionMatrix();dirty=true;detailClock=0;
}
function resize3D(){
  if(!gl||!camera)return;
  const w=stage.clientWidth,h=stage.clientHeight;
  camera.aspect=w/h;camera.updateProjectionMatrix();gl.setSize(w,h,false);dirty=true;
}
function homeRadius(){return Math.max(970,930/(camera.aspect||1))}
function home3D(){
  if(!glReady)return;
  climbing=null;
  arrivalSerial++;awaitingLanding=false;transition=null;view='orbit';camera.fov=39;camera.updateProjectionMatrix();radius=homeRadius();azimuth=.64;pitch=.83;target.set(0,-29,33);syncMode();dirty=true;
}
function orbitCamera(){
  const horizontal=radius*Math.cos(pitch);
  camera.position.set(target.x+Math.sin(azimuth)*horizontal,target.y+radius*Math.sin(pitch),target.z+Math.cos(azimuth)*horizontal);
  camera.up.set(0,1,0);camera.lookAt(target);
}
function focusPoint(item){
  if(!glReady)return;
  if(view!=='orbit')changeView('orbit');
  transition={from:target.clone(),to:new THREE.Vector3(item.x,topAt(item.x,item.z)-4,item.z),r:radius,end:Math.min(220,homeRadius()*.3),start:performance.now()};
  dirty=true;
}
function mouseZoom(factor){if(isFlat){flatZoom(factor);return}if(view==='orbit'){transition=null;radius=clamp(radius*factor,12,2100)}else{const dir=camera.getWorldDirection(new THREE.Vector3());if(view==='fly')camera.position.addScaledVector(dir,factor<1?8:-8);else{camera.fov=clamp(camera.fov*factor,42,89);camera.updateProjectionMatrix()}}dirty=true}
function distanceXZ(box,p){
  return Math.hypot(Math.max(box.min.x-p.x,0,p.x-box.max.x),Math.max(box.min.z-p.z,0,p.z-box.max.z));
}
function fetchCell(cell){
  if(cell.full)return Promise.resolve(true);
  if(cell.loading)return cell.promise;
  cell.promise=readCell(cell);return cell.promise;
}
async function readCell(cell){
  activeLoads++;cell.loading=true;
  try{
    const buf=await inflated(cell.file),{mesh}=readMesh(new DataView(buf),0,cell.surfaces?.near);
    cell.full=mesh;scene.add(mesh);resident.add(cell);
    if(cell.low)cell.low.visible=false;
    dirty=true;return true;
  }catch(e){cell.retry=performance.now()+12000;note('局部模型加载失败，将自动重试')}
  finally{cell.loading=false;activeLoads--}
}
function streamDetail(now){
  if(awaitingLanding)return;
  const anchor=view==='orbit'?target:camera.position;
  const range=view==='orbit'?(radius<330?115:0):115;
  for(const cell of resident){
    if(!range||distanceXZ(cell.bbox,anchor)>range+95){
      scene.remove(cell.full);cell.full.geometry.dispose();cell.full=null;resident.delete(cell);if(cell.low)cell.low.visible=true;dirty=true;
    }
  }
  if(!range)return;
  const next=tiles.filter(c=>!c.full&&!c.loading&&!(c.retry>now)&&distanceXZ(c.bbox,anchor)<range);
  next.sort((a,b)=>distanceXZ(a.bbox,anchor)-distanceXZ(b.bbox,anchor));
  for(const c of next.slice(0,Math.max(0,4-activeLoads)))fetchCell(c);
}
const cast=new THREE.Raycaster();cast.firstHitOnly=true;
function hit(origin,direction,length){
  cast.set(origin,direction);cast.near=.015;cast.far=length;
  let best=null;
  const end=origin.clone().addScaledVector(direction,length);
  for(const cell of tiles){
    const mesh=cell.full||cell.low, b=cell.bbox;if(!mesh)continue;
    if(Math.max(origin.x,end.x)<b.min.x||Math.min(origin.x,end.x)>b.max.x||Math.max(origin.z,end.z)<b.min.z||Math.min(origin.z,end.z)>b.max.z||Math.max(origin.y,end.y)<b.min.y||Math.min(origin.y,end.y)>b.max.y)continue;
    if(!mesh.geometry.boundsTree)mesh.geometry.boundsTree=new MeshBVHLib.MeshBVH(mesh.geometry,{maxLeafTris:14});
    rays.length=0;mesh.raycast(cast,rays);if(rays.length&&(!best||rays[0].distance<best.distance))best=rays[0];
  }
  if(officeBounds&&cast.ray.intersectsBox(officeBounds)&&officeBounds.distanceToPoint(origin)<=length){
    rays.length=0;cast.intersectObjects(officeSolids,false,rays);
    if(rays.length&&(!best||rays[0].distance<best.distance))best=rays[0];
  }
  if(pool&&pool.bounds.distanceToPoint(origin)<=length&&cast.ray.intersectsBox(pool.bounds)){
    rays.length=0;cast.intersectObjects(pool.solids,false,rays);
    if(rays.length&&(!best||rays[0].distance<best.distance))best=rays[0];
  }
  return best;
}
const down=new THREE.Vector3(0,-1,0);
function dropAt(x,z,reference=null){
  const y=reference??topAt(x,z)+2;
  const floor=hit(new THREE.Vector3(x,y+1,z),down,230);
  if(floor&&!crouched){
    const origin=floor.point.clone();origin.y+=.05;
    crouched=!!hit(origin,waterUp,standHeight+headMargin-.05);
  }
  camera.position.set(x,(floor?.point.y??topAt(x,z))+eyeHeight(),z);groundVelocity=0;
}
function cancelArrival(){arrivalSerial++;if(awaitingLanding){awaitingLanding=false;$('ready').textContent='场景就绪'}}
async function changeView(mode,arrival=false){
  if(!glReady)return;
  if(mode==='walk'&&view===mode&&!isFlat&&!arrival)return;
  climbing=null;
  crouched=false;crouchToggle=false;
  if(mode!=='walk')releaseMouseLook();
  if(routeMapOpen)closeRouteMap(false);
  jumpPending=false;
  if(isFlat)setFlat(false);
  cancelArrival();const order=arrivalSerial;
  transition=null;
  const prev=view;
  if(mode==='orbit'&&prev!=='orbit'){
    const dir=camera.getWorldDirection(new THREE.Vector3());target.copy(camera.position).addScaledVector(dir,18);target.y=clamp(target.y,-68,90);radius=100;pitch=.65;azimuth=flyYaw;
  }else if(mode!=='orbit'){
    if(prev==='orbit'||arrival){
      const pt=chosen||{x:8,z:-142}, anchor=chosen?new THREE.Vector3(pt.x,0,pt.z):target;
      if(mode==='walk'){
        // Use a nearby outdoor approach instead of dropping onto a landmark roof.
        const place=chosen||points.find(p=>p.name==='中控桥');
        const stop=place?.landings[chosen?Number($('landing').value)||0:place.landings.length-1]||approach(pt);
        awaitingLanding=true;
        const needed=tiles.filter(c=>distanceXZ(c.bbox,stop)<3);
        $('ready').textContent='载入漫游起点';
        const loaded=await Promise.all(needed.map(fetchCell));
        if(order!==arrivalSerial)return;
        awaitingLanding=false;$('ready').textContent='场景就绪';
        if(loaded.some(v=>!v)){note('起点模型尚未载入，请重试');return}
        crouched=!!stop.crouch;
        if(stop.water){camera.position.set(stop.x,harbor.level+.28,stop.z);groundVelocity=0}
        else dropAt(stop.x,stop.z,stop.y==null?null:stop.y+.3);
        flyYaw=stop.yaw??Math.atan2(stop.x-pt.x,stop.z-pt.z);flyPitch=stop.pitch??-.04;
      }else{
        const dist=chosen?48:190;
        camera.position.set(anchor.x+dist*.7,topAt(anchor.x,anchor.z)+dist*.65,anchor.z+dist);
        flyYaw=Math.atan2(.7,1);flyPitch=-.48;
      }
    }else if(mode==='walk'){
      const water=waterAt(camera.position);
      if(water){
        groundVelocity=0;
        if(camera.position.y>water.level){
          const floor=hit(camera.position,down,camera.position.y-water.level+.12);
          if(floor)dropAt(camera.position.x,camera.position.z,camera.position.y);
          else camera.position.y=water.level+.28;
        }
      }else dropAt(camera.position.x,camera.position.z,camera.position.y);
    }
    camera.rotation.order='YXZ';camera.rotation.set(flyPitch,flyYaw,0);
  }
  view=mode;camera.fov=mode==='orbit'?39:67;camera.updateProjectionMatrix();
  if(mode!=='orbit')$('selection').hidden=true;
  syncMode();dirty=true;detailClock=0;
}
function approach(p){
  let best=null;
  for(const r of [8,15,23,32])for(let k=0;k<12;k++){
    const x=p.x+r*Math.sin(k*Math.PI/6),z=p.z+r*Math.cos(k*Math.PI/6),y=topAt(x,z);
    const slope=Math.max(...[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>Math.abs(y-topAt(x+a,z+b))));
    if(y< -47||slope>1)continue;
    const cost=(y+47)*.68+r*.18+slope*3;
    if(!best||cost<best.cost)best={x,z,cost};
  }
  return best||p;
}
function slideHorizontal(dx,dz,base,offsets,bodyHeight=0){
  const eye=camera.position;
  for(const [x,z] of [[dx,0],[0,dz]]){
    const len=Math.hypot(x,z);if(!len)continue;
    const dir=new THREE.Vector3(x/len,0,z/len);
    if(offsets.some(h=>hit(new THREE.Vector3(eye.x,base+h,eye.z),dir,len+.23)))continue;
    if(bodyHeight){
      const next=new THREE.Vector3(eye.x+x+dir.x*.20,base+.49,eye.z+z+dir.z*.20);
      if(hit(next,waterUp,bodyHeight+headMargin-.49))continue;
    }
    eye.x+=x;eye.z+=z;
  }
}
function walkStep(dx,dz,dt){
  setStance(wantsCrouch());
  const eye=camera.position,height=eyeHeight(),feet=eye.y-height;
  slideHorizontal(dx,dz,feet,[.46,height-.18],height);
  const floor=hit(new THREE.Vector3(eye.x,feet+.48,eye.z),down,2.4);
  const standing=floor&&groundVelocity<=0&&Math.abs(feet-floor.point.y)<.12;
  if(jumpPending&&standing)groundVelocity=5.8;
  jumpPending=false;
  groundVelocity=Math.max(-18,groundVelocity-14*dt);
  let next=eye.y+groundVelocity*dt;
  if(groundVelocity>0){
    const ceiling=hit(eye,waterUp,next-eye.y+headMargin);
    if(ceiling){next=eye.y+Math.max(0,ceiling.distance-headMargin);groundVelocity=0}
  }else if(floor&&next<=floor.point.y+height){
    next=floor.point.y+height;groundVelocity=0;
  }
  eye.y=next;
  if(eye.y< -100){const p=approach(chosen||{x:8,z:-142});dropAt(p.x,p.z)}
}
function advance(dt){
  if(!awaitingLanding&&!$('dialog').open&&!$('room-dialog').open&&!isFlat&&view!=='orbit'){
    const f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
    const r=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
    const v=Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ')||keys.has('ControlLeft'));
    if(climbing&&view==='walk'){climbStep(Math.sign(f||v),dt);return}
    const walking=view==='walk',rate=walking?(swimming?3.2:crouched?2:4.2):24;
    const sprint=(!walking||!crouched)&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));
    const speed=rate*(sprint?(walking?1.7:2.8):1)*dt/Math.max(1,Math.hypot(f,r));
    const dx=(-Math.sin(flyYaw)*f+Math.cos(flyYaw)*r)*speed,dz=(-Math.cos(flyYaw)*f-Math.sin(flyYaw)*r)*speed;
    if(view==='walk'){
      const old=camera.position.clone();
      if(swimming){jumpPending=false;swimStep(dx,dz,v,dt)}else walkStep(dx,dz,dt);
      dirty||=old.distanceToSquared(camera.position)>1e-8;
    }else if(f||r||v){
      camera.position.x=clamp(camera.position.x+dx,-650,650);camera.position.z=clamp(camera.position.z+dz,-650,700);camera.position.y=clamp(camera.position.y+v*speed,-98,700);dirty=true;
    }
  }
}
function animate3D(now,dt){
  if(!glReady)return;
  advanceFlood(now);
  if(isFlat)return;
  const steps=view==='walk'?Math.max(1,Math.ceil(dt/.04)):1;
  for(let i=0;i<steps;i++){if(view==='walk')updateImmersion();advance(dt/steps)}
  if(transition){
    const t=clamp((now-transition.start)/550,0,1),s=t*t*(3-2*t);
    target.lerpVectors(transition.from,transition.to,s);radius=THREE.MathUtils.lerp(transition.r,transition.end,s);
    if(t===1)transition=null;dirty=true;
  }
  if(now>detailClock){streamDetail(now);detailClock=now+240}
  if(!dirty)return;
  if(view==='orbit')orbitCamera();
  updateImmersion();
  camera.updateMatrixWorld();if(!routeMapOpen){reflectPool(now);gl.render(scene,camera)}frameNum++;dirty=false;
  const xyz=view==='orbit'?target:camera.position;
  updateHUD(xyz.x,xyz.z,camera.position.y,view==='orbit'?azimuth:flyYaw);
  if(routeMapOpen)updateMapPosition();
  layoutPins((p)=>{
    const v=new THREE.Vector3(p.x,topAt(p.x,p.z)+2,p.z);
    const dist=camera.position.distanceTo(v);
    v.project(camera);return {x:(v.x+1)*stage.clientWidth/2,y:(1-v.y)*stage.clientHeight/2,show:v.z>-1&&v.z<1&&(view==='orbit'||dist<135)};
  },view==='orbit'&&radius<380);
}
