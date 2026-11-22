'use strict';
const palmBark={map:{value:null},ready:{value:0}};
let courtyardTrunks;
function makePalmBarkMaterial(){
  return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:palmBark,extensions:{derivatives:true},
    vertexShader:'varying vec3 p;void main(){p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}',
    fragmentShader:`
      uniform sampler2D map;uniform float ready;varying vec3 p;
      void main(){
        vec3 n=normalize(cross(dFdx(p),dFdy(p)));
        float wx=abs(n.x)/(abs(n.x)+abs(n.z)+.001);
        vec3 bark=mix(texture2D(map,p.xy/vec2(1.56,1.32)).rgb,texture2D(map,p.zy/vec2(1.56,1.32)).rgb,wx);
        bark=mix(vec3(.50,.44,.36),bark,ready)*vec3(.89,.81,.69);
        gl_FragColor=vec4(bark*(.66+.31*dot(n,normalize(vec3(-.52,.90,-.36)))),1.);
      }`
  });
}
// Each frond follows an arch in three dimensions. The fold along its midrib and
// the older, hanging leaves give a different silhouette above and under the tree.
function palmCrownGeometry(segments){
  const positions=[],uv=[],colors=[],indices=[];
  const rings=[
    {count:8,r:.43,rise:.13,drop:.98,w:.14,dry:.73},
    {count:12,r:.90,rise:.54,drop:.56,w:.16,dry:.21},
    {count:10,r:.93,rise:.91,drop:.10,w:.16,dry:.04},
    {count:7,r:.56,rise:1.22,drop:-.48,w:.13,dry:0}
  ];
  for(const [row,ring] of rings.entries())for(let j=0;j<ring.count;j++){
    const seed=row*34.77+j*12.67,angle=2*Math.PI*j/ring.count+row*1.78+.095*Math.sin(seed);
    const c=Math.cos(angle),s=Math.sin(angle),variation=1+.12*Math.sin(seed+4.9);
    const first=positions.length/3;
    for(let i=0;i<=segments;i++){
      const t=i/segments,bend=t*t,arc=Math.sin(Math.PI*t);
      const reach=ring.r*variation*(.10*t+.90*t*t*(3-2*t));
      const y=variation*(ring.rise*t*(2-t)-(ring.rise+ring.drop)*bend);
      const twist=.08*Math.sin(seed+.34)*bend;
      for(const side of [-1,0,1]){
        const across=ring.w*side+twist;
        positions.push(c*reach-s*across,y-Math.abs(side)*.094*(.35+.65*arc)+side*.045*Math.sin(seed+t*2),s*reach+c*across);
        uv.push((side+1)*.5,t);
        const light=(.80+.26*t+.12*arc+.065*Math.sin(seed))*(side===0?1.06:.95);
        colors.push(light,ring.dry,.91+.09*Math.cos(seed));
      }
      if(!i)continue;
      const k=first+3*i;
      for(let j=0;j<2;j++)indices.push(k-3+j,k-2+j,k+j,k-2+j,k+1+j,k+j);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);
  geo.computeBoundingSphere();return geo;
}
function forecourtGeometry(trees){
  const positions=[],indices=[];
  for(const [tree,{foot,tip}] of trees.entries()){
    const first=positions.length/3;
    for(let k=0;k<=12;k++){
      const t=k/12;
      const x=foot[0]+(tip[0]-foot[0])*t,z=foot[2]+(tip[2]-foot[2])*t;
      const y=foot[1]+(tip[1]-foot[1])*t;
      const radius=(.28+.12*(1-t)**4+.19*t**7)*(.90+.16*Math.sin(tree+1));
      for(let j=0;j<12;j++){
        const a=j*Math.PI/6,ring=first+12*k,n=(j+1)%12;
        positions.push(x+radius*Math.cos(a),y,z+radius*Math.sin(a));
        if(k)indices.push(ring-12+j,ring+j,ring-12+n,ring-12+n,ring+j,ring+n);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);geo.computeBoundingBox();return geo;
}
async function installPalms(){
  const loader=new THREE.TextureLoader();
  const [trees,leaf,bark]=await Promise.all([jsonFile('palms.json'),loader.loadAsync('data/palm-frond.webp'),loader.loadAsync('data/palm-bark.webp')]);
  bark.wrapS=bark.wrapT=THREE.RepeatWrapping;
  bark.anisotropy=leaf.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());
  leaf.needsUpdate=bark.needsUpdate=true;palmBark.map.value=bark;palmBark.ready.value=1;
  courtyardTrunks=new THREE.Mesh(forecourtGeometry(trees.courtyard),makePalmBarkMaterial());
  scene.add(courtyardTrunks);
  const material=new THREE.ShaderMaterial({uniforms:{frond:{value:leaf}},side:THREE.DoubleSide,vertexColors:true,
    vertexShader:`varying vec2 tex;varying vec3 tone;varying float dist;
      void main(){
        vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);
        tex=uv;tone=color;dist=distance(world.xyz,cameraPosition);
        vec3 outward=mat3(instanceMatrix)*vec3(position.x,0.,position.z);
        tone.r*=.93+.15*dot(outward/max(length(outward),.001),vec3(-.76,0.,-.65));
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`uniform sampler2D frond;varying vec2 tex;varying vec3 tone;varying float dist;
      void main(){
        vec4 texel=texture2D(frond,tex);
        if(texel.a<mix(.38,.15,smoothstep(12.,90.,dist)))discard;
        vec3 green=texel.rgb*vec3(.88,.97,.82);
        float luma=dot(texel.rgb,vec3(.3,.55,.15));
        vec3 straw=luma*vec3(1.14,.89,.56);
        gl_FragColor=vec4(mix(green,straw,tone.g)*tone.r*tone.b,1.);
      }`
  });
  const batches=new Map(),near=palmCrownGeometry(7),far=palmCrownGeometry(3);
  for(const [i,tree] of [...trees.native,...trees.courtyard].entries()){
    const [x,y,z]=tree.tip,height=y-tree.foot[1],id=tree.id??i;
    const radius=tree.radius??Math.min(5.25,Math.max(1.78,1.35+.21*height))*(1+.09*Math.sin(id));
    const cx=Math.floor(x/75)*75+37.5,cz=Math.floor(z/75)*75+37.5,key=cx+','+cz;
    if(!batches.has(key))batches.set(key,{cx,cz,trees:[]});
    const pose=new THREE.Object3D();pose.position.set(x-cx,y,z-cz);
    pose.rotation.y=id*2.39996;pose.scale.set(radius,radius*(.79+.095*Math.cos(id)),radius*(.94+.07*Math.sin(id*3)));
    pose.updateMatrix();batches.get(key).trees.push(pose.matrix);
  }
  for(const {cx,cz,trees} of batches.values()){
    const lod=new THREE.LOD();lod.name='室外棕榈';lod.position.set(cx,0,cz);
    for(const [geo,threshold] of [[near,0],[far,139]]){
      const mesh=new THREE.InstancedMesh(geo,material,trees.length);
      trees.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();lod.addLevel(mesh,threshold);
    }
    scene.add(lod);
  }
  dirty=true;
}
