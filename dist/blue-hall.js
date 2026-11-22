'use strict';
const blueHallUniforms={
  blueHallAtlas:{value:null},
  blueReflectors:{value:null},
  blueHallEyes:{value:[new THREE.Vector3(),new THREE.Vector3()]},
  blueHallReady:{value:0}
};
// The two halves store spherical views from opposite sides of the test article.
// Alpha encodes radial distance in metres. Sample each depth before mixing color
// so the background cannot bleed onto the movable camera's foreground objects.
const blueHallProjection=`
  uniform sampler2D blueHallAtlas;
  uniform vec3 blueHallEyes[2];
  uniform float blueHallReady;
  vec4 blueHallTexel(vec2 px,float row,float metres){
    vec2 uv=(vec2(mod(px.x,2048.),clamp(px.y,0.,1023.)+row*1024.)+.5)/2048.;
    vec4 c=texture2D(blueHallAtlas,uv);
    float depth=(255.*c.a-2.)*34./250.;
    float weight=step(.005,c.a)*(1.-smoothstep(.16,.41,abs(depth-metres)));
    return vec4(c.rgb*weight,weight);
  }
  vec3 blueHallFinish(vec3 base,vec3 pos,vec3 normal){
    if(blueHallReady<.5||pos.x<50.8||pos.x>82.3||pos.z< -73.1||pos.z> -44.8||pos.y< -35.||pos.y> -12.7)return base;
    vec4 color=vec4(0.);float coverage=0.;
    for(int i=0;i<2;i++){
      vec3 toward=pos-blueHallEyes[i];
      float metres=length(toward);
      vec3 dir=toward/max(.01,metres);
      float facing=smoothstep(.06,.40,-dot(dir,normal));
      if(facing<.001)continue;
      vec2 uv=vec2(.5+atan(dir.x,dir.z)*.159154943,.5-asin(clamp(dir.y,-1.,1.))*.318309886);
      vec2 pixel=uv*vec2(2048.,1024.)-.5,corner=floor(pixel),f=fract(pixel);
      vec4 coat=mix(mix(blueHallTexel(corner,float(i),metres),blueHallTexel(corner+vec2(1,0),float(i),metres),f.x),
                    mix(blueHallTexel(corner+vec2(0,1),float(i),metres),blueHallTexel(corner+vec2(1,1),float(i),metres),f.x),f.y);
      float alignment=max(0.,dot(dir,normalize(pos-cameraPosition)));
      color+=coat*facing*(.18+.82*alignment*alignment);
      coverage=max(coverage,coat.a*facing);
    }
    return mix(base,color.rgb/max(color.a,.0001),coverage);
  }`;
let blueHallLoad=null,blueHallRetry=0,blueHallWalk=null;
function approachBlueHall(eye){
  if(blueHallLoad||performance.now()<blueHallRetry||Math.abs(eye.x-65)>52||Math.abs(eye.z+59)>50)return;
  const loader=new THREE.TextureLoader();
  blueHallLoad=Promise.all([jsonFile('blue-hall.json'),loader.loadAsync('data/blue-hall.webp'),loader.loadAsync('data/blue-reflectors.webp')]).then(([hall,ink,discs])=>{
    ink.flipY=false;ink.generateMipmaps=false;ink.minFilter=ink.magFilter=THREE.NearestFilter;ink.needsUpdate=true;
    discs.flipY=false;discs.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());discs.needsUpdate=true;
    hall.views.forEach((v,i)=>{blueHallUniforms.blueHallEyes.value[i].fromArray(v.eye);surveyViews.set(v.panorama,v)});
    blueHallWalk=hall.walk;
    blueHallUniforms.blueHallAtlas.value=ink;blueHallUniforms.blueReflectors.value=discs;blueHallUniforms.blueHallReady.value=1;
    refreshRoomPose();if(routeMapOpen)paintRouteMap();dirty=true;
  }).catch(()=>{blueHallLoad=null;blueHallRetry=performance.now()+15000});
}
