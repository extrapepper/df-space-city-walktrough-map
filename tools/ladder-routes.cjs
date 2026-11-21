// Centers, approach normals and bottom/top rung elevations measured on the
// three repeating crossbar hulls (1378, 1380, 1383) in the pinned PhysX scene.
// A second set of coincident bars inside the office belongs to the same shaft.
const columns=[
  ['浮力室','池底黄梯',-46.6043,-44.4338,.00678,.99998,-40.620,-34.922,16],
  ['浮力室','池沿黄梯',-46.9474,-53.4762,-.68976,.72404,-34.633,-28.935,16],
  ['浮力室','东侧层间梯',-29.6869,-41.7596,.99998,-.00679,-23.221,-9.923,36],
  ['黑室','西侧层间梯',31.9944,7.9974,-.99998,.00673,-23.225,-9.928,36],
  ['总裁室','西北侧检修梯',-12.5469,-7.9266,.00678,.99998,-8.020,-3.842,12],
  ['码头区','南侧平台梯',-51.5256,150.1294,-.70233,.71185,-33.276,-27.578,16],
  ['码头区','西侧平台梯',-92.7932,115.5666,-.71185,-.70233,-28.275,-22.577,16],
  ['码头区','南侧栈桥水梯',-7.4908,226.5459,.01973,-.99981,-41.060,-25.482,42]
];
function measureRoutes({THREE,tiles,rays,up,down,water}){
  const size=water.readUint32LE(0),origin=water.readFloatLE(4),spacing=water.readFloatLE(8),sea=water.readFloatLE(12);
  const round=n=>+n.toFixed(3);
  return columns.map(([region,name,x,z,nx,nz,lo,hi,rungs])=>{
    function sample(offset,across,y){
      return new THREE.Vector3(x+nx*offset+nz*across,y,z+nz*offset-nx*across);
    }
    function landing(offset,rung){
      const p=sample(offset,0,rung+.6);
      const floor=rays(tiles,p,down,28)[0];
      if(!floor||Math.abs(floor.face.normal.y)<.85)throw Error(name+' has no usable landing');
      const surface=floor.point.y;
      const col=Math.floor((p.x-origin)/spacing),row=Math.floor((p.z-origin)/spacing);
      if(water[16+row*size+col] && surface<sea-1.7 && Math.abs(rung-sea)<1){
        return {height:sea,water:true};
      }
      if(Math.abs(surface-rung)>1.45)throw Error('Rungs do not meet '+name);
      let clearance=3;
      for(const across of [-.2,0,.2]){
        const foot=sample(offset,across,surface+.18),support=rays(tiles,foot,down,.34)[0];
        if(!support||Math.abs(support.point.y-surface)>.14)throw Error('Uneven landing at '+name);
        foot.y=support.point.y+.03;
        const overhead=rays(tiles,foot,up,3)[0];
        if(overhead)clearance=Math.min(clearance,overhead.distance+.03);
      }
      if(clearance<1.32)throw Error('Unusable headroom at '+name);
      return {height:round(surface),clearance:round(clearance)};
    }
    const lower=landing(.67,lo),upper=landing(-.77,hi);
    for(const across of [-.18,0,.18]){
      if(rays(tiles,sample(.48,across,lo+.55),up,hi-lo+.8).length)throw Error('Blocked ladder at '+name);
    }
    return {region,name,x,z,nx,nz,rungs,bottom:lower.height,top:upper.height,
      ...(lower.water?{water:true}:{}),...(upper.clearance<1.87?{headroom:upper.clearance}:{})};
  });
}
module.exports={measureRoutes};
