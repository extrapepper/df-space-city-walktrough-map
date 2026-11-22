'use strict';
let trainingGlass;
const trainingUniforms={
  samples:{value:null},photo:{value:null},samplesReady:{value:0},photoReady:{value:0},
  photoEye:{value:new THREE.Vector3()},photoAxes:{value:new THREE.Matrix3()},photoSize:{value:new THREE.Vector2()},
  photoFocal:{value:new THREE.Vector2()},photoCenter:{value:new THREE.Vector2()},photoDepth:{value:new THREE.Vector2()}
};
const trainingVertex=`varying vec3 site;
  void main(){site=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
function makeTrainingMaterial(kind){
  return new THREE.ShaderMaterial({
    extensions:{derivatives:true},side:THREE.DoubleSide,
    uniforms:{...trainingUniforms,...blueHallUniforms,kind:{value:kind}},
    vertexShader:trainingVertex,
    fragmentShader:`varying vec3 site;
      uniform float kind,samplesReady,photoReady;
      const float arm=1.,portal=2.,lettering=3.,lining=4.,platformKind=6.;
      uniform sampler2D samples,photo,blueReflectors;
      uniform vec3 photoEye;uniform mat3 photoAxes;uniform vec2 photoFocal,photoCenter,photoDepth,photoSize;
      ${kind>=4?blueHallProjection:''}
      vec3 inkSample(vec2 start,vec2 size,vec2 uv,vec3 base){
        if(samplesReady<.5)return base;
        return texture2D(samples,(start+.5+(size-1.)*clamp(uv,0.,1.))/vec2(768.,436.)).rgb;
      }
      float seam(float v,float width){
        return 1.-smoothstep(width,width+max(.0005,fwidth(v)),abs(fract(v+.5)-.5));
      }
      float band(float v,float center,float width){
        float d=abs(v-center);return 1.-smoothstep(width,width+max(.002,fwidth(v)),d);
      }
      vec4 photoTexel(vec2 pixel,float z){
        vec4 ink=texture2D(photo,(pixel+.5)/photoSize);
        float depth=photoDepth.x+(ink.a*255.-3.)/250.*(photoDepth.y-photoDepth.x);
        float blue=floor(ink.b*255.+.5),quality=mod(blue,8.);
        ink.b=(blue-quality+3.5)/255.;
        float weight=quality/7.*step(.008,ink.a)*(1.-smoothstep(.10,.26,abs(depth-z)));
        return vec4(ink.rgb*weight,weight);
      }
      vec3 centrifuge(vec3 n){
        vec2 p=site.xz-vec2(-58.39,21.64);float r=length(p),y=site.y,a=atan(p.x,p.y);
        float lit=.80+.20*abs(dot(n,normalize(vec3(-.29,.84,.42))));
        vec3 steel=vec3(.32,.35,.36),ivory=vec3(.72,.73,.74),teal=vec3(.03,.36,.42);
        if(kind==lettering)return vec3(.78,.79,.78)*lit;
        if(kind==portal){
          float rib=seam(site.z*1.8,.014);
          return mix(vec3(.61,.61,.63),vec3(.23,.25,.26),rib*.65)*lit;
        }
        if(kind==arm){
          float along=dot(p,normalize(vec2(-8.99,2.41)));
          float lateral=dot(p,normalize(vec2(2.41,8.99)));
          vec3 paint=inkSample(vec2(502.,4.),vec2(239.,82.),fract(vec2(along*.27,lateral*.37+y*.33)),steel);
          paint=mix(paint,vec3(.15,.17,.17),.45);
          if(along<6.4&&y< -27.55)paint=mix(ivory,steel,.38);
          if(along>6.4){
            paint=abs(lateral)<1.04&&y> -28.6?vec3(.15,.16,.18):ivory*.78;
            paint+=vec3(.19,.075,.045)*smoothstep(6.8,9.2,along)*max(0.,n.y);
          }
          if(r<1.45)paint=y> -27.?vec3(.32,.23,.14):steel;
          return paint*lit;
        }
        if(r<.60){
          float glint=.55+.43*abs(dot(n,normalize(vec3(.45,.10,.82))));
          vec3 color=y< -25.75?vec3(.42,.30,.20):vec3(.78,.79,.81);
          if(y> -22.02&&y< -21.44)color=vec3(.19,.20,.21)+band(y,-21.57,.034)*.3;
          return color*glint;
        }
        if(y< -30.15&&abs(n.y)>.65){
          vec3 floorColor=inkSample(vec2(4.,4.),vec2(155.,132.),fract(site.xz*.33),vec3(.18,.22,.23));
          floorColor=mix(floorColor,vec3(.16,.20,.20),.40);
          if(r>8.30&&r<9.79)floorColor=vec3(.094,.10,.11)+seam(a*4.46,.016)*.24;
          float line=max(max(band(r,3.56,.032),band(r,4.46,.024)),max(band(r,8.30,.055),band(r,9.79,.044)));
          floorColor=mix(floorColor,vec3(.62,.66,.63),line*.76);
          return floorColor*lit;
        }
        if(r>10.35&&y< -20.76){
          vec2 uv=fract(vec2(a*2.39,(y+30.36)*.34));
          vec3 paper=inkSample(vec2(170.,4.),vec2(155.,132.),uv,ivory);
          vec3 enamel=inkSample(vec2(336.,4.),vec2(155.,132.),uv,teal);
          vec3 wall=y< -27.46?mix(enamel,teal,.50):mix(paper,ivory,.64);
          wall*=1.-.45*seam(a*3.82,.0034);
          wall=mix(wall,vec3(.10,.13,.14),max(band(y,-27.50,.065),band(y,-30.23,.10)));
          float stencil=band(y,-27.21,.085)*smoothstep(.12,.16,fract(a*3.82))*(1.-smoothstep(.37,.43,fract(a*3.82)));
          wall=mix(wall,vec3(.72,.30,.075),stencil);
          // The real openings between the twenty separate window frames stay clear.
          if(abs(p.x)<7.35&&abs(p.y)>8.45&&y> -25.96&&y< -23.91)wall=vec3(.33,.35,.37);
          return wall*lit;
        }
        return (y> -20.75&&abs(n.y)<.4?ivory*.76:steel)*lit;
      }
      vec3 blueRoom(vec3 n){
        float y=site.y,lit=.78+.22*abs(dot(n,normalize(vec3(-.38,.80,.48))));
        if(kind==lining){
          bool wall=abs(n.y)<.73;
          bool xWall=abs(site.x-66.73)>14.75,zWall=abs(site.z+59.)>13.42;
          if((xWall||zWall)&&y> -29.05&&y< -20.77){
            vec2 uv=fract(vec2((xWall?site.z:site.x)*.093,(y+29.05)*.234));
            vec3 foam=inkSample(vec2(314.,154.),vec2(281.,152.),vec2(uv.x,1.-uv.y),vec3(.055,.081,.14));
            return (foam+.035*max(0.,n.y))*lit;
          }
          vec3 enamel=wall?vec3(.34,.44,.59):vec3(.22,.28,.36);
          if(y< -29.)enamel=wall?vec3(.49,.57,.67):vec3(.36,.44,.53);
          float joint=wall?max(seam((abs(n.x)>abs(n.z)?site.z:site.x)/3.2,.003),seam((y+29.)/3.2,.003)):max(seam(site.x/3.2,.003),seam(site.z/3.2,.003));
          return enamel*(1.-joint*.32)*lit;
        }
        if(kind==platformKind){
          if(y< -31.59&&site.x>54.23&&site.x<74.12&&site.z> -67.84&&site.z< -51.12){
            bool wall=abs(n.y)<.45;
            float horizontal=abs(n.x)>abs(n.z)?site.z+51.16:site.x-74.093;
            vec2 metres=wall?vec2(horizontal,y+34.848):site.xz-vec2(74.093,-51.16);
            vec2 grid=metres/2.;
            vec2 uv=1.-abs(mod(grid,2.)-1.);
            vec2 sampleOrigin=vec2(wall?(abs(n.x)>.7?4.:260.):132.,319.);
            vec3 paint=inkSample(sampleOrigin,vec2(115.,98.),uv,vec3(.22,.30,.42));
            float joint=wall?seam(grid.x,.004):max(seam(grid.x,.005),seam(grid.y,.005));
            paint*=1.-.36*joint;
            if(wall){
              paint=mix(paint,vec3(.095,.15,.30),band(y,-33.4675,.1025)*.82);
              float lip=max(band(y,-33.365,.018),band(y,-33.57,.018));
              paint=mix(paint,vec3(.06,.095,.15),max(lip,band(y,-34.80,.045))*.89);
            }
            return paint*mix(.92,1.09,abs(n.y));
          }
          vec3 platform=abs(n.y)>.6?vec3(.24,.31,.40):vec3(.28,.36,.46);
          if(y> -29.20)platform=abs(n.y)>.6?vec3(.26,.31,.35):vec3(.14,.18,.20);
          if(y< -31.3&&abs(n.y)<.5)platform=vec3(.49,.56,.66);
          return platform*lit;
        }
        vec3 p=site-vec3(64.81,-20.54,-59.43);
        bool upper=p.y>.6;vec2 disc=vec2(sign(p.x)*(upper?3.385:4.18),upper?2.48:-1.48);
        vec2 q=(p.xy-disc)/1.79;
        if(length(q)<1.055&&abs(p.x)>1.44){
          vec3 metal=vec3(.25,.31,.41);
          float surfaceZ=upper?-.33:-.97;
          if(abs(n.z)<.28)return (metal+.13*abs(n.y))*lit;
          float rear=step(p.z,surfaceZ-.04);
          vec2 local=clamp(q*vec2(.5,-.5)+.5,0.,1.);
          vec2 uv=(vec2(step(0.,p.x),rear)*256.+.5+255.*local)/512.;
          vec3 cover=texture2D(blueReflectors,uv).rgb;
          return mix(metal,cover,step(.01,dot(cover,vec3(1.))))*(.96+.06*abs(n.z));
        }
        vec2 face=abs(n.y)>.65?p.xz:vec2(abs(n.x)>.65?p.z:p.x,p.y);
        vec2 uv=fract(face*.60);vec3 housing;
        if(y< -25.05){
          housing=y< -27.90?vec3(.21,.26,.33):vec3(.61,.65,.74);
        }else if(y< -23.35){
          housing=vec3(.58,.62,.70)*(.92+.08*max(n.y,0.));
        }else{
          housing=inkSample(vec2(440.,332.),vec2(108.,76.),uv,vec3(.54,.41,.16));
          housing=mix(housing,vec3(.51,.38,.15),.52);
          housing*=1.-.27*max(seam(face.x*1.6,.009),seam(face.y*1.6,.009));
          if(p.z>1.76){
            float collar=band(p.z,2.39,.13)+band(p.z,3.48,.09);
            housing=mix(vec3(.30,.32,.34),vec3(.10,.13,.15),min(collar,1.));
            if(p.z>3.64&&abs(n.z)>.48)housing=inkSample(vec2(670.,332.),vec2(88.,76.),uv,vec3(.11,.17,.21));
          }
        }
        float sky=smoothstep(-.12,.68,reflect(-normalize(cameraPosition-site),n).y);
        return housing*(.57+.35*max(0.,dot(n,normalize(vec3(-.5,.8,.35))))+.22*sky)+sky*.035;
      }
      void main(){
        vec3 n=normalize(cross(dFdx(site),dFdy(site)));
        vec3 color=kind<=lettering?centrifuge(n):blueRoom(n);
        if(photoReady>.5&&site.x< -45.&&site.x> -71.&&site.z>9.&&site.z<34.){
          vec3 ray=photoAxes*(site-photoEye);
          if(ray.z>0.){
            vec2 uv=photoCenter+photoFocal*ray.xy/ray.z;
            if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){
              vec2 pixel=uv*photoSize-.5,c=floor(pixel),f=fract(pixel);
              vec4 coat=mix(mix(photoTexel(c,ray.z),photoTexel(c+vec2(1.,0.),ray.z),f.x),
                            mix(photoTexel(c+vec2(0.,1.),ray.z),photoTexel(c+vec2(1.),ray.z),f.x),f.y);
              float facing=smoothstep(.12,.48,dot(n,normalize(photoEye-site)));
              float fidelity=.56+.44*smoothstep(.05,.45,max(length(dFdx(pixel)),length(dFdy(pixel))));
              color=mix(color,coat.rgb/max(.0001,coat.a),coat.a*facing*fidelity);
            }
          }
        }
        ${kind>=4?'color=blueHallFinish(color,site,n);':''}
        gl_FragColor=vec4(color,1.);
      }`
  });
}
async function installTrainingRooms(study){
  const xyz=[],indices=[];
  for(const [x,y,z,tx,tz,w,h] of study.windows){
    const base=xyz.length/3;
    for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]])xyz.push(x+tx*u*w/2,y+v*h/2,z+tz*u*w/2);
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const glassGeometry=new THREE.BufferGeometry();
  glassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));glassGeometry.setIndex(indices);
  glassGeometry.computeBoundingBox();glassGeometry.computeBoundingSphere();
  trainingGlass=new THREE.Mesh(glassGeometry,new THREE.ShaderMaterial({
    side:THREE.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true,extensions:{derivatives:true},vertexShader:trainingVertex,
    fragmentShader:`varying vec3 site;void main(){
      vec3 n=normalize(cross(dFdx(site),dFdy(site))),v=normalize(cameraPosition-site);
      float rim=pow(1.-abs(dot(v,n)),2.);gl_FragColor=vec4(vec3(.17,.21,.24)+rim*.20,.22+rim*.24);}`
  }));
  scene.add(trainingGlass);surveyViews.set('centrifuge',study);
  const u=trainingUniforms;
  u.photoSize.value.fromArray(study.imageSize);
  u.photoEye.value.fromArray(study.eye);u.photoAxes.value.set(...study.rotation.flat());
  u.photoFocal.value.set(study.focal/study.imageSize[0],study.focal/study.imageSize[1]);
  u.photoCenter.value.set(study.principal[0]/study.imageSize[0],study.principal[1]/study.imageSize[1]);u.photoDepth.value.fromArray(study.depth);
  const loader=new THREE.TextureLoader();
  await Promise.all([['samples','training-materials'],['photo','centrifuge-study']].map(async([key,file])=>{
    const t=await loader.loadAsync('data/'+file+'.webp');t.flipY=false;
    if(key==='photo'){t.generateMipmaps=false;t.magFilter=t.minFilter=THREE.NearestFilter}
    else t.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());
    t.needsUpdate=true;u[key].value=t;u[key+'Ready'].value=1;dirty=true;
  }));
}
