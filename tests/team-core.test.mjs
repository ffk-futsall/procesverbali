import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

async function load(){
  const ctx=vm.createContext({crypto:webcrypto,console,Date,JSON,Math,Promise,Error});
  vm.runInContext(await readFile('team-core.js','utf8'),ctx);
  return ctx.TeamCore;
}
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
async function setup(clock={t:Date.now()}){
  const C=await load();
  const a=C.createLocalAdapter({storage:mem(),now:()=>clock.t});
  return {C,a,clock};
}
async function login(a,{username='demo1',password='Demo-1234',teamId}={}){
  return a.startLogin({username,password,...(teamId?{teamId}:{})});
}

test('kyçja kërkon fjalëkalim dhe hap sesionin direkt, pa kod verifikimi',async()=>{
  const {a}=await setup();
  const s=await login(a);
  assert.ok(s.token);assert.equal(s.team.id,'demo-a');
  await assert.rejects(()=>a.startLogin({username:'demo1',password:'gabim',teamId:'demo-a'}),{code:'INVALID_CREDENTIALS'});
  await assert.rejects(()=>a.startLogin({username:'asnjeri',password:'x',teamId:'demo-a'}),{code:'INVALID_CREDENTIALS'});
});

test('përfaqësuesi nuk mund të kyçet te skuadra për të cilën nuk është caktuar',async()=>{
  const {a}=await setup();
  await assert.rejects(()=>a.startLogin({username:'demo1',password:'Demo-1234',teamId:'demo-b'}),{code:'TEAM_MISMATCH'});
  // me fjalëkalim të gabuar nuk zbulohet nëse skuadra përputhet
  await assert.rejects(()=>a.startLogin({username:'demo1',password:'gabim',teamId:'demo-b'}),{code:'INVALID_CREDENTIALS'});
});

test('pa zgjedhur skuadrën, ajo merret automatikisht nga llogaria e përfaqësuesit',async()=>{
  const {a}=await setup();
  const s=await a.startLogin({username:'demo2',password:'Demo-1234'});
  assert.equal(s.team.id,'demo-b');assert.equal(s.team.name,'KF Demo Gjilani');assert.ok(s.token);
  assert.equal((await a.me(s.token)).team.id,'demo-b');
});

test('sesioni skadon dhe pa sesion nuk ka qasje',async()=>{
  const {a,clock}=await setup();
  await assert.rejects(()=>a.getRoster('fals'),{code:'UNAUTHENTICATED'});
  const s=await login(a);
  await a.getRoster(s.token);
  clock.t+=9*3600e3;
  await assert.rejects(()=>a.getRoster(s.token),{code:'UNAUTHENTICATED'});
});

test('blloko pas 5 fjalëkalimeve të gabuar',async()=>{
  const {a}=await setup();
  for(let i=0;i<5;i++)await assert.rejects(()=>a.startLogin({username:'demo1',password:'x',teamId:'demo-a'}),{code:'INVALID_CREDENTIALS'});
  await assert.rejects(()=>a.startLogin({username:'demo1',password:'Demo-1234',teamId:'demo-a'}),{code:'TOO_MANY'});
});

test('lojtarët dhe zyrtarët: shto, edito, fshi dhe validim',async()=>{
  const {a}=await setup();const s=await login(a);
  const r=await a.getRoster(s.token);
  const n=r.players.length;
  r.players.push({id:'x1',shirtNo:'33',name:'Lojtar i Ri',idNumber:'1'});
  r.players[0].name='Emër i Ndryshuar';
  r.officials.push({id:'o1',role:'Menaxher',name:'Zyrtar',idNumber:''});
  const saved=await a.saveRoster(s.token,r);
  assert.equal(saved.players.length,n+1);assert.equal(saved.players[0].name,'Emër i Ndryshuar');
  saved.players=saved.players.filter(p=>p.id!=='x1');saved.officials=saved.officials.filter(o=>o.id!=='o1');
  const after=await a.saveRoster(s.token,saved);
  assert.equal(after.players.length,n);assert.ok(!after.officials.some(o=>o.id==='o1'));
  // numër fanelle i dyfishtë, pa emër, jashtë kufijve
  const dup=await a.getRoster(s.token);dup.players.push({id:'d',shirtNo:dup.players[0].shirtNo,name:'Dublikat'});
  await assert.rejects(()=>a.saveRoster(s.token,dup),{code:'VALIDATION'});
  const noName=await a.getRoster(s.token);noName.players.push({id:'e',shirtNo:'77',name:''});
  await assert.rejects(()=>a.saveRoster(s.token,noName),{code:'VALIDATION'});
});

test('çdo skuadër sheh vetëm të dhënat e veta',async()=>{
  const {a}=await setup();
  const s1=await login(a),s2=await login(a,{username:'demo2',teamId:'demo-b'});
  const r1=await a.getRoster(s1.token),r2=await a.getRoster(s2.token);
  r1.players[0].name='Vetëm A';await a.saveRoster(s1.token,r1);
  assert.notEqual((await a.getRoster(s2.token)).players[0].name,'Vetëm A');
  assert.ok(r2.players.every(p=>!r1.players.some(q=>q.id===p.id)));
  const ms=await a.listMatches(s1.token);
  // ndeshja e kyçur ose jo, skuadra B sheh të njëjtat ndeshje (e njëjta ndeshje) por sheet-et janë të ndara
  const m=ms.find(x=>!x.locked);
  await a.saveSheet(s1.token,m.id,{kitSet:'first',kit:{},players:[{id:r1.players[0].id,captain:true,starter:true}],officialIds:[]});
  assert.equal((await a.getSheet(s2.token,m.id)).submitted,false);
  // lojtar i skuadrës tjetër nuk lejohet në listë
  await assert.rejects(()=>a.saveSheet(s2.token,m.id,{players:[{id:r1.players[0].id}]}),{code:'VALIDATION'});
});

test('lista e ndeshjes: kufijtë 14 / 5 / 1 kapiten, fanellat dhe kyçja',async()=>{
  const {a,C}=await setup();const s=await login(a);
  const r=await a.getRoster(s.token);
  for(let i=0;i<8;i++)r.players.push({id:'p'+i,shirtNo:String(20+i),name:'Lojtar '+i});
  await a.saveRoster(s.token,r);const full=await a.getRoster(s.token);
  const open=(await a.listMatches(s.token)).find(m=>!m.locked),locked=(await a.listMatches(s.token)).find(m=>m.locked);
  const mk=n=>full.players.slice(0,n).map(p=>({id:p.id}));
  await assert.rejects(()=>a.saveSheet(s.token,open.id,{players:mk(15)}),{code:'VALIDATION'});
  await assert.rejects(()=>a.saveSheet(s.token,open.id,{players:mk(6).map(p=>({...p,starter:true}))}),{code:'VALIDATION'});
  await assert.rejects(()=>a.saveSheet(s.token,open.id,{players:mk(3).map(p=>({...p,captain:true}))}),{code:'VALIDATION'});
  const ok=await a.saveSheet(s.token,open.id,{kitSet:'third',kit:{shirt:'jeshile',shorts:'të zeza',socks:'jeshile'},players:mk(14).map((p,i)=>({...p,starter:i<5,captain:i===0})),officialIds:[full.officials[0].id]});
  assert.equal(ok.sheet.kitSet,'third');assert.equal(ok.sheet.players.length,14);
  const snap=a._snapshotFor('demo-a',open.id);
  assert.equal(snap.players.length,14);assert.equal(snap.kit.shirt,'jeshile');assert.equal(snap.officials.length,1);
  assert.ok(snap.players.filter(p=>p.captain).length===1);
  await assert.rejects(()=>a.saveSheet(s.token,locked.id,{players:[]}),{code:'LOCKED'});
  const bad=await a.getSheet(s.token,open.id);assert.equal(bad.submitted,true);
  await assert.rejects(()=>a.getSheet(s.token,'m-ekziston-jo'),{code:'FORBIDDEN'});
});

test('adapteri i portalit flet me API-në e vërtetë (action) dhe përkthen përgjigjet',async()=>{
  const C=await load();const calls=[];
  const fetchImpl=async(url,o)=>{
    calls.push({url,o});const body=JSON.parse(o.body);
    if(body.action==='roster')return {ok:true,status:200,json:async()=>({players:[],officials:[],kits:{first:{shirt:'',shorts:'',socks:''}}})};
    if(body.action==='login')return {ok:true,status:200,json:async()=>({sessionToken:'TOK',expiresAt:'2026-11-18T00:00:00Z',representative:{firstName:'Arben',lastName:'Krasniqi',username:'arben'},team:{id:'t1',name:'Prishtina'}})};
    return {ok:true,status:200,json:async()=>({})};
  };
  const p=C.createPortalAdapter({portal:'https://p.example',fetchImpl});
  await p.getRoster('TOK');
  assert.equal(calls[0].url,'https://p.example/api/team-auth');
  assert.deepEqual(JSON.parse(calls[0].o.body),{action:'roster'});
  assert.equal(calls[0].o.headers.Authorization,'Bearer TOK');
  // kyçja kthen sesionin direkt, pa kod verifikimi
  const v=await p.startLogin({username:'u',password:'p'});
  assert.equal(v.token,'TOK');assert.equal(v.rep.name,'Arben Krasniqi');assert.equal(v.team.name,'Prishtina');
  assert.deepEqual(JSON.parse(calls[1].o.body),{action:'login',username:'u',password:'p'});
  // skuadra e gabuar refuzohet nga serveri
  const bad=C.createPortalAdapter({portal:'https://p.example',fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:'Jo i caktuar',code:'TEAM_MISMATCH'})})});
  await assert.rejects(()=>bad.startLogin({username:'u',password:'p',teamId:'t2'}),{code:'TEAM_MISMATCH',status:403});
});

test('maskimi i kontakteve',async()=>{
  const C=await load();
  assert.equal(C.maskEmail('urim@gmail.com'),'u***@gmail.com');
  assert.ok(!C.maskPhone('+38344123456').includes('44123'));
});

test('snapshot-i i skuadrës kthehet në formën e procesverbalit (14 lojtarë, zyrtarë sipas rolit)',async()=>{
  const {C}=await setup();
  const roles=['Përfaqësuesi','Trajneri','Nd.Trajneri','Tr.Portierave','Mjeku','Fizioterapeuti'];
  const snap={kitSet:'second',kit:{shirt:'e bardhë',shorts:'të bardha',socks:'të bardha'},
    players:[{shirtNo:'7',name:'Arben B',idNumber:'A1',captain:true,starter:true},{shirtNo:'1',name:'Liridon E',idNumber:'A2',captain:true,starter:true}],
    officials:[{role:'Trajneri',name:'Alban I',idNumber:''},{role:'Masazhieri',name:'Ardit K',idNumber:'X9'},{role:'Mjeku',name:'',idNumber:''}]};
  const t=C.snapshotToTeam(snap,roles);
  assert.equal(t.players.length,14);
  assert.equal(t.players[0].name,'Arben B');
  assert.equal(t.players.filter(p=>p.captain).length,1,'vetëm një kapiten');
  assert.equal(t.players[13].name,'');
  assert.equal(JSON.stringify(t.kit),JSON.stringify({shirt:'e bardhë',shorts:'të bardha',socks:'të bardha'}));
  assert.equal(t.officials.find(o=>o.role==='Trajneri').name,'Alban I');
  assert.equal(t.officials.find(o=>o.role==='Mjeku').name,'','zyrtari pa emër nuk plotësohet');
  const extra=t.officials.find(o=>o.role==='Masazhieri');
  assert.ok(extra&&extra.custom===true&&extra.enabled===true);
  assert.equal(C.snapshotToTeam(null,roles),null);
});

test('snapshotKey ndryshon vetëm kur ndryshon lista',async()=>{
  const {C}=await setup();
  const a={kit:{},players:[{shirtNo:'1',name:'A'}],officials:[]};
  const b=JSON.parse(JSON.stringify(a));
  assert.equal(C.snapshotKey(a),C.snapshotKey(b));
  b.players[0].name='B';
  assert.notEqual(C.snapshotKey(a),C.snapshotKey(b));
  assert.equal(C.snapshotKey(null),'');
});

test('snapshot-i nga adapteri demo përputhet me atë që merr delegati',async()=>{
  const {C,a}=await setup();
  const s=await login(a);
  const roster=await a.getRoster(s.token);
  const ids=roster.players.slice(0,3).map(p=>p.id);
  await a.saveSheet(s.token,'m1',{kitSet:'first',kit:roster.kits.first,players:[{id:ids[0],captain:true,starter:true},{id:ids[1],starter:true},{id:ids[2]}],officialIds:[]});
  const snap=a._snapshotFor('demo-a','m1');
  const t=C.snapshotToTeam(snap);
  assert.equal(t.players.filter(p=>p.name).length,3);
  assert.equal(t.players.filter(p=>p.starter).length,2);
  assert.equal(t.players.find(p=>p.captain).name,roster.players[0].name);
});
