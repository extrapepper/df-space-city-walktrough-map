const groups=[[[8723,1083]], [9166,9171,9231,9236,9246,9251].map(i=>[i,1127]), [[9224,1062]]];
const shells=new Map([[89,[87,88]],[1027,[1023,1024,1025,1026]],[1127,[1123,1124,1125,1126]]]);
const equipment=[
  [1002,18,[8991,8993,9134,9140]],[1004,19,[8997,9136,9138]],
  [1091,20,[8796,8797,8798]],[1080,21,[8716]],[1138,21,[9210,9211,9212]],
  [1395,22,[17188]],[1396,22,[17189]],[1397,22,[17190]],[1067,23,[9276,9288]]
];
const finishes=new Map(equipment.flatMap(([hull,style,items])=>items.map(id=>[id,{hull,style}])));
function prepareCommandRoom(records,firstRole){
  for(const [i,group] of groups.entries())for(const [id,hull] of group){
    const part=records.get(id);
    if(part?.id!==hull)throw Error('Unexpected command room model '+id);
    part.finish=firstRole+i;
  }
  const poster=records.get(9223);
  if(poster.id!==1141||poster.cell!==records.get(9224).cell)throw Error('Unexpected command room billboard');
  poster.twin=records.get(9224);
  for(const [id,{hull}] of finishes){
    const p=records.get(id);
    if(p.id!==hull)throw Error('Unexpected command room furnishing '+id);
    const shells=hull===1002?[1001]:hull===1004?[1003]:hull===1080?[1078,1079]:[];
    for(const [j,type] of shells.entries()){
      const box=records.get(id-shells.length+j);
      if(box.id!==type||box.cell!==p.cell)throw Error('Unexpected storage collision shell '+id);
      box.twin=p;
    }
  }
  for(const id of [9237,9238]){
    const pane=records.get(id);
    if(pane.id!==1144)throw Error('Unexpected H4 observation pane');
    pane.finish=1;
  }
  for(const part of records.values()){
    const sequence=shells.get(part.id);
    if(!sequence||part.id===1127&&!groups[1].some(([id])=>id===part.instance))continue;
    const coarse=sequence.map((_,i)=>records.get(part.instance-sequence.length+i));
    if(coarse.some((p,i)=>p?.id!==sequence[i]))throw Error('Unexpected collision primitives at '+part.instance);
    // Streamed cells can have different visibility. Only hide a primitive
    // when its matching detailed model will be present with it.
    coarse.filter(p=>p.cell===part.cell).forEach(p=>{p.twin=part});
  }
}
function screenPrototype(parts){
  const p=parts.find(p=>p.instance===9031);
  const planters=parts.filter(p=>p.instance===9276||p.instance===9288)
    .map(p=>[(p.min[0]+p.max[0])/2,p.max[1],(p.min[2]+p.max[2])/2].map(v=>+v.toFixed(4)));
  return {positions:Array.from(p.v,v=>+v.toFixed(4)),indices:Array.from(p.idx),planters,
    paint:Array.from(p.freight.coords),copies:[[-3.68,14],[-2.45,17],[-1.22,14],[1.23,17]]};
}
module.exports={groups,finishes,prepareCommandRoom,screenPrototype};
