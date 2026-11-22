'use strict';
function bedroomFurnishingsMaterial(){
  return new THREE.ShaderMaterial({
    vertexColors:true,side:THREE.DoubleSide,uniforms:roomPhotoUniforms(),extensions:{derivatives:true},
    vertexShader:`attribute float finish;varying float k;varying vec3 p,n,c,viewer;
      void main(){p=position;n=normal;c=color;k=finish;
        vec3 v=cameraPosition-modelMatrix[3].xyz;
        viewer=vec3(dot(v,modelMatrix[0].xyz),dot(v,modelMatrix[1].xyz),dot(v,modelMatrix[2].xyz));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`varying float k;varying vec3 p,n,c,viewer;`+dormPhotoGLSL+`
      float noise(vec2 q){return fract(sin(dot(q,vec2(37.3,91.2)))*14732.4);}
      void main(){
        vec3 normal=normalize(n),eye=normalize(viewer-p);
        float light=.84+.16*dot(normal,normalize(vec3(-.48,.82,-.34)));
        vec3 paint=c*light;float kind=0.;
        if(k<1.5){
          float row=sin(p.z*126.+1.8*sin(p.z*16.+p.y*1.61)+sin(p.y*3.6));
          paint*=1.+row*.055*(1.-smoothstep(.2,1.2,fwidth(p.z*48.)));
          kind=1.;
        }else if(k<2.5||k>4.5&&k<5.5){
          float stitch=sin((p.x+p.y*.6)*490.)*sin((p.z+p.y*.7)*464.);
          float cloth=1.-smoothstep(.40,2.1,length(fwidth(p.xz*140.)));
          paint*=1.+.056*cloth*stitch;
          paint+=vec3(.035)*pow(1.-abs(dot(eye,normal)),3.);
          kind=k<2.5?2.:5.;
        }else if(k<3.5){kind=3.;paint+=.035*pow(max(0.,normal.y),5.);}
        else if(k<4.5){
          float yarn=noise(floor(p.xz*63.))-.5;
          paint*=1.+.21*yarn*(1.-smoothstep(.75,2.1,length(fwidth(p.xz*63.))));
          vec2 sunOffset=(p.xz-vec2(-2.31,5.07))/vec2(.74,1.04);
          paint+=vec3(.25,.20,.14)*exp(-2.*dot(sunOffset,sunOffset));
          kind=4.;
        }
        else if(k>5.5&&k<6.5){paint=c;}
        if(kind>.5){
          vec3 registered=fromRoomPhoto(paint,p,viewer,kind);
          paint=mix(paint,registered,kind==4. ? .46 : 1.);
        }
        gl_FragColor=vec4(paint,1.);
      }`
  });
}
function bedroomFurnishings(){
  const pos=[],norm=[],color=[],kinds=[],indices=[];
  function add(geo,k,c,center,rot=[0,0,0]){
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...center),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1));
    geo.applyMatrix4(matrix);const p=geo.attributes.position,n=geo.attributes.normal,offset=pos.length/3;
    for(let i=0;i<p.count;i++){
      pos.push(p.getX(i),p.getY(i),p.getZ(i));norm.push(n.getX(i),n.getY(i),n.getZ(i));color.push(...c);kinds.push(k);
    }
    const index=geo.index;for(let i=0;i<(index?.count??p.count);i++)indices.push(offset+(index?index.getX(i):i));
    geo.dispose();
  }
  const box=(x,y,z,dx,dy,dz,k,c,rot)=>add(new THREE.BoxGeometry(dx,dy,dz),k,c,[x,y,z],rot);
  function rounded(x,y,z,dx,dy,dz,k,c,rot,wrinkles=0){
    const geo=new THREE.SphereGeometry(1,40,20),p=geo.attributes.position;
    const power=v=>Math.sign(v)*Math.pow(Math.abs(v),.32);
    for(let i=0;i<p.count;i++){
      let u=power(p.getX(i)),v=power(p.getY(i)),w=power(p.getZ(i));
      const drape=.42*Math.sin(7.*u+2.3*w)+.25*Math.sin(14.*w+4.2*u)+.33*Math.cos(11.*u-5.*w);
      const gathered=Math.exp(-Math.abs(Math.abs(w)-.89)*7);
      p.setXYZ(i,u*dx*.5,(v+wrinkles*(drape+.65*Math.sin(u*28.+w)*gathered))*dy*.5,w*dz*.5);
    }
    geo.computeVertexNormals();add(geo,k,c,[x,y,z],rot);
  }
  const wood=[.285,.216,.173],edge=[.346,.264,.199],walnut=[.236,.171,.139],back=[.337,.293,.254],brass=[.53,.40,.23],lamp=[.97,.78,.55];
  // Built-in cupboards, two lit open shelving columns and recessed writing desk.
  box(-.078,1.86,4.28,.125,3.66,8.48,1,back);
  for(const z of [.12,2.82,3.48,7.61,8.49])box(-.337,1.86,z,.54,3.67,.074,1,edge);
  box(-.315,2.39,1.46,.55,2.06,2.62,1,wood);
  box(-.315,2.87,5.55,.55,1.47,4.04,1,wood);
  for(const z of [1.43,4.5,5.56,6.58])box(-.598,z<2?2.35:2.87,z,.011,z<2?2.05:1.41,.014,1,walnut);
  for(const z of [1.34,1.51,4.43,4.57,6.47,6.64])box(-.613,z<2?2.42:2.87,z,.03,.22,.018,1,brass);
  for(const [z,w] of [[3.15,.60],[8.05,.81]]){
    for(const y of [.48,1.10,1.81,2.53,3.27]){
      box(-.324,y,z,.52,.047,w,1,edge);box(-.253,y-.035,z,.18,.014,w-.056,6,lamp);
    }
    box(-.33,.22,z,.53,.41,w,1,walnut);
  }
  box(-.40,.79,5.54,.72,.087,4.0,1,edge);
  box(-.185,1.17,1.44,.22,.49,2.62,1,walnut);
  box(-.38,.90,1.48,.57,.10,2.62,1,wood);
  for(let i=0;i<5;i++)box(-.25,.91+(i%3)*.041,3.7+i*.078,.23,.18+(i%3)*.082,.052,1,[.15+.015*i,.144+.013*i,.145+.009*i],[-.08*(i%2),0,0]);
  const rug=[.384,.343,.291],fabric=[.348,.332,.321];
  function carpet(x,z,rx,rz,angle){
    const geo=new THREE.CylinderGeometry(1,1,.022,52);geo.scale(rx,1,rz);add(geo,4,rug,[x,.020,z],[0,angle,0]);
  }
  // Ellipses fitted to the visible carpet edges on the calibrated floor plane.
  carpet(-3.69,1.90,.64,1.07,-2.45);carpet(-2.13,5.52,.97,1.39,-2.677);
  rounded(-1.99,.248,1.65,3.03,.43,2.06,2,[.242,.228,.222],[0,0,0]);
  rounded(-1.98,.44,1.64,2.99,.22,2.10,2,[.342,.328,.31],[0,0,0]);
  rounded(-2.20,.505,1.66,2.69,.39,2.19,2,fabric,[0,0,0],.18);
  rounded(-.997,.632,1.17,.76,.234,.94,2,[.321,.304,.29],[.028,.07,-.08],.12);
  rounded(-.99,.622,2.12,.75,.226,.91,2,[.307,.291,.28],[-.014,-.04,-.09],.11);
  rounded(-3.50,.127,3.73,1.00,.229,.48,5,[.292,.267,.251],[.018,-.44,.09],.24);
  const linen=[.69,.67,.636],charcoal=[.19,.173,.169];
  rounded(-4.40,.035,2.22,.67,.055,.36,8,linen,[.025,-.69,.028],.44);
  rounded(-4.30,.043,2.42,.43,.064,.25,8,linen,[-.04,-.35,.08],.48);
  rounded(-4.045,.030,3.53,.79,.049,.23,8,charcoal,[.012,-.46,-.047],.50);
  rounded(-4.20,.031,3.43,.46,.052,.12,8,charcoal,[.022,.31,-.04],.62);
  // A light upholstered desk chair has tipped onto the rug.
  const seat=[.59,.551,.474],metal=[.377,.367,.346];
  rounded(-1.51,.30,5.43,.15,.47,.49,3,seat,[.055,-.04,-.16]);
  rounded(-1.48,.28,5.87,.44,.49,.15,3,seat,[.29,-.25,.13]);
  for(const x of [-1.72,-1.34])box(x,.26,5.67,.033,.036,.55,3,metal,[.28,-.08,0]);
  box(-1.57,.31,5.02,.072,.066,.54,3,metal,[.11,-.31,0]);
  for(let j=0;j<5;j++){
    const a=j*2*Math.PI/5;
    box(-1.62+.13*Math.cos(a),.30+.15*Math.sin(a),4.81,.33,.035,.048,3,metal,[0,.12,a]);
  }
  // The outer post sockets and top beam belong to the original building mesh.
  // The three intermediate bars are visible in the approach to the apartments.
  for(const h of [.235,.455,.675])box(.155,h,-2.70,15.19,.026,.023,7,[.47,.48,.465]);
  const geo=new THREE.BufferGeometry();
  for(const [name,array,size] of [['position',pos,3],['normal',norm,3],['color',color,3],['finish',kinds,1]])geo.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
  geo.setIndex(indices);geo.computeBoundingBox();geo.boundsTree=new MeshBVHLib.MeshBVH(geo,{maxLeafTris:12});return geo;
}
