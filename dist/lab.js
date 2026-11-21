'use strict';
// The room photograph and the reusable cylinder skins share the same two measured
// camera registrations. Depth is stored in alpha. A zero texel carries no finish.
const labUniforms={
  labPhoto:{value:null},labEye:{value:[]},labAxes:{value:[]},labRect:{value:[]},
  labFocal:{value:[]},labPrincipal:{value:[]},labDepth:{value:[]},
  labReady:{value:0},cabinSkin:{value:null},skinReady:{value:0},
  submerged:{value:0},immersionTint:{value:new THREE.Color(.075,.205,.205)},immersionLevel:{value:-100}
};
for(let i=0;i<2;i++){
  labUniforms.labEye.value.push(new THREE.Vector3());labUniforms.labAxes.value.push(new THREE.Matrix3());
  labUniforms.labRect.value.push(new THREE.Vector4());
  for(const u of ['labFocal','labPrincipal','labDepth'])labUniforms[u].value.push(new THREE.Vector2());
}
const labProjection=`
uniform sampler2D labPhoto;
uniform vec3 labEye[2];
uniform mat3 labAxes[2];
uniform vec4 labRect[2];
uniform vec2 labFocal[2],labPrincipal[2],labDepth[2];
uniform float labReady;
vec3 labFinish(vec3 color,vec3 point,vec3 normal){
  if(labReady<.5||point.x< -78.||point.x> -26.||point.z< -64.||point.z> -17.||point.y< -88.||point.y> -11.)return color;
  for(int i=0;i<2;i++){
    vec3 view=labAxes[i]*(point-labEye[i]);
    if(view.z<1.)continue;
    vec2 uv=view.xy/view.z*labFocal[i]+labPrincipal[i];
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
    vec4 sampleLab=texture2D(labPhoto,labRect[i].xy+uv*labRect[i].zw);
    float depth=labDepth[i].x+(sampleLab.a*255.-2.)*labDepth[i].y;
    float seen=step(.005,sampleLab.a)*(1.-smoothstep(.09,.25,abs(view.z-depth)));
    float blue=floor(sampleLab.b*255.+.5),confidence=mod(blue,8.)/7.;
    sampleLab.b=(blue-mod(blue,8.)+3.5)/255.;
    float facing=smoothstep(.08,.39,dot(normal,normalize(labEye[i]-point)));
    color=mix(color,sampleLab.rgb,seen*confidence*facing);
  }
  return color;
}`;
function makeCabinMaterial(frame){
  return new THREE.ShaderMaterial({
    side:THREE.DoubleSide,extensions:{derivatives:true},
    uniforms:{...labUniforms,center:{value:new THREE.Vector3(...frame.center)},
      basis:{value:new THREE.Matrix3().set(...frame.basis.flat())},
      halfLength:{value:frame.halfLength},kind:{value:frame.kind}},
    vertexShader:`uniform vec3 center;uniform mat3 basis;
      varying vec3 localPoint,site;
      void main(){site=position;localPoint=basis*(position-center);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 localPoint,site;
      uniform float kind,halfLength,skinReady,submerged,immersionLevel;uniform vec3 immersionTint;uniform sampler2D cabinSkin;
      ${labProjection}
      void main(){
        vec3 p=localPoint,n=normalize(cross(dFdx(p),dFdy(p)));
        float radius=length(p.yz),lengthUV=clamp(.5+.5*p.x/halfLength,0.,1.);
        float angle=fract(atan(p.z,p.y)/6.2831853+.5);
        vec3 siteNormal=normalize(cross(dFdx(site),dFdy(site)));
        float light=.76+.24*abs(dot(siteNormal,normalize(vec3(.48,.82,.31))));
        vec3 color=mix(vec3(.15,.18,.19),vec3(.43,.47,.47),smoothstep(1.62,2.20,radius))*light;
        bool end=abs(n.x)>.69 && abs(p.x)>halfLength-.76;
        if(skinReady>.5 && (end||radius>1.79)){
          vec2 texel=end?vec2(256.*(kind*2.+step(0.,p.x)),512.)+2.+252.*(p.zy/4.62+.5)
                        :vec2(1.+1021.*lengthUV,256.*kind+1.+253.*angle);
          vec4 coating=texture2D(cabinSkin,texel/vec2(1024.,768.));
          color=mix(color,coating.rgb,coating.a);
        }
        float wetPath=distance(cameraPosition,site)*clamp((immersionLevel-cameraPosition.y)/max(.001,site.y-cameraPosition.y),0.,1.);
        gl_FragColor=vec4(mix(labFinish(color,site,siteNormal),immersionTint,submerged*(1.-exp(-.046*wetPath))),1.);
      }`
  });
}
async function loadLabFinish(){
  const loader=new THREE.TextureLoader();
  const room=async()=>{
    const [pose,photo]=await Promise.all([jsonFile('buoyancy-study.json'),loader.loadAsync('data/buoyancy-finish.webp')]);
    photo.flipY=false;photo.generateMipmaps=false;photo.minFilter=photo.magFilter=THREE.NearestFilter;photo.needsUpdate=true;
    labUniforms.labPhoto.value=photo;
    [pose.dry,pose].forEach((p,i)=>{
      labUniforms.labEye.value[i].fromArray(p.eye);labUniforms.labAxes.value[i].set(...p.rotation.flat());
      labUniforms.labFocal.value[i].fromArray(p.photoFocal);labUniforms.labPrincipal.value[i].fromArray(p.principal);
      labUniforms.labDepth.value[i].fromArray(p.depth);labUniforms.labRect.value[i].fromArray(p.rect);
    });
    labUniforms.labReady.value=1;
    surveyViews.set('buoyancy',pose);dirty=true;
  };
  const skins=async()=>{
    const tex=await loader.loadAsync('data/lab-coatings.webp');
    tex.flipY=false;tex.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());tex.needsUpdate=true;
    labUniforms.cabinSkin.value=tex;labUniforms.skinReady.value=1;dirty=true;
  };
  await Promise.all([room(),skins()]);
}
