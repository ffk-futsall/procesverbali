# Portali i skuadrave: kontrata e API-së

Ndërfaqja (`team-app.js`) flet me `PORTAL + '/api/team/...'` përmes `createPortalAdapter` te `team-core.js`.
Deri sa Portali të i zbatojë këto endpoint-e, ndërfaqja provohet me **modin demo**: hapni `…/#demo`
(përdorues `demo1` / `Demo-1234` te skuadra e parë, `demo2` te e dyta; kodi shfaqet në ekran).
Hapni `…/#skuadra` për të shkuar drejt te kyçja e skuadrës në prodhim.

**Rregulla të detyrueshme në server (klienti nuk mund t’i zbatojë me siguri):**
1. Skuadra gjithmonë nxirret nga token-i i sesionit, kurrë nga trupi ose URL-ja e kërkesës.
2. `/auth/start`: kontrollo fillimisht përdoruesin+fjalëkalimin; vetëm pastaj kontrollo që përdoruesi është i caktuar për `teamId`, përndryshe `403 TEAM_MISMATCH`. Mos zbulo nëse përdoruesi ekziston.
3. Kodet: 6 shifra, gjenerim kriptografik, ruhen të hash-uara, skadojnë në 10 min, maks. 5 përpjekje, pritje 30 s për ridërgim, kufizim për IP/përdorues. Dërgohen me email ose SMS (jo kthehen në përgjigje).
4. Çdo `matchId` verifikohet që i përket skuadrës së sesionit (`403 FORBIDDEN`). Ndeshja e kyçur refuzon shkrimin (`423 LOCKED`).
5. Server-i përsërit validimin (shih `validateRoster` / `validateSheet`): lojtar ≤ 14 në listë, ≤ 5 startues, ≤ 1 kapiten, numra fanelle 1–99 pa dublikim.
6. Gabimet kthehen si `{ "error": "mesazh shqip", "code": "KOD", "details": [..] }`.

| Metoda | Rruga | Trupi | Përgjigja |
|---|---|---|---|
| GET | `/teams` | – | `{teams:[{id,name}]}` (publike) |
| POST | `/auth/start` | `{username,password,teamId}` | `{challengeId, methods:[{type:'email'\|'phone', masked}]}` |
| POST | `/auth/send` | `{challengeId,method}` | `{sent:true, resendAfter:30, destination}` |
| POST | `/auth/verify` | `{challengeId,code}` | `{token, rep:{name,username}, team:{id,name}}` |
| POST | `/auth/logout` | – | `{}` |
| GET | `/me` | – | `{rep, team}` |
| GET / PUT | `/roster` | `{players:[{id,shirtNo,name,idNumber}], officials:[{id,role,name,idNumber}], kits:{first\|second\|third:{shirt,shorts,socks}}}` | i njëjti objekt + `version` |
| GET | `/matches` | – | `{matches:[{id,home,away,date,time,venue,competition,round,locked,side,submitted}]}` |
| GET / PUT | `/matches/:id/sheet` | `{kitSet,kit:{shirt,shorts,socks},players:[{id,captain,starter}],officialIds:[]}` | `{locked, submitted, sheet}` |
| GET | `/contacts` | – | `{email,phone}` (të maskuara) |
| POST | `/contacts/start` | `{type:'email'\|'phone', value}` | `{sent, resendAfter, destination}` |
| POST | `/contacts/confirm` | `{code}` | `{email,phone}` (të maskuara) |

## Lidhja me procesverbalin e delegatit
Te `saveSheet` server-i duhet të ruajë edhe një *snapshot* (shih `buildSnapshot`), që delegati ta marrë kur hap ndeshjen:
`{kitSet, kit:{shirt,shorts,socks}, players:[{shirtNo,name,idNumber,captain,starter}], officials:[{role,name,idNumber}]}`.
Kjo përputhet me fushat që procesverbali ka tashmë (`teams.a|b.players/officials/kit`, `captain`, `starter`).

### Si e merr delegati listën (klienti është gati)
Kur delegati hap ndeshjen, `delegate-app.js` thërret `GET /api/protocol?id=<assignmentId>`. Te objekti `assignment` që kthehet, Worker-i duhet të shtojë:

```json
"team_sheets": { "home": <snapshot|null>, "away": <snapshot|null> }
```

ku `home` / `away` janë snapshot-et e ruajtura nga `saveSheet` për skuadrën vendase dhe mysafire të atij `matchId` (formati i mësipërm, nga `buildSnapshot`). Nëse një skuadër nuk e ka ruajtur listën, vendos `null`.

Sjellja e klientit:
- Procesverbali ende nuk ka filluar dhe skuadra A/B është bosh → plotësohet automatikisht (lojtarët sipas numrit të fanellës, kapiteni, startuesit, zyrtarët sipas rolit, ngjyrat e fanellës).
- Delegati e ka plotësuar tashmë, ose përfaqësuesi ndryshoi listën më pas → shfaqet njoftimi “Merr listën”; asgjë nuk mbishkruhet pa konfirmim.
- Pasi fillon ndeshja (`phase` ≠ `setup`) ose pasi kyçet redaktimi, lista nuk preket më.
- Server-i duhet ta kthejë `team_sheets` vetëm për delegatin e caktuar për atë ndeshje (kontrolli i caktimit që e keni tashmë te `/api/protocol`). Snapshot-i përmban numrat ID: mos i përfshini në publikimin live te Portali.

## Supabase
Nëse përdorni Supabase Auth për kodet, `signInWithOtp({email})` / `verifyOtp` mbulon email-in; për SMS duhet ofrues (Twilio etj.).
Çfarëdo qoftë, kontrolli i skuadrës së caktuar duhet të bëhet në server (RLS ose Worker).
