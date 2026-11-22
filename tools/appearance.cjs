// Source face numbers refer to the revision checked by prepare.cjs. The registered
// game views identify the inclined control-room panes and the curved dormitory bays.
const windowFaces = new Map([
  [100, [1535,1536,1539,1540,1543,1544,1559,1560,1563,1564,1567,1568,1582,1583,1586,1587,1590,1591]],
  [101, [1563,1564,1567,1568,1571,1572,1587,1588,1591,1592,1595,1596,1611,1612,1615,1616,1619,1620]],
  [819, [2055,2056,2057,2058,2077,2078,2117,2118,2119,2120,2315,2316,2324,2325,2369,2370,2371,2372,2391,2392]]
]);
// These sixteen faces sit 4–15 cm behind the same two curved dormitory bays.
// The remaining faces of hull 818 also describe opaque parts of the building.
const dormWindowBacking=[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
const cabins=require('../dist/data/lab-equipment.json');
const cabinFinishes=new Map(cabins.map((c,index)=>[c.instance,{role:4+index,hull:c.hull}]));
// Visually inspected low/high shape pairs. Bounds alone also match unrelated objects.
const twins = new Map([
  [9,[8]], [17,[16]], [634,[633,1462]], [255,[254,628,1096]],
  [63,[62,221,563,431,364]], [249,[248]], [89,[87]], [484,[483]],
  [6,[1]], [13,[164,170]], [847,[846]], [49,[48]], [166,[165]],
  [53,[52]], [1054,[1053]], [1076,[1077]], [1022,[1021]]
]);
function matchingBounds(a,b) {
  // A paired surface must load and unload with its visible counterpart.
  if(a.cell!==b.cell)return false;
  return a.min.every((low,k) => {
    const limit = Math.min(.6,(b.max[k]-b.min[k])*.2+.07);
    return Math.abs(low-b.min[k])<limit && Math.abs(a.max[k]-b.max[k])<limit;
  });
}
function identifySurfaces(parts) {
  const records = new Map(parts.map(p => [p.instance,p]));
  let nextCabinet=5+cabins.length;
  const firstRoom=nextCabinet+parts.filter(p=>p.cabinetFrame).length;
  require('../dist/data/training-rooms.json').surfaces.forEach((group,i)=>{
    for(const [instance,hull] of group){
      const part=records.get(instance);
      if(part?.id!==hull)throw Error('Unmatched training room model '+instance);
      part.finish=firstRoom+i;
    }
  });
  for (const part of parts) {
    part.panes = windowFaces.get(part.id);
    if(part.id===818)part.backing=dormWindowBacking;
    if (part.id === 1022) part.finish = 3;
    const cabin=cabinFinishes.get(part.instance);
    if(cabin && cabin.hull===part.id)part.finish=cabin.role;
    if(part.id>=1378&&part.id<=1383)part.finish=4+cabins.length;
    if(part.cabinetFrame)part.finish=nextCabinet++;
    const candidates = twins.get(part.id);
    if (!candidates) continue;
    const reach = part.id === 6 ? 5 : 2;
    for (let d=-reach; d<=reach; d++) {
      const coarse = records.get(part.instance+d);
      if (!coarse || !candidates.includes(coarse.id) || !matchingBounds(coarse,part)) continue;
      coarse.twin = part;
      if (part.id === 6 && d === -5) {
        // Four smaller boxes in this source record sequence cover the wheels.
        for (let j=1; j<=4; j++) {
          const wheel = records.get(coarse.instance+j);
          if (wheel?.id === 1+j && wheel.cell===part.cell && wheel.min.every((v,k) => v>=part.min[k]-.4 && wheel.max[k]<=part.max[k]+.4)) wheel.twin=part;
        }
      }
    }
  }
}
// Runs reference triangle offsets in the original index buffer. The packed meshes
// retain all their original vertices and triangles for collision and reproduction.
function surfaceRuns(list,index,lod) {
  if (!list.some(h => h.twin || h.panes || h.backing || h.finish)) return [];
  const roles = new Uint8Array(index.length/3);
  const owners = lod ? new Uint32Array(list.reduce((s,h) => s+h.v.length/3,0)) : null;
  const faceMaterials = lod ? new Uint8Array(owners.length) : null;
  let vert=0,face=0;
  for (const [owner,h] of list.entries()) {
    const count=h.idx.length/3,vertices=h.v.length/3,role=h.twin?2:h.finish||0;
    if (lod) owners.fill(owner,vert,vert+vertices);
    else if (role) roles.fill(role,face,face+count);
    const faces=h.panes||h.backing, coating=h.backing?2:1;
    for (const f of faces || []) {
      if (!lod) roles[face+f]=coating;
      else for (let j=0;j<3;j++) faceMaterials[vert+h.idx[3*f+j]]=coating;
    }
    vert+=vertices; face+=count;
  }
  if (lod) {
    const present = new Set();
    for (let i=0;i<index.length;i+=3) {
      const a=owners[index[i]];
      if (a===owners[index[i+1]] && a===owners[index[i+2]]) present.add(list[a]);
    }
    for (let i=0;i<index.length;i+=3) {
      const a=index[i],b=index[i+1],c=index[i+2],h=list[owners[a]];
      if (owners[a]!==owners[b] || owners[a]!==owners[c]) continue;
      if (h.twin && present.has(h.twin)) roles[i/3]=2;
      else if (h.finish) roles[i/3]=h.finish;
      else if (faceMaterials[a] && faceMaterials[a]===faceMaterials[b] && faceMaterials[a]===faceMaterials[c]) roles[i/3]=faceMaterials[a];
    }
  }
  const runs=[];
  for (let i=0;i<roles.length;) {
    const start=i,role=roles[i++];
    while (i<roles.length && roles[i]===role) i++;
    if (role) runs.push([start,i-start,role]);
  }
  return runs;
}
module.exports={identifySurfaces,surfaceRuns};
