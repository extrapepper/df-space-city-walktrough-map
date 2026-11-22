'use strict';
const suitePaint={finish:{value:null},ready:{value:0}};
function makeSuiteMaterials(){
  const shared=`
    varying vec3 p;
    uniform sampler2D finish;
    uniform float ready;
    vec3 suiteSample(vec2 origin,vec2 size,vec2 uv,vec3 fallback){
      vec2 pixel=origin+.5+clamp(uv,0.,1.)*(size-1.);
      return ready>.5?texture2D(finish,pixel/vec2(1536.,1024.)).rgb:fallback;
    }
    float line(float u,float width){return 1.-smoothstep(width,width+max(fwidth(u),.001),abs(fract(u+.5)-.5));}
    vec2 mirrored(vec2 v){return 1.-abs(2.*fract(v*.5)-1.);}
    vec3 grain(vec2 cell,vec2 uv,vec3 fallback){return suiteSample(cell,vec2(248.),mirrored(uv),fallback);}
    float insideRect(vec2 v){return min(min(v.x,v.y),min(1.-v.x,1.-v.y));}
    vec3 decal(vec3 base,vec2 origin,vec2 size,vec2 uv){
      return mix(base,suiteSample(origin,size,uv,base),smoothstep(0.,.012,insideRect(uv)));
    }
  `;
  const material=(body,transparent=false,packed=false)=>new THREE.ShaderMaterial({
    uniforms:suitePaint,side:THREE.DoubleSide,extensions:{derivatives:true},
    transparent,depthWrite:!transparent,forceSinglePass:true,
    vertexShader:(packed?'attribute vec4 freightCoord;varying vec3 q;':'')+'varying vec3 p;void main(){p=position;'+(packed?'q=freightCoord.xyz;':'')+'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:(packed?'varying vec3 q;':'')+shared+'void main(){vec3 n=normalize(cross(dFdx(p),dFdy(p)));'+body+'}'
  });
  const hall=material(`
    float dx=p.x-1.13,dz=p.z+16.9,h=p.y+9.574;
    bool wallX=abs(n.x)>abs(n.z);vec2 plane=vec2(wallX?p.z:p.x,p.y);
    vec3 c;
    if(abs(n.y)>.70&&p.y> -5.10){
      float across=abs(dx);
      c=grain(vec2(1028.,260.),p.xz/vec2(2.8,4.5),vec3(.22,.18,.14))*.89;
      if(across<1.72)c=vec3(.40,.38,.34);
      float channel=abs(across-1.53);
      if(channel<.099)c=vec3(.098,.083,.062);
      float spot=length(vec2(channel,abs(fract(p.z/.58+.5)-.5)*.58));
      c=mix(c,vec3(.99,.93,.80),1.-smoothstep(.042,.061,spot));
      c+=vec3(.42,.30,.17)*exp(-12.*abs(across-1.82));
      if(p.z< -23.&&across<2.7)c=mix(c,vec3(.94,.95,.91),line(dx/.49,.026));
      // The big square fixtures hang over both seating groups.
      if(abs(across-10.17)<1.52&&abs(p.z+21.55)<1.53)c=vec3(.82,.84,.80);
    }else if(p.y< -8.35&&abs(n.y)>.70){
      vec2 uv=p.xz/1.28;
      c=grain(vec2(1028.,516.),uv*.63,vec3(.23,.23,.22))*.87;
      c*=1.-.26*max(line(uv.x,.003),line(uv.y,.003));
      if(p.z> -11.3&&abs(dx)<3.60)c=grain(vec2(1284.,516.),p.xz*.68,vec3(.24,.19,.15))*.92;
      if(p.z< -22.8&&p.z> -29.4&&abs(abs(dx)-10.6)<4.26){
        float edge=min(4.26-abs(abs(dx)-10.6),min(p.z+29.4,-22.8-p.z));
        c=edge<.09?vec3(.52,.43,.28):vec3(.20,.225,.235)*(.80+.35*c);
      }
    }else{
      c=grain(vec2(1028.,4.),plane/1.8,vec3(.20,.17,.15));
      c*=.73+.18*smoothstep(0.,4.,h);
      c*=1.-.27*max(line(plane.x/2.8,.0025),line(h/2.30,.003));
      bool planter=p.z> -12.0&&p.z< -8.75&&abs(dx)>3.6&&p.y< -7.65;
      if(planter){
        if(abs(n.y)>.85&&p.z> -10.98&&p.z< -9.20)c=vec3(.18,.16,.115);
        else if(abs(p.y+7.73)<.055)c=vec3(.46,.34,.17);
      }
      if(wallX&&abs(dx)>16.55&&abs(dx)<17.4){
        float a=abs(dz);
        if(a<3.60&&p.y< -5.89&&(a>3.20||p.y> -6.26))c=vec3(.40,.32,.19);
        if(a<.68&&abs(p.y+5.90)<.028)c=vec3(1.,.95,.80);
        float u=(p.x>0.?dz:-dz)/2.16+.5;
        c=decal(c,vec2(p.x>0.?240.:425.,477.),vec2(p.x>0.?170.:172.,76.),vec2(u,(-5.05-p.y)/.82));
      }
      if(abs(p.z+8.63)<.25&&!wallX){
        float a=abs(dx);
        if(a<1.72&&p.y< -5.27&&(a>1.40||p.y> -5.86))c=vec3(.46,.35,.20);
        c=decal(c,vec2(240.,384.),vec2(400.,76.),vec2(.5-dx/3.47,(-5.17-p.y)/.68));
        if(a>3.6&&a<13.4&&abs(p.y+4.77)<.185){
          c=vec3(.13,.13,.12)+.065*line(p.y/.055,.10);
          if(line(dx/1.45,.013)>.5)c=vec3(.36,.34,.30);
        }
        if(a>3.8&&a<12.7&&p.y< -5.25&&p.y> -7.32){
          float rings=length(vec2(a-4.18,(p.y+6.35)*1.04));
          c+=vec3(.15,.12,.053)*line(rings/.115,.058)*(1.-smoothstep(.1,1.9,rings));
        }
      }
      if(abs(dx)<2.52&&p.z< -19.55&&p.z> -22.20&&n.z>.45){
        c=grain(vec2(1284.,4.),plane/2.4,vec3(.15,.135,.12));
        if(abs(abs(dx)-1.37)<.025)c=vec3(.59,.45,.27);
        vec2 uv=vec2(dx/1.83+.5,(-5.42-p.y)/2.46);
        vec3 mark=suiteSample(vec2(4.,384.),vec2(222.,310.),uv,c);
        c=mix(c,mark,smoothstep(0.,.012,insideRect(uv))*smoothstep(.18,.48,mark.r));
      }
    }
    vec3 eye=normalize(cameraPosition-p);
    float rim=pow(1.-abs(dot(eye,n)),3.);
    float sheen=pow(max(0.,dot(reflect(-eye,n),normalize(vec3(.14,.82,.56)))),20.);
    gl_FragColor=vec4(c*(.92+.09*max(0.,n.y))+.038*rim+.080*sheen,1.);
  `);
  const seating=material(`
    bool sideSofa=p.x< -12.53||p.x>14.89;
    float s=sideSofa?p.z:p.x;
    vec3 leather=grain(vec2(1284.,260.),vec2(s*2.1,p.y*3.2+p.z*.38),vec3(.49,.29,.20));
    float h=p.y+9.57;
    float crease=line((s+(sideSofa?25.6:10.6))/1.12,.005);
    leather*=vec3(.89,.76,.65)*(.76+.28*abs(n.y));
    leather*=1.-.30*crease*smoothstep(.35,.53,h);
    if(h<.12)leather=vec3(.13,.12,.108);
    vec3 eye=normalize(cameraPosition-p);
    vec3 gloss=reflect(-eye,n);
    gl_FragColor=vec4(leather+.095*pow(max(0.,dot(gloss,normalize(vec3(.27,.90,-.33)))),10.),1.);
  `);
  const coffee=material(`
    float top=smoothstep(-9.13,-9.10,p.y);
    vec3 tint=mix(vec3(.33,.26,.17),vec3(.51,.60,.59),top);
    float grazing=pow(1.-abs(dot(n,normalize(cameraPosition-p))),2.);
    gl_FragColor=vec4(tint+grazing*.16,mix(1.,.32+.40*grazing,top));
  `,true);
  const displays=material(`
    bool east=p.x>0.;float width=east?12.86:12.85;
    vec2 uv=vec2((p.x-(east?4.53:-15.01))/width,(-6.41-p.y)/2.29);
    vec3 c=vec3(.093,.09,.078);
    if(abs(n.z)>.85&&p.z> -29.73&&insideRect(uv)>.007)
      c=suiteSample(vec2(4.,east?4.:192.),vec2(1008.,180.),uv,vec3(.71,.73,.70));
    gl_FragColor=vec4(c,1.);
  `);
  const corridor=material(`
    float h=p.y+9.569;
    bool wallX=abs(n.x)>abs(n.z);
    float u=wallX?p.z:p.x;
    vec3 c;
    if(abs(n.y)>.72&&h<.30){
      c=vec3(.57,.59,.58)*(.77+.68*grain(vec2(1028.,516.),p.xz*.64,vec3(.30)).g);
      c*=1.-.20*max(line(p.x/1.24,.004),line(p.z/1.24,.004));
      float edge=p.x>0.?abs(p.x-24.66):abs(p.x+22.39);
      if(edge<.21)c=mix(vec3(.25,.28,.28),vec3(.16,.18,.17),line(p.z/.12,.28));
    }else if(abs(n.y)>.72){
      c=vec3(.46,.48,.48)*(1.-.25*max(line(p.z/2.4,.004),line(p.x/1.34,.005)));
      float lamp=line((p.z+.72)/3.12,.025);
      if(abs(abs(p.x-1.13)-25.25)<.96)c=mix(c,vec3(.85,.90,.84),lamp);
    }else{
      c=mix(vec3(.59,.61,.59),vec3(.75,.76,.73),smoothstep(.2,3.,h));
      c*=1.-.12*max(line(u/1.55,.003),line((h-.48)/2.27,.004));
      if(h<.19)c=vec3(.19,.22,.22);
      if(abs(h-3.64)<.13)c=vec3(.17,.19,.19)+.08*line(h/.045,.13);
      if(wallX&&abs(abs(p.x-1.13)-23.52)<.22)c=vec3(.38,.40,.39);
    }
    gl_FragColor=vec4(c*(.89+.11*abs(n.y)),1.);
  `);
  const crates=material(`
    vec3 a=abs(cross(dFdx(q),dFdy(q)));
    bool top=a.y>max(a.x,a.z);
    vec2 uv=top?q.xz:vec2(a.x>a.z?(q.x>.5?1.-q.z:q.z):(q.z>.5?q.x:1.-q.x),1.-q.y);
    vec3 c=suiteSample(top?vec2(428.,740.):vec2(4.,740.),top?vec2(368.,276.):vec2(412.,276.),uv,vec3(.66,.65,.60));
    gl_FragColor=vec4(c*(.95+.11*n.y),1.);
  `,false,true);
  return [hall,seating,coffee,displays,corridor,crates];
}
function suitePalms(centers){
  const positions=[],colors=[],index=[];
  function vertex(x,y,z,brightness){
    positions.push(x,y,z);colors.push(.12*brightness,.204*brightness,.081*brightness);
  }
  for(const [j,[x,y,z]] of centers.entries())for(let frond=0;frond<7;frond++){
    const a=j*1.7+frond*2.40,c=Math.cos(a),s=Math.sin(a);
    const height=1.0+.28*Math.sin(a*2.4),length=.72+.25*Math.cos(a*1.6);
    const arc=t=>[x+c*length*t,y+height*(1.70*t-.98*t*t),z+s*length*t];
    const root=positions.length/3;
    for(let i=0;i<=12;i++){
      const q=arc(i/12);
      for(const side of [-1,1])vertex(q[0]-s*side*.011,q[1],q[2]+c*side*.011,1.54);
      if(i){const k=root+2*i;index.push(k-2,k-1,k,k-1,k+1,k);}
    }
    for(let i=2;i<=12;i++)for(const side of [-1,1]){
      const t=i/13,q=arc(t),next=arc(t+.038);
      const w=.21*Math.sin(Math.PI*t)+.045,idx=positions.length/3;
      const brightness=.93+.30*Math.sin(i+j)+.32*t;
      vertex(...q,brightness);
      vertex(q[0]+c*.07-side*s*w*.5,q[1]+.015,q[2]+s*.07+side*c*w*.5,brightness*1.21);
      vertex(q[0]+c*.20-side*s*w,q[1]-.078,q[2]+s*.20+side*c*w,brightness*.86);
      vertex(...next,brightness);
      index.push(idx,idx+1,idx+2,idx,idx+2,idx+3);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(index);
  return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
}
function corridorMark(east){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=320;
  const ctx=canvas.getContext('2d');
  ctx.save();ctx.translate(384,111);
  ctx.strokeStyle=east?'#558044':'#417c9c';ctx.lineWidth=13;
  if(east){
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3+.15;ctx.beginPath();ctx.arc(0,0,64,a,a+1.68);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(0,0,36,0,Math.PI*2);ctx.stroke();
  }else{
    ctx.rotate(Math.PI/4);ctx.strokeRect(-48,-48,96,96);ctx.rotate(-Math.PI/4);
    ctx.lineWidth=7;
    for(const y of [-13,7,27]){
      ctx.beginPath();ctx.moveTo(-35,y);ctx.lineTo(-14,y-6);ctx.lineTo(4,y+3);ctx.lineTo(19,y-3);ctx.lineTo(32,y);ctx.stroke();
    }
  }
  ctx.restore();ctx.fillStyle='#343d3a';ctx.textAlign='center';ctx.font='bold 38px Arial,sans-serif';
  ctx.fillText(east?'SPACE CHAMBER':'BUOYANCY LAB',364,235);ctx.fillStyle='#957137';ctx.fillText('»',573,235);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.05,1.69),new THREE.MeshBasicMaterial({
    map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1
  }));
  mesh.position.set(east?28.673:-26.407,-7.64,-16.90);
  mesh.rotation.y=east?-Math.PI/2:Math.PI/2;
  return mesh;
}
async function installSuite(){
  const shrubs=[],palms=[];
  for(const side of [-1,1]){
    for(let i=0;i<17;i++){
      const x=1.13+side*(4.04+.52*i),z=-10.24+.39*Math.sin(i*2.7);
      shrubs.push([x,-7.83,z]);
      if(i%3===1)palms.push([x,-7.75,z+.13]);
    }
  }
  scene.add(commandPlants(shrubs),suitePalms(palms),corridorMark(false),corridorMark(true));
  const texture=await new THREE.TextureLoader().loadAsync('data/suite-finish.webp');
  texture.flipY=false;texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());
  texture.needsUpdate=true;suitePaint.finish.value=texture;suitePaint.ready.value=1;dirty=true;
}
