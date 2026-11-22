'use strict';
let ladders=[],climbing=null,crouched=false,crouchToggle=false;
const standHeight=1.70,crouchHeight=1.12,headMargin=.16;
function eyeHeight(){return crouched?crouchHeight:standHeight}
function setStance(low){
  if(low===crouched)return;
  const eye=camera.position,feet=eye.y-eyeHeight();
  if(!low&&hit(eye,waterUp,standHeight-crouchHeight+headMargin))return;
  crouched=low;eye.y=feet+eyeHeight();dirty=true;syncMode();
}
function wantsCrouch(){
  return crouchToggle||keys.has('ControlLeft')||keys.has('ControlRight');
}
function toggleCrouch(){
  if(view!=='walk'||swimming||climbing||isFlat)return;
  crouchToggle=!crouched;setStance(wantsCrouch());
}
function nearbyLadder(){
  if(view!=='walk'||isFlat||routeMapOpen||awaitingLanding||$('dialog').open||$('room-dialog').open)return null;
  const eye=camera.position;
  for(const ladder of ladders){
    const dx=eye.x-ladder.x,dz=eye.z-ladder.z,front=dx*ladder.nx+dz*ladder.nz;
    if(Math.abs(dx*ladder.nz-dz*ladder.nx)>.68||front< -1.15||front>1.3)continue;
    const lower=ladder.water?ladder.bottom-1.08:ladder.bottom+.42;
    if(eye.y<lower||eye.y>ladder.top+1.96)continue;
    if(front<.08&&eye.y<ladder.top+eyeHeight()-.38)continue;
    const dir=camera.getWorldDirection(new THREE.Vector3()),distance=Math.hypot(dx,dz);
    if(distance>.1&&(-dx*dir.x-dz*dir.z)<.2*distance*Math.hypot(dir.x,dir.z))continue;
    return ladder;
  }
  return null;
}
function lowestFeet(ladder){
  return ladder.water?ladder.bottom+.28-standHeight:ladder.bottom;
}
function useInteraction(){
  if(climbing){climbing=null;groundVelocity=0;jumpPending=false;syncMode();dirty=true;return}
  if(pool?.state==='dry'&&targetTerminal()){startFlood();return}
  const lever=targetedLever();if(lever){toggleLever(lever);return}
  const ladder=nearbyLadder();if(!ladder)return;
  const eye=camera.position,feet=clamp(eye.y-eyeHeight(),lowestFeet(ladder),ladder.top);
  climbing=ladder;groundVelocity=0;jumpPending=false;
  eye.set(ladder.x+ladder.nx*.48,feet+eyeHeight(),ladder.z+ladder.nz*.48);
  syncMode();dirty=true;
}
function climbStep(direction,dt){
  jumpPending=false;
  if(!direction)return;
  const ladder=climbing,eye=camera.position,base=lowestFeet(ladder);
  const feet=clamp(eye.y-eyeHeight()+direction*2.5*dt,base,ladder.top);
  setStance(Boolean(ladder.headroom&&feet>ladder.top-.65)||crouchToggle);
  eye.y=feet+eyeHeight();
  const up=direction>0;
  if(Math.abs(feet-(up?ladder.top:base))<.001){
    const offset=up?-.77:.67;
    eye.x=ladder.x+ladder.nx*offset;eye.z=ladder.z+ladder.nz*offset;
    if(ladder.water&&!up)eye.y=ladder.bottom+.28;
    climbing=null;updateImmersion();syncMode();
  }
  dirty=true;
}
function updateInteraction(){
  const button=$('flood-action'),terminal=targetTerminal()&&pool.state!=='full';
  const lever=!terminal&&targetedLever(),ladder=climbing||(!terminal&&!lever&&nearbyLadder());
  button.hidden=isFlat||routeMapOpen||(!terminal&&!ladder&&!lever);
  if(!button.hidden){
    button.disabled=Boolean(terminal&&pool.state==='filling');
    const label=climbing?'松开梯子':ladder?'攀爬'+ladder.name:lever?(pulledLevers.has(lever)?'复位电闸':'拉下电闸'):button.disabled?'注水中 '+Math.floor(pool.fraction*100)+'%':'启动注水';
    if(button.lastElementChild.textContent!==label)button.lastElementChild.textContent=label;
  }
  $('reset-flood').hidden=!(chosen?.name==='浮力室'&&pool?.state!=='dry');
}
