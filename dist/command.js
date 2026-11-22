'use strict';
const commandPaint={finish:{value:null},ready:{value:0}};
let workstationMaterial;
const commandSamples=`
  uniform sampler2D finish;uniform float ready;
  vec3 atlasSample(vec2 at,vec2 size,vec2 uv,vec3 fallback){
    if(ready<.5)return fallback;
    return texture2D(finish,(at+.5+(size-1.)*clamp(uv,0.,1.))/vec2(1024.,512.)).rgb;
  }
  vec2 repeatTile(vec2 p){return 1.-abs(mod(p,2.)-1.);}
  float seam(float t,float w){return 1.-smoothstep(w,w+clamp(fwidth(t),.001,.08),abs(fract(t+.5)-.5));}
  float rectangle(vec2 d,vec2 halfSize){
    vec2 edge=abs(d)-halfSize;float farEdge=max(edge.x,edge.y);
    return 1.-smoothstep(-.004,max(.006,fwidth(farEdge)),farEdge);
  }`;
function makeCommandMaterials(){
  const hall=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},
    vertexShader:trainingVertex,uniforms:{...commandPaint,...serverFinish},fragmentShader:`varying vec3 site;${commandSamples}${serverSamples}${serverRoomShader}
    void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site)));
      float h=site.y+23.648,sideLight=.90+.10*dot(n,normalize(vec3(-.38,.74,.56)));
      vec3 paint;
      if(abs(n.y)>.6&&h<.26){
        float aisle=1.-smoothstep(1.64,1.67,abs(site.z-21.88));
        float stone=atlasSample(vec2(860.,438.),vec2(128.,68.),repeatTile(site.xz*.47),vec3(.53)).g;
        float rubber=atlasSample(vec2(532.,438.),vec2(96.,68.),repeatTile(site.xz*2.3),vec3(.18)).g;
        vec3 pale=vec3(.57,.56,.53)*(.71+stone*.58);
        pale*=1.-.34*max(seam((site.x-52.7)/2.33,.006),seam((site.z-21.88)/1.66,.008));
        vec3 dark=vec3(.14,.15,.16)*(.78+.94*rubber);
        paint=mix(dark,pale,aisle);
      }else if(abs(n.y)>.6&&h>3.4){
        float grain=atlasSample(vec2(740.,438.),vec2(104.,68.),repeatTile(site.xz*.6),vec3(.52)).r;
        paint=vec3(.54,.57,.57)*(.74+.49*grain);
        // From the observation platform three transverse fittings lead east
        // along the aisle. Their extents are estimated from the panorama.
        for(int i=0;i<4;i++){
          vec2 d=site.xz-vec2(53.85+4.36*float(i),21.88);
          vec3 lamp=i==3?vec3(.94,.94,.88):i==2?vec3(.46,.50,.42):vec3(.32,.33,.33);
          paint=mix(paint,vec3(.15,.17,.18),rectangle(d,vec2(.82,1.90)));
          paint=mix(paint,lamp*(.91+.09*cos(d.y*1.65)),rectangle(d,vec2(.74,1.81)));
          paint*=1.-.18*rectangle(d,vec2(.74,.018));
        }
        paint+=vec3(.38,.04,.015)*exp(-.20*dot(site.xz-vec2(56.8,17.2),site.xz-vec2(56.8,17.2)));
      }else{
        float u=abs(n.x)>.65?site.z:site.x;
        float grain=atlasSample(vec2(636.,438.),vec2(96.,68.),repeatTile(vec2(u,h)*.71),vec3(.34)).g;
        vec3 green=vec3(.25,.41,.23)*(.86+.39*grain);
        paint=h<2.43?green:vec3(.66,.67,.64);
        if(h<.15)paint=vec3(.13,.15,.16);
        paint*=1.-.19*max(seam((u-.3)/2.08,.003),seam((h-.89)/1.55,.006));
      }
      if(site.x>68.64)paint=serverRoom(site,n);
      gl_FragColor=vec4(portalFinish(site,n,paint)*sideLight,1.);
    }`});
  const frames=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},vertexShader:trainingVertex,
    fragmentShader:`varying vec3 site;void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site))),eye=normalize(cameraPosition-site);
      gl_FragColor=vec4(vec3(.18,.21,.22)*(.79+.21*n.y)+.08*pow(1.-abs(dot(n,eye)),2.4),1.);
    }`});
  const billboard=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:commandPaint,extensions:{derivatives:true},
    vertexShader:trainingVertex,fragmentShader:`varying vec3 site;${commandSamples}
    void main(){
      vec2 uv=vec2((24.8558-site.z)/5.41598,(-20.40746-site.y)/2.31467);
      vec3 color=vec3(.105,.13,.14);
      if(abs(site.x-51.10864)<.006&&min(uv.x,uv.y)>=-.0002&&max(uv.x,uv.y)<=1.0002)
        color=atlasSample(vec2(4.),vec2(1008.,425.),uv,vec3(.38,.53,.61));
      gl_FragColor=vec4(color,1.);
    }`});
  workstationMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},uniforms:commandPaint,
    vertexShader:`attribute vec4 freightCoord;varying vec3 site;varying vec4 coord;
      void main(){site=position;coord=freightCoord;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 site;varying vec4 coord;${commandSamples}
    void main(){
      float style=floor(coord.w*255.+.5);
      vec3 q=coord.xyz,n=normalize(cross(dFdx(site),dFdy(site))),eye=normalize(cameraPosition-site);
      float rim=pow(1.-abs(dot(n,eye)),2.8),light=.88+.15*dot(n,normalize(vec3(-.34,.76,.55)));
      vec3 c=vec3(.12,.14,.15);float polish=.045;
      if(style==11.){
        bool top=q.x>.033&&q.x<.967&&q.y>.84&&q.y<.895&&q.z>.051&&q.z<.951;
        c=top?vec3(.65,.67,.65):vec3(.22,.25,.25);
        if(top&&q.y<.859)c*=.74;
        if(q.y<.018)c=vec3(.32,.34,.34);
      }else if(style==12.){
        if(q.y<.052)c=vec3(.10,.11,.12);
        else if(q.y<.302){c=vec3(.43,.45,.45);polish=.19;}
        else{
          bool edging=q.x<.09||q.x>.89;
          c=edging?vec3(.35,.37,.37):vec3(.17,.19,.20);
          c*=.89+.12*smoothstep(0.,.045,abs(q.y-.79));
          c*=1.-.18*rectangle(vec2(q.x-.5,q.y-.80),vec2(.31,.009));
        }
      }else if(style==13.){
        if(q.z<.012&&q.y>.136){
          vec2 uv=vec2(q.x,(q.y-.137)/.863);
          if(rectangle(uv-.5,vec2(.472,.452))>.5)c=vec3(.060,.078,.089)+.025*q.y;
        }else if(q.y<.11)c=vec3(.22,.24,.25);
      }else if(style<=17.){
        float front=.27054+(q.y-.02878)*.7090;
        if(abs(q.z-front)<.012&&q.y>.025&&q.y<.976&&q.x>.010&&q.x<.990){
          vec2 uv=vec2((q.x-.0137)/.9726,(.9723-q.y)/.9435);
          float panel=style==15.?268.:style==16.?400.:style==17.?136.:4.;
          c=atlasSample(vec2(panel,438.),vec2(124.,68.),uv,vec3(.08,.11,.13));
          gl_FragColor=vec4(c+.012*rim,1.);return;
        }
      }else if(style==18.||style==19.){
        c=style==18.?vec3(.28,.34,.36):vec3(.39,.44,.44);
        c*=.78+.22*q.y;
        if(style==18.&&q.y>.95)c+=.08;
      }else if(style==20.){
        c=q.y<.15?vec3(.13,.15,.16):vec3(.45,.48,.48);
        // The bank of shallow drawers faces the aisle.
        if(q.y>.17&&q.y<.94&&site.z>17.65&&site.z<26.45&&abs(n.z)>.60){
          float row=fract((q.y-.17)*7.4);
          c*=1.-.40*(1.-smoothstep(.035,.11,row));
          if(row>.71&&row<.88&&q.x>.14&&q.x<.86)c=vec3(.26,.29,.29);
        }
      }else if(style==21.){
        c=q.y<.105?vec3(.13,.15,.16):vec3(.37,.41,.41);polish=.12;
      }else if(style==22.){
        c=vec3(.75,.77,.72);
        float front=smoothstep(.62,.86,n.x);
        if(front>.01){
          float row=fract((site.y+23.648)/.27);
          c*=1.-front*.52*(1.-smoothstep(.03,.09,row));
          c=mix(c,vec3(.20,.22,.21),front*rectangle(vec2(site.z-19.85,row-.54),vec2(.094,.088)));
        }
        if(abs(n.z)>.75&&q.y>.65)c=mix(c,vec3(.29,.32,.32),.45);
        if(q.y>.94&&abs(n.y)>.65)c=mix(c,vec3(.21,.25,.25),.45);
      }else{
        c=q.y>.945?vec3(.11,.12,.095):vec3(.25,.31,.29);
        if(q.y>.103&&q.y<.157)c*=.52;
      }
      gl_FragColor=vec4(c*light+polish*rim,1.);
    }`});
  return [hall,frames,billboard,workstationMaterial];
}
function commandPlants(planters){
  const p=[],uv=[],index=[];
  // Leaf positions and silhouettes are estimates. The two pot rims come from
  // the source mesh and retain their native collision.
  for(const [plant,[x,y,z]] of planters.entries())for(let leaf=0;leaf<12;leaf++){
    const angle=leaf*2.39996+plant*1.4,c=Math.cos(angle),s=Math.sin(angle);
    const outer=leaf/11,height=1.38-.67*outer+.055*Math.sin(leaf*4.);
    const reach=.13+.42*outer,width=.055+.061*outer;
    const start=p.length/3;
    for(let step=0;step<=10;step++){
      const t=step/10,blade=Math.pow(Math.max(.0001,Math.sin(Math.PI*t)),.83);
      const w=width*blade*Math.min(1,t*5),d=.025+reach*t*t;
      for(const side of [-1,0,1]){
        const offset=side*w;
        p.push(x+c*d-s*offset,y+height*t+.12*Math.sin(t*Math.PI)-.032*blade*Math.abs(side),z+s*d+c*offset);
        uv.push(side,t);
      }
      if(!step)continue;
      const a=start+(step-1)*3;
      for(let j=0;j<2;j++)index.push(a+j,a+j+1,a+j+4,a+j,a+j+4,a+j+3);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(index);
  const mat=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},
    vertexShader:`varying vec2 blade;varying vec3 site;void main(){blade=uv;site=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 blade;varying vec3 site;void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site)));float x=abs(blade.x),y=blade.y;
      vec3 leaf=mix(vec3(.072,.135,.085),vec3(.14,.23,.14),y);
      leaf*=.76+.24*abs(dot(n,normalize(vec3(.53,.59,.68))));
      float vein=1.-smoothstep(.003,.05,abs(fract(y*13.-x*.65)-.5));
      leaf+=vec3(.023,.029,.017)*(vein*(1.-x)+2.*(1.-smoothstep(.015,.062,x)));
      gl_FragColor=vec4(leaf,1.);
    }`});
  return new THREE.Mesh(geo,mat);
}
async function installCommandRoom(){
  const [source,texture]=await Promise.all([jsonFile('command-screens.json'),new THREE.TextureLoader().loadAsync('data/command-finish.webp')]);
  const positions=[],paint=[],indices=[];
  for(const [dx,style] of source.copies){
    const start=positions.length/3;
    for(let i=0;i<source.positions.length;i+=3){
      positions.push(source.positions[i]+dx,source.positions[i+1],source.positions[i+2]);
      paint.push(source.paint[i],source.paint[i+1],source.paint[i+2],style);
    }
    for(const index of source.indices)indices.push(start+index);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('freightCoord',new THREE.Uint8BufferAttribute(paint,4,true));geo.setIndex(indices);
  scene.add(new THREE.Mesh(geo,workstationMaterial));
  scene.add(commandPlants(source.planters));
  texture.flipY=false;texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
  commandPaint.finish.value=texture;commandPaint.ready.value=1;dirty=true;
}
