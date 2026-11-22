'use strict';
function readFreightCoords(paint,vertices){
  const bytes=atob(paint.bytes),coords=new Uint8Array(vertices*4);
  let offset=0;
  for(const [first,count] of paint.spans){
    const start=first*4,end=(first+count)*4;
    for(let i=start;i<end;i++)coords[i]=bytes.charCodeAt(offset++);
  }
  return new THREE.BufferAttribute(coords,4,true);
}
function makeFreightMaterial(){
  const uniforms={finish:{value:null},ready:{value:0},elevation:material.uniforms.elevation,
    submerged:labUniforms.submerged,immersionLevel:labUniforms.immersionLevel,immersionTint:labUniforms.immersionTint};
  new THREE.TextureLoader().load('data/freight-finish.webp',texture=>{
    texture.flipY=false;texture.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate=true;uniforms.finish.value=texture;uniforms.ready.value=1;dirty=true;
  },undefined,error=>console.warn('货箱材质加载失败',error));
  return new THREE.ShaderMaterial({
    side:THREE.DoubleSide,extensions:{derivatives:true},uniforms,
    vertexShader:`attribute vec4 freightCoord;varying vec4 paint;varying vec3 site;
      void main(){paint=freightCoord;site=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D finish,elevation;uniform float ready,submerged,immersionLevel;uniform vec3 immersionTint;
      varying vec4 paint;varying vec3 site;
      void main(){
        float style=floor(paint.w*255.+.5);
        vec3 q=paint.xyz,axis=abs(cross(dFdx(q),dFdy(q)));
        vec2 uv;float panel;
        bool container=style==3.||style==6.||style==7.;
        if(axis.y>max(axis.x,axis.z)){
          panel=2.;uv=q.xz;
        }else if(axis.x>axis.z){
          panel=container?0.:1.;uv=vec2(q.x>.5?1.-q.z:q.z,1.-q.y);
          // Only the side facing the registered camera has a verified stencil.
          if(container&&q.x>.5)style=3.;
        }else{
          panel=container?1.:0.;uv=vec2(q.z>.5?q.x:1.-q.x,1.-q.y);
        }
        vec2 cell=vec2(512.,256.),texel=vec2(panel,style-1.)*cell+4.5+clamp(uv,0.,1.)*(cell-9.);
        vec3 base=ready>.5?texture2D(finish,texel/vec2(1536.,2560.)).rgb:vec3(.43,.44,.44);
        vec3 n=normalize(cross(dFdx(site),dFdy(site))),eye=normalize(cameraPosition-site);
        float sun=dot(n,normalize(vec3(-.48,.86,-.38)));
        vec4 h=texture2D(elevation,clamp((site.xz+512.5)/1024.,0.,1.));
        float roof=(dot(h.rg,vec2(2.55,652.8))-327.68)-site.y;
        float lit=mix(.92,1.06,1.-smoothstep(3.,12.,roof))+.14*sun;
        float rim=pow(1.-abs(dot(n,eye)),3.)*(style==4.?.008:.037);
        vec3 color=base*lit*mix(.88,1.,smoothstep(0.,.13,q.y))+rim;
        float wet=distance(cameraPosition,site)*clamp((immersionLevel-cameraPosition.y)/max(.001,site.y-cameraPosition.y),0.,1.);
        color=mix(color,immersionTint,submerged*(1.-exp(-.046*wet)));
        gl_FragColor=vec4(color,1.);
      }`
  });
}
