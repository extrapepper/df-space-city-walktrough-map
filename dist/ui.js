'use strict';
const $ = id => document.getElementById(id);
const shapes={
layers:'<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h1m3 0h1m3 0h1m3 0h.1M6 14h1m3 0h7"/>',
expand:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
box:'<path d="m12 2 9 5v10l-9 5-9-5V7zm-9 5 9 5 9-5m-9 5v10"/>',
map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zm6-2v16m6-14v16"/>',
plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
focus:'<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="3"/>',
orbit:'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-32 12 12)"/>',
fly:'<path d="m21 3-6 18-4-8-8-4zm-10 10L21 3"/>',walk:'<circle cx="14" cy="4" r="2"/><path d="m10 14 2-6 4 4h3m-7-4-5 2-2 4m6-1 4 4 1 5m-6-9-1 5-4 4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',list:'<path d="M4 6h16M4 12h16M4 18h16"/>'};
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+shapes[el.dataset.icon]+'</svg>');
const groups=[
  {name:'北部园区',places:[['宿舍区','从西侧宿舍的弧窗客房可以俯看园区，向东可到中控区。'],['中控区','从楼内南侧斜窗可看见中控桥。过桥后进入核心区。'],['中控桥','连接北侧中控区和南侧核心区的桥梁。'],['工业区','基地东侧的工业厂房，南侧邻近罐装区。'],['罐装区','沿东侧弧形道路辨认成组的储罐。']]},
  {name:'核心区',places:[['离心机室','核心区西南侧的实验楼，北面是浮力室。'],['浮力室','核心区西北侧，与东侧的蓝室隔道相望。可从控制台练习注水，或从池底沿两段黄梯返回上层。'],['蓝室','位于核心区东北侧，黑室在它的南面。'],['黑室','核心区东南侧的 H4 实验楼。沿试验台走到蓝色拱形舱，向前跳过门槛即可进舱。'],['总裁室','位于核心区上层。默认起点在办公室层的电脑附近，也可从金属雕塑前厅出发。'],['中心花园','核心区南侧的开放空间。']]},
  {name:'南部设施',places:[['水平试车场','沿南部栈桥查看东侧的试车设施。'],['发射区','基地西南方向的发射设施，与水平试车场隔水相望。'],['码头区','核心区西南侧的临水建筑。可从不同楼层出发，也可以在岸前下水。']]}
];
let points=[], chosen=null, view='orbit', isFlat=false, ready=false, hasGL=false, toastTimer;
const important=new Set(['宿舍区','中控区','工业区','罐装区','蓝室','中心花园','水平试车场','发射区','码头区']);
function note(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2700)}
function setDialog(title,html){$('dialog').querySelector('h2').textContent=title;$('dialog-body').innerHTML=html;$('dialog').showModal()}
$('guide').onclick=()=>setDialog('操作指南','<dl><dt>环绕沙盘</dt><dd>拖动旋转，右键拖动平移，滚轮缩放。</dd><dt>平面地图</dt><dd>拖动平移，滚轮或双指缩放。</dd><dt>步行与飞行</dt><dd>PC 步行时移动鼠标环顾，WASD 或方向键移动，Shift 奔跑，空格跳跃。C 切换蹲姿，按住 Ctrl 可暂时蹲下。Esc 释放鼠标，点击场景继续环顾。飞行时拖动转向，E / Q 升降。在港湾和注水后的浮力室可游泳，按 Q 下潜、E 上浮。浮力室内对准控制台按 F 注水。对准固定梯按 F 抓梯，W 上爬、S 下爬。总裁室西北侧梯口净高较低，出梯时会自动蹲下。</dd><dt>实时大地图</dt><dd>漫游时按 M 或点击小地图展开全图。箭头显示当前位置和朝向，WASD 可以继续移动。点“定位”或放大后可点梯子图标，查看梯脚和上口高度。再按 M 回到原视角。</dd><dt>触屏漫游</dt><dd>用方向按钮移动，在地图上拖动转向。</dd><dt>返回全图</dt><dd>按 R 或使用右侧复位按钮。</dd></dl>');
$('source').onclick=()=>setDialog('地图资料','<p>建筑和地形来自公开的航天基地物理场景，坐标从厘米换算为米。远景采用减面网格，进入区域后加载原精度几何。</p><p>地图包含 13 个官方区域标签，以及用官方点位单独定位的码头区。码头的三层起点已与楼板核对，岸线依据官方 2.0 画面估算。七个地标的部分外表面采用实景贴图，包括宿舍楼、中控桥和码头临水立面。近景的地面、墙板和金属件按游戏画面配色，表面细节使用 Poly Haven 扫描材质。总裁室、中控楼斜窗及宿舍弧窗可透视室外。总裁室的地球仪按 2024 年录像估算，前厅雕塑的可见金属表面参照蝶变赛季画面。码头和黑室的售货机广告参考游戏画面，其余同型设备按实机款式配色。五栋核心区建筑附有 2025 年的室内全景。浮力室控制台和满池水位按 S8 实机画面复原。H2、H4 的四楼连廊均可通往总裁室。室外 411 棵棕榈的树干取自物理场景，树冠根据画面估算。中控楼前花池的另外四棵树按 2024 年镜头定位。后续赛季曾调整水位，部分美术和活动设施仍缺逐项实测。</p><p><a href="https://df.qq.com/cp/a20240729directory/?map=htjd" target="_blank" rel="noreferrer">腾讯官方地图工具</a> · <a href="https://github.com/QH190311/delta-force-3d-map/tree/fc335ace5e225c8dcae107b8e68cdee3aa61e572" target="_blank" rel="noreferrer">场景数据</a> · <a href="https://www.taptap.cn/moment/560580545478659238" target="_blank" rel="noreferrer">实景照片</a> · <a href="https://www.playdeltaforce.com/season08/en/" target="_blank" rel="noreferrer">航天基地 2.0 更新</a> · <a href="https://www.youtube.com/watch?v=3zb4UFG-25k&amp;t=21s" target="_blank" rel="noreferrer">售货机实机走查</a></p>');
$('close-dialog').onclick=()=>$('dialog').close();
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog'))$('dialog').close()});
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{note('当前浏览器不支持全屏')}};
$('index-toggle').onclick=()=> $('sidebar').classList.toggle('open');
function initPlaces(data, landings){
  for(const group of groups) for(const [name,description] of group.places){
    const p=data.find(item=>item.name===name);
    const item={name,description,group:group.name,id:String(points.length+1).padStart(2,'0'),x:(p.mapX-668650)/100,z:(p.mapY+452830)/100};
    item.landings=landings[name]||[];
    const pin=document.createElement('button');
    pin.className='pin';pin.innerHTML='<b>'+item.id+'</b>'+name;pin.hidden=true;pin.onclick=()=>selectPlace(item);item.pin=pin;$('markers').append(pin);points.push(item);
  }
  $('place-count').textContent=points.length+' 个地标';
  filterPlaces();
}
function filterPlaces(){
  const root=$('places'), query=$('search').value.trim().toLowerCase(); root.replaceChildren();
  for(const group of groups){
    const matches=points.filter(s=>s.group===group.name&&[s.name,s.group,s.id].some(v=>v.includes(query)));
    if(!matches.length)continue;
    const h=document.createElement('div');h.className='group-title';h.textContent=group.name;root.append(h);
    for(const item of matches){
      const b=document.createElement('button');b.className='place'+(chosen===item?' active':'');b.innerHTML='<i>'+item.id+'</i><span>'+item.name+'</span><span>›</span>';b.onclick=()=>selectPlace(item);root.append(b);
    }
  }
  if(!root.children.length){const p=document.createElement('p');p.className='subdued';p.textContent='未找到匹配的地标';root.append(p)}
}
$('search').oninput=filterPlaces;
const photos={'宿舍区':'dorm','中控区':'control','中控桥':'bridge','工业区':'industry','发射区':'launch','水平试车场':'testbay','码头区':'dock','总裁室':'ceo','浮力室':'buoyancy','离心机室':'centrifuge','蓝室':'blue-room','黑室':'chamber'};
$('reference-photo').onclick=()=>{
  const key=photos[chosen?.name];
  if(!key)return;
  const label=chosen.landings[Number($('landing').value)]?.label;
  const dormRoom=chosen.landings[Number($('landing').value)]?.dormRoom;
  if(chosen.landings[Number($('landing').value)]?.launchReturn){
    setDialog('2024 · 火箭回收','<img class="reference" src="data/launch-return.webp" alt="从栈桥望向回收塔，火箭正在两道横臂之间下降"><p>从栈桥看，火箭在圆形承座上方下降，两侧横臂固定在塔身。下方的方形撤离平台有独立的双段楼梯。<a href="https://www.taptap.cn/moment/560580545478659238" target="_blank" rel="noreferrer">官方航天基地介绍</a></p>');
    const go=document.createElement('button');go.className='visit-photo';go.textContent='从栈桥视角自由飞行';
    go.onclick=async()=>{await launchLoading;if(!returnStudy){note('回收场景尚未载入');return}$('dialog').close();visitSurvey(returnStudy.pose)};$('dialog-body').append(go);
    return;
  }
  if(chosen.landings[Number($('landing').value)]?.outlook){
    setDialog('总裁室南窗 · 游戏画面','<img class="reference" src="data/office-outlook.webp" alt="从办公室南窗看到的山岛与海上发射塔"><p>窗外由左到右能辨认山岛、瞭望塔和发射塔。最远的塔会被窗框或侧面的建筑遮住，沿窗横移可以改变视线。<a href="https://www.taptap.cn/moment/560580545478659238" target="_blank" rel="noreferrer">官方室内镜头</a> · <a href="https://www.taptap.cn/moment/564129131101424794" target="_blank" rel="noreferrer">室外对照画面</a></p>');
    const go=document.createElement('button');go.className='visit-photo';go.textContent='从画面位置自由飞行';
    go.onclick=async()=>{
      go.disabled=true;await horizonLoading;go.disabled=false;
      if(!go.isConnected||!$('dialog').open)return;
      const pose=surveyViews.get('office-outlook');
      if(!pose){note('南窗取景位置尚未载入');return}
      $('dialog').close();visitSurvey(pose);
    };
    $('dialog-body').append(go);
    return;
  }
  if(dormRoom){
    setDialog(label+' · 游戏画面','<img class="reference" src="data/dorm-bedroom.webp" alt="窗边床铺和壁柜写字台的官方游戏画面"><p>2024 年官方攻略展示了窗边的床、书桌和壁柜。卧室按模型中的窗帘、窗槛和墙角校准。照片未注明楼栋，三处同型卧室共用按图估算的家具。<a href="https://www.taptap.cn/moment/564129131101424794" target="_blank" rel="noreferrer">官方地图攻略</a></p>');
    const pose=dormViews.get(dormRoom);
    if(pose){
      const go=document.createElement('button');go.className='visit-photo';go.textContent='从这个位置自由飞行';
      go.onclick=()=>{$('dialog').close();visitSurvey(pose)};$('dialog-body').append(go);
    }
    return;
  }
  if((key==='ceo'||key==='blue-room')&&chosen.landings[Number($('landing').value)]?.panorama){$('show-room-views').click();return}
  const site=extractionSites.find(s=>s.landing?.label===label&&['centrifuge-switch','blue-switch','testbay'].includes(s.id));
  if(site){
    const file=site.panel?site.id:'testbay-exit';
    setDialog(site.name+' · 2024 游戏画面','<img class="reference" src="data/'+file+'.webp" alt="'+site.name+'的官方现场画面"><p>'+site.detail+' <a href="https://www.taptap.cn/moment/564129131101424794" target="_blank" rel="noreferrer">官方地图攻略</a></p>');
    return;
  }
  if(key==='buoyancy'&&chosen.landings[Number($('landing').value)]?.label==='深潜池下层'){
    setDialog('浮力室 · 深潜池下层','<img class="reference" src="data/buoyancy-lower.webp" alt="从池沿俯看下层舱体和圆形深井"><p>《三角洲行动》官方 2024 年航天基地画面。</p>');
    const go=document.createElement('button');go.className='visit-photo';go.textContent='从深潜池下层开始步行';
    go.onclick=()=>{$('dialog').close();enterWalk(true)};$('dialog-body').append(go);return;
  }
  if(key==='ceo'&&chosen.landings[Number($('landing').value)]?.label==='雕塑前厅'){
    setDialog('雕塑前厅 · 游戏画面','<img class="reference sculpture-reference" alt="总裁室前厅的金属雕塑" src="data/sculpture-reference.webp"><p>《三角洲行动》官方蝶变赛季画面。</p>');
    const go=document.createElement('button');go.className='visit-photo';go.textContent='从雕塑前厅开始步行';
    go.onclick=()=>{$('dialog').close();enterWalk(true)};$('dialog-body').append(go);return;
  }
  const pose=surveyViews.get(key);
  const filename=key==='launch'&&pose?'overview-photo':key;
  const credit=['centrifuge','blue-room'].includes(key)?'画面来自《三角洲行动》2024 年发布的<a href="https://www.taptap.cn/moment/564129131101424794" target="_blank" rel="noreferrer">航天基地进阶攻略</a>。':['dock','buoyancy'].includes(key)?'画面来自《三角洲行动》官方蝶变赛季介绍。':'画面来自《三角洲行动》官方航天基地介绍。';
  setDialog(chosen.name+(key==='ceo'?' · 2024 全息地球仪':' · 游戏画面'),'<img class="reference" alt="'+chosen.name+'游戏内参考画面" src="data/'+filename+'.webp"><p>'+credit+'</p>');
  if(!pose)return;
  const button=document.createElement('button');
  button.className='visit-photo';button.textContent='从这个视角自由飞行';
  button.onclick=()=>{$('dialog').close();visitSurvey(pose)};
  $('dialog-body').append(button);
};
function describeLanding(){
  const stop=chosen?.landings[Number($('landing').value)];
  if(chosen)$('detail-text').textContent=stop?.detail||chosen.description;
}
$('landing').onchange=describeLanding;
function selectPlace(item) {
  if(!ready)return;
  cancelArrival();chosen=item;setOfficeGlobe(false);setLaunchReturn(false);
  $('show-room-views').hidden=!['离心机室','浮力室','蓝室','黑室','总裁室'].includes(item.name);
  $('reference-photo').hidden=!photos[item.name];
  $('landing').replaceChildren(...item.landings.map((spot,index)=>new Option((spot.label?spot.label+' · ':'高度 ')+spot.y.toFixed(1)+' m',String(index))));
  $('landing-label').hidden=!glReady||!item.landings.length;
  $('sidebar').classList.remove('open');
  $('detail-group').textContent=item.id+' / '+item.group;$('detail-name').textContent=item.name;describeLanding();$('selection').hidden=false;
  points.forEach(p=>p.pin.classList.toggle('active',p===item));filterPlaces();
  if(isFlat)flatFocus(item);else focusPoint(item);syncMode();dirty=true;
}
function clearPlace(){cancelArrival();setLaunchReturn(false);chosen=null;dirty=true;$('selection').hidden=true;points.forEach(p=>p.pin.classList.remove('active'));filterPlaces();syncMode();drawFlat()}
$('deselect').onclick=clearPlace;

let roomViewIndex;
let roomOpenRequest=0;
$('show-room-views').onclick=async()=>{
  const place=chosen;
  if(!place)return;
  const request=++roomOpenRequest;
  $('room-title').textContent=place.name+' · 室内全景';
  $('room-stop').replaceChildren();
  $('room-fly').hidden=true;
  $('room-link').hidden=true;
  $('room-screen').textContent='正在读取取景点';
  $('room-dialog').showModal();
  try{
    roomViewIndex??=await jsonFile('room-views.json');
    if(request!==roomOpenRequest||!$('room-dialog').open)return;
    const stops=roomViewIndex[place.name];
    if(place.name==='蓝室'&&glReady)approachBlueHall(place);
    const panorama=place.landings[Number($('landing').value)]?.panorama;
    const preferred=stops.find(s=>s.id===panorama)||stops.find(s=>s.name===place.name+'门口')||stops.find(s=>s.name.includes('门口大厅'))||stops[0];
    $('room-stop').replaceChildren(...stops.map(s=>new Option(s.name,s.id,false,s===preferred)));
    showRoomView();
  }catch{
    if(request===roomOpenRequest)$('room-screen').textContent='取景点读取失败，请关闭后重试。';
  }
};
function showRoomView(){
  const name=$('room-stop').selectedOptions[0]?.textContent;
  if(!name)return;
  const url=new URL('https://zzzmap.com/');
  url.searchParams.set('map_type','htjd');url.searchParams.set('sid',$('room-stop').value);
  $('room-link').href=url.href;$('room-link').hidden=false;
  refreshRoomPose();
  const frame=document.createElement('iframe');
  frame.title=$('room-title').textContent+' · '+name;
  frame.sandbox='allow-scripts allow-same-origin allow-presentation allow-popups';
  frame.referrerPolicy='no-referrer';
  frame.allow='fullscreen';frame.src=url.href;
  $('room-screen').replaceChildren(frame);
}
function refreshRoomPose(){
  $('room-fly').hidden=!glReady||!surveyViews.has($('room-stop').value);
}
$('room-fly').onclick=()=>{
  const pose=surveyViews.get($('room-stop').value);
  if(!pose||!glReady)return;
  $('room-dialog').close();
  if(isFlat)setFlat(false);
  visitSurvey(pose);
};
$('room-stop').onchange=showRoomView;
function releaseRoomView(){
  if($('room-dialog').open)return;
  roomOpenRequest++;$('room-screen').replaceChildren();keys.clear();dirty=true;
}
$('close-rooms').onclick=()=>{$('room-dialog').close();releaseRoomView()};
$('room-dialog').addEventListener('close',releaseRoomView);
