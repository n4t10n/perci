import { OFFICIAL_LOGOS } from './brand.js?v=1.6.5';
import {cleanImportedState} from './data/import-cleanup.js?v=1.6.5';
import { storage,readUserState,writeUserState,getLegacyOwner,legacyAlreadyClaimed,markLegacyClaimed,legacyHasPersonalData } from './data/repository.js?v=1.6.5';
import { previewLocalMigration } from './data/migration-preflight.js?v=1.6.5';
import { reconcileCloudWithBaseline, hasPersonalData } from './data/auto-hydration.js?v=1.6.5';
import { dateISO, offsetDate, seed } from './domain/initial-state.js?v=1.6.5';
import { getInitialView } from './domain/startup-route.js?v=1.6.5';
import {account,onAccountChange,onSyncRequested,initAccount,login,signup,logout,markLinked,fetchCloudData,syncCloudSnapshot,deleteCloudEntities,scheduleAccountSync,hasAccountConflict,changeAccountMode,accountInitial,resumePendingSync,probeOfflineAccount} from './account.js?v=1.6.5';
import {renderAccount,renderAuthGate,renderLegacyChoice} from './account-ui.js?v=1.6.5';
import {readOutbox,queueSnapshot,rebaseOutbox,clearOutboxIfCurrent,saveBaseline,getBaseline,planOfflineSync,verifyRemoteSnapshot,readRoutineEditor,saveRoutineEditor,clearRoutineEditor,isOfflineNow,markRecordDeleted,listRecordDeletes,clearRecordDeletes,cancelRecordDelete,applyRemoteEntityDeletes,listEntityDeletes,markEntityDeleted,clearEntityDeletes,cancelEntityDelete,allDeleteIntents,hasDeleteIntents} from './data/offline-outbox.js?v=1.6.5';
import {listRecordDrafts,saveRecordDraft,removeRecordDraft,findRecordDraft} from './data/record-drafts.js?v=1.6.5';
import {canAutoRefreshCloud,shouldRefreshOnNavigation} from './data/auto-refresh.js?v=1.6.5';
import {listTrackedExercises,exerciseHistory,previousExerciseSet,sessionStats,nextPendingSet,restRemaining,restClock} from './domain/training-insights.js?v=1.6.5';
import {cleanSharedRoutine,isValidShareCode,routineTemplateIsEqual} from './domain/routine-share.js?v=1.6.5';


(()=>{'use strict';



let state;try{state=storage.read()||seed();if(!Array.isArray(state.records)||!Array.isArray(state.routines)||!Array.isArray(state.habits))throw Error('Formato inválido')}catch(e){state=seed()}
const freshState=()=>({...seed(),version:3,demo:false,routines:[],records:[],habits:[],checks:{},draft:null});
const app={activeUid:null,needLegacyChoice:false,hydrating:false,silentHydration:false,cloudConflict:null,cloudNotice:'',view:getInitialView(state),tab:'gym',activity:'walk',filter:'all',record:null,routine:null,editor:null,habit:null,exerciseSearch:'',progressExercise:'',completedRecord:null,modal:null,toast:'',share:null};
const icons={account:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',activity:'<path d="M6.5 6.5 17.5 17.5M4 9l5-5M2 7l5-5M15 20l5-5M17 22l5-5"/>',progress:'<path d="M3 19V5m0 14h18M7 16l5-5 4 3 5-7"/>',habits:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 10h18m-13 5 2 2 4-4"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.05 1.57V21h-2.5v-.08a1.7 1.7 0 0 0-1.05-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.1 16a1.7 1.7 0 0 0-1.57-1.05H6.4v-2.5h.09A1.7 1.7 0 0 0 8.1 11.4a1.7 1.7 0 0 0-.34-1.88L7.7 9.46l1.8-1.8.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.05-1.57V6.4H15v.09a1.7 1.7 0 0 0 1.05 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06A1.7 1.7 0 0 0 19.4 11.4a1.7 1.7 0 0 0 1.57 1.05H21v2.5h-.09A1.7 1.7 0 0 0 19.4 15"/>',arrow:'<path d="m9 18 6-6-6-6"/>',plus:'<path d="M12 5v14M5 12h14"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',check:'<path d="m5 12 4 4L19 6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
const icon=(n)=>`<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[n]||icons.arrow}</svg>`;
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=()=>{if(!account.authenticated||!app.activeUid||app.needLegacyChoice||(app.hydrating&&!app.silentHydration)||app.cloudConflict)return false;try{storage.write(state);scheduleAccountSync(JSON.parse(JSON.stringify(state)));applyTheme();return true;}catch(error){window.alert('No hay espacio para guardar. Exportá tu copia JSON y no cierres la pestaña.');return false}};
const applyTheme=()=>{let t=state.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):state.theme;document.documentElement.dataset.theme=t;document.querySelector('meta[name=theme-color]').content=t==='dark'?'#111716':'#f2f4f1'};
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applyTheme);
const navs=[['home','Inicio'],['activity','Actividad'],['progress','Progreso'],['habits','Hábitos']];
const mainView=v=>({home:'home',activity:'activity',routine:'activity',routineEdit:'activity',routineShare:'activity',exerciseLibrary:'activity',session:'activity',otherForm:'activity',progress:'progress',record:'progress',sessionSummary:'progress',habits:'habits',habitEdit:'habits',settings:'settings',account:'account',onboard:'home'}[v]||'home');
const go=v=>{if(!account.authenticated||app.needLegacyChoice)return;if(hasAccountConflict())v='account';app.view=v;window.scrollTo({top:0,behavior:'instant'});render();
  // Al navegar a una pantalla de lectura, traer los datos nuevos de la cuenta.
  // La edición y los entrenamientos activos no deben interrumpirse.
  if(shouldRefreshOnNavigation(v))queueMicrotask(()=>refreshConnectionAware(8000));
};
const toast=s=>{app.toast=s;let el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=s;document.querySelectorAll('.toast').forEach(x=>x.remove());document.body.appendChild(el);setTimeout(()=>el.remove(),2400)};
const title=(head,sub,action='')=>`<div class="row between wrap" style="align-items:end;margin:7px 0 21px"><div><h1 style="font-size:clamp(29px,4vw,43px);margin:0 0 8px">${head}</h1><p class="sub" style="margin:0">${sub}</p></div>${action}</div>`;
const back=(dest='activity')=>`<button class="back" data-action="go" data-value="${dest}">← Volver</button>`;
const button=(label,action,value='',cls='')=>`<button class="btn ${cls}" data-action="${action}" data-value="${h(value)}">${label}</button>`;
const getWeek=()=>Array.from({length:7},(_,i)=>offsetDate(i-6));
const sessionsWeek=()=>state.records.filter(r=>getWeek().includes(r.date));
const countMin=r=>r.reduce((sum,x)=>sum+Number(x.minutes||0),0);
const weekDay=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR',{weekday:'short'}).replace('.','');
const graph=()=>{const days=getWeek(),vals=days.map(d=>countMin(state.records.filter(r=>r.date===d))),max=Math.max(60,...vals);return `<div class="chart" role="img" aria-label="Minutos registrados en los últimos siete días: ${vals.join(', ')}"><div style="display:none">${vals.join(', ')}</div>${days.map((d,i)=>`<div class="barcol"><div class="bar ${vals[i]?'':'empty'}" style="height:${Math.max(5,Math.round(vals[i]/max*100))}%" title="${vals[i]} minutos"></div><span class="barlabel">${weekDay(d).slice(0,3)}</span></div>`).join('')}</div>`};
const bars=()=>`<div class="card"><div class="chart-card-header"><div><h3 style="margin:0">Actividad semanal</h3><div class="micro">Minutos por día · últimos 7 días</div></div><div class="chart-mini-photo" role="img" aria-label="Fotografía editorial de entrenamiento"></div></div>${graph()}<div class="row between" style="margin-top:14px"><small class="muted">${countMin(sessionsWeek())} minutos registrados</small><button class="btn small outline" data-action="go" data-value="progress">Ver progreso ${icon('arrow')}</button></div></div>`;
const brandMarkup=()=>`<span class="brand-slot" role="img" aria-label="Percí"><img class="brand-img-dark" alt="" src="${OFFICIAL_LOGOS.horizDark}"><img class="brand-img-light" alt="" src="${OFFICIAL_LOGOS.horizLight}"></span>`;
const iconMarkup=(cls='')=>`<span class="official-symbol ${cls}" role="img" aria-label="Isotipo original de Percí"><img class="brand-img-dark" alt="" src="${OFFICIAL_LOGOS.iconDark}"><img class="brand-img-light" alt="" src="${OFFICIAL_LOGOS.iconLight}"></span>`;
const navbtn=([key,label])=>`<button class="navbtn ${mainView(app.view)===key?'active':''}" data-action="go" data-value="${key}" aria-label="${label}" ${mainView(app.view)===key?'aria-current="page"':''}>${icon(key)}<span>${label}</span></button>`;
// La información técnica de sincronización es silenciosa mientras hay conexión.
// Solo mostramos un aviso visible cuando el dispositivo está desconectado.
const syncNotice=()=>isOfflineNow(account)?`<div class="offline-alert" role="status"><strong>◌ Sin conexión · Guardado local</strong><span>Podés seguir creando rutinas y registrando entrenamientos. Los cambios se guardan en este dispositivo hasta recuperar la conexión.</span></div>`:'';
const shell=body=>`<div class="app"><aside class="rail" aria-label="Navegación principal"><div class="logo">${brandMarkup()}</div><nav class="nav">${navs.map(navbtn).join('')}</nav><div class="rail-bottom"><button class="navbtn ${app.view==='account'?'active':''}" data-action="go" data-value="account" aria-label="Mi cuenta" ${app.view==='account'?'aria-current="page"':''}>${icon('account')}<span>Mi cuenta</span></button><button class="navbtn ${app.view==='settings'?'active':''}" data-action="go" data-value="settings" aria-label="Ajustes" ${app.view==='settings'?'aria-current="page"':''}>${icon('settings')}<span>Ajustes</span></button><div class="status"><span class="dot"></span>${isOfflineNow(account)?'Sin conexión · Guardado local':'Cuenta conectada'}</div></div></aside><main class="main"><header class="top"><div class="mobile-logo">${brandMarkup()}</div><div class="eyebrow">PERCÍ / TU ESPACIO DE PROGRESO</div><div class="topright"><button class="iconbtn" data-action="go" data-value="settings" title="Ajustes" aria-label="Ajustes">${icon('settings')}</button><button class="avatar ${app.view==='account'?'active':''}" data-action="go" data-value="account" title="Mi cuenta" aria-label="Abrir Mi cuenta">${h(accountInitial(account.user)||'•')}</button></div></header>${syncNotice()}${body}<footer class="footer-note">Percí · Tu progreso, a tu ritmo.</footer></main><nav class="mobile-nav" aria-label="Navegación inferior">${navs.map(navbtn).join('')}</nav></div>${app.modal?renderModal():''}`;
function renderHome(){const sw=sessionsWeek();const next=state.routines[0];const action=state.draft?button('▶ Continuar sesión','continue','',''):state.focus==='others'?button('Registrar actividad ↗','other','walk'):next?button('Empezar a entrenar ↗','start',next.id):button('Crear primera rutina ↗','editRoutine','new');const secondary=state.focus==='others'?button('Ver rutinas','go','activity','outline'):button('Registrar otra actividad','other','walk','outline');return `<div class="home-head"><div class="eyebrow">TU ESPACIO. TU RITMO.</div><h1>Construí tu progreso.</h1><p class="sub">Cada sesión suma. Lo importante es que sea tuyo.</p></div><section class="hero" aria-label="Entrenamiento destacado"><div class="hero-content"><div class="eyebrow">${state.draft?'SESIÓN EN CURSO':'TU PRÓXIMO MOVIMIENTO'}</div><h1>${state.draft?'Tu sesión te espera.':state.focus==='others'?'Movete a tu manera.':next?'Una buena sesión empieza acá.':'Empezá por lo que te mueve.'}</h1><p>${state.draft?'Retomá exactamente donde dejaste tu entrenamiento.':state.focus==='others'?'Caminata, running, bici o deporte. Registrá lo que disfrutás.':next?`${h(next.name)} · ${next.exercises.length} ejercicios. Listo cuando vos estés listo.`:'Armá una rutina propia o registrá tu actividad favorita.'}</p><div class="row wrap">${action}</div></div><div class="hero-flair">ENFOQUE · CONSTANCIA · PROGRESO</div></section><div class="section-head"><h2>Una mirada a tu semana</h2><span class="micro">${state.demo?'Datos ilustrativos':'Tus registros'}</span></div><div class="grid3"><div class="card"><div class="kpi-icon">◷</div><div class="kpi-val">${sw.length}</div><div class="kpi-label">Actividades</div></div><div class="card"><div class="kpi-icon">↗</div><div class="kpi-val">${countMin(sw)}</div><div class="kpi-label">Minutos activos</div></div><div class="card"><div class="kpi-icon">✓</div><div class="kpi-val">${state.habits.filter(x=>!x.paused&&getDueToday(x)).length?Math.round(state.habits.filter(x=>!x.paused&&getDueToday(x)&&state.checks[`${x.id}:${dateISO()}`]).length/state.habits.filter(x=>!x.paused&&getDueToday(x)).length*100)+'%':'—'}</div><div class="kpi-label">Hábitos de hoy</div></div></div><div class="section-head"><h2>Tu actividad, en perspectiva</h2></div><div class="grid2">${bars()}<div class="card"><div class="row between"><div><h3>Pequeños compromisos</h3><div class="micro">Hábitos programados hoy</div></div><button class="btn small outline" data-action="go" data-value="habits">Ver todos</button></div>${renderHabitMini()}<div class="divider"></div><p class="micro">Una pausa programada no interrumpe tu progreso.</p></div></div><div class="section-head"><h2>¿Qué te gustaría hacer hoy?</h2></div><div class="twocol"><div class="photo-card" style="--photo:url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=700&q=80'),linear-gradient(130deg,#264a45,#17201e)"><div class="eyebrow">FUERZA Y GIMNASIO</div><h3>Entrená con foco.</h3><button class="btn small" data-action="go" data-value="activity">Ver rutinas ↗</button></div><div class="photo-card" style="--photo:url('https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=700&q=80'),linear-gradient(130deg,#264a45,#17201e)"><div class="eyebrow">MOVIMIENTO LIBRE</div><h3>Registrá tu actividad.</h3><button class="btn small" data-action="other" data-value="walk">Registrar ↗</button></div></div>`}
function getDueToday(x){return x.days.includes(new Date().getDay())}
function renderHabitMini(){let list=state.habits.filter(x=>!x.paused&&getDueToday(x));return list.length?list.map(x=>`<div class="listrow"><div class="bubble">✦</div><div class="grow"><strong>${h(x.name)}</strong><div class="micro">Hoy</div></div><button class="habit-done ${state.checks[`${x.id}:${dateISO()}`]?'on':''}" data-action="toggleHabit" data-value="${x.id}" aria-label="Completar ${h(x.name)}">${state.checks[`${x.id}:${dateISO()}`]?'✓':'○'}</button></div>`).join(''):`<div class="empty"><div class="emoji">☼</div>No hay hábitos programados hoy.</div>`}
const categories=[['walk','Caminata','🚶'],['run','Running','🏃'],['cycle','Bicicleta','🚴'],['sport','Deporte','🏐'],['other','Otra','✦']];
function renderActivity(){return `${title('Tu movimiento, a tu manera.','Entrená con una rutina o registrá otra actividad. Todo cuenta.') }<div class="tabbar" role="group" aria-label="Tipo de actividad"><button class="tab ${app.tab==='gym'?'active':''}" data-action="tab" data-value="gym" aria-pressed="${app.tab==='gym'}">Gimnasio</button><button class="tab ${app.tab==='other'?'active':''}" data-action="tab" data-value="other" aria-pressed="${app.tab==='other'}">Otras actividades</button></div>${app.tab==='gym'?`<div class="row between wrap" style="margin:8px 0 17px"><h2>Mis rutinas</h2><div class="row wrap">${button('+ Crear rutina','editRoutine','new','small')}${button('Agregar por código','importByCode','','small outline')}</div></div>${readRoutineEditor(app.activeUid)?isOfflineNow(account)?`<div class="offline-alert waiting" role="status"><strong>Rutina guardada sin conexión.</strong><span>Podés continuar desde donde la dejaste.</span>${button('Retomar borrador','resumeRoutineDraft','','small')}</div>`:`<div class="row wrap" style="margin:0 0 16px">${button('Continuar edición guardada','resumeRoutineDraft','','small outline')}</div>`:''}${state.routines.length?`<div class="grid2">${state.routines.map((r,i)=>`<div class="card" style="padding:0;overflow:hidden"><div class="image-strip" style="${i%2?'background-image:linear-gradient(90deg,#17201ed9,#17201e20),url(https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80),linear-gradient(130deg,#264a45,#17201e)':''}">RUTINA ${String(i+1).padStart(2,'0')}</div><div style="padding:20px"><h3>${h(r.name)}</h3><p class="micro">${r.exercises.length} ejercicios · ${r.exercises.reduce((a,e)=>a+Number(e.sets),0)} series</p><div class="row wrap">${button('Ver rutina ↗','detailRoutine',r.id,'small')}${button('Empezar','start',r.id,'small ghost')}</div></div></div>`).join('')}</div>`:`<div class="card empty"><div class="emoji">🏋️</div><h3>Tu primera rutina empieza acá.</h3><p>No te mostramos una sesión para iniciar hasta que tengas una rutina real.</p>${button('Crear mi rutina','editRoutine','new')}</div>`}<div class="section-head"><h2>Biblioteca de ejercicios</h2></div><div class="card"><div class="row between wrap"><div><h3 style="margin:0 0 5px">Encontrá tu próximo ejercicio</h3><p class="micro" style="margin:0">Seleccioná, organizá y personalizá tu entrenamiento.</p></div>${button('Explorar ejercicios','library','','small outline')}</div></div>`:`<div class="photo-card" style="min-height:196px;--photo:url('https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80'),linear-gradient(130deg,#264a45,#17201e)"><div class="eyebrow">MOVIMIENTO SIN ETIQUETAS</div><h3>Elegí la actividad, después registrá lo importante.</h3></div><div class="section-head"><h2>¿Qué hiciste hoy?</h2></div><div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">${categories.map(([key,label,emoji])=>`<button class="card" data-action="other" data-value="${key}" style="text-align:left;min-height:120px"><span style="font-size:27px">${emoji}</span><h3 style="font-size:17px;margin:13px 0 0">${label}</h3><span class="micro">Registrar ↗</span></button>`).join('')}</div>`}`}
const lib=['Press de banca','Sentadilla','Peso muerto','Remo con mancuerna','Press militar','Jalón al pecho','Prensa de piernas','Curl de bíceps','Plancha','Elevación lateral','Hip thrust','Dominadas'];
function renderLibrary(){return `<div class="detail-top">${back(app.editor?'routineEdit':'activity')}<span class="micro">BIBLIOTECA</span></div>${title('Biblioteca de ejercicios','Encontrá movimientos por nombre o añadí uno propio.')}
${app.editor?`<section class="card custom-exercise-top" aria-label="Añadir ejercicio personalizado"><div class="field" style="margin:0"><label for="customexercise">Crear ejercicio personalizado</label><div class="row wrap custom-exercise-row"><input id="customexercise" maxlength="80" autocomplete="off" placeholder="Ej. Remo unilateral en polea" aria-describedby="customexercise-help"/><button class="btn" data-action="addCustomExercise">+ Añadir</button></div><p class="fieldhint" id="customexercise-help">Escribilo acá sin tener que bajar por toda la biblioteca.</p></div></section>`:''}
<div class="field library-search"><label for="libsearch">Buscar en la biblioteca</label><div class="row wrap"><input id="libsearch" placeholder="Ej. Sentadilla" autocomplete="off" value="${h(app.exerciseSearch)}"/><button class="btn outline" data-action="searchLibrary">Buscar</button></div></div>
<div class="card library-results">${lib.filter(e=>e.toLowerCase().includes(app.exerciseSearch.toLowerCase())).map(e=>`<div class="listrow"><div class="bubble">✦</div><div class="grow"><strong>${h(e)}</strong><div class="micro">Fuerza · biblioteca base</div></div>${app.editor?button('+ Añadir','addExercise',e,'small'):button('Ver rutinas','go','activity','small outline')}</div>`).join('')||'<div class="empty">No encontramos coincidencias. Probá con otra búsqueda o agregalo arriba como personalizado.</div>'}</div>`}


function renderRoutineShare(){
  const s=app.share;
  if(!s)return `${title('Compartir e importar rutinas','Seleccioná una rutina o ingresá un código.')}${button('Volver a mis rutinas','go','activity','outline')}`;
  const busy=!!s.busy;
  if(s.mode==='export')return `<div class="detail-top">${back('routine')}<span class="micro">PERCÍ SHARE</span></div>${title('Compartí tu rutina','La otra persona podrá importar una copia independiente. No se comparte tu historial, pesos registrados ni datos personales.')}
    <div class="card"><h3>${h(s.name||'Mi rutina')}</h3>${s.code?`<p class="micro">Código de rutina · válido durante 90 días</p><div class="card" style="background:var(--surface-alt,transparent);margin:14px 0"><strong style="font-size:clamp(18px,3vw,29px);letter-spacing:.08em;overflow-wrap:anywhere">${h(s.code)}</strong></div><div class="row wrap">${button('Copiar código','copyShareCode','','small')}${button('Revocar código','revokeShareCode','','small outline')}</div>`:`<p class="micro">${busy?'Generando código seguro…':'Todavía no generamos el código.'}</p>`}${s.error?`<p class="fieldhint" role="alert">${h(s.error)}</p>`:''}${!s.code&&!busy?button('Reintentar','shareRoutine',s.routineId,'outline'):''}</div>`;
  const r=s.preview;
  return `<div class="detail-top">${back('activity')}<span class="micro">PERCÍ SHARE</span></div>${title('Importar por código','Pegá el código que te compartieron. Antes de guardar vas a ver todos los ejercicios.')}
    <div class="card"><div class="field"><label for="routineShareCode">Código de rutina</label><input id="routineShareCode" maxlength="40" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="PERC-..." value="${h(s.code||'')}"/></div><div class="row wrap">${button(busy?'Buscando…':'Buscar rutina','lookupShareCode','','small')}${button('Cancelar','go','activity','small outline')}</div>${s.error?`<p class="fieldhint" role="alert">${h(s.error)}</p>`:''}</div>
    ${r?`<div class="card" style="margin-top:16px"><div class="eyebrow">VISTA PREVIA</div><h2>${h(r.name)}</h2><p class="micro">${r.exercises.length} ejercicios. Se importará una copia independiente, sin historial ni pesos anteriores.</p>${r.exercises.map((e,i)=>`<div class="listrow"><div class="bubble">${String(i+1).padStart(2,'0')}</div><div class="grow"><strong>${h(e.name)}</strong><div class="micro">${e.sets} series · ${e.reps} repeticiones</div></div></div>`).join('')}<div class="row wrap" style="margin-top:16px">${button('Agregar a mis rutinas','confirmShareImport','','wide')}</div></div>`:''}`;
}
async function routineShareRequest(payload){
  const response=await fetch('/api/routine/share',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({error:'Respuesta inesperada del servidor.'}));
  if(!response.ok)throw Error(data.error||'No pudimos completar la operación.');
  return data;
}
function beginShareRoutine(routineId){
  const r=state.routines.find(x=>x.id===routineId);
  if(!r)return;
  const uid=app.activeUid;
  if(isOfflineNow(account)){toast('Conectate a Internet para generar un código de rutina.');return;}
  app.share={mode:'export',routineId:r.id,name:r.name,code:'',busy:true,error:''};
  go('routineShare');
  let template;
  try{template=cleanSharedRoutine(r);}catch(err){app.share.busy=false;app.share.error=err.message;render();return;}
  routineShareRequest({action:'create',sourceId:r.id,routine:template})
    .then(data=>{if(uid!==app.activeUid||app.share?.mode!=='export'||app.share.routineId!==r.id)return;
      if(!isValidShareCode(data.code))throw Error('El servidor devolvió un código inválido.');
      app.share.code=data.code;app.share.busy=false;render();})
    .catch(err=>{if(uid!==app.activeUid||app.share?.mode!=='export'||app.share.routineId!==r.id)return;
      app.share.busy=false;app.share.error=err.message||'No pudimos compartir la rutina.';render();});
}
function lookupShareRoutine(){
  const s=app.share;
  if(!s||s.mode!=='import'||s.busy)return;
  const code=(get('routineShareCode')?.value||s.code||'').trim();
  s.code=code;s.error='';s.preview=null;
  if(!isValidShareCode(code)){s.error='El código no tiene un formato válido. Copialo exactamente.';render();return;}
  if(isOfflineNow(account)){s.error='Conectate a Internet para buscar la rutina.';render();return;}
  const uid=app.activeUid;
  s.busy=true;render();
  routineShareRequest({action:'lookup',code})
    .then(data=>{if(uid!==app.activeUid||app.share!==s||s.code!==code)return;
      s.preview=cleanSharedRoutine(data.routine);s.busy=false;render();})
    .catch(err=>{if(uid!==app.activeUid||app.share!==s||s.code!==code)return;
      s.error=err.message||'No encontramos la rutina.';s.busy=false;render();});
}
function revokeShareRoutine(){
  const s=app.share;
  if(!s||s.mode!=='export'||!s.code||s.busy)return;
  if(!window.confirm('¿Revocar este código? Quien ya importó una rutina conservará su copia.'))return;
  const uid=app.activeUid,code=s.code;
  s.busy=true;render();
  routineShareRequest({action:'revoke',code})
    .then(data=>{if(uid!==app.activeUid||app.share!==s)return;
      s.busy=false;if(!data.revoked)throw Error('No pudimos revocar este código.');
      s.code='';s.error='Código revocado. Podés generar uno nuevo.';render();})
    .catch(err=>{if(uid!==app.activeUid||app.share!==s)return;
      s.busy=false;s.error=err.message||'No pudimos revocar el código.';render();});
}
function importSharedRoutine(){
  const s=app.share;
  if(!s||s.mode!=='import'||!s.preview)return;
  let template;
  try{template=cleanSharedRoutine(s.preview);}catch(err){s.error=err.message;render();return;}
  if(state.routines.some(x=>routineTemplateIsEqual(x,template))){
    if(!window.confirm('Ya tenés una rutina exactamente igual. ¿Querés importarla igualmente como otra copia?'))return;
  }
  const r={id:id(),name:template.name,exercises:template.exercises.map(x=>({...x}))};
  state.routines.push(r);
  if(!save()){state.routines=state.routines.filter(x=>x.id!==r.id);toast('No se pudo guardar. Intentá nuevamente.');return;}
  app.share=null;app.routine=r.id;go('routine');toast('Rutina importada a tu cuenta.');
}

function renderRoutine(){const r=state.routines.find(x=>x.id===app.routine);if(!r)return renderActivity();return `<div class="detail-top">${back()}<span class="micro">DETALLE DE RUTINA</span></div><div class="photo-card" style="min-height:240px;--photo:url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1100&q=80'),linear-gradient(130deg,#264a45,#17201e)"><div class="eyebrow">TU PRÓXIMA SESIÓN</div><h2 style="color:#fff">${h(r.name)}</h2><div class="row wrap">${button('▶ Empezar entrenamiento','start',r.id,'small')}</div></div><div class="section-head"><h2>Plan de entrenamiento</h2>${button('Editar rutina','editRoutine',r.id,'small outline')}</div><div class="card">${r.exercises.map((e,i)=>`<div class="listrow"><div class="bubble">${String(i+1).padStart(2,'0')}</div><div class="grow"><strong>${h(e.name)}</strong><div class="micro">${e.sets} series · ${e.reps} repeticiones objetivo</div></div></div>`).join('')}</div><div class="row wrap" style="margin-top:16px">${button('Empezar ahora','start',r.id,'wide')}${button('Compartir rutina','shareRoutine',r.id,'outline')}${button('Duplicar','duplicateRoutine',r.id,'outline')}${button('Eliminar','deleteRoutine',r.id,'outline')}</div>`}
function renderRoutineEdit(){const e=app.editor||{id:null,name:'',exercises:[]};return `<div class="detail-top">${back(e.id?'routine':'activity')}<span class="micro">${e.id?'EDITAR':'NUEVA'} RUTINA</span></div>${title(e.id?'Editá tu rutina':'Creá una rutina propia','Planificá el entrenamiento. Registrarlo será otra acción, cuando lo realices.') }${!e.id?`<div class="row wrap" style="margin-bottom:14px">${button('Agregar por código de rutina','importByCode','','small outline')}</div>`:''}<div class="card"><div class="field"><label for="rname">Nombre de la rutina *</label><input id="rname" maxlength="80" value="${h(e.name)}" placeholder="Ej. Tren superior A"/></div><div class="section-head"><h2>Ejercicios (${e.exercises.length})</h2>${button('+ Añadir ejercicio','library','','small outline')}</div>${e.exercises.length?e.exercises.map((item,i)=>`<div class="exercise-row" data-exrow="${i}"><div class="row between"><strong>${h(item.name)}</strong><button class="btn small outline" data-action="removeExercise" data-value="${i}">Quitar</button></div><div class="inline2" style="margin-top:12px"><div><label>Series</label><input data-field="sets" type="number" min="1" max="15" value="${item.sets}"/></div><div><label>Reps objetivo</label><input data-field="reps" type="number" min="1" max="100" value="${item.reps}"/></div></div></div>`).join(''):`<div class="empty">Todavía no agregaste ejercicios.<br/>Usá la biblioteca para empezar.</div>`}${isOfflineNow(account)?'<div class="offline-draft-note">◌ Sin conexión: guardá esta rutina como borrador local. Se sincronizará después.</div>':''}<div class="row wrap" style="margin-top:17px">${button(isOfflineNow(account)?'Guardar borrador':'Guardar rutina','saveRoutine')} ${button('Cancelar','cancelEdit','','outline')}</div></div>`}
const asKg=value=>Number(value||0).toLocaleString('es-AR',{maximumFractionDigits:2});
function renderRestPanel(d){
  const enabled=d.restEnabled===true,seconds=[60,90,120].includes(Number(d.restSeconds))?Number(d.restSeconds):90;
  const active=enabled && restRemaining(d.restUntil)>0;
  return `<section class="rest-panel card" aria-label="Descanso opcional"><div class="row between wrap"><div><h3>Descanso entre series</h3><p class="micro">Opcional. Podés seguir entrenando sin esperar.</p></div><button class="btn small outline" data-action="toggleRest" aria-pressed="${enabled}">${enabled?'Desactivar':'Activar descanso'}</button></div>${enabled?`<div class="rest-controls"><div class="rest-clock" data-rest-clock role="timer" aria-label="Tiempo de descanso">${active?restClock(d.restUntil):'00:00'}</div><div class="rest-actions"><div class="rest-durations" role="group" aria-label="Duración del descanso">${[60,90,120].map(n=>`<button class="chip ${seconds===n?'active':''}" data-action="restDuration" data-value="${n}" aria-pressed="${seconds===n}">${n} s</button>`).join('')}</div><button class="btn small outline" data-action="${active?'skipRest':'startRest'}">${active?'Omitir descanso':'Iniciar descanso'}</button></div></div>`:''}</section>`;
}
function renderSession(){
  const d=state.draft;if(!d)return '<div class="empty">No hay sesión activa.</div>';
  const r=state.routines.find(x=>x.id===d.routineId)||{name:'Sesión',exercises:d.snapshot};
  const items=d.snapshot||r.exercises;
  const summary=sessionStats(d),completed=summary.completed,total=summary.total;
  const next=nextPendingSet(d);
  return `<div class="detail-top">${back('activity')}<span class="badge good">● ${isOfflineNow(account)?'Borrador sin conexión':'Guardado localmente'}</span></div><div class="sessionhead"><div class="eyebrow">ENTRENAMIENTO EN CURSO</div><h2 style="margin:10px 0">${h(r.name)}</h2><p class="micro">Registrá cada serie. Podés salir y continuar más tarde.</p><div class="row between wrap"><strong>${completed} / ${total} series confirmadas</strong><span class="micro">${Math.round(completed/Math.max(1,total)*100)}% completado</span></div><div class="progressline" style="margin-top:10px"><span style="width:${completed/Math.max(1,total)*100}%"></span></div><div class="session-live-stats"><span>${asKg(summary.volume)} kg de volumen</span><span>Tiempo transcurrido: ${summary.minutes} min</span></div></div>${renderRestPanel(d)}
<div class="section-head"><h2>Tu sesión</h2><span class="badge">${isOfflineNow(account)?'Se sincronizará al finalizar y reconectar':'Las series se sincronizan al finalizar'}</span></div>
${items.map((item,i)=>`<section class="card session-exercise" aria-label="Ejercicio ${i+1}: ${h(item.name)}"><div class="row between wrap"><div><div class="eyebrow">EJERCICIO ${i+1}/${items.length}</div><h3>${h(item.name)}</h3><div class="micro">Objetivo ${item.reps} reps · ${item.sets} series</div></div><span class="help-icon">${i+1}</span></div>
${Array.from({length:Number(item.sets)},(_,j)=>{
  const k=`${i}-${j}`,o=d.sets?.[k]||{};
  const prior=previousExerciseSet(state.records,item.name,j+1);
  const isCurrent=k===next;
  return `<div class="set-block ${o.done?'set-complete':isCurrent?'set-next':''}"><div class="setrow" data-set="${k}"><div class="num">${j+1}</div><div><label>Peso (kg)</label><input type="number" inputmode="decimal" min="0" max="99999" step="0.5" placeholder="0" data-field="weight" value="${o.weight??''}" aria-label="Peso serie ${j+1} de ${h(item.name)}"/></div><div><label>Reps</label><input type="number" inputmode="numeric" min="0" max="100" data-field="reps" placeholder="${item.reps}" value="${o.reps??item.reps}" aria-label="Repeticiones serie ${j+1} de ${h(item.name)}"/></div><button class="${o.done?'done':''}" data-action="toggleSet" data-value="${k}" aria-label="${o.done?'Desmarcar':'Completar'} serie ${j+1}" aria-pressed="${!!o.done}">${o.done?'✓':'○'}</button></div><div class="set-foot">${o.done?'<span class="set-finished-text">✓ Confirmada</span>':isCurrent?'<span class="set-next-text">Siguiente serie</span>':'<span class="micro">Pendiente</span>'}${prior?`<span class="set-history">Última vez: ${asKg(prior.weight)} kg × ${prior.reps} reps</span>${!o.done?`<button class="set-use-prior" data-action="usePreviousSet" data-value="${k}" aria-label="Usar valores anteriores de la serie ${j+1}">Usar anterior</button>`:''}`:'<span class="set-history">Sin registro previo de esta serie</span>'}</div></div>`;
}).join('')}</section>`).join('')}
<div class="card session-end"><div class="row between wrap"><div><h3 style="margin-bottom:4px">${completed===total?'Sesión completa':'Avanzá a tu ritmo'}</h3><p class="micro" style="margin:0">Guardamos tus series en este dispositivo. Al finalizar, se respaldan en tu cuenta cuando haya conexión.</p></div>${button('Finalizar sesión','finishSession')}</div></div>`;
}
function renderSessionSummary(){
  const r=state.records.find(x=>x.id===app.completedRecord);
  if(!r || r.type!=='gym')return renderProgress();
  return `<div class="session-summary"><div class="summary-mark" aria-hidden="true">✓</div><div class="eyebrow">ENTRENAMIENTO GUARDADO</div><h1>${h(r.name)}</h1><p class="sub">Registraste una sesión real. Cada serie suma a tu progreso.</p><div class="tiles summary-tiles"><div class="tile"><div class="val">${r.minutes}</div><div class="micro">Minutos</div></div><div class="tile"><div class="val">${r.setsDone||0}</div><div class="micro">Series</div></div><div class="tile"><div class="val">${asKg(r.volume)}</div><div class="micro">Volumen (kg)</div></div></div><div class="card"><h3>Series realizadas</h3>${(r.setDetails||[]).map(x=>`<div class="listrow"><div class="grow"><strong>${h(x.exerciseName)}</strong><div class="micro">Serie ${x.setNumber} · ${asKg(x.weight)} kg × ${x.reps} reps</div></div><span class="badge good">✓</span></div>`).join('')}</div><p class="micro">${isOfflineNow(account)?'Guardado localmente. Se sincronizará al recuperar conexión.':'La sincronización con tu cuenta continúa automáticamente.'}</p><div class="row wrap summary-actions">${button('Ver progreso','go','progress')}${button('Volver a Actividad','go','activity','outline')}</div></div>`;
}

function renderOtherForm(){const [key,label,emoji]=categories.find(x=>x[0]===app.activity)||categories[0];const wantsDist=['walk','run','cycle'].includes(key);return `<div class="detail-top">${back('activity')}<span class="micro">REGISTRO DE ACTIVIDAD</span></div>${title(`${emoji} ${label}`,'Solo los datos que importan para esta actividad.') }<div class="card" style="max-width:680px"><div class="field"><label for="adate">Fecha</label><input type="date" id="adate" value="${dateISO()}"/></div>${key==='sport'?'<div class="field"><label for="aname">¿Qué deporte practicaste? *</label><input id="aname" placeholder="Ej. Vóley, fútbol" maxlength="60"/></div>':key==='other'?'<div class="field"><label for="aname">Nombre de la actividad *</label><input id="aname" placeholder="Ej. Yoga, baile" maxlength="60"/></div>':''}<div class="field"><label for="amins">Duración (minutos) *</label><input id="amins" type="number" min="1" max="1440" placeholder="Ej. 40"/></div>${wantsDist?'<div class="field"><label for="adistance">Distancia (km) · opcional</label><input id="adistance" type="number" min="0" max="1000" step="0.01" placeholder="Ej. 4.2"/></div>':''}<div class="field"><label for="anote">Nota · opcional</label><textarea id="anote" maxlength="400" placeholder="¿Cómo te sentiste?"></textarea></div>${isOfflineNow(account)?'<div class="offline-alert"><strong>Sin conexión</strong><span>Tu actividad quedará guardada en este dispositivo.</span></div>':''}<div class="row wrap" style="margin-top:17px">${button('Guardar actividad','saveActivity')} ${button('Cancelar','go','activity','outline')}</div></div>`}
function renderStrengthEvolution(){
  const names=listTrackedExercises(state.records);
  if(!names.length)return `<section class="card strength-progress" aria-label="Evolución de fuerza"><div class="row between wrap"><div><h3>Evolución por ejercicio</h3><p class="micro">Se activa después de finalizar sesiones con peso y repeticiones reales.</p></div><span class="badge">Fuerza</span></div><div class="strength-empty">Todavía no hay series completadas para comparar. Tu primera sesión será el punto de partida.</div></section>`;
  const selected=names.some(x=>x===app.progressExercise)?app.progressExercise:names[0];
  const entries=exerciseHistory(state.records,selected);
  const latest=entries.at(-1),first=entries[0],lastEight=entries.slice(-8);
  const max=Math.max(1,...lastEight.map(x=>x.maxWeight));
  const points=lastEight.map((x,i)=>`${16+(lastEight.length===1?0:i*288/(lastEight.length-1))},${94-x.maxWeight/max*73}`).join(' ');
  return `<section class="card strength-progress" aria-label="Evolución de fuerza"><div class="row between wrap strength-head"><div><h3>Evolución por ejercicio</h3><p class="micro">Datos reales de sesiones completadas, sin estimaciones.</p></div><label class="strength-select-label" for="progressExercise">Ejercicio<select id="progressExercise">${names.map(n=>`<option value="${h(n)}" ${n===selected?'selected':''}>${h(n)}</option>`).join('')}</select></label></div><div class="strength-kpis"><div><strong>${asKg(latest.maxWeight)} kg</strong><span>Máximo en la última sesión</span></div><div><strong>${entries.length}</strong><span>Sesiones registradas</span></div><div><strong>${asKg(latest.maxWeight-first.maxWeight)} kg</strong><span>Diferencia respecto de la primera</span></div></div>${lastEight.length>1?`<div class="strength-trend"><svg viewBox="0 0 320 112" preserveAspectRatio="none" role="img" aria-label="Evolución del máximo por sesión de ${h(selected)}: ${lastEight.map(x=>`${asKg(x.maxWeight)} kg`).join(', ')}"><line x1="10" y1="98" x2="310" y2="98" stroke="currentColor" stroke-opacity=".15"/><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${lastEight.map((x,i)=>`<circle cx="${16+i*288/(lastEight.length-1)}" cy="${94-x.maxWeight/max*73}" r="4.5" fill="var(--accent)"/>`).join('')}</svg></div>`:'<p class="micro strength-first">Con otra sesión de este ejercicio vas a poder comparar la evolución.</p>'}<div class="strength-session-list">${entries.slice(-4).reverse().map(x=>`<div class="strength-session"><span>${h(x.date)}</span><strong>${asKg(x.maxWeight)} kg × ${x.repsAtMax} reps</strong><span>${asKg(x.volume)} kg volumen</span></div>`).join('')}</div><p class="micro">El gráfico muestra el mayor peso registrado en cada sesión, no una estimación de fuerza.</p></section>`;
}
function renderProgress(){const categories2=[['all','Todas'],['gym','Fuerza'],['walk','Caminata'],['run','Running'],['cycle','Bici'],['sport','Deporte'],['other','Otras']];const list=state.records.filter(r=>app.filter==='all'||r.type===app.filter).sort((a,b)=>b.date.localeCompare(a.date));const mins=countMin(list);return `${title('El progreso también se ve.','Un historial compartido, métricas específicas y contexto para cada actividad.')}<div class="feature-photo" role="img" aria-label="Fotografía deportiva de personas corriendo"><div><div class="eyebrow">TU HISTORIA EN MOVIMIENTO</div><h2>Cada entrenamiento cuenta.</h2><p>Progreso real, a tu ritmo.</p></div></div><div class="grid2">${bars()}<div class="card"><h3>Tu recorrido</h3><p class="micro">Últimos 7 días · datos ${state.demo?'ilustrativos':'registrados'}</p><div class="tiles"><div class="tile"><div class="val">${sessionsWeek().length}</div><div class="micro">Sesiones</div></div><div class="tile"><div class="val">${countMin(sessionsWeek())}</div><div class="micro">Minutos</div></div><div class="tile"><div class="val">${sessionsWeek().filter(x=>x.type==='gym').length}</div><div class="micro">Fuerza</div></div></div><div class="section-head"><h3 style="font-size:17px">Días con actividad</h3></div><div class="week">${getWeek().map(d=>`<div class="day ${d===dateISO()?'today':''}"><span>${weekDay(d).slice(0,3)}</span><b>${d.slice(-2)}</b>${state.records.some(r=>r.date===d)?'<i></i>':'<span style="height:6px"></span>'}</div>`).join('')}</div></div></div>${renderStrengthEvolution()}<div class="section-head"><h2>Historial</h2><span class="micro">${list.length} registros</span></div><div class="filterline">${categories2.map(([k,l])=>`<button class="chip ${app.filter===k?'active':''}" data-action="filter" data-value="${k}" aria-pressed="${app.filter===k}">${l}</button>`).join('')}</div><div class="card">${list.length?list.map(r=>`<button type="button" class="listrow history-item" data-action="detailRecord" data-value="${r.id}" aria-label="Ver registro ${h(r.name)}"><div class="bubble">${categories.find(x=>x[0]===r.type)?.[2]||'🏋️'}</div><div class="grow"><strong>${h(r.name)}</strong><div class="micro">${new Date(r.date+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'short'})} · ${r.minutes} min ${r.distance?'· '+r.distance+' km':''} ${r.setsDone?'· '+r.setsDone+' series':''}</div></div><span class="history-chevron" aria-hidden="true">${icon('arrow')}</span></button>`).join(''):`<div class="empty"><div class="emoji">◌</div><h3>Sin registros por ahora</h3><p>Cuando registres una actividad, aparecerá acá sin inventar estadísticas.</p>${button('Registrar actividad','go','activity')}</div>`}</div>${renderSavedRecordDrafts()}`}
function renderSavedRecordDrafts(){
  const drafts=listRecordDrafts(app.activeUid);
  if(!drafts.length)return '';
  return `<div class="section-head"><h2>${isOfflineNow(account)?'Borradores guardados':'Registros guardados'}</h2>${isOfflineNow(account)?'<span class="micro">Solo en este dispositivo</span>':''}</div><div class="card">${drafts.map(({record})=>`<div class="listrow"><div class="bubble">◌</div><div class="grow"><strong>${h(record.name)}</strong><div class="micro">Guardado para más adelante · ${h(record.date)}</div></div><div class="row wrap">${button('Restaurar','restoreRecordDraft',record.id,'small outline')}${button('Descartar','discardRecordDraft',record.id,'small ghost')}</div></div>`).join('')}</div>`;
}
function renderRecord(){const r=state.records.find(x=>x.id===app.record);if(!r)return renderProgress();return `<div class="detail-top">${back('progress')}<span class="micro">DETALLE / EDITAR REGISTRO</span></div>${title(h(r.name),'Cada registro tiene sus datos, sin mezclar disciplinas.') }<div class="card" style="max-width:670px"><div class="tiles"><div class="tile"><div class="val">${r.minutes}</div><div class="micro">Minutos</div></div><div class="tile"><div class="val">${r.distance??r.setsDone??'—'}</div><div class="micro">${r.distance?'Km':r.setsDone?'Series':'Dato adicional'}</div></div><div class="tile"><div class="val">${r.volume??'—'}</div><div class="micro">${r.volume?'Volumen kg':'Volumen'}</div></div></div>${r.setDetails?.length?`<div class="divider"></div><h3>Series registradas</h3><div class="micro">Peso y repeticiones reales de este entrenamiento</div>${r.setDetails.map(x=>`<div class="listrow"><div class="bubble">${x.setNumber}</div><div class="grow"><strong>${h(x.exerciseName)}</strong><div class="micro">Serie ${x.setNumber} · ${Number(x.weight)||0} kg × ${Number(x.reps)||0} repeticiones</div></div><span class="badge good">✓</span></div>`).join('')}`:''}<div class="divider"></div><div class="field"><label for="rdate">Fecha</label><input type="date" id="rdate" value="${h(r.date)}"/></div><div class="field"><label for="rmin">Duración (minutos)</label><input type="number" id="rmin" min="1" max="1440" value="${r.minutes}"/></div>${r.distance!==undefined?`<div class="field"><label for="rdist">Distancia (km)</label><input type="number" id="rdist" min="0" step="0.01" value="${r.distance??''}"/></div>`:''}<div class="field"><label for="rnote">Nota</label><textarea id="rnote">${h(r.note??'')}</textarea></div>${r.type==='gym'?'<p class="fieldhint">Las series completadas se muestran como referencia; esta iteración permite editar la duración, fecha y notas del registro.</p>':''}<div class="row wrap" style="margin-top:17px">${button('Guardar cambios','saveRecord')}${button('Eliminar registro','deleteRecord','','outline')}</div></div>`}
function renderHabits(){const due=state.habits.filter(h=>!h.paused&&getDueToday(h));const checked=due.filter(x=>state.checks[`${x.id}:${dateISO()}`]).length;return `${title('Los pequeños pasos importan.','Los hábitos acompañan tu entrenamiento, no lo reemplazan.',button('+ Crear hábito','editHabit','new','small'))}<div class="grid2"><div class="card"><div class="row between"><div><h3>Hoy</h3><p class="micro" style="margin:0">${checked} de ${due.length} hábitos programados</p></div><span class="kpi-val" style="font-size:31px">${due.length?Math.round(checked/due.length*100)+'%':'—'}</span></div><div class="progressline" style="margin-top:15px"><span style="width:${due.length?checked/due.length*100:0}%"></span></div><div class="divider"></div>${renderHabitMini()}</div><div class="card"><h3>Calendario de esta semana</h3><p class="micro">Los días libres no cuentan como incumplimiento.</p><div class="week">${getWeek().map(d=>{const dt=new Date(d+'T12:00:00');let programmed=state.habits.filter(x=>!x.paused&&x.days.includes(dt.getDay()));return `<div class="day ${d===dateISO()?'today':''}"><span>${weekDay(d).slice(0,3)}</span><b>${d.slice(-2)}</b><i style="background:${programmed.length&&programmed.every(x=>state.checks[`${x.id}:${d}`])?'var(--accent)':'var(--muted2)'};opacity:${programmed.length?1:.15}"></i></div>`}).join('')}</div></div></div><div class="section-head"><h2>Mis hábitos</h2><span class="micro">${state.habits.length} configurados</span></div><div class="card">${state.habits.length?state.habits.map(x=>`<div class="listrow"><div class="bubble">${x.paused?'⏸':'✦'}</div><div class="grow"><strong>${h(x.name)}</strong> ${x.paused?'<span class="badge">Pausado</span>':''}<div class="micro">${x.days.length===7?'Todos los días':x.days.map(i=>['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][i]).join(', ')}</div></div><button class="mini" data-action="editHabit" data-value="${x.id}">Editar</button></div>`).join(''):`<div class="empty empty-state"><p class="empty-state-message">Todavía no creaste hábitos.</p><div class="empty-state-actions">${button('Crear uno','editHabit','new')}</div></div>`}</div>`}
function renderHabitEdit(){const x=app.habit||{id:null,name:'',days:[1,2,3,4,5],paused:false};return `<div class="detail-top">${back('habits')}<span class="micro">${x.id?'EDITAR':'NUEVO'} HÁBITO</span></div>${title(x.id?'Editar hábito':'Un hábito a la vez.','Elegí el nombre y los días que tienen sentido para vos.') }<div class="card" style="max-width:650px"><div class="field"><label for="hname">Nombre *</label><input id="hname" maxlength="70" value="${h(x.name)}" placeholder="Ej. Estirar 10 minutos"/></div><div class="field"><label>Días programados *</label><div class="checkbox-group">${['D','L','M','M','J','V','S'].map((s,i)=>`<label class="checkday" title="${['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][i]}"><input type="checkbox" name="hdays" value="${i}" ${x.days.includes(i)?'checked':''}/>${s}</label>`).join('')}</div><div class="fieldhint">Un día no programado se considera descanso, no falta.</div></div><div class="row wrap">${button('Guardar hábito','saveHabit')}${x.id?button(x.paused?'Reanudar':'Pausar','pauseHabit',x.id,'outline'):''}${x.id?button('Eliminar','deleteHabit',x.id,'outline'):''}</div></div>`}
function renderSettings(){return `${title('Tu espacio, a tu modo.','Personalizá Percí a tu ritmo.')}<div class="grid2"><div class="card"><h3>Apariencia</h3><p class="micro">Elegí cómo querés ver Percí.</p><div class="filterline">${[['dark','Oscuro'],['light','Claro'],['system','Automático']].map(([k,v])=>`<button class="chip ${state.theme===k?'active':''}" data-action="theme" data-value="${k}">${v}</button>`).join('')}</div><div class="divider"></div><h3>Tu actividad principal</h3><p class="micro">Podés cambiarla cuando quieras; siempre tendrás acceso a todas tus actividades.</p><div class="filterline">${[['gym','Gimnasio'],['others','Otras actividades'],['both','Ambas']].map(([k,v])=>`<button class="chip ${state.focus===k?'active':''}" data-action="focus" data-value="${k}">${v}</button>`).join('')}</div><div class="divider"></div>${button('Volver a ver bienvenida','onboard','','outline')}</div><div class="card"><h3>Privacidad y tus datos</h3><div class="notice"><strong>✓ Tus datos se guardan en este dispositivo.</strong><p class="micro" style="margin:8px 0 0">${account.linked?'También tenés una copia vinculada a tu cuenta.':'Podés respaldar tus avances desde Mi cuenta.'}</p></div><div class="row wrap" style="margin-top:18px">${button('Mi cuenta','go','account')}${button('Exportar copia de mis datos','export','','outline')}</div><p class="micro" style="margin-top:16px">Si necesitás recuperar un archivo de respaldo, podés importarlo sin borrar nada hasta que lo confirmes.</p>${button('Importar copia JSON','import','','outline')}${storage.hasBackup()?button('Revertir última importación','restoreBackup','','outline'):''}</div></div>`}
function renderOnboard(){return `<div style="max-width:675px;margin:35px auto 0"><div class="onboard-visual">${iconMarkup('onboard-brand')}</div><div class="eyebrow">BIENVENIDO A PERCÍ</div><h1>Tu progreso. Sin comparaciones.</h1><p class="sub">Entrená, movete, registrá tus avances y construí hábitos a tu propio ritmo. Empezá por lo que te interesa.</p><div class="card"><h3>¿Qué te gustaría priorizar?</h3><p class="micro">Podés cambiarlo después y siempre verás todas las actividades.</p><div class="filterline">${[['gym','Gimnasio'],['others','Otras actividades'],['both','Ambas']].map(([k,v])=>`<button class="chip ${state.focus===k?'active':''}" data-action="focus" data-value="${k}">${v}</button>`).join('')}</div><h3 style="margin-top:23px">¿Cómo preferís visualizar Percí?</h3><div class="filterline">${[['dark','Oscuro'],['light','Claro'],['system','Automático']].map(([k,v])=>`<button class="chip ${state.theme===k?'active':''}" data-action="theme" data-value="${k}">${v}</button>`).join('')}</div><div class="row wrap" style="margin-top:17px">${button('Entrar a Percí ↗','finishOnboard')}${button('Omitir por ahora','finishOnboard','','outline')}</div></div></div>`}
function renderModal(){const m=app.modal;if(!m)return '';return `<div class="modal-wrap" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><h2 id="modalTitle">${h(m.title)}</h2><p class="sub">${h(m.body)}</p>${m.extra||''}<div class="row wrap">${button(h(m.confirmLabel||'Confirmar'),m.confirm,m.value||'',m.danger?'danger':'')}${button('Cancelar','closeModal','','outline')}</div></div></div>`}
function render(){
  applyTheme();
  const root=document.getElementById('root');
  if(!account.ready||!account.authenticated){root.innerHTML=renderAuthGate();return;}
  if(app.needLegacyChoice){root.innerHTML=renderLegacyChoice();return;}
  if(app.hydrating&&!app.silentHydration){root.innerHTML=`<main class="auth-loading sync-loading" role="status" aria-live="polite"><div class="eyebrow">PERCÍ · TU ESPACIO PERSONAL</div><h2>Preparando tu progreso…</h2><p>Recuperando tus rutinas y actividades de forma segura.</p></main>`;return;}
  if(app.cloudConflict){root.innerHTML=renderCloudConflict();return;}
  if(!app.activeUid){root.innerHTML=renderAuthGate();return;}
  let view=app.view;
  let out=({home:renderHome,activity:renderActivity,progress:renderProgress,habits:renderHabits,settings:renderSettings,account:renderAccount,routine:renderRoutine,routineEdit:renderRoutineEdit,exerciseLibrary:renderLibrary,session:renderSession,otherForm:renderOtherForm,record:renderRecord,sessionSummary:renderSessionSummary,habitEdit:renderHabitEdit,routineShare:renderRoutineShare,onboard:renderOnboard}[view]||renderHome)();
  root.innerHTML=shell((isOfflineNow(account)&&app.cloudNotice?`<div class="notice" role="status" style="margin-bottom:15px">${h(app.cloudNotice)}</div>`:'')+out);
  if(pendingPwaUpdate)applyPendingPwaUpdate();
}
function activateAccountData(){
  if(!account.authenticated || account.user?.id!==app.activeUid)app.share=null;
  const id=account.user?.id;
  if(!account.authenticated||!id){
    app.activeUid=null;app.needLegacyChoice=false;app.hydrating=false;app.cloudConflict=null;app.cloudNotice='';
    app.editor=null;app.habit=null;app.record=null;app.routine=null;app.completedRecord=null;app.progressExercise='';app.modal=null;
    storage.activateUser(null);state=freshState();app.view='home';return;
  }
  if(app.activeUid===id)return;
  // Invalidar consultas del usuario anterior antes de cambiar de espacio.
  hydrationRerunRequested=false;
  hydrationGeneration++;
  app.hydrating=false;
  const scoped=readUserState(id);
  // Si v1.1 dejó una sincronización pendiente, conservarla en la cola v1.2 antes de leer la nube.
  if(scoped&&!readOutbox(id)){try{const oldKey=`perci_pending_sync_v09_${id}`;if(localStorage.getItem(oldKey)==='1'){queueSnapshot(id,scoped);localStorage.removeItem(oldKey);}}catch{}}
  // No arrastrar editores, modales o selecciones de otra cuenta. Esto también
  // evita bloquear futuras lecturas de Supabase con un editor ya abandonado.
  app.editor=null;app.habit=null;app.record=null;app.routine=null;app.completedRecord=null;app.progressExercise='';app.modal=null;
  app.activeUid=id;
  account.syncPaused=false;
  app.cloudConflict=null;app.cloudNotice='';
  storage.activateUser(id);
  app.modal=null;
  if(scoped){state=scoped;app.needLegacyChoice=false;app.view=getInitialView(state);return;}
  const legacy=storage.readLegacy();
  const owner=getLegacyOwner();
  if(!legacyAlreadyClaimed() && legacyHasPersonalData(legacy) && (!owner||owner===id)){
    app.needLegacyChoice=true;state=freshState();app.view='home';return;
  }
  state=freshState();storage.write(state);app.needLegacyChoice=false;app.view=getInitialView(state);
}
function decideLegacy(copyLegacy){
  if(!app.needLegacyChoice||!account.authenticated||!app.activeUid)return;
  if(copyLegacy){
    const legacy=storage.readLegacy();
    if(!legacy)throw new Error('No encontramos los datos anteriores.');
    // El dato original permanece inalterado; solo copiamos al espacio de esta cuenta.
    state=JSON.parse(JSON.stringify(legacy));
  }else{state=freshState();}
  storage.write(state);
  markLegacyClaimed();
  app.needLegacyChoice=false;
  app.view=getInitialView(state);
  if(!account.offline)hydrateCloud(app.activeUid);
  else render();
}

// Primer acceso online: leer Supabase antes de permitir ediciones locales.
// Nunca subimos automáticamente un snapshot previo hasta completar esta lectura.
// Percí v1.5: actualizar el código de la PWA sin interrumpir ediciones.
let pendingPwaUpdate=false;
let pwaReloadQueued=false;
function applyPendingPwaUpdate(){
  if(!pendingPwaUpdate||pwaReloadQueued||!account.ready||app.hydrating||account.busy||
     app.cloudConflict||app.modal||app.needLegacyChoice||state.draft||
     ['routineEdit','habitEdit','session','sessionSummary','record','otherForm'].includes(app.view))return;
  pwaReloadQueued=true;
  queueMicrotask(()=>window.location.reload());
}
document.addEventListener('perci:pwa-updated',()=>{pendingPwaUpdate=true;applyPendingPwaUpdate();});
let hydrationGeneration=0;
// Una actualización solicitada durante otra lectura no se pierde.
// Importante al guardar un hábito enseguida de iniciar sesión en una cuenta nueva.
let hydrationRerunRequested=false;
function hydrationBelongsToAccount(uid,seq){
  return seq===hydrationGeneration && account.authenticated &&
    account.user?.id===uid && app.activeUid===uid;
}
function checkpointCloud(uid,previous){
  if(!hasPersonalData(previous))return;
  // Copia de seguridad adicional, independiente del respaldo de importación manual.
  const key=`perci_before_cloud_v11_${uid}`;
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(previous));
  storage.backup(previous);
}
function renderCloudConflict(){
  const count=app.cloudConflict?.count||0;
  if(app.cloudConflict?.kind==='deletion')return `<div class="auth-layout"><section class="auth-story"><div class="auth-story-inner"><div class="auth-story-logo">${brandMarkup()}</div><div class="auth-story-copy"><span class="account-eyebrow">SINCRONIZACIÓN SEGURA</span><h1>Tu progreso,<br/><span>sin pérdidas.</span></h1></div></div></section><main class="auth-main"><div class="auth-panel"><div class="auth-form-eyebrow">REVISIÓN PENDIENTE</div><h2>Hay cambios pendientes de revisión</h2><p class="auth-hint">${count} ${count===1?'cambio requiere':'cambios requieren'} confirmación antes de sincronizar. Conservá una copia local o recuperá la última versión de tu cuenta. Tus datos no se borrarán en la nube sin autorización.</p><button class="btn auth-submit" type="button" data-sync-choice="remote">Usar versión de mi cuenta</button><button class="btn outline auth-submit" style="margin-top:10px" type="button" data-sync-choice="cancel">Conservar borradores locales por ahora</button><p class="auth-trust">Guardaremos un respaldo local antes de aplicar tu decisión.</p></div></main></div>`;
  return `<div class="auth-layout"><section class="auth-story"><div class="auth-story-inner"><div class="auth-story-logo">${brandMarkup()}</div><div class="auth-story-copy"><span class="account-eyebrow">CUIDAMOS TUS ENTRENAMIENTOS</span><h1>Tu progreso,<br/><span>sin pérdidas.</span></h1><p>Detectamos diferencias entre los datos de este dispositivo y tu cuenta.</p></div></div></section><main class="auth-main"><div class="auth-panel"><div class="auth-form-eyebrow">SINCRONIZACIÓN EN PAUSA</div><h2>¿Qué versión querés conservar?</h2><p class="auth-hint">Hay ${count} ${count===1?'registro':'registros'} con cambios distintos en la nube y en este dispositivo. Guardaremos una copia local antes de aplicar tu decisión. Los registros que existan solamente en una de las dos copias se conservarán.</p><button class="btn auth-submit" type="button" data-sync-choice="remote">Usar cambios de mi cuenta</button><button class="btn outline auth-submit" style="margin-top:10px" type="button" data-sync-choice="local">Usar cambios de este dispositivo</button><p class="auth-trust">Si elegís conservar los cambios locales, pueden reemplazar o borrar datos remotos. Guardamos un respaldo antes de aplicarlos.</p></div></main></div>`;
}
async function hydrateCloud(uid,{silent=false}={}){
  if(!uid||isOfflineNow(account)||app.needLegacyChoice)return;
  if(app.hydrating){
    if(account.user?.id===uid)hydrationRerunRequested=true;
    return;
  }
  const seq=++hydrationGeneration;
  app.hydrating=true;app.silentHydration=!!silent;app.cloudConflict=null;app.cloudNotice='';
  account.syncPaused=true;
  if(!silent)render();
  let verifiedRoundTrip=false;
  let remoteRevisionChanged=false;
  try{
    const remote=await fetchCloudData();
    if(!hydrationBelongsToAccount(uid,seq))return;
    // Una intención de borrado debe reintentarse incluso si una pestaña se cerró
    // después de registrar el borrado y antes de guardar su snapshot de outbox.
    let pending=readOutbox(uid);
    const pendingIntents=allDeleteIntents(uid);
    if(!pending && hasDeleteIntents(pendingIntents)){
      // Si la pestaña se cerró entre confirmar y guardar el snapshot,
      // reconstituir el estado local sin reintroducir entidades borradas.
      const cleanState={...state};
      for(const kind of ['routines','records','habits']){
        const removed=new Set(pendingIntents[kind]);
        cleanState[kind]=state[kind].filter(item=>!removed.has(item.id));
      }
      const keptHabits=new Set(cleanState.habits.map(x=>x.id));
      cleanState.checks=Object.fromEntries(Object.entries(state.checks).filter(([key])=>keptHabits.has(key.split(':')[0])));
      pending=queueSnapshot(uid,cleanState);
    }
    if(pending){
      // Comparación de 3 vías: cambios locales desde la última lectura, contra la nube actual.
      const pendingDeletes=allDeleteIntents(uid);
      const result=planOfflineSync(pending.base,pending.snapshot,remote,null,pendingDeletes.records,pendingDeletes);
      if(result.unsupportedDeletes.length){
        app.cloudConflict={kind:'deletion',base:pending.base,local:pending.snapshot,remote:JSON.parse(JSON.stringify(remote)),count:result.unsupportedDeletes.length};
        account.syncPaused=true;
      }else if(result.conflicts.length){
        app.cloudConflict={kind:'outbox',base:pending.base,local:pending.snapshot,remote:JSON.parse(JSON.stringify(remote)),count:result.conflicts.length};
      }else if(state.draft && !result.deletions.length){
        // El entrenamiento en curso se conserva localmente; no publicar a medias.
        account.syncPaused=false;
      }else{
        const revision=pending.revision;
        // v1.5: no aplicar un borrado hasta comparar el snapshot de referencia.
        // Control optimista, no CAS transaccional entre tablas.
        if(!hydrationBelongsToAccount(uid,seq))return;
        await syncCloudSnapshot({...result.snapshot,draft:null},remote);
        if(!hydrationBelongsToAccount(uid,seq))return;
        if(result.deletions.length){
          const grouped={routines:[],records:[],habits:[]};
          for(const item of result.deletions)grouped[item.kind].push(item.id);
          await deleteCloudEntities(Object.fromEntries(Object.entries(grouped).filter(([,ids])=>ids.length)));
          if(!hydrationBelongsToAccount(uid,seq))return;
        }
        const confirmed=await fetchCloudData();
        if(!hydrationBelongsToAccount(uid,seq))return;
        if(!verifyRemoteSnapshot(result.snapshot,confirmed,result.deletions))throw Error('La nube todavía no confirmó todos los registros. Conservamos los borradores.');
        saveBaseline(uid,confirmed);
        if(readOutbox(uid)?.revision===revision){
          checkpointCloud(uid,state);
          state={...result.snapshot,draft:state.draft||null};
          storage.write(state);
          clearOutboxIfCurrent(uid,revision);
          clearRecordDeletes(uid,pendingDeletes.records);
          clearEntityDeletes(uid,pendingDeletes);
        }
        account.syncPaused=false;
        markLinked(uid);
        verifiedRoundTrip=true;
        account.syncFailed=false;
        app.cloudNotice='';
        if(!silent)app.view=getInitialView(state);
      }
    }else{
      // v1.6.2: la última copia sincronizada es el ancestro común.
      // Si solo cambió la nube (por una elección ya hecha en iPhone),
      // esta Mac debe recibirla automáticamente, sin repetir el conflicto.
      const baseline=getBaseline(uid);
      const mirror=applyRemoteEntityDeletes(baseline,state,remote);
      const result=mirror.conflicts.length ? null : reconcileCloudWithBaseline(mirror.snapshot,remote,baseline);
      if(mirror.conflicts.length || result.status==='conflict'){
        app.cloudConflict={kind:'initial',base:baseline,local:JSON.parse(JSON.stringify(state)),remote:JSON.parse(JSON.stringify(remote)),count:mirror.conflicts.length||result.conflicts.length};
      }else{
        saveBaseline(uid,remote);
        if(result.status!=='empty-cloud'){
          if(JSON.stringify(result.snapshot)!==JSON.stringify(state)){
            checkpointCloud(uid,state);
            state={...result.snapshot,draft:state.draft||null};
            storage.write(state);
          }
          if(!silent)app.view=getInitialView(state);
        }
        account.syncPaused=false;
        if(!account.linked)markLinked(uid);
        verifiedRoundTrip=true;
        account.syncFailed=false;
        if(result.status==='empty-cloud'&&hasPersonalData(state)){
          queueSnapshot(uid,state);
          // Se necesita otra lectura protegida para enviar datos locales iniciales.
          app.cloudNotice='';
        }
      }
    }
  }catch(err){
    if(seq!==hydrationGeneration||uid!==account.user?.id)return;
    remoteRevisionChanged=err?.status===409;
    account.syncPaused=true;
    account.syncFailed=!remoteRevisionChanged;
    app.cloudNotice=remoteRevisionChanged
      ?'Otro dispositivo actualizó tu cuenta. Percí está comparando los cambios sin perder los locales.'
      :'No pudimos confirmar tus cambios en la nube. Siguen guardados en este dispositivo.';
  }finally{
    if(seq===hydrationGeneration&&uid===account.user?.id){
      app.hydrating=false;app.silentHydration=false;render();
      const rerun=hydrationRerunRequested;
      hydrationRerunRequested=false;
      // No repetir una sincronización fallida indefinidamente. Sí ejecutar
      // exactamente una solicitud recibida mientras había otra en curso.
      if(!app.cloudConflict && !state.draft && !isOfflineNow(account) &&
          (remoteRevisionChanged || rerun || (verifiedRoundTrip && readOutbox(uid)))){
        setTimeout(()=>hydrateCloud(uid,{silent:true}),remoteRevisionChanged?450:rerun?150:900);
      }
    }
  }
}
function chooseCloudConflict(prefer){
  const conflict=app.cloudConflict,uid=app.activeUid;
  if(!conflict||!uid||account.user?.id!==uid)return;
  if(prefer==='cancel'&&conflict.kind==='deletion'){app.cloudConflict=null;app.cloudNotice='Los borradores siguen en este dispositivo. Las eliminaciones no se sincronizaron.';account.syncPaused=true;render();return;}
  try{
    const intents=allDeleteIntents(uid);
    const outcome=conflict.kind!=='initial'?planOfflineSync(conflict.base,conflict.local,conflict.remote,prefer,intents.records,intents):reconcileCloudWithBaseline(conflict.local,conflict.remote,conflict.base,prefer);
    if(outcome.unsupportedDeletes?.length)throw Error('Esta versión no permite sincronizar eliminaciones offline. Los borradores siguen guardados.');
    checkpointCloud(uid,conflict.local);
    state=outcome.snapshot;
    storage.write(state);
    app.cloudConflict=null;
    app.view=getInitialView(state);
    account.syncPaused=false;
    if(conflict.kind==='initial'){
      saveBaseline(uid,conflict.remote);
      if(prefer==='local')queueSnapshot(uid,state);
    }
    if(conflict.kind!=='initial'){
      saveBaseline(uid,conflict.remote);rebaseOutbox(uid,conflict.remote,state);
      if(prefer==='remote'){
        // Aceptó restaurar la versión remota, cancelar intentos incompatibles.
        clearRecordDeletes(uid,listRecordDeletes(uid));
        clearEntityDeletes(uid,listEntityDeletes(uid));
      }
    }
    if(!account.linked)markLinked(uid);
    app.cloudNotice=prefer==='local'?'Conservaste los cambios locales. Revisalos antes de respaldar desde Mi cuenta.':'Recuperaste los cambios de tu cuenta. Conservamos una copia de los datos locales anteriores.';
    render();
    if(conflict.kind!=='initial'||prefer==='local')hydrateCloud(uid);
  }catch(error){window.alert(`No pudimos resolver la diferencia: ${error.message}`);}
}

const get=id=>document.getElementById(id);
const showModal=(title,body,confirm,value='',danger=false,extra='',confirmLabel='Confirmar')=>{app.modal={title,body,confirm,value,danger,extra,confirmLabel};render()};
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(new Date(v+'T12:00:00').getTime());
const id=()=>Math.random().toString(36).slice(2,10);
function persistEditor(){if(!app.editor)return;const name=get('rname');if(name)app.editor.name=name.value;document.querySelectorAll('[data-exrow]').forEach(x=>{const i=Number(x.dataset.exrow);app.editor.exercises[i].sets=Number(x.querySelector('[data-field=sets]').value)||1;app.editor.exercises[i].reps=Number(x.querySelector('[data-field=reps]').value)||1});try{saveRoutineEditor(app.activeUid,app.editor)}catch{toast('No pudimos guardar el borrador. Exportá una copia JSON antes de cerrar.')}}
function beginSession(routineId){const r=state.routines.find(x=>x.id===routineId);if(!r)return;state.draft={id:id(),routineId:r.id,snapshot:JSON.parse(JSON.stringify(r.exercises)),startedAt:Date.now(),sets:{},restEnabled:false,restSeconds:90,restUntil:null,offlineDraft:isOfflineNow(account)};if(save())go('session');}
function deleteRecordConfirmed(recordId,keepDraft=false){
  const record=state.records.find(x=>x.id===recordId);
  if(!record)return;
  try{
    if(keepDraft)saveRecordDraft(app.activeUid,record);
    markRecordDeleted(app.activeUid,recordId);
  }catch(err){window.alert('No pudimos guardar la decisión en este dispositivo. Conservamos el registro.');return;}
  const previous=state.records;
  state.records=state.records.filter(x=>x.id!==recordId);
  app.modal=null;
  app.cloudNotice='';
  if(save()){
    go('progress');
    if(!isOfflineNow(account))queueMicrotask(()=>hydrateCloud(app.activeUid,{silent:true}));
  }else{
    state.records=previous;
    cancelRecordDelete(app.activeUid,recordId);
    if(keepDraft)removeRecordDraft(app.activeUid,recordId);
    render();
  }
  // Sin cartel posterior: el estado mínimo de sincronización sigue en la barra lateral.
}
function deletePersonalEntity(kind,itemId){
  if(!['routines','habits'].includes(kind)||!state[kind].some(x=>x.id===itemId))return;
  const previous=JSON.parse(JSON.stringify(state));
  try{markEntityDeleted(app.activeUid,kind,itemId);}catch{
    window.alert('No pudimos guardar el borrado pendiente. Conservamos los datos.');return;
  }
  state[kind]=state[kind].filter(x=>x.id!==itemId);
  // Eliminar un hábito elimina sus checks asociados; no se cuentan en métricas.
  if(kind==='habits')state.checks=Object.fromEntries(Object.entries(state.checks).filter(([key])=>key.split(':')[0]!==itemId));
  app.modal=null;app.cloudNotice='';
  if(save()){
    go(kind==='routines'?'activity':'habits');
    if(!isOfflineNow(account))queueMicrotask(()=>hydrateCloud(app.activeUid,{silent:true}));
  }else{
    state=previous;
    cancelEntityDelete(app.activeUid,kind,itemId);
    render();
  }
}
function handle(action,value){switch(action){
case 'go':app.modal=null;go(value);break;
case 'tab':app.tab=value;render();break;
case 'filter':app.filter=value;render();break;
case 'theme':state.theme=value;save();render();break;
case 'focus':state.focus=value;save();render();break;
case 'finishOnboard':state.onboardSeen=true;save();go('home');break;
case 'onboard':go('onboard');break;
case 'detailRoutine':app.routine=value;go('routine');break;
case 'importByCode':app.share={mode:'import',code:'',preview:null,busy:false,error:''};go('routineShare');break;
case 'shareRoutine':beginShareRoutine(value);break;
case 'lookupShareCode':lookupShareRoutine();break;
case 'confirmShareImport':importSharedRoutine();break;
case 'revokeShareCode':revokeShareRoutine();break;
case 'copyShareCode':{const code=app.share?.code;if(!code)break;
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(code).then(()=>toast('Código copiado'),()=>window.prompt('Copiá este código:',code));
  else window.prompt('Copiá este código:',code);break;}

case 'editRoutine':{if(isOfflineNow(account)){showModal('Sin conexión · Modo borrador','Podés crear o editar tu rutina sin internet. Cada cambio quedará en este dispositivo hasta que puedas sincronizarlo.','beginOfflineRoutine',value,false,'','Crear borrador');break;}let r=state.routines.find(x=>x.id===value);app.editor=r?JSON.parse(JSON.stringify(r)):{id:null,name:'',exercises:[]};app.routine=r?.id||null;saveRoutineEditor(app.activeUid,app.editor);go('routineEdit');break}
case 'beginOfflineRoutine':{app.modal=null;let r=state.routines.find(x=>x.id===value);app.editor=r?JSON.parse(JSON.stringify(r)):{id:null,name:'',exercises:[]};app.routine=r?.id||null;saveRoutineEditor(app.activeUid,app.editor);go('routineEdit');break}
case 'resumeRoutineDraft':{const d=readRoutineEditor(app.activeUid);if(!d){toast('No encontramos el borrador.');break}app.editor=d;app.routine=d.id||null;go('routineEdit');break}
case 'cancelEdit':app.editor=null;clearRoutineEditor(app.activeUid);go('activity');break;
case 'library':if(app.view==='routineEdit')persistEditor();app.exerciseSearch='';go('exerciseLibrary');break;
case 'searchLibrary':app.exerciseSearch=get('libsearch').value.trim();render();break;
case 'addExercise':app.editor.exercises.push({name:value,sets:3,reps:10});saveRoutineEditor(app.activeUid,app.editor);go('routineEdit');toast('Ejercicio añadido');break;
case 'addCustomExercise':{let n=get('customexercise')?.value.trim();if(!n){toast('Ingresá un nombre');break}app.editor.exercises.push({name:n.slice(0,80),sets:3,reps:10});saveRoutineEditor(app.activeUid,app.editor);go('routineEdit');break}
case 'removeExercise':persistEditor();app.editor.exercises.splice(Number(value),1);saveRoutineEditor(app.activeUid,app.editor);render();break;
case 'saveRoutine':{persistEditor();const e=app.editor;if(!e.name?.trim()){toast('Poné un nombre a la rutina');break}if(!e.exercises.length){toast('Añadí al menos un ejercicio');break}if(e.exercises.some(x=>x.sets<1||x.sets>15||x.reps<1||x.reps>100)){toast('Revisá series y repeticiones');break}const r={id:e.id||id(),name:e.name.trim(),exercises:e.exercises};let k=state.routines.findIndex(x=>x.id===r.id);if(k>=0)state.routines[k]=r;else state.routines.push(r);app.routine=r.id;app.editor=null;if(save()){clearRoutineEditor(app.activeUid);go('routine');toast(isOfflineNow(account)?'Borrador guardado · se sincronizará al volver internet':'Rutina guardada');}break}
case 'duplicateRoutine':{let r=state.routines.find(x=>x.id===value);if(!r)break;let c=JSON.parse(JSON.stringify(r));c.id=id();c.name+=' · copia';state.routines.push(c);save();app.routine=c.id;render();toast('Copia creada');break}
case 'deleteRoutine':showModal('¿Eliminar rutina?','La rutina se eliminará de tu cuenta y de los dispositivos sincronizados. Los entrenamientos que ya completaste permanecerán en el historial.','confirmDeleteRoutine',value,true);break;
case 'confirmDeleteRoutine':deletePersonalEntity('routines',value);break;
case 'start':{if(state.draft){showModal('Tenés una sesión en curso','Primero retomá o finalizá tu sesión actual. No se crearán dos sesiones por error.','continue');break}if(isOfflineNow(account)){showModal('Sin conexión · Entrenar en borrador','Registraremos las series y los pesos en este dispositivo. Cuando finalices y vuelva la conexión, se sincronizará el progreso.','beginOfflineSession',value,false,'','Empezar borrador');break;}beginSession(value);break}
case 'beginOfflineSession':app.modal=null;beginSession(value);break;
case 'continue':app.modal=null;go('session');break;
case 'usePreviousSet':{
  const d=state.draft;
  if(!d || !/^\d+-\d+$/.test(value))break;
  const [exerciseIndex,setIndex]=value.split('-').map(Number);
  const item=d.snapshot?.[exerciseIndex];
  if(!item || setIndex>=item.sets || d.sets?.[value]?.done)break;
  const prior=previousExerciseSet(state.records,item.name,setIndex+1);
  if(!prior){toast('Todavía no hay un registro anterior.');break;}
  d.sets[value]={weight:prior.weight,reps:prior.reps,done:false};
  if(save())render();
  break;
}
case 'toggleRest':{
  if(!state.draft)break;
  state.draft.restEnabled=!state.draft.restEnabled;
  if(!state.draft.restEnabled)state.draft.restUntil=null;
  if(save())render();break;
}
case 'restDuration':{
  if(!state.draft || ![60,90,120].includes(Number(value)))break;
  state.draft.restSeconds=Number(value);
  if(restRemaining(state.draft.restUntil)>0)state.draft.restUntil=Date.now()+Number(value)*1000;
  if(save())render();break;
}
case 'startRest':{
  if(!state.draft)break;
  state.draft.restEnabled=true;
  state.draft.restUntil=Date.now()+(Number(state.draft.restSeconds)||90)*1000;
  if(save())render();break;
}
case 'skipRest':{
  if(!state.draft)break;
  state.draft.restUntil=null;
  if(save())render();break;
}
case 'toggleSet':{
  const d=state.draft;if(!d || !/^\d+-\d+$/.test(value))break;
  const row=document.querySelector(`[data-set="${value}"]`);if(!row)break;
  const weight=Number(row.querySelector('[data-field=weight]').value);
  const reps=Number(row.querySelector('[data-field=reps]').value);
  const previous=d.sets[value];
  if(previous?.done)d.sets[value]={...previous,done:false};
  else{
    if(!Number.isFinite(weight)||weight<0||weight>99999||!Number.isInteger(reps)||reps<1||reps>100){toast('Revisá peso y repeticiones');break;}
    d.sets[value]={weight,reps,done:true};
    if(d.restEnabled && nextPendingSet(d)!==null)d.restUntil=Date.now()+(Number(d.restSeconds)||90)*1000;
  }
  if(save())render();break;
}
case 'finishSession':{let d=state.draft;if(!d)break;let done=Object.values(d.sets).filter(x=>x.done);if(!done.length){toast('Confirmá al menos una serie');break}showModal('¿Finalizar sesión?',`Se guardarán ${done.length} series confirmadas en el historial local. Podés seguir editando antes de finalizar.`,'confirmFinish','',false,'','Finalizar');break}
case 'confirmFinish':{let d=state.draft;if(!d)break;let r=state.routines.find(x=>x.id===d.routineId);let sets=Object.values(d.sets).filter(x=>x.done);let vol=sets.reduce((s,x)=>s+(Number(x.weight)||0)*(Number(x.reps)||0),0);const setDetails=Object.entries(d.sets).filter(([,x])=>x.done).map(([key,entry])=>{
    const [exercisePosition,index]=key.split('-').map(Number);
    const exercise=d.snapshot?.[exercisePosition]||r?.exercises?.[exercisePosition];
    return {exercisePosition,exerciseName:exercise?.name||'Ejercicio',setNumber:index+1,reps:entry.reps,weight:entry.weight,completed:true};
  }).sort((a,b)=>a.exercisePosition-b.exercisePosition||a.setNumber-b.setNumber);
  const rec={id:id(),type:'gym',name:r?.name||'Entrenamiento de fuerza',date:dateISO(),minutes:Math.max(1,Math.round((Date.now()-d.startedAt)/60000)),setsDone:sets.length,volume:Math.round(vol*100)/100,note:'',setDetails};
  state.records.unshift(rec);state.draft=null;app.modal=null;
  if(save()){
    app.completedRecord=rec.id;
    go('sessionSummary');
    toast(isOfflineNow(account)?'Entrenamiento guardado en este dispositivo':'Entrenamiento guardado ✓');
  }else{state.records=state.records.filter(x=>x.id!==rec.id);state.draft=d;render();}
  break;}

case 'other':app.activity=value||'walk';go('otherForm');break;
case 'saveActivity':{let type=app.activity,name=categories.find(x=>x[0]===type)?.[1];const duration=Number(get('amins')?.value),date=get('adate')?.value;const custom=get('aname')?.value.trim();if(['sport','other'].includes(type)){if(!custom){toast('Completá el nombre de la actividad');break}name=custom}if(!duration||duration<1||duration>1440||!validDate(date)){toast('Completá fecha y duración válidas');break}let distance=get('adistance')?.value;if(distance!==undefined&&distance!==''&&(!Number.isFinite(Number(distance))||Number(distance)<0)){toast('Revisá la distancia');break}state.records.unshift({id:id(),type,name:name.slice(0,80),minutes:duration,date,note:get('anote').value.trim(),...(distance?{distance:Number(distance)}:{})});save();go('progress');toast('Actividad guardada localmente ✓');break}
case 'detailRecord':app.record=value;go('record');break;
case 'saveRecord':{let r=state.records.find(x=>x.id===app.record);if(!r)break;let dur=Number(get('rmin').value),dt=get('rdate').value;if(!dur||dur<1||dur>1440||!validDate(dt)){toast('Revisá fecha y duración');break}r.minutes=dur;r.date=dt;r.note=get('rnote').value.trim();if(get('rdist'))r.distance=Math.max(0,Number(get('rdist').value)||0);save();go('progress');toast('Registro actualizado');break}
case 'deleteRecord':showModal('¿Qué querés hacer con este registro?','Podés guardarlo como borrador en este dispositivo o eliminarlo definitivamente de tu historial y de la nube.','confirmDeleteRecord',app.record,true,`<div style="margin:18px 0">${button('Guardar como borrador','saveAsRecordDraft',app.record,'outline full')}<p class="micro" style="margin:8px 0 0">Si elegís borrador, podrás restaurarlo desde Progreso. No contará en tus métricas.</p></div>`,'Eliminar definitivamente');break;
case 'saveAsRecordDraft':deleteRecordConfirmed(value,true);break;
case 'confirmDeleteRecord':deleteRecordConfirmed(value,false);break;
case 'restoreRecordDraft':{const record=findRecordDraft(app.activeUid,value);if(!record)break;
  if(!state.records.some(x=>x.id===record.id))state.records.unshift(record);
  cancelRecordDelete(app.activeUid,value);
  if(save()){removeRecordDraft(app.activeUid,value);go('progress');}break;}
case 'discardRecordDraft':removeRecordDraft(app.activeUid,value);render();break;
case 'editHabit':app.habit=value==='new'?{id:null,name:'',days:[1,2,3,4,5],paused:false}:JSON.parse(JSON.stringify(state.habits.find(x=>x.id===value)));go('habitEdit');break;
case 'saveHabit':{
  const n=get('hname').value.trim();
  const days=[...document.querySelectorAll('[name=hdays]:checked')].map(x=>Number(x.value));
  if(!n||!days.length){toast('Poné nombre y elegí al menos un día');break;}
  const habit={id:app.habit.id||id(),name:n.slice(0,70),days,paused:app.habit.paused||false};
  const previous=JSON.parse(JSON.stringify(state.habits));
  const i=state.habits.findIndex(x=>x.id===habit.id);
  if(i>=0)state.habits[i]=habit;else state.habits.push(habit);
  if(!save()){
    // No prometer guardado si localStorage falló o no pudimos persistirlo.
    state.habits=previous;
    render();
    break;
  }
  go('habits');
  toast(isOfflineNow(account)?'Hábito guardado en este dispositivo':'Hábito guardado');
  if(!isOfflineNow(account)){
    // Un hábito de una cuenta recién creada no debe quedar esperando que
    // una sincronización anterior termine para recién entonces programarse.
    const uid=app.activeUid;
    queueMicrotask(()=>{if(account.user?.id===uid)hydrateCloud(uid,{silent:true});});
  }
  break;
}
case 'pauseHabit':{let x=state.habits.find(x=>x.id===value);x.paused=!x.paused;save();go('habits');toast(x.paused?'Hábito pausado':'Hábito reanudado');break}
case 'deleteHabit':showModal('¿Eliminar hábito?','Se eliminará este hábito y sus cumplimientos de tu cuenta y de los dispositivos sincronizados.','confirmDeleteHabit',value,true);break;
case 'confirmDeleteHabit':deletePersonalEntity('habits',value);break;
case 'toggleHabit':{let x=state.habits.find(x=>x.id===value);if(!x||x.paused||!getDueToday(x))break;const k=`${value}:${dateISO()}`;state.checks[k]=!state.checks[k];save();render();break}
case 'closeModal':app.modal=null;render();break;
case 'checkMigration':{const review=previewLocalMigration(state);const c=review.counts;const summary=review.ready?`Estructura válida: ${c.routines} rutinas, ${c.exercises} ejercicios, ${c.records} actividades, ${c.habits} hábitos y ${c.completions} cumplimientos.`:`Encontramos ${review.errors.length} problemas: ${review.errors.slice(0,3).join(' ')}`;showModal('Verificación local para migración',summary+' '+review.warnings.join(' '),'closeModal','',false,'','Cerrar');break}
case 'export':{let a=document.createElement('a'),blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='perci_prototipo_datos.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Exportación local iniciada');break}
case 'import':showModal('Importar archivo JSON','Se revisará el formato antes de confirmar el reemplazo de datos locales.','checkImport','',false,'<div class="field"><label for="importfile">Archivo .json</label><input type="file" accept="application/json,.json" id="importfile"/></div>','Revisar archivo');break;
case 'checkImport':{let file=get('importfile').files[0];if(!file){toast('Elegí un archivo');break}file.text().then(t=>{try{const data=JSON.parse(t);if(!Array.isArray(data.routines)||!Array.isArray(data.records)||!Array.isArray(data.habits)||!data.checks)throw Error();app.pendingImport=cleanImportedState(data);const cleaned=app.pendingImport;showModal('Datos listos para importar',`Se reemplazarán ${state.records.length} registros por ${cleaned.records.length} registros y ${cleaned.routines.length} rutinas del archivo. Los registros demostrativos serán excluidos si el respaldo los identifica como demo. Guardaremos una copia de respaldo local.`,'confirmImport','',true,'','Reemplazar datos')}catch(e){app.modal=null;render();toast('Formato de archivo no válido')}});break}
case 'confirmImport':{storage.backup(state);state={...seed(),...app.pendingImport,theme:state.theme,onboardSeen:true,demo:false};app.pendingImport=null;app.modal=null;save();go('home');toast('Importación completada localmente');break}
case 'restoreBackup':showModal('¿Revertir última importación?','Se reemplazarán los datos actuales por la copia anterior a la última importación.','confirmRestoreBackup','',true);break;
case 'confirmRestoreBackup':{try{const prev=storage.readBackup();if(!prev||!Array.isArray(prev.records))throw Error();state=prev;storage.clearBackup();app.modal=null;save();go('home');toast('Copia anterior restaurada')}catch(e){app.modal=null;render();toast('No encontramos una copia válida')}break}
case 'clearDemo':showModal('¿Vaciar datos de ejemplo?','Se dejarán rutinas, registros y hábitos en blanco para que pruebes los estados vacíos.','confirmClear','',true,'','Vaciar demo');break;
case 'confirmClear':state={...state,demo:false,routines:[],records:[],habits:[],checks:{},draft:null};app.modal=null;save();go('home');toast('Modo vacío listo');break;
case 'resetDemo':showModal('¿Restaurar datos de demostración?','Se reemplazarán tus datos locales de prueba por ejemplos.','confirmReset','',true,'','Restaurar');break;
case 'confirmReset':{const t=state.theme,f=state.focus;state={...seed(),theme:t,focus:f,onboardSeen:true};app.modal=null;save();go('home');toast('Demo restaurada');break}
}}
document.addEventListener('click',e=>{const syncChoice=e.target.closest('[data-sync-choice]');if(syncChoice){e.preventDefault();chooseCloudConflict(syncChoice.dataset.syncChoice);return;}let el=e.target.closest('[data-action]');if(!el)return;e.preventDefault();handle(el.dataset.action,el.dataset.value||'')});
document.addEventListener('change',e=>{
  if(e.target.id==='progressExercise'){
    app.progressExercise=e.target.value;render();
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter' && e.target.id==='customexercise' && app.editor){e.preventDefault();handle('addCustomExercise','');return;}
  if(e.key==='Escape'&&app.modal){app.modal=null;render()}
});
document.addEventListener('input',e=>{
  if(!account.authenticated||!app.activeUid||(app.hydrating&&!app.silentHydration)||app.cloudConflict)return;
  if(e.target.id==='routineShareCode'&&app.share?.mode==='import'){app.share.code=e.target.value;app.share.preview=null;return;}
  if(app.view==='routineEdit' && (e.target.id==='rname'||e.target.matches('[data-exrow] input'))){persistEditor();return;}
  const row=e.target.closest('[data-set]');
  if(app.view==='session'&&row&&state.draft && (e.target.matches('[data-field=weight]')||e.target.matches('[data-field=reps]'))){
    const previous=state.draft.sets[row.dataset.set]||{};
    state.draft.sets[row.dataset.set]={...previous,weight:e.target.closest('[data-field=weight]')?Number(row.querySelector('[data-field=weight]').value)||0:0,
      reps:Number(row.querySelector('[data-field=reps]').value)||0,done:false};
    save();
  }
});
function refreshRestClock(){
  const element=document.querySelector('[data-rest-clock]');
  if(!element || !state.draft || !state.draft.restEnabled)return;
  const remaining=restRemaining(state.draft.restUntil);
  element.textContent=restClock(state.draft.restUntil);
  const button=document.querySelector('.rest-panel [data-action="skipRest"]');
  if(button && remaining===0){button.dataset.action='startRest';button.textContent='Iniciar descanso';}
}
setInterval(refreshRestClock,1000);
window.addEventListener('pagehide',()=>{if(app.view==='routineEdit'&&app.editor)try{persistEditor()}catch{}});

// Safari puede recuperar una pestaña anterior desde Back/Forward Cache.
// Si aquella pestaña estaba en Ajustes, al reabrir la app volvemos al
// punto de entrada correcto sin borrar ni alterar la rutina guardada.
window.addEventListener('pageshow', event => {
  if (event.persisted && app.view === 'settings') {
    app.modal = null;
    app.view = getInitialView(state);
    render();
  }
  // La PWA puede haber recuperado conexión mientras estaba suspendida.
  if(account.ready)queueMicrotask(()=>refreshConnectionAware(0));
});
// Cuenta personal. Tokens de Supabase nunca se guardan en localStorage.
document.addEventListener('submit',async event=>{
  if(event.target.id!=='account-auth-form')return;
  event.preventDefault();
  const email=get('account-email')?.value||'';
  const password=get('account-password')?.value||'';
  if(event.target.dataset.mode==='register'){
    await signup(get('account-name')?.value||'',email,password,get('account-confirm')?.value||'');
  }else{
    await login(email,password);
  }
});
document.addEventListener('click',async event=>{
  const action=event.target.closest('[data-account-action]')?.dataset.accountAction;
  if(!action)return;
  event.preventDefault();
  if(action==='show-register'){changeAccountMode('register');return;}
  if(action==='show-login'){changeAccountMode('login');return;}
  if(action==='claim-legacy'||action==='skip-legacy'){
    try{decideLegacy(action==='claim-legacy');}catch(error){window.alert(error.message||'No pudimos recuperar tus rutinas.');}
    return;
  }
  if(action==='logout'){hydrationGeneration++;await logout();return;}
  if(action==='refresh-cloud'){if(app.activeUid)hydrateCloud(app.activeUid);return;}
  if(action==='link'||action==='sync'){
    if(action==='link'&&!window.confirm('¿Querés guardar una copia de tus rutinas en tu cuenta? Los datos de ejemplo se excluyen.'))return;
    if(!app.activeUid)return;try{queueSnapshot(app.activeUid,JSON.parse(JSON.stringify(state)));await hydrateCloud(app.activeUid);}catch(error){window.alert(error.message||'No pudimos iniciar la sincronización.');}
  }
  if(action==='recover'){
    if(!window.confirm('¿Recuperar los datos de tu cuenta? Vamos a hacer un respaldo local y unir los registros sin reemplazar los existentes.'))return;
    try{
      const remote=await fetchCloudData();
      if(!remote || !Array.isArray(remote.routines))throw Error('Respuesta inválida');
      storage.backup(state);
      const merge=(local,cloud)=>{const ids=new Set(local.map(x=>x.id));return local.concat(cloud.filter(x=>!ids.has(x.id)));};
      state.routines=merge(state.routines.filter(x=>x.id!=='r1'),remote.routines);
      const realRecords=state.records.filter(x=>!state.demo||!['s1','s2','s3'].includes(x.id));
      const realHabits=state.habits.filter(x=>!state.demo||!['h1','h2'].includes(x.id));
      state.records=merge(realRecords,remote.records);
      state.habits=merge(realHabits,remote.habits);
      state.checks={...(state.demo?{}:state.checks),...remote.checks};
      state.demo=false;state.onboardSeen=true;
      save();go('home');toast('Tus datos se recuperaron y tu copia local anterior quedó respaldada');
    }catch(err){toast(err.message||'No pudimos recuperar tu cuenta');}
  }
});
let wasOffline=false;
let lastOnlineUserId=null;
onSyncRequested(()=>app.activeUid&&!app.hydrating?hydrateCloud(app.activeUid,{silent:true}):undefined);
onAccountChange(()=>{
  const recovered=wasOffline&&!account.offline;
  const onlineUserId=account.authenticated&&!account.offline?account.user?.id:null;
  const onlineSessionStarted=!!onlineUserId && onlineUserId!==lastOnlineUserId;
  wasOffline=account.offline;
  lastOnlineUserId=onlineUserId;
  activateAccountData();
  if(hasAccountConflict())app.view='account';
  render();
  if((recovered||onlineSessionStarted)&&account.authenticated&&!app.needLegacyChoice){
    hydrateCloud(account.user.id);
  }
});
// Mantener las cuentas sincronizadas automáticamente, sin intervención manual.
// 1) Ingreso/login ya inicia hydrateCloud en onAccountChange.
// 2) Al volver a la pestaña, consultar los cambios de otro dispositivo.
// 3) Mientras está abierta, refrescar periódicamente aunque no haya foco nuevo.
// 4) Al navegar a Hábitos, Actividad, Progreso, Inicio o Mi cuenta, refrescar.
// No se interrumpen formularios, modales, sesiones, conflictos ni modo offline.
let lastAutoCloudRefreshAt=0;
let lastAutoCloudRefreshUid=null;
function refreshAccountAutomatically(minAgeMs=6000){
  const uid=app.activeUid;
  if(!canAutoRefreshCloud({
    uid,authenticated:account.authenticated,online:!isOfflineNow(account),
    visible:document.visibilityState!=='hidden',legacyChoice:app.needLegacyChoice,
    hydrating:app.hydrating,conflict:!!app.cloudConflict,modal:!!app.modal,
    draft:!!state.draft,view:app.view
  }))return false;
  const now=Date.now();
  if(lastAutoCloudRefreshUid===uid && now-lastAutoCloudRefreshAt<minAgeMs)return false;
  lastAutoCloudRefreshUid=uid;
  lastAutoCloudRefreshAt=now;
  hydrateCloud(uid,{silent:true});
  return true;
}
// En iOS, navigator.onLine y el evento online no siempre se actualizan
// al mismo tiempo. Si esta sesión quedó marcada offline, comprobar la cookie
// con el servidor al regresar a la PWA o periódicamente mientras está visible.
let lastRecoveryProbeAt=0;
let lastRecoveryProbeUid=null;
function refreshConnectionAware(minAgeMs=6000){
  const uid=app.activeUid;
  if(!uid||!account.authenticated||app.needLegacyChoice||app.cloudConflict||
     document.visibilityState==='hidden')return false;
  if(!account.offline && !isOfflineNow(account))return refreshAccountAutomatically(minAgeMs);
  // No mostrar un conflicto durante la edición, modal o entrenamiento en curso.
  if(app.hydrating||app.modal||state.draft||
     ['routineEdit','habitEdit','session','sessionSummary','record','otherForm'].includes(app.view))return false;
  const now=Date.now();
  if(lastRecoveryProbeUid===uid && now-lastRecoveryProbeAt<10000)return false;
  lastRecoveryProbeUid=uid;lastRecoveryProbeAt=now;
  probeOfflineAccount().then(connected=>{
    if(connected && uid===app.activeUid && !isOfflineNow(account)){
      // onAccountChange recupera las colas offline. Si la marca offline estaba
      // desfasada, el refresco explícito también vuelve a comparar la nube.
      refreshAccountAutomatically(0);
    }
  }).catch(()=>{});
  return true;
}
window.addEventListener('online',()=>refreshConnectionAware(0));
window.addEventListener('focus',()=>refreshConnectionAware());
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='hidden')refreshConnectionAware(0);
});
// Un chequeo offline cada 12s con la app visible, y online cada ~30s.
// No se abre una conexión permanente ni se ejecutan lecturas en background.
setInterval(()=>refreshConnectionAware(30000),12000);
applyTheme();render();
initAccount().catch(()=>{});
})();
