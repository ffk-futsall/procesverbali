/* Portali i skuadrave: kyçja e përfaqësuesit (me kod verifikimi), lojtarët, zyrtarët, fanellat dhe lista e ndeshjes.
 * Të dhënat vijnë nga TeamCore (adapter Portal ose DEMO). Hapni faqen me #demo për modin demo. */
(() => {
  'use strict';
  const Core = window.TeamCore;
  if (!Core) return;
  const PORTAL = 'https://sports-stats-live.urim-ffkfutsall.workers.dev';
  const TOKEN_KEY = 'ffk-team-session';
  const { KIT_SETS, LIMITS } = Core;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shell = document.createElement('div'); shell.id = 'team-shell'; document.body.prepend(shell);
  const style = document.createElement('style');
  style.textContent = `
  #team-shell{font:16px/1.5 system-ui,sans-serif;color:#17243a}
  .tm-screen{min-height:100vh;background:#f2f5f9;padding:20px 14px}.tm-wrap{max-width:1000px;margin:auto}
  .tm-card{background:#fff;border:1px solid #dbe2ed;border-radius:12px;padding:20px;margin:0 0 16px}
  .tm-login{max-width:460px;margin:6vh auto}.tm-card h1,.tm-card h2,.tm-card h3{margin:0 0 8px;color:#102b50}.tm-card p{margin:6px 0;color:#46556a}
  .tm-label{display:block;font-weight:600;margin:14px 0 5px}.tm-input{display:block;width:100%;box-sizing:border-box;padding:11px;border:1px solid #aeb9c8;border-radius:8px;font:inherit;background:#fff}
  .tm-btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 16px;border:0;border-radius:8px;background:#12345b;color:#fff;font:600 15px system-ui;cursor:pointer;margin:6px 6px 0 0}
  .tm-btn.sec{background:#eaf0f7;color:#102b50}.tm-btn.danger{background:#a52b35}.tm-btn.sm{min-height:34px;padding:5px 12px;font-size:14px;margin:0}.tm-btn:disabled{opacity:.55;cursor:not-allowed}
  .tm-err{color:#a5222f!important;min-height:1.4em}.tm-ok{color:#16794c!important}.tm-meta{font-size:14px;color:#536177}
  .tm-seg{display:flex;gap:6px;margin:0 0 14px}.tm-seg .tm-btn{flex:1;margin:0}.tm-seg [aria-pressed="true"]{background:#12345b;color:#fff}
  .tm-demo{background:#fff7e0;border:1px solid #f0cf72;border-radius:8px;padding:10px 12px;font-size:14px;color:#5b4300;margin:0 0 14px}.tm-demo b{font-size:20px;letter-spacing:3px}
  .tm-head{display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap}.tm-head h1{font-size:22px}
  .tm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}.tm-tabs button{border:2px solid #12345b;background:#fff;color:#12345b;border-radius:10px;padding:8px 14px;font:700 14px system-ui;cursor:pointer}.tm-tabs button[aria-current="page"]{background:#12345b;color:#fff}
  .tm-table-wrap{overflow-x:auto}.tm-table{width:100%;border-collapse:collapse;min-width:560px}.tm-table th{text-align:left;font-size:13px;color:#536177;padding:6px 4px}.tm-table td{padding:4px}.tm-table .tm-input{padding:8px}
  .tm-table .tm-no{width:84px}.tm-table .tm-narrow{width:60px;text-align:center}.tm-dup{border-color:#a5222f;background:#fff1f2}.tm-empty{color:#536177;padding:14px 4px}
  .tm-kits{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.tm-kit{border:1px solid #dbe2ed;border-radius:10px;padding:12px}.tm-kit h3{font-size:16px}
  .tm-row{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.tm-badge{display:inline-block;border-radius:8px;background:#eef4fa;padding:3px 8px;font-weight:700;font-size:13px}.tm-badge.good{background:#dff3e8;color:#0f5d38}.tm-badge.lock{background:#fde8e8;color:#8a1f26}
  .tm-savebar{position:sticky;bottom:0;background:#fff;border:2px solid #12345b;border-radius:12px;padding:10px 14px;margin:0 0 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 -4px 14px #0f1b2d22}.tm-savebar[hidden]{display:none}
  .tm-count{font-weight:700;color:#12345b}.tm-warn{color:#a5222f;font-weight:600}.tm-kitprev{font-size:14px;color:#46556a}
  .tm-radio{display:flex;gap:10px;align-items:flex-start;border:1px solid #cad6e4;border-radius:10px;padding:10px 12px;margin:8px 0;cursor:pointer}.tm-radio input{width:20px;height:20px;margin-top:2px}
  #team-shell :is(button,a,input,select,textarea):focus-visible{outline:3px solid #2563a8;outline-offset:2px}
  @media(max-width:560px){.tm-card{padding:14px}.tm-tabs button{flex:1 1 calc(50% - 6px)}}`;
  document.head.appendChild(style);

  const demo = /demo/i.test(location.hash);
  let adapter = null;
  async function getAdapter() {
    if (adapter) return adapter;
    const registry = async () => { try { const r = await fetch('skuadrat.json', { cache: 'no-store' }); return (await r.json()).teams || []; } catch { return []; } };
    adapter = demo
      ? Core.createLocalAdapter({ seedTeams: await registry() })
      : Core.createPortalAdapter({ portal: PORTAL, fallbackTeams: async () => (await registry()).map(t => ({ id: t.id, name: t.name })) });
    return adapter;
  }

  const S = { token: '', rep: null, team: null, roster: null, saved: '', matches: [], tab: 'matches', match: null, sheet: null, sheetSaved: '', sheetLocked: false, challenge: null, timer: null, busy: false };
  const dirty = () => !!S.roster && JSON.stringify(S.roster) !== S.saved;
  const sheetDirty = () => !!S.sheet && JSON.stringify(S.sheet) !== S.sheetSaved;
  const T = () => S.token;
  const hideOthers = () => { const app = document.getElementById('app'); if (app) app.style.display = 'none'; const d = document.getElementById('delegate-shell'); if (d) d.innerHTML = ''; };
  const demoBanner = () => demo ? '<div class="tm-demo"><b style="font-size:inherit;letter-spacing:0">MOD DEMO.</b> Të dhënat ruhen vetëm në këtë shfletues dhe kodet shfaqen në ekran në vend që të dërgohen me email/SMS. Provoni: <code>demo1</code> / <code>Demo-1234</code> (skuadra e parë) ose <code>demo2</code> (skuadra e dytë).</div>' : '';
  const page = (inner, cls = '') => { clearInterval(S.timer); hideOthers(); shell.innerHTML = `<main class="tm-screen"><div class="${cls || 'tm-wrap'}">${inner}</div></main>`; window.scrollTo(0, 0); };
  const setMsg = (text, bad = true) => { const el = shell.querySelector('[data-msg]'); if (el) { el.textContent = text || ''; el.classList.toggle('tm-err', bad); el.classList.toggle('tm-ok', !bad); } };
  const fail = e => { if (e && e.code === 'UNAUTHENTICATED') { sessionStorage.removeItem(TOKEN_KEY); Object.assign(S, { token: '', roster: null }); showLogin('Sesioni ka përfunduar. Kyçuni përsëri.'); return; } setMsg(e?.details?.length > 1 ? e.details.join(' ') : (e?.message || String(e))); };
  async function busy(btn, fn) { if (S.busy) return; S.busy = true; if (btn) btn.disabled = true; try { await fn(); } catch (e) { fail(e); } finally { S.busy = false; if (btn && btn.isConnected) btn.disabled = false; } }
  const rerender = focusSel => { const y = window.scrollY; render(); window.scrollTo(0, y); if (focusSel) { const el = shell.querySelector(focusSel); if (el) el.focus(); } };

  /* ---------- Kyçja me verifikim ---------- */
  async function showLogin(notice = '') {
    const a = await getAdapter(); let teams = [];
    try { teams = await a.listTeams(); } catch { }
    page(`<div class="tm-card tm-login"><div class="tm-seg" role="group" aria-label="Lloji i kyçjes"><button class="tm-btn sec" type="button" data-act="to-delegate" aria-pressed="false">Delegat</button><button class="tm-btn" type="button" aria-pressed="true">Skuadër</button></div>
      <h1>Procesverbali</h1><p>Kyçja e përfaqësuesit të skuadrës</p>${demoBanner()}
      <form id="tm-login" novalidate>
        <label class="tm-label" for="tm-team">Skuadra</label><select class="tm-input" id="tm-team" required><option value="">— Zgjidhni skuadrën —</option>${teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
        <label class="tm-label" for="tm-user">Emri i përdoruesit</label><input class="tm-input" id="tm-user" autocomplete="username" maxlength="40" required>
        <label class="tm-label" for="tm-pass">Fjalëkalimi</label><input class="tm-input" id="tm-pass" type="password" autocomplete="current-password" required>
        <p class="tm-err" data-msg role="alert">${esc(notice)}</p><button class="tm-btn">Vazhdo</button></form></div>`, 'tm-wrap');
    shell.querySelector('#tm-team').focus();
    shell.querySelector('[data-act="to-delegate"]').onclick = toDelegate;
    shell.querySelector('#tm-login').onsubmit = ev => { ev.preventDefault(); busy(ev.currentTarget.querySelector('button'), async () => {
      const teamId = shell.querySelector('#tm-team').value, username = shell.querySelector('#tm-user').value, password = shell.querySelector('#tm-pass').value;
      if (!teamId) throw new Error('Zgjidhni skuadrën.'); if (!username.trim() || !password) throw new Error('Shkruani emrin e përdoruesit dhe fjalëkalimin.');
      S.challenge = await a.startLogin({ username, password, teamId }); S.challenge.demoCode = ''; showMethod();
    }); };
  }
  function toDelegate() { shell.innerHTML = ''; Object.assign(S, { challenge: null }); if (window.FFKShell) window.FFKShell.login(); }
  function showMethod() {
    const ms = S.challenge.methods || [];
    page(`<div class="tm-card tm-login"><h1>Verifikimi</h1><p>Për siguri, do t’ju dërgojmë një kod njëpërdorimsh. Zgjidhni ku ta merrni.</p>${demoBanner()}
      <form id="tm-method">${ms.length ? ms.map((m, i) => `<label class="tm-radio"><input type="radio" name="m" value="${m.type}" ${i === 0 ? 'checked' : ''}><span><b>${m.type === 'email' ? 'Email' : 'Numri i telefonit'}</b><br><span class="tm-meta">${esc(m.masked)}</span></span></label>`).join('') : '<p class="tm-err">Ky përdorues nuk ka email as telefon të regjistruar. Kontaktoni administratorin.</p>'}
      <p class="tm-err" data-msg role="alert"></p><button class="tm-btn" ${ms.length ? '' : 'disabled'}>Dërgo kodin</button><button type="button" class="tm-btn sec" data-act="login-back">Anulo</button></form></div>`, 'tm-wrap');
    shell.querySelector('[data-act="login-back"]').onclick = () => showLogin();
    shell.querySelector('#tm-method').onsubmit = ev => { ev.preventDefault(); busy(ev.currentTarget.querySelector('button'), async () => {
      const method = shell.querySelector('input[name="m"]:checked')?.value; const r = await (await getAdapter()).sendCode({ challengeId: S.challenge.challengeId, method });
      S.challenge.sent = r; S.challenge.sentAt = Date.now(); showCode();
    }); };
  }
  function showCode() {
    const c = S.challenge, r = c.sent || {};
    page(`<div class="tm-card tm-login"><h1>Shkruani kodin</h1><p>Kodi 6-shifror u dërgua te <b>${esc(r.destination || '')}</b>. Vlen ${LIMITS.codeTtlMs / 60000} minuta.</p>
      ${demo && r.demoCode ? `<div class="tm-demo">Kodi demo: <b>${esc(r.demoCode)}</b></div>` : ''}
      <form id="tm-code"><label class="tm-label" for="tm-c">Kodi i verifikimit</label><input class="tm-input" id="tm-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>
      <p class="tm-err" data-msg role="alert"></p><button class="tm-btn">Verifiko dhe kyçu</button><button type="button" class="tm-btn sec" id="tm-resend" disabled></button><button type="button" class="tm-btn sec" data-act="login-back">Anulo</button></form></div>`, 'tm-wrap');
    const input = shell.querySelector('#tm-c'), resend = shell.querySelector('#tm-resend'); input.focus();
    input.oninput = () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); };
    const wait = () => Math.max(0, Math.ceil(((r.resendAfter || 30) * 1000 - (Date.now() - c.sentAt)) / 1000));
    const tick = () => { const w = wait(); resend.disabled = w > 0; resend.textContent = w > 0 ? `Dërgo përsëri (${w}s)` : 'Dërgo kodin përsëri'; };
    tick(); S.timer = setInterval(() => { if (!resend.isConnected) { clearInterval(S.timer); return; } tick(); }, 1000);
    shell.querySelector('[data-act="login-back"]').onclick = () => showLogin();
    resend.onclick = () => busy(resend, async () => { const out = await (await getAdapter()).sendCode({ challengeId: c.challengeId, method: (c.methods.find(m => m.masked === r.destination) || c.methods[0]).type }); c.sent = out; c.sentAt = Date.now(); showCode(); });
    shell.querySelector('#tm-code').onsubmit = ev => { ev.preventDefault(); busy(ev.currentTarget.querySelector('button'), async () => {
      if (!/^\d{6}$/.test(input.value)) throw new Error('Shkruani kodin 6-shifror.');
      let out; try { out = await (await getAdapter()).verifyCode({ challengeId: c.challengeId, code: input.value }); } catch (e) { input.value = ''; input.focus(); throw e; }
      S.token = out.token; S.rep = out.rep; S.team = out.team; try { sessionStorage.setItem(TOKEN_KEY, out.token); } catch { }
      await loadAll(); S.tab = 'matches'; render();
    }); };
  }

  /* ---------- Ngarkimi dhe pamja kryesore ---------- */
  async function loadAll() {
    const a = await getAdapter();
    [S.roster, S.matches] = await Promise.all([a.getRoster(T()), a.listMatches(T())]);
    S.saved = JSON.stringify(S.roster); S.match = null; S.sheet = null;
  }
  const TABS = [['matches', 'Ndeshjet'], ['players', 'Lojtarët'], ['officials', 'Zyrtarët'], ['kits', 'Fanellat'], ['security', 'Llogaria']];
  function render() {
    if (S.match) { page(matchView(), 'tm-wrap'); return; }
    const body = { matches: matchesTab, players: playersTab, officials: officialsTab, kits: kitsTab, security: securityTab }[S.tab]();
    page(`<div class="tm-card"><div class="tm-head"><div><h1>${esc(S.team.name)}</h1><p class="tm-meta">${esc(S.rep.name)} · Përfaqësues i skuadrës</p></div><button class="tm-btn sec" data-act="logout">Dil nga llogaria</button></div></div>${demo ? demoBanner() : ''}
      <nav class="tm-tabs" aria-label="Seksionet">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>
      <p class="tm-err" data-msg role="alert"></p>${body}${saveBar()}`);
  }
  function saveBar() { return `<div class="tm-savebar" id="tm-savebar" ${dirty() ? '' : 'hidden'}><span><b>Ke ndryshime të paruajtura.</b></span><button class="tm-btn sm" data-act="save-roster">Ruaj ndryshimet</button><button class="tm-btn sm sec" data-act="discard-roster">Anulo ndryshimet</button></div>`; }
  const refreshBar = () => { const b = shell.querySelector('#tm-savebar'); if (b) b.hidden = !dirty(); };

  /* ---------- Ndeshjet ---------- */
  function fmtDate(d) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(d || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (d || ''); }
  function matchesTab() {
    if (!S.matches.length) return '<div class="tm-card"><h2>Ndeshjet</h2><p class="tm-empty">Skuadra juaj nuk ka ndeshje të caktuara ende.</p></div>';
    return `<div class="tm-card"><h2>Ndeshjet e skuadrës</h2><p class="tm-meta">Zgjidhni një ndeshje për të caktuar listën e lojtarëve, zyrtarët dhe fanellat.</p></div>` + S.matches.map(m => `<article class="tm-card"><div class="tm-row"><div><span class="tm-badge ${m.locked ? 'lock' : m.submitted ? 'good' : ''}">${m.locked ? 'E kyçur' : m.submitted ? 'Lista e ruajtur' : 'Pa listë'}</span><h3 style="margin-top:8px">${esc(m.home)} – ${esc(m.away)}</h3><p class="tm-meta">${[m.competition, m.round ? 'Java ' + m.round : '', fmtDate(m.date), m.time, m.venue].filter(Boolean).map(esc).join(' · ')}</p></div><button class="tm-btn" data-act="open-match" data-id="${esc(m.id)}">${m.locked ? 'Shiko listën' : 'Cakto listën'}</button></div></article>`).join('');
  }
  async function openMatch(id) {
    if (dirty()) { setMsg('Ruani ose anuloni ndryshimet te lojtarët/zyrtarët/fanellat para se të hapni ndeshjen.'); return; }
    const out = await (await getAdapter()).getSheet(T(), id), m = S.matches.find(x => x.id === id);
    const known = new Set(S.roster.players.map(p => p.id)), offs = new Set(S.roster.officials.map(o => o.id));
    S.match = m; S.sheetLocked = !!out.locked;
    S.sheet = { ...out.sheet, players: out.sheet.players.filter(p => known.has(p.id)), officialIds: out.sheet.officialIds.filter(x => offs.has(x)) };
    if (!out.submitted) S.sheet.kit = { ...S.roster.kits[S.sheet.kitSet] };
    S.sheetSaved = out.submitted ? JSON.stringify(S.sheet) : ''; render();
  }
  const kitText = k => ['shirt', 'shorts', 'socks'].map((f, i) => ['Maica', 'Shorcet', 'Qorapet'][i] + ': ' + (k[f] || '—')).join(' · ');
  function matchView() {
    const m = S.match, sh = S.sheet, ro = S.sheetLocked, n = sh.players.length, st = sh.players.filter(p => p.starter).length;
    const flag = id => sh.players.find(p => p.id === id);
    const players = [...S.roster.players].sort((a, b) => (+a.shirtNo || 999) - (+b.shirtNo || 999));
    return `<div class="tm-card"><div class="tm-row"><div><button class="tm-btn sec sm" data-act="back-matches">← Ndeshjet</button><h1 style="margin-top:10px">${esc(m.home)} – ${esc(m.away)}</h1><p class="tm-meta">${[m.competition, m.round ? 'Java ' + m.round : '', fmtDate(m.date), m.time, m.venue].filter(Boolean).map(esc).join(' · ')}</p></div>${ro ? '<span class="tm-badge lock">E kyçur · vetëm lexim</span>' : ''}</div></div>
    <p class="tm-err" data-msg role="alert"></p>
    <div class="tm-card"><h2>Fanellat që luhen</h2>${KIT_SETS.map(([k, l]) => `<label class="tm-radio"><input type="radio" name="kitset" value="${k}" ${sh.kitSet === k ? 'checked' : ''} ${ro ? 'disabled' : ''}><span><b>${l}</b><br><span class="tm-kitprev">${esc(kitText(S.roster.kits[k]))}</span></span></label>`).join('')}
      <p class="tm-meta" style="margin-top:12px">Ngjyrat për këtë ndeshje (mund t’i ndryshoni vetëm për këtë ndeshje):</p>
      <div class="tm-kits">${[['shirt', 'Maica'], ['shorts', 'Shorcet'], ['socks', 'Qorapet']].map(([f, l]) => `<label class="tm-label" style="margin:4px 0">${l}<input class="tm-input" data-kit="${f}" maxlength="40" value="${esc(sh.kit[f])}" ${ro ? 'disabled' : ''}></label>`).join('')}</div></div>
    <div class="tm-card"><div class="tm-row"><h2>Lista e lojtarëve</h2><span class="tm-count ${n > LIMITS.squad ? 'tm-warn' : ''}" aria-live="polite">${n}/${LIMITS.squad} në listë · ${st}/${LIMITS.starters} startues</span></div>
      <div class="tm-table-wrap"><table class="tm-table"><thead><tr><th>Nr.</th><th>Emri dhe Mbiemri</th><th class="tm-narrow">Luan</th><th class="tm-narrow" title="Kapiteni">C</th><th class="tm-narrow" title="Startues">5</th></tr></thead><tbody>${players.map(p => { const f = flag(p.id); return `<tr><td><b>${esc(p.shirtNo)}</b></td><td>${esc(p.name)}</td><td class="tm-narrow"><input type="checkbox" data-sq="${esc(p.id)}" aria-label="Luan: ${esc(p.name)}" ${f ? 'checked' : ''} ${ro || (!f && n >= LIMITS.squad) ? 'disabled' : ''}></td><td class="tm-narrow"><input type="radio" name="cap" data-cap="${esc(p.id)}" aria-label="Kapiten: ${esc(p.name)}" ${f && f.captain ? 'checked' : ''} ${ro || !f ? 'disabled' : ''}></td><td class="tm-narrow"><input type="checkbox" data-st="${esc(p.id)}" aria-label="Startues: ${esc(p.name)}" ${f && f.starter ? 'checked' : ''} ${ro || !f || (!f.starter && st >= LIMITS.starters) ? 'disabled' : ''}></td></tr>`; }).join('') || '<tr><td colspan="5" class="tm-empty">Nuk keni lojtarë të regjistruar. Shtojini te seksioni “Lojtarët”.</td></tr>'}</tbody></table></div></div>
    <div class="tm-card"><h2>Zyrtarët në ndeshje</h2>${S.roster.officials.length ? S.roster.officials.map(o => `<label class="tm-radio"><input type="checkbox" data-off="${esc(o.id)}" ${sh.officialIds.includes(o.id) ? 'checked' : ''} ${ro ? 'disabled' : ''}><span><b>${esc(o.role)}</b> · ${esc(o.name)}</span></label>`).join('') : '<p class="tm-empty">Nuk keni zyrtarë të regjistruar.</p>'}</div>
    ${ro ? '' : '<div class="tm-savebar"><button class="tm-btn sm" data-act="save-sheet">Ruaj listën e ndeshjes</button><button class="tm-btn sm sec" data-act="back-matches">Mbrapa</button></div>'}`;
  }

  /* ---------- Lojtarët, zyrtarët, fanellat ---------- */
  function dupNos() { const c = {}; S.roster.players.forEach(p => { if (p.shirtNo) c[p.shirtNo] = (c[p.shirtNo] || 0) + 1; }); return c; }
  function playersTab() {
    const c = dupNos();
    return `<div class="tm-card"><div class="tm-row"><h2>Lojtarët <span class="tm-count">${S.roster.players.length}</span></h2><button class="tm-btn sm" data-act="add-player">＋ Shto lojtar</button></div><p class="tm-meta">Shtoni, editoni ose fshini lojtarët. Ndryshimet ruhen kur shtypni “Ruaj ndryshimet”.</p><p class="tm-warn" id="tm-dup">${Object.keys(c).filter(k => c[k] > 1).length ? 'Kujdes: numri i fanellës përsëritet — ' + Object.keys(c).filter(k => c[k] > 1).join(', ') + '.' : ''}</p>
      <div class="tm-table-wrap"><table class="tm-table"><thead><tr><th>Nr.</th><th>Nr. fanellës</th><th>Emri dhe Mbiemri</th><th>Nr. ID</th><th></th></tr></thead><tbody>${S.roster.players.map((p, i) => `<tr><td>${i + 1}</td><td class="tm-no"><input class="tm-input ${c[p.shirtNo] > 1 ? 'tm-dup' : ''}" data-list="players" data-id="${esc(p.id)}" data-f="shirtNo" inputmode="numeric" maxlength="2" value="${esc(p.shirtNo)}" aria-label="Nr. fanellës"></td><td><input class="tm-input" data-list="players" data-id="${esc(p.id)}" data-f="name" maxlength="120" value="${esc(p.name)}" aria-label="Emri dhe mbiemri"></td><td><input class="tm-input" data-list="players" data-id="${esc(p.id)}" data-f="idNumber" maxlength="40" value="${esc(p.idNumber)}" aria-label="Nr. ID"></td><td><button class="tm-btn sm danger" data-act="del-player" data-id="${esc(p.id)}">Fshi</button></td></tr>`).join('') || '<tr><td colspan="5" class="tm-empty">Nuk ka lojtarë ende. Shtypni “Shto lojtar”.</td></tr>'}</tbody></table></div></div>`;
  }
  function officialsTab() {
    return `<div class="tm-card"><div class="tm-row"><h2>Zyrtarët e skuadrës <span class="tm-count">${S.roster.officials.length}</span></h2><button class="tm-btn sm" data-act="add-official">＋ Shto zyrtar</button></div><p class="tm-meta">Roli mund të zgjidhet nga lista ose të shkruhet llirshëm.</p>
      <datalist id="tm-roles">${Core.ROLES.map(r => `<option value="${esc(r)}"></option>`).join('')}</datalist>
      <div class="tm-table-wrap"><table class="tm-table"><thead><tr><th>Roli</th><th>Emri dhe Mbiemri</th><th>Nr. ID</th><th></th></tr></thead><tbody>${S.roster.officials.map(o => `<tr><td><input class="tm-input" list="tm-roles" data-list="officials" data-id="${esc(o.id)}" data-f="role" maxlength="40" value="${esc(o.role)}" aria-label="Roli"></td><td><input class="tm-input" data-list="officials" data-id="${esc(o.id)}" data-f="name" maxlength="120" value="${esc(o.name)}" aria-label="Emri"></td><td><input class="tm-input" data-list="officials" data-id="${esc(o.id)}" data-f="idNumber" maxlength="40" value="${esc(o.idNumber)}" aria-label="Nr. ID"></td><td><button class="tm-btn sm danger" data-act="del-official" data-id="${esc(o.id)}">Fshi</button></td></tr>`).join('') || '<tr><td colspan="4" class="tm-empty">Nuk ka zyrtarë. Shtypni “Shto zyrtar”.</td></tr>'}</tbody></table></div></div>`;
  }
  function kitsTab() {
    return `<div class="tm-card"><h2>Fanellat</h2><p class="tm-meta">Regjistroni ngjyrat e tri setave. Për çdo ndeshje zgjidhet seti që luhet.</p><div class="tm-kits">${KIT_SETS.map(([k, l]) => `<div class="tm-kit"><h3>${l}</h3>${[['shirt', 'Maica'], ['shorts', 'Shorcet'], ['socks', 'Qorapet']].map(([f, lb]) => `<label class="tm-label" style="margin:8px 0 3px">${lb}</label><input class="tm-input" data-kitset="${k}" data-f="${f}" maxlength="40" value="${esc(S.roster.kits[k][f])}" placeholder="p.sh. e kuqe"> `).join('')}</div>`).join('')}</div></div>`;
  }

  /* ---------- Llogaria dhe verifikimi ---------- */
  function securityTab() {
    return `<div class="tm-card"><h2>Verifikimi i kyçjes</h2><p>Çdo kyçje kërkon një kod njëpërdorimsh që dërgohet me email ose SMS. Ky përdorues mund të hyjë vetëm te skuadra <b>${esc(S.team.name)}</b>.</p><div id="tm-contacts" class="tm-meta">Duke ngarkuar…</div></div>
    <div class="tm-card"><h2>Ndrysho emailin ose telefonin</h2><div id="tm-change"><form id="tm-contact-form"><label class="tm-label" for="tm-ct">Lloji</label><select class="tm-input" id="tm-ct"><option value="email">Email</option><option value="phone">Telefon</option></select><label class="tm-label" for="tm-cv">Vlera e re</label><input class="tm-input" id="tm-cv" placeholder="emri@shembull.com ose +38344123456" maxlength="120" required><button class="tm-btn">Dërgo kodin e verifikimit</button></form></div></div>`;
  }
  async function loadContacts() {
    const box = shell.querySelector('#tm-contacts'); if (!box) return;
    try { const c = await (await getAdapter()).getContacts(T()); box.innerHTML = `Email: <b>${esc(c.email || 'nuk është vendosur')}</b><br>Telefon: <b>${esc(c.phone || 'nuk është vendosur')}</b>`; } catch (e) { fail(e); }
  }
  function wireContactForm() {
    const form = shell.querySelector('#tm-contact-form'); if (!form) return;
    form.onsubmit = ev => { ev.preventDefault(); busy(form.querySelector('button'), async () => {
      const type = shell.querySelector('#tm-ct').value, value = shell.querySelector('#tm-cv').value, a = await getAdapter();
      const r = await a.startContactChange(T(), { type, value });
      shell.querySelector('#tm-change').innerHTML = `<p>Kodi u dërgua te <b>${esc(r.destination || '')}</b>.</p>${demo && r.demoCode ? `<div class="tm-demo">Kodi demo: <b>${esc(r.demoCode)}</b></div>` : ''}<form id="tm-contact-code"><label class="tm-label" for="tm-cc">Kodi 6-shifror</label><input class="tm-input" id="tm-cc" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required><button class="tm-btn">Konfirmo</button></form>`;
      const cc = shell.querySelector('#tm-cc'); cc.focus(); cc.oninput = () => { cc.value = cc.value.replace(/\D/g, '').slice(0, 6); };
      shell.querySelector('#tm-contact-code').onsubmit = e2 => { e2.preventDefault(); busy(e2.currentTarget.querySelector('button'), async () => { await a.confirmContactChange(T(), { code: cc.value }); render(); setMsg('Kontakti u ndryshua.', false); }); };
    }); };
  }

  /* ---------- Ngjarjet ---------- */
  shell.addEventListener('click', ev => {
    const tab = ev.target.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; render(); return; }
    const b = ev.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act, id = b.dataset.id;
    switch (act) {
      case 'logout': return void (async () => { if (dirty() && !confirm('Ke ndryshime të paruajtura. Të dalësh pa i ruajtur?')) return; try { await (await getAdapter()).logout(T()); } catch { } sessionStorage.removeItem(TOKEN_KEY); Object.assign(S, { token: '', roster: null, match: null }); showLogin(); })();
      case 'add-player': { const p = { id: Core.uid(), shirtNo: '', name: '', idNumber: '' }; S.roster.players.push(p); rerender(`[data-id="${p.id}"][data-f="shirtNo"]`); refreshBar(); return; }
      case 'del-player': { const p = S.roster.players.find(x => x.id === id); if (p && confirm('Të fshihet lojtari' + (p.name ? ' “' + p.name + '”' : '') + '?')) { S.roster.players = S.roster.players.filter(x => x.id !== id); rerender(); } return; }
      case 'add-official': { const o = { id: Core.uid(), role: '', name: '', idNumber: '' }; S.roster.officials.push(o); rerender(`[data-id="${o.id}"][data-f="role"]`); return; }
      case 'del-official': { const o = S.roster.officials.find(x => x.id === id); if (o && confirm('Të fshihet zyrtari' + (o.name ? ' “' + o.name + '”' : '') + '?')) { S.roster.officials = S.roster.officials.filter(x => x.id !== id); rerender(); } return; }
      case 'discard-roster': if (confirm('Të anulohen të gjitha ndryshimet e paruajtura?')) { S.roster = JSON.parse(S.saved); rerender(); } return;
      case 'save-roster': return void busy(b, async () => {
        const errs = Core.validateRoster(Core.normRoster(S.roster)); if (errs.length) { setMsg(errs.join(' ')); window.scrollTo(0, 0); return; }
        S.roster = await (await getAdapter()).saveRoster(T(), S.roster); S.saved = JSON.stringify(S.roster); rerender(); setMsg('Ndryshimet u ruajtën.', false);
      });
      case 'open-match': return void busy(b, () => openMatch(id));
      case 'back-matches': return void (async () => { if (sheetDirty() && !confirm('Lista ka ndryshime të paruajtura. Të dalësh pa i ruajtur?')) return; S.match = null; S.sheet = null; S.matches = await (await getAdapter()).listMatches(T()).catch(() => S.matches); S.tab = 'matches'; render(); })();
      case 'save-sheet': return void busy(b, async () => {
        const errs = Core.validateSheet(Core.normSheet(S.sheet), S.roster); if (errs.length) { setMsg(errs.join(' ')); return; }
        if (!S.sheet.players.length && !confirm('Lista është bosh. Ta ruaj përsëri?')) return;
        const out = await (await getAdapter()).saveSheet(T(), S.match.id, S.sheet); S.sheet = out.sheet; S.sheetSaved = JSON.stringify(S.sheet); setMsg('Lista e ndeshjes u ruajt.', false);
      });
    }
  });
  shell.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.list) { const it = S.roster[el.dataset.list].find(x => x.id === el.dataset.id); if (!it) return; let v = el.value; if (el.dataset.f === 'shirtNo') { v = v.replace(/\D/g, '').slice(0, 2); if (/^0+$/.test(v)) v = ''; if (v !== el.value) el.value = v; } it[el.dataset.f] = v; refreshBar(); if (el.dataset.f === 'shirtNo') markDups(); }
    else if (el.dataset.kitset) { S.roster.kits[el.dataset.kitset][el.dataset.f] = el.value; refreshBar(); }
    else if (el.dataset.kit && S.sheet) { S.sheet.kit[el.dataset.kit] = el.value; }
  });
  function markDups() { const c = dupNos(); shell.querySelectorAll('[data-list="players"][data-f="shirtNo"]').forEach(i => i.classList.toggle('tm-dup', !!(i.value && c[i.value] > 1))); const d = shell.querySelector('#tm-dup'); if (d) { const k = Object.keys(c).filter(x => c[x] > 1); d.textContent = k.length ? 'Kujdes: numri i fanellës përsëritet — ' + k.join(', ') + '.' : ''; } }
  shell.addEventListener('change', ev => {
    const el = ev.target; if (!S.sheet || S.sheetLocked) return; const sh = S.sheet;
    if (el.name === 'kitset') { sh.kitSet = el.value; sh.kit = { ...S.roster.kits[el.value] }; rerender(`input[name="kitset"][value="${el.value}"]`); return; }
    if (el.dataset.sq) { const id = el.dataset.sq; if (el.checked) { if (sh.players.length >= LIMITS.squad) { el.checked = false; return; } sh.players.push({ id, captain: false, starter: false }); } else sh.players = sh.players.filter(p => p.id !== id); rerender(`[data-sq="${id}"]`); return; }
    if (el.dataset.cap) { sh.players.forEach(p => { p.captain = p.id === el.dataset.cap; }); rerender(`[data-cap="${el.dataset.cap}"]`); return; }
    if (el.dataset.st) { const p = sh.players.find(x => x.id === el.dataset.st); if (!p) return; if (el.checked && sh.players.filter(x => x.starter).length >= LIMITS.starters) { el.checked = false; return; } p.starter = el.checked; rerender(`[data-st="${el.dataset.st}"]`); return; }
    if (el.dataset.off) { const id = el.dataset.off; sh.officialIds = el.checked ? [...new Set([...sh.officialIds, id])] : sh.officialIds.filter(x => x !== id); }
  });
  function afterRender() { if (S.tab === 'security' && !S.match) { loadContacts(); wireContactForm(); } }
  const origRender = render; render = function () { origRender(); afterRender(); };
  window.addEventListener('beforeunload', e => { if (dirty() || sheetDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Hyrja nga jashtë ---------- */
  async function start() {
    hideOthers();
    const saved = (() => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } })();
    if (saved) {
      try { const a = await getAdapter(); const me = await a.me(saved); Object.assign(S, { token: saved, rep: me.rep, team: me.team }); await loadAll(); S.tab = 'matches'; render(); return; }
      catch { try { sessionStorage.removeItem(TOKEN_KEY); } catch { } }
    }
    showLogin();
  }
  const hasSession = () => { try { return !!sessionStorage.getItem(TOKEN_KEY); } catch { return false; } };
  const wantsStart = () => hasSession() || /skuadra|demo/i.test(location.hash);
  window.TeamPortal = { start, hasSession, wantsStart };
})();
