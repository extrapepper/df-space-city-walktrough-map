'use strict';
let harbor, swimming=false;
const waterUp=new THREE.Vector3(0,1,0);
const underwaterColor=new THREE.Color(.075,.205,.205);
function installHarbor(buffer){
  const header=new DataView(buffer);
  const size=header.getUint32(0,true),origin=header.getFloat32(4,true),spacing=header.getFloat32(8,true),level=header.getFloat32(12,true);
  const pixels=new Uint8Array(buffer,16);
  if(pixels.length!==size*size||spacing<=0)throw Error('水域数据尺寸无效');
  harbor={size,origin,spacing,level,pixels};
  const map=new THREE.DataTexture(pixels,size,size,gl.capabilities.isWebGL2?THREE.RedFormat:THREE.LuminanceFormat);
  map.needsUpdate=true;
  const waterMaterial=new THREE.ShaderMaterial({
    side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{footprint:{value:map}},
    vertexShader:`varying vec2 pixel;varying vec3 world;
      void main(){pixel=vec2(uv.x,1.-uv.y);world=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`uniform sampler2D footprint;varying vec2 pixel;varying vec3 world;
      void main(){if(texture2D(footprint,pixel).r<.5)discard;
      vec2 p=world.xz;float ripple=sin(p.y*1.3+sin(p.x*.7))*sin(p.x*.15+p.y*.4);
      float glancing=pow(1.-abs(normalize(cameraPosition-world).y),3.);
      vec3 color=mix(vec3(.095,.22,.22),vec3(.34,.44,.44),glancing*.62)+ripple*.012;
      gl_FragColor=gl_FrontFacing?vec4(color,.91):vec4(.30,.50,.48,.48);}`
  });
  const width=size*spacing,center=origin+width/2;
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,width),waterMaterial);
  surface.rotation.x=-Math.PI/2;surface.position.set(center,level,center);scene.add(surface);
}
function overHarbor(x,z){
  if(!harbor)return false;
  const col=Math.floor((x-harbor.origin)/harbor.spacing),row=Math.floor((z-harbor.origin)/harbor.spacing);
  return col>=0&&row>=0&&col<harbor.size&&row<harbor.size&&harbor.pixels[row*harbor.size+col]!==0;
}
function updateImmersion(){
  const eye=camera.position,wet=overHarbor(eye.x,eye.z);
  const immersed=wet&&eye.y<harbor.level-.08;
  const afloat=view==='walk'&&wet&&eye.y<harbor.level+.42;
  material.uniforms.submerged.value=Number(immersed);
  scene.background=immersed?underwaterColor:null;
  if(swimming!==afloat){swimming=afloat;syncMode()}
}
function swimStep(dx,dz,vertical,dt){
  const eye=camera.position;
  slideHorizontal(dx,dz,eye.y,[-.64,-.1]);
  const delta=vertical*3.2*dt,clearance=.25;
  const obstacle=delta?hit(eye,delta>0?waterUp:down,Math.abs(delta)+clearance):null;
  eye.y+=Math.sign(delta)*Math.min(Math.abs(delta),obstacle?Math.max(0,obstacle.distance-clearance):Infinity);
  eye.y=Math.min(eye.y,harbor.level+.28);
  const floor=hit(new THREE.Vector3(eye.x,eye.y+.35,eye.z),down,1.6);
  if(floor){
    const shallow=floor.point.y>harbor.level-1.2;
    eye.y=Math.max(eye.y,floor.point.y+(shallow?1.7:.72));
  }
  groundVelocity=0;
}
