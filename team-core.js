/* Logjika e portalit të skuadrave (pa DOM, e testueshme).
 *
 * Dy adapterë me të njëjtën ndërfaqe:
 *  - createPortalAdapter: flet me Portalin (POST /api/team-auth). Autorizimi zbatohet NË SERVER.
 *    Kontrata është në TEAM-API.md. Kyçja është vetëm me përdorues + fjalëkalim (pa kod).
 *  - createLocalAdapter: MOD DEMO, ruan gjithçka në shfletues. Nuk është siguri e vërtetë;
 *    shërben vetëm për provë para se të lidhet Portali.
 */
(function (global) {
  'use strict';

  const ROLES = ['Përfaqësuesi', 'Trajneri', 'Nd.Trajneri', 'Tr.Portierave', 'Mjeku', 'Fizioterapeuti'];
  const KIT_SETS = [['first', 'Fanella e parë'], ['second', 'Fanella e dytë'], ['third', 'Fanella e tretë']];
  const LIMITS = {
    squad: 14, starters: 5,
    maxLoginFails: 5, lockMs: 60e3, sessionMs: 8 * 3600e3
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
      .map(p => ({
        id: str(p?.id, 40) || uid(), shirtNo: shirtDigits(p?.shirtNo), name: str(p?.name),
        idNumber: str(p?.idNumber, 40), photoPath: str(p?.photoPath, 300), photoName: str(p?.photoName, 160),
        photoUrl: str(p?.photoUrl, 600), documentPath: str(p?.documentPath, 300), documentName: str(p?.documentName, 160),
        documentType: ['passport', 'id-card'].includes(p?.documentType) ? p.documentType : ''
      }))
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
        sheets: {}, sessions: {}, fails: {}
      };
    }
    function auth(token) {
      const s = db.sessions[token];
      if (!s || s.expires < now()) { if (s) { delete db.sessions[token]; persist(); } throw err('UNAUTHENTICATED', 'Sesioni ka përfunduar. Kyçuni përsëri.', 401); }
      return { rep: db.reps.find(r => r.id === s.repId), team: db.teams[s.teamId], teamId: s.teamId };
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
        // Skuadra merret nga përfaqësuesi; një skuadër e dërguar veçmas kontrollohet vetëm nëse përputhet.
        if (teamId && rep.teamId !== teamId) { persist(); throw err('TEAM_MISMATCH', 'Ky përdorues nuk është i caktuar për skuadrën e zgjedhur.', 403); }
        // Pa kod verifikimi: sesioni hapet direkt.
        const token = secureToken();
        db.sessions[token] = { repId: rep.id, teamId: rep.teamId, expires: now() + LIMITS.sessionMs };
        persist();
        return { token, rep: { name: rep.name, username: rep.username }, team: { id: rep.teamId, name: db.teams[rep.teamId]?.name || '' } };
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
      _snapshotFor(teamId, matchId) { return clone(db.sheets[matchId + '|' + teamId]?.snapshot || null); },
      reset() { db = seed(); persist(); }
    };
  }

  /* ---------- Adapteri i PORTALIT (prodhim) ---------- */
  /* Flet me API-në e vërtetë të Portali-t: POST /api/team-auth me "action". */
  function createPortalAdapter({ portal, fetchImpl, fallbackTeams }) {
    const f = fetchImpl || ((...a) => global.fetch(...a));
    const endpoint = portal + '/api/team-auth';
    const errorFrom = (out, status) => new TeamError(out.code || 'ERROR', out.error || 'Lidhja dështoi.', status, out.details);
    async function post(action, body, token) {
      let res;
      try {
        res = await f(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ action, ...(body || {}) })
        });
      } catch { throw new TeamError('NETWORK', 'Lidhja me serverin dështoi. Provoni përsëri.', 0); }
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw errorFrom(out, res.status);
      return out;
    }
    async function listTeams() {
      let res;
      try { res = await f(endpoint + '?action=teams'); }
      catch { if (fallbackTeams) return fallbackTeams(); throw new TeamError('NETWORK', 'Lidhja me serverin dështoi. Provoni përsëri.', 0); }
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { if (fallbackTeams) return fallbackTeams(); throw errorFrom(out, res.status); }
      return out.teams || [];
    }
    const repOut = r => ({ name: [r?.firstName, r?.lastName].filter(Boolean).join(' ').trim() || r?.name || r?.username || '', username: r?.username || '' });
    const teamOut = t => ({ id: t?.id || '', name: t?.name || '' });
    return {
      demo: false,
      listTeams,
      async startLogin({ username, password, newPassword, teamId }) {
        const out = await post('login', { username, password, ...(newPassword !== undefined ? { newPassword } : {}), ...(teamId ? { teamId } : {}) });
        // Pa kod verifikimi: serveri kthen sesionin direkt.
        return { token: out.sessionToken, rep: repOut(out.representative), team: teamOut(out.team) };
      },
      async me(token) { const out = await post('me', null, token); return { rep: repOut(out.representative), team: teamOut(out.team) }; },
      logout: token => post('logout', null, token).catch(() => { }),
      getRoster: token => post('roster', null, token),
      saveRoster: (token, roster) => post('roster-save', { roster }, token),
      async uploadPlayerFile(token, playerId, kind, file, documentType) {
        const ticket = await post('player-file-upload-url', {
          playerId, kind, fileName: file?.name || '', contentType: file?.type || '', size: Number(file?.size || 0)
        }, token);
        const client = global.FFKSupabaseClient;
        if (!client?.storage) throw new TeamError('UPLOAD', 'Ngarkimi nuk është gati. Rifreskoni faqen dhe provoni përsëri.', 0);
        const { error } = await client.storage.from(ticket.bucket).uploadToSignedUrl(
          ticket.path, ticket.token, file, { contentType: file.type, upsert: false }
        );
        if (error) {
          await post('player-file-discard', { playerId, kind, path: ticket.path }, token).catch(() => {});
          throw new TeamError('UPLOAD', error.message || 'Skedari nuk u ngarkua.', 400);
        }
        try {
          const out = await post('player-file-save', {
            playerId, kind, path: ticket.path, fileName: file.name, contentType: file.type, documentType
          }, token);
          return out.roster;
        } catch (e) {
          await post('player-file-discard', { playerId, kind, path: ticket.path }, token).catch(() => {});
          throw e;
        }
      },
      getPlayerDocument: (token, playerId) => post('player-file-download', { playerId, kind: 'document' }, token),
      async removePlayerFile(token, playerId, kind) {
        const out = await post('player-file-save', { playerId, kind, remove: true }, token);
        return out.roster;
      },
      async listMatches(token) {
        const out = await post('matches', null, token);
        return (out.matches || []).map(m => ({
          id: m.id,
          home: typeof m.home === 'string' ? m.home : (m.home?.name || ''),
          away: typeof m.away === 'string' ? m.away : (m.away?.name || ''),
          date: m.date || '', time: m.time || '', venue: m.venue || '', competition: m.competition || '',
          round: m.round ?? m.week ?? '', locked: !!m.locked, side: m.isHome ? 'home' : 'away', submitted: !!m.submitted
        }));
      },
      getSheet: (token, id) => post('sheet', { matchId: id }, token),
      saveSheet: (token, id, sheet) => post('sheet-save', { matchId: id, sheet }, token),
      getContacts: token => post('contacts', null, token)
    };
  }

  global.TeamCore = { ROLES, KIT_SETS, LIMITS, TeamError, normRoster, validateRoster, normSheet, validateSheet, buildSnapshot, snapshotToTeam, snapshotKey, maskEmail, maskPhone, uid, createLocalAdapter, createPortalAdapter };
})(typeof window !== 'undefined' ? window : globalThis);
