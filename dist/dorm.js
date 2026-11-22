'use strict';
const dormSolids=[],balconyDoors=[],dormViews=new Map();
const bedroomPhoto={image:{value:null},ready:{value:0},eye:{value:new THREE.Vector3()},axes:{value:new THREE.Matrix3()},focal:{value:210}};
const dormOak={value:null};
const dormantDoorSource=new THREE.MeshBasicMaterial({visible:false});
let movingDoorRole;
const dormVertex='varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
function dormShader(body,uniforms={},transparent=false){
  return new THREE.ShaderMaterial({vertexShader:dormVertex,fragmentShader:'varying vec3 p;'+body,uniforms,
    side:THREE.DoubleSide,extensions:{derivatives:true},transparent,depthWrite:!transparent,forceSinglePass:true});
}
function dormWindow(w){
  const wideX=w.max[0]-w.min[0]>w.max[2]-w.min[2];
  const horizontal=wideX?0:2;
  return dormShader(`
    uniform vec2 origin,span;uniform vec3 axis;uniform float wired;
    void main(){
      vec2 q=vec2(dot(p,axis),p.y)-origin;
      vec2 edges=min(q,span-q);
      float rim=min(edges.x,edges.y);
      float frame=1.-smoothstep(.025,.047,rim);
      // Wire-reinforced glass in the balcony photo. The lattice is measured in
      // metres and attenuated once a cell becomes smaller than a display pixel.
      vec2 grid=q/.072,period=vec2(1.73205,3.);
      vec2 a=mod(grid,period)-.5*period,b=mod(grid+.5*period,period)-.5*period;
      vec2 v=abs(dot(a,a)<dot(b,b)?a:b);
      float edge=.866025-max(v.x,dot(v,vec2(.5,.866025)));
      float aa=max(.004,fwidth(edge));
      float wire=wired*(1.-smoothstep(.78,1.65,length(fwidth(grid))))*
        (smoothstep(-aa,aa,edge+.024)-smoothstep(-aa,aa,edge-.024));
      vec3 n=normalize(cross(dFdx(p),dFdy(p))),eye=normalize(cameraPosition-p);
      float fresnel=pow(1.-abs(dot(n,eye)),3.);
      vec3 color=mix(vec3(.36,.42,.43),vec3(.57,.66,.69),fresnel);
      color=mix(color,vec3(.21,.22,.22),wire*.85);color=mix(color,vec3(.14,.15,.155),frame);
      gl_FragColor=vec4(color,max(frame,.12+.27*fresnel+.32*wire));
    }`,{origin:{value:new THREE.Vector2(w.min[horizontal],w.min[1])},span:{value:new THREE.Vector2(w.max[horizontal]-w.min[horizontal],w.max[1]-w.min[1])},
      axis:{value:new THREE.Vector3(wideX?1:0,0,wideX?0:1)},wired:{value:w.hull===866?1:0}},true);
}
const dormPhotoGLSL=`
  uniform sampler2D photo;uniform float ready,focal;uniform vec3 refEye;uniform mat3 axes;
  vec3 fromRoomPhoto(vec3 base,vec3 local,vec3 viewer,float kind){
    if(ready<.5)return base;
    vec3 sight=local-refEye,ray=axes*sight;
    if(ray.z<=0.)return base;
    vec2 uv=vec2(.5)+ray.xy/ray.z*focal/vec2(602.,307.);
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return base;
    vec4 paint=texture2D(photo,uv);
    float encoded=floor(paint.a*255.+.5);
    float tag=(abs(floor(encoded/32.)-kind)<.5)?smoothstep(0.,30.,mod(encoded,32.)):0.;
    float angle=smoothstep(.42,.91,dot(normalize(sight),normalize(local-viewer)));
    return mix(base,paint.rgb,.94*tag*angle);
  }`;
function roomPhotoUniforms(){
  return {photo:bedroomPhoto.image,ready:bedroomPhoto.ready,refEye:bedroomPhoto.eye,axes:bedroomPhoto.axes,focal:bedroomPhoto.focal};
}
function makeDormMaterials(data,base){
  const curtains=dormShader(`void main(){
    vec3 n=normalize(cross(dFdx(p),dFdy(p)));float u=abs(n.x)>abs(n.z)?p.z:p.x;
    float fold=.48+.23*sin(u*16.+.24*sin(p.y*.64))+.15*cos(u*25.1+p.y*.14);
    float weave=.016*sin(p.y*244.)*(1.-smoothstep(.24,1.5,fwidth(p.y*80.)));
    gl_FragColor=vec4(vec3(.150,.142,.145)+vec3(.12,.115,.112)*(fold+.60*abs(n.y))+weave,1.);
  }`);
  const rooms=data.rooms.map(r=>dormShader(`
    uniform sampler2D finish,oak;uniform float scanned,oakReady;uniform vec3 corner;uniform vec2 right;
    void main(){
      vec3 rel=p-corner;vec3 q=vec3(dot(rel.xz,right),rel.y,dot(rel.xz,vec2(-right.y,right.x)));
      vec3 n=normalize(cross(dFdx(p),dFdy(p)));
      bool horizontal=abs(n.y)>.64;
      vec3 c;
      if(horizontal&&q.y<.16){
        vec2 plank=q.xz/vec2(1.72,1.42);
        vec2 uv=(vec2(2.,1.)+(8.+496.*fract(plank))/512.)/vec2(4.,2.);
        float l=dot(texture2D(finish,uv).rgb,vec3(.29,.55,.16));
        float floorLight=.85+.19*(1.-smoothstep(0.,4.5,q.z));
        c=vec3(.56,.377,.247)*mix(1.,clamp(.58+1.2*l,.65,1.42),scanned)*floorLight;
        vec2 scale=q.xz/vec2(.28,.50);
        if(oakReady>.5){
          vec3 wood=texture2D(oak,scale+vec2(mod(floor(q.x*3.57),3.)*.28,0.)).rgb;
          c=mix(c,wood*(.74+.58*l)*floorLight,.68);
        }
      }else if(horizontal&&q.y>3.25){
        float edge=min(min(abs(q.x),abs(q.x+7.74)),min(abs(q.z),abs(q.z-8.65)));
        c=vec3(.368,.315,.277)+vec3(.63,.40,.17)*exp(-8.*edge);
        float lamp=length(vec2(mod(q.x+1.45,3.05)-1.525,mod(q.z+1.1,3.45)-1.725));
        c=mix(c,vec3(.97,.92,.83),1.-smoothstep(.047,.083,lamp));
      }else{
        c=vec3(.40,.355,.316)*(.83+.16*clamp(q.y/3.7,0.,1.));
        if(q.y<.085)c=vec3(.162,.139,.123);
        if(q.y>3.45)c+=vec3(.27,.19,.092)*exp(-15.*abs(q.y-3.69));
      }
      gl_FragColor=vec4(c,1.);
    }`,{oak:dormOak,oakReady:bedroomPhoto.ready,finish:base.uniforms.finishColor,scanned:base.uniforms.finishReady,corner:{value:new THREE.Vector3(...r.origin)},right:{value:new THREE.Vector2(...r.right)}}));
  const rail=dormShader(`void main(){
    vec3 n=normalize(cross(dFdx(p),dFdy(p)));
    gl_FragColor=vec4(vec3(.25,.255,.25)+.18*abs(n.y),1.);
  }`);
  return [...data.windows.map(dormWindow),curtains,...rooms,rail,dormantDoorSource];
}
function dormRoomFrame(room){
  const [x,z]=room.right,m=new THREE.Matrix4().makeBasis(new THREE.Vector3(x,0,z),new THREE.Vector3(0,1,0),new THREE.Vector3(-z,0,x));
  return m.setPosition(...room.origin);
}
function addDormSolid(mesh){
  mesh.updateMatrixWorld(true);mesh.geometry.computeBoundingBox();
  const solid={mesh,bounds:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)};
  dormSolids.push(solid);scene.add(mesh);return solid;
}
function installBalconyDoor(door,room){
  const pos=[],idx=[],types=[];
  door.segments.forEach((s,j)=>{
    const offset=pos.length/3;pos.push(...s.vertices);idx.push(...s.indices.map(i=>i+offset));
    types.push(...Array(s.vertices.length/3).fill(j?1:0));
  });
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('handle',new THREE.Float32BufferAttribute(types,1));geo.setIndex(idx);
  const axis=new THREE.Vector2(...room.right),s=door.segments[0],k=Math.abs(axis.x)>.5?0:2;
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,forceSinglePass:true,
    vertexShader:'attribute float handle;varying float h;varying vec3 p;void main(){h=handle;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    uniforms:{limits:{value:new THREE.Vector4(s.min[k],s.max[k],s.min[1],s.max[1])},axis:{value:axis}},
    fragmentShader:`varying float h;varying vec3 p;uniform vec4 limits;uniform vec2 axis;
      void main(){float a=dot(p.xz,axis);
        float edge=min(min(a-limits.x,limits.y-a),min(p.y-limits.z,limits.w-p.y));
        float trim=1.-smoothstep(.056,.069,edge);
        gl_FragColor=h>.5?vec4(.32,.32,.31,1.):mix(vec4(.29,.335,.34,.21),vec4(.155,.156,.15,1.),trim);
      }`});
  const solid=addDormSolid(new THREE.Mesh(geo,mat));
  // Keep the pull handles in the opening when the leaf slides behind the jamb.
  const handle=door.segments[1];
  const distance=door.slide>0?s.max[k]-handle.max[k]-.08:s.min[k]-handle.min[k]+.08;
  balconyDoors.push({...solid,id:door.id,open:false,closed:solid.bounds.clone(),
    travel:new THREE.Vector3(axis.x*distance-axis.y*.10,0,axis.y*distance+axis.x*.10)});
}
function targetedDormDoor(){
  if(!camera||view!=='walk'||routeMapOpen||isFlat||awaitingLanding||$('dialog').open||$('room-dialog').open)return null;
  const reachable=balconyDoors.find(d=>d.bounds.distanceToPoint(camera.position)<2.8);
  if(!reachable)return null;
  const aimed=hit(camera.position,camera.getWorldDirection(new THREE.Vector3()),2.82);
  return balconyDoors.find(d=>d.mesh===aimed?.object)||null;
}
function toggleDormDoor(d){
  const destination=d.closed.clone();if(!d.open)destination.translate(d.travel);
  const occupied=destination.clone().union(d.bounds).expandByScalar(.225);
  const eye=camera.position,feet=eye.y-eyeHeight();
  if(eye.x>occupied.min.x&&eye.x<occupied.max.x&&eye.z>occupied.min.z&&eye.z<occupied.max.z&&feet<occupied.max.y&&eye.y>occupied.min.y){
    note('退开一步再移动阳台门');return;
  }
  d.open=!d.open;d.mesh.position.copy(d.open?d.travel:new THREE.Vector3());
  d.mesh.updateMatrixWorld(true);d.bounds.copy(destination);dirty=true;updateInteraction();
}
function installDorm(data,source){
  bedroomPhoto.eye.value.fromArray(source.eye);bedroomPhoto.axes.value.set(...source.rotation.flat());bedroomPhoto.focal.value=source.focal;
  const furnishings=bedroomFurnishings(),paint=bedroomFurnishingsMaterial();
  for(const room of data.rooms){
    const frame=dormRoomFrame(room),mesh=new THREE.Mesh(furnishings,paint);
    mesh.applyMatrix4(frame);addDormSolid(mesh);
    const eye=new THREE.Vector3(...source.eye).applyMatrix4(frame);
    const rotation=source.rotation.map(axis=>new THREE.Vector3(...axis).transformDirection(frame).toArray());
    dormViews.set(room.id,{...source,eye:eye.toArray(),rotation});
  }
  for(const d of data.doors)installBalconyDoor(d,data.rooms.find(r=>r.id===d.room));
}
async function loadBedroomPhoto(){
  const loader=new THREE.TextureLoader(),[photo,oak]=await Promise.all(['dorm-furniture.webp','dorm-oak.webp'].map(name=>loader.loadAsync('data/'+name)));
  oak.wrapS=oak.wrapT=THREE.MirroredRepeatWrapping;oak.flipY=false;oak.needsUpdate=true;dormOak.value=oak;
  photo.flipY=false;photo.generateMipmaps=false;photo.minFilter=THREE.LinearFilter;
  photo.needsUpdate=true;bedroomPhoto.image.value=photo;bedroomPhoto.ready.value=1;dirty=true;
}
