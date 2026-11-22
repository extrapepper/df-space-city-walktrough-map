'use strict';
// Coordinates are in the same tower frame as the original mast and service deck.
function mastSupportGeometry(study){
  const positions=[],uv=[],coating=[],tones=[],indices=[];
  const lerp=THREE.MathUtils.lerp;
  function point(side,t,fraction){
    return new THREE.Vector3(side*lerp(...study.mountU,t),lerp(...study.height,t),
      lerp(...study.front,t)+fraction*lerp(...study.width,t));
  }
  function face(vertices,tex,shade,photo=false){
    const first=positions.length/3;
    for(const p of vertices){
      positions.push(...launchPoint(p.x,p.y,p.z).toArray());
      if(photo){
        const t=(p.y-study.height[0])/(study.height[1]-study.height[0]);
        const f=(p.z-lerp(...study.front,t))/lerp(...study.width,t);
        coating.push((f+.085)/1.18,(t+.025)/1.055,p.x<0?1:.64);
      }else coating.push(0,0,0);
    }
    uv.push(...tex);tones.push(shade,shade,shade,shade);
    indices.push(first,first+1,first+2,first,first+2,first+3);
  }
  function girder(a,b,normal,width,depth,shade,bar=false,photo=false){
    const direction=b.clone().sub(a),length=direction.length();direction.divideScalar(length);
    const outward=normal.clone().addScaledVector(direction,-normal.dot(direction)).normalize();
    const across=new THREE.Vector3().crossVectors(direction,outward).normalize();
    const w=width*.5,h=depth*.5,web=width*.09,lip=Math.min(.075,depth*.18);
    // I-section with two full flanges and a recessed web. Each end is capped.
    const section=bar?[[-w,h],[w,h],[w,-h],[-w,-h]]:[[-w,h],[w,h],[w,h-lip],[web,h-lip],[web,-h+lip],[w,-h+lip],
      [w,-h],[-w,-h],[-w,-h+lip],[-web,-h+lip],[-web,h-lip],[-w,h-lip]];
    const cross=(center,x,y)=>center.clone().addScaledVector(across,x).addScaledVector(outward,y);
    for(let i=0;i<section.length;i++){
      const p=section[i],q=section[(i+1)%section.length],isWeb=!bar&&(i===3||i===9);
      face([cross(a,...p),cross(a,...q),cross(b,...q),cross(b,...p)],
        [0,0,1,0,1,length/4.8,0,length/4.8],shade*(isWeb?.59:1.),photo&&i===0);
    }
    const ends=bar?[[-w,-h,w,h]]:[[-w,h-lip,w,h],[-web,-h+lip,web,h-lip],[-w,-h,w,-h+lip]];
    for(const center of [a,b])for(const [x,y,x1,y1] of ends){
      face([cross(center,x,y),cross(center,x1,y),cross(center,x1,y1),cross(center,x,y1)],[0,0,1,0,1,1,0,1],shade*.78);
    }
  }
  for(const side of [-1,1]){
    const slope=new THREE.Vector3(side*(study.height[0]-study.height[1]),study.mountU[1]-study.mountU[0],0).normalize();
    const sideNormal=new THREE.Vector3(0,0,1);
    const rim=(t,f)=>point(side,t,f*lerp(.94,1.,t));
    for(const f of [0,1]){
      const top=rim(0,f),toe=rim(1,f);
      girder(top,toe,slope,.85,.57,1.16,false,true);
      const mid=rim(.55,f),wall=mid.clone();wall.x=side*3.04;
      const heel=toe.clone();heel.x=side*3.04;
      girder(wall,mid,sideNormal,.46,.30,.81);
      girder(heel,mid,sideNormal,.54,.32,.87);
      // The two heel plates sit directly on the native deck.
      const left=toe.clone(),right=toe.clone();left.x-=.57;right.x+=.57;
      left.y+=.11;right.y+=.11;girder(left,right,new THREE.Vector3(0,1,0),1.15,.22,.78);
      const cleat=top.clone();cleat.y+=1.12;
      girder(top,cleat,new THREE.Vector3(side,0,0),.92,.47,.92,true);
    }
    const headA=rim(0,0),headB=rim(0,1);
    headA.y+=.95;headB.y+=.95;
    girder(headA,headB,new THREE.Vector3(side,0,0),.56,.34,.70,true);
    const levels=[.031,.207,.382,.555,.732];
    for(const [i,t] of levels.entries()){
      // The two bright lips enclose a row of small open webs in each crossrail.
      for(const lip of [t-.010,t+.010])girder(rim(lip,0),rim(lip,1),slope,.09,.27,1.17,true,true);
      const webs=Math.round(rim(t,0).distanceTo(rim(t,1))/.27);
      for(let j=1;j<webs;j++){
        const f=j/webs;
        girder(rim(t-.010,f),rim(t+.010,f+.004),slope,.074,.16,.91,true);
      }
      const next=i+1<levels.length?levels[i+1]-.010:.951,apex=.42+.025*i;
      const a=rim(t+.022,apex-.047),b=rim(t+.022,apex+.047);
      girder(a,b,slope,.48,.32,1.11,false,true);
      girder(a,rim(next,.045),slope,.61,.30,1.14,false,true);
      girder(b,rim(next,.955),slope,.61,.30,1.14,false,true);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('coating',new THREE.Float32BufferAttribute(coating,3));
  g.setAttribute('tone',new THREE.Float32BufferAttribute(tones,1));g.setIndex(indices);
  return g;
}
function buildMastSupports(study,zinc,lattice){
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},uniforms:{zinc:{value:zinc},lattice:{value:lattice}},
    vertexShader:`attribute float tone;attribute vec3 coating;varying float light;varying vec3 p,coat;varying vec2 tex;
      void main(){light=tone;p=position;tex=uv;coat=coating;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D zinc,lattice;varying float light;varying vec3 p,coat;varying vec2 tex;
      void main(){vec3 n=normalize(cross(dFdx(p),dFdy(p)));
        float sun=.77+.24*abs(dot(n,normalize(vec3(-.52,.90,-.36))));
        vec3 steel=texture2D(zinc,tex).rgb*light*sun;
        vec4 traced=texture2D(lattice,coat.xy);steel=mix(steel,traced.rgb,traced.a*coat.z*.91);
        gl_FragColor=vec4(steel,1.);}`});
  const {mesh}=registerLaunchSolid(mastSupportGeometry(study),mat);mesh.name='主塔底座斜撑';
}
