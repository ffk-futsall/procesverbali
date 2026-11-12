/* Delegate application: authentication and per-assignment reports.
 * Only the server-authorized delegate may read or write an assignment. */
(() => {
  'use strict';
  const PORTAL='https://sports-stats-live-eta.vercel.app';
  const SUPABASE_URL='https://eglrcqyqsjbajfqzcfec.supabase.co';
  const PUBLIC_KEY='sb_publishable_J7nixSwCleuiJI4ULWfWzQ_i_dwnK7B';
  const client=window.supabase.createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true}});
  const root=document.createElement('div');root.id='delegate-shell';document.body.prepend(root);
  const style=document.createElement('style');style.textContent=`
    #delegate-shell{font:16px/1.5 system-ui,sans-serif;color:#17243a}
    #tlb{display:none!important}
    .dg-columns{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start}.dg-columns .dg-card{margin:0 0 16px}.dg-filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.dg-filters button[aria-pressed="true"]{background:#12345b;color:white}.dg-empty{color:#536177}.dg-week{font-size:13px;color:#536177}.dg-password-overlay{position:fixed;inset:0;z-index:99999;background:#0f172ab3;display:grid;place-items:center;padding:16px}.dg-password-box{width:min(100%,430px);background:white;border-radius:12px;padding:24px;box-shadow:0 15px 40px #0004}.dg-password-box h2{margin:0 0 10px}.dg-password-box input{box-sizing:border-box}@media(max-width:700px){.dg-columns{grid-template-columns:1fr}.dg-next{grid-row:1}}
    .dg-screen{min-height:100vh;background:#f2f5f9;padding:24px 16px}
    .dg-container{max-width:850px;margin:auto}.dg-card{background:white;border:1px solid #dbe2ed;border-radius:12px;padding:24px;margin:18px 0}
    .dg-login{max-width:460px;margin:8vh auto}.dg-card h1,.dg-card h2{margin:0 0 8px;color:#102b50}.dg-card p{margin:8px 0;color:#46556a}
    .dg-label{display:block;font-weight:600;margin:16px 0 5px}.dg-input{display:block;width:100%;padding:12px;border:1px solid #aeb9c8;border-radius:8px;font:inherit}
    .dg-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border:0;border-radius:8px;background:#12345b;color:white;font:600 15px system-ui;cursor:pointer;margin:6px 6px 0 0}
    .dg-button.secondary{background:#eaf0f7;color:#102b50}.dg-button.danger{background:#a52b35}.dg-error{color:#a5222f!important}.dg-status{padding:8px 12px;color:#233c60;font-weight:600}.dg-actions{display:flex;gap:8px;flex-wrap:wrap}.dg-publish{display:flex;gap:10px;align-items:center;padding:12px 16px;border:1px solid #cad6e4;border-radius:8px;background:white;margin:10px 0 16px;color:#14243d;font-weight:700}.dg-publish input{width:20px;height:20px}.dg-publish-note{color:#45576d;font-size:14px}.dg-meta{font-size:14px;color:#536177}.dg-badge{display:inline-block;border-radius:8px;background:#eef4fa;padding:3px 8px;font-weight:700;font-size:13px}.dg-reason{white-space:pre-wrap}.dg-button:focus-visible,.dg-input:focus-visible{outline:3px solid #4c8fdb;outline-offset:2px}
  `;document.head.appendChild(style);
  let assignment=null,version=0,published=false,revision=0,savedRevision=0,sending=false,timer=null,stopped=false,publicationBlocked=false,accessTimer=null,editPassword='',dashboardFilter='upcoming';
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function token(){return client.auth.getSession().then(({data})=>data.session?.access_token||'');}
  async function api(method,path='',body){
    const access=await token();if(!access)throw new Error('Sesioni ka përfunduar. Kyçuni përsëri.');
    const res=await fetch(PORTAL+'/api/protocol'+path,{method,headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const out=await res.json().catch(()=>({}));if(!res.ok){const e=new Error(out.error||'Lidhja dështoi.');e.code=out.code;e.status=res.status;throw e;}return out;
  }
  function screen(content){app.style.display='none';root.innerHTML='<main class="dg-screen"><div class="dg-container">'+content+'</div></main>';window.scrollTo(0,0);}
  function showError(e){const el=root.querySelector('[data-error]');if(el)el.textContent=e?.message||String(e);}
  function login(){clearInterval(accessTimer);assignment=null;screen(`<div class="dg-card dg-login"><h1>Procesverbali</h1><p>Kyçja e delegatit</p><form id="dg-login"><label class="dg-label" for="dg-username">Emri i përdoruesit</label><input class="dg-input" id="dg-username" autocomplete="username" required maxlength="40"><label class="dg-label" for="dg-password">Fjalëkalimi</label><input class="dg-input" id="dg-password" type="password" autocomplete="current-password" required><p class="dg-error" data-error role="alert"></p><button class="dg-button">Kyçu</button></form></div>`);
    root.querySelector('#dg-login').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const username=root.querySelector('#dg-username').value.trim().toLowerCase();const password=root.querySelector('#dg-password').value;if(!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(username))throw new Error('Të dhënat e kyçjes nuk janë të sakta.');const result=await client.auth.signInWithPassword({email:'urim.ffkfutsall+delegat-'+username+'@gmail.com',password});if(result.error)throw new Error('Të dhënat e kyçjes nuk janë të sakta.');await dashboard();}catch(err){showError(err)}finally{button.disabled=false}});
  }
  function changePassword(){screen(`<div class="dg-card dg-login"><h1>Ndryshoni fjalëkalimin</h1><p>Për siguri, vendosni një fjalëkalim të ri para përdorimit të procesverbalit.</p><form id="dg-change"><label class="dg-label" for="dg-new">Fjalëkalimi i ri (të paktën 6 karaktere)</label><input id="dg-new" class="dg-input" type="password" minlength="6" maxlength="128" autocomplete="new-password" required><label class="dg-label" for="dg-confirm">Përsëriteni fjalëkalimin</label><input id="dg-confirm" class="dg-input" type="password" minlength="6" maxlength="128" autocomplete="new-password" required><p class="dg-error" data-error role="alert"></p><button class="dg-button">Ndrysho fjalëkalimin</button></form><button class="dg-button secondary" id="dg-logout">Dil</button></div>`);
    root.querySelector('#dg-logout').onclick=logout;root.querySelector('#dg-change').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{const pw=root.querySelector('#dg-new').value;if(pw!==root.querySelector('#dg-confirm').value)throw new Error('Fjalëkalimet nuk përputhen.');await api('POST','',{action:'change-password',password:pw});await client.auth.signOut();login();const notice=root.querySelector('[data-error]');notice.textContent='Fjalëkalimi u ndryshua. Kyçuni me fjalëkalimin e ri.';notice.classList.remove('dg-error');}catch(err){showError(err)}finally{b.disabled=false}};
  }
  async function logout(){if(assignment && revision!==savedRevision){alert('Ka ndryshime të paruajtura. Provoni t’i ruani para daljes.');return;}await client.auth.signOut();login();}
  function matchCard(a,heading=''){
    const m=a.match_details||{},label=a.phase==='finished'?'Përfunduar':a.phase&&a.phase!=='setup'?'Në zhvillim':({pending:'Në pritje',accepted:'Pranuar',rejected:'Refuzuar'}[a.state]||'');
    return `<article class="dg-card">${heading?`<h2>${heading}</h2>`:''}<span class="dg-badge">${label}</span><h2>${escapeHtml(m.home)} – ${escapeHtml(m.away)}</h2><p class="dg-meta">${[m.competition,m.round?'Java '+m.round:'',m.date,m.time,m.venue].filter(Boolean).map(escapeHtml).join(' · ')}</p>${a.rejection_reason?`<p class="dg-reason">Arsyeja: ${escapeHtml(a.rejection_reason)}</p>`:''}${a.state==='pending'?`<div class="dg-actions"><button class="dg-button" data-accept="${escapeHtml(a.id)}">Prano ndeshjen</button><button class="dg-button danger" data-reject="${escapeHtml(a.id)}">Refuzo</button></div>`:a.state==='accepted'?`<button class="dg-button" data-open="${escapeHtml(a.id)}">Hap procesverbalin</button>`:''}</article>`;
  }
  async function dashboard(){
    clearInterval(accessTimer);
    try{
      const result=await api('GET');assignment=null;editPassword='';const rows=result.assignments||[];
      const sortKey=a=>`${a.match_details?.date||'9999-99-99'}T${a.match_details?.time||'23:59'}`;
      const upcoming=rows.filter(a=>a.state!=='rejected' && a.phase!=='finished').sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
      const today=new Date();const localDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
      const next=upcoming.find(a=>a.phase&&a.phase!=='setup')||upcoming.find(a=>!a.match_details?.date||a.match_details.date>=localDate);
      const filtered=dashboardFilter==='completed'?rows.filter(a=>a.phase==='finished'):dashboardFilter==='all'?rows:upcoming;
      screen(`<div class="dg-card"><div class="dg-actions" style="justify-content:space-between"><div><h1>Ndeshjet e mia</h1><p>${escapeHtml(result.delegate.first_name)} ${escapeHtml(result.delegate.last_name)} · ${escapeHtml(result.delegate.city)}</p></div><button id="dg-logout" class="dg-button secondary">Dil nga llogaria</button></div><p class="dg-error" data-error role="alert"></p></div><div class="dg-columns"><section><h2>Ndeshjet e mia</h2><nav class="dg-filters" aria-label="Filtro ndeshjet">${[['upcoming','Të ardhshme'],['completed','Të përfunduara'],['all','Të gjitha']].map(([key,label])=>`<button class="dg-button secondary" data-filter="${key}" aria-pressed="${dashboardFilter===key}">${label}</button>`).join('')}</nav>${filtered.length?filtered.map(a=>matchCard(a)).join(''):'<div class="dg-card dg-empty">Nuk ka ndeshje për këtë filtër.</div>'}</section><aside class="dg-next">${next?matchCard(next,'Ndeshja e ardhshme / në zhvillim'):'<div class="dg-card"><h2>Ndeshja e ardhshme</h2><p>Nuk ka ndeshje të ardhshme të caktuar.</p></div>'}</aside></div>`);
      root.querySelector('#dg-logout').onclick=logout;
      root.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{dashboardFilter=b.dataset.filter;dashboard()});
      root.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('POST','',{action:'respond',id:b.dataset.accept,state:'accepted'});await openAssignment(b.dataset.accept)}catch(e){showError(e);b.disabled=false}});
      root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openAssignment(b.dataset.open).catch(showError));root.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>rejectForm(b.dataset.reject));
    }catch(e){if(e.code==='PASSWORD_CHANGE_REQUIRED')return changePassword();screen('<div class="dg-card"><h1>Ndeshjet e mia</h1><p class="dg-error" data-error role="alert"></p><button class="dg-button secondary" id="dg-retry">Provo përsëri</button><button class="dg-button secondary" id="dg-out">Dil nga llogaria</button></div>');showError(e);root.querySelector('#dg-retry').onclick=dashboard;root.querySelector('#dg-out').onclick=logout;}
  }
  function rejectForm(id){screen(`<div class="dg-card"><h1>Refuzo ndeshjen</h1><form id="dg-reject"><label class="dg-label" for="dg-reason">Arsyeja e refuzimit</label><textarea id="dg-reason" class="dg-input" rows="4" maxlength="1000" required></textarea><p class="dg-error" data-error role="alert"></p><button class="dg-button danger">Konfirmo refuzimin</button><button type="button" class="dg-button secondary" id="dg-cancel">Anulo</button></form></div>`);root.querySelector('#dg-cancel').onclick=dashboard;root.querySelector('#dg-reject').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const reason=root.querySelector('#dg-reason').value.trim();if(!reason)throw new Error('Shkruani arsyen.');await api('POST','',{action:'respond',id,state:'rejected',reason});await dashboard()}catch(err){showError(err);button.disabled=false}};}
  function backupKey(){return 'ffk-protocol-backup-'+assignment.id}
  function saveBackup(){try{localStorage.setItem(backupKey(),JSON.stringify({version,draft:data,published}));}catch{}}
  function status(message,bad=false){const el=document.getElementById('dg-save-status');if(el){el.textContent=message;el.classList.toggle('dg-error',bad)}}
  async function flush(){
    if(!assignment||sending||stopped||revision===savedRevision)return;
    sending=true;const sentRevision=revision, sentDraft=JSON.parse(JSON.stringify(data)), sentPublished=published;status('Duke ruajtur…');
    try{const out=await api('PUT','',{id:assignment.id,version,draft:sentDraft,published:sentPublished,...(editPassword?{editPassword}:{})});version=out.assignment.draft_version;if(out.assignment.publication_blocked===true){publicationBlocked=true;published=false;updatePublicationUI()}savedRevision=sentRevision;if(revision===savedRevision){localStorage.removeItem(backupKey());status('Ruajtur në server');}else{saveBackup();status('Duke ruajtur ndryshimet…');}}
    catch(e){stopped=true;saveBackup();status(e.status===409?'Konflikt ruajtjeje: ndryshimet lokale nuk u mbishkruan. Shkarkoni kopjen dhe kontaktoni administratorin.':'Ruajtja dështoi. Ndryshimet mbeten në këtë pajisje; provoni përsëri.',true);}
    finally{sending=false;if(!stopped&&revision!==savedRevision){clearTimeout(timer);timer=setTimeout(flush,200)}}
  }
  const priorPersist=persist;
  persist=function(){if(!assignment)return;priorPersist();revision++;saveBackup();status('Në pritje të ruajtjes…');clearTimeout(timer);timer=setTimeout(flush,600);};
  const originalReportModal=window.__reopenExport;let reportMode='send';
  function openReport(mode){
    reportMode=mode;
    if(typeof originalReportModal!=='function'){toast('Eksporti PDF nuk është i disponueshëm.',true);return;}
    originalReportModal();
    const modal=document.getElementById('pdfModal');if(!modal)return;
    modal.querySelector('#pdfTitle').textContent='Raporti i ndeshjes';
    const send=modal.querySelector('[data-pdf="send"]'),save=modal.querySelector('[data-pdf="download"]');
    if(send)send.textContent='Dërgo raportin';if(save)save.textContent='Ruaj raportin (PDF)';
    const hint=modal.querySelector('.pdf-sub');if(hint)hint.textContent='Raporti mund të përmbajë të dhëna personale dhe nënshkrime. Ndajeni vetëm me personat e autorizuar. Menyja e ndarjes varet nga pajisja dhe aplikacionet e instaluara.';
    let canShareFiles=false;
    try{canShareFiles=!!navigator.share&&(!navigator.canShare||navigator.canShare({files:[new File(['test'],'raport.pdf',{type:'application/pdf'})]}))}catch{}
    if(send&&!canShareFiles){
      send.addEventListener('click',e=>{e.stopPropagation();const msg=modal.querySelector('#pdfMsg');if(msg)msg.textContent='Kjo pajisje nuk mbështet ndarjen direkte të PDF-së. Ruajeni raportin dhe bashkëngjiteni në Viber, WhatsApp, Messenger ose email.'},true);
    }
    const title=modal.querySelector('#pdfTitle');if(title)title.textContent=mode==='send'?'Dërgo raportin':'Ruaj raportin';
  }
  window.__reopenExport=()=>openReport(reportMode);
  const oldRenderLive=renderLive,oldRenderWizard=renderWizard;
  function updatePublicationUI(){const box=document.getElementById('dg-publish'),note=document.getElementById('dg-publish-note');if(box){box.disabled=publicationBlocked;box.checked=published&&!publicationBlocked}if(note)note.textContent=publicationBlocked?'Administratori ka ndaluar publikimin në portal. Procesverbali vazhdon të ruhet.':'Publikohen vetëm të dhënat e ndeshjes, jo numrat personalë ose nënshkrimet.';}
  async function checkAccess(){if(!assignment)return;const id=assignment.id;try{const result=await api('GET');if(!assignment||assignment.id!==id)return;const current=(result.assignments||[]).find(x=>x.id===id&&x.state==='accepted');if(!current){stopped=true;saveBackup();clearInterval(accessTimer);status('Caktimi nuk është më i disponueshëm. Shkarkoni kopjen lokale dhe kontaktoni administratorin.',true);return}publicationBlocked=current.publication_blocked===true;if(publicationBlocked)published=false;updatePublicationUI()}catch{/* offline: do not change local work */}}
  function decorate(){
    app.querySelectorAll('[data-action="open-registry"],[data-action="new-match"],[data-action="reset-protocol"],[data-action="app-logout"],#saveState,.topbar .who').forEach(x=>x.remove());
    const host=app.querySelector('main');if(!host||!assignment)return;
    const tools=document.createElement('div');tools.className='dg-actions';tools.innerHTML='<button type="button" class="dg-button secondary" id="dg-back">Dil</button><button type="button" class="dg-button secondary" id="dg-retry-save">Ruaj përsëri</button><button type="button" class="dg-button secondary" id="dg-download">Shkarko kopjen</button><button type="button" class="dg-button secondary" id="dg-report-share">Dërgo raportin</button><button type="button" class="dg-button secondary" id="dg-report-save">Ruaj raportin (PDF)</button><span class="dg-status" id="dg-save-status" role="status"></span>';host.prepend(tools);
    tools.querySelector('#dg-back').onclick=async()=>{const button=tools.querySelector('#dg-back');button.disabled=true;clearTimeout(timer);if(saveTimer){clearTimeout(saveTimer);saveTimer=null;persist();clearTimeout(timer);}try{const limit=Date.now()+20000;while(sending||revision!==savedRevision){if(stopped)throw new Error('Ndryshimet nuk janë ruajtur. Provoni përsëri ose shkarkoni kopjen para daljes.');if(!sending)await flush();else await new Promise(resolve=>setTimeout(resolve,100));if(Date.now()>limit)throw new Error('Ruajtja po vonon. Provoni përsëri para daljes.');}dashboardFilter='upcoming';await dashboard();}catch(e){alert(e.message);button.disabled=false;}};
    tools.querySelector('#dg-retry-save').onclick=()=>{if(stopped){stopped=false}flush()};
    tools.querySelector('#dg-report-share').onclick=()=>openReport('send');tools.querySelector('#dg-report-save').onclick=()=>openReport('save');
    tools.querySelector('#dg-download').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='procesverbali-'+assignment.id+'.json';a.click();URL.revokeObjectURL(url);};status(revision===savedRevision?'Ruajtur në server':stopped?'Ndryshimet nuk janë ruajtur në server.':'Në pritje të ruajtjes…',stopped);
    if(currentView==='live'){const box=document.createElement('label');box.className='dg-publish';box.innerHTML=`<input id="dg-publish" type="checkbox" ${publicationBlocked?'disabled':''} ${published&&!publicationBlocked?'checked':''}><span>Shfaq këtë ndeshje live në Portal<span id="dg-publish-note" class="dg-publish-note" style="display:block"></span></span>`;tools.after(box);box.querySelector('input').onchange=e=>{published=e.target.checked;persist()};updatePublicationUI();}
  }
  renderWizard=function(){oldRenderWizard.apply(this,arguments);decorate()};renderLive=function(){oldRenderLive.apply(this,arguments);decorate()};
  function requestEdit(button){
    if(!assignment)return;const assignmentId=assignment.id;let overlay=document.createElement('div');overlay.className='dg-password-overlay';overlay.innerHTML=`<form class="dg-password-box" role="dialog" aria-modal="true" aria-labelledby="dg-edit-title"><h2 id="dg-edit-title">Edito ndeshjen</h2><label class="dg-label" for="dg-edit-password">Fjalëkalimi i javës</label><input class="dg-input" id="dg-edit-password" type="password" autocomplete="off" required><p class="dg-error" role="alert"></p><div class="dg-actions"><button type="submit" class="dg-button">Vazhdo</button><button type="button" class="dg-button secondary" data-cancel>Anulo</button></div></form>`;document.body.appendChild(overlay);const form=overlay.querySelector('form'),input=overlay.querySelector('input');input.focus();const close=()=>{overlay.remove();button?.focus()};overlay.querySelector('[data-cancel]').onclick=close;overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close()});form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;try{const password=input.value;await api('POST','',{action:'verify-edit',id:assignmentId,password});if(!assignment||assignment.id!==assignmentId){close();return;}editPassword=password;close();oldAction('edit-match',button);}catch(err){form.querySelector('[role="alert"]').textContent=err.message;input.value='';input.focus();}finally{submit.disabled=false}};
  }
  const oldAction=action;action=function(name,button){if(name==='new-match'||name==='reset-protocol'||name==='open-registry'||name==='app-logout')return;if(name==='edit-match'){requestEdit(button);return}if(name==='enter-live'){if(!validateBeforePreview())return;data._editLocked=true;}if(name==='final-save'){persist();toast('Procesverbali po ruhet.');return}return oldAction(name,button)};
  async function openAssignment(id){
    const out=await api('GET','?id='+encodeURIComponent(id));const a=out.assignment;if(a.state!=='accepted')throw new Error('Ndeshja duhet të pranohet.');
    assignment=a;editPassword='';editMode=false;version=a.draft_version;publicationBlocked=a.publication_blocked===true;published=a.published&&!publicationBlocked;revision=0;savedRevision=0;stopped=false;clearTimeout(timer);
    SESSION_KEY='ffk-session-'+a.id;OLD_SESSION_KEY='ffk-old-'+a.id;SAVED_KEY='ffk-saved-'+a.id;
    data=mergeData(a.draft);if(!a.draft){const m=a.match_details;data.teams.a.name=m.home||'';data.teams.b.name=m.away||'';data.matchDate=m.date||'';data.startTime=m.time||'';data.venue=m.venue||'';data.round=String(m.round||'');data.competition=(COMPETITIONS.find(c=>String(m.competition||'').toLowerCase().includes(c.toLowerCase()))||'');}
    const recovery=localStorage.getItem(backupKey());if(recovery){try{const b=JSON.parse(recovery);if(b.version===version&&confirm('U gjetën ndryshime lokale të paruajtura për këtë ndeshje. T’i rikuperojmë?')){data=mergeData(b.draft);published=!!b.published&&!publicationBlocked;revision++;}else if(b.version!==version){alert('Ekziston një kopje lokale me version tjetër. Kontaktoni administratorin para se të vazhdoni.');assignment=null;return dashboard()}}catch{}}
    root.innerHTML='';app.style.display='block';step=1;if(data._editLocked||['first','halftime','second','after_second','extra','after_extra','penalties','finished'].includes(data.phase))renderLive();else renderWizard();if(!a.draft && revision===savedRevision){revision++;saveBackup();}if(revision!==savedRevision)flush();clearInterval(accessTimer);accessTimer=setInterval(checkAccess,15000);window.scrollTo(0,0);
  }
  window.addEventListener('beforeunload',e=>{if(assignment&&revision!==savedRevision){e.preventDefault();e.returnValue='';}});
  client.auth.getSession().then(({data:s})=>s.session?dashboard():login()).catch(login);
})();
