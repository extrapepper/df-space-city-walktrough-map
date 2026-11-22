'use strict';
const foyerPaint={finish:{value:null},ready:{value:0},suitEye:{value:new THREE.Vector3()},
  suitAxes:{value:new THREE.Matrix3()},suitScale:{value:new THREE.Vector2()},suitBias:{value:new THREE.Vector2()},suitShear:{value:0}};
let foyerBounds;
const foyerBarriers=[];
const exhibitFrames=Array.from({length:3},()=>new THREE.Matrix4());
function makeFoyerMaterials(){
  const fragmentShader=`varying vec3 site;uniform sampler2D finish;uniform float ready,kind,suitShear;
    uniform vec3 suitEye;uniform mat3 suitAxes;uniform mat4 exhibitFrame;uniform vec2 suitBias,suitScale;
    float line(float x,float w){return 1.-smoothstep(w,w+max(.002,fwidth(x)),abs(x));}
    float joint(float x,float w){return 1.-smoothstep(w,w+clamp(fwidth(x),.001,.10),abs(fract(x+.5)-.5));}
    vec2 tile(vec2 p){return 1.-abs(mod(p,2.)-1.);}
    vec3 samplePatch(vec2 corner,vec2 size,vec2 uv,vec3 base){
      if(ready<.5)return base;
      return texture2D(finish,(corner+.5+(size-1.)*clamp(uv,0.,1.))/vec2(1024.,512.)).rgb;
    }
    float inside(vec2 p){return step(0.,min(p.x,p.y))*step(max(p.x,p.y),1.);}
    float stencil(vec2 uv,vec2 corner,vec2 size){
      return inside(uv)*samplePatch(corner,size,uv,vec3(0.)).r;
    }
    vec3 brushed(vec3 n,vec3 color){
      vec3 v=normalize(cameraPosition-site),reflection=reflect(-v,n);
      float edge=pow(1.-abs(dot(n,v)),2.7);
      return color*(.75+.22*max(0.,n.y)+.27*smoothstep(-.2,.72,reflection.y))+.09*edge;
    }
    vec3 foyerHall(vec3 n){
      vec3 p=site;float h=p.y+30.368;
      vec3 lightStone=vec3(.64,.67,.66),green=vec3(.25,.43,.19),trim=vec3(.13,.17,.16);
      if(h<.28&&abs(n.y)>.7){
        vec2 uv=tile(p.xz*.39);
        float grain=samplePatch(vec2(408.,301.),vec2(188.,207.),uv,lightStone).g;
        vec3 deck=lightStone*(.76+.46*grain);
        float seam=max(joint((p.x-56.48)/1.45,.0028),joint((p.z-27.36)/1.45,.0028));
        deck*=1.-.28*seam;
        float border=max(abs((p.x-69.19)/10.89),abs((p.z-36.65)/6.20));
        if(abs(border-1.)<.039||abs(border-1.10)<.008)deck=trim;
        vec2 mat=abs(vec2(abs(p.x-69.66)-6.35,p.z-38.51))-vec2(2.54,1.24);
        if(max(mat.x,mat.y)<0.)deck=trim;
        float daylight=exp(-.08*abs(45.55-p.z))*smoothstep(64.,68.,p.x)*(1.-smoothstep(78.,82.,p.x));
        float mullion=1.-.29*joint((p.x+.62*(45.55-p.z)-65.70)/3.78,.027);
        return deck+vec3(.24,.23,.19)*daylight*mullion;
      }
      if(abs(n.y)>.64)return h<.4?lightStone:vec3(.41,.45,.43);
      bool side=abs(n.x)>.65;float u=side?p.z:p.x;
      float grain=samplePatch(vec2(4.,301.),vec2(188.,207.),tile(vec2(u,h)*.36),lightStone).g;
      vec3 wall=(h<6.4?vec3(.68,.69,.65):vec3(.48,.53,.50))*(.84+.34*grain);
      if(side&&p.x<57.32){
        if(p.z>34.70&&p.z<40.96){
          vec2 panel=vec2((40.96-p.z)/6.26,h/11.78);
          float diagonal=panel.y+.47*panel.x;
          vec3 mint=vec3(.52,.76,.59);
          wall=green*(.96+.10*grain);
          if(diagonal>.19&&diagonal<.45)wall=mint;
          if(diagonal<.19)wall=trim;
          if(panel.y>.66){
            if(panel.x<.50)wall=diagonal<.91?mint:trim;
            else if(panel.y<.81+.31*(panel.x-.5))wall=mint;
          }
          vec2 mark=vec2((37.32-p.z)/2.49,(-26.50-p.y)/1.21);
          wall=mix(wall,vec3(.095,.14,.12),stencil(mark,vec2(208.,4.),vec2(328.,154.)));
        }else if(p.z>29.25&&p.z<34.67){
          if(h<3.78)wall=trim;
          vec2 mark=vec2((33.42-p.z)/2.47,(-26.01-p.y)/.38);
          wall=mix(wall,trim,stencil(mark,vec2(207.,166.),vec2(385.,78.)));
        }
      }
      if(!side&&p.z<28.1&&p.x>56.49&&p.x<81.22){
        float g=samplePatch(vec2(610.,301.),vec2(188.,207.),tile(p.xy*.29),green).g;
        if(h<6.28)wall=green*(.78+.37*g);
        if(h<.78)wall=trim;
      }
      if(side&&p.x>85.1&&p.z>36.5&&p.z<44.4&&h>1.9&&h<3.7)
        wall=mix(wall,vec3(.37,.47,.49),.36);
      if(p.z>45.02&&h>0.)wall=mix(wall,trim,.30);
      wall*=1.-.19*max(joint((u-.55)/2.54,.003),joint(h/2.55,.003));
      if(h<.16)wall=trim;
      return wall;
    }
    vec3 suit(vec3 position,vec3 n){
      vec3 p=position-vec3(63.39,-29.32,38.44);
      bool pack=p.z<-.235;vec3 white=vec3(.75,.76,.70),rubber=vec3(.12,.14,.14);
      float fabric=samplePatch(vec2(206.,301.),vec2(188.,207.),tile(vec2(p.z+p.x,p.y)*4.),white).g;
      vec3 coat=white*(.88+.23*fabric-.06*joint(p.y*9.+p.x*2.,.08));
      if(pack){coat=mix(white,vec3(.59,.60,.55),.55);if(abs(p.x)>.28&&p.y>1.1&&p.y<1.60)coat=rubber;}
      else if(p.y>1.71&&p.z>.055){coat=brushed(n,vec3(.61,.40,.13));}
      else if(p.y<.19||(p.y>.98&&p.y<1.16)||p.y>1.41&&p.y<1.68){coat=rubber;}
      if(!pack&&(abs(p.y-1.44)<.038||abs(p.y-.30)<.042))coat=vec3(.11,.20,.31);
      vec3 v=suitAxes*(position-suitEye);vec2 uv=v.xy/v.z;uv.x+=suitShear*uv.y;uv=uv*suitScale+suitBias;
      float side=smoothstep(.13,.67,dot(n,normalize(suitEye-position)))*inside(uv);
      return mix(coat,samplePatch(vec2(4.),vec2(190.,278.),uv,coat),side*.94);
    }
    vec3 engine(vec3 position,vec3 n){
      vec3 d=position-vec3(75.84,-29.343,38.43);float a=atan(d.z,d.x),h=d.y;
      vec3 titanium=vec3(.53,.53,.48),graphite=vec3(.23,.24,.23);
      if(h<1.19){
        vec3 bell=mix(graphite,titanium,.53+.07*cos(a*22.));
        return brushed(n,bell*(1.-.17*joint(a*8.9,.045))+.09*line(h-.18,.026));
      }
      vec3 alloy=mix(titanium,graphite,.30+.25*sin(a*3.+h*6.));return brushed(n,alloy);
    }
    vec3 furniture(vec3 n){
      float h=site.y+(site.x<0.?30.31:30.37);vec3 porcelain=vec3(.80,.80,.75);
      if(site.z>0.&&site.z<32.)return h<.21?vec3(.16,.17,.16):porcelain*(.92+.09*max(0.,n.y));
      vec3 side=samplePatch(vec2(812.,301.),vec2(188.,207.),tile(vec2(site.x+site.z,h)*.8),porcelain);
      return h<.16?vec3(.14,.16,.15):mix(porcelain,side,.14)*(.91+.09*max(0.,n.y));
    }
    vec3 stairwell(vec3 n){
      float h=site.y+30.37;
      if(n.y>.48){
        vec3 floor=vec3(.39,.43,.42);
        if(n.y<.98)floor*=1.-.40*joint(h/.158,.07);
        else floor*=1.-.18*max(joint(site.z/.9,.008),joint(site.x/.9,.008));
        return floor;
      }
      if(n.y<-.55)return vec3(.45,.49,.49);
      float deck=mod(h,7.68);
      vec3 wall=deck<1.03?vec3(.30,.39,.39):vec3(.56,.62,.61);
      return wall*(1.-.15*joint((abs(n.x)>.55?site.z:site.x)/2.56,.005));
    }
    void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site)));
      vec3 position=(exhibitFrame*vec4(site,1.)).xyz;
      vec3 color;
      if(kind==0.)color=foyerHall(n);
      else if(kind==1.)color=suit(position,normalize(mat3(exhibitFrame)*n));
      else if(kind==2.)color=engine(position,n);
      else if(kind==3.)color=furniture(n);
      else if(kind==4.)color=stairwell(n);
      else if(kind==5.)color=brushed(n,site.z>44.?vec3(.29,.31,.29):vec3(.38,.42,.37));
      else{
        float h=site.y+30.37;
        color=h<.22?brushed(n,vec3(.18,.20,.19)):vec3(.29,.22,.175)*(.79+.23*max(n.y,0.));
        color*=1.-.22*line(h-.45,.013);
      }
      color*=.92+.14*dot(n,normalize(vec3(.22,.57,.79)));
      gl_FragColor=vec4(color,1.);
    }`;
  return [0,1,2,3,4,5,6,1,2,2].map((kind,i)=>new THREE.ShaderMaterial({side:THREE.DoubleSide,
    extensions:{derivatives:true},vertexShader:trainingVertex,fragmentShader,
    uniforms:{...foyerPaint,kind:{value:kind},exhibitFrame:{value:i>=7?exhibitFrames[i-7]:new THREE.Matrix4()}}}));
}
async function installFoyer(){
  const {suit,panes,frames}=await jsonFile('foyer.json');
  frames.forEach(({matrix},i)=>exhibitFrames[i].set(...matrix));
  const group=new THREE.Group(),vertices=[],indices=[];
  for(const [left,right,low,high,z] of panes){
    const i=vertices.length/3;
    vertices.push(left,low,z,right,low,z,right,high,z,left,high,z);indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  const glazing=new THREE.Mesh(geometry,architecturalMaterials[1]);group.add(glazing);foyerBarriers.push(glazing);
  const metal=new THREE.MeshStandardMaterial({color:0x414a48,roughness:.49,metalness:.35});
  const strip=new THREE.MeshBasicMaterial({color:0xcce8dc});
  const indicator=new THREE.MeshBasicMaterial({color:0x76e6cb});
  function box(x,y,z,w,h,d,mat,solid=false){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z);group.add(mesh);if(solid)foyerBarriers.push(mesh);
  }
  // Suspended perimeter light above the suit. Its footprint is estimated
  // from the four corners visible against the west wall of the lobby.
  for(const side of [-1,1]){
    box(63.37+side*1.77,-25.67,38.44,.14,.14,3.72,metal);
    box(63.37+side*1.77,-25.745,38.44,.095,.012,3.63,strip);
    box(63.37,-25.67,38.44+side*1.79,3.42,.14,.14,metal);
    box(63.37,-25.745,38.44+side*1.79,3.44,.012,.095,strip);
    for(const z of [36.65,40.23])box(63.37+side*1.77,-22.20,z,.018,6.82,.018,metal);
  }
  for(const z of [29.68,31.92,34.22]){
    box(56.45,-29.87,z,.71,.99,.19,metal,true);
    box(56.815,-30.16,z,.018,.16,.08,indicator);
  }
  scene.add(group);group.updateMatrixWorld(true);
  foyerBounds=new THREE.Box3().setFromObject(glazing);
  for(const mesh of foyerBarriers)foyerBounds.expandByObject(mesh);
  foyerPaint.suitEye.value.fromArray(suit.eye);foyerPaint.suitAxes.value.set(...suit.axes.flat());
  foyerPaint.suitScale.value.fromArray(suit.scale);foyerPaint.suitBias.value.fromArray(suit.bias);foyerPaint.suitShear.value=suit.shear;
  const texture=await new THREE.TextureLoader().loadAsync('data/foyer-finish.webp');
  texture.flipY=false;texture.anisotropy=Math.min(6,gl.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
  foyerPaint.finish.value=texture;foyerPaint.ready.value=1;dirty=true;
}
