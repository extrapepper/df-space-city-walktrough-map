// In H4 two wide banks, a window blind and the loose equipment can be
// identified individually. Only those two banks replace the freight finish.
const scoped=[
  [604,26,[8868,8870]],[1113,28,[9032]],
  [1540,29,[17000,18637,18730,18733,18827,18836]],
  [1533,29,[17024,18640,18737]],[1389,29,[18738]],
  [1532,30,[17023,18639,18736]],[1541,31,[17001,18638,18731,18734,18828,18837]]
];
const finishes=new Map(scoped.flatMap(([hull,style,ids])=>ids.map(i=>[i,{hull,style}])));
const cabinetShells=new Set([1075,1077,1105,1334,1335,1336,1337,1600]);
function prepareServers(records,labRole){
  for(const [id,hull] of [[10105,1203],[12300,1351]]){
    const shell=records.get(id);
    if(shell?.id!==hull)throw Error('Unexpected server room shell '+id);
    shell.finish=labRole;
  }
  for(const [id,{hull}] of finishes)if(records.get(id)?.id!==hull)throw Error('Unexpected H4 equipment '+id);
  for(const part of records.values())if(part.id===1076){
    const shell=records.get(part.instance-1);
    if(!cabinetShells.has(shell?.id)||shell.idx.length!==36||
       !part.min.every((v,k)=>Math.abs(v-shell.min[k])<.004&&Math.abs(part.max[k]-shell.max[k])<.004))
      throw Error('Unmatched cabinet collision box '+part.instance);
    if(part.cell===shell.cell)shell.twin=part;
  }
  for(const [a,b] of [[15508,18636],[17000,18637],[17001,18638],[17023,18639],[17024,18640],
    [18730,18836],[18731,18837],[18733,18827],[18734,18828]]){
    const first=records.get(a),second=records.get(b);
    if(first.v.length!==second.v.length||first.cell!==second.cell||
        !first.v.every((v,i)=>Math.abs(v-second.v[i])<.003))throw Error('Mismatched server equipment duplicates '+a);
    second.twin=first;
  }
}
function terminalFrames(parts){
  return parts.filter(p=>(p.id===1421||p.id===1697)&&!p.twin).map(p=>{
    function corner(x,y,z){
      const q=p.freight.coords;
      for(let j=0;j<q.length;j+=3)if(q[j]===x&&q[j+1]===y&&q[j+2]===z)return Array.from(p.v.slice(j,j+3));
      throw Error('Missing terminal corner '+p.instance);
    }
    const lo=corner(0,0,255),right=corner(255,0,255),top=corner(0,255,255),back=corner(0,0,0);
    const diff=(a,b)=>a.map((v,k)=>v-b[k]),unit=a=>a.map(v=>+(v/Math.hypot(...a)).toFixed(7));
    return {id:p.instance,foot:lo.map((v,k)=>+((v+right[k])*.5).toFixed(4)),
      right:unit(diff(right,lo)),up:unit(diff(top,lo)),front:unit(diff(lo,back))};
  });
}
module.exports={finishes,prepareServers,terminalFrames};
