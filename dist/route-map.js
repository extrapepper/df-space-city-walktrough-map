'use strict';
const mapPanel=$('route-map'), mapField=$('map-field'), mapCanvas=$('map-chart');
const chart=mapCanvas.getContext('2d');
let routeMapOpen=false, mapScale=1, mapX=0, mapZ=25, mapDrag=null;
const mapPoint=(x,z)=>[mapField.clientWidth/2+(x-mapX)*mapScale,mapField.clientHeight/2+(z-mapZ)*mapScale];
let selectedLadder=null,selectedSite=null;
let activeMapWalk=null,apartmentPlan=null,apartmentLayer=null,launchPlan=null,launchLayer=null;
function setMapWalk(path){
  activeMapWalk=path;$('map-blue-walk').setAttribute('aria-pressed',String(Boolean(path)));
}
function nearbyMapWalk({x,y,z}){
  if(apartmentPlan&&x>=-220&&x<=-201&&z>=-173&&z<=-155&&y>=-28.55&&y<=-24.2)return apartmentPlan.walk;
  if(x>=51&&x<=83&&z>=-74&&z<=-44&&y>=-35&&y<=-13)return blueHallWalk;
  if(launchPlan&&y>=-25.5&&y<=-13.8){
    const u=-(x+123+z-355)*Math.SQRT1_2,f=(z-355-x-123)*Math.SQRT1_2;
    if(u>=-50.2&&u<=-9&&f>=-34&&f<=-4)return launchPlan.walk;
  }
  return null;
}
function makePlanLayer(plan,fill,background){
  const layer=document.createElement('canvas');layer.width=plan.cols;layer.height=plan.rows;
  const ctx=layer.getContext('2d');
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,plan.cols,plan.rows)}
  for(const [row,start,length,kind] of plan.bands){
    ctx.fillStyle=fill(kind);ctx.fillRect(start,row,length,1);
  }
  return layer;
}
function setLaunchPlan(plan){
  const colors=Array.from({length:89},(_,i)=>{
    const t=i/88;return 'rgb('+[39+57*t,49+67*t,54+64*t].map(Math.round).join(',')+')';
  });
  colors[95]='#435f72';colors[96]='#d1d1bb';
  launchPlan=plan;launchLayer=makePlanLayer(plan,kind=>colors[kind]);
  if(routeMapOpen)paintRouteMap();
}
function setApartmentPlan(plan){
  apartmentPlan=plan;apartmentLayer=makePlanLayer(plan,kind=>kind===2?'#bec6bb':'#424e4c','#192022');
  if(routeMapOpen)paintRouteMap();
}
function drawFloorPlan(plan,layer){
  const {x0,z0,cols,rows,step}=plan,[x,y]=mapPoint(x0,z0);
  chart.save();chart.imageSmoothingEnabled=false;
  chart.drawImage(layer,x,y,cols*step*mapScale,rows*step*mapScale);chart.restore();
}
function drawApartmentPlan(){
  drawFloorPlan(apartmentPlan,apartmentLayer);chart.save();
  const door=balconyDoors.find(d=>d.id===7110);
  if(door){
    const {min,max}=door.bounds,[u,v]=mapPoint(min.x,(min.z+max.z)/2);
    chart.strokeStyle=door.open?'#8dd8bc':'#f1ad73';chart.lineWidth=3;
    chart.beginPath();chart.moveTo(u,v);chart.lineTo(u+(max.x-min.x)*mapScale,v);chart.stroke();
  }
  if(mapScale>=12){
    chart.font='600 12px "Microsoft YaHei",sans-serif';chart.textAlign='center';chart.lineWidth=3;chart.strokeStyle='#283231';chart.fillStyle='#e4ece0';
    for(const [text,x,z] of [['窗边卧室',-214.25,-165.9],['隔壁卧室',-207.15,-165.9],['共用阳台',-211,-171.01],['走廊',-213.4,-156.90],['楼板缺口',-206.0,-158.23]]){
      const [u,v]=mapPoint(x,z);chart.strokeText(text,u,v);chart.fillText(text,u,v);
    }
  }
  chart.restore();
}
function drawMapWalk(path){
  chart.save();chart.beginPath();chart.lineJoin='round';chart.lineCap='round';
  let metres=0;
  for(const [i,[x,z]] of path.entries()){
    const [u,v]=mapPoint(x,z);
    if(!i){chart.moveTo(u,v);continue}
    chart.lineTo(u,v);metres+=Math.hypot(x-path[i-1][0],z-path[i-1][1]);
  }
  chart.strokeStyle='#182321';chart.lineWidth=5.5;chart.stroke();
  chart.strokeStyle='#ffe09a';chart.lineWidth=2.5;chart.stroke();
  const arrows=path===apartmentPlan?.walk?[4,7,8]:path===launchPlan?.walk?[1,3,4,5]:null;
  if(arrows&&mapScale>=6){
    for(const i of arrows){
      const [ax,az]=path[i-1],[bx,bz]=path[i],[cx,cy]=mapPoint((ax+bx)/2,(az+bz)/2);
      chart.save();chart.translate(cx,cy);chart.rotate(Math.atan2(bz-az,bx-ax));
      chart.beginPath();chart.moveTo(-4,-4);chart.lineTo(1,0);chart.lineTo(-4,4);chart.stroke();chart.restore();
    }
  }
  const [u,v]=mapPoint(...path[path.length-1]);
  chart.beginPath();chart.arc(u,v,4,0,Math.PI*2);chart.fillStyle='#ffe09a';chart.fill();chart.restore();
  return metres;
}
function placeExtractionMarkers(w,h){
  const layer=$('map-extraction');
  if(!layer.childElementCount)for(const site of extractionSites){
    const button=document.createElement('button');
    button.className='map-site '+(site.panel?'map-switch':'map-exit');
    button.title=site.name;button.setAttribute('aria-label',site.name);
    const symbol=site.panel?'<path d="M5 16h10M8 12l5-7"/><circle cx="14" cy="4" r="2"/>':'<path d="M9 3H4v14h5m1-7h8m-4-4 4 4-4 4"/>';
    button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true">'+symbol+'</svg>';
    button.onclick=()=>{setMapWalk(null);selectedLadder=null;selectedSite=selectedSite===site?null:site;paintRouteMap()};
    layer.append(button);
  }
  for(const [i,site] of extractionSites.entries()){
    const [x,y]=mapPoint(site.x,site.z),button=layer.children[i];
    button.hidden=!enabledSite(site)||x<0||y<0||x>w||y>h;
    button.style.left=x+'px';button.style.top=y+'px';
    button.setAttribute('aria-pressed',String(selectedSite===site));
    button.classList.toggle('pulled',pulledLevers.has(site.id));
    button.classList.toggle('unlocked',site.id==='helicopter'&&pulledLevers.size>=2);
  }
  const info=$('map-site-info');info.hidden=!selectedSite;
  if(selectedSite){
    info.children[0].textContent=selectedSite.name;
    info.children[1].textContent=selectedSite.detail;
  }
}
function placeLadderMarkers(w,h){
  const layer=$('map-ladders'),info=$('map-ladder-info');
  layer.hidden=mapScale<2.4;
  if(layer.hidden){selectedLadder=null;info.hidden=true;return}
  if(!layer.childElementCount)for(const route of ladders){
    const button=document.createElement('button');button.className='map-ladder';
    button.title=route.region+' · '+route.name;button.setAttribute('aria-label',button.title);
    button.innerHTML='<svg viewBox="0 0 16 18" aria-hidden="true"><path d="M4 2v14m8-14v14M4 5h8M4 9h8M4 13h8"/></svg>';
    button.onclick=()=>{setMapWalk(null);selectedSite=null;selectedLadder=selectedLadder===route?null:route;paintRouteMap()};
    layer.append(button);
  }
  for(const [i,route] of ladders.entries()){
    const [x,y]=mapPoint(route.x,route.z),button=layer.children[i];
    button.hidden=x<0||y<0||x>w||y>h;
    if(button.hidden&&selectedLadder===route&&!route.officePath)selectedLadder=null;
    button.style.left=x+'px';button.style.top=y+'px';
    button.setAttribute('aria-pressed',String(selectedLadder===route));
  }
  info.hidden=!selectedLadder;
  if(selectedLadder){
    const r=selectedLadder;
    info.textContent=r.name+'　'+(r.water?'水面 ':'梯脚 ')+r.bottom.toFixed(1)+' → 上口 '+r.top.toFixed(1)+' m'+(r.headroom?'　蹲姿通行':'');
    if(r.officePath){
      const metres=drawMapWalk(r.officePath);
      info.textContent+='　沿黄线步行约 '+Math.round(metres)+' m 到总裁办公室';
    }
  }
}
function fitRouteMap(){
  const eye=camera.position;
  const left=Math.min(-410,eye.x-30),right=Math.max(395,eye.x+30);
  const top=Math.min(-365,eye.z-30),bottom=Math.max(465,eye.z+30);
  mapX=(left+right)/2;mapZ=(top+bottom)/2;
  mapScale=Math.min(mapField.clientWidth/(right-left),mapField.clientHeight/(bottom-top));
  paintRouteMap();
}
function openRouteMap(){
  if(!glReady||isFlat||view==='orbit'||routeMapOpen)return;
  routeMapOpen=true;mapPanel.hidden=false;setMapWalk(null);
  releaseMouseLook();pointers.clear();mapDrag=null;
  document.activeElement?.blur?.();
  fitRouteMap();$('map-close').focus({preventScroll:true});dirty=true;
}
function closeRouteMap(resumeLook){
  routeMapOpen=false;mapPanel.hidden=true;mapDrag=null;
  $('map-close').blur();dirty=true;
  if(resumeLook&&view==='walk')captureMouseLook();
}
function scaleRouteMap(factor,px=mapField.clientWidth/2,py=mapField.clientHeight/2){
  const old=mapScale;mapScale=clamp(old*factor,.16,activeMapWalk&&activeMapWalk===apartmentPlan?.walk?32:12);
  mapX+=(px-mapField.clientWidth/2)*(1/old-1/mapScale);
  mapZ+=(py-mapField.clientHeight/2)*(1/old-1/mapScale);
  paintRouteMap();
}
function paintRouteMap(){
  if(!routeMapOpen)return;
  const w=mapField.clientWidth,h=mapField.clientHeight,dpr=Math.min(devicePixelRatio,2);
  if(w<1||h<1)return;
  mapCanvas.width=Math.round(w*dpr);mapCanvas.height=Math.round(h*dpr);
  chart.setTransform(dpr,0,0,dpr,0,0);chart.fillStyle='#131a17';chart.fillRect(0,0,w,h);
  const side=1308.85742*mapScale,[cx,cz]=mapPoint(6.87,63.8025);
  chart.drawImage(atlas,cx-side/2,cz-side/2,side,side);
  chart.strokeStyle='rgba(203,222,202,.16)';chart.lineWidth=1;chart.beginPath();
  const spacing=mapScale<.6?200:100;
  for(let x=Math.ceil((mapX-w/(2*mapScale))/spacing)*spacing;x<mapX+w/(2*mapScale);x+=spacing){
    const [u]=mapPoint(x,0);chart.moveTo(u,0);chart.lineTo(u,h);
  }
  for(let z=Math.ceil((mapZ-h/(2*mapScale))/spacing)*spacing;z<mapZ+h/(2*mapScale);z+=spacing){
    const [,v]=mapPoint(0,z);chart.moveTo(0,v);chart.lineTo(w,v);
  }
  chart.stroke();
  if(activeMapWalk){
    if(activeMapWalk===apartmentPlan?.walk)drawApartmentPlan();
    if(activeMapWalk===launchPlan?.walk)drawFloorPlan(launchPlan,launchLayer);
    drawMapWalk(activeMapWalk);
  }
  if(activeMapWalk&&activeMapWalk===launchPlan?.walk&&mapScale>=5){
    chart.save();chart.font='600 12px "Microsoft YaHei",sans-serif';chart.textAlign='left';chart.lineWidth=3.5;
    chart.strokeStyle='#253236';chart.fillStyle='#f0ebd9';
    for(const [i,label,dx,dy] of [[0,'梯脚',9,-8],[2,'中间平台',10,-8],[3,'梯顶',-28,19]]){
      const [px,py]=mapPoint(...activeMapWalk[i]);chart.strokeText(label,px+dx,py+dy);chart.fillText(label,px+dx,py+dy);
    }
    chart.restore();
  }
  placeLadderMarkers(w,h);
  placeExtractionMarkers(w,h);
  chart.font='600 13px "Microsoft YaHei",sans-serif';chart.textAlign='center';chart.lineJoin='round';
  const labels=extractionSites.filter(enabledSite).map(site=>{
    const [x,y]=mapPoint(site.x,site.z);return {x,y,w:28};
  });
  for(const place of points){
    const [x,y]=mapPoint(place.x,place.z);
    const width=chart.measureText(place.name).width;
    if(x<0||y<0||x>w||y>h)continue;
    const pos=[0,-16,16,-32,32].find(offset=>!labels.some(box=>Math.abs(x-box.x)<(box.w+width)/2+6&&Math.abs(y+offset-box.y)<15));
    if(pos===undefined)continue;
    const yy=y+pos;labels.push({x,y:yy,w:width});
    chart.lineWidth=3.6;chart.strokeStyle='#18201b';chart.strokeText(place.name,x,yy);
    chart.fillStyle='#e5eadc';chart.fillText(place.name,x,yy);
  }
  updateMapPosition();
}
function updateMapPosition(){
  if(!routeMapOpen)return;
  const {x,y,z}=camera.position,[px,py]=mapPoint(x,z);
  const available=activeMapWalk||nearbyMapWalk(camera.position),walkButton=$('map-blue-walk');
  walkButton.hidden=!available;
  if(available){
    const label=available===apartmentPlan?.walk?'宿舍阳台路线':available===launchPlan?.walk?'撤离平台路线':'下沉层路线';
    if(walkButton.textContent!==label)walkButton.textContent=label;
  }
  const marker=$('map-player');
  marker.hidden=px<0||py<0||px>mapField.clientWidth||py>mapField.clientHeight;
  marker.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px)';
  marker.firstElementChild.style.transform='rotate('+(-flyYaw)+'rad)';
  $('map-position').textContent='X '+x.toFixed(1)+'　Y '+z.toFixed(1)+'　H '+y.toFixed(1)+' m';
  if(selectedSite){
    const distance=Math.hypot(selectedSite.x-x,selectedSite.z-z);
    const progress=selectedSite.panel||selectedSite.id==='helicopter'?'　拉闸 '+Math.min(2,pulledLevers.size)+'/2':'';
    $('map-site-info').lastElementChild.textContent='水平距离 '+Math.round(distance)+' m'+progress;
  }
}
$('locator').onclick=openRouteMap;$('map-close').onclick=()=>closeRouteMap(true);
$('map-practice').onchange=e=>{setPractice(e.target.value);$('map-close').focus({preventScroll:true})};
$('map-follow').onclick=()=>{mapX=camera.position.x;mapZ=camera.position.z;mapScale=Math.max(mapScale,2.8);paintRouteMap()};
$('map-blue-walk').onclick=()=>{
  setMapWalk(activeMapWalk?null:nearbyMapWalk(camera.position));
  if(activeMapWalk){
    selectedSite=null;selectedLadder=null;
    const xs=activeMapWalk.map(p=>p[0]),zs=activeMapWalk.map(p=>p[1]);
    mapX=(Math.min(...xs)+Math.max(...xs))/2;mapZ=(Math.min(...zs)+Math.max(...zs))/2;
    const apartment=activeMapWalk===apartmentPlan?.walk,margin=apartment?6:14;
    mapScale=Math.min(apartment?24:10,mapField.clientWidth/(Math.max(...xs)-Math.min(...xs)+margin),mapField.clientHeight/(Math.max(...zs)-Math.min(...zs)+margin));
  }
  paintRouteMap();
};
$('map-fit').onclick=fitRouteMap;
$('map-plus').onclick=()=>scaleRouteMap(1.4);$('map-minus').onclick=()=>scaleRouteMap(1/1.4);
mapField.onpointerdown=e=>{if(mapDrag||e.target.closest('button'))return;mapField.setPointerCapture(e.pointerId);mapDrag={id:e.pointerId,x:e.clientX,y:e.clientY}};
mapField.onpointermove=e=>{
  if(mapDrag?.id!==e.pointerId)return;
  mapX-=(e.clientX-mapDrag.x)/mapScale;mapZ-=(e.clientY-mapDrag.y)/mapScale;
  mapDrag.x=e.clientX;mapDrag.y=e.clientY;paintRouteMap();
};
mapField.onpointerup=mapField.onpointercancel=mapField.onlostpointercapture=e=>{if(mapDrag?.id===e.pointerId)mapDrag=null};
mapField.addEventListener('wheel',e=>{
  e.preventDefault();const box=mapField.getBoundingClientRect();
  scaleRouteMap(Math.exp(-clamp(e.deltaY,-160,160)*.002),e.clientX-box.left,e.clientY-box.top);
},{passive:false});
new ResizeObserver(()=>{if(routeMapOpen)paintRouteMap()}).observe(mapField);
