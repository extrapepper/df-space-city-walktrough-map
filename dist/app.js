'use strict';
const flat=$('flat'), ctx=flat.getContext('2d');
let flatX=0,flatZ=28,flatScale=1,previousTime=0,pinch=null;
let mouseLookFallback=false, lookRequest=0;
const finePointer=matchMedia('(any-pointer: fine)');
function moveLook(dx,dy){
  if(!dx&&!dy)return;
  flyYaw-=dx*.0026;flyPitch=clamp(flyPitch-dy*.0026,-1.53,1.53);
  camera.rotation.set(flyPitch,flyYaw,0,'YXZ');dirty=true;
}
async function captureMouseLook(){
  if(!finePointer.matches||routeMapOpen||document.pointerLockElement===viewport)return;
  const order=++lookRequest;
  mouseLookFallback=true;
  try{
    if(viewport.requestPointerLock)await viewport.requestPointerLock();
  }catch{/* Embedded browsers can still turn the camera on ordinary mouse movement. */}
  if(order===lookRequest)syncMode();
}
function releaseMouseLook(){
  lookRequest++;mouseLookFallback=false;
  if(document.pointerLockElement===viewport)document.exitPointerLock();
}
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===viewport){
    if(routeMapOpen||isFlat||view!=='walk'&&!awaitingLanding){releaseMouseLook();return}
  }else if(!routeMapOpen){keys.clear();jumpPending=false}
  mouseLookFallback=false;syncMode();
});
document.addEventListener('mousemove',e=>{
  if(view==='walk'&&!isFlat&&!routeMapOpen&&document.pointerLockElement===viewport)moveLook(e.movementX,e.movementY);
});
function enterWalk(arrival){
  const result=changeView('walk',arrival);
  captureMouseLook();
  result.then(()=>{if(view!=='walk')releaseMouseLook()});
}
function syncMode(){
  for(const id of ['orbit','fly','walk']) {
    const button=$(id);button.classList.toggle('on',!isFlat&&view===id);button.setAttribute('aria-pressed',String(!isFlat&&view===id));button.disabled=!glReady;
  }
  $('mode2').classList.toggle('on',isFlat);$('mode3').classList.toggle('on',!isFlat);
  $('mode3').disabled=!glReady;$('enter-here').disabled=!glReady;
  $('locator').hidden=isFlat||view==='orbit';
  stage.classList.toggle('immersive',!isFlat&&view!=='orbit');
  if(grid)grid.visible=view==='orbit';
  $('navigation').hidden=isFlat;$('touchpad').hidden=isFlat||view==='orbit'||!matchMedia('(pointer: coarse)').matches;$('vertical').hidden=view!=='fly'&&!swimming;
  $('view-label').textContent=isFlat?'俯视全图':view==='walk'?(climbing?'正在攀梯':swimming?'水中探索':crouched?'蹲姿探索':'步行探索'):view==='fly'?'自由飞行':chosen?'区域环绕':'全域总览';
  $('touch-jump').hidden=view!=='walk'||swimming||!!climbing;
  $('touch-crouch').hidden=$('touch-jump').hidden;$('touch-crouch').setAttribute('aria-pressed',String(crouched));
  const look=document.pointerLockElement===viewport||mouseLookFallback?'移动鼠标环顾':'点击场景启用鼠标环顾';
  $('hint').textContent=isFlat?'拖动平移 · 滚轮缩放':view==='orbit'?'拖动旋转 · 滚轮缩放':view==='fly'?'WASD 移动 · E / Q 升降 · M 大地图':swimming?'WASD 游动 · E 上浮 · Q 下潜 · M 大地图':finePointer.matches?look+' · 空格跳跃 · Shift 奔跑 · M 大地图':'拖动环顾 · 轻触小地图查看全图';
  if(climbing&&view==='walk'&&!isFlat)$('hint').textContent='前进上梯 · 后退下梯 · F 松开';
}
function updateHUD(x,z,h,yaw){
  const deg=(360-yaw/DEG%360)%360;
  const scale=$('scale-bar');scale.hidden=!isFlat&&view!=='orbit';
  if(!scale.hidden){
    const metresPerPixel=isFlat?1/flatScale:2*radius*Math.tan(camera.fov*DEG/2)/stage.clientHeight;
    const metres=[1,2,5,10,20,50,100,200,500].filter(n=>n/metresPerPixel<=94).pop()||1;
    scale.style.width=(metres/metresPerPixel)+'px';scale.firstElementChild.textContent=metres+' m';
  }
  if(!isFlat && view!=='orbit')drawLocator(x,z,yaw);
  const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8];
  $('heading').textContent=direction+' '+Math.round(deg)+'°';
  $('coords').textContent='X '+Math.round(x)+'　Y '+Math.round(z)+(isFlat?'':'　H '+Math.round(h))+' m';
}
function layoutPins(project,local){
  const positions=[];
  const candidates=[...points].sort((a,b)=>Number(b===chosen)-Number(a===chosen)||Number(important.has(b.name))-Number(important.has(a.name)));
  for(const p of candidates){
    const s=project(p);
    let show=$('labels-on').checked&&s.show&&(p===chosen||local||important.has(p.name))&&s.x>42&&s.x<stage.clientWidth-43&&s.y>60&&s.y<stage.clientHeight-55;
    if(show&&positions.some(q=>Math.abs(q.x-s.x)<94&&Math.abs(q.y-s.y)<33))show=false;
    p.pin.hidden=!show;
    if(show){p.pin.style.transform='translate('+s.x.toFixed(1)+'px,'+s.y.toFixed(1)+'px)';positions.push(s)}
  }
}
function resizeFlat(){
  const ratio=Math.min(devicePixelRatio,2);
  flat.width=Math.round(stage.clientWidth*ratio);flat.height=Math.round(stage.clientHeight*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
}
function flatHome(){flatX=0;flatZ=28;flatScale=Math.min(stage.clientWidth/740,stage.clientHeight/770);drawFlat()}
function drawFlat(){
  if(!isFlat||!atlas)return;
  const w=stage.clientWidth,h=stage.clientHeight;
  ctx.fillStyle='#151c18';ctx.fillRect(0,0,w,h);
  const side=1308.85742188*flatScale;
  ctx.filter='brightness(1.8) contrast(.92)';ctx.drawImage(atlas,w/2+(6.87-flatX)*flatScale-side/2,h/2+(63.8025-flatZ)*flatScale-side/2,side,side);ctx.filter='none';
  if($('contours').checked&&heights)drawFlatContours(w,h);
  layoutPins(p=>({x:w/2+(p.x-flatX)*flatScale,y:h/2+(p.z-flatZ)*flatScale,show:true}),flatScale>1.6);
  updateHUD(flatX,flatZ,0,0);
}
// Sample horizontal terrain slices on the visible grid for the plan's contour layer.
let contourImage;
function drawFlatContours(w,h){
  if(!contourImage){
    contourImage=document.createElement('canvas');contourImage.width=contourImage.height=1024;
    const context=contourImage.getContext('2d'), img=context.createImageData(1024,1024);
    for(let p=1025;p<heights.length;p++){
      const a=heights[p],b=heights[p-1],c=heights[p-1024];
      if(a<-9000||Math.max(Math.abs(a-b),Math.abs(a-c))>180)continue;
      if(Math.floor(a/500)===Math.floor(b/500)&&Math.floor(a/500)===Math.floor(c/500))continue;
      img.data.set([193,212,168,93],p*4);
    }context.putImageData(img,0,0);
  }
  ctx.drawImage(contourImage,w/2+(-512-flatX)*flatScale,h/2+(-512-flatZ)*flatScale,1024*flatScale,1024*flatScale);
}
function flatFocus(p){flatX=p.x;flatZ=p.z;flatScale=Math.max(flatScale,2.2);drawFlat();syncMode()}
function flatZoom(f){flatScale=clamp(flatScale/f,.22,14);drawFlat()}
function setFlat(on){
  if(!ready||(!on&&!glReady))return;
  if(routeMapOpen)closeRouteMap(false);
  if(on)releaseMouseLook();
  cancelArrival();isFlat=on;flat.hidden=!on;viewport.hidden=on;keys.clear();
  if(on){resizeFlat();if(chosen)flatFocus(chosen);else flatHome()}else{dirty=true;if(chosen)focusPoint(chosen)}
  syncMode();
}
function reset(){if(!ready)return;if(routeMapOpen)closeRouteMap(false);releaseMouseLook();clearPlace();if(isFlat)flatHome();else home3D();syncMode()}
$('mode2').onclick=()=>setFlat(true);$('mode3').onclick=()=>setFlat(false);
$('plus').onclick=()=>mouseZoom(.78);$('minus').onclick=()=>mouseZoom(1.28);$('reset').onclick=reset;
for(const id of ['orbit','fly'])$(id).onclick=()=>changeView(id);
$('walk').onclick=()=>enterWalk(false);
$('enter-here').onclick=()=>enterWalk(true);
$('flood-action').onclick=useInteraction;
$('touch-crouch').onclick=toggleCrouch;
$('labels-on').onchange=()=>{
  $('markers').hidden=!$('labels-on').checked;
  dirty=true;drawFlat();
};
$('contours').onchange=()=>{if(material)material.uniforms.contours.value=Number($('contours').checked);dirty=true;drawFlat()};
const resize=new ResizeObserver(()=>{resize3D();resizeFlat();drawFlat()});resize.observe(stage);
function gesture(){
  const [a,b]=[...pointers.values()];
  return {dist:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};
}
function pan(dx,dy){
  if(isFlat){flatX=clamp(flatX-dx/flatScale,-640,650);flatZ=clamp(flatZ-dy/flatScale,-575,700);drawFlat();return}
  if(view!=='orbit')return;
  const s=radius/stage.clientHeight*.74;
  target.x+=(-Math.cos(azimuth)*dx-Math.sin(azimuth)*dy)*s;target.z+=(Math.sin(azimuth)*dx-Math.cos(azimuth)*dy)*s;dirty=true;
}
function inputSurface(el){
  el.oncontextmenu=e=>e.preventDefault();
  el.addEventListener('wheel',e=>{e.preventDefault();if(ready)mouseZoom(Math.exp(clamp(e.deltaY,-120,120)*.0018))},{passive:false});
  el.onpointerdown=e=>{
    if(!ready)return;
    if(el===viewport&&view==='walk'&&e.pointerType==='mouse'){
      if(e.button===0)captureMouseLook();
      return;
    }
    $('sidebar').classList.remove('open');document.activeElement?.blur?.();el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.button===2||e.button===1||e.shiftKey});
    transition=null;if(pointers.size===2)pinch=gesture();
  };
  el.onpointermove=e=>{
    if(el===viewport&&view==='walk'&&e.pointerType==='mouse'){
      if(mouseLookFallback&&!document.pointerLockElement&&!routeMapOpen)moveLook(e.movementX,e.movementY);
      return;
    }
    const prev=pointers.get(e.pointerId);if(!prev)return;
    const dx=e.clientX-prev.x,dy=e.clientY-prev.y;prev.x=e.clientX;prev.y=e.clientY;
    if(pointers.size===2){
      const g=gesture();if(pinch){mouseZoom(pinch.dist/Math.max(g.dist,1));pan(g.x-pinch.x,g.y-pinch.y)}pinch=g;return;
    }
    if(isFlat||prev.pan){pan(dx,dy);return}
    if(view==='orbit'){azimuth-=dx*.006;pitch=clamp(pitch+dy*.004,.13,1.545)}
    else moveLook(dx,dy);
    dirty=true;
  };
  el.onpointerup=el.onpointercancel=el.onlostpointercapture=e=>{pointers.delete(e.pointerId);pinch=null};
}
inputSurface(viewport);inputSurface(flat);
for(const b of document.querySelectorAll('[data-key]')){
  b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key==='Space'&&!swimming)jumpPending=true};
  b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(b.dataset.key);
}
addEventListener('keydown',e=>{
  if($('dialog').open||$('room-dialog').open||e.metaKey||e.altKey)return;
  if(e.target.closest?.('input,select,textarea,[contenteditable="true"]')){if(e.key==='Escape')e.target.blur();return}
  const moveKey=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyQ','ShiftLeft','ShiftRight','ControlLeft','ControlRight'].includes(e.code);
  if(e.ctrlKey&&(!moveKey||isFlat||view==='orbit'))return;
  if(e.code==='KeyC'&&view==='walk'&&!isFlat){e.preventDefault();if(!e.repeat)toggleCrouch();return}
  if(e.code==='KeyF'&&!e.repeat&&!isFlat&&!routeMapOpen&&view==='walk'){e.preventDefault();useInteraction();return}
  if(e.code==='KeyM'&&glReady&&!isFlat&&view!=='orbit'){
    e.preventDefault();if(!e.repeat){if(routeMapOpen)closeRouteMap(true);else openRouteMap()}return;
  }
  if(routeMapOpen&&e.key==='Escape'){e.preventDefault();closeRouteMap(false);return}
  if(routeMapOpen&&['Slash','KeyR'].includes(e.code))return;
  if(e.code==='Slash'){e.preventDefault();if(innerWidth<=700)$('sidebar').classList.add('open');$('search').focus();return}
  if(e.code==='KeyR'){reset();return}
  if(e.key==='Escape'){
    if(!isFlat&&view==='walk'){releaseMouseLook();keys.clear();syncMode();return}
    $('sidebar').classList.remove('open');clearPlace();if(!isFlat&&glReady)changeView('orbit');
  }
  if(e.code==='Space'&&!e.repeat&&!isFlat&&view==='walk'&&!swimming)jumpPending=true;
  if(moveKey&&!isFlat&&view!=='orbit'){e.preventDefault();keys.add(e.code)}
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();jumpPending=false;mouseLookFallback=false;pointers.clear();pinch=null});
document.addEventListener('visibilitychange',()=>{if(document.hidden)keys.clear()});
function tick(t){requestAnimationFrame(tick);if(!ready||document.hidden)return;const dt=Math.min(.24,(t-previousTime)/1000);previousTime=t;animate3D(t,dt)}
async function start(){
  try{
    const [data,landings,img]=await Promise.all([jsonFile('regions.json'),jsonFile('landings.json'),new Promise((resolve,reject)=>{const a=new Image();a.onload=()=>resolve(a);a.onerror=reject;a.src='data/satellite.webp'})]);
    atlas=img;initPlaces(data,landings);
    try{await initialize3D()}
    catch(err){
      console.warn('3D initialization:',err);
      isFlat=true;flat.hidden=false;viewport.hidden=true;resizeFlat();flatHome();
      if(!heights){try{heights=new Int16Array(await inflated('height.gz'))}catch{$('contours').disabled=true}}
      note('三维场景未能载入，已打开平面地图');
    }
    ready=true;syncMode();$('ready').textContent=glReady?'场景就绪':'平面就绪';$('busy').hidden=true;if(isFlat)drawFlat();requestAnimationFrame(tick);
  }catch(err){
    $('busy').querySelector('b').textContent='地图读取失败';$('load-status').textContent=location.protocol==='file:'?'请使用项目中的“启动地图”打开网页':'请刷新页面重试';$('ready').textContent='载入失败';console.error(err);
  }
}
start();

function drawLocator(x,z,yaw){
  const canvas=$('locator').querySelector('canvas'),c=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height, px=atlas.naturalWidth/1308.85742;
  c.fillStyle='#18201a';c.fillRect(0,0,w,h);
  c.filter='brightness(1.9)';c.drawImage(atlas,atlas.naturalWidth/2+(x-6.87)*px-w*px*.32,atlas.naturalHeight/2+(z-63.8025)*px-h*px*.32,w*px*.64,h*px*.64,0,0,w,h);c.filter='none';
  c.save();c.translate(w/2,h/2);c.rotate(-yaw);
  c.fillStyle='#cff581';c.strokeStyle='#172015';c.lineWidth=2;c.beginPath();c.moveTo(0,-9);c.lineTo(6,6);c.lineTo(0,3);c.lineTo(-6,6);c.closePath();c.fill();c.stroke();c.restore();
  c.font='bold 12px monospace';c.fillStyle='#e3f0d7';c.fillText('N',8,16);
}
