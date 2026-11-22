'use strict';
const launchArt={deck:{value:null},ring:{value:null},arm:{value:null},vehicle:{value:null}};
const launchSurvey={eye:{value:new THREE.Vector3()},axes:{value:new THREE.Matrix3()},focal:{value:new THREE.Vector2()},rect:{value:new THREE.Vector4()},ready:{value:0}};
const launchSolids=[];
let launchLoading,returnStudy,returnVehicle,returnPlume,returnTime=0,returnPlaying=false;
function setLaunchSurvey(pose){
  launchSurvey.eye.value.fromArray(pose.eye);launchSurvey.axes.value.set(...pose.rotation.flat());
  launchSurvey.focal.value.set(pose.focal/pose.width,pose.focal/pose.height);
  launchSurvey.rect.value.fromArray(pose.rect);launchSurvey.ready.value=1;
}
function makeLaunchMaterials(base){
  const u=base.uniforms;
  return Array.from({length:6},(_,kind)=>dormShader(`
    uniform sampler2D deck,ring,finish,relief,photo,depth;uniform vec3 eye;uniform mat3 axes;
    uniform vec4 rect;uniform vec2 focal;uniform float scanned,ready,painted;
    float joint(float x,float width){
      float e=abs(fract(x+.5)-.5),aa=max(.001,fwidth(x));
      return (1.-smoothstep(width,width+aa,e))*(1.-smoothstep(.18,.65,aa));
    }
    float band(float distance,float halfWidth){
      float aa=max(.007,fwidth(distance));
      return 1.-smoothstep(halfWidth,halfWidth+aa,abs(distance));
    }
    float triangle(vec2 p,vec2 a,vec2 b,vec2 c){
      vec2 e=b-a,f=c-b,g=a-c;
      float d0=dot(p-a,normalize(vec2(-e.y,e.x))),d1=dot(p-b,normalize(vec2(-f.y,f.x))),d2=dot(p-c,normalize(vec2(-g.y,g.x)));
      float edge=min(d0,min(d1,d2));return smoothstep(-fwidth(edge)-.004,.004,edge);
    }
    void main(){
      vec2 d=p.xz-vec2(-123.,355.);
      vec3 q=vec3(-.70710678*(d.x+d.y),p.y,.70710678*(d.y-d.x));
      vec3 n=normalize(cross(dFdx(p),dFdy(p)));
      vec3 localN=vec3(-.70710678*(n.x+n.z),n.y,.70710678*(n.z-n.x));
      vec2 uv=abs(n.y)>.6?q.xz:(abs(localN.x)>abs(localN.z)?q.zy:q.xy);
      vec2 steelUV=(vec2(3.,0.)+.015+.97*fract(uv/1.83))/vec2(4.,2.);
      float grain=dot(texture2D(finish,steelUV).rgb,vec3(.30,.53,.17));
      vec2 bump=texture2D(relief,steelUV).rg*2.-1.;
      float wear=mix(1.,clamp(.52+1.72*grain+.15*dot(bump,vec2(-.6,.8)),.62,1.38),scanned);
      vec3 c=vec3(.39,.389,.37)*wear;
      float light=.84+.19*abs(dot(n,normalize(vec3(-.52,.90,-.36))));
      if(${kind}==0&&abs(n.y)>.72&&q.y> -18.0){
        vec2 deckUV=(q.xz+vec2(49.,34.))/32.;
        vec3 field=texture2D(deck,deckUV).rgb;
        vec2 offset=q.xz-vec2(-32.70,-18.77);
        float radial=length(offset),circle=1.-smoothstep(6.28,6.43,radial);
        // The blue disk has two broken arcs and the split white diamond seen from above.
        float arcMask=smoothstep(.19,.28,min(abs(offset.x),abs(offset.y)));
        float mark=max(band(radial-6.38,.063),band(radial-4.05,.057)*arcMask);
        vec2 emblem=offset/1.84;
        mark=max(mark,triangle(emblem,vec2(-1.,0.),vec2(-.35,-.63),vec2(-.35,.64)));
        mark=max(mark,triangle(emblem,vec2(.38,-.62),vec2(1.,0.),vec2(.38,.62)));
        mark=max(mark,triangle(emblem,vec2(-.29,-.73),vec2(.03,-1.10),vec2(.16,-.27)));
        mark=max(mark,triangle(emblem,vec2(-.21,-.47),vec2(.19,-.10),vec2(-.21,1.12)));
        mark=max(mark,triangle(emblem,vec2(-.21,1.12),vec2(.19,-.10),vec2(.19,.64)));
        float localLight=clamp(.57+.75*dot(field,vec3(.28,.56,.16)),.63,1.12);
        vec3 original=mix(field,mix(vec3(.14,.237,.314),field,.28),circle);
        vec3 metal=mix(original,vec3(.89,.863,.774)*localLight,mark)*wear;
        float seam=max(joint((q.x+.17)/2.58,.0028),joint((q.z+.91)/2.15,.0032));
        c=mix(c,metal*(1.-.27*seam),painted);
      }else if(${kind}==1&&abs(n.y)>.25&&q.y> -8.1){
        c=mix(c,texture2D(ring,(q.xz+9.)/18.).rgb,painted);
      }else if(${kind}==2){
        c=mix(vec3(.36,.337,.304),vec3(.48,.46,.414),abs(localN.z))*(.93+.15*grain);
        c*=1.-.28*joint((q.y+5.)/4.18,.012);
      }else if(${kind}==3||${kind}==4){
        c*=vec3(.84,.85,.87)*(1.-.23*joint(uv.y/3.9,.012));
      }else if(${kind}==5){
        if(abs(n.y)>.7){
          float mesh=max(joint((q.x+q.z)/.088,.15),joint((q.x-q.z)/.088,.15));
          c=vec3(.47,.473,.45)*wear*(.79+.23*mesh);
        }else{
          c=vec3(.34,.346,.338)*wear*(.87+.19*joint(q.x/.14,.06));
        }
      }
      c*=light;
      if(ready>.5){
        vec3 ray=axes*(p-eye);
        vec2 px=.5+ray.xy/ray.z*focal;
        if(ray.z>0.&&all(greaterThan(px,vec2(0.)))&&all(lessThan(px,vec2(1.)))){
          vec2 uv0=rect.xy+px*rect.zw;
          vec3 dep=texture2D(depth,uv0).rgb;
          float confidence=dep.b*(1.-smoothstep(.10,.55,abs(ray.z-dot(dep.rg,vec2(2.55,652.8)))));
          if(${kind}==0||${kind}==5)confidence*=smoothstep(7.,32.,distance(cameraPosition,p));
          c=mix(c,texture2D(photo,uv0).rgb,confidence*smoothstep(.12,.38,abs(dot(n,normalize(eye-p)))));
        }
      }
      gl_FragColor=vec4(c,1.);
    }`,{...launchSurvey,deck:launchArt.deck,ring:launchArt.ring,finish:u.finishColor,relief:u.finishNormal,scanned:u.finishReady,
      photo:u.surveyPhotos,depth:u.surveyDepth,painted:launchPainted}));
}
const launchPainted={value:0};
function launchPoint(u,y,f){
  return new THREE.Vector3(-123-(u+f)*Math.SQRT1_2,y,355+(f-u)*Math.SQRT1_2);
}
function armGeometry(){
  const points=[],colors=[],uvs=[],indices=[];
  function quad(a,b,c,d,color,paint=false){
    const start=points.length/3;
    for(const v of [a,b,c,d])points.push(...launchPoint(...v).toArray());
    for(let i=0;i<4;i++)colors.push(...color);
    uvs.push(...(paint?[0,0,1,0,1,1,0,1]:[-1,0,-1,0,-1,0,-1,0]));
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  function strut(a,b,w,depth,color){
    const dx=b[0]-a[0],dy=b[1]-a[1],scale=w*.5/Math.hypot(dx,dy);
    const corners=[a,b,b,a].map(([x,y,z],i)=>[x+(i<2?-dy:dy)*scale,y+(i<2?dx:-dx)*scale,z-depth/2]);
    const far=corners.map(([x,y,z])=>[x,y,z+depth]);quad(...corners,color);quad(...far,color);
    corners.forEach((v,i)=>{const j=(i+1)%4;quad(v,corners[j],far[j],far[i],color)});
  }
  const buff=[.59,.555,.496],dark=[.28,.273,.247],steel=[.48,.456,.417];
  for(const [root,tip,tipY,front] of [[-2.05,-26.7,40.8,10.9],[2.05,22.2,41.35,12.3]]){
    const rear=front+2.65;
    const top=t=>39.75+t*(tipY-39.75),bottom=t=>32.7+t*(tipY-1.9-32.7);
    const corner=(t,h,f)=>[root+(tip-root)*t,h(t),f];
    quad(corner(.10,top,rear),corner(1,top,rear),corner(.986,bottom,rear),corner(.19,bottom,rear),buff,true);
    quad(corner(0,top,front),corner(1,top,front),corner(1,top,rear),corner(0,top,rear),buff);
    quad(corner(0,bottom,front),corner(1,bottom,front),corner(1,bottom,rear),corner(0,bottom,rear),dark);
    for(const fn of [top,bottom])strut(corner(0,fn,front),corner(1,fn,front),.48,.48,buff);
    for(let i=0;i<7;i++)strut(corner(i/7,i%2?top:bottom,front),corner((i+1)/7,i%2?bottom:top,front),.29,.31,steel);
    strut(corner(0,bottom,front),corner(0,top,front),1.22,3.8,dark);
    strut(corner(.075,bottom,front+.9),corner(.075,top,front+.9),.83,3.12,steel);
    quad(corner(1,top,front),corner(1,top,rear),corner(1,bottom,rear),corner(1,bottom,front),dark);
    // The moving joint joins the paired beams to the original mast at f=14.6.
    for(const fn of [top,bottom])strut([root*.40,fn(0),14.6],[root*1.4,fn(0),14.6],.89,4.8,dark);
  }
  // The later frames expose a second short beam across the top of the mast,
  // with a hanging yellow block at its far end.
  const f=17.6;
  strut([-17.5,99.1,f],[1.,102.0,f],.82,1.18,buff);
  strut([-17.5,98.05,f],[1.,97.4,f],.68,1.16,steel);
  for(let i=0;i<5;i++){
    const x=-17.1+i*3.55,next=x+3.55;
    strut([x,98.06-(x+17.5)*.035,f-.33],[next,99.1+(next+17.5)*.157,f-.33],.28,.35,dark);
  }
  strut([1.8,99.86,f],[6.55,101.5,f],3.55,2.80,steel);
  strut([1.8,101.83,f],[6.55,103.47,f],.44,2.88,buff);
  for(const x of [-17.65,-17.40])strut([x,98.1,f],[x,82.1,f],.045,.07,dark);
  strut([-17.52,81.7,f],[-17.52,83.0,f],.66,.64,[.69,.52,.24]);
  strut([-18.13,81.32,f],[-16.90,81.32,f],.54,.75,[.81,.62,.28]);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);return g;
}
function vehicleGeometry(profile){
  const pts=[],uv=[],indices=[],n=64,low=profile[0][0],high=profile.at(-1)[0];
  for(const [row,[y,r]] of profile.entries())for(let i=0;i<=n;i++){
    const a=2*Math.PI*i/n;pts.push(...launchPoint(r*Math.cos(a),y,r*Math.sin(a)).toArray());uv.push(i/n,(high-y)/(high-low));
    if(row&&i){const j=row*(n+1)+i;indices.push(j-n-2,j-n-1,j,j-n-2,j,j-1)}
  }
  // Close both ends so approaching the vehicle from below has a visible underside.
  for(let i=1;i<n-1;i++){
    const top=(profile.length-1)*(n+1);indices.push(0,i,i+1,top,top+i+1,top+i);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}
function launchMesh(g,skin,isArm){
  const m=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},vertexColors:isArm,
    uniforms:{skin},vertexShader:`varying vec2 tex;varying vec3 point,tint;
    void main(){tex=uv;point=position;tint=${isArm?'color':'vec3(1.)'};gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 tex;varying vec3 point,tint;uniform sampler2D skin;
    void main(){vec3 n=normalize(cross(dFdx(point),dFdy(point)));
    vec3 paint=tex.x<-.5?tint:texture2D(skin,tex).rgb;
    float shade=${isArm?'.80+.20*abs(dot(n,normalize(vec3(-.34,.86,.38))))':'1.'};
    gl_FragColor=vec4(paint*shade,1.);}`});
  g.computeBoundingBox();g.boundsTree=new MeshBVHLib.MeshBVH(g,{maxLeafTris:12});
  const mesh=new THREE.Mesh(g,m);scene.add(mesh);
  const solid={mesh,bounds:g.boundingBox.clone()};launchSolids.push(solid);return solid;
}
function makeReturnPlume(){
  // A camera-facing strip follows the underside of the vehicle. It shortens at
  // the native ring, just as the bright column disappears into dust in the film.
  const uniforms={bottom:{value:0},phase:{value:0}};
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,
    vertexShader:`uniform float bottom;varying vec2 t;
    void main(){
      t=uv;vec3 axis=vec3(-123.,0.,355.);vec2 v=cameraPosition.xz-axis.xz;
      vec3 right=vec3(-v.y,0.,v.x)/max(length(v),.001);
      float h=max(.02,min(bottom+6.49,32.));
      vec3 point=axis+right*((uv.x-.5)*10.)+vec3(0.,bottom-(1.-uv.y)*h,0.);
      gl_Position=projectionMatrix*viewMatrix*vec4(point,1.);
    }`,
    fragmentShader:`uniform float phase,bottom;varying vec2 t;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);
      return mix(mix(hash(a),hash(a+vec2(1.,0.)),b.x),mix(hash(a+vec2(0.,1.)),hash(a+1.),b.x),b.y);}
    void main(){
      float n=noise(t*vec2(17.,26.)+vec2(0.,phase*1.9)),f=noise(t*vec2(8.,10.)+vec2(2.,phase*1.4));
      float x=abs(2.*t.x-1.),radius=.57+.15*(1.-t.y)+.15*f;
      float edge=1.-smoothstep(radius-.13,radius+.12,x+.15*n);
      float nozzle=smoothstep(.77,.99,t.y);
      vec3 c=mix(vec3(.98,.95,.93),mix(vec3(.37,.69,.85),vec3(.94,.96,.94),n),nozzle);
      c=mix(c,vec3(.83,.77,.70),.28*(1.-f)*x);
      float alpha=edge*(.66+.34*f)*smoothstep(-6.38,-4.75,bottom);
      gl_FragColor=vec4(c,alpha);
    }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),m);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=1;scene.add(mesh);return mesh;
}
async function installLaunch(){
  const loader=new THREE.TextureLoader();
  const texture=async file=>{const t=await loader.loadAsync('data/launch-'+file+'.webp');t.flipY=false;t.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());t.needsUpdate=true;return t};
  const [study,deck,ring,arm,vehicle]=await Promise.all([jsonFile('launch-return.json'),...['deck','ring','arm','vehicle'].map(texture)]);
  launchArt.deck.value=deck;launchArt.ring.value=ring;launchPainted.value=1;
  launchArt.arm.value=arm;launchArt.vehicle.value=vehicle;returnStudy=study;
  launchMesh(armGeometry(),launchArt.arm,true);
  returnVehicle=launchMesh(vehicleGeometry(study.profile),launchArt.vehicle,false);returnVehicle.mesh.visible=false;
  returnPlume=makeReturnPlume();
  dirty=true;
}
function positionReturn(offset){
  const {mesh,bounds}=returnVehicle;mesh.position.y=offset;mesh.updateMatrixWorld(true);
  bounds.copy(mesh.geometry.boundingBox).translate(mesh.position);
  returnPlume.material.uniforms.bottom.value=bounds.min.y;
  returnPlume.material.uniforms.phase.value=returnTime;
  returnPlume.visible=mesh.visible&&bounds.min.y> -6.38;dirty=true;
}
function setLaunchReturn(mode){
  if(!returnVehicle)return;
  returnVehicle.mesh.visible=!!mode;returnPlume.visible=!!mode;returnPlaying=mode==='play';
  returnTime=mode==='photo'?returnStudy.referenceFrame*returnStudy.frameSeconds:0;
  if(mode)positionReturn(returnStudy.offsets[mode==='photo'?returnStudy.referenceFrame:0]);else dirty=true;
}
function advanceReturn(dt){
  if(!returnPlaying)return;
  const {offsets,frameSeconds,profile}=returnStudy,last=offsets.length-1;
  const next=Math.min(last*frameSeconds,returnTime+dt),frame=next/frameSeconds,i=Math.min(last,Math.floor(frame));
  const y=THREE.MathUtils.lerp(offsets[i],offsets[Math.min(last,i+1)],frame-i);
  if(view==='walk'&&Math.hypot(camera.position.x+123,camera.position.z-355)<4.45&&
    camera.position.y+headMargin>profile[0][0]+y&&camera.position.y-eyeHeight()<returnVehicle.bounds.max.y)return;
  returnTime=next;positionReturn(y);
  if(next>=last*frameSeconds)returnPlaying=false;
}
