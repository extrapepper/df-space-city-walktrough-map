// Face assignments for the fourth-floor lobby. The sofas, armchairs, tables
// and both lightboxes are separate meshes in the source collision scene.
const groups=[
  [[11621,1314]],
  [[11586,1311],[11587,1311],[11588,1312],[11589,1311],[11590,1311],[11591,1312]],
  [[11747,1299],[11750,1299]],
  [[11748,1321],[11749,1322]],
  [[1342,298],[1359,303]]
];
function prepareSuite(records,first){
  for(const [role,group] of groups.entries())for(const [instance,hull] of group){
    const p=records.get(instance);
    if(p?.id!==hull)throw Error('Unexpected executive lobby mesh '+instance);
    p.finish=first+role;
  }
  const pane=records.get(8439),barrier=records.get(72);
  if(pane?.id!==304||barrier?.id!==0||Math.abs(pane.min[2]+2.19)>.015||Math.abs(barrier.min[2]+2.182)>.015)
    throw Error('Unexpected sculpture observation glass');
  pane.finish=1;barrier.finish=2;
  for(const start of [1335,1352])for(let i=0;i<7;i++){
    const pane=records.get(start+i);
    if(pane?.id!==297||pane.idx.length!==12||pane.max[0]-pane.min[0]>.025)
      throw Error('Unmatched executive bridge window '+(start+i));
    pane.finish=1;
  }
  for(const p of records.values())if(p.id===95){
    const box=records.get(p.instance-1);
    if(box?.id!==94||!p.min.every((lo,k)=>Math.abs(lo-box.min[k])<.012&&Math.abs(p.max[k]-box.max[k])<.012))
      throw Error('Unmatched strapped crate '+p.instance);
    if(p.cell===box.cell)box.twin=p;
  }
}
module.exports={groups,prepareSuite};
