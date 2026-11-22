const assert=require('node:assert/strict');
const roomIds=[7159,7160,7161],doorIds=[7110,7088,7091];
function dormitory(parts){
  const records=new Map(parts.map(p=>[p.instance,p]));
  const rooms=roomIds.map(id=>{
    const p=records.get(id);assert.equal(p.id,929);assert.equal(p.idx.length,210*3);
    // Vertices 1 and 9 are the ends of the same horizontal balcony-wall sill.
    const a=Array.from(p.v.slice(3,6)),b=Array.from(p.v.slice(27,30));
    const length=Math.hypot(b[0]-a[0],b[2]-a[2]);assert(Math.abs(length-10.615)<.006);
    const right=[b[0]-a[0],b[2]-a[2]].map(v=>Math.round(v/length));
    return {id,right,origin:[a[0]+right[0]*5.395,a[1]+.002,a[2]+right[1]*5.395].map(v=>+v.toFixed(4))};
  });
  const windows=parts.filter(p=>p.id>=865&&p.id<=867).map(p=>({
    id:p.instance,hull:p.id,min:p.min.map(v=>+v.toFixed(4)),max:p.max.map(v=>+v.toFixed(4))
  }));
  assert.deepEqual([865,866,867].map(h=>windows.filter(p=>p.hull===h).length),[5,5,3]);
  const doors=doorIds.map((id,index)=>{
    const segments=[0,1,2].map(j=>{
      const p=records.get(id+j);assert.equal(p.id,(id===7088?916:827)+j);assert.equal(p.idx.length,36);
      return {min:p.min.map(v=>+v.toFixed(4)),max:p.max.map(v=>+v.toFixed(4)),
        vertices:Array.from(p.v,v=>+v.toFixed(4)),indices:Array.from(p.idx)};
    });
    return {id,room:index?7160:7159,slide:index===2?-1:1,segments};
  });
  return {rooms,windows,doors};
}
function prepareDorm(parts,firstRole){
  const data=dormitory(parts),records=new Map(parts.map(p=>[p.instance,p]));
  data.windows.forEach((w,i)=>records.get(w.id).finish=firstRole+i);
  const curtainRole=firstRole+data.windows.length;
  for(const p of parts.filter(p=>p.id===928)){
    const backing=records.get(p.instance-1);assert.equal(backing.id,927);
    assert.equal(backing.cell,p.cell);
    backing.twin=p;p.finish=curtainRole;
  }
  data.rooms.forEach((r,i)=>records.get(r.id).finish=curtainRole+1+i);
  const railRole=curtainRole+1+data.rooms.length;
  for(const [i,instance] of [7083,7162,7158].entries()){
    const shell=records.get(instance),{origin,right}=data.rooms[i],railFaces=[],windowFrames=[];
    for(let j=0;j<shell.idx.length;j+=3){
      let high=-Infinity,onRail=true,onFrame=true;
      for(const index of shell.idx.subarray(j,j+3)){
        const x=shell.v[3*index]-origin[0],h=shell.v[3*index+1]-origin[1],z=shell.v[3*index+2]-origin[2];
        const u=x*right[0]+z*right[1],v=z*right[0]-x*right[1];
        if(Math.abs(v+2.70)>.040||Math.abs(u)>7.8||h<-.025||h>.98)onRail=false;
        if(v<=-.248||v>=-.06||h<=-.01||h>=3.21||u<=-4.92||u>=5.24)onFrame=false;
        high=Math.max(high,h);
      }
      if(onRail&&high>.20)railFaces.push(j/3);
      if(onFrame)windowFrames.push(j/3);
    }
    assert.equal(railFaces.length,40,'Balcony top rail and its posts '+instance);
    assert.equal(windowFrames.length,400,'Two balcony window frames '+instance);
    shell.coating={faces:[...railFaces,...windowFrames],role:railRole};
  }
  const movingRole=railRole+1;
  for(const door of data.doors)door.segments.forEach((_,j)=>records.get(door.id+j).finish=movingRole);
  return data;
}
module.exports={prepareDorm};
