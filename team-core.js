/* Logjika e portalit të skuadrave (pa DOM, e testueshme).
 *
 * Dy adapterë me të njëjtën ndërfaqe:
 *  - createPortalAdapter: flet me Portalin (/api/team/...). Autorizimi dhe kodet e verifikimit
 *    zbatohen NË SERVER. Kontrata është në TEAM-API.md.
 *  - createLocalAdapter: MOD DEMO, ruan gjithçka në shfletues. Nuk është siguri e vërtetë;
 *    shërben vetëm për provë para se të lidhet Portali.
 */
(function (global) {
  'use strict';

  const ROLES = ['Përfaqësuesi', 'Trajneri', 'Nd.Trajneri', 'Tr.Portierave', 'Mjeku', 'Fizioterapeuti'];
  const KIT_SETS = [['first', 'Fanella e parë'], ['second', 'Fanella e dytë'], ['third', 'Fanella e tretë']];
  const LIMITS = {
    squad: 14, starters: 5,
    challengeTtlMs: 15 * 60e3, codeTtlMs: 10 * 60e3, resendMs: 30e3,
    maxCodeAttempts: 5, maxLoginFails: 5, lockMs: 60e3, sessionMs: 8 * 3600e3
  };

  class TeamError extends Error {
    constructor(code, message, status, details) { super(message); this.code = code; this.status = status || 400; if (details) this.details = details; }
  }

  const str = (v, n = 120) => String(v ?? '').trim().slice(0, n);
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function secureToken() {
    const a = new Uint8Array(24); global.crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }
  function sixDigits() { const a = new Uint32Array(1); global.crypto.getRandomValues(a); return String(a[0] % 1000000).padStart(6, '0'); }

  /* ---------- Normalizim dhe validim ---------- */
  const blankKits = () => ({ first: { shirt: '', shorts: '', socks: '' }, second: { shirt: '', shorts: '', socks: '' }, third: { shirt: '', shorts: '', socks: '' } });
  function normKits(k) {
    const out = blankKits();
    for (const [s] of KIT_SETS) for (const f of ['shirt', 'shorts', 'socks']) out[s][f] = str(k?.[s]?.[f], 40);
    return out;
  }
  const shirtDigits = v => String(v ?? '').replace(/\D/g, '').slice(0, 2).replace(/^0+$/, '');
  function normRoster(r) {
    const players = (Array.isArray(r?.players) ? r.players : [])
      .map(p => ({ id: str(p?.id, 40) || uid(), shirtNo: shirtDigits(p?.shirtNo), name: str(p?.name), idNumber: str(p?.idNumber, 40) }))
      .filter(p => p.shirtNo || p.name || p.idNumber);
    const officials = (Array.isArray(r?.officials) ? r.officials : [])
      .map(o => ({ id: str(o?.id, 40) || uid(), role: str(o?.role, 40), name: str(o?.name), idNumber: str(o?.idNumber, 40) }))
      .filter(o => o.name || o.idNumber);
    return { players, officials, kits: normKits(r?.kits), version: Number(r?.version || 0) };
  }
  function validateRoster(r) {
    const errs = [], seen = {};
    r.players.forEach((p, i) => {
      const n = 'Lojtari ' + (i + 1);
      if (!p.name || p.name.length < 2) errs.push(n + ': shkruani emrin dhe mbiemrin.');
      if (!p.shirtNo) errs.push(n + (p.name ? ' (' + p.name + ')' : '') + ': numri i fanellës është i detyrueshëm (1–99).');
      else { if (+p.shirtNo < 1 || +p.shirtNo > 99) errs.push(n + ': numri i fanellës duhet të jetë 1–99.'); (seen[p.shirtNo] = seen[p.shirtNo] || []).push(p.name || n); }
    });
    Object.keys(seen).filter(k => seen[k].length > 1).forEach(k => errs.push('Numri i fanellës ' + k + ' përsëritet.'));
    r.officials.forEach((o, i) => { if (!o.name) errs.push('Zyrtari ' + (i + 1) + ': shkruani emrin.'); if (!o.role) errs.push('Zyrtari ' + (i + 1) + (o.name ? ' (' + o.name + ')' : '') + ': shkruani rolin.'); });
    return errs;
  }
  function normSheet(s) {
    const players = [], ids = new Set();
    for (const p of (Array.isArray(s?.players) ? s.players : [])) {
      const id = str(p?.id, 40); if (!id || ids.has(id)) continue; ids.add(id);
      players.push({ id, captain: !!p.captain, starter: !!p.starter });
    }
    const kitSet = KIT_SETS.some(k => k[0] === s?.kitSet) ? s.kitSet : 'first';
    return {
      kitSet,
      kit: { shirt: str(s?.kit?.shirt, 40), shorts: str(s?.kit?.shorts, 40), socks: str(s?.kit?.socks, 40) },
      players,
      officialIds: [...new Set((Array.isArray(s?.officialIds) ? s.officialIds : []).map(x => str(x, 40)).filter(Boolean))]
    };
  }
  function validateSheet(s, roster) {
    const errs = [], pid = new Set(roster.players.map(p => p.id)), oid = new Set(roster.officials.map(o => o.id));
    if (s.players.length > LIMITS.squad) errs.push('Lista e ndeshjes ka maksimumi ' + LIMITS.squad + ' lojtarë.');
    if (s.players.some(p => !pid.has(p.id))) errs.push('Lista përmban lojtarë që nuk janë të regjistruar te skuadra.');
    if (s.officialIds.some(id => !oid.has(id))) errs.push('Lista përmban zyrtarë që nuk janë të regjistruar te skuadra.');
    if (s.players.filter(p => p.starter).length > LIMITS.starters) errs.push('Mund të zgjidhen maksimumi ' + LIMITS.starters + ' startues.');
    if (s.players.filter(p => p.captain).length > 1) errs.push('Mund të ketë vetëm një kapiten.');
    return errs;
  }
  function buildSnapshot(roster, sheet) {
    const byId = new Map(roster.players.map(p => [p.id, p])), offById = new Map(roster.officials.map(o => [o.id, o]));
    return {
      kitSet: sheet.kitSet, kit: clone(sheet.kit),
      players: sheet.players.filter(p => byId.has(p.id)).map(p => ({ shirtNo: byId.get(p.id).shirtNo, name: byId.get(p.id).name, idNumber: byId.get(p.id).idNumber, captain: !!p.captain, starter: !!p.starter }))
        .sort((a, b) => (+a.shirtNo || 999) - (+b.shirtNo || 999)),
      officials: sheet.officialIds.filter(id => offById.has(id)).map(id => ({ role: offById.get(id).role, name: offById.get(id).name, idNumber: offById.get(id).idNumber }))
    };
  }

  /* ---------- Snapshot -> procesverbali i delegatit ---------- */
  /* Kthen {kit, players[14], officials[]} në formën që pret procesverbali (teams.a|b), ose null. */
  function snapshotToTeam(snap, roleList) {
    if (!snap || typeof snap !== 'object') return null;
    const roles = Array.isArray(roleList) && roleList.length ? roleList : ROLES;
    let captainUsed = false, starters = 0;
    const players = (Array.isArray(snap.players) ? snap.players : []).slice(0, LIMITS.squad).map(p => {
      const captain = !!p?.captain && !captainUsed; if (captain) captainUsed = true;
      const starter = !!p?.starter && starters < LIMITS.starters; if (starter) starters++;
      return { shirtNo: shirtDigits(p?.shirtNo), name: str(p?.name), idNumber: str(p?.idNumber, 40), captain, starter };
    });
    while (players.length < LIMITS.squad) players.push({ shirtNo: '', name: '', idNumber: '' });
    const officials = roles.map(role => ({ role, name: '', idNumber: '', custom: false, enabled: true }));
    for (const o of (Array.isArray(snap.officials) ? snap.officials : [])) {
      const role = str(o?.role, 40), name = str(o?.name), idNumber = str(o?.idNumber, 40);
      if (!name && !idNumber) continue;
      const slot = officials.find(x => !x.custom && !x.name && !x.idNumber && x.role.toLowerCase() === role.toLowerCase());
      if (slot) { slot.name = name; slot.idNumber = idNumber; }
      else officials.push({ role: role || 'Zyrtar shtesë', name, idNumber, custom: true, enabled: true });
    }
    const k = snap.kit || {};
    return { kit: { shirt: str(k.shirt, 40), shorts: str(k.shorts, 40), socks: str(k.socks, 40) }, players, officials };
  }
  /* Shenjë e shkurtër e përmbajtjes së snapshot-it: tregon nëse lista e skuadrës ka ndryshuar. */
  function snapshotKey(snap) {
    if (!snap || typeof snap !== 'object') return '';
    const t = snapshotToTeam(snap); let h = 5381; const j = JSON.stringify(t);
    for (let i = 0; i < j.length; i++) h = ((h << 5) + h + j.charCodeAt(i)) | 0;
    return 's' + (h >>> 0).toString(36);
  }

  /* ---------- Kontaktet ---------- */
  const maskEmail = e => { const [u, d] = String(e || '').split('@'); return u && d ? u[0] + '***@' + d : ''; };
  const maskPhone = p => { const s = String(p || ''); return s.length < 7 ? '' : s.slice(0, 4) + ' ' + '•'.repeat(Math.max(2, s.length - 6)) + ' ' + s.slice(-2); };
  const cleanPhone = p => String(p || '').replace(/[\s()-]/g, '');
  const validContact = (type, v) => type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120 : type === 'phone' ? /^\+\d{8,15}$/.test(v) : false;

  /* ---------- Adapteri LOKAL (DEMO) ---------- */
  function createLocalAdapter(opts = {}) {
    const storage = opts.storage || global.localStorage, KEY = 'ffk-team-demo-db-v1', now = opts.now || (() => Date.now());
    let db;
    const err = (c, m, s, d) => new TeamError(c, m, s, d);
    function load() { try { const j = JSON.parse(storage.getItem(KEY) || 'null'); if (j && j.v === 1) return j; } catch { } const d = seed(); persist(d); return d; }
    function persist(d) { try { storage.setItem(KEY, JSON.stringify(d || db)); } catch { } }
    const isoDay = off => { const d = new Date(now() + off * 864e5); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
    function demoPlayers(prefix) { return ['Arben Krasniqi', 'Besnik Gashi', 'Dritan Hoxha', 'Endrit Berisha', 'Fatmir Morina', 'Genc Shala', 'Hasan Rexhepi', 'Ilir Kastrati'].map((n, i) => ({ id: uid() + i, shirtNo: String(i + 1), name: n, idNumber: prefix + (100 + i) })); }
    function seed() {
      const base = (opts.seedTeams || []).slice(0, 2).map(t => ({ id: String(t.id), name: String(t.name || 'Skuadra'), ...normRoster(t) }));
      const extra = [['demo-a', 'KF Demo Prishtina'], ['demo-b', 'KF Demo Gjilani']];
      while (base.length < 2) { const [id, name] = extra[base.length]; base.push({ id, name, kits: { first: { shirt: 'e kuqe', shorts: 'të zeza', socks: 'të kuqe' }, second: { shirt: 'e bardhë', shorts: 'të bardha', socks: 'të bardha' }, third: { shirt: '', shorts: '', socks: '' } }, players: demoPlayers(id[5]), officials: ROLES.map(role => ({ id: uid() + role.length, role, name: role === 'Trajneri' ? 'Trajner Demo' : '', idNumber: '' })), version: 1 }); }
      const [A, B] = base;
      const m = (n, h, a, off, time, locked) => ({ id: 'm' + n, homeTeamId: h.id, awayTeamId: a.id, home: h.name, away: a.name, date: isoDay(off), time, venue: 'Salla e Sporteve', competition: 'Superliga', round: String(n), locked: !!locked });
      return {
        v: 1, teams: Object.fromEntries(base.map(t => [t.id, t])),
        reps: base.map((t, i) => ({ id: 'rep' + (i + 1), username: 'demo' + (i + 1), password: 'Demo-1234', teamId: t.id, name: 'Përfaqësues Demo ' + (i + 1), email: 'demo' + (i + 1) + '@example.com', phone: '+3834400' + (i + 1) + '00' })),
        matches: [m(1, A, B, 3, '19:00'), m(2, B, A, 10, '20:00'), m(3, A, B, -7, '18:30', true)],
        sheets: {}, sessions: {}, challenges: {}, fails: {}, pending: {}
      };
    }
    function auth(token) {
      const s = db.sessions[token];
      if (!s || s.expires < now()) { if (s) { delete db.sessions[token]; persist(); } throw err('UNAUTHENTICATED', 'Sesioni ka përfunduar. Kyçuni përsëri.', 401); }
      return { rep: db.reps.find(r => r.id === s.repId), team: db.teams[s.teamId], teamId: s.teamId };
    }
    const methodsOf = rep => [rep.email && { type: 'email', masked: maskEmail(rep.email) }, rep.phone && { type: 'phone', masked: maskPhone(rep.phone) }].filter(Boolean);
    function issueCode(holder, destination) {
      if (holder.sentAt && now() - holder.sentAt < LIMITS.resendMs) throw err('TOO_SOON', 'Prisni pak para se të kërkoni kod të ri.', 429);
      holder.code = sixDigits(); holder.sentAt = now(); holder.expires = now() + LIMITS.codeTtlMs; holder.attempts = 0;
      return { sent: true, resendAfter: LIMITS.resendMs / 1000, destination, demoCode: holder.code };
    }
    function checkCode(holder, code, drop) {
      if (!holder.code) throw err('NO_CODE', 'Kërkoni fillimisht një kod.', 400);
      if (holder.attempts >= LIMITS.maxCodeAttempts) { drop(); persist(); throw err('TOO_MANY', 'Shumë përpjekje. Fillojeni kyçjen nga e para.', 429); }
      if (holder.expires < now()) throw err('CODE_EXPIRED', 'Kodi ka skaduar. Kërkoni një kod të ri.', 400);
      if (str(code, 12) !== holder.code) { holder.attempts++; persist(); throw err('INVALID_CODE', 'Kodi nuk është i saktë.', 400); }
    }
    db = load();
    return {
      demo: true,
      async listTeams() { return Object.values(db.teams).map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name, 'sq')); },
      async startLogin({ username, password, teamId }) {
        const u = str(username, 40).toLowerCase(), f = db.fails[u];
        if (f && f.until > now()) throw err('TOO_MANY', 'Shumë përpjekje. Provoni pas një minute.', 429);
        const rep = db.reps.find(r => r.username === u);
        if (!rep || rep.password !== String(password || '')) {
          const n = ((f && f.n) || 0) + 1; db.fails[u] = { n, until: n >= LIMITS.maxLoginFails ? now() + LIMITS.lockMs : 0 }; if (n >= LIMITS.maxLoginFails) db.fails[u].n = 0; persist();
          throw err('INVALID_CREDENTIALS', 'Të dhënat e kyçjes nuk janë të sakta.', 401);
        }
        delete db.fails[u];
        if (rep.teamId !== teamId) { persist(); throw err('TEAM_MISMATCH', 'Ky përdorues nuk është i caktuar për skuadrën e zgjedhur.', 403); }
        const id = secureToken(); db.challenges[id] = { repId: rep.id, created: now(), method: '', code: '', attempts: 0 }; persist();
        return { challengeId: id, methods: methodsOf(rep) };
      },
      async sendCode({ challengeId, method }) {
        const ch = db.challenges[challengeId];
        if (!ch || now() - ch.created > LIMITS.challengeTtlMs) throw err('CHALLENGE_EXPIRED', 'Kyçja ka skaduar. Filloni përsëri.', 401);
        const rep = db.reps.find(r => r.id === ch.repId), m = methodsOf(rep).find(x => x.type === method);
        if (!m) throw err('BAD_METHOD', 'Metoda e verifikimit nuk është e disponueshme.', 400);
        ch.method = method; const out = issueCode(ch, m.masked); persist(); return out;
      },
      async verifyCode({ challengeId, code }) {
        const ch = db.challenges[challengeId];
        if (!ch || now() - ch.created > LIMITS.challengeTtlMs) throw err('CHALLENGE_EXPIRED', 'Kyçja ka skaduar. Filloni përsëri.', 401);
        checkCode(ch, code, () => delete db.challenges[challengeId]);
        const rep = db.reps.find(r => r.id === ch.repId), token = secureToken();
        db.sessions[token] = { repId: rep.id, teamId: rep.teamId, expires: now() + LIMITS.sessionMs }; delete db.challenges[challengeId]; persist();
        return { token, rep: { name: rep.name, username: rep.username }, team: { id: rep.teamId, name: db.teams[rep.teamId].name } };
      },
      async me(token) { const a = auth(token); return { rep: { name: a.rep.name, username: a.rep.username }, team: { id: a.teamId, name: a.team.name } }; },
      async logout(token) { delete db.sessions[token]; persist(); },
      async getRoster(token) { const a = auth(token); return clone(normRoster({ ...a.team, version: a.team.version })); },
      async saveRoster(token, roster) {
        const a = auth(token), r = normRoster(roster), errs = validateRoster(r);
        if (errs.length) throw err('VALIDATION', errs[0], 422, errs);
        a.team.players = r.players; a.team.officials = r.officials; a.team.kits = r.kits; a.team.version = (a.team.version || 0) + 1; persist();
        return clone(normRoster(a.team));
      },
      async listMatches(token) {
        const a = auth(token);
        return db.matches.filter(m => m.homeTeamId === a.teamId || m.awayTeamId === a.teamId).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))
          .map(m => ({ id: m.id, home: m.home, away: m.away, date: m.date, time: m.time, venue: m.venue, competition: m.competition, round: m.round, locked: m.locked, side: m.homeTeamId === a.teamId ? 'home' : 'away', submitted: !!db.sheets[m.id + '|' + a.teamId] }));
      },
      async getSheet(token, matchId) {
        const a = auth(token), m = db.matches.find(x => x.id === matchId);
        if (!m || (m.homeTeamId !== a.teamId && m.awayTeamId !== a.teamId)) throw err('FORBIDDEN', 'Kjo ndeshje nuk i përket skuadrës suaj.', 403);
        const s = db.sheets[m.id + '|' + a.teamId];
        return clone({ locked: m.locked, submitted: !!s, sheet: s ? s.sheet : normSheet({ kitSet: 'first', kit: a.team.kits.first }) });
      },
      async saveSheet(token, matchId, sheet) {
        const a = auth(token), m = db.matches.find(x => x.id === matchId);
        if (!m || (m.homeTeamId !== a.teamId && m.awayTeamId !== a.teamId)) throw err('FORBIDDEN', 'Kjo ndeshje nuk i përket skuadrës suaj.', 403);
        if (m.locked) throw err('LOCKED', 'Lista e kësaj ndeshjeje është e kyçur.', 423);
        const s = normSheet(sheet), roster = normRoster(a.team), errs = validateSheet(s, roster);
        if (errs.length) throw err('VALIDATION', errs[0], 422, errs);
        db.sheets[m.id + '|' + a.teamId] = { sheet: s, snapshot: buildSnapshot(roster, s), savedAt: now() }; persist();
        return clone({ locked: false, submitted: true, sheet: s });
      },
      async getContacts(token) { const a = auth(token); return { email: maskEmail(a.rep.email), phone: maskPhone(a.rep.phone) }; },
      async startContactChange(token, { type, value }) {
        const a = auth(token), v = type === 'phone' ? cleanPhone(value) : str(value, 120).toLowerCase();
        if (!validContact(type, v)) throw err('VALIDATION', type === 'phone' ? 'Numri duhet të ketë formatin ndërkombëtar, p.sh. +38344123456.' : 'Shkruani një email të vlefshëm.', 422);
        const holder = db.pending[a.rep.id] || (db.pending[a.rep.id] = {});
        holder.type = type; holder.value = v; const out = issueCode(holder, type === 'email' ? maskEmail(v) : maskPhone(v)); persist(); return out;
      },
      async confirmContactChange(token, { code }) {
        const a = auth(token), holder = db.pending[a.rep.id];
        if (!holder) throw err('NO_CODE', 'Kërkoni fillimisht një kod.', 400);
        checkCode(holder, code, () => delete db.pending[a.rep.id]);
        a.rep[holder.type] = holder.value; delete db.pending[a.rep.id]; persist();
        return { email: maskEmail(a.rep.email), phone: maskPhone(a.rep.phone) };
      },
      _snapshotFor(teamId, matchId) { return clone(db.sheets[matchId + '|' + teamId]?.snapshot || null); },
      reset() { db = seed(); persist(); }
    };
  }

  /* ---------- Adapteri i PORTALIT (prodhim) ---------- */
  function createPortalAdapter({ portal, fetchImpl, fallbackTeams }) {
    const f = fetchImpl || ((...a) => global.fetch(...a));
    async function call(method, path, body, token) {
      let res;
      try { res = await f(portal + '/api/team' + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
      catch { throw new TeamError('NETWORK', 'Lidhja me serverin dështoi. Provoni përsëri.', 0); }
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new TeamError(out.code || 'ERROR', out.error || 'Lidhja dështoi.', res.status, out.details);
      return out;
    }
    return {
      demo: false,
      async listTeams() { try { return (await call('GET', '/teams')).teams; } catch (e) { if (fallbackTeams) return fallbackTeams(); throw e; } },
      startLogin: b => call('POST', '/auth/start', b),
      sendCode: b => call('POST', '/auth/send', b),
      verifyCode: b => call('POST', '/auth/verify', b),
      me: t => call('GET', '/me', null, t),
      logout: t => call('POST', '/auth/logout', {}, t).catch(() => { }),
      getRoster: t => call('GET', '/roster', null, t),
      saveRoster: (t, r) => call('PUT', '/roster', r, t),
      listMatches: async t => (await call('GET', '/matches', null, t)).matches,
      getSheet: (t, id) => call('GET', '/matches/' + encodeURIComponent(id) + '/sheet', null, t),
      saveSheet: (t, id, s) => call('PUT', '/matches/' + encodeURIComponent(id) + '/sheet', s, t),
      getContacts: t => call('GET', '/contacts', null, t),
      startContactChange: (t, b) => call('POST', '/contacts/start', b, t),
      confirmContactChange: (t, b) => call('POST', '/contacts/confirm', b, t)
    };
  }

  global.TeamCore = { ROLES, KIT_SETS, LIMITS, TeamError, normRoster, validateRoster, normSheet, validateSheet, buildSnapshot, snapshotToTeam, snapshotKey, maskEmail, maskPhone, cleanPhone, validContact, uid, createLocalAdapter, createPortalAdapter };
})(typeof window !== 'undefined' ? window : globalThis);
