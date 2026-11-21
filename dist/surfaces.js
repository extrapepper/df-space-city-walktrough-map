'use strict';
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
