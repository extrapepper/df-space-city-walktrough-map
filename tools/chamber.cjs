// The pressure door and its supporting frame are separate source instances
// from the central test article and its two manipulators.
const groups=[
  [[8721,1081],[9262,1145]],
  [[9160,1132]],
  [[1237,270],[9161,1133]],
  Array.from({length:10},(_,j)=>[8955+j,[1099,1100,1101,1102,1099,1100,1101,1102,1103,1103][j]]),
  [[1242,272]],
  [[9263,1146]],
  [[1234,267]],
  [[1232,228]]
];
function prepareChamber(records,firstRole){
  groups.forEach((members,kind)=>{
    for(const [instance,hull] of members){
      const p=records.get(instance);
      if(p?.id!==hull)throw Error('Mismatched H4 model '+instance);
      if(instance!==1234){p.finish=firstRole+kind;continue}
      // Hull 267 also encloses the upper floors. Only coat the hall-facing
      // walls, gallery and pressure tunnel of this shared building mesh.
      const faces=[];
      for(let i=0;i<p.idx.length;i+=3){
        const a=p.idx[i]*3,b=p.idx[i+1]*3,c=p.idx[i+2]*3;
        const [x,y,z]=[0,1,2].map(k=>(p.v[a+k]+p.v[b+k]+p.v[c+k])/3);
        if(y>1.8||y< -29.81||z>26.98)continue;
        if(z< -2.76||(x<30.05||x>77.15)||z>26.55||
           (y> -25.47&&y< -24.72&&x<36.6))faces.push(i/3);
      }
      p.coating={faces,role:firstRole+kind};
    }
  });
}
module.exports={prepareChamber,groups};
