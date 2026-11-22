'use strict';
let architecturalMaterials;
function makeArchitecturalMaterials(base,cabins,cabinets,study){
  const vertexShader=`varying vec3 sitePosition;
    void main(){sitePosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const shader=(fragmentShader,transparent=false)=>new THREE.ShaderMaterial({
    vertexShader,fragmentShader,transparent,depthWrite:!transparent,side:THREE.DoubleSide,
    forceSinglePass:true,extensions:{derivatives:true}
  });
  const glass=shader(`varying vec3 sitePosition;
    void main(){
      vec3 n=normalize(cross(dFdx(sitePosition),dFdy(sitePosition)));
      vec3 eye=normalize(cameraPosition-sitePosition);
      vec3 reflected=reflect(-eye,n);
      float rim=pow(1.-abs(dot(n,eye)),2.8);
      float sky=smoothstep(-.1,.65,reflected.y);
      bool control=sitePosition.z< -195.&&abs(sitePosition.x)<58.;
      vec3 tint=control?vec3(.19,.25,.27):vec3(.27,.30,.30);
      vec3 sheen=mix(tint,vec3(.64,.74,.77),sky*.54+rim*.19);
      gl_FragColor=vec4(sheen,.20+.45*rim);
    }`,true);
  const collider=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,visible:false});
  const steel=shader(`varying vec3 sitePosition;
    uniform sampler2D metalPhoto;
    uniform vec3 photoEye;
    uniform mat3 photoAxes;
    uniform vec2 focal, principal, depthScale;
    uniform float photoReady;
    void main(){
      vec3 n=normalize(cross(dFdx(sitePosition),dFdy(sitePosition)));
      vec3 reflection=reflect(-normalize(cameraPosition-sitePosition),n);
      float ceiling=smoothstep(-.33,.6,reflection.y);
      float window=smoothstep(.26,.72,reflection.z)*(1.-smoothstep(.15,.9,abs(reflection.y)));
      float brush=sin(sitePosition.y*520.)*(1.-smoothstep(.05,.6,fwidth(sitePosition.y*80.)));
      vec3 steel=mix(vec3(.17,.18,.17),vec3(.46,.44,.38),ceiling);
      steel+=vec3(.27,.32,.33)*window+brush*.012;
      vec3 ray=sitePosition-photoEye;
      vec3 local=photoAxes*ray;
      if(photoReady>.5 && local.z>0.){
        vec2 uv=local.xy/local.z*focal+principal;
        if(all(greaterThanEqual(uv,vec2(0.))) && all(lessThanEqual(uv,vec2(1.)))){
          vec4 sampleMetal=texture2D(metalPhoto,uv);
          float depth=(sampleMetal.a*255.-2.)*depthScale.y+depthScale.x;
          float seen=step(.005,sampleMetal.a)*(1.-smoothstep(.015,.055,abs(depth-local.z)));
          float angle=smoothstep(.12,.55,dot(normalize(ray),normalize(sitePosition-cameraPosition)));
          steel=mix(steel,sampleMetal.rgb,seen*angle*.92);
        }
      }
      gl_FragColor=vec4(steel,1.);
    }`);
  steel.uniforms={metalPhoto:{value:null},photoEye:{value:new THREE.Vector3()},photoAxes:{value:new THREE.Matrix3()},
    focal:{value:new THREE.Vector2()},principal:{value:new THREE.Vector2()},depthScale:{value:new THREE.Vector2()},photoReady:{value:0}};
  const rung=shader(`varying vec3 sitePosition;uniform float submerged,immersionLevel,finishReady;
    uniform vec3 immersionTint;uniform sampler2D finishColor;
    void main(){
      vec3 n=normalize(cross(dFdx(sitePosition),dFdy(sitePosition)));
      float lit=clamp(.36+.70*dot(n,normalize(vec3(-.43,.82,.38))),0.,1.);
      vec3 paint=mix(vec3(.31,.23,.066),vec3(.65,.51,.18),lit);
      paint=mix(paint,vec3(.78,.68,.42),.70*max(n.y,0.));
      if(sitePosition.z>70.)paint=mix(vec3(.18,.16,.12),vec3(.42,.37,.26),lit);
      if(finishReady>.5){
        vec2 plane=abs(n.y)>.65?sitePosition.xz:vec2(abs(n.x)>abs(n.z)?sitePosition.z:sitePosition.x,sitePosition.y);
        vec2 uv=(vec2(3.,0.)+(8.+496.*fract(plane/.85))/512.)/vec2(4.,2.);
        float metal=dot(texture2D(finishColor,uv).rgb,vec3(.29,.55,.16));
        paint*=clamp(.88+.48*metal,.88,1.20);
      }
      float wetPath=distance(cameraPosition,sitePosition)*clamp((immersionLevel-cameraPosition.y)/max(.001,sitePosition.y-cameraPosition.y),0.,1.);
      float haze=submerged*(1.-exp(-.046*wetPath));
      gl_FragColor=vec4(mix(paint,immersionTint,haze),1.);
    }`);
  rung.uniforms={submerged:labUniforms.submerged,immersionTint:labUniforms.immersionTint,
    immersionLevel:labUniforms.immersionLevel,finishReady:base.uniforms.finishReady,finishColor:base.uniforms.finishColor};
  return [base,glass,collider,steel,...cabins.map(makeCabinMaterial),rung,...cabinets.map(makeVendingMaterial),
    ...study.surfaces.map((_,i)=>makeTrainingMaterial(i))];
}
async function registerSteelPhoto(p){
  const photo=await new THREE.TextureLoader().loadAsync('data/sculpture-finish.webp');
  photo.flipY=false;photo.generateMipmaps=false;photo.minFilter=photo.magFilter=THREE.NearestFilter;photo.needsUpdate=true;
  const u=architecturalMaterials[3].uniforms;
  u.metalPhoto.value=photo;u.photoEye.value.fromArray(p.eye);u.photoAxes.value.set(...p.rotation.flat());
  u.focal.value.fromArray(p.focal);u.principal.value.fromArray(p.center);u.depthScale.value.fromArray(p.depth);
  u.photoReady.value=1;dirty=true;
}
// Collect contiguous draw groups while retaining every survey triangle for BVH queries.
function applySurfaceRuns(geo,index,runs){
  const sizes=new Array(architecturalMaterials.length).fill(0);
  sizes[0]=index.length;
  for(const [,count,role] of runs){sizes[role]+=count*3;sizes[0]-=count*3}
  const result=new index.constructor(index.length),cursor=[];
  let start=0;
  sizes.forEach((count,role)=>{
    cursor[role]=start;
    if(count)geo.addGroup(start,count,role);
    start+=count;
  });
  function copy(first,end,role){
    result.set(index.subarray(first,end),cursor[role]);cursor[role]+=end-first;
  }
  let previous=0;
  for(const [face,count,role] of runs){
    copy(previous,face*3,0);previous=(face+count)*3;copy(face*3,previous,role);
  }
  copy(previous,index.length,0);
  return result;
}
// World-space texture coordinates keep the same material scale across all streamed cells.
const architecturalSurfaces=`
uniform sampler2D finishColor;
uniform sampler2D finishNormal;
uniform sampler2D seatPhoto;
uniform float finishReady;
// The glass and its duplicate physical barrier occupy four faces between z=19.026 and 19.113.
// Leave their original geometry available to the collision raycaster.
bool officeGlazing(){
  if(world.z<19.018||world.z>19.121||world.x< -8.94||world.x>11.18||world.y< -7.70)return false;
  bool outer=world.x< -6.5||world.x>8.70;
  if(world.y>(outer?-2.56:-1.62))return false;
  float pier=abs(fract((world.x-1.18)/2.55+.5)-.5)*2.55;
  return pier>.065;
}
float joint(float v,float width){
  float edge=abs(fract(v+.5)-.5);
  return 1.-smoothstep(width,width+max(fwidth(v),.0015),edge);
}
vec3 finishedSurface(vec3 base,vec3 n,float exposed,vec3 ortho){
  float dist=distance(cameraPosition,world);
  if(finishReady<.5||dist>490.)return base;
  vec3 axis=abs(n);
  bool horizontal=axis.y>max(axis.x,axis.z);
  bool wallX=axis.x>axis.z;
  vec2 plane=horizontal?world.xz:vec2(wallX?world.z:world.x,world.y);
  float face=horizontal?n.y:(wallX?n.x:n.z);
  vec3 tangent=horizontal?vec3(1.,0.,0.):(wallX?vec3(0.,0.,1.):vec3(1.,0.,0.));
  vec3 bitangent=horizontal?vec3(0.,0.,1.):vec3(0.,1.,0.);
  bool terrain=category<.5,large=category<3.5;
  bool office=abs(world.x-1.)<18.&&abs(world.z-1.)<19.5&&world.y>-8.8&&world.y<-.9;
  bool lab=abs(world.x)<112.&&world.z>-98.&&world.z<62.;
  bool northControl=abs(world.x)<82.&&abs(world.z+238.)<52.;
  bool manufacturing=world.x>135.&&world.z<69.;
  bool dorm=world.x< -145.&&world.z< -67.;
  vec3 accent=office?vec3(.64,.48,.25):manufacturing?vec3(.87,.58,.17):dorm?vec3(.69,.37,.15):
    northControl?vec3(.22,.45,.59):world.x<0.&&lab?vec3(.27,.48,.38):vec3(.21,.44,.57);
  float inside=1.-exposed;
  float tile=7., period=3., relief=.45;
  vec3 tint=vec3(.66,.68,.66);
  if(terrain){
    bool paved=ortho.r<.21&&abs(ortho.r-ortho.b)<.036;
    tile=paved?4.:5.;period=paved?3.0:4.4;relief=.72;
    tint=paved?vec3(.29,.31,.31):mix(vec3(.57,.50,.39),vec3(.35,.39,.26),smoothstep(.003,.065,ortho.g-ortho.r));
  }else if(horizontal){
    if(face<-.35){
      tile=2.;period=3.6;tint=mix(vec3(.32,.35,.34),vec3(.15,.20,.24),inside);
    }else if(office){
      tile=large?1.:6.;period=large?2.8:1.6;tint=large?vec3(.29,.30,.29):vec3(.39,.28,.17);
    }else if(large){
      tile=1.;period=3.9;tint=mix(vec3(.38,.42,.42),vec3(.64,.63,.57),exposed);
      if(lab||northControl)tint=mix(tint,vec3(.26,.35,.42),inside*.65);
    }else{
      tile=3.;period=1.9;tint=category>6.5?vec3(.42,.45,.45):vec3(.31,.37,.38);
    }
  }else if(office){
    tile=large?6.:3.;period=large?3.4:1.4;tint=large?vec3(.38,.27,.18):vec3(.27,.26,.22);
  }else if(large){
    tile=exposed>.8?0.:7.;period=tile<.5?4.6:3.6;
    tint=mix(vec3(.69,.72,.71),vec3(.70,.69,.63),exposed);
    if(lab||northControl)tint=mix(tint,vec3(.40,.49,.54),inside*.72);
  }else{
    tile=category>5.5?3.:2.;period=2.1;relief=.65;
    tint=category>6.5?vec3(.49,.52,.50):category>5.5?vec3(.35,.34,.29):vec3(.29,.36,.39);
  }
  vec2 uv=plane/period;
  vec2 cell=vec2(mod(tile,4.),floor(tile/4.));
  vec2 anchor=(cell+(8./512.)+fract(uv)*(496./512.))/vec2(4.,2.);
  vec3 tex=texture2D(finishColor,anchor).rgb;
  vec2 bump=texture2D(finishNormal,anchor).rg*2.-1.;
  float ref=tile<.5?.52:tile<1.5?.16:tile<2.5?.20:tile<3.5?.28:tile<4.5?.25:tile<5.5?.58:tile<6.5?.43:.73;
  float grain=clamp(dot(tex,vec3(.29,.55,.16))/ref,.38,1.65);
  vec3 color=tint*mix(1.,grain,.74);
  bool loungeSeat=office&&abs(category-5.)<.1&&world.z>4.85&&world.z<12.02&&world.y< -6.54&&world.y> -8.13&&
    ((world.x>5.04&&world.x<6.99)||(world.x> -4.74&&world.x< -2.79));
  if(loungeSeat){
    vec2 cloth=fract(vec2(world.z*.78,(world.x+world.y)*1.12));
    vec3 fabric=texture2D(seatPhoto,vec2((cloth.x+step(world.x,0.))*.5,cloth.y)).rgb;
    float stitch=joint((world.z-4.89)/1.76,.006);
    color=fabric*1.26+.027;
    color*=1.-stitch*.32;
    relief=.07;
  }
  if(!terrain&&large){
    if(!horizontal){
      float seam=max(joint(plane.x/2.25,.003),joint((world.y+.24)/3.4,.004));
      color*=1.-.24*seam;
      float h=fract((world.y+.24)/3.4);
      if(office){
        float trim=joint((world.y+.27)/1.85,.009);
        color=mix(color,vec3(.61,.48,.28),trim*.7);
      }else{
        float band=smoothstep(.115,.125,h)*(1.-smoothstep(.185,.195,h));
        color=mix(color,accent,band*.80);
        color*=1.-.18*(1.-smoothstep(.015,.115,h));
      }
    }else if(n.y>0.){
      float seam=max(joint(plane.x/2.8,.003),joint(plane.y/2.8,.003));
      color*=1.-.28*seam;
    }else{
      float strip=joint(plane.x/4.8,.011)*(1.-smoothstep(.39,.47,abs(fract(plane.y/3.2)-.5)));
      color=mix(color,office?vec3(.86,.78,.60):vec3(.71,.80,.81),strip*inside*.85);
    }
  }
  vec3 normal=normalize(n+(tangent*bump.x+bitangent*bump.y)*relief);
  vec3 light=normalize(vec3(-.48,.88,-.30));
  float diffuse=.83+.24*dot(normal,light);
  vec3 glossy=normalize(light+normalize(cameraPosition-world));
  float spec=pow(max(0.,dot(normal,glossy)),25.)*(tile==2.||tile==3.?.09:.025);
  color=color*diffuse+spec;
  if(world.x> -77.8 && world.x< -27.2 && world.z> -60.9 && world.z< -17.1){
    // East gantry deck and the stencilled strip on the opposite rim.
    if(horizontal && n.y>.8 && abs(world.y+29.09)<.13 && world.x> -45.03 && world.x< -32.5 && world.z< -22.5){
      color=vec3(.145,.164,.188)*mix(.84,1.16,clamp(grain*.6,0.,1.))*diffuse;
      float stripe=1.-smoothstep(.08,.125,abs(world.x+42.53));
      float hatch=step(.48,fract((world.z+world.x)*3.8));
      color=mix(color,mix(vec3(.10,.11,.12),vec3(.65,.52,.19),hatch),stripe*.85);
    }else if(horizontal && abs(world.y+29.14)<.12 && abs(world.x+72.08)<1.02 && world.z> -45.15 && world.z< -29.5){
      color=(category<3.5?vec3(.49,.29,.15):vec3(.79,.80,.77))*diffuse;
    }
    if(!horizontal && abs(world.z+26.20)<.64 && world.x< -43.8 && world.y> -23.25 && world.y< -19.8){
      color=mix(color,vec3(.085,.40,.48)*diffuse,.79);
    }
    if(!horizontal && world.y< -37. && world.y> -41.12 && world.x> -52.3 && world.x< -47.6 && world.z> -39. && world.z< -25.1){
      color=mix(color,vec3(.28,.32,.34)*diffuse,.74);
    }
  }
  return mix(base,color,(1.-smoothstep(235.,490.,dist))*(terrain?.8:.95));
}`;
async function loadFinishes(){
  const loader=new THREE.TextureLoader();
  const [color,normal,fabric]=await Promise.all(['surfaces-color','surfaces-normal','office-seats'].map(k=>loader.loadAsync('data/'+k+'.webp')));
  for(const layer of [color,normal,fabric]){
    layer.flipY=false;layer.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());layer.needsUpdate=true;
  }
  material.uniforms.finishColor.value=color;
  material.uniforms.finishNormal.value=normal;
  material.uniforms.seatPhoto.value=fabric;
  material.uniforms.finishReady.value=1;dirty=true;
}
