'use strict';
const vendingTexture={value:null},vendingReady={value:0};
// Source model coordinates are in metres. X runs along the front, Y points out
// through the chute and Z is height. Each machine has its own measured transform.
function makeVendingMaterial(cabinet){
  return new THREE.ShaderMaterial({
    side:THREE.DoubleSide,extensions:{derivatives:true},
    uniforms:{
      localFromWorld:{value:new THREE.Matrix4().fromArray(cabinet.localFromWorld)},
      juice:{value:Number(cabinet.juice)},finish:vendingTexture,ready:vendingReady,
      submerged:labUniforms.submerged,immersionLevel:labUniforms.immersionLevel,immersionTint:labUniforms.immersionTint
    },
    vertexShader:`uniform mat4 localFromWorld;varying vec3 localPoint,site;
      void main(){site=position;localPoint=(localFromWorld*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 localPoint,site;
      uniform sampler2D finish;uniform float ready,juice,submerged,immersionLevel;uniform vec3 immersionTint;
      vec3 samplePanel(vec2 corner,vec2 size,vec2 uv){
        return texture2D(finish,(corner+.5+(size-1.)*clamp(uv,0.,1.))/1024.).rgb;
      }
      void main(){
        vec3 p=localPoint,n=normalize(cross(dFdx(p),dFdy(p)));
        vec3 worldNormal=normalize(cross(dFdx(site),dFdy(site)));
        float lit=.76+.23*abs(dot(worldNormal,normalize(vec3(-.43,.84,.33))));
        float edge=pow(1.-abs(dot(worldNormal,normalize(cameraPosition-site))),2.);
        vec3 graphite=vec3(.146,.17,.179),rim=vec3(.46,.49,.50);
        vec3 color=graphite;
        bool side=abs(n.x)>.89;
        if(side&&p.y<.32)color=mix(rim,graphite,.28*step(p.x,0.));
        if(p.y<-.425)color=vec3(.24,.26,.26);
        if(p.z>2.302||p.z<.067)color=graphite*.77;
        if(p.y>.31&&p.x>.28&&p.z>.062&&p.z<2.32)color=rim;
        if(p.y>.33&&p.x<.29&&p.z<.64)color=mix(graphite,rim,.72);
        if(p.x<.28&&p.z>2.27&&p.y>.13)color=graphite;
        if(ready>.5){
          vec2 railUV=vec2(side?(p.y+.436)/.78:(p.x+.81)/1.60,1.-p.z/2.40);
          vec3 metal=samplePanel(vec2(405.,744.),vec2(92.,250.),railUV);
          color*=clamp(dot(metal,vec3(.30,.55,.15))*1.78,.68,1.28);
          if(p.y>.39&&p.x<.30&&p.z<.338){
            color=samplePanel(vec2(4.,860.),vec2(380.,100.),vec2((p.x+.73)/1.03,1.-p.z/.338));
          }
        }
        color=color*lit+edge*.035;
        // Six adjoining vertical faces form the roll on the left of the poster.
        // The lower edge rises towards the flank of the case.
        bool roll=p.x<-.621&&p.x>-.729&&p.y>.122&&p.y<.393&&abs(n.z)<.075;
        bool panel=p.x>=-.624&&p.x<.238&&abs(p.y-.391)<.005&&abs(n.y)>.98;
        if((roll||panel)&&p.z>.602+max(0.,.371-p.y)*.80&&p.z<2.274){
          vec2 uv=vec2((p.x+.623)/.859,(2.27-p.z)/1.663);
          color=mix(vec3(.70,.43,.14),vec3(.02,.64,.65),juice);
          if(ready>.5){
            vec3 ink=samplePanel(vec2(mix(4.,390.,juice),4.),vec2(380.,726.),uv);
            // The footage resolves the flat panel. Carry the background hue
            // around the unobserved roll without stretching letters onto it.
            if(roll)ink=mix(ink,color,smoothstep(.0,.20,.39-p.y)*.87);
            color=ink;
          }
          color*=.84+.16*abs(n.y);
        }else if(p.y>.254&&p.y<.323&&p.x>.367&&p.x<.714&&p.z>.108&&p.z<2.278){
          vec2 uv=vec2((p.x-.373)/.338,(2.273-p.z)/2.16);
          color=ready>.5?samplePanel(vec2(781.,4.),vec2(195.,896.),uv):graphite;
          color*=.91+.09*abs(n.y);
        }else if(p.y>.387&&p.y<.578&&p.x>-.63&&p.x<.254&&p.z>.447&&p.z<.612&&abs(n.z)>.33){
          vec2 uv=vec2((p.x+.62)/.816,(p.y-.39)/.18);
          color=ready>.5?samplePanel(vec2(4.,744.),vec2(378.,93.),uv):graphite;
        }
        float wet=distance(cameraPosition,site)*clamp((immersionLevel-cameraPosition.y)/max(.001,site.y-cameraPosition.y),0.,1.);
        gl_FragColor=vec4(mix(color,immersionTint,submerged*(1.-exp(-.046*wet))),1.);
      }`
  });
}
async function loadVendingFinish(){
  const texture=await new THREE.TextureLoader().loadAsync('data/vending-finish.webp');
  texture.flipY=false;texture.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
  vendingTexture.value=texture;vendingReady.value=1;dirty=true;
}
