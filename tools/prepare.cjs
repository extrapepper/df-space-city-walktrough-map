const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { identifySurfaces, surfaceRuns } = require('./appearance.cjs');
const { measureBasin } = require('./basin.cjs');
const THREE = require('../dist/vendor/three.min.js');
const simplify = require(process.argv[3] || 'meshoptimizer/meshopt_simplifier.js');
const data = fs.readFileSync(process.argv[2]);
const out = path.join(__dirname, '../dist/data');
const sha = crypto.createHash('sha256').update(data).digest('hex');
if (sha !== 'e1fc22f0ea0f7fc23a8227e897cd8e6f614158da5d20b74b654cc9850e762274') throw Error('Unexpected scene revision');
const count = data.readUInt32LE(12), hullCount = data.readUInt32LE(16), tileCount = data.readUInt32LE(20);
const hulls = [], tiles = [], parts = [], terrain = [];
const cells = new Map();
let p = 64;
function array(type, start, len) {
  const bytes = data.subarray(start, start + len * type.BYTES_PER_ELEMENT);
  return new type(Uint8Array.from(bytes).buffer);
}
function bounds(v) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i=0; i<v.length; i++) {
    const k=i%3;
    min[k]=Math.min(min[k],v[i]); max[k]=Math.max(max[k],v[i]);
  }
  return {min,max};
}
// PhysX heightfields use local X for rows, Z for columns and signed Y heights.
function readTerrain(step, offset) {
  const v=[], idx=[], width=127, side=126/step+1;
  const [sy,sx,sz]=[8,12,16].map(k=>data.readFloatLE(offset+k));
  for (let r=0;r<width;r+=step) for (let c=0;c<width;c+=step) {
    const sample=r*width+c;
    v.push(r*sx,data.readInt16LE(offset+24+2*sample)*sy,c*sz);
    if (r===126||c===126||data[offset+24+2*width*width+sample]===3) continue;
    const i=r/step*side+c/step;
    idx.push(i,i+1,i+side, i+1,i+side+1,i+side);
  }
  return {v:new Float32Array(v),idx:new Uint32Array(idx)};
}
function readGeometry() {
  for (let i=0;i<hullCount;i++) {
    const n=data.readUInt32LE(p), t=data.readUInt32LE(p+4);
    const v=array(Float32Array,p+12,n*3), idx=array(Uint16Array,p+12+12*n,t*3);
    const {min,max}=bounds(v);
    hulls.push({v,idx,span:max.map((x,k)=>x-min[k])});
    p+=12+n*12+t*6;
  }
  for (let i=0;i<tileCount;i++) {
    tiles.push(readTerrain(1,p));
    p+=24+127*127*3;
  }
  if (p+count*48!==data.length) throw Error('Malformed scene table');
}
function placeGeometry() {
  const mat=new THREE.Matrix4(), q=new THREE.Quaternion(), tr=new THREE.Vector3(), sc=new THREE.Vector3();
  for(let inst=0;inst<count;inst++,p+=48) {
    const f=k=>data.readFloatLE(p+k*4);
    const id=data.readUInt32LE(p+40), isTerrain=data.readUInt32LE(p+44)===1;
    const h=isTerrain?tiles[id]:hulls[id];
    q.set(f(0),f(1),f(2),f(3)).normalize(); tr.set(f(4),f(5),f(6)); sc.set(f(7),f(8),f(9));
    mat.compose(tr,q,sc);
    const v=Float32Array.from(h.v), pos=new THREE.BufferAttribute(v,3);
    pos.applyMatrix4(mat);
    // World in metres. Source game up is Z. Map orientation is set by the viewer.
    for(let j=0;j<v.length;j+=3) {
      const horizontal=v[j+1]; v[j]*=.01; v[j+1]=v[j+2]*.01; v[j+2]=horizontal*.01;
    }
    const {min,max}=bounds(v);
    const width=Math.max(max[0]-min[0],max[2]-min[2]),height=max[1]-min[1];
    const cx=(max[0]+min[0])/2, cz=(max[2]+min[2])/2;
    const key=[Math.floor(cx/70),Math.floor(cz/70),isTerrain?1:0].join('_');
    const palette=isTerrain?0: width>50&&height<3?1:height>width*.8&&height>12?3:width>15?2+(id%6===0):4+(id%4);
    const item={v,idx:h.idx,small:width<2.7&&height<2.7,palette,id,instance:inst,min,max,cell:key};
    if (!cells.has(key)) cells.set(key,[]);
    cells.get(key).push(item);
    (isTerrain?terrain:parts).push(item);
  }
}
// Each cell has its own quantization range. The full-detail stream retains every source triangle.
function pack(list, lod, finishes) {
  let n=0,t=0;
  list=list.filter(item=>!lod||!item.small);
  for (const h of list) { n+=h.v.length; t+=h.idx.length; }
  if (!n||!t) return null;
  const v=new Float32Array(n), idx=new Uint32Array(t), c=new Uint8Array(n/3);
  let vp=0,ip=0;
  for (const h of list) {
    v.set(h.v,vp); c.fill(h.palette,vp/3,(vp+h.v.length)/3);
    for (const i of h.idx) idx[ip++]=i+vp/3;
    vp+=h.v.length;
  }
  let reduced=idx;
  if (lod && t>90) [reduced]=simplify.simplify(idx,v,3,Math.max(12,Math.floor(t/3*.14)*3),.015);
  const runs=surfaceRuns(list,reduced,lod);
  if(runs.length)finishes[lod?'far':'near']=runs;
  const remap=new Int32Array(n/3).fill(-1);
  let verts=0;
  for(const i of reduced) if(remap[i]===-1) remap[i]=verts++;
  const {min,max}=bounds(v), head=Buffer.alloc(32);
  head.writeUInt32LE(verts); head.writeUInt32LE(reduced.length,4);
  min.forEach((x,k)=>head.writeFloatLE(x,8+4*k));max.forEach((x,k)=>head.writeFloatLE(x,20+4*k));
  const coords=new Uint16Array(verts*3), colors=new Uint8Array(verts);
  for (let i=0;i<remap.length;i++) {
    const j=remap[i]; if (j<0) continue;
    for(let k=0;k<3;k++) coords[j*3+k]=Math.round((v[i*3+k]-min[k])*65535/(max[k]-min[k]||1));
    colors[j]=c[i];
  }
  const Index=verts>65535?Uint32Array:Uint16Array;
  return Buffer.concat([head,Buffer.from(coords.buffer),Buffer.from(colors),Buffer.from(Index.from(reduced,i=>remap[i]).buffer)]);
}
function bakeHeight() {
  const size=1024, x0=-512,z0=-512;
  const height=new Float32Array(size*size).fill(-1000), category=new Uint8Array(size*size);
  for (const h of [...terrain,...parts]) {
    const {v,idx}=h;
    for(let i=0;i<idx.length;i+=3) {
      const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
      const ax=v[a]-x0, ay=v[a+2]-z0, bx=v[b]-x0,by=v[b+2]-z0,cx=v[c]-x0,cy=v[c+2]-z0;
      const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
      if(Math.abs(det)<.001)continue;
      for(let y=Math.max(0,Math.ceil(Math.min(ay,by,cy)));y<=Math.min(size-1,Math.max(ay,by,cy));y++) {
        for(let x=Math.max(0,Math.ceil(Math.min(ax,bx,cx)));x<=Math.min(size-1,Math.max(ax,bx,cx));x++) {
          const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det, w=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det;
          if(u<0||w<0||u+w>1)continue;
          const z=u*v[a+1]+w*v[b+1]+(1-u-w)*v[c+1], k=y*size+x;
          if(z>height[k]) {height[k]=z;category[k]=h.palette}
        }
      }
    }
  }
  const buf=Buffer.alloc(size*size*2);
  height.forEach((y,i)=>buf.writeInt16LE(Math.max(-32768,Math.round(y*100)),i*2));
  fs.writeFileSync(path.join(out,'height.gz'),zlib.gzipSync(buf));

}
async function main(){
  await simplify.ready; readGeometry(); placeGeometry(); identifySurfaces(parts); bakeHeight();
  const basin=measureBasin(parts.find(p=>p.instance===4566&&p.id===599));
  fs.writeFileSync(path.join(out,'basin.gz'),zlib.gzipSync(JSON.stringify(basin)));
  const manifest=[];
  const overview=[];
  const surfaces={};
  for(const [key,list] of cells) {
    const finishes={};
    const low=pack(list,true,finishes), full=pack(list,false,finishes);
    const file=key+'.gz';
    if(finishes.near||finishes.far)surfaces[file]=finishes;
    fs.writeFileSync(path.join(out,file),zlib.gzipSync(full,{level:8}));
    if(low) overview.push(low);
    manifest.push({file, overview:!!low,min:[0,1,2].map(k=>full.readFloatLE(8+k*4)),max:[0,1,2].map(k=>full.readFloatLE(20+k*4))});
  }
  fs.writeFileSync(path.join(out,'overview.gz'),zlib.gzipSync(Buffer.concat(overview),{level:8}));
  fs.writeFileSync(path.join(out,'cells.json'),JSON.stringify(manifest));
  fs.writeFileSync(path.join(out,'appearance.gz'),zlib.gzipSync(JSON.stringify(surfaces)));
  console.log({duplicateShells:parts.filter(p=>p.twin).length,windowTriangles:parts.reduce((n,p)=>n+(p.panes?.length||0),0)});
  console.log({hullCount,tileCount,instances:count,cells:cells.size,overviewBytes:fs.statSync(path.join(out,'overview.gz')).size});
}
main().catch(e=>{console.error(e);process.exitCode=1});

