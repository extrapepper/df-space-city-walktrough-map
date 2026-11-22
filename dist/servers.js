'use strict';
const serverFinish={serverAtlas:{value:null},serverReady:{value:0}};
const terminalTrays=[];
const serverSamples=`
  uniform sampler2D serverAtlas;uniform float serverReady;
  vec3 rackPatch(float tile,vec2 uv,vec3 base){
    vec2 cell=vec2(mod(tile,4.),floor(tile/4.));
    vec2 px=cell*vec2(256.,512.)+4.5+clamp(uv,0.,1.)*vec2(247.,503.);
    return serverReady>.5?texture2D(serverAtlas,px/vec2(1024.,1536.)).rgb:base;
  }`;
const serverRoomShader=`
  vec3 serverRoom(vec3 p,vec3 n){
    float h=p.y+23.648;
    float entrance=1.-smoothstep(68.9,75.7,p.x);
    vec3 cool=mix(vec3(.71,.78,1.),vec3(.98,1.,.96),entrance);
    float panelX=seam((p.x-68.65)/1.58,.006),panelZ=seam((p.z-21.95)/1.45,.006);
    if(h<.20&&abs(n.y)>.65){
      vec3 floor=mix(vec3(.32,.37,.45),vec3(.59,.60,.57),entrance);
      float darkBorder=smoothstep(3.18,3.26,abs(p.z-21.95));
      float underRack=rectangle(p.xz-vec2(77.96,21.96),vec2(1.01,2.24))+
                      rectangle(p.xz-vec2(83.26,21.94),vec2(1.01,2.24));
      vec2 slab=vec2((p.x-68.65)/1.58,(p.z-21.95)/1.45);
      float grain=rackPatch(10.,repeatTile(slab),vec3(.5)).g;
      float corner=length(abs(fract(slab+.5)-.5)-vec2(.035));
      floor*=.58+.90*grain;
      float seamShade=.29*max(panelX,panelZ)+.23*(1.-smoothstep(.012,.021,corner));
      return floor*cool*(1.-seamShade)*(1.-.38*max(darkBorder,min(underRack,1.)));
    }
    if(h>3.33&&abs(n.y)>.65){
      float d=abs(p.z-21.96);
      vec3 ceiling=vec3(.56,.59,.64)*cool*(1.-.25*max(panelX,panelZ));
      if(d<.92){
        float mesh=rackPatch(5.,repeatTile(p.xz*1.5),vec3(.17)).g;
        vec3 grille=vec3(.14,.16,.18)*(.7+1.8*mesh);
        if(d>.84||seam((p.x-68.65)/.92,.018)>.5)grille=vec3(.18,.21,.24);
        return grille;
      }
      float fixture=abs(fract((p.x-80.31)/3.15+.5)-.5)*3.15;
      float strip=1.-smoothstep(.025,.046,fixture);
      float rim=1.-smoothstep(.044,.064,fixture);
      float lengthMask=1.-smoothstep(.91,.95,abs(d-3.08));
      ceiling=mix(ceiling,vec3(.15,.19,.23),rim*lengthMask);
      return mix(ceiling,vec3(.84,.93,1.),strip*lengthMask);
    }
    float u=abs(n.x)>.60?p.z:p.x;
    vec3 wall=h<2.42?vec3(.26,.50,.27):vec3(.66,.70,.70);
    if(h<.16)wall=vec3(.15,.19,.20);
    wall*=1.-.22*max(seam((u-.37)/1.74,.0035),seam((h-.92)/1.50,.004));
    float indirect=.75+.10*smoothstep(.08,1.9,h)+.12*entrance+.09*cos((p.x-80.31)*1.82)*smoothstep(1.8,3.7,h);
    return wall*cool*indirect;
  }
  vec3 portalFinish(vec3 p,vec3 n,vec3 base){
    float z=abs(p.z-21.96),h=p.y+23.648;
    if(p.x<68.27||p.x>68.71||abs(n.y)>.6||h<.015)return base;
    if(z<.86&&h>2.91&&h<2.948)return vec3(.44,.51,.50);
    if((z<1.615&&h>2.53&&h<3.22)||(z>1.419&&z<1.615&&h<=2.56))
      return vec3(.115,.14,.15)*(.83+.17*abs(n.x));
    return base;
  }`;
function makeServerEquipment(){
  new THREE.TextureLoader().load('data/server-finish.webp',t=>{
    t.flipY=false;t.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());t.needsUpdate=true;
    serverFinish.serverAtlas.value=t;serverFinish.serverReady.value=1;dirty=true;
  },undefined,e=>console.warn('服务器机柜材质加载失败',e));
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},uniforms:serverFinish,
    vertexShader:`attribute vec4 freightCoord;varying vec4 coord;varying vec3 site;
      void main(){coord=freightCoord;site=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec4 coord;varying vec3 site;${serverSamples}
    float edgeLine(float x,float w){return 1.-smoothstep(w,w+clamp(fwidth(x),.001,.04),abs(x));}
    void main(){
      float kind=floor(coord.w*255.+.5);vec3 q=coord.xyz;
      vec3 ax=abs(cross(dFdx(q),dFdy(q))),n=normalize(cross(dFdx(site),dFdy(site)));
      bool side=ax.x>ax.z&&ax.x>ax.y,top=ax.y>max(ax.x,ax.z);
      vec2 uv=top?q.xz:vec2(side?(q.x>.5?q.z:1.-q.z):(q.z>.5?q.x:1.-q.x),1.-q.y);
      vec3 steel=vec3(.13,.17,.23);
      vec3 color=rackPatch(3.,uv,steel)*.89;
      float shine=.085;
      if(kind==24.||kind==25.||kind==26.){
        if(top){
          color=steel*(.86+.14*cos(q.x*24.));
        }else if(side){
          color=rackPatch(site.x<0.?2.:9.,uv,steel);
        }else if(kind==26.){
          float x=min(q.x,1.-q.x);
          if(x>.018&&x<.16&&q.y>.07&&q.y<.91){
            vec2 panel=vec2((x-.018)/.142,(.91-q.y)/.84);
            color=rackPatch(1.,panel,steel);shine=.032;
          }else if(x>.247&&x<.416&&q.y>.23&&q.y<.87){
            vec2 panel=vec2((x-.247)/.169,(.87-q.y)/.64);
            color=rackPatch(8.,panel,steel);shine=.035;
          }else if(q.y>.94)color*=.69;
        }else if(kind==24.){
          if(q.z>.50&&q.x>.239&&q.x<.762&&q.y>.18&&q.y<.925){
            color=rackPatch(0.,vec2((q.x-.239)/.523,(.925-q.y)/.745),steel);shine=.035;
          }else if(q.z<.5)color=rackPatch(7.,uv,steel)*.60;
          if(q.y>.93&&(q.x<.23||q.x>.77))color*=.67+.26*smoothstep(.30,.60,fract(q.x*120.));
        }else if(q.z>.50&&q.x>.075&&q.x<.925&&q.y>.09&&q.y<.931){
          color=rackPatch(1.,vec2((q.x-.075)/.85,(.931-q.y)/.841),steel);shine=.035;
        }
        if(!top)color*=.86+.14*smoothstep(0.,.075,q.y);
      }else if(kind==27.){
        color=!top&&!side&&q.z>.5?rackPatch(4.,uv,steel):vec3(.095,.11,.12)*(.87+.13*q.y);
      }else if(kind==28.){
        color=rackPatch(6.,vec2(uv.x,fract((1.-q.y)*7.)),steel);
        color=mix(color,vec3(.34,.40,.46),.54);
        color*=.84+.16*cos(q.y*220.);shine=.04;
      }else if(kind==31.){
        color=vec3(.28,.31,.32);
      }else{
        float edge=min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y));
        color=mix(vec3(.31,.33,.32),vec3(.10,.13,.14),smoothstep(.015,.044,edge));
        if(!top&&kind==29.)color+=.023*edgeLine(fract(uv.x*4.)-.5,.05);
      }
      vec3 v=normalize(cameraPosition-site);
      float gloss=pow(1.-abs(dot(n,v)),3.);
      vec3 reflection=vec3(.51,.67,.86)*shine*gloss;
      gl_FragColor=vec4(color*(.96+.105*dot(n,normalize(vec3(.17,.83,.52))))+reflection,1.);
    }`});
}
function makeLabServerRoom(){
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},vertexShader:trainingVertex,
    uniforms:serverFinish,fragmentShader:`varying vec3 site;${serverSamples}
    float joint(float t,float w){return 1.-smoothstep(w,w+clamp(fwidth(t),.001,.035),abs(fract(t+.5)-.5));}
    void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site)));
      bool h1=site.x<0.;float along=site.x+(h1?69.59:-42.73),across=site.z-(h1?6.92:-40.68),h=site.y+20.128;
      float panel=max(joint(along/1.28,.005),joint(across/1.26,.005));
      vec3 c;float edge=abs(across);
      if(h<.27&&abs(n.y)>.64){
        c=mix(vec3(.255,.29,.32),vec3(.135,.15,.16),smoothstep(.96,1.01,edge));
        c*=1.-.31*panel;
        c+=vec3(.12,.038,.028)*exp(-.35*pow(along-(h1?13.4:20.7),2.))*(1.-smoothstep(.3,1.9,edge));
      }else if(h>3.3&&abs(n.y)>.6){
        c=vec3(.35,.39,.44)*(1.-.27*panel);
        if(edge<.74){
          c=rackPatch(5.,fract(site.xz*1.2),vec3(.15))*.86;
          if(joint(along/.9,.019)>.5||edge>.68)c=vec3(.16,.18,.20);
        }else if(edge>.95&&edge<2.56){
          float light=joint((along-.1)/2.56,.008);
          c=mix(c,vec3(.84,.90,.95),light);
        }
      }else{
        float u=abs(n.x)>.65?across:along;
        c=h<1.45?vec3(.23,.28,.32):vec3(.41,.46,.49);
        if(h<.16)c=vec3(.12,.14,.15);
        c*=1.-.22*max(joint(u/1.36,.004),joint((h-.92)/1.54,.005));
      }
      gl_FragColor=vec4(c*(.92+.09*dot(n,normalize(vec3(.4,.76,.5)))),1.);
    }`});
}
function installRackDetails(){
  const boxes=[];
  const box=(x,y,z,w,h,d,color)=>boxes.push([x,y,z,w,h,d,color]);
  // Cabinet tops in the two H4 banks are 2.99 m above the floor. Cable
  // frames are sized from the photographs and stop below the native ceiling.
  for(const [x,z,length,base] of [[77.96,21.96,3.93,-20.659],[83.26,21.93,3.93,-20.659],
      [73.13,22.08,3.04,-20.78],[80.69,17.74,1.32,-20.59],[84.91,17.74,1.32,-20.59]]){
    for(const dx of [-.26,.26]){
      box(x+dx,base+.30,z,.038,.055,length,0x344151);
      for(const dz of [-.36,.36])box(x+dx,base+.145,z+length*dz,.031,.29,.036,0x28333f);
    }
    for(const dz of [-.43,0,.43])box(x,base+.305,z+length*dz,.56,.037,.043,0x49525d);
  }
  // Card reader on the server side of the opening.
  box(68.711,-21.885,20.095,.055,.41,.15,0x202826);
  box(68.741,-21.78,20.095,.008,.032,.099,0xa7ebb2);
  box(68.741,-21.90,20.095,.008,.049,.052,0x8ce899);
  const hardware=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff}),boxes.length);
  const m=new THREE.Matrix4(),color=new THREE.Color();
  boxes.forEach(([x,y,z,w,h,d,c],i)=>{m.makeScale(w,h,d);m.setPosition(x,y,z);hardware.setMatrixAt(i,m);hardware.setColorAt(i,color.setHex(c))});
  hardware.computeBoundingSphere();scene.add(hardware);
  const paths=[
    [0xb59443,[[77.40,20.05],[77.26,19.59],[77.02,19.39],[77.44,19.02],[79.50,18.99],[80.24,18.69],[80.50,18.33]]],
    [0x49525b,[[80.74,18.39],[80.91,18.80],[82.14,19.08],[83.21,18.93],[83.89,19.26],[83.92,20.41]]],
    [0xb19a4d,[[83.92,23.74],[84.18,24.05],[83.82,24.37],[81.71,24.50],[80.81,24.34],[79.01,24.48],[78.67,24.03]]]
  ];
  for(const [c,points] of paths){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,-23.628,z)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve,points.length*5,.014,5,false),new THREE.MeshBasicMaterial({color:c})));
  }
}
async function installRackTerminals(){
  const frames=await jsonFile('server-terminals.json');
  const body=new THREE.MeshBasicMaterial({color:0x253138}),edge=new THREE.MeshBasicMaterial({color:0x58606a});
  const panel=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:serverFinish,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;${serverSamples}void main(){gl_FragColor=vec4(rackPatch(11.,vec2(vUv.x,1.-vUv.y),vec3(.65,.91,.95)),1.);}`});
  const keys=new THREE.ShaderMaterial({side:THREE.DoubleSide,extensions:{derivatives:true},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;void main(){
      vec2 t=vUv*vec2(15.,5.),g=abs(fract(t)-.5),aa=fwidth(t);
      float ink=(1.-smoothstep(.35,.35+aa.x,g.x))*(1.-smoothstep(.30,.30+aa.y,g.y));
      gl_FragColor=vec4(mix(vec3(.12,.15,.17),vec3(.23,.27,.28),ink),1.);
    }`});
  const trayShape=new THREE.BoxGeometry(.415,.045,.216),housing=new THREE.BoxGeometry(.405,.205,.037);
  const screen=new THREE.PlaneGeometry(.352,.152),keyboard=new THREE.PlaneGeometry(.35,.139);
  for(const f of frames){
    const root=new THREE.Group();
    const axis=a=>new THREE.Vector3().fromArray(a);
    root.matrix.makeBasis(axis(f.right),axis(f.up),axis(f.front)).setPosition(axis(f.foot));root.matrixAutoUpdate=false;
    const tray=new THREE.Mesh(trayShape,edge);tray.position.set(0,1.27,.105);
    const cover=new THREE.Mesh(housing,body);cover.position.set(0,1.403,.026);cover.rotation.x=-.095;
    const lcd=new THREE.Mesh(screen,panel);lcd.position.z=.0195;cover.add(lcd);
    const deck=new THREE.Mesh(keyboard,keys);deck.rotation.x=-Math.PI/2;deck.position.set(0,1.294,.119);
    root.add(tray,cover,deck);scene.add(root);root.updateMatrixWorld(true);
    terminalTrays.push({mesh:tray,bounds:new THREE.Box3().setFromObject(tray)});
  }
  dirty=true;
}
