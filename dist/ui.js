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
  {name:'北部园区',places:[['宿舍区','西侧的宿舍楼群。向东可到中控区。'],['中控区','从中控楼向南，经中控桥进入核心区。'],['中控桥','连接北侧中控区和南侧核心区的桥梁。'],['工业区','基地东侧的工业厂房，南侧邻近罐装区。'],['罐装区','沿东侧弧形道路辨认成组的储罐。']]},
  {name:'核心区',places:[['离心机室','核心区西南侧的实验楼，北面是浮力室。'],['浮力室','核心区西北侧，与东侧的蓝室隔道相望。'],['蓝室','位于核心区东北侧，黑室在它的南面。'],['黑室','核心区东南侧的研究建筑。'],['总裁室','核心区楼层地标，标记表示平面位置。'],['中心花园','核心区南侧的开放空间。']]},
  {name:'南部设施',places:[['水平试车场','沿南部栈桥查看东侧的试车设施。'],['发射区','基地西南方向的发射设施，与水平试车场隔水相望。']]}
];
let points=[], chosen=null, view='orbit', isFlat=false, ready=false, hasGL=false, toastTimer;
const important=new Set(['宿舍区','中控区','工业区','罐装区','蓝室','中心花园','水平试车场','发射区']);
function note(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2700)}
function setDialog(title,html){$('dialog').querySelector('h2').textContent=title;$('dialog-body').innerHTML=html;$('dialog').showModal()}
$('guide').onclick=()=>setDialog('操作指南','<dl><dt>环绕沙盘</dt><dd>拖动旋转，右键拖动平移，滚轮缩放。</dd><dt>平面地图</dt><dd>拖动平移，滚轮或双指缩放。</dd><dt>步行与飞行</dt><dd>W A S D 或方向键移动，拖动环顾，Shift 加速。飞行时 E / Q 升降。</dd><dt>触屏漫游</dt><dd>用方向按钮移动，在地图上拖动转向。</dd><dt>返回全图</dt><dd>按 R 或使用右侧复位按钮。</dd></dl>');
$('source').onclick=()=>setDialog('地图资料','<p>建筑和地形来自公开的航天基地物理场景，坐标从厘米换算为米。远景采用减面网格，进入区域后加载原精度几何。</p><p>13 个地标和俯视影像来自腾讯地图工具；地标平面位置通过建筑轮廓对齐。室内材质采用识图配色，楼层、动态设施和当前赛季差异尚未逐项核验。</p><p><a href="https://df.qq.com/cp/a20240729directory/?map=htjd" target="_blank" rel="noreferrer">腾讯官方地图工具</a> · <a href="https://github.com/QH190311/delta-force-3d-map/tree/fc335ace5e225c8dcae107b8e68cdee3aa61e572" target="_blank" rel="noreferrer">场景数据</a> · <a href="https://www.taptap.cn/moment/560580545478659238" target="_blank" rel="noreferrer">封面出处</a></p>');
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
const photos={'宿舍区':'dorm','中控区':'control','中控桥':'bridge','工业区':'industry','发射区':'launch','水平试车场':'testbay'};
$('reference-photo').onclick=()=>{if(chosen&&photos[chosen.name])setDialog(chosen.name+' · 游戏画面','<img class="reference" alt="'+chosen.name+'游戏内参考画面" src="data/'+photos[chosen.name]+'.webp"><p>画面来自《三角洲行动》官方航天基地介绍。</p>')};
function selectPlace(item) {
  if(!ready)return;
  cancelArrival();chosen=item;$('reference-photo').hidden=!photos[item.name];
  $('landing').replaceChildren(...item.landings.map((spot,index)=>new Option('高度 '+spot.y.toFixed(1)+' m',String(index))));
  $('landing-label').hidden=!glReady||!item.landings.length;
  $('sidebar').classList.remove('open');
  $('detail-group').textContent=item.id+' / '+item.group;$('detail-name').textContent=item.name;$('detail-text').textContent=item.description;$('selection').hidden=false;
  points.forEach(p=>p.pin.classList.toggle('active',p===item));filterPlaces();
  if(isFlat)flatFocus(item);else focusPoint(item);syncMode();dirty=true;
}
function clearPlace(){cancelArrival();chosen=null;dirty=true;$('selection').hidden=true;points.forEach(p=>p.pin.classList.remove('active'));filterPlaces();syncMode();drawFlat()}
$('deselect').onclick=clearPlace;
