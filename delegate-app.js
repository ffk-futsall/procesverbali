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
    .dg-screen{min-height:100vh;background:#f2f5f9;padding:24px 16px}
    .dg-container{max-width:850px;margin:auto}.dg-card{background:white;border:1px solid #dbe2ed;border-radius:12px;padding:24px;margin:18px 0}
    .dg-login{max-width:460px;margin:8vh auto}.dg-card h1,.dg-card h2{margin:0 0 8px;color:#102b50}.dg-card p{margin:8px 0;color:#46556a}
    .dg-label{display:block;font-weight:600;margin:16px 0 5px}.dg-input{display:block;width:100%;padding:12px;border:1px solid #aeb9c8;border-radius:8px;font:inherit}
    .dg-button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border:0;border-radius:8px;background:#12345b;color:white;font:600 15px system-ui;cursor:pointer;margin:6px 6px 0 0}
    .dg-button.secondary{background:#eaf0f7;color:#102b50}.dg-button.danger{background:#a52b35}.dg-error{color:#a5222f!important}.dg-status{padding:8px 12px;color:#233c60;font-weight:600}.dg-actions{display:flex;gap:8px;flex-wrap:wrap}.dg-publish{display:flex;gap:10px;align-items:center;padding:12px 16px;border:1px solid #cad6e4;border-radius:8px;background:white;margin:10px 0 16px;color:#14243d;font-weight:700}.dg-publish input{width:20px;height:20px}.dg-publish-note{color:#45576d;font-size:14px}.dg-meta{font-size:14px;color:#536177}.dg-badge{display:inline-block;border-radius:8px;background:#eef4fa;padding:3px 8px;font-weight:700;font-size:13px}.dg-reason{white-space:pre-wrap}.dg-button:focus-visible,.dg-input:focus-visible{outline:3px solid #4c8fdb;outline-offset:2px}
  `;document.head.appendChild(style);
  let assignment=null,version=0,published=false,revision=0,savedRevision=0,sending=false,timer=null,stopped=false;
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function token(){return client.auth.getSession().then(({data})=>data.session?.access_token||'');}
  async function api(method,path='',body){
    const access=await token();if(!access)throw new Error('Sesioni ka përfunduar. Kyçuni përsëri.');
    const res=await fetch(PORTAL+'/api/protocol'+path,{method,headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const out=await res.json().catch(()=>({}));if(!res.ok){const e=new Error(out.error||'Lidhja dështoi.');e.code=out.code;e.status=res.status;throw e;}return out;
  }
  function screen(content){app.style.display='none';root.innerHTML='<main class="dg-screen"><div class="dg-container">'+content+'</div></main>';window.scrollTo(0,0);}
  function showError(e){const el=root.querySelector('[data-error]');if(el)el.textContent=e?.message||String(e);}
  function login(){assignment=null;screen(`<div class="dg-card dg-login"><h1>Procesverbali</h1><p>Kyçja e delegatit</p><form id="dg-login"><label class="dg-label" for="dg-username">Emri i përdoruesit</label><input class="dg-input" id="dg-username" autocomplete="username" required maxlength="40"><label class="dg-label" for="dg-password">Fjalëkalimi</label><input class="dg-input" id="dg-password" type="password" autocomplete="current-password" required><p class="dg-error" data-error role="alert"></p><button class="dg-button">Kyçu</button></form></div>`);
    root.querySelector('#dg-login').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const username=root.querySelector('#dg-username').value.trim().toLowerCase();const password=root.querySelector('#dg-password').value;if(!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(username))throw new Error('Të dhënat e kyçjes nuk janë të sakta.');const result=await client.auth.signInWithPassword({email:'urim.ffkfutsall+delegat-'+username+'@gmail.com',password});if(result.error)throw new Error('Të dhënat e kyçjes nuk janë të sakta.');await dashboard();}catch(err){showError(err)}finally{button.disabled=false}});
  }
  function changePassword(){screen(`<div class="dg-card dg-login"><h1>Ndryshoni fjalëkalimin</h1><p>Për siguri, vendosni një fjalëkalim të ri para përdorimit të procesverbalit.</p><form id="dg-change"><label class="dg-label" for="dg-new">Fjalëkalimi i ri (të paktën 6 karaktere)</label><input id="dg-new" class="dg-input" type="password" minlength="6" maxlength="128" autocomplete="new-password" required><label class="dg-label" for="dg-confirm">Përsëriteni fjalëkalimin</label><input id="dg-confirm" class="dg-input" type="password" minlength="6" maxlength="128" autocomplete="new-password" required><p class="dg-error" data-error role="alert"></p><button class="dg-button">Ndrysho fjalëkalimin</button></form><button class="dg-button secondary" id="dg-logout">Dil</button></div>`);
    root.querySelector('#dg-logout').onclick=logout;root.querySelector('#dg-change').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{const pw=root.querySelector('#dg-new').value;if(pw!==root.querySelector('#dg-confirm').value)throw new Error('Fjalëkalimet nuk përputhen.');await api('POST','',{action:'change-password',password:pw});await client.auth.signOut();login();const notice=root.querySelector('[data-error]');notice.textContent='Fjalëkalimi u ndryshua. Kyçuni me fjalëkalimin e ri.';notice.classList.remove('dg-error');}catch(err){showError(err)}finally{b.disabled=false}};
  }
  async function logout(){if(assignment && revision!==savedRevision){alert('Ka ndryshime të paruajtura. Provoni t’i ruani para daljes.');return;}await client.auth.signOut();login();}
  async function dashboard(){
    try{const result=await api('GET');assignment=null;const rows=result.assignments||[];screen(`<div class="dg-card"><div class="dg-actions" style="justify-content:space-between"><div><h1>Ndeshjet e mia</h1><p>${escapeHtml(result.delegate.first_name)} ${escapeHtml(result.delegate.last_name)} · ${escapeHtml(result.delegate.city)}</p></div><button id="dg-logout" class="dg-button secondary">Dil</button></div><p class="dg-error" data-error role="alert"></p></div>${rows.length?'':'<div class="dg-card"><p>Nuk keni ndeshje të caktuara.</p></div>'}${rows.map(a=>`<article class="dg-card"><span class="dg-badge">${{pending:'Në pritje',accepted:'Pranuar',rejected:'Refuzuar'}[a.state]||''}</span><h2>${escapeHtml(a.match_details.home)} – ${escapeHtml(a.match_details.away)}</h2><p class="dg-meta">${[a.match_details.competition,a.match_details.date,a.match_details.time,a.match_details.venue].filter(Boolean).map(escapeHtml).join(' · ')}</p>${a.rejection_reason?`<p class="dg-reason">Arsyeja: ${escapeHtml(a.rejection_reason)}</p>`:''}${a.state==='pending'?`<div class="dg-actions"><button class="dg-button" data-accept="${escapeHtml(a.id)}">Prano ndeshjen</button><button class="dg-button danger" data-reject="${escapeHtml(a.id)}">Refuzo</button></div>`:a.state==='accepted'?`<button class="dg-button" data-open="${escapeHtml(a.id)}">Hap procesverbalin</button>`:''}</article>`).join('')}`);
      root.querySelector('#dg-logout').onclick=logout;root.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('POST','',{action:'respond',id:b.dataset.accept,state:'accepted'});await openAssignment(b.dataset.accept)}catch(e){showError(e);b.disabled=false}});root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openAssignment(b.dataset.open).catch(showError));root.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>rejectForm(b.dataset.reject));
    }catch(e){if(e.code==='PASSWORD_CHANGE_REQUIRED')return changePassword();screen('<div class="dg-card"><h1>Ndeshjet e mia</h1><p class="dg-error" data-error role="alert"></p><button class="dg-button secondary" id="dg-retry">Provo përsëri</button><button class="dg-button secondary" id="dg-out">Dil</button></div>');showError(e);root.querySelector('#dg-retry').onclick=dashboard;root.querySelector('#dg-out').onclick=logout;}
  }
  function rejectForm(id){screen(`<div class="dg-card"><h1>Refuzo ndeshjen</h1><form id="dg-reject"><label class="dg-label" for="dg-reason">Arsyeja e refuzimit</label><textarea id="dg-reason" class="dg-input" rows="4" maxlength="1000" required></textarea><p class="dg-error" data-error role="alert"></p><button class="dg-button danger">Konfirmo refuzimin</button><button type="button" class="dg-button secondary" id="dg-cancel">Anulo</button></form></div>`);root.querySelector('#dg-cancel').onclick=dashboard;root.querySelector('#dg-reject').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{const reason=root.querySelector('#dg-reason').value.trim();if(!reason)throw new Error('Shkruani arsyen.');await api('POST','',{action:'respond',id,state:'rejected',reason});await dashboard()}catch(err){showError(err);button.disabled=false}};}
  function backupKey(){return 'ffk-protocol-backup-'+assignment.id}
  function saveBackup(){try{localStorage.setItem(backupKey(),JSON.stringify({version,draft:data,published}));}catch{}}
  function status(message,bad=false){const el=document.getElementById('dg-save-status');if(el){el.textContent=message;el.classList.toggle('dg-error',bad)}}
  async function flush(){
    if(!assignment||sending||stopped||revision===savedRevision)return;
    sending=true;const sentRevision=revision, sentDraft=JSON.parse(JSON.stringify(data)), sentPublished=published;status('Duke ruajtur…');
    try{const out=await api('PUT','',{id:assignment.id,version,draft:sentDraft,published:sentPublished});version=out.assignment.draft_version;savedRevision=sentRevision;if(revision===savedRevision){localStorage.removeItem(backupKey());status('Ruajtur në server');}else{saveBackup();status('Duke ruajtur ndryshimet…');}}
    catch(e){stopped=true;saveBackup();status(e.status===409?'Konflikt ruajtjeje: ndryshimet lokale nuk u mbishkruan. Shkarkoni kopjen dhe kontaktoni administratorin.':'Ruajtja dështoi. Ndryshimet mbeten në këtë pajisje; provoni përsëri.',true);}
    finally{sending=false;if(!stopped&&revision!==savedRevision){clearTimeout(timer);timer=setTimeout(flush,200)}}
  }
  const priorPersist=persist;
  persist=function(){if(!assignment)return;priorPersist();revision++;saveBackup();status('Në pritje të ruajtjes…');clearTimeout(timer);timer=setTimeout(flush,600);};
  const oldRenderLive=renderLive,oldRenderWizard=renderWizard;
  function decorate(){
    app.querySelectorAll('[data-action="open-registry"],[data-action="new-match"],[data-action="reset-protocol"],[data-action="app-logout"],#saveState,.topbar .who').forEach(x=>x.remove());
    const host=app.querySelector('main');if(!host||!assignment)return;
    const tools=document.createElement('div');tools.className='dg-actions';tools.innerHTML='<button type="button" class="dg-button secondary" id="dg-back">Ndeshjet e mia</button><button type="button" class="dg-button secondary" id="dg-retry-save">Ruaj përsëri</button><button type="button" class="dg-button secondary" id="dg-download">Shkarko kopjen</button><span class="dg-status" id="dg-save-status" role="status"></span>';host.prepend(tools);
    tools.querySelector('#dg-back').onclick=async()=>{clearTimeout(timer);await flush();if(sending||revision!==savedRevision){alert('Ka ndryshime të paruajtura. Ruajini para se të largoheni.');return;}await dashboard();};
    tools.querySelector('#dg-retry-save').onclick=()=>{if(stopped){stopped=false}flush()};
    tools.querySelector('#dg-download').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='procesverbali-'+assignment.id+'.json';a.click();URL.revokeObjectURL(url);};status(revision===savedRevision?'Ruajtur në server':stopped?'Ndryshimet nuk janë ruajtur në server.':'Në pritje të ruajtjes…',stopped);
    if(currentView==='live'){const box=document.createElement('label');box.className='dg-publish';box.innerHTML=`<input id="dg-publish" type="checkbox" ${published?'checked':''}><span>Shfaq këtë ndeshje live në Portal<span class="dg-publish-note" style="display:block">Publikohen vetëm të dhënat e ndeshjes, jo numrat personalë ose nënshkrimet.</span></span>`;tools.after(box);box.querySelector('input').onchange=e=>{published=e.target.checked;persist()};}
  }
  renderWizard=function(){oldRenderWizard.apply(this,arguments);decorate()};renderLive=function(){oldRenderLive.apply(this,arguments);decorate()};
  const oldAction=action;action=function(name,button){if(name==='new-match'||name==='reset-protocol'||name==='open-registry'||name==='app-logout')return;if(name==='final-save'){persist();toast('Procesverbali po ruhet.');return}return oldAction(name,button)};
  async function openAssignment(id){
    const out=await api('GET','?id='+encodeURIComponent(id));const a=out.assignment;if(a.state!=='accepted')throw new Error('Ndeshja duhet të pranohet.');
    assignment=a;version=a.draft_version;published=a.published;revision=0;savedRevision=0;stopped=false;clearTimeout(timer);
    SESSION_KEY='ffk-session-'+a.id;OLD_SESSION_KEY='ffk-old-'+a.id;SAVED_KEY='ffk-saved-'+a.id;
    data=mergeData(a.draft);if(!a.draft){const m=a.match_details;data.teams.a.name=m.home||'';data.teams.b.name=m.away||'';data.matchDate=m.date||'';data.startTime=m.time||'';data.venue=m.venue||'';data.round=String(m.round||'');data.competition=(COMPETITIONS.find(c=>String(m.competition||'').toLowerCase().includes(c.toLowerCase()))||'');}
    const recovery=localStorage.getItem(backupKey());if(recovery){try{const b=JSON.parse(recovery);if(b.version===version&&confirm('U gjetën ndryshime lokale të paruajtura për këtë ndeshje. T’i rikuperojmë?')){data=mergeData(b.draft);published=!!b.published;revision++;}else if(b.version!==version){alert('Ekziston një kopje lokale me version tjetër. Kontaktoni administratorin para se të vazhdoni.');assignment=null;return dashboard()}}catch{}}
    root.innerHTML='';app.style.display='block';step=1;if(['first','halftime','second','after_second','extra','after_extra','penalties','finished'].includes(data.phase))renderLive();else renderWizard();if(!a.draft && revision===savedRevision){revision++;saveBackup();}if(revision!==savedRevision)flush();window.scrollTo(0,0);
  }
  window.addEventListener('beforeunload',e=>{if(assignment&&revision!==savedRevision){e.preventDefault();e.returnValue='';}});
  client.auth.getSession().then(({data:s})=>s.session?dashboard():login()).catch(login);
})();
