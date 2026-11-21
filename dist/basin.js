'use strict';
let pool;
const poolTerminal=new THREE.Vector3(-44.90,-29.088,-51.855);
const poolBlue=new THREE.Color(.036,.145,.26);
const poolRoomBounds=new THREE.Box3(new THREE.Vector3(-82,-92,-67),new THREE.Vector3(-24,5,-13));
const poolReflectionLayer=1;
const floodSeconds=30;
function basinLayer(y){
  const layers=pool.shape.layers;
  let lo=0,hi=layers.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(y<layers[mid][1])hi=mid;else lo=mid+1}
  return layers[lo];
}
function basinRadius(layer,y,j){
  const [low,high,a,b]=layer;
  const w=THREE.MathUtils.clamp((y-low)/(high-low),0,1),profiles=pool.shape.profiles;
  return (profiles[a][j]*(1-w)+profiles[b][j]*w)*.01;
}
function insideBasin(x,y,z){
  const {center,layers}=pool.shape;
  if(y<layers[0][0]||y>pool.shape.full+.001)return false;
  const dx=x-center[0],dz=z-center[1],r=Math.hypot(dx,dz);
  if(r>26)return false;
  const n=pool.sectors,a=(Math.atan2(dz,dx)/(2*Math.PI)+1)%1*n,j=Math.floor(a),w=a-j;
  const layer=basinLayer(y);
  return r<=basinRadius(layer,y,j)*(1-w)+basinRadius(layer,y,(j+1)%n)*w;
}
function placePoolSurface(level){
  const attr=pool.surface.geometry.getAttribute('position'),layer=basinLayer(level);
  for(let j=0;j<pool.sectors;j++){
    const radius=basinRadius(layer,level,j);
    attr.setXYZ(j+1,radius*pool.cos[j],0,radius*pool.sin[j]);
  }
  attr.needsUpdate=true;pool.surface.position.y=level;pool.level=level;
  pool.surface.visible=true;pool.surface.updateMatrixWorld();
}
function makePoolWater(){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    uniforms:{clock:{value:0},reflected:{value:null},reflectionMatrix:{value:new THREE.Matrix4()},reflectionReady:{value:0}},
    vertexShader:`varying vec3 site;varying vec4 reflection;uniform mat4 reflectionMatrix;
      void main(){vec4 p=modelMatrix*vec4(position,1.);site=p.xyz;reflection=reflectionMatrix*p;
      gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform float clock,reflectionReady;uniform sampler2D reflected;varying vec3 site;varying vec4 reflection;
      void main(){
        vec2 p=site.xz;
        vec2 waves=vec2(sin(p.x*2.45+p.y*.91+clock*1.35)+.52*sin(p.y*4.8-clock*2.1),
          sin(p.y*2.2-p.x*1.82-clock*1.05)+.42*sin(p.x*4.2+clock*1.65));
        vec3 n=normalize(vec3(waves.x*.049,1.,waves.y*.043));
        float incidence=abs(dot(n,normalize(cameraPosition-site)));
        float fresnel=.15+.79*pow(1.-clamp(incidence,0.,1.),2.1);
        vec3 color=vec3(.028,.19,.33);
        if(gl_FrontFacing&&reflectionReady>.5&&reflection.w>0.){
          vec2 uv=clamp(.5+.5*reflection.xy/reflection.w+waves*.0035,.002,.998);
          color=mix(color,texture2D(reflected,uv).rgb*vec3(.78,.85,.99),fresnel);
        }
        float sheen=pow(max(0.,dot(reflect(-normalize(cameraPosition-site),n),normalize(vec3(.21,.81,-.55)))),65.);
        color+=vec3(.70,.88,1.)*sheen*.33;
        gl_FragColor=gl_FrontFacing?vec4(color,.72+.26*fresnel):vec4(.21,.49,.61,.37);
      }`
  });
}
function makeTerminal(){
  const group=new THREE.Group(),solids=[];
  group.position.copy(poolTerminal);group.rotation.y=2.395;
  const frame=new THREE.MeshStandardMaterial({color:0x727881,metalness:.18,roughness:.57});
  function box(w,h,d,x,y,z,mat,tilt=0){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);mesh.rotation.x=tilt;group.add(mesh);solids.push(mesh);return mesh;
  }
  box(.37,.10,.30,0,.05,0,frame);
  const fascia=new THREE.MeshBasicMaterial({color:0x767b83});
  const stem=box(.365,1.01,.23,0,.555,-.012,[frame,frame,frame,frame,fascia,frame],-.09);
  const verts=stem.geometry.getAttribute('position');
  for(let i=0;i<verts.count;i++)if(verts.getY(i)<0)verts.setX(i,verts.getX(i)*.76);
  verts.needsUpdate=true;stem.geometry.computeVertexNormals();
  box(.56,.38,.14,-.045,1.215,-.035,frame,-.23);
  const display=new THREE.MeshBasicMaterial({color:0x24b9b8});
  const panel=box(.49,.275,.013,-.064,1.22,.044,display,-.23);
  for(const part of solids)part.layers.enable(poolReflectionLayer);
  group.updateMatrixWorld(true);scene.add(group);
  pool.panel=panel;pool.display=display;pool.solids=solids;pool.bounds=new THREE.Box3().setFromObject(group);
  new THREE.TextureLoader().load('data/flood-housing.webp',tex=>{
    tex.colorSpace=THREE.SRGBColorSpace;fascia.map=tex;fascia.color.setHex(0xffffff);fascia.needsUpdate=true;dirty=true;
  });
  new THREE.TextureLoader().load('data/flood-console.webp',tex=>{
    tex.colorSpace=THREE.SRGBColorSpace;tex.repeat.x=.5;tex.offset.x=pool.state==='dry'?0:.5;
    display.map=tex;display.color.setHex(0xffffff);display.needsUpdate=true;dirty=true;
  });
}
function installPool(shape){
  const n=shape.profiles[0].length,positions=new Float32Array((n+1)*3),index=[];
  for(let i=0;i<n;i++)index.push(0,(i+1)%n+1,i+1);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(index);
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),32);
  const surface=new THREE.Mesh(geometry,makePoolWater());surface.position.set(shape.center[0],shape.layers[0][0],shape.center[1]);
  surface.visible=false;scene.add(surface);
  pool={shape,surface,state:'dry',level:shape.layers[0][0],sectors:n,cos:[],sin:[],volumes:[],
    total:0,lastRipple:0,mirror:new THREE.PerspectiveCamera(),lastMirror:0,
    mirrorEye:new THREE.Vector3(Infinity,0,0),mirrorRotation:new THREE.Quaternion(),mirrorLevel:-100,mirrorCells:-1};
  pool.mirror.layers.set(poolReflectionLayer);
  for(let i=0;i<n;i++){pool.cos.push(Math.cos(2*Math.PI*i/n));pool.sin.push(Math.sin(2*Math.PI*i/n))}
  const area=radii=>radii.reduce((sum,r,i)=>sum+r*radii[(i+1)%n],0)*Math.sin(2*Math.PI/n)*.00005;
  const areas=shape.profiles.map(area);
  for(const [low,high,a,b] of shape.layers){
    pool.total+=(high-low)*(areas[a]+areas[b])/2;pool.volumes.push(pool.total);
  }
  makeTerminal();
  $('reset-flood').onclick=()=>{resetFlood();note('浮力室已恢复干池')};
}
function targetTerminal(){
  if(!pool||view!=='walk'||isFlat||routeMapOpen||awaitingLanding||camera.position.distanceToSquared(poolTerminal)>18||$('dialog').open||$('room-dialog').open)return false;
  const target=pool.panel.getWorldPosition(new THREE.Vector3());
  const toward=target.sub(camera.position),len=toward.length();
  if(len>2.6||len<.08||toward.multiplyScalar(1/len).dot(camera.getWorldDirection(new THREE.Vector3()))<.86)return false;
  const obstacle=hit(camera.position,toward,len);
  return !obstacle || pool.solids.includes(obstacle.object) || obstacle.distance>len-.08;
}
function startFlood(){
  if(!pool||pool.state!=='dry'||!targetTerminal())return;
  pool.state='filling';pool.started=performance.now();pool.fraction=0;
  if(pool.display.map)pool.display.map.offset.x=.5;else pool.display.color.setHex(0xefbe5c);
  note('注水已启动');updateInteraction();dirty=true;
}
function resetFlood(){
  if(!pool)return;
  pool.state='dry';pool.surface.visible=false;pool.level=pool.shape.layers[0][0];pool.fraction=0;
  if(pool.display.map)pool.display.map.offset.x=0;else pool.display.color.setHex(0x24b9b8);
  pool.mirrorLevel=-100;updateImmersion();updateInteraction();dirty=true;
}
function advanceFlood(now){
  if(!pool)return;
  if(pool.state==='filling'){
    pool.fraction=Math.max(0,Math.min(1,(now-pool.started)/(floodSeconds*1000)));
    const volume=pool.total*pool.fraction;
    let i=pool.volumes.findIndex(v=>v>=volume);if(i<0)i=pool.volumes.length-1;
    const prior=pool.volumes[i-1]||0,[lo,hi]=pool.shape.layers[i];
    placePoolSurface(lo+(hi-lo)*(volume-prior)/(pool.volumes[i]-prior));
    if(pool.fraction===1)pool.state='full';
    dirty=true;
  }
  if(pool.surface.visible&&!isFlat&&!routeMapOpen&&camera.position.distanceTo(pool.surface.position)<49&&now-pool.lastRipple>80){
    pool.surface.material.uniforms.clock.value=now*.001;pool.lastRipple=now;dirty=true;
  }
  updateInteraction();
}
// Reflect the cells touching the room. The oblique near plane excludes
// submerged geometry so the reflection contains only the dry half-space.
function reflectPool(now){
  if(!pool?.surface.visible||camera.position.y<=pool.level+.05||camera.position.distanceTo(pool.surface.position)>49)return;
  const same=pool.mirrorEye.distanceToSquared(camera.position)<.05**2&&pool.mirrorRotation.angleTo(camera.quaternion)<.012&&
    Math.abs(pool.level-pool.mirrorLevel)<.07&&pool.mirrorCells===resident.size;
  if(same||now-pool.lastMirror<100)return;
  const mirror=pool.mirror,size=512,h=Math.max(128,Math.round(size/camera.aspect));
  if(!pool.target)pool.target=new THREE.WebGLRenderTarget(size,Math.min(640,h));
  else pool.target.setSize(size,Math.min(640,h));
  mirror.position.copy(camera.position);mirror.position.y=2*pool.level-camera.position.y;
  const dir=camera.getWorldDirection(new THREE.Vector3());dir.y*=-1;
  mirror.up.set(0,1,0).applyQuaternion(camera.quaternion);mirror.up.y*=-1;
  mirror.lookAt(dir.add(mirror.position));mirror.updateMatrixWorld();mirror.projectionMatrix.copy(camera.projectionMatrix);
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-pool.level).applyMatrix4(mirror.matrixWorldInverse);
  const clip=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant),m=mirror.projectionMatrix.elements;
  const q=new THREE.Vector4((Math.sign(clip.x)+m[8])/m[0],(Math.sign(clip.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
  clip.multiplyScalar(2/clip.dot(q));m[2]=clip.x;m[6]=clip.y;m[10]=clip.z+1.;m[14]=clip.w;
  mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
  const u=pool.surface.material.uniforms;u.reflectionMatrix.value.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
  const previous=gl.getRenderTarget();pool.surface.visible=false;
  try{gl.setRenderTarget(pool.target);gl.render(scene,mirror)}finally{gl.setRenderTarget(previous);pool.surface.visible=true}
  u.reflected.value=pool.target.texture;u.reflectionReady.value=1;pool.mirrorEye.copy(camera.position);
  pool.mirrorRotation.copy(camera.quaternion);pool.mirrorLevel=pool.level;pool.mirrorCells=resident.size;pool.lastMirror=now;
}
