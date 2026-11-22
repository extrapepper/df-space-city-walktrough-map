// Fixed instance and hull pairs in the H4 public entrance hall.
const groups=[
  [[1230,265],[1159,250]],
  [[8795,1090]],
  [[8689,1073]],
  [[8725,1085],[8726,1085],[8727,1043],[10553,1085],[10554,1085]],
  [[1235,268]],
  [[8878,228],[8887,746],[1233,266]],
  [[1195,79],[1200,79],[1205,75],[8853,79]],
  [[10536,1090]],[[10603,1073]],[[15819,1073]]
];
function prepareFoyer(records,firstRole){
  for(const [kind,group] of groups.entries()){
    for(const [id,hull] of group){
      const part=records.get(id);
      if(part?.id!==hull)throw Error('Unexpected foyer hull '+id);
      if(id!==1233){part.finish=firstRole+kind;continue}
      // The south door frames share a mesh with other parts of the facade.
      const faces=[];
      for(let f=0;f<part.idx.length;f+=3){
        const v=[0,1,2].map(k=>part.idx[f+k]*3);
        if(v.every(j=>part.v[j]>=65.64&&part.v[j]<=81.29&&part.v[j+2]>=45.10))faces.push(f/3);
      }
      part.coating={faces,role:firstRole+kind};
    }
  }
  const shellsByDisplay=[[8795,[1088,1089]],[10536,[1088,1089]],
    ...[8689,10603,15819].map(id=>[id,[1070,1071,1072]]),
    ...[1195,1200,8853].map(id=>[id,[76,76,77,78]]),[1205,[71,72,73,74]],[8887,[745]]];
  for(const [fine,shells] of shellsByDisplay){
    const visible=records.get(fine);
    for(const [k,hull] of shells.entries()){
      const id=fine-shells.length+k;
      const shell=records.get(id);
      if(shell?.id!==hull||shell.cell!==visible.cell)throw Error('Unexpected foyer collision shell '+id);
      shell.twin=visible;
    }
  }
  for(const {instance,reference,matrix:m} of require('../dist/data/foyer.json').frames){
    const a=records.get(instance),b=records.get(reference);
    if(a.id!==b.id||a.v.length!==b.v.length)throw Error('Mismatched foyer display');
    for(let j=0;j<a.v.length;j+=3)for(let k=0;k<3;k++){
      const i=k*4,coordinate=m[i]*a.v[j]+m[i+1]*a.v[j+1]+m[i+2]*a.v[j+2]+m[i+3];
      if(Math.abs(coordinate-b.v[j+k])>.0001)throw Error('Incorrect display transform '+instance);
    }
  }
}
module.exports={groups,prepareFoyer};
