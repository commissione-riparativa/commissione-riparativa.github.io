
function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    const hadController=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js?v=32').then(reg=>{
      const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdateReady()})};
      if(reg.installing)watch(reg.installing);
      reg.addEventListener('updatefound',()=>watch(reg.installing));
      setInterval(()=>reg.update().catch(()=>{}),60*60*1000);
    }).catch(err=>console.warn('Service worker non registrato:',err));
    if(hadController)navigator.serviceWorker.addEventListener('controllerchange',showUpdateReady,{once:true});
  },{once:true});
}
function showUpdateReady(){const b=$('update-banner');if(b)b.hidden=false}
registerServiceWorker();

const API='https://script.google.com/macros/s/AKfycbxxh2IxU5RsMRaH2jJSLz-zjQ7HQOHy6bClaDVQ9wSSlM2bWFsoKW--2ECeWyqQAf9D/exec';
const API_TIMEOUT_MS=12000;
const DEFAULT_MEMBERS=['Filippo Colluto','Anna Ferrari','Marco Bianchi','Sara Conti','Luca Esposito','Giulia Ricci','Paolo Marino','Elena Romano','Davide Bruno','Chiara Gallo','Fabio Costa','Marta Fontana','Andrea Russo','Valentina Moro','Stefano Serra','Irene Lombardi'];
const DAYS=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const MONTHS=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const STATUS_LABELS={'Aperta':'Nuova','In gestione':'In corso','Chiusa':'Conclusa'};
const LOADER='<div class="loading-state"><div class="spinner" aria-hidden="true"></div><span>Caricamento…</span></div>';
const DEMO_MODE=new URLSearchParams(location.search).get('demo')==='1';

let members=DEMO_MODE?[...DEFAULT_MEMBERS]:[],memberDirectory=[],membersDraft=[],currentUser=null,currentUserId=null,currentUserEmail='',isCoord=false,authToken='',rememberDevice=true,authFlowBusy=false;
let segnalazioni=[],incontri=[],disponibilita=[],avvisi=[];
let editingId=null,deletingId=null,deletingSegId=null,deletingMembroIdx=null,editingAvvisoId=null,deletingAvvisoId=null,currentSegFilter='all',showPastMeetings=false,openPanels={},openMeetingCardId='',pendingLoginEmail='';
let cbN=0,loadingSeg=false,loadingInc=false,loadingAvvisi=false,incontriLoadedOnce=false,avvisiLoadedOnce=false;
const dialogReturnFocus=new Map();
let pageScrollLocked=false,lockedPageScrollY=0;
let membersLoading=false;
let noticePollTimer=null,currentPage='segnalazioni',markAvvisiAfterLoad=false;
let memberSheetDrag={active:false,dragging:false,startY:0,lastY:0,lastT:0,delta:0,scrollEl:null};
let DEMO_SEGNALAZIONI=[
 {ID:'seg_demo_1',Data:'2026-08-18',Componente:'Componente Studenti',Recapito:'studente@example.it',Stato:'Aperta','Link Risposta':''},
 {ID:'seg_demo_2',Data:'2026-08-14',Componente:'Componente Adulti',Recapito:'adulto@example.it',Stato:'In gestione','Link Risposta':'https://example.com/risposta'},
 {ID:'seg_demo_3',Data:'2026-08-05',Componente:'Componente Entrambi',Recapito:'contatto@example.it',Stato:'Chiusa','Link Risposta':''}
];
let DEMO_INCONTRI=[
 {id:'demo-1',titolo:'venerdì 21 Agosto 2026',dataIso:'2026-08-21',orario:'15:30',luogo:'Aula riunioni',segnalazione:'Segnalazione del 18 agosto 2026 · Componente Studenti · studente@example.it',segnalazioneId:'seg_demo_1'},
 {id:'demo-2',titolo:'martedì 25 Agosto 2026',dataIso:'2026-08-25',orario:'14:15',luogo:'Biblioteca',segnalazione:'Segnalazione del 14 agosto 2026 · Componente Adulti · adulto@example.it',segnalazioneId:'seg_demo_2'}
];
let DEMO_DISP=[{membroId:'demo',membro:'Filippo Colluto',incontro:'demo-1',risposta:'si'},{membroId:'mem_demo_2',membro:'Anna Ferrari',incontro:'demo-1',risposta:'si'},{membroId:'mem_demo_3',membro:'Marco Bianchi',incontro:'demo-1',risposta:'no'}];
let DEMO_AVVISI=[
 {id:'av_demo_1',titolo:'Riunione della commissione',testo:'Ricordiamo di portare le disponibilità aggiornate per la prossima settimana.',autoreId:'demo',autore:'Filippo Colluto',creato:'2026-08-22T08:30:00.000Z',aggiornato:'2026-08-22T08:30:00.000Z',puoiGestire:true},
 {id:'av_demo_2',titolo:'Cambio aula',testo:'L’incontro di venerdì si terrà in Biblioteca invece che in Aula riunioni.',autoreId:'mem_demo_2',autore:'Anna Ferrari',creato:'2026-08-21T13:10:00.000Z',aggiornato:'2026-08-21T13:10:00.000Z',puoiGestire:true}
];


function $(id){return document.getElementById(id)}
function loadMembers(){return [...members]}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeAttr(v){return escapeHtml(v)}
function icon(name,cls='icon'){return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`}
function emptyState(iconName,title,sub){return `<div class="empty-state"><div class="empty-icon">${icon(iconName,'icon icon-lg')}</div><div class="empty-title">${escapeHtml(title)}</div><div class="empty-sub">${escapeHtml(sub)}</div></div>`}
function showToast(message,type='success'){const t=$('toast');clearTimeout(showToast.timer);t.textContent=message;t.className=`toast ${type} visible`;showToast.timer=setTimeout(()=>t.classList.remove('visible'),2600)}
function apiError(message='Operazione non riuscita. Riprova.'){showToast(message,'error')}
function apiSucceeded(resp){return resp!==null&&resp!==false&&!(resp&&typeof resp==='object'&&resp.ok===false)}
function safeExternalUrl(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.href:null}catch{return null}}
function statusLabel(v){return STATUS_LABELS[v]||STATUS_LABELS.Aperta}
function statusClass(v){return v==='Chiusa'?'badge-chiusa':v==='In gestione'?'badge-gestione':'badge-aperta'}
function componentDisplay(v){return String(v||'').trim().replace(/^Componente\s+/i,'')||'—'}
function componentClass(v){const s=String(v||'').toLowerCase();if(s.includes('entramb'))return'badge-entrambi';if(s.includes('adult'))return'badge-adulti';if(s.includes('student'))return'badge-studenti';return'badge-neutral'}
function updatedLabel(){return 'Aggiornato alle '+new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date())}
function stampUpdate(id){const el=$(id);if(el)el.textContent=updatedLabel()}
function avatarColors(n){let h=0;for(const ch of n)h=(h*31+ch.charCodeAt(0))%360;return{bg:`hsl(${h},48%,90%)`,fg:`hsl(${h},42%,30%)`}}

function apiRequest(action,params={},cb=()=>{}){
  if(DEMO_MODE){return demoRequest(action,params,cb)}
  const publicActions=new Set(['health','richiedi_codice','verifica_codice','logout']);
  const payload={action,...params};
  if(authToken&&!publicActions.has(action))payload.sessione=authToken;
  if(action==='logout'&&authToken)payload.sessione=authToken;

  const query=new URLSearchParams(payload);
  const name='_grcb'+(cbN++),script=document.createElement('script');let done=false;
  const finish=value=>{
    if(done)return;done=true;clearTimeout(timer);
    try{delete window[name]}catch{window[name]=undefined}
    script.remove();
    if(value&&value.ok===false&&['sessione_non_valida','sessione_revocata','sessione_scaduta','utente_non_attivo'].includes(value.error)){
      handleAuthFailure(value);
    }
    cb(value);
  };
  window[name]=data=>finish(data);
  query.set('callback',name);query.set('t',Date.now());
  script.src=API+'?'+query.toString();script.async=true;script.referrerPolicy='no-referrer';script.onerror=()=>finish(null);
  const timer=setTimeout(()=>finish(null),API_TIMEOUT_MS);document.body.appendChild(script);
}
function demoRequest(action,params,cb){let resp={ok:true,demo:true};try{
  if(action==='segnalazioni')resp=DEMO_SEGNALAZIONI.map(r=>({...r}));
  else if(action==='incontri')resp=DEMO_INCONTRI.map(r=>({...r}));
  else if(action==='disponibilita')resp=DEMO_DISP.map(r=>({...r}));
  else if(action==='stato'){const r=DEMO_SEGNALAZIONI.find(x=>x.ID===params.id);if(!r)resp={ok:false,message:'Segnalazione non trovata.'};else r.Stato=params.stato}
  else if(action==='elimina_segnalazione'){const linked=DEMO_INCONTRI.some(x=>x.segnalazioneId===params.id);if(linked)resp={ok:false,error:'segnalazione_con_incontro',message:'Questa segnalazione ha già un incontro collegato.'};else DEMO_SEGNALAZIONI=DEMO_SEGNALAZIONI.filter(x=>x.ID!==params.id)}
  else if(action==='salva'){const i=DEMO_DISP.findIndex(x=>x.membro===params.membro&&x.incontro===params.incontro);if(i>=0)DEMO_DISP[i].risposta=params.risposta;else DEMO_DISP.push({membro:params.membro,incontro:params.incontro,risposta:params.risposta})}
  else if(action==='nuovo_incontro'){DEMO_INCONTRI.push({id:'demo-'+Date.now(),dataIso:params.data,titolo:meetingTitle(params.data),orario:params.orario,luogo:params.luogo||'',segnalazioneId:params.segnalazione_id||'',segnalazione:summaryForSeg(params.segnalazione_id)})}
  else if(action==='modifica_incontro'){const r=DEMO_INCONTRI.find(x=>x.id===params.id);if(r)Object.assign(r,{dataIso:params.data,titolo:meetingTitle(params.data),orario:params.orario,luogo:params.luogo||'',segnalazioneId:params.segnalazione_id||'',segnalazione:summaryForSeg(params.segnalazione_id)})}
  else if(action==='elimina_incontro'){DEMO_INCONTRI=DEMO_INCONTRI.filter(x=>x.id!==params.id)}
  else if(action==='avvisi')resp=DEMO_AVVISI.map(x=>({...x}));
  else if(action==='nuovo_avviso'){const now=new Date().toISOString(),id='av_demo_'+Date.now();DEMO_AVVISI.unshift({id,titolo:params.titolo||'',testo:params.testo||'',autoreId:currentUserId||'demo',autore:currentUser||'Membro',creato:now,aggiornato:now,puoiGestire:true});resp={ok:true,id}}
  else if(action==='modifica_avviso'){const a=DEMO_AVVISI.find(x=>x.id===params.id);if(!a)resp={ok:false,message:'Avviso non trovato.'};else{a.titolo=params.titolo||a.titolo;a.testo=params.testo||a.testo;a.aggiornato=new Date().toISOString();resp={ok:true}}}
  else if(action==='elimina_avviso'){DEMO_AVVISI=DEMO_AVVISI.filter(x=>x.id!==params.id);resp={ok:true}}
  else if(action==='segna_avvisi_letti'){resp={ok:true}}
}catch{resp={ok:false,message:'Errore modalità demo.'}}setTimeout(()=>cb(resp),70)}
function summaryForSeg(id){const r=DEMO_SEGNALAZIONI.find(x=>x.ID===id);return r?`Segnalazione del ${dateLong(r.Data)} · ${r.Componente} · ${r.Recapito}`:''}

function parseDate(value){const s=String(value||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return validDate(+m[1],+m[2],+m[3]);m=s.match(/(?:^|\D)(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/);if(m)return validDate(+m[3],+m[2],+m[1]);const en={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};m=s.match(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})\b/i);if(m)return validDate(+m[3],en[m[1].toLowerCase()],+m[2]);const p=s.split(/\s+/);if(p.length>=3){for(let i=0;i<p.length-2;i++){const day=Number(p[i]),mi=MONTHS.findIndex(x=>x.toLowerCase()===String(p[i+1]).toLowerCase()),year=Number(p[i+2]);if(day&&mi>=0&&year>=2000)return validDate(year,mi+1,day)}}return null}
function validDate(y,m,d){const x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?x:null}
function isoDate(d){return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''}
function dateLong(v){const d=parseDate(v);return d?`${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`:'Data da verificare'}
function dateBadge(v){const d=parseDate(v);return d?`${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()].slice(0,3).toUpperCase()} ${d.getFullYear()}`:'Data da verificare'}
function meetingParts(v){const d=parseDate(v);if(!d)return null;return{month:MONTHS[d.getMonth()].slice(0,3).toUpperCase(),day:String(d.getDate()),weekday:DAYS[d.getDay()],year:String(d.getFullYear())}}
function meetingTitle(v){const d=parseDate(v);return d?`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`:''}
function meetingDate(inc){return parseDate(inc?.dataIso)||parseDate(inc?.titolo)}
function meetingTimestamp(inc){const d=meetingDate(inc);if(!d)return Number.MAX_SAFE_INTEGER;const [h,m]=String(inc.orario||'00:00').split(':').map(Number);d.setHours(h||0,m||0,0,0);return d.getTime()}
function isPast(inc){const d=meetingDate(inc);if(!d)return false;const t=new Date();t.setHours(0,0,0,0);return d<t}
function isToday(inc){const d=meetingDate(inc);if(!d)return false;const t=new Date();t.setHours(0,0,0,0);return d.getTime()===t.getTime()}
function parseMeetingSummary(v){const p=String(v||'').split(' · ');return{date:(p[0]||'').replace(/^Segnalazione\s+(del\s+)?/i,''),component:p[1]||'',contact:p.slice(2).join(' · ')||''}}
function segTimestamp(v){const d=parseDate(v);return d?d.getTime():0}
function normalizeCompare(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function normalizeComponentKey(v){
  let s=normalizeCompare(v).replace(/^componente\s+/,'');
  if(s==='entrambe'||s==='entrambi')s='entrambe';
  return s;
}
function legacyMeetingMatchesSeg(inc,seg){
  const parsed=parseMeetingSummary(inc.segnalazione||'');
  if(!parsed.date||!parsed.component)return false;

  const sameDate=normalizeCompare(dateLong(parsed.date))===normalizeCompare(dateLong(seg.Data));
  const sameComponent=normalizeComponentKey(parsed.component)===normalizeComponentKey(seg.Componente);
  if(!sameDate||!sameComponent)return false;

  const meetingContact=normalizeCompare(parsed.contact);
  const segContact=normalizeCompare(seg.Recapito);

  // Se entrambi hanno un recapito, deve coincidere.
  if(meetingContact&&segContact)return meetingContact===segContact;

  // Per vecchi incontri senza recapito, usiamo data+componente solo se
  // individuano una sola segnalazione: così evitiamo associazioni ambigue.
  const candidates=segnalazioni.filter(r=>
    normalizeCompare(dateLong(r.Data))===normalizeCompare(dateLong(seg.Data))
    && normalizeComponentKey(r.Componente)===normalizeComponentKey(seg.Componente)
  );
  return candidates.length===1;
}
function linkedMeetingsForSeg(seg){
  if(!seg)return [];
  const id=String(seg.ID||'').trim();
  const found=[];
  const seen=new Set();

  for(const inc of incontri){
    const incId=String(inc.id||'');
    const linkedId=String(inc.segnalazioneId||'').trim();

    // Associazione primaria e affidabile: ID della segnalazione.
    const match=(id&&linkedId===id)||(!linkedId&&legacyMeetingMatchesSeg(inc,seg));

    if(match&&!seen.has(incId)){
      seen.add(incId);
      found.push(inc);
    }
  }
  return found.sort((a,b)=>meetingTimestamp(a)-meetingTimestamp(b));
}
function linkedMeetingForSeg(seg){return linkedMeetingsForSeg(seg)[0]||null}
function deleteSegAction(r){
  if(!isCoord||!r?.ID)return '';
  return `<button class="seg-delete-action" type="button" data-action="delete-seg" data-seg-id="${escapeAttr(r.ID)}">${icon('trash','icon icon-sm')}<span>Elimina</span></button>`;
}
function deleteSegIconAction(r){
  if(!isCoord||!r?.ID)return '';
  return `<button class="seg-trash-corner" type="button" data-action="delete-seg" data-seg-id="${escapeAttr(r.ID)}" aria-label="Elimina segnalazione" title="Elimina segnalazione">${icon('trash','icon icon-sm')}</button>`;
}
function quickMeetingAction(r){
  if(!r?.ID)return '';
  const closed=(r.Stato||'Aperta')==='Chiusa';
  const linked=incontriLoadedOnce?linkedMeetingsForSeg(r):[];
  const count=linked.length;
  const target=linked.find(i=>!isPast(i))||linked.at(-1)||null;
  const linkedAction=count&&target
    ?`<button class="seg-meeting-state seg-linked-meeting" type="button" data-action="open-linked-meeting" data-meeting-id="${escapeAttr(target.id)}" title="Apri l’incontro collegato a questa segnalazione">${icon('calendar','icon icon-sm')}<span>${count} ${count===1?'incontro collegato':'incontri collegati'}</span>${icon('chevron-right','icon icon-sm seg-link-chevron')}</button>`
    :'';

  if(!isCoord||closed)return linkedAction;

  const createAction=`<button class="seg-quick-meeting${count?' secondary':''}" type="button" data-action="quick-meeting" data-seg-id="${escapeAttr(r.ID)}">${icon(count?'plus':'calendar','icon icon-sm')}<span>${count?'Nuovo incontro':'Crea incontro'}</span></button>`;
  return linkedAction+createAction;
}
function openLinkedMeeting(meetingId){
  const inc=incontri.find(i=>String(i.id)===String(meetingId||''));
  if(!inc){apiError('Incontro collegato non trovato.');return}
  if(isPast(inc))showPastMeetings=true;
  showPage('incontri');
  openMeetingCardId=String(inc.id);
  renderIncontri();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const card=[...document.querySelectorAll('.inc-card[data-meeting-id]')].find(x=>String(x.dataset.meetingId)===String(inc.id));
    if(!card)return;
    setMeetingCardOpen(String(inc.id),true);
    card.scrollIntoView({behavior:'smooth',block:'center'});
    card.classList.add('linked-arrival');
    setTimeout(()=>card.classList.remove('linked-arrival'),1100);
  }));
}
function openQuickMeeting(segId){
  const seg=segnalazioni.find(r=>String(r.ID||'')===String(segId||''));
  if(!seg){apiError('Segnalazione non trovata.');return}
  const proceed=()=>{
    renderSegnalazioni();
    openMeetingModal(null,seg.ID);
  };
  if(incontriLoadedOnce){proceed();return}
  apiRequest('incontri',{},data=>{
    if(!Array.isArray(data)){apiError('Non riesco a caricare gli incontri. Riprova.');return}
    incontri=data;
    incontriLoadedOnce=true;
    proceed();
  });
}

function buildLogin(){showLoginEmailStep('')}

function safeStorageGet(storage,key){
  try{return storage.getItem(key)||''}catch{return ''}
}
function safeStorageSet(storage,key,value){
  try{storage.setItem(key,value);return true}catch{return false}
}
function safeStorageRemove(storage,key){
  try{storage.removeItem(key)}catch{}
}
function getStoredSessionToken(){
  return safeStorageGet(localStorage,'gr_auth_session')||safeStorageGet(sessionStorage,'gr_auth_session')||'';
}
function saveStoredSessionToken(token,remember){
  clearStoredSessionToken();
  if(remember){
    if(safeStorageSet(localStorage,'gr_auth_session',token))return true;
    safeStorageSet(sessionStorage,'gr_auth_session',token);
    return false;
  }
  safeStorageSet(sessionStorage,'gr_auth_session',token);
  return true;
}
function clearStoredSessionToken(){
  safeStorageRemove(localStorage,'gr_auth_session');
  safeStorageRemove(sessionStorage,'gr_auth_session');
}
function setLoginError(id,message=''){
  const el=$(id);if(!el)return;el.textContent=message;el.style.display=message?'block':'none';
}
function setLoginBusy(buttonId,busy,busyText,normalText){
  const b=$(buttonId);if(!b)return;b.disabled=busy;b.textContent=busy?busyText:normalText;
}
function showLoginRestoreStep(message='Accesso in corso…'){
  $('login-screen').classList.add('visible');
  $('main-screen').style.display='none';
  $('login-restore-step').hidden=false;
  $('login-email-step').hidden=true;
  $('login-code-step').hidden=true;
  $('login-restore-text').textContent=message;
}
function showLoginEmailStep(message=''){
  authFlowBusy=false;
  $('login-screen').classList.add('visible');
  $('main-screen').style.display='none';
  $('login-restore-step').hidden=true;
  $('login-email-step').hidden=false;
  $('login-code-step').hidden=true;
  setLoginError('login-email-error',message);
  setLoginError('login-code-error','');
  $('login-code').value='';
  setTimeout(()=>$('login-email')?.focus(),20);
}
function showLoginCodeStep(email){
  authFlowBusy=false;
  pendingLoginEmail=email;
  $('login-restore-step').hidden=true;
  $('login-email-step').hidden=true;
  $('login-code-step').hidden=false;
  $('code-email-label').textContent=email;
  setLoginError('login-code-error','');
  $('login-code').value='';
  setTimeout(()=>$('login-code')?.focus(),20);
}
function requestCode(){
  if(!navigator.onLine){setLoginError('login-email-error','Serve una connessione a Internet per ricevere il codice.');return}
  const email=$('login-email').value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    setLoginError('login-email-error','Inserisci la tua email scolastica.');
    $('login-email').focus();return;
  }
  rememberDevice=$('remember-device').checked;
  pendingLoginEmail=email;
  setLoginError('login-email-error','');
  setLoginBusy('send-code-btn',true,'Invio…','Invia codice');
  apiRequest('richiedi_codice',{email},resp=>{
    setLoginBusy('send-code-btn',false,'Invio…','Invia codice');
    if(!resp){setLoginError('login-email-error','Impossibile contattare il server. Riprova.');return}
    if(resp.ok===false){setLoginError('login-email-error',resp.message||'Non è stato possibile inviare il codice.');return}
    showLoginCodeStep(email);
  });
}
function resendCode(){
  if(!pendingLoginEmail)return showLoginEmailStep('');
  setLoginError('login-code-error','');
  const b=$('resend-code-btn');b.disabled=true;b.textContent='Invio…';
  apiRequest('richiedi_codice',{email:pendingLoginEmail},resp=>{
    b.disabled=false;b.textContent='Invia un nuovo codice';
    if(!resp){setLoginError('login-code-error','Impossibile contattare il server. Riprova.');return}
    if(resp.ok===false){setLoginError('login-code-error',resp.message||'Non è stato possibile inviare un nuovo codice.');return}
    if(resp.attendiSecondi){setLoginError('login-code-error',`Attendi ${resp.attendiSecondi} secondi prima di richiedere un altro codice.`);return}
    showToast('Nuovo codice inviato','info');
  });
}
function verifyLoginCode(){
  if(authFlowBusy)return;
  const code=$('login-code').value.replace(/\D/g,'').slice(0,6);
  $('login-code').value=code;
  if(!/^\d{6}$/.test(code)){setLoginError('login-code-error','Inserisci le 6 cifre del codice.');$('login-code').focus();return}
  authFlowBusy=true;
  setLoginError('login-code-error','');
  setLoginBusy('verify-code-btn',true,'Verifica…','Accedi');
  apiRequest('verifica_codice',{email:pendingLoginEmail,codice:code},resp=>{
    if(!resp){
      authFlowBusy=false;setLoginBusy('verify-code-btn',false,'Verifica…','Accedi');
      setLoginError('login-code-error','Impossibile contattare il server. Riprova.');return;
    }
    if(resp.ok===false){
      authFlowBusy=false;setLoginBusy('verify-code-btn',false,'Verifica…','Accedi');
      setLoginError('login-code-error',resp.message||'Codice non valido.');return;
    }
    if(!resp.sessione||!resp.utente){
      authFlowBusy=false;setLoginBusy('verify-code-btn',false,'Verifica…','Accedi');
      setLoginError('login-code-error','Risposta del server non valida. Riprova.');return;
    }
    authToken=resp.sessione;
    const persisted=saveStoredSessionToken(authToken,rememberDevice);
    showLoginRestoreStep('Apro l’Area della commissione…');
    establishSession(resp.utente,ok=>{
      authFlowBusy=false;
      setLoginBusy('verify-code-btn',false,'Verifica…','Accedi');
      if(ok&&rememberDevice&&!persisted){
        showToast('Il browser non può mantenere l’accesso dopo la chiusura. Pubblicando il sito su un indirizzo web stabile il problema scompare.','info');
      }
    });
  });
}
function restoreSession(){
  const token=getStoredSessionToken();
  if(!token){showLoginEmailStep('');return}
  authFlowBusy=true;
  authToken=token;
  showLoginRestoreStep('Ti riconosco su questo dispositivo…');
  apiRequest('sessione',{},resp=>{
    if(resp&&resp.ok===true&&resp.utente){
      showLoginRestoreStep('Apro l’Area della commissione…');
      establishSession(resp.utente,()=>{authFlowBusy=false});
      return;
    }
    authFlowBusy=false;
    if(authToken)handleAuthFailure(resp||{message:'La sessione non è più valida. Accedi di nuovo.'});
  });
}
function establishSession(user,done=()=>{}){
  currentUser=user.nome||'';
  currentUserId=user.id||'';
  currentUserEmail=user.email||'';
  isCoord=user.ruolo==='coordinatore';
  loadCommissionMembers(ok=>{
    if(!ok){
      showLoginEmailStep('Impossibile caricare i membri della commissione. Riprova.');
      done(false);return;
    }
    showMain();
    done(true);
  });
}
function loadCommissionMembers(done=()=>{}){
  apiRequest('membri',{},rows=>{
    if(!Array.isArray(rows)){done(false);return}
    memberDirectory=rows.map(x=>({id:String(x.id||'').trim(),nome:String(x.nome||'').trim(),ruolo:String(x.ruolo||'membro')})).filter(x=>x.nome);
    if(currentUser&&!memberDirectory.some(m=>String(m.id)===String(currentUserId))){memberDirectory.unshift({id:currentUserId||'',nome:currentUser,ruolo:isCoord?'coordinatore':'membro'})}
    members=memberDirectory.map(x=>x.nome);
    done(true);
  });
}
function handleAuthFailure(resp){
  const message=resp?.message||'La sessione non è più valida. Accedi di nuovo.';
  authToken='';currentUser=null;currentUserId=null;currentUserEmail='';isCoord=false;members=[];memberDirectory=[];avvisi=[];avvisiLoadedOnce=false;
  clearStoredSessionToken();
  closeMobileMenu();
  showLoginEmailStep(message);
}

function selectLogin(){return}
function login(){requestCode()}
function logout(){
  const token=authToken;
  authToken='';currentUser=null;currentUserId=null;currentUserEmail='';isCoord=false;members=[];memberDirectory=[];avvisi=[];avvisiLoadedOnce=false;openPanels={};
  clearStoredSessionToken();
  $('main-screen').style.display='none';
  closeMobileMenu();
  showLoginEmailStep('');
  if(token){
    const previous=authToken;authToken=token;
    apiRequest('logout',{},()=>{authToken=''});
  }
}
function askLogout(){openDialog('confirm-logout-bg','#logout-confirm')}
function closeLogoutConfirm(){closeDialog('confirm-logout-bg')}
function confirmLogout(){closeLogoutConfirm();logout()}
function showMain(){
  authFlowBusy=false;
  currentPage='segnalazioni';
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-segnalazioni'));
  document.querySelectorAll('.nav-wrap button').forEach(b=>{const active=b.dataset.page==='segnalazioni';b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $('login-screen').classList.remove('visible');
  $('main-screen').style.display='block';
  $('welcome-msg').textContent='Ciao, '+currentUser;
  $('coord-tag').hidden=!isCoord;
  $('btn-proponi').hidden=!isCoord;
  $('btn-impostazioni').hidden=!isCoord;
  $('mobile-btn-impostazioni').hidden=!isCoord;
  $('btn-impostazioni').style.display=isCoord?'':'none';
  $('mobile-btn-impostazioni').style.display=isCoord?'':'none';
  $('demo-note').classList.toggle('visible',DEMO_MODE);
  $('update-now')?.addEventListener('click',()=>location.reload());
  loadSegnalazioni();
  loadIncontri();
  loadAvvisi(true);
  startNoticePolling();
  requestAnimationFrame(()=>updateNavIndicator(currentPage,false));
}

function updateNavIndicator(id,animate=true){const nav=document.querySelector('.nav-wrap'),indicator=$('nav-indicator'),btn=nav?.querySelector(`button[data-page="${id}"]`);if(!nav||!indicator||!btn)return;if(!animate)indicator.classList.add('no-transition');indicator.style.width=btn.offsetWidth+'px';indicator.style.transform=`translateX(${btn.offsetLeft}px)`;if(!animate)requestAnimationFrame(()=>requestAnimationFrame(()=>indicator.classList.remove('no-transition')))}
function animatePageEntry(page,direction){if(!page)return;page.classList.remove('page-enter-forward','page-enter-back');void page.offsetWidth;page.classList.add(direction<0?'page-enter-back':'page-enter-forward');setTimeout(()=>page.classList.remove('page-enter-forward','page-enter-back'),260)}
function showPage(id){if(!['segnalazioni','incontri','bacheca'].includes(id)||id===currentPage)return;const previous=currentPage;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+id));document.querySelectorAll('.nav-wrap button').forEach(b=>{const active=b.dataset.page===id;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});currentPage=id;updateNavIndicator(id,true);if(previous==='incontri'){openMeetingCardId='';openPanels={};if(currentUser&&$('incontri-list'))renderIncontri()}if(id==='bacheca'){if(!avvisiLoadedOnce)loadAvvisi(false,true);else{renderAvvisi();markAvvisiSeen()}}closeMobileMenu()}
function toggleMobileMenu(){return}
function closeMobileMenu(){return}
function setNetworkState(){const offline=!navigator.onLine;$('network-banner').classList.toggle('visible',offline)}

function setSegFilter(filter){currentSegFilter=filter;document.querySelectorAll('#seg-filters .stat').forEach(b=>{const a=b.dataset.filter===filter;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a?'true':'false')});renderSegnalazioni()}
function loadSegnalazioni(){if(loadingSeg)return;loadingSeg=true;$('refresh-segnalazioni').disabled=true;$('table-container').innerHTML=LOADER;$('table-container').setAttribute('aria-busy','true');apiRequest('segnalazioni',{},rows=>{loadingSeg=false;$('refresh-segnalazioni').disabled=false;$('table-container').removeAttribute('aria-busy');if(!Array.isArray(rows)){$('table-container').innerHTML=emptyState('warning','Impossibile caricare le segnalazioni','Controlla la connessione e premi Aggiorna per riprovare.');apiError('Impossibile caricare le segnalazioni.');return}segnalazioni=rows;stampUpdate('seg-updated');renderSegnalazioni();populateSegSelect()})}
function populateSegSelect(){const sel=$('modal-segnalazione');const sorted=[...segnalazioni].sort((a,b)=>segTimestamp(b.Data)-segTimestamp(a.Data));sel.innerHTML='<option value="">— Nessuna segnalazione —</option>'+sorted.map(r=>`<option value="${escapeAttr(r.ID||'')}">${escapeHtml(dateLong(r.Data)+' · '+componentDisplay(r.Componente)+(r.Recapito?' · '+r.Recapito:''))}</option>`).join('')}
function statusMarkup(r,index){const st=r.Stato||'Aperta',stateClass=st==='Chiusa'?'state-select-chiusa':st==='In gestione'?'state-select-gestione':'state-select-aperta';if(!isCoord)return `<span class="badge ${statusClass(st)}">${escapeHtml(statusLabel(st))}</span>`;return `<select class="stato-sel ${stateClass}" data-id="${escapeAttr(r.ID||'')}" data-index="${index}" aria-label="Stato della segnalazione"><option value="Aperta" ${st==='Aperta'?'selected':''}>Nuova</option><option value="In gestione" ${st==='In gestione'?'selected':''}>In corso</option><option value="Chiusa" ${st==='Chiusa'?'selected':''}>Conclusa</option></select>`}
function renderSegnalazioni(){
  const all=[...segnalazioni].sort((a,b)=>segTimestamp(b.Data)-segTimestamp(a.Data));
  const counts={all:all.length,'Aperta':all.filter(r=>(r.Stato||'Aperta')==='Aperta').length,'In gestione':all.filter(r=>r.Stato==='In gestione').length,'Chiusa':all.filter(r=>r.Stato==='Chiusa').length};
  $('stat-total').textContent=counts.all;$('stat-aperte').textContent=counts.Aperta;$('stat-gestione').textContent=counts['In gestione'];$('stat-chiuse').textContent=counts.Chiusa;
  const rows=currentSegFilter==='all'?all:all.filter(r=>(r.Stato||'Aperta')===currentSegFilter);
  if(!all.length){$('table-container').innerHTML=emptyState('report','Nessuna segnalazione','Le nuove segnalazioni appariranno qui.');return}
  if(!rows.length){$('table-container').innerHTML=emptyState('report','Nessuna segnalazione in questa categoria','Scegli un altro filtro per vedere le altre segnalazioni.');return}

  const desktop=`<div class="seg-desktop-list" aria-label="Segnalazioni ricevute">${rows.map(r=>{
    const i=segnalazioni.indexOf(r),st=r.Stato||'Aperta',state=st==='Chiusa'?'state-chiusa':st==='In gestione'?'state-gestione':'state-aperta',parts=meetingParts(r.Data),url=safeExternalUrl(r['Link Risposta']),meetingAction=quickMeetingAction(r),deleteAction=deleteSegAction(r),contact=r.Recapito||'';
    const linkedAction=meetingAction.match(/<button class="seg-meeting-state[\s\S]*?<\/button>/)?.[0]||'';
    const createAction=meetingAction.replace(/<button class="seg-meeting-state[\s\S]*?<\/button>/,'');
    const infoActions=(url?`<a class="seg-response-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">Apri risposta ${icon('external','icon icon-sm')}</a>`:'')+linkedAction;
    const manageActions=createAction+deleteAction;
    const hasActions=!!(infoActions||manageActions);
    return `<article class="seg-desktop-card ${state}${hasActions?'':' no-actions'}">
      <div class="seg-desktop-date-stack">${parts?`<span class="seg-desktop-date-day">${escapeHtml(parts.day)}</span><span class="seg-desktop-date-month">${escapeHtml(parts.month.toLowerCase())}</span><span class="seg-desktop-date-year">${escapeHtml(parts.year)}</span>`:`<span class="seg-desktop-date-fallback">Data</span>`}</div>
      <div class="seg-desktop-main">
        <div class="seg-desktop-mainline"><span class="badge ${componentClass(r.Componente)}">${escapeHtml(componentDisplay(r.Componente))}</span>${contact?`<span class="seg-desktop-contact"><span class="seg-desktop-contact-label">Contatto</span>${escapeHtml(contact)}</span>`:''}</div>
        <div class="seg-desktop-status">${statusMarkup(r,i)}</div>
      </div>
      ${hasActions?`<div class="seg-desktop-actions${isCoord?'':' member-only'}">${infoActions?`<div class="seg-desktop-action-info">${infoActions}</div>`:''}${manageActions?`<div class="seg-desktop-action-buttons">${manageActions}</div>`:''}</div>`:''}
    </article>`;
  }).join('')}</div>`;

  const mobile=`<div class="seg-mobile-list" aria-label="Segnalazioni ricevute">${rows.map(r=>{
    const i=segnalazioni.indexOf(r),st=r.Stato||'Aperta',state=st==='Chiusa'?'state-chiusa':st==='In gestione'?'state-gestione':'state-aperta',parts=meetingParts(r.Data),url=safeExternalUrl(r['Link Risposta']),meetingAction=quickMeetingAction(r),trash=deleteSegIconAction(r),contact=r.Recapito||'';
    const actions=(url?`<a class="seg-response-link seg-response-link-compact" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">Apri risposta ${icon('external','icon icon-sm')}</a>`:'')+meetingAction;
    return `<article class="seg-mobile-card seg-mobile-card-compact ${state}">${trash}<div class="seg-mobile-row"><div class="seg-mobile-date-stack">${parts?`<span class="seg-mobile-date-day">${escapeHtml(parts.day)}</span><span class="seg-mobile-date-month">${escapeHtml(parts.month.toLowerCase())}</span><span class="seg-mobile-date-year">${escapeHtml(parts.year)}</span>`:`<span class="seg-mobile-date-fallback">Data</span>`}</div><div class="seg-mobile-maincompact"><div class="seg-mobile-mainline"><span class="badge ${componentClass(r.Componente)}">${escapeHtml(componentDisplay(r.Componente))}</span></div>${contact?`<div class="seg-mobile-contact">${escapeHtml(contact)}</div>`:''}<div class="seg-mobile-status-wrap">${statusMarkup(r,i)}</div></div></div>${actions?`<div class="seg-mobile-actions-compact${isCoord?'':' member-only'}">${actions}</div>`:''}</article>`;
  }).join('')}</div>`;

  $('table-container').innerHTML=desktop+mobile;
}
function updateStatus(select){const id=select.dataset.id,index=Number(select.dataset.index),next=select.value,row=segnalazioni[index];if(!isCoord||!id||!row)return;const prev=row.Stato||'Aperta';row.Stato=next;select.disabled=true;apiRequest('stato',{id,stato:next},resp=>{select.disabled=false;if(!apiSucceeded(resp)){row.Stato=prev;renderSegnalazioni();apiError(resp?.message||'Stato non aggiornato. Riprova.');return}stampUpdate('seg-updated');renderSegnalazioni();showToast('Segnalazione aggiornata')})}

function askDeleteSeg(id){
  if(!isCoord||!id)return;
  const seg=segnalazioni.find(r=>String(r.ID)===String(id));
  if(!seg)return;
  deletingSegId=id;
  $('confirm-seg-text').textContent=`La segnalazione del ${dateLong(seg.Data)} verrà eliminata definitivamente dal foglio Google Sheets. Vuoi continuare?`;
  openDialog('confirm-seg-bg','#seg-delete-confirm');
}
function closeDeleteSeg(){deletingSegId=null;closeDialog('confirm-seg-bg')}
function confirmDeleteSeg(){
  if(!isCoord||!deletingSegId)return;
  if(!navigator.onLine&&!DEMO_MODE){apiError('Sei offline.');return}
  const id=deletingSegId,btn=$('seg-delete-confirm');
  if(btn){btn.disabled=true;btn.textContent='Eliminazione…'}
  apiRequest('elimina_segnalazione',{id},resp=>{
    if(btn){btn.disabled=false;btn.innerHTML=icon('trash')+'Elimina'}
    if(!apiSucceeded(resp)){
      closeDeleteSeg();
      apiError(resp?.message||'Segnalazione non eliminata. Riprova.');
      return;
    }
    segnalazioni=segnalazioni.filter(r=>String(r.ID)!==String(id));
    closeDeleteSeg();
    stampUpdate('seg-updated');
    renderSegnalazioni();
    populateSegSelect();
    showToast('Segnalazione eliminata');
  });
}


function noticeSeenKey(){return 'gr_avvisi_visti_'+String(currentUserId||currentUserEmail||'utente').replace(/[^a-z0-9_-]/gi,'_')}
function getNoticeLastSeen(){const raw=safeStorageGet(localStorage,noticeSeenKey());const t=Date.parse(raw||'');return Number.isFinite(t)?t:0}
function noticeTime(value){const d=new Date(value||'');if(Number.isNaN(d.getTime()))return '';const today=new Date();const same=today.getFullYear()===d.getFullYear()&&today.getMonth()===d.getMonth()&&today.getDate()===d.getDate();if(same)return 'Oggi · '+new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(d);return new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d).replace(',', ' ·')}
function noticeIsNew(a){if(typeof a?.nuovo==='boolean')return a.nuovo;const t=Date.parse(a?.creato||'');return Number.isFinite(t)&&t>getNoticeLastSeen()&&String(a?.autoreId||'')!==String(currentUserId||'')}
function updateAvvisiUnreadBadge(){const badge=$('avvisi-unread');if(!badge)return;const n=avvisi.filter(noticeIsNew).length;badge.textContent=n>9?'9+':String(n);badge.hidden=n===0}
function markAvvisiSeen(){if(!currentUserId)return;const latest=avvisi.reduce((max,a)=>{const t=Date.parse(a.creato||'');return Number.isFinite(t)&&t>max?t:max},0),seenIso=new Date(latest||Date.now()).toISOString();safeStorageSet(localStorage,noticeSeenKey(),seenIso);avvisi.forEach(a=>{a.nuovo=false});const badge=$('avvisi-unread');if(badge)badge.hidden=true;document.querySelectorAll('.notice-card.new').forEach(card=>card.classList.remove('new'));document.querySelectorAll('.notice-new-badge').forEach(el=>el.remove());if(!DEMO_MODE)apiRequest('segna_avvisi_letti',{fino_a:seenIso},()=>{})}
function loadAvvisi(silent=false,markSeenAfter=false){if(markSeenAfter)markAvvisiAfterLoad=true;if(loadingAvvisi)return;loadingAvvisi=true;const refresh=$('refresh-avvisi');if(refresh)refresh.disabled=true;if(!silent&&$('avvisi-list')){$('avvisi-list').innerHTML=LOADER;$('avvisi-list').setAttribute('aria-busy','true')}apiRequest('avvisi',{},rows=>{loadingAvvisi=false;avvisiLoadedOnce=true;if(refresh)refresh.disabled=false;if($('avvisi-list'))$('avvisi-list').removeAttribute('aria-busy');if(!Array.isArray(rows)){if(!silent&&$('avvisi-list'))$('avvisi-list').innerHTML=emptyState('warning','Impossibile caricare la bacheca','Controlla la connessione e premi Aggiorna per riprovare.');if(!silent)apiError('Impossibile caricare la bacheca.');markAvvisiAfterLoad=false;return}avvisi=rows;stampUpdate('avvisi-updated');renderAvvisi();updateAvvisiUnreadBadge();const shouldMark=markAvvisiAfterLoad||currentPage==='bacheca';markAvvisiAfterLoad=false;if(shouldMark)markAvvisiSeen()})}
function bachecaIsOpen(){return !!$('page-bacheca')?.classList.contains('active')}
function refreshNoticeBadge(){if(!currentUser||!navigator.onLine||document.visibilityState==='hidden')return;loadAvvisi(true,bachecaIsOpen())}
function startNoticePolling(){if(noticePollTimer)clearInterval(noticePollTimer);noticePollTimer=setInterval(refreshNoticeBadge,120000)}
function renderAvvisi(){const root=$('avvisi-list');if(!root)return;if(!avvisi.length){root.innerHTML=emptyState('megaphone','Nessun avviso','La bacheca è vuota. Puoi pubblicare il primo avviso.');return}const sorted=[...avvisi].sort((a,b)=>Date.parse(b.creato||0)-Date.parse(a.creato||0));root.innerHTML=sorted.map(a=>{const fresh=noticeIsNew(a),can=!!a.puoiGestire||String(a.autoreId||'')===String(currentUserId||'');return `<article class="notice-card${fresh?' new':''}" data-notice-id="${escapeAttr(a.id)}"><div class="notice-card-head"><div class="notice-title-wrap"><div class="notice-title-line"><h3>${escapeHtml(a.titolo||'Avviso')}</h3>${fresh?'<span class="notice-new-badge">Nuovo</span>':''}</div><div class="notice-meta"><span>${escapeHtml(a.autore||'Membro')}</span><span aria-hidden="true">·</span><time>${escapeHtml(noticeTime(a.creato))}</time>${a.aggiornato&&a.aggiornato!==a.creato?'<span>· modificato</span>':''}</div></div>${can?`<div class="notice-actions"><button class="notice-icon-btn" type="button" data-action="edit-notice" aria-label="Modifica avviso" title="Modifica">${icon('edit','icon icon-sm')}</button><button class="notice-icon-btn danger" type="button" data-action="delete-notice" aria-label="Elimina avviso" title="Elimina">${icon('trash','icon icon-sm')}</button></div>`:''}</div><div class="notice-text">${escapeHtml(a.testo||'')}</div></article>`}).join('')}
function openNoticeModal(a=null){editingAvvisoId=a?.id||null;$('notice-modal-title').textContent=a?'Modifica avviso':'Nuovo avviso';$('notice-title').value=a?.titolo||'';$('notice-text').value=a?.testo||'';$('notice-save').textContent=a?'Salva modifiche':'Pubblica';$('notice-error').textContent='';$('notice-error').classList.remove('visible');updateNoticeCharCount();openDialog('modal-avviso-bg','#notice-title')}
function closeNoticeModal(){editingAvvisoId=null;setNoticeSaving(false);closeDialog('modal-avviso-bg')}
function updateNoticeCharCount(){const el=$('notice-char-count');if(el)el.textContent=String(($('notice-text')?.value||'').length)}
function setNoticeSaving(v){const b=$('notice-save');if(!b)return;b.disabled=v;b.textContent=v?'Salvataggio…':editingAvvisoId?'Salva modifiche':'Pubblica'}
function showNoticeError(msg){const el=$('notice-error');if(!el)return;el.textContent=msg||'';el.classList.toggle('visible',!!msg)}
function saveNotice(){if(!navigator.onLine&&!DEMO_MODE){showNoticeError('Sei offline. Riprova quando la connessione è disponibile.');return}const titolo=$('notice-title').value.trim(),testo=$('notice-text').value.trim();if(!titolo){showNoticeError('Inserisci un titolo.');$('notice-title').focus();return}if(!testo){showNoticeError('Scrivi il testo dell’avviso.');$('notice-text').focus();return}showNoticeError('');setNoticeSaving(true);const editing=!!editingAvvisoId,params={titolo,testo};if(editing)params.id=editingAvvisoId;apiRequest(editing?'modifica_avviso':'nuovo_avviso',params,resp=>{setNoticeSaving(false);if(!apiSucceeded(resp)){showNoticeError(resp?.message||'Avviso non salvato. Riprova.');return}closeNoticeModal();showToast(editing?'Avviso aggiornato':'Avviso pubblicato');loadAvvisi(true)})}
function askDeleteNotice(id){const a=avvisi.find(x=>String(x.id)===String(id));if(!a||!(a.puoiGestire||String(a.autoreId||'')===String(currentUserId||'')))return;deletingAvvisoId=id;$('confirm-avviso-text').textContent=`L’avviso “${a.titolo||'senza titolo'}” non sarà più visibile nella bacheca. Vuoi continuare?`;openDialog('confirm-avviso-bg','#notice-delete-confirm')}
function closeDeleteNotice(){deletingAvvisoId=null;closeDialog('confirm-avviso-bg')}
function confirmDeleteNotice(){if(!deletingAvvisoId)return;if(!navigator.onLine&&!DEMO_MODE){apiError('Sei offline.');return}const id=deletingAvvisoId,btn=$('notice-delete-confirm');if(btn){btn.disabled=true;btn.textContent='Eliminazione…'}apiRequest('elimina_avviso',{id},resp=>{if(btn){btn.disabled=false;btn.innerHTML=icon('trash')+'Elimina'}if(!apiSucceeded(resp)){closeDeleteNotice();apiError(resp?.message||'Avviso non eliminato.');return}avvisi=avvisi.filter(a=>String(a.id)!==String(id));closeDeleteNotice();renderAvvisi();updateAvvisiUnreadBadge();showToast('Avviso eliminato')})}

function loadIncontri(){if(loadingInc)return;loadingInc=true;$('refresh-incontri').disabled=true;$('incontri-list').innerHTML=LOADER;$('incontri-list').setAttribute('aria-busy','true');let meetingsResult=null,availabilityResult=null,finished=0;const complete=()=>{finished++;if(finished<2)return;if(!Array.isArray(meetingsResult)){finishIncontriLoad();$('incontri-list').innerHTML=emptyState('warning','Impossibile caricare gli incontri','Controlla la connessione e premi Aggiorna per riprovare.');apiError('Impossibile caricare gli incontri.');return}incontri=meetingsResult;disponibilita=Array.isArray(availabilityResult)?availabilityResult:[];finishIncontriLoad();stampUpdate('inc-updated');renderIncontri();if(!Array.isArray(availabilityResult))apiError('Incontri caricati, ma non le disponibilità.')};apiRequest('incontri',{},data=>{meetingsResult=data;complete()});apiRequest('disponibilita',{},data=>{availabilityResult=data;complete()})}
function finishIncontriLoad(){loadingInc=false;incontriLoadedOnce=true;$('refresh-incontri').disabled=false;$('incontri-list').removeAttribute('aria-busy');if(segnalazioni.length)renderSegnalazioni()}
function activeMemberEntries(){if(memberDirectory.length)return memberDirectory;return members.map(n=>({id:n===currentUser?currentUserId||'':'',nome:n,ruolo:n===currentUser&&isCoord?'coordinatore':'membro'}))}
function responseForMember(member,id){const m=typeof member==='string'?{id:member===currentUser?currentUserId||'':'',nome:member}:member||{};const targetId=String(m.id||'').trim(),targetName=normalizeCompare(m.nome||'');return disponibilita.filter(d=>{if(String(d.incontro)!==String(id))return false;const rowId=String(d.membroId||'').trim();if(targetId&&rowId)return rowId===targetId;return !rowId&&targetName&&normalizeCompare(d.membro||'')===targetName}).slice(-1)[0]?.risposta||null}
function getResponse(member,id){return responseForMember(member,id)}
function dispCounts(id){let yes=0,no=0;const entries=activeMemberEntries();for(const m of entries){const r=responseForMember(m,id);if(r==='si')yes++;else if(r==='no')no++}return{yes,no,wait:Math.max(0,entries.length-yes-no),total:entries.length}}
function renderDispGroup(title,list,type){return `<div class="availability-group"><div class="availability-group-title"><span>${escapeHtml(title)}</span><span class="availability-group-count">${list.length}</span></div>${list.map(m=>{const n=m.nome||'Membro',ac=avatarColors(n),ini=n.split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase(),me=m.id?String(m.id)===String(currentUserId):n===currentUser,label=type==='yes'?'Disponibile':type==='no'?'Non disponibile':'In attesa';return `<div class="member-row${me?' me':''}"><div class="member-info"><div class="avatar" style="background:${ac.bg};color:${ac.fg}">${escapeHtml(ini)}</div><div class="member-name-row">${escapeHtml(n)}${me?'<span class="you-badge">Tu</span>':''}</div></div><span class="chip chip-${type}">${escapeHtml(label)}</span></div>`}).join('')}</div>`}
function renderDispPanel(id){const groups={yes:[],no:[],wait:[]};activeMemberEntries().slice().sort((a,b)=>(a.nome||'').localeCompare(b.nome||'','it',{sensitivity:'base'})).forEach(m=>{const r=responseForMember(m,id);groups[r==='si'?'yes':r==='no'?'no':'wait'].push(m)});return renderDispGroup('Disponibili',groups.yes,'yes')+renderDispGroup('Non disponibili',groups.no,'no')+renderDispGroup('In attesa',groups.wait,'wait')}
function renderIncontri(){const future=incontri.filter(i=>!isPast(i)).sort((a,b)=>meetingTimestamp(a)-meetingTimestamp(b)),past=incontri.filter(isPast).sort((a,b)=>meetingTimestamp(b)-meetingTimestamp(a));let html='';if(!future.length&&!past.length){$('incontri-list').innerHTML=emptyState('calendar','Nessun incontro','Gli incontri proposti compariranno qui.');return}if(future.length){html+=`<div class="incontri-list-stack future">${future.map(renderMeetingCard).join('')}</div>`}else{html+=emptyState('calendar','Nessun incontro in programma','Puoi consultare gli incontri conclusi qui sotto.')}if(past.length){html+=`<button class="past-toggle" type="button" data-action="toggle-past"><span>Incontri conclusi · ${past.length}</span><span>${showPastMeetings?'Nascondi':'Mostra'} ${icon(showPastMeetings?'chevron-up':'chevron-down','icon icon-sm')}</span></button>`;if(showPastMeetings)html+=`<div class="incontri-list-stack past">${past.map(renderMeetingCard).join('')}</div>`}$('incontri-list').innerHTML=html;for(const [id,open] of Object.entries(openPanels)){if(open){const wrap=$('disp-wrap-'+id);if(wrap){wrap.classList.add('open');wrap.style.maxHeight='none'}}}if(openMeetingCardId){const shell=document.querySelector(`.inc-card[data-meeting-id="${openMeetingCardId}"] .inc-details-shell`);if(shell){shell.classList.add('open');shell.style.maxHeight='none';}}}
function setMeetingCardOpen(id,open){const card=[...document.querySelectorAll('.inc-card[data-meeting-id]')].find(x=>String(x.dataset.meetingId)===String(id));if(!card)return;const shell=card.querySelector('.inc-details-shell');const btn=card.querySelector('[data-action="toggle-meeting-card"]');const labels=card.querySelectorAll('.inc-toggle-label');const icons=card.querySelectorAll('.inc-toggle-icon');card.classList.toggle('open',open);if(btn)btn.setAttribute('aria-expanded',open?'true':'false');labels.forEach(el=>el.textContent=open?'Nascondi dettagli':'Mostra dettagli');icons.forEach(el=>el.innerHTML=icon(open?'chevron-up':'chevron-down','icon icon-sm'));if(!shell)return;clearTimeout(shell._transitionTimer);if(open){shell.style.maxHeight='0px';shell.classList.add('open');requestAnimationFrame(()=>requestAnimationFrame(()=>{shell.style.maxHeight=shell.scrollHeight+'px'}));shell._transitionTimer=setTimeout(()=>{if(openMeetingCardId===id&&shell.classList.contains('open'))shell.style.maxHeight='none'},360)}else{const h=shell.getBoundingClientRect().height||shell.scrollHeight;shell.style.maxHeight=h+'px';requestAnimationFrame(()=>requestAnimationFrame(()=>{shell.style.maxHeight='0px';shell.classList.remove('open')}))}}
function toggleMeetingCard(id){if(openMeetingCardId&&openMeetingCardId!==id)setMeetingCardOpen(openMeetingCardId,false);const opening=openMeetingCardId!==id;openMeetingCardId=opening?id:'';setMeetingCardOpen(id,opening)}
function renderMeetingCard(inc){
 const dp=meetingParts(inc.dataIso||inc.titolo),past=isPast(inc),today=isToday(inc),cls=past?'passato':today?'oggi':'futuro',my=responseForMember({id:currentUserId,nome:currentUser},inc.id),myText=my==='si'?'Disponibile':my==='no'?'Non disponibile':'Non hai ancora risposto',counts=dispCounts(inc.id),total=counts.total||0,yesPct=total?Math.round(counts.yes/total*100):0,noPct=total?Math.round(counts.no/total*100):0,waitPct=Math.max(0,100-yesPct-noPct),open=!!openPanels[inc.id],seg=inc.segnalazione?parseMeetingSummary(inc.segnalazione):null,component=seg?.component?componentDisplay(seg.component):'Incontro',componentCls=seg?.component?componentClass(seg.component):'badge-neutral',cardOpen=openMeetingCardId===inc.id;
 const summaryBar=`<div class="progress-bar progress-bar-multi compact"><div class="progress-seg yes" style="width:${yesPct}%"></div><div class="progress-seg no" style="width:${noPct}%"></div><div class="progress-seg wait" style="width:${waitPct}%"></div></div>`;
 const quickResponse=!past?`<div class="inc-quick-response"><div class="inc-quick-response-copy"><span class="inc-quick-response-label">La tua disponibilità</span><span class="inc-response-state" id="my-state-${escapeAttr(inc.id)}">${escapeHtml(myText)}</span></div><div class="inc-response-buttons inc-quick-response-buttons"><button class="btn-yes ${my==='si'?'active':''}" id="btn-yes-${escapeAttr(inc.id)}" type="button" data-action="availability" data-response="si">${icon('check')}Ci sono</button><button class="btn-no ${my==='no'?'active':''}" id="btn-no-${escapeAttr(inc.id)}" type="button" data-action="availability" data-response="no">${icon('x')}Non posso</button></div></div>`:'';
 const linked=seg?`<section class="inc-section inc-section-linked"><div class="inc-linked"><div class="inc-linked-icon">${icon('report')}</div><div><span class="inc-linked-label">Segnalazione collegata</span><div class="inc-linked-details"><span class="inc-linked-main">${escapeHtml(dateBadge(seg.date))}</span>${seg.component?`<span class="inc-linked-meta">${escapeHtml(componentDisplay(seg.component))}</span>`:''}</div>${seg.contact?`<div class="inc-linked-compact-note">Contatto: ${escapeHtml(seg.contact)}</div>`:''}</div></div></section>`:'';
 const attendance=`<section class="inc-section inc-section-attendance"><div class="inc-section-surface"><div class="inc-summary-top"><div class="inc-summary-text"><div class="inc-section-kicker">Disponibilità del gruppo</div><p class="progress-label" id="plabel-${escapeAttr(inc.id)}">${counts.yes} disponibili su ${counts.total}</p></div><div class="inc-summary-side">${counts.wait} in attesa</div></div><div class="progress-bar progress-bar-multi"><div class="progress-seg yes" id="fill-${escapeAttr(inc.id)}-yes" style="width:${yesPct}%"></div><div class="progress-seg no" id="fill-${escapeAttr(inc.id)}-no" style="width:${noPct}%"></div><div class="progress-seg wait" id="fill-${escapeAttr(inc.id)}-wait" style="width:${waitPct}%"></div></div><div class="attendance-breakdown" id="breakdown-${escapeAttr(inc.id)}"><span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} non disponibili</span><span class="wait">${counts.wait} in attesa</span></div><button class="btn-small availability-trigger" id="disp-btn-${escapeAttr(inc.id)}" type="button" data-action="toggle-availability" aria-expanded="${open?'true':'false'}"><span class="availability-label">${icon(open?'chevron-up':'chevron-down')}<span>${open?'Nascondi disponibilità':'Vedi disponibilità'}</span></span><span class="availability-count">${counts.yes} sì · ${counts.no} no · ${counts.wait} in attesa</span></button></div></section>`;
 const details=`<div class="disp-panel-wrap${open?' open':''}" id="disp-wrap-${escapeAttr(inc.id)}"><div class="disp-panel">${renderDispPanel(inc.id)}</div></div>`;
 const admin=isCoord?`<div class="inc-admin-actions"><button class="btn-small" type="button" data-action="edit-meeting">${icon('edit')}Modifica</button><button class="btn-danger" type="button" data-action="delete-meeting">${icon('trash')}Elimina</button></div>`:'';
 const metaRow=`<div class="inc-detail-meta"><span class="inc-meta-item">${icon('clock','icon icon-sm')}<strong>${escapeHtml(inc.orario||'Orario da definire')}</strong></span>${inc.luogo?`<span class="inc-meta-separator">·</span><span class="inc-meta-item inc-meta-place">${icon('pin','icon icon-sm')}${escapeHtml(inc.luogo)}</span>`:''}${today?'<span class="tag-oggi">Oggi</span>':''}${past?'<span class="tag-passato">Concluso</span>':''}</div>`;
 const toggleLabel=cardOpen?'Nascondi dettagli':'Mostra dettagli';
 const desktopSummary=`<button class="inc-summary-button" type="button" data-action="toggle-meeting-card" aria-expanded="${cardOpen?'true':'false'}"><div class="inc-summary-date"><div class="inc-date-tile"><span class="inc-date-month">${dp?escapeHtml(dp.month):'---'}</span><span class="inc-date-day">${dp?escapeHtml(dp.day):'?'}</span></div><div class="inc-summary-year">${dp?escapeHtml(dp.year):''}</div></div><div class="inc-summary-main"><div class="inc-summary-head"><div class="inc-summary-title"><span class="badge ${componentCls}">${escapeHtml(component)}</span>${dp?`<div class="inc-summary-weekday">${escapeHtml(dp.weekday)}</div>`:''}</div><div class="inc-summary-toggle"><span class="inc-toggle-label">${toggleLabel}</span><span class="inc-toggle-icon">${icon(cardOpen?'chevron-up':'chevron-down','icon icon-sm')}</span></div></div><div class="inc-summary-counts"><span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} no</span><span class="wait">${counts.wait} in attesa</span></div>${summaryBar}</div></button>`;
 const mobileSummary=`<button class="inc-mobile-summary" type="button" data-action="toggle-meeting-card" aria-expanded="${cardOpen?'true':'false'}"><div class="inc-mobile-datebox">${dp?`<span class="inc-mobile-month">${escapeHtml(dp.month)}</span><span class="inc-mobile-day">${escapeHtml(dp.day)}</span><span class="inc-mobile-year">${escapeHtml(dp.year)}</span>`:`<span class="inc-mobile-fallback">Data</span>`}</div><div class="inc-mobile-main"><div class="inc-mobile-toprow"><span class="badge ${componentCls}">${escapeHtml(component)}</span><div class="inc-mobile-tags">${today?'<span class="tag-oggi">Oggi</span>':''}${past?'<span class="tag-passato">Concluso</span>':''}</div></div>${dp?`<div class="inc-mobile-status">${escapeHtml(dp.weekday)}</div>`:''}<div class="inc-mobile-counts"><span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} no</span><span>${counts.wait} in attesa</span></div>${summaryBar}<div class="inc-mobile-more inc-toggle-label">${toggleLabel}</div></div><span class="inc-mobile-chevron inc-toggle-icon">${icon(cardOpen?'chevron-up':'chevron-down','icon icon-sm')}</span></button>`;
 const detailBlock=`<div class="inc-details-shell${cardOpen?' open':''}" id="details-${escapeAttr(inc.id)}"><div class="inc-details-inner">${metaRow}${linked}${attendance}${details}${admin}</div></div>`;
 if(window.innerWidth<=700){return `<article class="inc-card inc-card-mobile ${cls}${cardOpen?' open':''}" data-meeting-id="${escapeAttr(inc.id)}">${mobileSummary}${quickResponse}${detailBlock}</article>`}
 return `<article class="inc-card inc-card-desktop ${cls}${cardOpen?' open':''}" data-meeting-id="${escapeAttr(inc.id)}">${desktopSummary}${quickResponse}${detailBlock}</article>`;
}
function togglePanel(id){openPanels[id]=!openPanels[id];const wrap=$('disp-wrap-'+id),btn=$('disp-btn-'+id),open=openPanels[id];if(btn){btn.setAttribute('aria-expanded',open?'true':'false');const label=btn.querySelector('.availability-label');if(label)label.innerHTML=icon(open?'chevron-up':'chevron-down')+`<span>${open?'Nascondi disponibilità':'Vedi disponibilità'}</span>`}if(!wrap)return;if(open){wrap.classList.add('open');wrap.style.maxHeight=wrap.scrollHeight+'px';setTimeout(()=>{if(openPanels[id])wrap.style.maxHeight='none'},270)}else{wrap.style.maxHeight=wrap.scrollHeight+'px';requestAnimationFrame(()=>{wrap.style.maxHeight='0px';wrap.classList.remove('open')})}}
function updateMeetingState(id){const counts=dispCounts(id),total=counts.total||0,yesPct=total?Math.round(counts.yes/total*100):0,noPct=total?Math.round(counts.no/total*100):0,waitPct=Math.max(0,100-yesPct-noPct),my=responseForMember({id:currentUserId,nome:currentUser},id),card=[...document.querySelectorAll('.inc-card[data-meeting-id]')].find(x=>String(x.dataset.meetingId)===String(id)),label=$('plabel-'+id),breakdown=$('breakdown-'+id),state=$('my-state-'+id),yes=$('btn-yes-'+id),no=$('btn-no-'+id),btn=$('disp-btn-'+id);if(card){card.querySelectorAll('.progress-bar-multi').forEach(bar=>{const y=bar.querySelector('.progress-seg.yes'),n=bar.querySelector('.progress-seg.no'),w=bar.querySelector('.progress-seg.wait');if(y)y.style.width=yesPct+'%';if(n)n.style.width=noPct+'%';if(w)w.style.width=waitPct+'%'});card.querySelectorAll('.inc-summary-counts,.inc-mobile-counts').forEach(el=>el.innerHTML=`<span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} no</span><span class="wait">${counts.wait} in attesa</span>`)}if(label)label.textContent=`${counts.yes} disponibili su ${counts.total}`;if(breakdown)breakdown.innerHTML=`<span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} non disponibili</span><span class="wait">${counts.wait} in attesa</span>`;if(state)state.textContent=my==='si'?'Hai indicato: disponibile':my==='no'?'Hai indicato: non disponibile':'Non hai ancora risposto';if(yes)yes.classList.toggle('active',my==='si');if(no)no.classList.toggle('active',my==='no');if(btn){const c=btn.querySelector('.availability-count');if(c)c.textContent=`${counts.yes} sì · ${counts.no} no · ${counts.wait} in attesa`}const wrap=$('disp-wrap-'+id);if(wrap){const panel=wrap.querySelector('.disp-panel');if(panel)panel.innerHTML=renderDispPanel(id)}}
function saveAvailability(id,response){if(!navigator.onLine&&!DEMO_MODE){apiError('Sei offline. Riprova quando la connessione è disponibile.');return}const same=x=>String(x.d.incontro)===String(id)&&((currentUserId&&String(x.d.membroId||'')===String(currentUserId))||(!x.d.membroId&&normalizeCompare(x.d.membro||'')===normalizeCompare(currentUser))),matches=disponibilita.map((d,i)=>({d,i})).filter(same),idx=matches.length?matches.at(-1).i:-1,old=idx>=0?{...disponibilita[idx]}:null;if(idx>=0){disponibilita[idx].risposta=response;disponibilita[idx].membroId=currentUserId||disponibilita[idx].membroId;disponibilita[idx].membro=currentUser}else disponibilita.push({membroId:currentUserId,membro:currentUser,incontro:id,risposta:response});updateMeetingState(id);setAvailabilitySaving(id,response,true);apiRequest('salva',{incontro:id,risposta:response},resp=>{setAvailabilitySaving(id,response,false);if(!apiSucceeded(resp)){const now=disponibilita.map((d,i)=>({d,i})).filter(same).at(-1)?.i;if(old&&now!==undefined)disponibilita[now]=old;else if(!old&&now!==undefined)disponibilita.splice(now,1);updateMeetingState(id);apiError(resp?.message||'Disponibilità non salvata.');return}stampUpdate('inc-updated');showToast(response==='si'?'Disponibilità salvata: ci sei':'Disponibilità salvata: non puoi')})}
function setAvailabilitySaving(id,response,saving){for(const type of ['yes','no']){const b=$(type==='yes'?'btn-yes-'+id:'btn-no-'+id);if(!b)continue;b.disabled=saving;const activeResponse=type==='yes'?'si':'no';b.innerHTML=saving&&response===activeResponse?'Salvataggio…':icon(type==='yes'?'check':'x')+(type==='yes'?'Ci sono':'Non posso')}}

function syncPageScrollLock(){
  const shouldLock=!!document.querySelector('.modal-bg.open,.confirm-bg.open');
  if(shouldLock&&!pageScrollLocked){
    pageScrollLocked=true;
    lockedPageScrollY=window.scrollY||document.documentElement.scrollTop||0;
    document.body.classList.add('dialog-scroll-locked');
    document.body.style.top=`-${lockedPageScrollY}px`;
  }else if(!shouldLock&&pageScrollLocked){
    const y=lockedPageScrollY;
    pageScrollLocked=false;
    document.body.classList.remove('dialog-scroll-locked');
    document.body.style.top='';
    window.scrollTo(0,y);
  }
}
function openDialog(id,focusSelector){
  dialogReturnFocus.set(id,document.activeElement);
  const bg=$(id);
  bg.classList.add('open');
  syncPageScrollLock();
  setTimeout(()=>bg.querySelector(focusSelector)?.focus(),20);
}
function closeDialog(id){
  const bg=$(id);
  bg.classList.remove('open');
  if(id==='modal-impostazioni')resetMembersSheetPosition();
  syncPageScrollLock();
  const prev=dialogReturnFocus.get(id);
  dialogReturnFocus.delete(id);
  if(prev&&document.contains(prev))prev.focus();
}
function openMeetingModal(inc=null,preselectedSegId=''){editingId=inc?.id||null;$('modal-title').textContent=inc?'Modifica incontro':'Nuovo incontro';$('modal-data').value=inc?isoDate(meetingDate(inc)):'';$('modal-orario').value=inc?.orario||'';$('modal-luogo').value=inc?.luogo||'';$('modal-segnalazione').value=inc?.segnalazioneId||preselectedSegId||'';$('modal-error').classList.remove('visible');$('modal-error').textContent='';openDialog('modal-bg','#modal-data')}
function closeMeetingModal(){setMeetingSaving(false);closeDialog('modal-bg')}
function setMeetingSaving(v){const b=$('btn-salva-incontro');b.disabled=v;b.textContent=v?'Salvataggio…':'Salva'}
function saveMeeting(){if(!navigator.onLine&&!DEMO_MODE){showModalError('Sei offline. Riprova quando la connessione è disponibile.');return}const data=$('modal-data').value,time=$('modal-orario').value,place=$('modal-luogo').value.trim(),segId=$('modal-segnalazione').value;if(!parseDate(data)){showModalError('Inserisci una data valida.');$('modal-data').focus();return}if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){showModalError('Inserisci un orario valido.');$('modal-orario').focus();return}const [h,m]=time.split(':').map(Number);if(m%15||h*60+m<420||h*60+m>1185){showModalError('Scegli un orario tra le 07:00 e le 19:45, a intervalli di 15 minuti.');$('modal-orario').focus();return}showModalError('');setMeetingSaving(true);const editing=!!editingId,params={data,orario:time,luogo:place,segnalazione_id:segId};if(editing)params.id=editingId;apiRequest(editing?'modifica_incontro':'nuovo_incontro',params,resp=>{setMeetingSaving(false);if(!apiSucceeded(resp)){showModalError(resp?.message||'Incontro non salvato. Riprova.');return}closeMeetingModal();showToast(editing?'Modifica salvata':'Incontro salvato');loadIncontri()})}
function showModalError(msg){const el=$('modal-error');el.textContent=msg||'';el.classList.toggle('visible',!!msg)}
function askDeleteMeeting(id){if(!isCoord)return;deletingId=id;openDialog('confirm-bg','#delete-confirm')}
function confirmDeleteMeeting(){if(!isCoord||!deletingId)return;if(!navigator.onLine&&!DEMO_MODE){apiError('Sei offline.');return}const id=deletingId,old=[...incontri];incontri=incontri.filter(i=>String(i.id)!==String(id));delete openPanels[id];closeDeleteMeeting();renderIncontri();apiRequest('elimina_incontro',{id},resp=>{if(!apiSucceeded(resp)){incontri=old;renderIncontri();apiError(resp?.message||'Incontro non eliminato.');return}stampUpdate('inc-updated');showToast('Incontro eliminato')})}
function closeDeleteMeeting(){deletingId=null;closeDialog('confirm-bg')}


function resetMembersSheetPosition(){
  const sheet=document.querySelector('#modal-impostazioni .members-modal');
  const bg=$('modal-impostazioni');
  if(sheet){
    sheet.style.transition='';
    sheet.style.transform='';
  }
  if(bg)bg.style.removeProperty('--sheet-drag');
  memberSheetDrag={active:false,dragging:false,startY:0,lastY:0,lastT:0,delta:0,scrollEl:null};
}
function finishMembersSheetDrag(){
  const sheet=document.querySelector('#modal-impostazioni .members-modal');
  const bg=$('modal-impostazioni');
  if(!sheet)return;

  const delta=Math.max(0,memberSheetDrag.delta||0);
  const recentDy=(memberSheetDrag.lastY||0)-(memberSheetDrag.prevY||memberSheetDrag.lastY||0);
  const shouldClose=delta>120||(delta>72&&recentDy>8);

  sheet.style.transition='transform .2s cubic-bezier(.22,.8,.3,1)';
  if(shouldClose){
    sheet.style.transform='translateY(105%)';
    if(bg)bg.style.setProperty('--sheet-drag','1');
    setTimeout(()=>closeMembers(),190);
  }else{
    sheet.style.transform='translateY(0)';
    if(bg)bg.style.setProperty('--sheet-drag','0');
    setTimeout(()=>resetMembersSheetPosition(),210);
  }
  memberSheetDrag.active=false;
  memberSheetDrag.dragging=false;
}
function setupMembersSheetGesture(){
  const sheet=document.querySelector('#modal-impostazioni .members-modal');
  if(!sheet)return;

  sheet.addEventListener('touchstart',e=>{
    if(window.innerWidth>700||e.touches.length!==1)return;
    if(e.target.closest('input,select,textarea,button,a'))return;

    const scrollEl=e.target.closest('.members-editor');
    if(scrollEl&&scrollEl.scrollTop>0)return;

    const y=e.touches[0].clientY;
    memberSheetDrag={
      active:true,dragging:false,startY:y,lastY:y,prevY:y,lastT:performance.now(),delta:0,scrollEl:scrollEl||null
    };
    sheet.style.transition='none';
  },{passive:true});

  sheet.addEventListener('touchmove',e=>{
    if(!memberSheetDrag.active||e.touches.length!==1)return;
    if(memberSheetDrag.scrollEl&&memberSheetDrag.scrollEl.scrollTop>0)return;

    const y=e.touches[0].clientY;
    const delta=y-memberSheetDrag.startY;
    memberSheetDrag.prevY=memberSheetDrag.lastY;
    memberSheetDrag.lastY=y;
    memberSheetDrag.lastT=performance.now();

    if(delta<=0){
      memberSheetDrag.delta=0;
      if(memberSheetDrag.dragging)sheet.style.transform='translateY(0)';
      const bg=$('modal-impostazioni');
      if(bg)bg.style.setProperty('--sheet-drag','0');
      return;
    }

    memberSheetDrag.dragging=true;
    memberSheetDrag.delta=delta;
    e.preventDefault();

    const eased=Math.min(delta*.9,window.innerHeight*.62);
    sheet.style.transform=`translateY(${eased}px)`;
    const bg=$('modal-impostazioni');
    if(bg)bg.style.setProperty('--sheet-drag',String(Math.min(1,eased/300)));
  },{passive:false});

  sheet.addEventListener('touchend',()=>{
    if(!memberSheetDrag.active)return;
    if(memberSheetDrag.dragging)finishMembersSheetDrag();
    else resetMembersSheetPosition();
  },{passive:true});

  sheet.addEventListener('touchcancel',()=>{
    if(memberSheetDrag.active)resetMembersSheetPosition();
  },{passive:true});
}

function setMembersLoading(v){
  membersLoading=v;
  const root=$('lista-membri'),add=$('btn-add-member'),save=$('members-save');
  if(v){
    root.innerHTML=`<div class="members-loading" role="status"><div class="spinner" aria-hidden="true"></div><div><strong>Caricamento membri</strong><span>Sto aggiornando l’elenco…</span></div></div>`;
    add.hidden=true;
    save.disabled=true;
    save.textContent='Caricamento…';
  }else{
    add.hidden=false;
    save.disabled=false;
    save.textContent='Salva modifiche';
  }
}
function openMembers(){
  if(!isCoord)return;
  membersDraft=[];
  $('members-error').classList.remove('visible');$('members-error').textContent='';
  setMembersLoading(true);
  openDialog('modal-impostazioni','#members-cancel');

  apiRequest('gestione_membri',{},rows=>{
    setMembersLoading(false);
    if(!Array.isArray(rows)){
      $('lista-membri').innerHTML=`<div class="members-load-failed">${icon('warning','icon icon-lg')}<strong>Impossibile caricare i membri</strong><span>Chiudi il pannello e riprova tra poco.</span></div>`;
      apiError(rows?.message||'Impossibile caricare i membri.');
      return;
    }
    membersDraft=rows.map(x=>({...x}));
    renderMembers();
    setTimeout(()=>$('lista-membri').querySelector('.member-editor-name')?.focus(),30);
  });
}
function closeMembers(){
  membersDraft=[];
  membersLoading=false;
  closeDialog('modal-impostazioni');
}
function renderMembers(){
  const root=$('lista-membri');
  root.innerHTML=membersDraft.map((m,i)=>{
    const name=String(m.nome||''),ac=avatarColors(name||'?'),ini=(name||'?').split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase();
    const self=String(m.id||'')===String(currentUserId||'');
    const inactive=!m.attivo;
    return `<div class="member-editor-card${inactive?' inactive':''}" data-member-index="${i}">
      <div class="member-editor-head">
        <div class="member-info"><div class="avatar" style="background:${ac.bg};color:${ac.fg}">${escapeHtml(ini)}</div><div><div class="member-editor-title">${escapeHtml(name||'Nuovo membro')}</div><div class="member-editor-status">${inactive?'Accesso disattivato':!m.email?'Email da inserire':m.ruolo==='coordinatore'?'Coordinatore':'Membro'}</div></div></div>
        <div class="member-editor-action">${self?'<span class="chip chip-wait">Il tuo account</span>':inactive?`<button class="btn-small" type="button" data-member-reactivate="${i}">Riattiva</button>`:`<button class="btn-danger" type="button" data-member-remove="${i}">Disattiva</button>`}</div>
      </div>
      <div class="member-editor-fields">
        <label>Nome<input class="member-editor-name" type="text" maxlength="100" value="${escapeAttr(name)}" data-member-field="nome" data-index="${i}" ${inactive?'disabled':''}></label>
        <label>Email scolastica<input type="email" maxlength="180" value="${escapeAttr(m.email||'')}" data-member-field="email" data-index="${i}" ${inactive?'disabled':''}></label>
        <label>Ruolo<select data-member-field="ruolo" data-index="${i}" ${inactive||self?'disabled':''}><option value="membro"${m.ruolo==='membro'?' selected':''}>Membro</option><option value="coordinatore"${m.ruolo==='coordinatore'?' selected':''}>Coordinatore</option></select></label>
      </div>
    </div>`;
  }).join('');
}
function addMember(){
  if(membersLoading)return;
  membersDraft.push({id:'',nome:'',email:'',ruolo:'membro',attivo:true});
  renderMembers();
  const inputs=$('lista-membri').querySelectorAll('.member-editor-name');
  const last=inputs[inputs.length-1];if(last){last.scrollIntoView({behavior:'smooth',block:'center'});last.focus()}
}
function askRemoveMember(i){
  const m=membersDraft[i];if(!m)return;
  if(String(m.id||'')===String(currentUserId||'')){apiError('Non puoi disattivare il tuo account.');return}
  deletingMembroIdx=i;
  $('confirm-membro-msg').textContent=`Disattivare l’accesso di “${m.nome||'questo membro'}”? Le sue disponibilità storiche non verranno cancellate.`;
  openDialog('confirm-membro-bg','#member-delete-confirm');
}
function confirmRemoveMember(){
  if(deletingMembroIdx===null)return;
  const m=membersDraft[deletingMembroIdx];if(m)m.attivo=false;
  deletingMembroIdx=null;closeDialog('confirm-membro-bg');renderMembers();
}
function cancelRemoveMember(){deletingMembroIdx=null;closeDialog('confirm-membro-bg')}
function saveMembers(){
  if(!isCoord||membersLoading)return;
  const error=$('members-error');
  error.classList.remove('visible');error.textContent='';
  for(const m of membersDraft){
    m.nome=String(m.nome||'').trim().replace(/\s+/g,' ');
    m.email=String(m.email||'').trim().toLowerCase();
    const emailOk=!m.email||/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email);
    if(!m.nome||!emailOk){
      error.textContent='Controlla nome ed email dei membri.';
      error.classList.add('visible');return;
    }
  }
  const b=$('members-save');b.disabled=true;b.textContent='Salvataggio…';
  apiRequest('salva_membri',{payload:JSON.stringify(membersDraft)},resp=>{
    b.disabled=false;b.textContent='Salva modifiche';
    if(!apiSucceeded(resp)){error.textContent=resp?.message||'Membri non salvati. Riprova.';error.classList.add('visible');return}
    apiRequest('sessione',{},sessionResp=>{
      if(sessionResp&&sessionResp.ok===true&&sessionResp.utente){
        currentUser=sessionResp.utente.nome||currentUser;currentUserEmail=sessionResp.utente.email||currentUserEmail;isCoord=sessionResp.utente.ruolo==='coordinatore';
      }
      loadCommissionMembers(ok=>{
        if(!ok){apiError('Membri salvati, ma impossibile aggiornare l’elenco.');return}
        closeMembers();$('welcome-msg').textContent='Ciao, '+currentUser;renderIncontri();showToast('Membri salvati');
      });
    });
  });
}
function updateMemberDraftField(target){
  const i=Number(target.dataset.index),field=target.dataset.memberField,m=membersDraft[i];
  if(!m||!field)return;
  m[field]=target.type==='checkbox'?target.checked:target.value;
  if(field==='nome'){const title=target.closest('.member-editor-card')?.querySelector('.member-editor-title');if(title)title.textContent=target.value||'Nuovo membro'}
}
function reactivateMember(i){
  const m=membersDraft[i];if(!m)return;m.attivo=true;renderMembers();
}

function focusTrap(e){if(e.key!=='Tab')return;const bg=[...document.querySelectorAll('.modal-bg.open,.confirm-bg.open')].at(-1);if(!bg)return;const items=[...bg.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}

window.addEventListener('DOMContentLoaded',()=>{
  setNetworkState();
  $('demo-note').classList.toggle('visible',DEMO_MODE);

  const today=new Date(),min=isoDate(today),max=new Date(today.getFullYear()+2,today.getMonth(),today.getDate());
  $('modal-data').min=min;$('modal-data').max=isoDate(max);

  $('send-code-btn').addEventListener('click',requestCode);
  $('verify-code-btn').addEventListener('click',verifyLoginCode);
  $('resend-code-btn').addEventListener('click',resendCode);
  $('change-email-btn').addEventListener('click',()=>showLoginEmailStep(''));
  $('login-email').addEventListener('keydown',e=>{if(e.key==='Enter')requestCode()});
  $('login-code').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6)});
  $('login-code').addEventListener('keydown',e=>{if(e.key==='Enter')verifyLoginCode()});

  document.querySelector('.nav-wrap').addEventListener('click',e=>{const b=e.target.closest('button[data-page]');if(b)showPage(b.dataset.page)});
  $('seg-filters').addEventListener('click',e=>{const b=e.target.closest('.stat');if(b)setSegFilter(b.dataset.filter)});
  $('table-container').addEventListener('change',e=>{const s=e.target.closest('.stato-sel');if(s)updateStatus(s)});
  $('table-container').addEventListener('click',e=>{
    const linked=e.target.closest('[data-action="open-linked-meeting"]');
    if(linked){const meetingId=linked.dataset.meetingId;if(meetingId)openLinkedMeeting(meetingId);return}
    const del=e.target.closest('[data-action="delete-seg"]');
    if(del&&isCoord){
      const segId=del.dataset.segId;
      if(segId)askDeleteSeg(segId);
      return;
    }
    const b=e.target.closest('[data-action="quick-meeting"]');
    if(!b||!isCoord)return;
    const segId=b.dataset.segId;
    if(!segId)return;
    openQuickMeeting(segId);
  });

  $('incontri-list').addEventListener('click',e=>{
    const b=e.target.closest('button[data-action]');if(!b)return;
    if(b.dataset.action==='toggle-past'){showPastMeetings=!showPastMeetings;renderIncontri();return}
    const card=b.closest('.inc-card'),id=card?.dataset.meetingId;if(!id)return;
    if(b.dataset.action==='toggle-meeting-card'){toggleMeetingCard(id);return}
    if(b.dataset.action==='toggle-availability')togglePanel(id);
    else if(b.dataset.action==='availability')saveAvailability(id,b.dataset.response);
    else if(b.dataset.action==='edit-meeting')openMeetingModal(incontri.find(i=>String(i.id)===String(id)));
    else if(b.dataset.action==='delete-meeting')askDeleteMeeting(id);
  });

  $('avvisi-list').addEventListener('click',e=>{const edit=e.target.closest('[data-action="edit-notice"]'),del=e.target.closest('[data-action="delete-notice"]');if(edit){const card=edit.closest('[data-notice-id]'),a=avvisi.find(x=>String(x.id)===String(card?.dataset.noticeId||''));if(a&&(a.puoiGestire||String(a.autoreId||'')===String(currentUserId||'')))openNoticeModal(a);return}if(del){const card=del.closest('[data-notice-id]');if(card)askDeleteNotice(card.dataset.noticeId)}});
  $('notice-text').addEventListener('input',updateNoticeCharCount);
  $('notice-cancel').addEventListener('click',closeNoticeModal);
  $('notice-save').addEventListener('click',saveNotice);
  $('notice-delete-cancel').addEventListener('click',closeDeleteNotice);
  $('notice-delete-confirm').addEventListener('click',confirmDeleteNotice);
  $('logout-cancel').addEventListener('click',closeLogoutConfirm);
  $('logout-confirm').addEventListener('click',confirmLogout);

  $('lista-membri').addEventListener('click',e=>{
    const remove=e.target.closest('[data-member-remove]'),reactivate=e.target.closest('[data-member-reactivate]');
    if(remove)askRemoveMember(Number(remove.dataset.memberRemove));
    else if(reactivate)reactivateMember(Number(reactivate.dataset.memberReactivate));
  });
  $('lista-membri').addEventListener('input',e=>{if(e.target.matches('[data-member-field]'))updateMemberDraftField(e.target)});
  $('lista-membri').addEventListener('change',e=>{if(e.target.matches('[data-member-field]'))updateMemberDraftField(e.target)});

  $('refresh-segnalazioni').addEventListener('click',loadSegnalazioni);
  $('refresh-incontri').addEventListener('click',loadIncontri);
  $('refresh-avvisi').addEventListener('click',()=>loadAvvisi());
  $('btn-nuovo-avviso').addEventListener('click',()=>openNoticeModal());
  $('btn-proponi').addEventListener('click',()=>openMeetingModal());
  $('btn-impostazioni').addEventListener('click',openMembers);
  $('btn-logout').addEventListener('click',askLogout);

  $('mobile-btn-impostazioni').addEventListener('click',()=>{closeMobileMenu();openMembers()});
  $('mobile-btn-logout').addEventListener('click',askLogout);

  $('modal-cancel').addEventListener('click',closeMeetingModal);
  $('btn-salva-incontro').addEventListener('click',saveMeeting);
  $('members-cancel').addEventListener('click',closeMembers);
  $('members-save').addEventListener('click',saveMembers);
  $('btn-add-member').addEventListener('click',addMember);

  $('delete-cancel').addEventListener('click',closeDeleteMeeting);
  $('delete-confirm').addEventListener('click',confirmDeleteMeeting);
  $('seg-delete-cancel').addEventListener('click',closeDeleteSeg);
  $('seg-delete-confirm').addEventListener('click',confirmDeleteSeg);
  $('member-delete-cancel').addEventListener('click',cancelRemoveMember);
  $('member-delete-confirm').addEventListener('click',confirmRemoveMember);
  setupMembersSheetGesture();

  document.addEventListener('click',e=>{if(!e.target.closest('.mobile-account'))closeMobileMenu()});
  window.addEventListener('online',()=>{setNetworkState();refreshNoticeBadge()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshNoticeBadge()});
  let __grLastMobile=window.innerWidth<=700;
  window.addEventListener('resize',()=>{const mobile=window.innerWidth<=700;if(mobile===__grLastMobile)return;__grLastMobile=mobile;if(currentUser){renderSegnalazioni();renderIncontri();}updateNavIndicator(currentPage,false);});
  window.addEventListener('offline',setNetworkState);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeMobileMenu();
      if($('confirm-logout-bg').classList.contains('open'))return closeLogoutConfirm();
      if($('confirm-avviso-bg').classList.contains('open'))return closeDeleteNotice();
      if($('confirm-membro-bg').classList.contains('open'))return cancelRemoveMember();
      if($('confirm-seg-bg').classList.contains('open'))return closeDeleteSeg();
      if($('confirm-bg').classList.contains('open'))return closeDeleteMeeting();
      if($('modal-avviso-bg').classList.contains('open'))return closeNoticeModal();
      if($('modal-impostazioni').classList.contains('open'))return closeMembers();
      if($('modal-bg').classList.contains('open'))return closeMeetingModal();
    }
    focusTrap(e);
  });
  for(const id of ['modal-bg','modal-impostazioni','modal-avviso-bg'])$(id).addEventListener('click',e=>{if(e.target!==e.currentTarget)return;if(id==='modal-bg')closeMeetingModal();else if(id==='modal-impostazioni')closeMembers();else closeNoticeModal()});
  $('confirm-seg-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDeleteSeg()});
  $('confirm-avviso-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDeleteNotice()});
  $('confirm-logout-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeLogoutConfirm()});

  if(DEMO_MODE){
    currentUser=DEFAULT_MEMBERS[0];currentUserId='demo';currentUserEmail='demo@example.it';isCoord=true;authToken='demo';members=[...DEFAULT_MEMBERS];showMain();
  }else{
    restoreSession();
  }
});
