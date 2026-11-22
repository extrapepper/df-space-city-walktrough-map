'use strict';
const mapPanel=$('route-map'), mapField=$('map-field'), mapCanvas=$('map-chart');
const chart=mapCanvas.getContext('2d');
let routeMapOpen=false, mapScale=1, mapX=0, mapZ=25, mapDrag=null;
const mapPoint=(x,z)=>[mapField.clientWidth/2+(x-mapX)*mapScale,mapField.clientHeight/2+(z-mapZ)*mapScale];
let selectedLadder=null,selectedSite=null;
let showBlueWalk=false;
function setBlueWalk(active){
  showBlueWalk=active;$('map-blue-walk').setAttribute('aria-pressed',String(active));
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
    button.onclick=()=>{setBlueWalk(false);selectedLadder=null;selectedSite=selectedSite===site?null:site;paintRouteMap()};
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
    button.onclick=()=>{setBlueWalk(false);selectedSite=null;selectedLadder=selectedLadder===route?null:route;paintRouteMap()};
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
  routeMapOpen=true;mapPanel.hidden=false;setBlueWalk(false);
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
  const old=mapScale;mapScale=clamp(old*factor,.16,12);
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
  if(showBlueWalk&&blueHallWalk)drawMapWalk(blueHallWalk);
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
  $('map-blue-walk').hidden=!blueHallWalk||(!showBlueWalk&&(x<51||x>83||z< -74||z> -44||y< -35||y> -13));
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
  setBlueWalk(!showBlueWalk);
  if(showBlueWalk){
    selectedSite=null;selectedLadder=null;
    const xs=blueHallWalk.map(p=>p[0]),zs=blueHallWalk.map(p=>p[1]);
    mapX=(Math.min(...xs)+Math.max(...xs))/2;mapZ=(Math.min(...zs)+Math.max(...zs))/2;
    mapScale=Math.min(10,mapField.clientWidth/(Math.max(...xs)-Math.min(...xs)+14),mapField.clientHeight/(Math.max(...zs)-Math.min(...zs)+14));
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
