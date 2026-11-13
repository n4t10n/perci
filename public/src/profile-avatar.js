/** Percí v1.13.0 · Private avatar, isolated from the workout snapshot/outbox.
 * Only the user's verified, host-only-cookie session may read/write Storage.
 * Offline cache is scoped by account ID and is never shared across accounts.
 */
import {account,accountInitial} from './account.js?v=1.7.6';

const CACHE_PREFIX='perci_avatar_v113_';
const MAX_ORIGINAL=10*1024*1024;
const MAX_ENCODED=200000;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validImage=value=>typeof value==='string'&&value.length<=280000&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value);
const currentUid=()=>account.authenticated?account.user?.id||null:null;
let displayUid=null;
let displayImage=null;
let readAt=0;
let reading=null;
let mutationVersion=0;
let repaint=()=>{};
let selected=null; // Never persisted: decoded image/preview retained only while editor is open.
let drag=null;
let inlineError='';

function loadCache(uid){
  if(!uid)return null;
  try{const data=localStorage.getItem(CACHE_PREFIX+uid);return validImage(data)?data:null;}
  catch{return null;}
}
function setCache(uid,data){
  try{if(data)localStorage.setItem(CACHE_PREFIX+uid,data);else localStorage.removeItem(CACHE_PREFIX+uid);}catch{}
}
function imageFor(user){
  if(!user?.id||user.id!==currentUid())return null;
  if(displayUid!==user.id){displayUid=user.id;displayImage=loadCache(user.id);readAt=0;}
  return displayImage;
}
export function hasAvatar(user){return !!imageFor(user);}
export function avatarMarkup(user){
  const image=imageFor(user);
  return image?`<img class="profile-avatar-photo" src="${image}" alt="" decoding="async"/>`:
    `<span class="profile-avatar-initial" aria-hidden="true">${esc(accountInitial(user)||'•')}</span>`;
}
export function avatarMessage(){return inlineError?`<p class="avatar-error" role="alert">${esc(inlineError)}</p>`:'';}
export function updateAvatarNodes(){
  const uid=currentUid();
  for(const node of document.querySelectorAll('[data-profile-avatar]')){
    if(node.dataset.profileAvatar===uid)node.innerHTML=avatarMarkup(account.user);
  }
  for(const btn of document.querySelectorAll('[data-avatar-remove]'))btn.hidden=!hasAvatar(account.user);
}
export function resetAvatarOnAccountChange(){
  const uid=currentUid();
  if(selected?.uid!==uid&&selected)discard();
  if(displayUid!==uid){displayUid=uid;displayImage=loadCache(uid);readAt=0;reading=null;inlineError='';mutationVersion++;}
}

async function api(body){
  const response=await fetch('/api/profile/avatar',{
    method:body===undefined?'GET':'POST',
    credentials:'same-origin',cache:'no-store',
    headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let payload;
  try{payload=await response.json();}catch{throw Error('No se pudo leer la respuesta del servidor.');}
  if(!response.ok){const error=new Error(payload?.error||'No pudimos guardar tu foto.');error.status=response.status;throw error;}
  return payload;
}

/** Refresh when login/focus returns; never interrupt active edits or training. */
export async function refreshAvatar({force=false}={}){
  const uid=currentUid();
  if(!uid||account.offline)return;
  if(reading?.uid===uid)return reading.promise;
  if(!force&&Date.now()-readAt<45_000)return;
  readAt=Date.now();
  const generation=mutationVersion;
  const promise=(async()=>{
    try{
      const data=await api();
      if(currentUid()!==uid||mutationVersion!==generation)return;
      if(data?.ownerId!==uid)throw Error('La sesión cambió durante la lectura.');
      const next=data?.present&&validImage(data.image)?data.image:null;
      if(data?.present&&!next)throw Error('La foto recibida no tiene un formato válido.');
      const old=imageFor(account.user);
      if(old!==next){displayUid=uid;displayImage=next;setCache(uid,next);updateAvatarNodes();}
    }catch{
      // Keep last verified, user-scoped photo while offline or on a transient error.
      readAt=0;
    }
  })();
  reading={uid,promise};
  try{await promise;}finally{if(reading?.promise===promise)reading=null;}
}

function discard(){
  if(selected?.url)URL.revokeObjectURL(selected.url);
  selected=null;
  drag=null;
}
function editorSize(){return selected?Math.min(selected.width,selected.height)/selected.zoom:0;}
function clampEditor(){
  if(!selected)return;
  const half=editorSize()/2;
  selected.centerX=Math.max(half,Math.min(selected.width-half,selected.centerX));
  selected.centerY=Math.max(half,Math.min(selected.height-half,selected.centerY));
}
function draw(canvas,outputSize=280){
  if(!selected||!canvas)return;
  clampEditor();
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Tu navegador no permite editar esta imagen.');
  const side=editorSize();
  ctx.fillStyle='#f4f6f2';ctx.fillRect(0,0,outputSize,outputSize);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(selected.image,selected.centerX-side/2,selected.centerY-side/2,side,side,0,0,outputSize,outputSize);
}
function repaintCrop(){try{draw(document.getElementById('avatar-crop-preview'));}catch(error){showError(error.message);}}
function showError(message){
  inlineError=message;
  const el=document.getElementById('avatar-edit-status')||document.getElementById('avatar-inline-feedback');
  if(el){el.textContent=message;el.hidden=false;el.setAttribute('role','alert');}
  else repaint();
}
function clearError(){
  inlineError='';
  const el=document.getElementById('avatar-edit-status')||document.getElementById('avatar-inline-feedback');
  if(el){el.textContent='';el.hidden=true;}
}
function closeEditor({force=false}={}){if(selected?.saving&&!force)return;discard();repaint();queueMicrotask(()=>document.querySelector('[data-avatar-action="choose"]')?.focus({preventScroll:true}));}

async function prepareImage(file){
  if(!file)return;
  clearError();
  const okay=['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type.toLowerCase())||
    (!file.type&&/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
  if(!okay)throw Error('Elegí una foto JPG, PNG, WebP o HEIC.');
  if(!file.size||file.size>MAX_ORIGINAL)throw Error('La foto original no puede superar los 10 MB.');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.src=url;
    if(typeof image.decode==='function')await image.decode();
    else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
    if(currentUid()===null)throw Error('Volvé a iniciar sesión para cargar la foto.');
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height||width<128||height<128||width>10000||height>10000||width*height>50_000_000)
      throw Error('Elegí una imagen de al menos 128 píxeles y con dimensiones válidas.');
    discard();
    selected={uid:currentUid(),url,image,width,height,zoom:1,centerX:width/2,centerY:height/2,saving:false};
    repaint();
  }catch(error){URL.revokeObjectURL(url);throw error;}
}

async function exportAvatar(){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  draw(canvas,512);
  for(const quality of [0.82,0.72,0.6,0.48,0.36]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(!blob||blob.type!=='image/webp')throw Error('Este navegador no puede preparar WebP. Probá actualizar Safari.');
    if(blob.size<=MAX_ENCODED){
      const data=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer la foto.'));
        reader.readAsDataURL(blob);
      });
      if(!validImage(data))throw Error('La foto procesada no tiene un formato válido.');
      return data;
    }
  }
  throw Error('No pudimos reducir la foto. Probá elegir otra imagen.');
}

async function saveAvatar(){
  if(!selected||selected.saving)return;
  if(account.offline||selected.uid!==currentUid()){showError('Conectate a internet para cambiar tu foto.');return;}
  selected.saving=true;clearError();
  const saveButton=document.querySelector('[data-avatar-action="save"]');
  if(saveButton){saveButton.disabled=true;saveButton.textContent='Guardando…';}
  const uid=selected.uid;
  try{
    const data=await exportAvatar();
    const result=await api({action:'save',ownerId:uid,mime:'image/webp',image:data.split(',')[1]});
    if(result?.ownerId!==uid)throw Error('La sesión cambió mientras guardábamos la foto.');
    if(currentUid()!==uid)return;
    mutationVersion++;
    displayUid=uid;displayImage=data;setCache(uid,data);readAt=Date.now();
    closeEditor({force:true});
    updateAvatarNodes();
  }catch(error){if(currentUid()===uid)showError(error.message||'No pudimos guardar tu foto.');}
  finally{
    if(selected)selected.saving=false;
    const button=document.querySelector('[data-avatar-action="save"]');
    if(button){button.disabled=false;button.textContent='Guardar foto';}
  }
}

async function removeAvatar(){
  const uid=currentUid();
  if(!uid)return;
  if(account.offline){showError('Conectate a internet para quitar tu foto.');return;}
  if(!window.confirm('¿Quitar tu foto de perfil? Volveremos a mostrar tu inicial.'))return;
  clearError();
  try{
    const result=await api({action:'remove',ownerId:uid});
    if(result?.ownerId!==uid)throw Error('La sesión cambió mientras quitábamos la foto.');
    if(currentUid()!==uid)return;
    mutationVersion++;
    displayUid=uid;displayImage=null;setCache(uid,null);readAt=Date.now();
    discard();repaint();
  }catch(error){showError(error.message||'No pudimos quitar tu foto.');}
}

export function renderAvatarDialog(){
  if(!selected||selected.uid!==currentUid())return '';
  return `<dialog class="avatar-editor" id="avatar-editor" aria-labelledby="avatar-editor-title" aria-describedby="avatar-editor-help">
    <div class="avatar-editor-head"><div><span class="eyebrow">TU PERFIL</span><h2 id="avatar-editor-title">Ajustá tu foto</h2><p class="micro" id="avatar-editor-help">Arrastrá para reencuadrar y usá el zoom. La foto será privada.</p></div><button type="button" class="avatar-close" data-avatar-action="cancel" aria-label="Cerrar editor de foto">✕</button></div>
    <div class="avatar-crop-frame"><canvas id="avatar-crop-preview" width="280" height="280" tabindex="0" role="img" aria-label="Vista previa de la foto. Arrastrá o usá las flechas para ajustar el encuadre."></canvas></div>
    <div class="avatar-zoom"><label for="avatar-zoom">Zoom</label><input id="avatar-zoom" type="range" min="1" max="2.5" step="0.05" value="${selected.zoom}" aria-label="Zoom de foto"/></div>
    <div class="avatar-nudge" role="group" aria-label="Mover encuadre"><button type="button" data-avatar-move="left" aria-label="Mover foto hacia la izquierda">←</button><button type="button" data-avatar-move="up" aria-label="Mover foto hacia arriba">↑</button><button type="button" data-avatar-move="down" aria-label="Mover foto hacia abajo">↓</button><button type="button" data-avatar-move="right" aria-label="Mover foto hacia la derecha">→</button></div>
    <p id="avatar-edit-status" class="avatar-error" role="status" ${inlineError?'':'hidden'}>${esc(inlineError)}</p>
    <div class="avatar-editor-actions"><button type="button" class="btn outline" data-avatar-action="cancel">Cancelar</button><button type="button" class="btn" data-avatar-action="save">Guardar foto</button></div>
  </dialog>`;
}
export function mountAvatarDialog(){
  const dialog=document.getElementById('avatar-editor');
  if(!dialog)return;
  if(!dialog.open)dialog.showModal();
  repaintCrop();
}

/** Wire once to the existing account actions; nothing modifies workout state. */
export function installAvatarUI(render){
  repaint=render;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-avatar-action]');
    if(button){
      event.preventDefault();
      const action=button.dataset.avatarAction;
      if(action==='choose'){
        if(account.offline){showError('Conectate a internet para cambiar tu foto.');return;}
        document.getElementById('avatar-file-input')?.click();
      }else if(action==='cancel')closeEditor();
      else if(action==='save')void saveAvatar();
      else if(action==='remove')void removeAvatar();
      return;
    }
    const nudge=event.target.closest('[data-avatar-move]');
    if(nudge&&selected){
      event.preventDefault();
      const step=editorSize()*0.075;
      const dirs={left:[-step,0],right:[step,0],up:[0,-step],down:[0,step]};
      const [dx,dy]=dirs[nudge.dataset.avatarMove]||[0,0];
      selected.centerX-=dx;selected.centerY-=dy;repaintCrop();
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.id!=='avatar-file-input')return;
    const file=event.target.files?.[0];
    event.target.value='';
    if(file)void prepareImage(file).catch(error=>showError(error.message));
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='avatar-zoom'&&selected){
      selected.zoom=Math.min(2.5,Math.max(1,Number(event.target.value)||1));repaintCrop();
    }
  });
  document.addEventListener('cancel',event=>{
    if(event.target.id==='avatar-editor'){event.preventDefault();closeEditor();}
  },true);
  document.addEventListener('pointerdown',event=>{
    const canvas=event.target.closest?.('#avatar-crop-preview');
    if(!canvas||!selected)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId||!selected)return;
    const canvas=document.getElementById('avatar-crop-preview');
    if(!canvas)return;
    const scale=editorSize()/Math.max(1,canvas.getBoundingClientRect().width);
    selected.centerX-=(event.clientX-drag.x)*scale;
    selected.centerY-=(event.clientY-drag.y)*scale;
    drag.x=event.clientX;drag.y=event.clientY;
    repaintCrop();
  });
  for(const eventName of ['pointerup','pointercancel'])document.addEventListener(eventName,event=>{
    if(drag?.id===event.pointerId)drag=null;
  });
}
