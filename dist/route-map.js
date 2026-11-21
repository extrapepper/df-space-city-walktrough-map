'use strict';
const mapPanel=$('route-map'), mapField=$('map-field'), mapCanvas=$('map-chart');
const chart=mapCanvas.getContext('2d');
let routeMapOpen=false, mapScale=1, mapX=0, mapZ=25, mapDrag=null;
const mapPoint=(x,z)=>[mapField.clientWidth/2+(x-mapX)*mapScale,mapField.clientHeight/2+(z-mapZ)*mapScale];
let selectedLadder=null;
function placeLadderMarkers(w,h){
  const layer=$('map-ladders'),info=$('map-ladder-info');
  layer.hidden=mapScale<2.4;
  if(layer.hidden){selectedLadder=null;info.hidden=true;return}
  if(!layer.childElementCount)for(const route of ladders){
    const button=document.createElement('button');button.className='map-ladder';
    button.title=route.region+' · '+route.name;button.setAttribute('aria-label',button.title);
    button.innerHTML='<svg viewBox="0 0 16 18" aria-hidden="true"><path d="M4 2v14m8-14v14M4 5h8M4 9h8M4 13h8"/></svg>';
    button.onclick=()=>{selectedLadder=selectedLadder===route?null:route;placeLadderMarkers(mapField.clientWidth,mapField.clientHeight)};
    layer.append(button);
  }
  for(const [i,route] of ladders.entries()){
    const [x,y]=mapPoint(route.x,route.z),button=layer.children[i];
    button.hidden=x<0||y<0||x>w||y>h;
    if(button.hidden&&selectedLadder===route)selectedLadder=null;
    button.style.left=x+'px';button.style.top=y+'px';
    button.setAttribute('aria-pressed',String(selectedLadder===route));
  }
  info.hidden=!selectedLadder;
  if(selectedLadder){
    const r=selectedLadder;
    info.textContent=r.name+'　'+(r.water?'水面 ':'梯脚 ')+r.bottom.toFixed(1)+' → 上口 '+r.top.toFixed(1)+' m'+(r.headroom?'　蹲姿通行':'');
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
  routeMapOpen=true;mapPanel.hidden=false;
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
  placeLadderMarkers(w,h);
  chart.font='600 13px "Microsoft YaHei",sans-serif';chart.textAlign='center';chart.lineJoin='round';
  const labels=[];
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
  const marker=$('map-player');
  marker.hidden=px<0||py<0||px>mapField.clientWidth||py>mapField.clientHeight;
  marker.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px)';
  marker.firstElementChild.style.transform='rotate('+(-flyYaw)+'rad)';
  $('map-position').textContent='X '+x.toFixed(1)+'　Y '+z.toFixed(1)+'　H '+y.toFixed(1)+' m';
}
$('locator').onclick=openRouteMap;$('map-close').onclick=()=>closeRouteMap(true);
$('map-follow').onclick=()=>{mapX=camera.position.x;mapZ=camera.position.z;mapScale=Math.max(mapScale,2.8);paintRouteMap()};
$('map-fit').onclick=fitRouteMap;
$('map-plus').onclick=()=>scaleRouteMap(1.4);$('map-minus').onclick=()=>scaleRouteMap(1/1.4);
mapField.onpointerdown=e=>{if(mapDrag||e.target.closest('.map-ladder'))return;mapField.setPointerCapture(e.pointerId);mapDrag={id:e.pointerId,x:e.clientX,y:e.clientY}};
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
