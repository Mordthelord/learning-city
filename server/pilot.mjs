/* ============================================================================
   AI.B.C — Pilot Data Portal (r28)
   ----------------------------------------------------------------------------
   GET /pilot                 the portal page (asks for the admin key once,
                              keeps it in sessionStorage — shareable link)
   GET /pilot-data.json?key=  everything the portal shows in one payload
   GET /device.json?key=&device=   one player's full drilldown
   GET /export.json?key=      ALL raw telemetry (JSON array)
   GET /export.csv?key=       ALL raw telemetry (flat CSV for Excel/Sheets)

   Privacy: players are anonymous device ids — there are no child names
   anywhere in this data, by design.
   ============================================================================ */
import { statsJSON, devicesJSON, deviceDetail, telemetryBytes } from "./analytics.mjs";
import { consentOf, consentSummary } from "./consent.mjs";
import { budgetJSON } from "./budget.mjs";
import { DATA_DIR, DURABLE } from "./store.mjs";

export function pilotDataJSON() {
  const stats = statsJSON();
  const devices = devicesJSON().map((d) => {
    const c = consentOf(d.device);
    return { ...d, consent: c ? { granted: !!c.granted, role: c.role, at: c.at, ver: c.ver } : null };
  });
  return {
    ok: true, generatedAt: new Date().toISOString(),
    storage: { dir: DATA_DIR, durable: DURABLE, telemetryBytes: telemetryBytes(),
      note: DURABLE ? "persistent disk — data survives deploys & restarts"
                    : "EPHEMERAL storage — add a Render disk at /var/data (Settings → Disks) to keep data across deploys" },
    overview: stats.overview,
    consent: consentSummary(),
    devices,
    perDay: stats.perDay,
    perGame: stats.perGame,
    perSkill: stats.perSkill,
    feedback: stats.feedback,
    budget: budgetJSON(),
  };
}

export function deviceJSON(device) {
  const d = deviceDetail(device);
  if (d.ok) d.consent = consentOf(device);
  return d;
}

/* ---------------- the portal page ---------------- */
export function pilotHTML() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI.B.C — Pilot Data Portal</title><style>
:root{--bg:#0d1026;--panel:#171b38;--line:#2a3060;--mut:#9aa3d0;--txt:#e8eaf5;--good:#57d98a;--warn:#ffcf5c;--bad:#ff7a7a;--acc:#9ef0ff}
body{font-family:system-ui,'Segoe UI',sans-serif;background:var(--bg);color:var(--txt);margin:0;padding:22px}
h1{font-size:21px;margin:0 0 2px} h2{font-size:15px;margin:22px 0 8px;color:#bfc8f0}
.sub{color:var(--mut);font-size:12.5px;margin-bottom:16px}
.cards{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 6px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:12px 16px;min-width:118px}
.card b{display:block;font-size:24px;margin-bottom:1px}.card span{font-size:11.5px;color:var(--mut)}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th{text-align:left;color:var(--mut);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap;user-select:none}
td{padding:6px 8px;border-bottom:1px solid #1e2347;white-space:nowrap}
tr.dev:hover{background:#1b2046;cursor:pointer}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:700}
.ok{background:rgba(87,217,138,.16);color:var(--good)} .no{background:rgba(255,122,122,.16);color:var(--bad)}
.warnp{background:rgba(255,207,92,.16);color:var(--warn)}
.bar{height:7px;border-radius:4px;background:var(--line);overflow:hidden;min-width:60px;display:inline-block;width:80px;vertical-align:middle}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#57d98a,#37b8d0)}
.btn{background:linear-gradient(180deg,#2d3878,#1d2450);border:1px solid #3a478f;color:#fff;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn:hover{filter:brightness(1.15)}
#keybox{max-width:400px;margin:14vh auto;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:26px;text-align:center}
#keybox input{width:100%;box-sizing:border-box;background:#0d1026;border:1px solid var(--line);color:#fff;border-radius:10px;padding:11px;font-size:15px;margin:12px 0}
#drill{position:fixed;inset:0;background:rgba(5,8,24,.8);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 12px;z-index:9}
#drill .box{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;max-width:760px;width:100%}
.mono{font-family:ui-monospace,monospace;font-size:11px;color:var(--mut)}
.chartrow{display:flex;align-items:flex-end;gap:3px;height:90px;padding:8px 0}
.chartrow .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px}
.chartrow .col i{width:100%;max-width:28px;background:linear-gradient(180deg,#37b8d0,#2d3878);border-radius:3px 3px 0 0;display:block}
.chartrow .col small{font-size:9px;color:var(--mut);transform:rotate(-40deg);white-space:nowrap;margin-top:6px}
.storage{font-size:12px;padding:8px 12px;border-radius:10px;margin:8px 0}
.storage.dur{background:rgba(87,217,138,.1);border:1px solid rgba(87,217,138,.35)}
.storage.eph{background:rgba(255,207,92,.1);border:1px solid rgba(255,207,92,.4)}
@media(max-width:700px){ td,th{font-size:11px;padding:4px 5px} }
</style></head><body>

<div id="keybox">
  <div style="font-size:34px">🔐</div>
  <h1>Pilot Data Portal</h1>
  <p class="sub">Enter the admin key to open the pilot data. It stays only in this browser tab.</p>
  <input id="keyin" type="password" placeholder="ADMIN_KEY" autofocus>
  <button class="btn" onclick="go()">Open portal ▶</button>
  <div id="keyerr" style="color:var(--bad);font-size:12.5px;margin-top:10px"></div>
</div>

<div id="portal" style="display:none">
  <h1>🌆 AI.B.C — Pilot Data Portal</h1>
  <div class="sub" id="gen"></div>
  <div id="storage"></div>
  <div class="cards" id="cards"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px">
    <a class="btn" id="ex-csv">⬇ Export ALL data (CSV)</a>
    <a class="btn" id="ex-json">⬇ Export ALL data (JSON)</a>
    <a class="btn" id="dashlink">📊 Aggregate dashboard</a>
    <button class="btn" onclick="load()">↻ Refresh</button>
  </div>
  <h2>📅 Daily activity <span class="mono">(active players per day)</span></h2>
  <div class="chartrow" id="chart"></div>
  <h2>👥 Players <span class="mono" id="pcount"></span></h2>
  <div class="sub">Every row is one anonymous device (no child names exist in this system). Click a row for the full drilldown.</div>
  <table id="players"><thead><tr>
    <th data-k="device">Player id</th><th data-k="consent">Consent</th><th data-k="grade">Grade</th><th data-k="cls">Class</th>
    <th data-k="lastSeen">Last seen</th><th data-k="activeDays">Days</th><th data-k="minutes">Minutes</th>
    <th data-k="answers">Answers</th><th data-k="accuracyPct">Accuracy</th><th data-k="gamesStarted">Games</th>
    <th>Top skills</th><th data-k="flags">⚑ Flags</th>
  </tr></thead><tbody></tbody></table>
  <h2>💬 Latest feedback</h2><div id="fb"></div>
</div>

<div id="drill"><div class="box">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <h2 style="margin:0" id="d-title">Player</h2>
    <button class="btn" onclick="document.getElementById('drill').style.display='none'">✕ Close</button>
  </div>
  <div id="d-body" style="margin-top:12px">loading…</div>
</div></div>

<script>
let KEY = sessionStorage.getItem("aibc_admin_key") || "";
const $ = (s)=>document.querySelector(s);
const esc = (s)=>String(s==null?"":s).replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
function go(){ KEY = $("#keyin").value.trim(); sessionStorage.setItem("aibc_admin_key", KEY); load(); }
$("#keyin").addEventListener("keydown",e=>{ if(e.key==="Enter") go(); });

let DATA=null, sortK="lastSeen", sortDir=-1;
function load(){
  if(!KEY){ show(false); return; }
  fetch("/pilot-data.json?key="+encodeURIComponent(KEY)).then(r=>r.json()).then(d=>{
    if(!d.ok){ show(false); $("#keyerr").textContent = d.reason==="bad key" ? "That key was not accepted." : (d.reason||"error"); return; }
    DATA=d; show(true); render();
  }).catch(e=>{ show(false); $("#keyerr").textContent="Network error: "+e; });
}
function show(authed){ $("#keybox").style.display=authed?"none":"block"; $("#portal").style.display=authed?"block":"none"; }

function render(){
  const d=DATA, o=d.overview;
  $("#gen").textContent="Generated "+new Date(d.generatedAt).toLocaleString()+" · data since "+(o.firstEvent?new Date(o.firstEvent).toLocaleString():"—");
  $("#storage").innerHTML = '<div class="storage '+(d.storage.durable?'dur':'eph')+'">💾 '+esc(d.storage.note)+' · '+(d.storage.telemetryBytes/1024).toFixed(1)+' KB stored</div>';
  const c=d.consent||{};
  $("#cards").innerHTML=[
    ["Players (devices)",o.totalDevices],["Consented",(c.devicesWithConsent||0)+" ✓"],
    ["Play time",o.totalPlayHours+" h"],["Questions answered",o.questionsAnswered],
    ["First-try accuracy",(o.firstTryAccuracyPct??"—")+"%"],["Games started",o.gamesStarted],
    ["Classes",o.classes],["Data deleted (purges)",c.purgedDevices||0],
    ["AI spend","$"+(d.budget&&d.budget.month?d.budget.month.estSpendUSD:0)]
  ].map(x=>'<div class="card"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join("");
  $("#ex-csv").href="/export.csv?key="+encodeURIComponent(KEY);
  $("#ex-json").href="/export.json?key="+encodeURIComponent(KEY);
  $("#dashlink").href="/dashboard?key="+encodeURIComponent(KEY);
  // daily chart
  const days=Object.entries(d.perDay); const mx=Math.max(1,...days.map(([,v])=>v.activeDevices));
  $("#chart").innerHTML=days.slice(-30).map(([k,v])=>
    '<div class="col" title="'+k+': '+v.activeDevices+' players · '+v.minutes+' min · '+v.answers+' answers">'+
    '<i style="height:'+Math.max(3,Math.round(70*v.activeDevices/mx))+'px"></i><small>'+k.slice(5)+'</small></div>').join("")
    || '<span class="sub">no activity yet</span>';
  renderTable();
  $("#fb").innerHTML=(d.feedback||[]).slice(0,25).map(f=>
    '<div style="background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:7px 11px;margin-bottom:5px;font-size:12.5px">'+
    (f.stars?"⭐".repeat(f.stars)+" · ":"")+esc(f.text||"(no text)")+
    ' <span class="mono">· '+esc(f.tpl||"")+' · '+f.d+(f.device?' · '+esc(f.device):'')+'</span></div>').join("")
    || '<span class="sub">none yet</span>';
}
function flagsOf(p){ return (p.distress?p.distress+"×😟 ":"")+(p.reports?p.reports+"×🚩 ":"")+(p.breaks?p.breaks+"×☕ ":"")+(p.notForMe?p.notForMe+"×🙅":""); }
function renderTable(){
  const rows=[...DATA.devices];
  rows.sort((a,b)=>{ let A=a[sortK],B=b[sortK];
    if(sortK==="consent"){A=a.consent&&a.consent.granted?1:0;B=b.consent&&b.consent.granted?1:0;}
    if(sortK==="flags"){A=(a.distress||0)*10+(a.reports||0);B=(b.distress||0)*10+(b.reports||0);}
    if(A==null)A=-1; if(B==null)B=-1;
    return (A<B?-1:A>B?1:0)*sortDir; });
  $("#pcount").textContent="("+rows.length+")";
  $("#players tbody").innerHTML=rows.map(p=>{
    const cons=p.consent? (p.consent.granted?'<span class="pill ok">✓ '+p.consent.role+'</span>':'<span class="pill no">withdrawn</span>')
                        : '<span class="pill warnp">none</span>';
    return '<tr class="dev" data-d="'+esc(p.device)+'"><td class="mono">'+esc(p.device)+'</td><td>'+cons+'</td><td>'+esc(p.grade??"—")+'</td><td>'+esc(p.cls??"—")+
    '</td><td>'+(p.lastSeen?new Date(p.lastSeen).toLocaleString():"—")+'</td><td>'+p.activeDays+'</td><td>'+p.minutes+
    '</td><td>'+p.answers+'</td><td>'+(p.accuracyPct??"—")+'% <span class="bar"><i style="width:'+(p.accuracyPct||0)+'%"></i></span></td><td>'+p.gamesStarted+
    '</td><td style="white-space:normal;max-width:220px">'+esc((p.topSkills||[]).join(" · "))+'</td><td>'+flagsOf(p)+'</td></tr>';
  }).join("") || '<tr><td colspan="12" class="sub">no players yet — data appears as soon as someone plays</td></tr>';
  document.querySelectorAll("#players th[data-k]").forEach(th=>th.onclick=()=>{
    const k=th.getAttribute("data-k"); if(sortK===k) sortDir*=-1; else { sortK=k; sortDir=-1; } renderTable(); });
  document.querySelectorAll("tr.dev").forEach(tr=>tr.onclick=()=>drill(tr.getAttribute("data-d")));
}
function drill(dev){
  $("#drill").style.display="flex"; $("#d-title").textContent="👤 "+dev; $("#d-body").textContent="loading…";
  fetch("/device.json?key="+encodeURIComponent(KEY)+"&device="+encodeURIComponent(dev)).then(r=>r.json()).then(d=>{
    if(!d.ok){ $("#d-body").textContent=d.reason||"error"; return; }
    const s=d.summary, cons=d.consent;
    const skills=Object.entries(d.perSkill).sort((a,b)=>b[1].answers-a[1].answers);
    const games=Object.entries(d.perGame).sort((a,b)=>b[1].answers-a[1].answers);
    $("#d-body").innerHTML=
      '<div class="cards">'+[["Grade",s.grade??"—"],["Class",s.cls??"—"],["Active days",s.activeDays.length],
        ["Minutes",s.minutes],["Answers",s.answers],["Accuracy",(s.accuracyPct??"—")+"%"],
        ["Games",s.gamesStarted],["Distress",s.distress],["Reports",s.reports]]
        .map(x=>'<div class="card"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join("")+'</div>'+
      '<div class="sub">Consent: '+(cons?(cons.granted?'✓ '+cons.role+" · "+new Date(cons.at).toLocaleString()+" · "+esc(cons.ver):'withdrawn'):'not recorded')+
      ' · first seen '+(s.firstSeen?new Date(s.firstSeen).toLocaleString():"—")+'</div>'+
      '<h2>📚 Skills</h2><table><thead><tr><th>Skill</th><th>Answers</th><th>Accuracy</th></tr></thead><tbody>'+
      skills.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+v.answers+'</td><td>'+(v.accuracyPct??"—")+'% <span class="bar"><i style="width:'+(v.accuracyPct||0)+'%"></i></span></td></tr>').join("")+'</tbody></table>'+
      '<h2>🎮 Games</h2><table><thead><tr><th>Game</th><th>Plays</th><th>Answers</th><th>Accuracy</th></tr></thead><tbody>'+
      games.map(([k,v])=>'<tr><td>'+esc(v.name||k)+'</td><td>'+v.plays+'</td><td>'+v.answers+'</td><td>'+(v.accuracyPct??"—")+'%</td></tr>').join("")+'</tbody></table>'+
      '<h2>🕒 Recent events ('+d.recentEvents.length+')</h2><div class="mono" style="max-height:220px;overflow:auto;background:#0d1026;border-radius:10px;padding:10px">'+
      d.recentEvents.slice().reverse().map(r=>esc(new Date(+r.ev.t||0).toLocaleString()+"  "+r.ev.e+"  "+(r.ev.tpl||"")+" "+(r.ev.e==="answer"?(r.ev.ok?"✓":"✗")+" "+(r.ev.subject||""):""))).join("<br>")+'</div>';
  });
}
if(KEY) load(); else show(false);
setInterval(()=>{ if(DATA) load(); }, 90000);
</script></body></html>`;
}
