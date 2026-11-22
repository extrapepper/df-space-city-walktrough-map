'use strict';
const chamberPaint={finish:{value:null},ready:{value:0}};
function makeChamberMaterials(){
  const fragmentShader=`varying vec3 site;uniform sampler2D finish;uniform float ready,kind;
    float band(float v,float middle,float halfWidth){
      return 1.-smoothstep(halfWidth,halfWidth+max(.002,fwidth(v)),abs(v-middle));
    }
    float joint(float v,float width){return band(fract(v+.5)-.5,0.,width);}
    float inside(vec2 uv){return step(0.,min(uv.x,uv.y))*step(max(uv.x,uv.y),1.);}
    vec3 ink(vec2 pos,vec2 size,vec2 uv,vec3 fallback){
      if(ready<.5)return fallback;
      return texture2D(finish,(pos+.5+(size-1.)*clamp(uv,0.,1.))/1024.).rgb;
    }
    vec2 tile(vec2 uv){return 1.-abs(mod(uv,2.)-1.);}
    vec3 pressureDoor(vec3 n){
      vec2 p=site.xy-vec2(58.58,-19.22);float r=length(p);vec2 uv=p*vec2(1.,-1.)/16.8+.5;
      vec3 alloy=vec3(.61,.62,.56),iron=vec3(.26,.285,.28);
      float a=atan(p.y,p.x),z=site.z;
      vec2 face=tile(vec2(a*2.,r*.42));
      vec3 coating=ink(vec2(772.,4.),vec2(244.,164.),face,iron);
      vec3 paint=mix(iron,coating,.23);
      if(z< -1.88||r>7.98){
        paint=mix(alloy,coating,.095)*(1.-.13*joint(p.x/3.2,.006));
        float glow=exp(-length(vec2(abs(p.x)-6.65,site.y+28.42))*1.45);
        paint+=vec3(.32,.10,.025)*glow;
      }else if(r<7.8&&z<.20){
        paint*=.85+.15*smoothstep(4.3,7.65,r);
        paint+=vec3(.11)*band(r,7.67,.075);
        float bolts=joint(a*2.55,.051)*band(r,7.16,.12);
        paint=mix(paint,vec3(.50,.51,.46),bolts*.74);
      }
      if(z>.20||r<4.55&&z>-.27)paint=mix(alloy,coating,.14);
      vec2 slider=vec2((p.x+4.69)/.61,(-20.94-site.y)/3.15);
      if(z>.29&&n.z>.82&&inside(slider)>.5){
        paint=ink(vec2(254.,516.),vec2(230.,82.),vec2(slider.y,1.-slider.x),alloy);
      }
      if(r<2.47&&z>.55){
        float facing=abs(n.z);
        vec3 cap=ink(vec2(4.),vec2(500.),uv,alloy);
        paint=mix(alloy*.69,cap,smoothstep(.70,.97,facing)*.93);
      }
      float sky=smoothstep(-.36,.85,reflect(-normalize(cameraPosition-site),n).y);
      return paint*(.78+.25*sky)+vec3(.085)*sky*max(0.,n.y);
    }
    vec3 testArticle(vec3 n){
      // The H4 and H3 test articles share all 9,563 source faces.
      vec3 p=site-vec3(41.445,-19.71,5.867);
      bool upper=p.y>.6;vec2 centre=vec2(sign(p.x)*(upper?3.385:4.18),upper?2.48:-1.48);
      vec2 disc=(p.xy-centre)/1.79;
      vec2 uv=tile((abs(n.y)>.65?p.xz:vec2(abs(n.x)>.65?p.z:p.x,p.y))*.7);
      vec3 metal=vec3(.25,.28,.27);
      if(length(disc)<1.055&&abs(p.x)>1.44){
        bool front=p.z>(upper?-.37:-1.01)&&n.z>.45;
        if(!front)return mix(metal,vec3(.48,.51,.47),.45+max(0.,n.y)*.33);
        vec2 cells=vec2(disc.x+disc.y,disc.x-disc.y)*.5+.5;
        vec3 foil=ink(vec2(p.x<0.?762.:892.,520.),vec2(125.,154.),cells,vec3(.57,.37,.20));
        float cover=1.-smoothstep(.89,1.,abs(disc.x)+abs(disc.y));
        return mix(metal,foil*(1.-.31*max(joint(cells.x*11.,.025),joint(cells.y*11.,.025))),cover);
      }
      if(p.y< -3.40){
        vec2 cylinder=vec2(atan(p.x,p.z)*.477+.5,(p.y+7.87)/4.6);
        vec3 base=ink(vec2(516.,346.),vec2(244.,154.),tile(cylinder),vec3(.59,.62,.58));
        if(p.y< -7.5||p.y> -3.98)return mix(base,metal,.46);
        return base;
      }
      vec3 gold=ink(vec2(4.,516.),vec2(238.,162.),uv,vec3(.63,.45,.18));
      if(p.z>1.75||p.y< -2.65)return metal+.18*max(0.,n.y);
      return mix(gold,vec3(.56,.42,.18),.37)*(1.-.30*max(joint(p.x*1.58,.009),joint(p.y*1.58,.009)));
    }
    vec3 platform(vec3 n){
      float y=site.y;
      vec3 steel=vec3(.36,.38,.35),deck=vec3(.62,.62,.56);
      if(y< -28.45)return mix(vec3(.18,.19,.19),vec3(.35,.14,.12),band(y,-28.63,.16));
      if(abs(n.y)>.7)return deck*(1.-.23*max(joint(site.x*1.13,.006),joint(site.z*.64,.006)));
      vec2 uv=tile(vec2(abs(n.x)>.68?site.z:site.x,y*1.65));
      vec3 rim=ink(vec2(506.,516.),vec2(238.,162.),uv,steel);
      vec3 fascia=mix(steel,rim,.41)+.07*max(0.,n.y);
      float u=abs(n.x)>.68?site.z:site.x;
      float stripe=band(y,-28.18,.032)*step(.23,fract(u*.31));
      return mix(fascia,mix(vec3(.16,.17,.15),vec3(.78,.59,.24),smoothstep(.35,.54,fract(u*8.+y*11.))),stripe);
    }
    vec3 manipulator(vec3 n){
      vec3 p=site;bool left=p.x<41.44;
      vec2 base=vec2(left?38.2:44.72,10.8);float height=p.y+27.70;
      vec3 white=vec3(.78,.78,.71),blue=vec3(.12,.23,.42),basecoat=vec3(.18,.21,.21);
      if(height<.54)return mix(basecoat,white,band(height,.44,.085));
      if(height<1.55&&length(p.xz-base)<.82)return mix(blue,basecoat,.14);
      vec3 elbow=left?vec3(38.22,-24.19,11.37):vec3(44.94,-23.98,11.21);
      if(distance(p,elbow)<.47)return mix(blue,basecoat,.22);
      if(p.z<(left?9.65:9.95)&&p.y>(left?-24.8:-22.9))return mix(basecoat,white,.24);
      vec3 paint=white*(.92+.08*ink(vec2(772.,180.),vec2(244.,154.),tile(p.xy*1.2),white).g);
      if(abs(n.x)>.78&&height>1.65&&height<3.6){
        paint=mix(paint,basecoat,band(p.z,left?11.47:11.42,.055)*.65);
      }
      return paint*(.90+.10*max(0.,n.y));
    }
    vec3 floorFinish(vec3 n){
      vec2 p=site.xz;vec3 ground=vec3(.58,.59,.55);
      float seams=max(joint((p.x-34.10)*.5,.0035),joint((p.y-15.2)*.5,.0035));
      vec2 rail=abs(p-vec2(41.445,6.75))-vec2(7.34,8.44);
      float edge=max(rail.x,rail.y);
      ground=mix(ground,vec3(.22,.26,.26),band(edge,-.065,.105));
      if(edge<-.20){
        ground=mix(vec3(.31,.34,.34),vec3(.64,.65,.61),max(band(rail.x,-.32,.046),band(rail.y,-.32,.046)));
        ground=mix(ground,vec3(.74,.73,.64),joint((p.y+1.75)/2.44,.012)*.65);
      }
      vec2 uv=(p-vec2(34.1,15.22))/vec2(12.3,2.63);
      if(inside(uv)>.5&&abs(n.y)>.75){
        float blend=smoothstep(0.,.095,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
        ground=mix(ground,ink(vec2(4.,694.),vec2(1012.,305.),uv,ground),blend);
      }
      return ground*(1.-.15*seams);
    }
    vec3 hall(vec3 n){
      vec3 p=site;vec2 c=p.xy-vec2(41.45,-19.09);
      vec3 dark=vec3(.16,.19,.18),silver=vec3(.64,.69,.68);
      if(p.z< -2.75&&p.z> -16.02&&abs(c.x)<9.4&&p.y< -9.72){
        if(n.y>.68&&p.y< -28.25){
          vec3 deck=vec3(.40,.49,.51);
          float joints=max(joint(c.x/2.67,.006),joint((p.z+3.)/3.04,.006));
          return deck*(1.-.34*joints)+.032*joint(c.x*2.4,.025);
        }
        float angle=atan(c.x,max(.001,c.y));bool arch=c.y>=0.;
        bool endWall=p.z< -15.22&&abs(n.z)>.68;
        vec2 metres=endWall?p.xy:vec2(p.z,arch?angle*8.5:c.y);
        vec3 blue=ink(vec2(516.,4.),vec2(244.,164.),tile(metres*vec2(.72,.38)),vec3(.29,.46,.59));
        blue=mix(blue,vec3(.22,.38,.50),.32);
        float bars=max(band(p.z,-7.50,.095),band(p.z,-11.70,.095));
        if(!arch)bars=max(bars,band(p.y,-20.18,.075));
        if(endWall)bars=max(band(p.y,-20.18,.13),band(p.y,-23.71,.075));
        float lamp=arch?joint(angle*2.49,.013):band(c.y,-3.02,.037);
        if(endWall)lamp=0.;
        lamp*=smoothstep(.11,.29,abs(fract((p.z+3.3)/4.2+.5)-.5)*4.2);
        if(p.z> -3.39)return mix(silver,vec3(.36,.48,.55),.28);
        return mix(mix(blue,silver,bars*.76),vec3(.84,.93,.96),lamp*.92);
      }
      bool side=abs(n.x)>.56;float along=side?p.z:p.x;
      vec2 uv=tile(vec2(along*.27,p.y*.32));
      vec3 pale=ink(vec2(772.,180.),vec2(244.,154.),uv,silver)*.43+vec3(.42);
      vec3 green=ink(vec2(516.,180.),vec2(244.,154.),uv,vec3(.28,.48,.25));
      if(abs(n.y)>.67)return mix(dark,pale,.39);
      float h=p.y+29.09;
      vec3 wall=(h<3.40||h>13.7)?green:pale;
      wall=mix(wall,green,band(h,3.94,.115));
      wall=mix(wall,dark,max(band(h,.16,.16),joint(along/5.32,.008))*.77);
      wall*=1.-.24*joint(h/3.42,.004);
      if(p.x<30.2&&p.y> -19.6&&p.y< -16.6){
        vec2 mark=vec2((11.3-p.z)/9.4,(-16.6-p.y)/3.);
        if(inside(mark)>.5)wall=mix(wall,dark,ink(vec2(772.,346.),vec2(238.,102.),mark,vec3(0.)).r);
      }
      return wall;
    }
    void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site)));
      vec3 color;
      if(kind==0.)color=pressureDoor(n);
      else if(kind==1.)color=testArticle(n);
      else if(kind==2.)color=platform(n);
      else if(kind==3.)color=manipulator(n);
      else if(kind==4.)color=floorFinish(n);
      else if(kind==5.)color=vec3(.25,.28,.27)+.16*max(0.,n.y);
      else if(kind==6.)color=hall(n);
      else color=vec3(.62,.66,.61);
      float light=clamp(.91+.16*dot(n,normalize(vec3(-.32,.81,.47))),.73,1.08);
      float sheen=pow(1.-abs(dot(n,normalize(cameraPosition-site))),3.);
      gl_FragColor=vec4(color*light+.024*sheen,1.);
    }`;
  return Array.from({length:8},(_,kind)=>new THREE.ShaderMaterial({
    side:THREE.DoubleSide,extensions:{derivatives:true},vertexShader:trainingVertex,fragmentShader,
    uniforms:{...chamberPaint,kind:{value:kind}}
  }));
}
async function loadChamber(){
  const [pose,texture]=await Promise.all([jsonFile('chamber-study.json'),new THREE.TextureLoader().loadAsync('data/chamber-materials.webp')]);
  texture.flipY=false;texture.anisotropy=Math.min(6,gl.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
  chamberPaint.finish.value=texture;chamberPaint.ready.value=1;surveyViews.set('chamber',pose);dirty=true;
}
