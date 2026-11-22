const assert=require('node:assert/strict');

// East apartment, including the strip of hallway that both bedrooms open onto.
const walk=[[-216.72,-158.2],[-216.72,-165.1],[-217.46,-165.1],[-217.46,-170.43],[-204.33,-170.43],
  [-204.33,-163.7],[-209.15,-163.7],[-209.15,-158.2],[-216.72,-158.2]];
function sampleApartment(tiles,rays,THREE){
  const x0=-219.68,z0=-172.0,step=.16,cols=110,rows=102;
  const local=tiles.filter(t=>t.max[0]>=x0&&t.min[0]<=x0+cols*step&&t.max[2]>=z0&&t.min[2]<=z0+rows*step);
  const origin=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),east=new THREE.Vector3(1,0,0),south=new THREE.Vector3(0,0,1);
  const cast=(x,y,z,dir,range)=>rays(local,origin.set(x,y,z),dir,range)[0];
  const floor=(x,z)=>cast(x,-26.92,z,down,1.68);
  const bands=[];
  for(let row=0;row<rows;row++){
    const z=z0+(row+.5)*step;
    let start=0,previous=0;
    for(let col=0;col<=cols;col++){
      const x=x0+(col+.5)*step;
      let kind=0;
      if(col<cols){
        const door=x>=-218.04&&x<=-216.54&&Math.abs(z+169.072)<.21;
        const wall=!door&&(cast(x-step*.62,-26.48,z,east,step*1.24)||cast(x,-26.48,z-step*.62,south,step*1.24));
        if(wall)kind=2;
        else if(floor(x,z))kind=1;
      }
      if(kind===previous)continue;
      if(previous)bands.push([row,start,col-start,previous]);
      previous=kind;start=col;
    }
  }
  // Verify a shoulder-width walking strip including the return doorway beside
  // the void. Checks use the packed floor at full resolution, before rasterizing.
  for(let j=1;j<walk.length;j++){
    const [x,z]=walk[j-1],[endX,endZ]=walk[j],dx=endX-x,dz=endZ-z,length=Math.hypot(dx,dz);
    const steps=Math.ceil(length/.13);
    for(let i=0;i<=steps;i++)for(const shoulder of [-.20,0,.20]){
      const px=x+dx*i/steps-dz/length*shoulder,pz=z+dz*i/steps+dx/length*shoulder;
      const support=floor(px,pz);
      assert(support&&Math.abs(support.face.normal.y)>.65,'Missing apartment floor at '+[px,pz]);
    }
  }
  assert(!floor(-208.4,-159.1),'Expected opening beside the east hallway');
  for(const offset of [-.2,0,.2])for(const y of [-27.40,-26.37]){
    assert(!cast(-209.15+offset,y,-161.1,south,2.2),'Obstructed doorway on the way back to the hallway');
  }
  return {x0,z0,step,cols,rows,bands,walk};
}
module.exports={sampleApartment};
