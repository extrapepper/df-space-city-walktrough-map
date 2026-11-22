// The source is Z-up. Store paint coordinates in the viewer's X, up, Z order,
// before applying the instance transform so even mirrored stacks keep their finish.
const types=new Map([[9,1],[17,2],[63,3],[98,4],[634,5],[604,10],[962,11],[997,12],[1027,13],[89,14]]);
const commandFinishes=require('./command.cjs').finishes;
const variants=new Map([
  [2625,6],[2631,6],[2627,7],[5334,7],
  ...[5722,5724,5736,5738,5740,5744,5746].map(i=>[i,8]),
  ...[5750,5752,5754,5762,5764,5768].map(i=>[i,9]),
  [9031,15],[9182,16]
]);
function freightFinish(hull,id,instance){
  const style=variants.get(instance)||types.get(id)||commandFinishes.get(instance)?.style;
  if(!style)return;
  if(!hull.paint){
    const order=[0,2,1],min=[Infinity,Infinity,Infinity];
    for(let i=0;i<hull.v.length;i++)min[i%3]=Math.min(min[i%3],hull.v[i]);
    hull.paint=new Uint8Array(hull.v.length);
    for(let i=0;i<hull.v.length;i+=3)for(const [axis,k] of order.entries()){
      hull.paint[i+axis]=Math.round((hull.v[i+k]-min[k])/hull.span[k]*255);
    }
  }
  return {coords:hull.paint,style};
}
function packFreight(list,remap,count){
  if(!list.some(p=>p.freight))return;
  const coords=Buffer.alloc(count*4),spans=[],chunks=[];
  let first=0;
  for(const part of list){
    const paint=part.freight,vertices=part.v.length/3;
    if(paint)for(let i=0;i<vertices;i++){
      const dst=remap[first+i];
      if(dst<0)continue;
      const offset=dst*4;
      coords[offset]=paint.coords[3*i];coords[offset+1]=paint.coords[3*i+1];
      coords[offset+2]=paint.coords[3*i+2];coords[offset+3]=paint.style;
    }
    first+=vertices;
  }
  for(let i=0;i<count;){
    if(!coords[4*i+3]){i++;continue}
    const start=i++;
    while(i<count&&coords[4*i+3])i++;
    spans.push([start,i-start]);chunks.push(coords.subarray(4*start,4*i));
  }
  if(spans.length)return {spans,bytes:Buffer.concat(chunks).toString('base64')};
}
module.exports={freightFinish,packFreight};
