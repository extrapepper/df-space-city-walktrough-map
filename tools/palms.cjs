const assert=require('node:assert/strict');
const counts=[110,85,208,8],faces=[202,310,304,352];
function isPalm(part){return part.id>=1384 && part.id<=1387}
function cap(part,fraction,tolerance){
  const height=part.max[1]-part.min[1],y=part.min[1]+height*fraction;
  let xLow=Infinity,xHigh=-Infinity,zLow=Infinity,zHigh=-Infinity;
  for(let i=0;i<part.v.length;i+=3){
    if(Math.abs(part.v[i+1]-y)>height*tolerance)continue;
    xLow=Math.min(xLow,part.v[i]);xHigh=Math.max(xHigh,part.v[i]);
    zLow=Math.min(zLow,part.v[i+2]);zHigh=Math.max(zHigh,part.v[i+2]);
  }
  const center=[(xLow+xHigh)/2,fraction===1?part.max[1]:part.min[1],(zLow+zHigh)/2];
  assert(center.every(Number.isFinite),'Missing trunk cap '+part.instance);
  return center.map(v=>+v.toFixed(3));
}
function collectPalms(parts){
  const native=parts.filter(isPalm).map(p=>{
    assert.equal(p.idx.length,3*faces[p.id-1384]);
    return {id:p.instance,hull:p.id,foot:cap(p,.035,.05),tip:cap(p,1,.015)};
  });
  assert.deepEqual(counts.map((_,k)=>native.filter(p=>p.hull===1384+k).length),counts);
  assert(native.every((t,i)=>t.id===12947+i));
  // Two planters in the control forecourt. Triangulated bark junctions in 15 frames
  // of the 2024 official flyover, with roots extended to the planter surface.
  const courtyard=[
    {foot:[-21.03,-32.77,-199.39],tip:[-21.61,-22.34,-197.73],radius:3.43},
    {foot:[-12.11,-32.77,-197.95],tip:[-14.76,-19.28,-200.21],radius:4.30},
    {foot:[16.27,-32.77,-200.14],tip:[14.26,-17.43,-196.08],radius:4.23},
    {foot:[25.34,-33.52,-196.72],tip:[24.58,-23.53,-196.23],radius:5.31}
  ];
  return {native,courtyard};
}
module.exports={isPalm,collectPalms,counts,faces};
