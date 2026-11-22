const assert=require('node:assert/strict');
// The transport platform, the return ring, and the tower are distinct structures.
const groups=[
  [[15251,1585]],[[15185,1576]],[[15184,1575]],
  [[15187,1578],[15188,1578],[15189,1578],[15190,1578]],
  [[15253,1587]],[[15250,1584]]
];
function prepareLaunch(parts,firstRole){
  const records=new Map(parts.map(p=>[p.instance,p]));
  for(const [i,group] of groups.entries())for(const [id,hull] of group){
    const p=records.get(id);assert.equal(p.id,hull);p.finish=firstRole+i;
  }
  const ring=records.get(15185);
  assert(Math.abs((ring.min[0]+ring.max[0])/2+123.04875)<.005);
  assert(Math.abs((ring.min[2]+ring.max[2])/2-355.025)<.005);
  // Convex collision blocks around the tower braces and head overlap the
  // detailed tower. The packed terrain still contains every collision face.
  for(let id=15179;id<=15183;id++){
    const coarse=records.get(id);assert.equal(coarse.id,id-13609);
    assert.equal(coarse.idx.length,36);coarse.twin=records.get(15184);
  }
}
function world(u,f){return {x:-123-(u+f)*Math.SQRT1_2,z:355+(f-u)*Math.SQRT1_2}}
const walk=[[-13.15,-30],[-13.15,-20.60],[-15.26,-20.60],[-15.26,-11.50],[-31.80,-11.50],[-33.34,-18.98]];
function sampleLaunchPlan(tiles,rays,THREE){
  const x0=-116,z0=336,step=.26,cols=212,rows=202;
  const near=tiles.filter(t=>t.max[0]>=x0&&t.min[0]<=x0+cols*step&&t.max[2]>=z0&&t.min[2]<=z0+rows*step);
  const down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0),origin=new THREE.Vector3(),bands=[];
  for(let row=0;row<rows;row++){
    const z=z0+(row+.5)*step;let start=0,previous=0;
    for(let col=0;col<=cols;col++){
      const x=x0+(col+.5)*step,u=-(x+123+z-355)*Math.SQRT1_2,f=(z-355-x-123)*Math.SQRT1_2;
      let kind=0;
      if(col<cols&&u>=-49.1&&u<=-10.3&&f>=-32.6&&f<=-5.25){
        const hits=rays(near,origin.set(x,-15.2,z),down,10.55,false);
        for(const h of hits){
          if(Math.abs(h.face.normal.y)<.70||h.point.y> -16.7)continue;
          if(rays(near,origin.set(x,h.point.y+.08,z),up,1.79).length)continue;
          // Encode walkable heights in decimetres. The top two codes preserve
          // the blue painted disk independently of shading on the lower level.
          const r=Math.hypot(u+32.70,f+18.77);
          kind=h.point.y> -17.8&&h.point.y< -17.55&&r<6.4?(r<6.15?95:96):
            1+Math.min(87,Math.max(0,Math.round((h.point.y+25.25)*10)));
          break;
        }
      }
      if(previous===kind)continue;
      if(previous)bands.push([row,start,col-start,previous]);
      previous=kind;start=col;
    }
  }
  const path=walk.map(([u,f])=>{const {x,z}=world(u,f);return [+x.toFixed(3),+z.toFixed(3)]});
  const codes=path.map(([x,z])=>{
    const row=Math.floor((z-z0)/step),col=Math.floor((x-x0)/step);
    return bands.find(([i,j,n])=>i===row&&col>=j&&col<j+n)?.[3];
  });
  assert.deepEqual(codes,[2,42,42,83,77,95]);
  assert(bands.every(([row,start,n])=>row>0&&row<rows-1&&start>0&&start+n<cols));
  return {x0,z0,step,cols,rows,bands,walk:path};
}
module.exports={groups,prepareLaunch,world,walk,sampleLaunchPlan};
