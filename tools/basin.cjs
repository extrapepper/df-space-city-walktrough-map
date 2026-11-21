// Intersect the measured vessel with horizontal planes. A ray stops at the first
// inner wall, so the outer service passages never become part of the pool.
function measureBasin(shell){
  const center=[-62.247,-36.252],full=-29.28,steps=256;
  const {v,idx}=shell,faces=[];
  const levels=new Set();
  let floor=-Infinity;
  for(let f=0;f<idx.length;f+=3){
    const tri=[0,1,2].map(k=>Array.from(v.subarray(idx[f+k]*3,idx[f+k]*3+3)));
    const ys=tri.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys);
    if(hi-lo>.0001)faces.push({tri,lo,hi});
    if(hi< -88.9){
      const [a,b,c]=tri,ax=b[0]-a[0],az=b[2]-a[2],bx=c[0]-a[0],bz=c[2]-a[2];
      const dx=center[0]-a[0],dz=center[1]-a[2],det=ax*bz-az*bx;
      if(Math.abs(det)>1e-8){
        const u=(dx*bz-dz*bx)/det,w=(ax*dz-az*dx)/det;
        if(u>=0&&w>=0&&u+w<=1)floor=Math.max(floor,a[1]+u*(b[1]-a[1])+w*(c[1]-a[1]));
      }
    }
    for(const y of ys)if(y<full)levels.add(Math.round(y*1000)/1000);
  }
  // At the middle of the shaft the upper face of the bottom slab is the start.
  if(!Number.isFinite(floor))throw Error('Missing buoyancy shaft floor');
  const breaks=[floor];
  for(const y of [...levels].sort((a,b)=>a-b))if(y>breaks.at(-1)+.015&&y<full-.015)breaks.push(y);
  breaks.push(full);
  const profiles=[],profileIds=new Map();
  function section(y){
    const segments=[];
    for(const {tri,lo,hi} of faces){
      if(y<=lo||y>=hi)continue;
      const ends=[];
      for(let j=0;j<3;j++){
        const a=tri[j],b=tri[(j+1)%3];
        if((a[1]>y)===(b[1]>y))continue;
        const w=(y-a[1])/(b[1]-a[1]);
        ends.push([a[0]+w*(b[0]-a[0])-center[0],a[2]+w*(b[2]-a[2])-center[1]]);
      }
      if(ends.length===2)segments.push(ends);
    }
    const radii=[];
    for(let j=0;j<steps;j++){
      const a=2*Math.PI*j/steps,dx=Math.cos(a),dz=Math.sin(a);
      let near=Infinity;
      for(const [[x,z],[x1,z1]] of segments){
        const sx=x1-x,sz=z1-z,det=dx*sz-dz*sx;
        if(Math.abs(det)<1e-9)continue;
        const t=(x*sz-z*sx)/det,u=(x*dz-z*dx)/det;
        if(t>0 && u>=-1e-7 && u<=1+1e-7)near=Math.min(near,t);
      }
      if(!(near>4&&near<32))throw Error('Open or obstructed buoyancy shell at '+y);
      radii.push(Math.round(near*100));
    }
    const key=radii.join(',');
    if(!profileIds.has(key)){profileIds.set(key,profiles.length);profiles.push(radii)}
    return profileIds.get(key);
  }
  const layers=[];
  for(let i=1;i<breaks.length;i++){
    const low=breaks[i-1],high=breaks[i],epsilon=Math.min(.003,(high-low)/4);
    const a=section(low+epsilon),b=section(high-epsilon),last=layers.at(-1);
    if(a===b&&last&&last[2]===a&&last[3]===b)last[1]=high;
    else layers.push([low,high,a,b]);
  }
  return {center,full,profiles,layers};
}
module.exports={measureBasin};
