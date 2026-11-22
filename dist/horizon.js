'use strict';
let horizonScenery,horizonLoading;
const harborSky={value:null};
const horizonTextures=['range','island','sky','ground'];
const horizonUniforms={outdoor:{value:0},coastGround:{value:null},groundReady:{value:0}};
const coastGroundShader=`
  uniform float outdoor,groundReady;uniform sampler2D coastGround;
  vec3 coastGroundColor(vec3 old,vec3 p,vec3 n){
    if(outdoor<.5||p.y< -41.4)return old;
    float outside=max(max(-p.z-278.,p.z-405.),max(-p.x-265.,p.x-294.));
    vec4 paint=texture2D(coastGround,(p.xz+512.5)/1024.);
    float extent=smoothstep(-8.,45.,outside),coverage=paint.a*groundReady;
    if(max(extent,coverage)<.001)return old;
    float sun=clamp(.74+.25*dot(n,normalize(vec3(-.46,.86,-.30))),.56,1.03);
    float stratum=.5+.5*sin(p.y*.55+.75*sin(p.z*.075)+.44*sin(p.x*.056));
    vec2 uv=(vec2(1.,1.)+.015+.97*fract((p.xz+n.xz*p.y)/5.2))/vec2(4.,2.);
    float grit=dot(texture2D(finishColor,uv).rgb,vec3(.30,.53,.17));
    float steep=smoothstep(.11,.63,1.-abs(n.y));
    vec3 sand=mix(vec3(.815,.748,.635),mix(vec3(.515,.458,.399),vec3(.67,.594,.51),stratum),steep);
    sand*=sun*mix(1.,.83+.36*grit,finishReady);
    vec3 tinted=mix(old,sand,extent*.96);
    tinted=mix(tinted,paint.rgb*(.95+.08*grit),coverage*.98);
    return mix(tinted,vec3(.79,.79,.74),.16*smoothstep(270.,850.,length(cameraPosition-p))*extent);
  }`;
function horizonSurface(columns,rows,point,material){
  const pos=[],uv=[],index=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const u=col/columns,t=row/rows;
    pos.push(...point(col,u,t));uv.push(u,1-t);
    if(col&&row){const i=row*(columns+1)+col;index.push(i-columns-2,i-columns-1,i,i-columns-2,i,i-1)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);
  return new THREE.Mesh(g,material);
}
function landscapeMaterial(photo){
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{photo:{value:photo}},
    vertexShader:'varying vec2 t;void main(){t=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform sampler2D photo;varying vec2 t;void main(){gl_FragColor=vec4(texture2D(photo,t).rgb,1.);}'});
}
function makeDistantRange(data,photo){
  const seaMix=a=>THREE.MathUtils.smoothstep(a,108,133)*(1-THREE.MathUtils.smoothstep(a,275,303));
  return horizonSurface(data.angles,25,(col,u,t)=>{
    const i=col%data.angles,a=u*2*Math.PI,coast=seaMix(u*360),foot=800+850*coast;
    const sill=-29-27*coast;
    let radius,y;
    if(t<=.28){
      const f=t/.28;radius=THREE.MathUtils.lerp(data.inner[i],foot,f);y=THREE.MathUtils.lerp(data.lower[i],sill,f);
    }else{
      const f=(t-.28)/.72;radius=THREE.MathUtils.lerp(foot,data.radius,f);
      y=sill*(1-f)+data.crest[i]*Math.pow(f,1.5)+12*Math.sin(Math.PI*f)*Math.sin(a*12+f*4)*(1-coast*.5);
    }
    return [radius*Math.sin(a),y,-radius*Math.cos(a)];
  },landscapeMaterial(photo));
}
function makeSouthIsland(shape,photo){
  const island=new THREE.Group(),mat=landscapeMaterial(photo);
  for(const back of [false,true]){
    island.add(horizonSurface(shape.crest.length-1,16,(col,u,t)=>{
      const a=THREE.MathUtils.degToRad(THREE.MathUtils.lerp(shape.start,shape.end,u));
      const ridge=shape.crestRadii[col],foot=back?ridge+260:shape.footRadius;
      const radius=THREE.MathUtils.lerp(foot,ridge,t)+25*Math.cos(a*18+2)*Math.sin(Math.PI*t);
      const y=-41.8+(shape.crest[col]+41.8)*Math.pow(t,1.36);
      return [radius*Math.sin(a),y,-radius*Math.cos(a)];
    },mat));
  }
  return island;
}
const skyCoordinates=`
  vec2 daySkyUV(vec3 ray){
    return vec2(fract(atan(ray.x,-ray.z)/6.2831853+1.),clamp((1.5707963-asin(clamp(ray.y,-1.,1.)))/1.74532925,0.,1.));
  }`;
function makeDaySky(photo){
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,uniforms:{photo:{value:photo}},
    vertexShader:`varying vec3 sight;void main(){
      sight=position;gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);
      gl_Position.z=gl_Position.w*.99999;
    }`,
    fragmentShader:`uniform sampler2D photo;varying vec3 sight;
    ${skyCoordinates}
    void main(){
      gl_FragColor=vec4(texture2D(photo,daySkyUV(normalize(sight))).rgb,1.);
    }`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(8,32,20),mat);sky.renderOrder=-100;sky.frustumCulled=false;return sky;
}
const harborLightShader=`
  uniform sampler2D harborSky;
  ${skyCoordinates}
  vec3 harborColor(vec3 p,vec3 eye,float coast){
    float ripple=sin(p.z*1.3+sin(p.x*.7))*sin(p.x*.15+p.z*.4);
    vec3 sight=normalize(p-eye);
    float glancing=pow(1.-abs(sight.y),3.);
    vec3 chart=mix(vec3(.095,.22,.22),vec3(.34,.44,.44),glancing*.62);
    if(coast<.5)return chart+ripple*.012;
    vec3 normal=normalize(vec3(ripple*.018,1.,.018*sin(p.x*.8-p.z*.3)));
    vec3 sky=texture2D(harborSky,daySkyUV(reflect(sight,normal))).rgb;
    vec3 reflection=mix(vec3(.79,.85,.87),sky,.34);
    float towardLight=clamp(-sight.x*1.7,0.,1.);
    vec3 col=mix(vec3(.226,.306,.284),reflection,min(.91,glancing*(1.+.25*towardLight)));
    float mist=smoothstep(350.,1900.,distance(p,eye));
    return mix(col+ripple*.008,vec3(.67,.72,.72),mist*.78);
  }`;
function makeOuterWater(data){
  // The apron begins at the surveyed harbor's outer boundary. Original water
  // inside that boundary retains its connected mask, collision and swim level.
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{level:{value:data.water},harborSky},
    vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p;uniform float level;
    ${harborLightShader}
    void main(){if(cameraPosition.y<level-.08)discard;
      gl_FragColor=vec4(harborColor(p,cameraPosition,1.),1.);
    }`});
  return horizonSurface(data.angles,1,(col,u,t)=>{
    const a=u*Math.PI*2,i=col%data.angles,r=THREE.MathUtils.lerp(data.inner[i]+3.6,1970,t);
    return [r*Math.sin(a),data.water-.025,-r*Math.cos(a)];
  },mat);
}
function makeOffshoreMasts(buffer,data){
  const {mesh}=readMesh(new DataView(buffer),0);
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},
    vertexShader:`varying vec3 p;void main(){vec4 v=vec4(position,1.);
      #ifdef USE_INSTANCING
        v=instanceMatrix*v;
      #endif
      p=(modelMatrix*v).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
    }`,
    fragmentShader:`varying vec3 p;void main(){
      vec3 n=normalize(cross(dFdx(p),dFdy(p)));float haze=smoothstep(240.,1750.,distance(p,cameraPosition));
      vec3 steel=vec3(.335,.347,.34)*(.70+.28*abs(dot(n,normalize(vec3(-.42,.86,-.35)))));
      gl_FragColor=vec4(mix(steel,vec3(.69,.73,.72),.23+.69*haze),1.);
    }`});
  const group=new THREE.Group();
  const piles=new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4,3.5,29,8),mat,18);
  const matrix=new THREE.Matrix4();let pier=0;
  for(let i=1;i<=3;i++){
    const offset=new THREE.Vector3(...data.mastSpacing).multiplyScalar(i);
    const body=new THREE.Mesh(mesh.geometry,mat);body.position.copy(offset);group.add(body);
    for(const u of [-17,0,17])for(const f of [-9,9]){
      const x=offset.x-139-(u+f)*Math.SQRT1_2,z=offset.z+371+(f-u)*Math.SQRT1_2;
      piles.setMatrixAt(pier++,matrix.makeTranslation(x,-30.5,z));
    }
  }
  group.add(piles);return group;
}
async function installHorizon(){
  const loader=new THREE.TextureLoader();
  const load=async name=>{
    const t=await loader.loadAsync('data/horizon-'+name+'.webp');t.flipY=false;
    if(name==='sky'||name==='range')t.wrapS=THREE.RepeatWrapping;
    if(name==='sky'){t.generateMipmaps=false;t.minFilter=THREE.LinearFilter}
    t.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());t.needsUpdate=true;return t;
  };
  const [data,masts,range,island,sky,ground]=await Promise.all([jsonFile('horizon.json'),inflated('offshore.gz'),...horizonTextures.map(load)]);
  harborSky.value=sky;
  horizonUniforms.coastGround.value=ground;horizonUniforms.groundReady.value=1;
  const group=new THREE.Group();group.name='航天基地外景';
  group.add(makeDaySky(sky),makeDistantRange(data,range),makeOuterWater(data),makeSouthIsland(data.island,island),makeOffshoreMasts(masts,data));
  surveyViews.set('office-outlook',data.windowCamera);
  group.visible=view!=='orbit'&&!material.uniforms.submerged.value;scene.add(group);horizonScenery=group;dirty=true;
}
