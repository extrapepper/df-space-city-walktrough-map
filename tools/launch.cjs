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
module.exports={groups,prepareLaunch,world,walk};
