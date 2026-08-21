
function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js?v=22').catch(err=>{
      console.warn('Service worker non registrato:',err);
    });
  },{once:true});
}
registerServiceWorker();

const API='https://script.google.com/macros/s/AKfycbxxh2IxU5RsMRaH2jJSLz-zjQ7HQOHy6bClaDVQ9wSSlM2bWFsoKW--2ECeWyqQAf9D/exec';
const API_TIMEOUT_MS=12000;
const DEFAULT_MEMBERS=['Filippo Colluto','Anna Ferrari','Marco Bianchi','Sara Conti','Luca Esposito','Giulia Ricci','Paolo Marino','Elena Romano','Davide Bruno','Chiara Gallo','Fabio Costa','Marta Fontana','Andrea Russo','Valentina Moro','Stefano Serra','Irene Lombardi'];
const DAYS=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const MONTHS=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const STATUS_LABELS={'Aperta':'Da prendere in carico','In gestione':'In percorso','Chiusa':'Conclusa'};
const LOADER='<div class="loading-state"><div class="spinner" aria-hidden="true"></div><span>Caricamento…</span></div>';
const DEMO_MODE=new URLSearchParams(location.search).get('demo')==='1';

let members=DEMO_MODE?[...DEFAULT_MEMBERS]:[],membersDraft=[],currentUser=null,currentUserId=null,currentUserEmail='',isCoord=false,authToken='',rememberDevice=true,authFlowBusy=false;
let segnalazioni=[],incontri=[],disponibilita=[];
let editingId=null,deletingId=null,deletingSegId=null,deletingMembroIdx=null,currentSegFilter='all',showPastMeetings=false,openPanels={},pendingLoginEmail='';
let cbN=0,loadingSeg=false,loadingInc=false,incontriLoadedOnce=false;
const dialogReturnFocus=new Map();
let DEMO_SEGNALAZIONI=[
 {ID:'seg_demo_1',Data:'2026-08-18',Componente:'Componente Studenti',Recapito:'studente@example.it',Stato:'Aperta','Link Risposta':''},
 {ID:'seg_demo_2',Data:'2026-08-14',Componente:'Componente Adulti',Recapito:'adulto@example.it',Stato:'In gestione','Link Risposta':'https://example.com/risposta'},
 {ID:'seg_demo_3',Data:'2026-08-05',Componente:'Componente Entrambi',Recapito:'contatto@example.it',Stato:'Chiusa','Link Risposta':''}
];
let DEMO_INCONTRI=[
 {id:'demo-1',titolo:'venerdì 21 Agosto 2026',dataIso:'2026-08-21',orario:'15:30',luogo:'Aula riunioni',segnalazione:'Segnalazione del 18 agosto 2026 · Componente Studenti · studente@example.it',segnalazioneId:'seg_demo_1'},
 {id:'demo-2',titolo:'martedì 25 Agosto 2026',dataIso:'2026-08-25',orario:'14:15',luogo:'Biblioteca',segnalazione:'Segnalazione del 14 agosto 2026 · Componente Adulti · adulto@example.it',segnalazioneId:'seg_demo_2'}
];
let DEMO_DISP=[{membro:'Filippo Colluto',incontro:'demo-1',risposta:'si'},{membro:'Anna Ferrari',incontro:'demo-1',risposta:'si'},{membro:'Marco Bianchi',incontro:'demo-1',risposta:'no'}];

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
function linkedMeetingForSeg(seg){
  if(!seg)return null;
  const id=String(seg.ID||'').trim();
  if(id){
    const exact=incontri.find(inc=>String(inc.segnalazioneId||'').trim()===id);
    if(exact)return exact;
  }
  // Compatibilità con incontri storici creati prima dell'introduzione di "Segnalazione ID".
  const targetDate=normalizeCompare(dateLong(seg.Data));
  const targetComponent=normalizeCompare(seg.Componente);
  const targetContact=normalizeCompare(seg.Recapito);
  return incontri.find(inc=>{
    if(String(inc.segnalazioneId||'').trim())return false;
    const parsed=parseMeetingSummary(inc.segnalazione||'');
    return normalizeCompare(dateLong(parsed.date))===targetDate
      && normalizeCompare(parsed.component)===targetComponent
      && normalizeCompare(parsed.contact)===targetContact;
  })||null;
}
function deleteSegAction(r){
  if(!isCoord||!r?.ID)return '';
  return `<button class="seg-delete-action" type="button" data-action="delete-seg" data-seg-id="${escapeAttr(r.ID)}">${icon('trash','icon icon-sm')}<span>Elimina</span></button>`;
}
function quickMeetingAction(r){
  if(!isCoord||!r?.ID)return '';
  if((r.Stato||'Aperta')==='Chiusa')return '';
  const linked=incontriLoadedOnce?linkedMeetingForSeg(r):null;
  if(linked){
    const d=meetingDate(linked);
    const when=d?`${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()].slice(0,3).toUpperCase()}`:'';
    return `<span class="seg-meeting-linked">${icon('calendar','icon icon-sm')}<span>Incontro collegato${when?` · ${escapeHtml(when)}`:''}</span></span>`;
  }
  return `<button class="seg-quick-meeting" type="button" data-action="quick-meeting" data-seg-id="${escapeAttr(r.ID)}">${icon('calendar','icon icon-sm')}<span>Crea incontro</span></button>`;
}
function openQuickMeeting(segId){
  const seg=segnalazioni.find(r=>String(r.ID||'')===String(segId||''));
  if(!seg){apiError('Segnalazione non trovata.');return}
  const proceed=()=>{
    const linked=linkedMeetingForSeg(seg);
    if(linked){
      renderSegnalazioni();
      showToast('Questa segnalazione ha già un incontro collegato.');
      return;
    }
    openMeetingModal(null,seg.ID);
  };
  if(incontriLoadedOnce){proceed();return}
  apiRequest('incontri',{},data=>{
    if(!Array.isArray(data)){apiError('Non riesco a verificare gli incontri. Riprova.');return}
    incontri=data;
    incontriLoadedOnce=true;
    renderSegnalazioni();
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
    members=rows.map(x=>String(x.nome||'').trim()).filter(Boolean);
    if(currentUser&&!members.includes(currentUser))members.unshift(currentUser);
    done(true);
  });
}
function handleAuthFailure(resp){
  const message=resp?.message||'La sessione non è più valida. Accedi di nuovo.';
  authToken='';currentUser=null;currentUserId=null;currentUserEmail='';isCoord=false;members=[];
  clearStoredSessionToken();
  closeMobileMenu();
  showLoginEmailStep(message);
}

function selectLogin(){return}
function login(){requestCode()}
function logout(){
  const token=authToken;
  authToken='';currentUser=null;currentUserId=null;currentUserEmail='';isCoord=false;members=[];openPanels={};
  clearStoredSessionToken();
  $('main-screen').style.display='none';
  closeMobileMenu();
  showLoginEmailStep('');
  if(token){
    const previous=authToken;authToken=token;
    apiRequest('logout',{},()=>{authToken=''});
  }
}
function showMain(){
  authFlowBusy=false;
  $('login-screen').classList.remove('visible');
  $('main-screen').style.display='block';
  $('welcome-msg').textContent='Ciao, '+currentUser;
  $('coord-tag').hidden=!isCoord;
  $('btn-proponi').hidden=!isCoord;
  $('btn-impostazioni').hidden=!isCoord;
  $('mobile-btn-impostazioni').hidden=!isCoord;
  $('demo-note').classList.toggle('visible',DEMO_MODE);
  loadSegnalazioni();
  loadIncontri();
}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+id));document.querySelectorAll('.nav-wrap button').forEach(b=>{const active=b.dataset.page===id;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});closeMobileMenu()}
function toggleMobileMenu(){const menu=$('mobile-account-menu'),trigger=$('mobile-menu-trigger'),open=!menu.classList.contains('open');menu.classList.toggle('open',open);trigger.setAttribute('aria-expanded',open?'true':'false')}
function closeMobileMenu(){$('mobile-account-menu').classList.remove('open');$('mobile-menu-trigger').setAttribute('aria-expanded','false')}
function setNetworkState(){const offline=!navigator.onLine;$('network-banner').classList.toggle('visible',offline)}

function setSegFilter(filter){currentSegFilter=filter;document.querySelectorAll('#seg-filters .stat').forEach(b=>{const a=b.dataset.filter===filter;b.classList.toggle('active',a);b.setAttribute('aria-pressed',a?'true':'false')});renderSegnalazioni()}
function loadSegnalazioni(){if(loadingSeg)return;loadingSeg=true;$('refresh-segnalazioni').disabled=true;$('table-container').innerHTML=LOADER;$('table-container').setAttribute('aria-busy','true');apiRequest('segnalazioni',{},rows=>{loadingSeg=false;$('refresh-segnalazioni').disabled=false;$('table-container').removeAttribute('aria-busy');if(!Array.isArray(rows)){$('table-container').innerHTML=emptyState('warning','Impossibile caricare le segnalazioni','Controlla la connessione e premi Aggiorna per riprovare.');apiError('Impossibile caricare le segnalazioni.');return}segnalazioni=rows;stampUpdate('seg-updated');renderSegnalazioni();populateSegSelect()})}
function populateSegSelect(){const sel=$('modal-segnalazione');const sorted=[...segnalazioni].sort((a,b)=>segTimestamp(b.Data)-segTimestamp(a.Data));sel.innerHTML='<option value="">— Nessuna segnalazione —</option>'+sorted.map(r=>`<option value="${escapeAttr(r.ID||'')}">${escapeHtml(dateLong(r.Data)+' · '+componentDisplay(r.Componente)+(r.Recapito?' · '+r.Recapito:''))}</option>`).join('')}
function statusMarkup(r,index){if(!isCoord)return `<span class="badge ${statusClass(r.Stato)}">${escapeHtml(statusLabel(r.Stato||'Aperta'))}</span>`;return `<select class="stato-sel" data-id="${escapeAttr(r.ID||'')}" data-index="${index}" aria-label="Stato della segnalazione"><option value="Aperta" ${(r.Stato||'Aperta')==='Aperta'?'selected':''}>Da prendere in carico</option><option value="In gestione" ${r.Stato==='In gestione'?'selected':''}>In percorso</option><option value="Chiusa" ${r.Stato==='Chiusa'?'selected':''}>Conclusa</option></select>`}
function renderSegnalazioni(){const all=[...segnalazioni].sort((a,b)=>segTimestamp(b.Data)-segTimestamp(a.Data));const counts={all:all.length,'Aperta':all.filter(r=>(r.Stato||'Aperta')==='Aperta').length,'In gestione':all.filter(r=>r.Stato==='In gestione').length,'Chiusa':all.filter(r=>r.Stato==='Chiusa').length};$('stat-total').textContent=counts.all;$('stat-aperte').textContent=counts.Aperta;$('stat-gestione').textContent=counts['In gestione'];$('stat-chiuse').textContent=counts.Chiusa;const rows=currentSegFilter==='all'?all:all.filter(r=>(r.Stato||'Aperta')===currentSegFilter);if(!all.length){$('table-container').innerHTML=emptyState('report','Nessuna segnalazione','Le nuove segnalazioni appariranno qui.');return}if(!rows.length){$('table-container').innerHTML=emptyState('report','Nessuna segnalazione in questa categoria','Scegli un altro filtro per vedere le altre segnalazioni.');return}
 const desktop=`<div class="seg-desktop-table"><table aria-label="Segnalazioni ricevute"><thead><tr><th scope="col" style="width:18%">Data</th><th scope="col" style="width:19%">Componente</th><th scope="col" style="width:22%">Contatto</th><th scope="col" style="width:23%">Stato</th><th scope="col" style="width:18%">Azioni</th></tr></thead><tbody>${rows.map(r=>{const i=segnalazioni.indexOf(r),url=safeExternalUrl(r['Link Risposta']),meetingAction=quickMeetingAction(r),deleteAction=deleteSegAction(r);return `<tr><td>${escapeHtml(dateLong(r.Data))}</td><td><span class="badge ${componentClass(r.Componente)}">${escapeHtml(componentDisplay(r.Componente))}</span></td><td>${escapeHtml(r.Recapito||'—')}</td><td>${statusMarkup(r,i)}</td><td><div class="seg-row-actions">${url?`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">Apri risposta ${icon('external','icon icon-sm')}</a>`:''}${meetingAction}${deleteAction}${!url&&!meetingAction&&!deleteAction?'—':''}</div></td></tr>`}).join('')}</tbody></table></div>`;
 const mobile=`<div class="seg-mobile-list" aria-label="Segnalazioni ricevute">${rows.map(r=>{const i=segnalazioni.indexOf(r),st=r.Stato||'Aperta',state=st==='Chiusa'?'state-chiusa':st==='In gestione'?'state-gestione':'state-aperta',url=safeExternalUrl(r['Link Risposta']),meetingAction=quickMeetingAction(r),deleteAction=deleteSegAction(r);return `<article class="seg-mobile-card ${state}"><div class="seg-mobile-head"><div class="seg-mobile-date-wrap"><div class="seg-mobile-date-icon">${icon('report')}</div><div><div class="seg-mobile-kicker">Segnalazione</div><div class="seg-mobile-date">${escapeHtml(dateLong(r.Data))}</div></div></div>${statusMarkup(r,i)}</div><div class="seg-mobile-body"><div class="seg-mobile-field"><div class="seg-mobile-field-label">Componente</div><div class="seg-mobile-field-value"><span class="badge ${componentClass(r.Componente)}">${escapeHtml(componentDisplay(r.Componente))}</span></div></div><div class="seg-mobile-field"><div class="seg-mobile-field-label">Contatto</div><div class="seg-mobile-field-value">${escapeHtml(r.Recapito||'—')}</div></div><div class="seg-mobile-field"><div class="seg-mobile-field-label">Risposta</div><div class="seg-mobile-field-value">${url?`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">Apri risposta ${icon('external','icon icon-sm')}</a>`:'Non disponibile'}</div></div></div>${meetingAction||deleteAction?`<div class="seg-mobile-meeting-action seg-mobile-actions">${meetingAction}${deleteAction}</div>`:''}</article>`}).join('')}</div>`;
 $('table-container').innerHTML=desktop+mobile}
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

function loadIncontri(){if(loadingInc)return;loadingInc=true;$('refresh-incontri').disabled=true;$('incontri-list').innerHTML=LOADER;$('incontri-list').setAttribute('aria-busy','true');apiRequest('incontri',{},data=>{if(!Array.isArray(data)){finishIncontriLoad();$('incontri-list').innerHTML=emptyState('warning','Impossibile caricare gli incontri','Controlla la connessione e premi Aggiorna per riprovare.');apiError('Impossibile caricare gli incontri.');return}incontri=data;apiRequest('disponibilita',{},disp=>{disponibilita=Array.isArray(disp)?disp:[];finishIncontriLoad();stampUpdate('inc-updated');renderIncontri();if(!Array.isArray(disp))apiError('Incontri caricati, ma non le disponibilità.')})})}
function finishIncontriLoad(){loadingInc=false;incontriLoadedOnce=true;$('refresh-incontri').disabled=false;$('incontri-list').removeAttribute('aria-busy');if(segnalazioni.length)renderSegnalazioni()}
function getResponse(name,id){return disponibilita.filter(d=>d.membro===name&&String(d.incontro)===String(id)).slice(-1)[0]?.risposta||null}
function dispCounts(id){let yes=0,no=0;for(const n of members){const r=getResponse(n,id);if(r==='si')yes++;else if(r==='no')no++}return{yes,no,wait:Math.max(0,members.length-yes-no),total:members.length}}
function renderDispGroup(title,list,type){return `<div class="availability-group"><div class="availability-group-title"><span>${escapeHtml(title)}</span><span class="availability-group-count">${list.length}</span></div>${list.map(n=>{const ac=avatarColors(n),ini=n.split(/\s+/).map(p=>p[0]).join('').slice(0,2).toUpperCase(),me=n===currentUser,label=type==='yes'?'Disponibile':type==='no'?'Non disponibile':'In attesa';return `<div class="member-row${me?' me':''}"><div class="member-info"><div class="avatar" style="background:${ac.bg};color:${ac.fg}">${escapeHtml(ini)}</div><div class="member-name-row">${escapeHtml(n)}${me?'<span class="you-badge">Tu</span>':''}</div></div><span class="chip chip-${type}">${escapeHtml(label)}</span></div>`}).join('')}</div>`}
function renderDispPanel(id){const groups={yes:[],no:[],wait:[]};[...members].sort((a,b)=>a.localeCompare(b,'it',{sensitivity:'base'})).forEach(n=>{const r=getResponse(n,id);groups[r==='si'?'yes':r==='no'?'no':'wait'].push(n)});return renderDispGroup('Disponibili',groups.yes,'yes')+renderDispGroup('Non disponibili',groups.no,'no')+renderDispGroup('In attesa',groups.wait,'wait')}
function renderIncontri(){const future=incontri.filter(i=>!isPast(i)).sort((a,b)=>meetingTimestamp(a)-meetingTimestamp(b)),past=incontri.filter(isPast).sort((a,b)=>meetingTimestamp(b)-meetingTimestamp(a));let html='';if(!future.length&&!past.length){$('incontri-list').innerHTML=emptyState('calendar','Nessun incontro','Gli incontri proposti compariranno qui.');return}if(future.length){html+=`<div class="incontri-list-stack future">${future.map(renderMeetingCard).join('')}</div>`}else{html+=emptyState('calendar','Nessun incontro in programma','Puoi consultare gli incontri conclusi qui sotto.')}if(past.length){html+=`<button class="past-toggle" type="button" data-action="toggle-past"><span>Incontri conclusi · ${past.length}</span><span>${showPastMeetings?'Nascondi':'Mostra'} ${icon(showPastMeetings?'chevron-up':'chevron-down','icon icon-sm')}</span></button>`;if(showPastMeetings)html+=`<div class="incontri-list-stack past">${past.map(renderMeetingCard).join('')}</div>`}$('incontri-list').innerHTML=html;for(const [id,open] of Object.entries(openPanels)){if(open){const wrap=$('disp-wrap-'+id);if(wrap){wrap.classList.add('open');wrap.style.maxHeight='none'}}}}
function renderMeetingCard(inc){const date=meetingDate(inc),dp=meetingParts(inc.dataIso||inc.titolo),past=isPast(inc),today=isToday(inc),cls=past?'passato':today?'oggi':'futuro',my=getResponse(currentUser,inc.id),myText=my==='si'?'Hai indicato: disponibile':my==='no'?'Hai indicato: non disponibile':'Non hai ancora risposto',counts=dispCounts(inc.id),pct=counts.total?Math.round(counts.yes/counts.total*100):0,open=!!openPanels[inc.id],seg=inc.segnalazione?parseMeetingSummary(inc.segnalazione):null;
 const head=dp?`<div class="inc-date-heading"><div class="inc-date-tile"><span class="inc-date-month">${escapeHtml(dp.month)}</span><span class="inc-date-day">${escapeHtml(dp.day)}</span></div><div><div class="inc-date-weekday-out">${escapeHtml(dp.weekday)}</div><div class="inc-date-year">${escapeHtml(dp.year)}</div></div><div class="inc-date-tags">${today?'<span class="tag-oggi">Oggi</span>':''}${past?'<span class="tag-passato">Concluso</span>':''}</div></div>`:`<div class="inc-date-heading"><div></div><div class="inc-date-fallback">Data da verificare</div></div>`;
 const linked=seg?`<section class="inc-section inc-section-linked"><div class="inc-linked"><div class="inc-linked-icon">${icon('report')}</div><div><span class="inc-linked-label">Segnalazione collegata</span><div class="inc-linked-details"><span class="inc-linked-main">${escapeHtml(dateBadge(seg.date))}</span>${seg.component?`<span class="inc-linked-meta">${escapeHtml(componentDisplay(seg.component))}</span>`:''}</div>${seg.contact?`<div class="inc-linked-compact-note">Contatto: ${escapeHtml(seg.contact)}</div>`:''}</div></div></section>`:'';
 const response=!past?`<section class="inc-section inc-section-response"><div class="inc-section-surface"><div class="inc-section-header"><div class="inc-section-kicker">La tua disponibilità</div></div><div class="inc-response-row"><div><div class="inc-response-state" id="my-state-${escapeAttr(inc.id)}">${escapeHtml(myText)}</div></div><div class="inc-response-buttons"><button class="btn-yes ${my==='si'?'active':''}" id="btn-yes-${escapeAttr(inc.id)}" type="button" data-action="availability" data-response="si">${icon('check')}Ci sono</button><button class="btn-no ${my==='no'?'active':''}" id="btn-no-${escapeAttr(inc.id)}" type="button" data-action="availability" data-response="no">${icon('x')}Non posso</button></div></div></div></section>`:'';
 const attendance=`<section class="inc-section inc-section-attendance"><div class="inc-section-surface"><div class="inc-summary-top"><div class="inc-summary-text"><div class="inc-section-kicker">Disponibilità del gruppo</div><p class="progress-label" id="plabel-${escapeAttr(inc.id)}">${counts.yes} disponibili su ${counts.total}</p></div><div class="inc-summary-side">${counts.wait} in attesa</div></div><div class="progress-bar"><div class="progress-fill" id="fill-${escapeAttr(inc.id)}" style="width:${pct}%"></div></div><div class="attendance-breakdown" id="breakdown-${escapeAttr(inc.id)}"><span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} non disponibili</span><span>${counts.wait} in attesa</span></div><button class="btn-small availability-trigger" id="disp-btn-${escapeAttr(inc.id)}" type="button" data-action="toggle-availability" aria-expanded="${open?'true':'false'}"><span class="availability-label">${icon(open?'chevron-up':'chevron-down')}<span>${open?'Nascondi disponibilità':'Vedi disponibilità'}</span></span><span class="availability-count">${counts.yes} sì · ${counts.no} no · ${counts.wait} in attesa</span></button></div></section>`;
 const details=`<div class="disp-panel-wrap${open?' open':''}" id="disp-wrap-${escapeAttr(inc.id)}"><div class="disp-panel">${renderDispPanel(inc.id)}</div></div>`;
 return `<article class="inc-card ${cls}" data-meeting-id="${escapeAttr(inc.id)}">${head}<div class="inc-meta-row"><span class="inc-meta-item">${icon('clock','icon icon-sm')}<strong>${escapeHtml(inc.orario||'Orario da definire')}</strong></span>${inc.luogo?`<span class="inc-meta-separator">·</span><span class="inc-meta-item inc-meta-place">${icon('pin','icon icon-sm')}${escapeHtml(inc.luogo)}</span>`:''}</div>${response}${attendance}${linked}${details}${isCoord?`<div class="inc-admin-actions"><button class="btn-small" type="button" data-action="edit-meeting">${icon('edit')}Modifica</button><button class="btn-danger" type="button" data-action="delete-meeting">${icon('trash')}Elimina</button></div>`:''}</article>`}
function togglePanel(id){openPanels[id]=!openPanels[id];const wrap=$('disp-wrap-'+id),btn=$('disp-btn-'+id),open=openPanels[id];if(btn){btn.setAttribute('aria-expanded',open?'true':'false');const label=btn.querySelector('.availability-label');if(label)label.innerHTML=icon(open?'chevron-up':'chevron-down')+`<span>${open?'Nascondi disponibilità':'Vedi disponibilità'}</span>`}if(!wrap)return;if(open){wrap.classList.add('open');wrap.style.maxHeight=wrap.scrollHeight+'px';setTimeout(()=>{if(openPanels[id])wrap.style.maxHeight='none'},270)}else{wrap.style.maxHeight=wrap.scrollHeight+'px';requestAnimationFrame(()=>{wrap.style.maxHeight='0px';wrap.classList.remove('open')})}}
function updateMeetingState(id){const counts=dispCounts(id),pct=counts.total?Math.round(counts.yes/counts.total*100):0,my=getResponse(currentUser,id);const fill=$('fill-'+id),label=$('plabel-'+id),breakdown=$('breakdown-'+id),state=$('my-state-'+id),yes=$('btn-yes-'+id),no=$('btn-no-'+id),btn=$('disp-btn-'+id);if(fill)fill.style.width=pct+'%';if(label)label.textContent=`${counts.yes} disponibili su ${counts.total}`;if(breakdown)breakdown.innerHTML=`<span class="yes">${counts.yes} disponibili</span><span class="no">${counts.no} non disponibili</span><span>${counts.wait} in attesa</span>`;if(state)state.textContent=my==='si'?'Hai indicato: disponibile':my==='no'?'Hai indicato: non disponibile':'Non hai ancora risposto';if(yes)yes.classList.toggle('active',my==='si');if(no)no.classList.toggle('active',my==='no');if(btn){const c=btn.querySelector('.availability-count');if(c)c.textContent=`${counts.yes} sì · ${counts.no} no · ${counts.wait} in attesa`}const wrap=$('disp-wrap-'+id);if(wrap){const panel=wrap.querySelector('.disp-panel'),inc=incontri.find(i=>String(i.id)===String(id)),seg=inc?.segnalazione?parseMeetingSummary(inc.segnalazione):null;if(panel)panel.innerHTML=(seg?`<div class="seg-info"><div class="seg-info-row">Data: <span>${escapeHtml(dateBadge(seg.date))}</span></div>${seg.component?`<div class="seg-info-row">Componente: <span>${escapeHtml(componentDisplay(seg.component))}</span></div>`:''}${seg.contact?`<div class="seg-info-row">Contatto: <span>${escapeHtml(seg.contact)}</span></div>`:''}</div>`:'')+renderDispPanel(id)}}
function saveAvailability(id,response){if(!navigator.onLine&&!DEMO_MODE){apiError('Sei offline. Riprova quando la connessione è disponibile.');return}const matches=disponibilita.map((d,i)=>({d,i})).filter(x=>x.d.membro===currentUser&&String(x.d.incontro)===String(id)),idx=matches.length?matches.at(-1).i:-1,old=idx>=0?{...disponibilita[idx]}:null;if(idx>=0)disponibilita[idx].risposta=response;else disponibilita.push({membro:currentUser,incontro:id,risposta:response});updateMeetingState(id);setAvailabilitySaving(id,response,true);apiRequest('salva',{membro:currentUser,incontro:id,risposta:response},resp=>{setAvailabilitySaving(id,response,false);if(!apiSucceeded(resp)){const now=disponibilita.map((d,i)=>({d,i})).filter(x=>x.d.membro===currentUser&&String(x.d.incontro)===String(id)).at(-1)?.i;if(old&&now!==undefined)disponibilita[now]=old;else if(!old&&now!==undefined)disponibilita.splice(now,1);updateMeetingState(id);apiError(resp?.message||'Disponibilità non salvata.');return}stampUpdate('inc-updated');showToast(response==='si'?'Disponibilità salvata: ci sei':'Disponibilità salvata: non puoi')})}
function setAvailabilitySaving(id,response,saving){for(const type of ['yes','no']){const b=$(type==='yes'?'btn-yes-'+id:'btn-no-'+id);if(!b)continue;b.disabled=saving;const activeResponse=type==='yes'?'si':'no';b.innerHTML=saving&&response===activeResponse?'Salvataggio…':icon(type==='yes'?'check':'x')+(type==='yes'?'Ci sono':'Non posso')}}

function openDialog(id,focusSelector){dialogReturnFocus.set(id,document.activeElement);const bg=$(id);bg.classList.add('open');setTimeout(()=>bg.querySelector(focusSelector)?.focus(),20)}
function closeDialog(id){const bg=$(id);bg.classList.remove('open');const prev=dialogReturnFocus.get(id);dialogReturnFocus.delete(id);if(prev&&document.contains(prev))prev.focus()}
function openMeetingModal(inc=null,preselectedSegId=''){editingId=inc?.id||null;$('modal-title').textContent=inc?'Modifica incontro':'Nuovo incontro';$('modal-data').value=inc?isoDate(meetingDate(inc)):'';$('modal-orario').value=inc?.orario||'';$('modal-luogo').value=inc?.luogo||'';$('modal-segnalazione').value=inc?.segnalazioneId||preselectedSegId||'';$('modal-error').classList.remove('visible');$('modal-error').textContent='';openDialog('modal-bg','#modal-data')}
function closeMeetingModal(){setMeetingSaving(false);closeDialog('modal-bg')}
function setMeetingSaving(v){const b=$('btn-salva-incontro');b.disabled=v;b.textContent=v?'Salvataggio…':'Salva'}
function saveMeeting(){if(!navigator.onLine&&!DEMO_MODE){showModalError('Sei offline. Riprova quando la connessione è disponibile.');return}const data=$('modal-data').value,time=$('modal-orario').value,place=$('modal-luogo').value.trim(),segId=$('modal-segnalazione').value;if(!parseDate(data)){showModalError('Inserisci una data valida.');$('modal-data').focus();return}if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){showModalError('Inserisci un orario valido.');$('modal-orario').focus();return}const [h,m]=time.split(':').map(Number);if(m%15||h*60+m<420||h*60+m>1185){showModalError('Scegli un orario tra le 07:00 e le 19:45, a intervalli di 15 minuti.');$('modal-orario').focus();return}showModalError('');setMeetingSaving(true);const editing=!!editingId,params={data,orario:time,luogo:place,segnalazione_id:segId};if(editing)params.id=editingId;apiRequest(editing?'modifica_incontro':'nuovo_incontro',params,resp=>{setMeetingSaving(false);if(!apiSucceeded(resp)){showModalError(resp?.message||'Incontro non salvato. Riprova.');return}closeMeetingModal();showToast(editing?'Modifica salvata':'Incontro salvato');loadIncontri()})}
function showModalError(msg){const el=$('modal-error');el.textContent=msg||'';el.classList.toggle('visible',!!msg)}
function askDeleteMeeting(id){if(!isCoord)return;deletingId=id;openDialog('confirm-bg','#delete-confirm')}
function confirmDeleteMeeting(){if(!isCoord||!deletingId)return;if(!navigator.onLine&&!DEMO_MODE){apiError('Sei offline.');return}const id=deletingId,old=[...incontri];incontri=incontri.filter(i=>String(i.id)!==String(id));delete openPanels[id];closeDeleteMeeting();renderIncontri();apiRequest('elimina_incontro',{id},resp=>{if(!apiSucceeded(resp)){incontri=old;renderIncontri();apiError(resp?.message||'Incontro non eliminato.');return}stampUpdate('inc-updated');showToast('Incontro eliminato')})}
function closeDeleteMeeting(){deletingId=null;closeDialog('confirm-bg')}

function openMembers(){
  if(!isCoord)return;
  $('members-error').classList.remove('visible');$('members-error').textContent='';
  apiRequest('gestione_membri',{},rows=>{
    if(!Array.isArray(rows)){apiError(rows?.message||'Impossibile caricare i membri.');return}
    membersDraft=rows.map(x=>({...x}));
    renderMembers();
    openDialog('modal-impostazioni','.member-editor-name');
  });
}
function closeMembers(){membersDraft=[];closeDialog('modal-impostazioni')}
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
  if(!isCoord)return;
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

function focusTrap(e){if(e.key!=='Tab')return;const bg=[...document.querySelectorAll('.modal-bg.open,.confirm-bg.open')].at(-1);if(!bg)return;const items=[...bg.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}

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
    if(b.dataset.action==='toggle-availability')togglePanel(id);
    else if(b.dataset.action==='availability')saveAvailability(id,b.dataset.response);
    else if(b.dataset.action==='edit-meeting')openMeetingModal(incontri.find(i=>String(i.id)===String(id)));
    else if(b.dataset.action==='delete-meeting')askDeleteMeeting(id);
  });

  $('lista-membri').addEventListener('click',e=>{
    const remove=e.target.closest('[data-member-remove]'),reactivate=e.target.closest('[data-member-reactivate]');
    if(remove)askRemoveMember(Number(remove.dataset.memberRemove));
    else if(reactivate)reactivateMember(Number(reactivate.dataset.memberReactivate));
  });
  $('lista-membri').addEventListener('input',e=>{if(e.target.matches('[data-member-field]'))updateMemberDraftField(e.target)});
  $('lista-membri').addEventListener('change',e=>{if(e.target.matches('[data-member-field]'))updateMemberDraftField(e.target)});

  $('refresh-segnalazioni').addEventListener('click',loadSegnalazioni);
  $('refresh-incontri').addEventListener('click',loadIncontri);
  $('btn-proponi').addEventListener('click',()=>openMeetingModal());
  $('btn-impostazioni').addEventListener('click',openMembers);
  $('btn-logout').addEventListener('click',logout);

  $('mobile-menu-trigger').addEventListener('click',e=>{e.stopPropagation();toggleMobileMenu()});
  $('mobile-btn-impostazioni').addEventListener('click',()=>{closeMobileMenu();openMembers()});
  $('mobile-btn-logout').addEventListener('click',logout);

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

  document.addEventListener('click',e=>{if(!e.target.closest('.mobile-account'))closeMobileMenu()});
  window.addEventListener('online',setNetworkState);
  window.addEventListener('offline',setNetworkState);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeMobileMenu();
      if($('confirm-membro-bg').classList.contains('open'))return cancelRemoveMember();
      if($('confirm-seg-bg').classList.contains('open'))return closeDeleteSeg();
      if($('confirm-bg').classList.contains('open'))return closeDeleteMeeting();
      if($('modal-impostazioni').classList.contains('open'))return closeMembers();
      if($('modal-bg').classList.contains('open'))return closeMeetingModal();
    }
    focusTrap(e);
  });
  for(const id of ['modal-bg','modal-impostazioni'])$(id).addEventListener('click',e=>{if(e.target===e.currentTarget)(id==='modal-bg'?closeMeetingModal:closeMembers)()});
  $('confirm-seg-bg').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDeleteSeg()});

  if(DEMO_MODE){
    currentUser=DEFAULT_MEMBERS[0];currentUserId='demo';currentUserEmail='demo@example.it';isCoord=true;authToken='demo';members=[...DEFAULT_MEMBERS];showMain();
  }else{
    restoreSession();
  }
});
