# Portali i skuadrave: kontrata e API-së

Ndërfaqja (`team-app.js`) flet me `PORTAL + '/api/team-auth'` (POST me `action`) përmes `createPortalAdapter` te `team-core.js`.
Nuk ka zgjedhje skuadre në kyçje: përfaqësuesi shkruan vetëm përdoruesin dhe fjalëkalimin, dhe skuadra
merret automatikisht nga llogaria e krijuar te **Sports Stats Live → Admin → Përfaqësuesit e skuadrave**.
Modi demo provohet me `…/#demo` (përdorues `demo1` / `Demo-1234`, `demo2` / `Demo-1234`).
Hapni `…/#skuadra` për të shkuar drejt te kyçja e skuadrës në prodhim.

**Rregulla të detyrueshme në server (klienti nuk mund t’i zbatojë me siguri):**
1. Skuadra gjithmonë nxirret nga token-i i sesionit, kurrë nga trupi ose URL-ja e kërkesës.
2. `login`: kontrollo fillimisht përdoruesin+fjalëkalimin; skuadra merret nga përfaqësuesi. Mos zbulo nëse përdoruesi ekziston.
3. Nuk ka kod verifikimi: pas fjalëkalimit të saktë hapet sesioni (12 orë); pas 5 fjalëkalimeve të gabuar bllokim 1 minutë. Token-i i sesionit ruhet vetëm si hash.
4. Çdo `matchId` verifikohet që i përket skuadrës së sesionit (`403 FORBIDDEN`). Ndeshja e kyçur refuzon shkrimin (`423 LOCKED`).
5. Server-i përsërit validimin (shih `validateRoster` / `validateSheet`): lojtar ≤ 14 në listë, ≤ 5 startues, ≤ 1 kapiten, numra fanelle 1–99 pa dublikim.
6. Gabimet kthehen si `{ "error": "mesazh shqip", "code": "KOD", "details": [..] }`.

| Veprimi (`POST /api/team-auth`) | Trupi | Përgjigja |
|---|---|---|
| `GET ?action=teams` | – | `{teams:[{id,name,league}]}` (publike) |
| `login` | `{username,password}` | `{sessionToken, expiresAt, representative, team:{id,name,league}}` |
| `logout` | – | `{ok:true}` |
| `me` | – | `{representative, team}` |
| `roster` / `roster-save` | `{roster}` | `{players:[{id,shirtNo,name,idNumber}], officials:[{id,role,name,idNumber}], kits:{first\|second\|third:{shirt,shorts,socks}}, version}` |
| `matches` | – | `{matches:[{id,home,away,date,time,venue,competition,round,locked,side,submitted}]}` |
| `sheet` / `sheet-save` | `{matchId, sheet:{kitSet,kit:{shirt,shorts,socks},players:[{id,captain,starter}],officialIds:[]}}` | `{locked, submitted, sheet}` |
| `contacts` | – | `{email,phone}` (të maskuara) |

Të gjitha veprimet përveç `login` kërkojnë headerin `Authorization: Bearer <sessionToken>`.
Ndryshimi i email-it/telefonit bëhet nga administratori.

## Lidhja me procesverbalin e delegatit
Kur përfaqësuesi ruan roster-in, serveri e sinkronizon edhe te lista publike `players` e Portalit
(pa publikuar `idNumber`). Delegati e merr roster-in aktual kur hap ndeshjen, edhe nëse përfaqësuesi
nuk e ka ruajtur ende listën e ndeshjes. Nëse ekziston listë e ruajtur për ndeshjen, ruhen shenjat
kapiten/startues për lojtarët përkatës.

`saveSheet` ruan gjithashtu një *snapshot* (shih `buildSnapshot`), që delegati ta marrë kur hap ndeshjen:
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
- Delegati e ka plotësuar tashmë → lojtarët e rinj shtohen te rreshtat bosh pa fshirë të dhënat ekzistuese. Nëse lista është e plotë, shfaqet “Merr listën”; zëvendësimi i plotë kërkon konfirmim.
- Pasi fillon ndeshja (`phase` ≠ `setup`) ose pasi kyçet redaktimi, lista nuk preket më.
- Server-i duhet ta kthejë `team_sheets` vetëm për delegatin e caktuar për atë ndeshje (kontrolli i caktimit që e keni tashmë te `/api/protocol`). Snapshot-i përmban numrat ID: mos i përfshini në publikimin live te Portali.

## Supabase
Kyçja bëhet me përdorues+fjalëkalim në Worker (`/api/team-auth`); nuk përdoret OTP/kod. Kontrolli i skuadrës së caktuar bëhet gjithmonë në server (RLS ose Worker).
