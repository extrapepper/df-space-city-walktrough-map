'use strict';
let extractionSites=[];
const leverModels=new Map(),pulledLevers=new Set();
let practice='black';
function enabledSite(site){
  return !site.scenario||site.scenario===practice||(site.scenario==='s11'&&practice!=='legacy');
}
function installExtraction(sites,housing){
  extractionSites=sites.map(site=>({...site,x:site.panel?.[0]??(site.mapX-668650)/100,z:site.panel?.[2]??(site.mapY+452830)/100}));
  const skin=new THREE.TextureLoader().load('data/switch-finish.webp',()=>{dirty=true});
  skin.colorSpace=THREE.SRGBColorSpace;skin.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());
  const finish=new THREE.MeshBasicMaterial({map:skin,toneMapped:false});
  function face(parent,corners,rect){
    const [x,y,w,h]=rect,l=(x+.5)/1024,r=(x+w-.5)/1024,t=1-(y+.5)/512,b=1-(y+h-.5)/512;
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(corners.flat(),3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([l,t,l,b,r,b,r,t],2));geo.setIndex([0,1,2,0,2,3]);
    parent.add(new THREE.Mesh(geo,finish));
  }
  function box(parent,w,h,d,x,y,z,mat){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  const panels={1410:[265,250,180,108],1411:[455,250,150,108],1412:[615,250,110,108],
    1413:[735,250,98,120],1414:[844,250,125,118],1415:[265,388,146,46]};
  const parts=housing.map(({vertices,indices,hull})=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);geometry.computeBoundingBox();
    const bounds=geometry.boundingBox,material=new THREE.ShaderMaterial({
      side:THREE.DoubleSide,transparent:hull===1419,depthWrite:hull!==1419,extensions:{derivatives:true},
      uniforms:{skin:{value:skin},rect:{value:new THREE.Vector4(...(panels[hull]||[0,0,0,0]))},
        low:{value:bounds.min},span:{value:bounds.getSize(new THREE.Vector3())},hull:{value:hull}},
      vertexShader:'varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 point;uniform sampler2D skin;uniform vec4 rect;uniform vec3 low,span;uniform float hull;
      void main(){
        vec3 n=normalize(cross(dFdx(point),dFdy(point))),q=clamp((point-low)/max(span,vec3(.001)),0.,1.);
        float light=.77+.23*abs(dot(n,normalize(vec3(-.42,.72,.55))));
        vec3 color=vec3(.13,.16,.165);float opacity=1.;
        if(rect.z>0.&&abs(n.z)>.55){
          vec2 pixel=rect.xy+.5+vec2(q.x,1.-q.y)*(rect.zw-1.);
          color=texture2D(skin,vec2(pixel.x/1024.,1.-pixel.y/512.)).rgb;
          color=mix(12.92*color,1.055*pow(color,vec3(1./2.4))-.055,step(vec3(.0031308),color));
        }else if(hull==1419.){
          float rim=min(min(q.x,1.-q.x),min(q.y,1.-q.y));
          float glass=smoothstep(.045,.075,rim);
          color=mix(vec3(.16,.19,.19),vec3(.21,.31,.33),glass);opacity=mix(1.,.30,glass);
        }else if(hull==1418.){
          color=mix(vec3(.095,.12,.13),vec3(.22,.34,.37),smoothstep(.84,.91,q.y));
        }else if(hull==1409.)color=vec3(.072,.079,.084);
        else if(hull==1416.||hull==1417.)color=vec3(.29,.32,.33);
        gl_FragColor=vec4(color*light,opacity);
      }`
    });
    return {geometry,material,hull};
  });
  for(const site of extractionSites.filter(s=>s.panel)){
    const model=new THREE.Group();model.position.fromArray(site.panel);model.rotation.y=Math.atan2(...site.normal);scene.add(model);
    if(!site.instance)model.scale.setScalar(.72);
    const rotor=new THREE.Group();rotor.position.set(-.060,.153,.169);model.add(rotor);
    for(const part of parts){
      const mesh=new THREE.Mesh(part.geometry,part.material);
      if(part.hull===1418){mesh.position.copy(rotor.position).negate();rotor.add(mesh)}else model.add(mesh);
    }
    const lamp=new THREE.MeshBasicMaterial({color:0xa4f5af});
    box(model,.108,.033,.009,.124,.375,.205,lamp);
    model.updateMatrixWorld();
    leverModels.set(site.id,{site,model,lamp,rotor,front:new THREE.Vector3(0,0,.36).applyMatrix4(model.matrixWorld)});
  }
  // H1 rack and two inclined screens use the existing game mesh dimensions.
  face(scene,[[-69.12,-24.92,38.047],[-69.12,-27.81,38.047],[-73.47,-27.81,38.047],[-73.47,-24.92,38.047]],[264,4,360,236]);
  for(const [left,right,panel] of [[-65.072,-68.545,[635,4,182,89]],[-61.17,-64.64,[830,4,180,89]]]){
    face(scene,[[left,-24.387,38.470],[left,-26.002,38.897],[right,-26.002,38.897],[right,-24.387,38.470]],panel);
  }
  setPractice(practice);
}
function setPractice(value){
  if(value!==practice)pulledLevers.clear();
  practice=value;$('map-practice').value=value;
  for(const [id,{site,model,lamp,rotor}] of leverModels){
    const on=enabledSite(site);model.visible=Boolean(site.instance)||on;
    lamp.color.setHex(!on?0x35423c:pulledLevers.has(id)?0x55d993:0xa4f5af);
    rotor.rotation.z=pulledLevers.has(id)?Math.PI:0;
  }
  if(selectedSite&&!enabledSite(selectedSite))selectedSite=null;
  dirty=true;if(routeMapOpen)paintRouteMap();
}
function selectPracticeForLanding(label){
  const site=extractionSites.find(s=>s.landing?.label===label);
  if(site&&!enabledSite(site))setPractice(site.scenario==='s11'?'black':site.scenario);
}
function targetedLever(){
  if(view!=='walk'||routeMapOpen||isFlat||awaitingLanding||climbing||$('dialog').open||$('room-dialog').open)return null;
  for(const [id,{site,front}] of leverModels){
    if(!enabledSite(site))continue;
    if(camera.position.distanceToSquared(front)>2.65**2)continue;
    const toward=front.clone().sub(camera.position),distance=toward.length();
    if(distance<.08||toward.multiplyScalar(1/distance).dot(camera.getWorldDirection(new THREE.Vector3()))<.88)continue;
    if(!hit(camera.position,toward,Math.max(0,distance-.09)))return id;
  }
  return null;
}
function toggleLever(id){
  const {rotor,lamp}=leverModels.get(id),active=!pulledLevers.has(id);
  if(active)pulledLevers.add(id);else pulledLevers.delete(id);
  rotor.rotation.z=active?Math.PI:0;lamp.color.setHex(active?0x55d993:0xa4f5af);
  note(pulledLevers.size>=2?'拉闸练习已完成，按 M 查看直升机撤离点':'拉闸练习　'+pulledLevers.size+' / 2');
  dirty=true;updateInteraction();
}
