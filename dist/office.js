'use strict';
let officeBounds;
const officeSolids=[];
async function installOffice(){
  const [study,land]=await Promise.all([jsonFile('office-study.json'),new THREE.TextureLoader().loadAsync('data/office-globe.webp')]);
  land.colorSpace=THREE.SRGBColorSpace;
  const group=new THREE.Group(),[x,y,z]=study.globe.center,r=study.globe.radius;
  const bronze=new THREE.MeshPhongMaterial({color:0xa57c47,specular:0xffe6ba,shininess:80});
  const brass=new THREE.MeshPhongMaterial({color:0xd5ac63,specular:0xfff6c8,shininess:95});
  const wood=new THREE.MeshPhongMaterial({color:0x563326,specular:0x563d2b,shininess:24});
  const stone=new THREE.MeshPhongMaterial({color:0x343b3b,specular:0x9a9d8c,shininess:64});
  const add=(geo,mat,cx,cy,cz,solid=false)=>{
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(cx,cy,cz);group.add(mesh);
    if(solid)officeSolids.push(mesh);
    return mesh;
  };
  const tabletop=-7.28,tx=.49,tz=7.65;
  add(new THREE.BoxGeometry(2.48,.79,7.42),wood,tx,tabletop-.43,tz,true);
  add(new THREE.BoxGeometry(2.56,.043,7.48),brass,tx,tabletop-.065,tz);
  add(new THREE.BoxGeometry(2.55,.085,7.47),stone,tx,tabletop-.018,tz,true);
  add(new THREE.CylinderGeometry(.68,.83,.11,64),bronze,x,tabletop+.10,z,true);
  add(new THREE.CylinderGeometry(.48,.65,.07,64),brass,x,tabletop+.19,z);
  add(new THREE.CylinderGeometry(.18,.32,.17,40),stone,x,tabletop+.28,z);
  const ring=(radius,tube,rx,ry,rz,mat)=>{
    const mesh=add(new THREE.TorusGeometry(radius,tube,10,96),mat,x,y,z);
    mesh.rotation.set(rx,ry,rz);
  };
  ring(r*1.33,.043,.18,.45,-.07,brass);
  ring(r*1.24,.051,.66,-.75,.16,bronze);
  ring(r*1.16,.040,-.87,.35,.14,brass);
  ring(r*1.10,.033,.13,1.07,-.40,bronze);
  const earth=add(new THREE.SphereGeometry(r,64,40),new THREE.MeshBasicMaterial({
    map:land,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true
  }),x,y,z,true);earth.rotation.y=-1.9;
  const glow=add(new THREE.SphereGeometry(r*1.009,48,32),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec3 d; varying vec3 n; void main(){vec4 p=modelViewMatrix*vec4(position,1.);d=-p.xyz;n=normalMatrix*normal;gl_Position=projectionMatrix*p;}',
    fragmentShader:'varying vec3 d; varying vec3 n; void main(){float rim=pow(1.-max(0.,dot(normalize(d),normalize(n))),3.);gl_FragColor=vec4(.48,.91,1.,.06+.52*rim);}'
  }),x,y,z);glow.renderOrder=2;
  const glass=add(new THREE.PlaneGeometry(20.1,5.09),new THREE.MeshBasicMaterial({
    color:0xb5ddec,transparent:true,opacity:.085,depthWrite:false,side:THREE.DoubleSide
  }),1.11,-5.13,19.024);glass.renderOrder=1;
  const hemi=new THREE.HemisphereLight(0xe7f7ff,0x796349,1.65);
  const sun=new THREE.DirectionalLight(0xffe4b8,2.25);sun.position.set(8,14,11);
  scene.add(hemi,sun,group);group.updateMatrixWorld(true);
  officeBounds=new THREE.Box3().setFromObject(group);
  surveyViews.set('ceo',study.views[0]);dirty=true;
}
