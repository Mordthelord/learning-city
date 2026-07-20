/* ============================================================================
   AI.B.C analytics — zero-dep playtime / gameplay / mastery / feedback tracking
   ----------------------------------------------------------------------------
   POST /track        {device, cls, grade, events:[{t,e,...}]}   (from the game)
   GET  /stats.json   aggregated numbers (ADMIN_KEY-protected if set)
   GET  /dashboard    self-contained HTML dashboard over /stats.json

   Storage: append-only JSONL at $DATA_DIR/telemetry.jsonl (default ./data).
   Aggregates rebuild from the file on boot, update in memory per event.
   No child names are ever collected — devices are anonymous random ids.
   ============================================================================ */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "telemetry.jsonl");
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const day = (t) => { const d = new Date(+t || Date.now()); return d.toISOString().slice(0, 10); };

/* ---------------- in-memory aggregates ---------------- */
const A = {
  devices: new Set(), classes: new Set(),
  totalMinutes: 0, totalAnswers: 0, firstTry: 0, gamesStarted: 0, gamesFinished: 0,
  days: {},        // date -> {devices:Set, minutes, answers, games}
  templates: {},   // tpl  -> {name, plays, finishes, attempts, firstTry, rtMs, ratingsSum, ratingsN, diff:{easy,right,hard}}
  skills: {},      // subject/skill -> {attempts, firstTry}
  grades: {},      // grade -> device Set
  comments: [],    // last 120 {d,tpl,stars,diff,text}
  firstEvent: null, lastEvent: null,
};
const T = (tpl, name) => (A.templates[tpl] = A.templates[tpl] ||
  { name: name || tpl, plays: 0, finishes: 0, attempts: 0, firstTry: 0, rtMs: 0, ratingsSum: 0, ratingsN: 0, diff: { easy: 0, right: 0, hard: 0 } });
const D = (t) => { const k = day(t); return (A.days[k] = A.days[k] || { devices: new Set(), minutes: 0, answers: 0, games: 0 }); };
const S = (k) => (A.skills[k] = A.skills[k] || { attempts: 0, firstTry: 0 });

function apply(rec) {
  const { device, cls, grade } = rec, e = rec.ev || {};
  const t = +e.t || Date.now();
  if (!A.firstEvent || t < A.firstEvent) A.firstEvent = t;
  if (!A.lastEvent || t > A.lastEvent) A.lastEvent = t;
  if (device) { A.devices.add(device); D(t).devices.add(device); }
  if (cls) A.classes.add(cls);
  if (grade) { (A.grades[grade] = A.grades[grade] || new Set()).add(device); }
  switch (e.e) {
    case "ping": A.totalMinutes++; D(t).minutes++; break;
    case "game_start": A.gamesStarted++; D(t).games++; T(e.tpl, e.name).plays++; break;
    case "game_end": {
      const g = T(e.tpl, e.name); g.finishes++; A.gamesFinished++;
      break;
    }
    case "answer": {
      const g = T(e.tpl); g.attempts++; A.totalAnswers++; D(t).answers++;
      if (e.ok) { g.firstTry++; A.firstTry++; }
      g.rtMs += Math.min(60000, +e.rt || 0);
      if (e.subject) { const s = S(e.subject); s.attempts++; if (e.ok) s.firstTry++; }
      if (e.skill && e.skill !== e.subject) { const s = S(e.subject ? e.subject + " · " + e.skill : e.skill); s.attempts++; if (e.ok) s.firstTry++; }
      break;
    }
    case "rating": {
      const g = T(e.tpl, e.name);
      if (e.stars >= 1 && e.stars <= 5) { g.ratingsSum += +e.stars; g.ratingsN++; }
      if (e.diff && g.diff[e.diff] !== undefined) g.diff[e.diff]++;
      if (e.text || e.stars) {
        A.comments.push({ d: day(t), tpl: e.tpl, stars: +e.stars || null, diff: e.diff || null, text: String(e.text || "").slice(0, 300) });
        if (A.comments.length > 120) A.comments.shift();
      }
      break;
    }
  }
}

/* rebuild from disk on boot */
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    const lines = fs.readFileSync(FILE, "utf8").split("\n");
    for (const l of lines) { if (!l.trim()) continue; try { apply(JSON.parse(l)); } catch (_) {} }
    console.log(`📊 analytics: replayed ${lines.length} stored events`);
  }
} catch (err) { console.warn("analytics boot:", err.message); }

/* ---------------- handlers ---------------- */
export async function handleTrack(body) {
  const device = String(body.device || "").slice(0, 24);
  const cls = String(body.cls || "").slice(0, 12) || null;
  const grade = String(body.grade || "").slice(0, 8) || null;
  const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
  if (!device || !events.length) return { status: 400, json: { ok: false, reason: "device + events required" } };
  let out = "";
  for (const ev of events) {
    if (!ev || typeof ev.e !== "string") continue;
    const rec = { device, cls, grade, ev };
    apply(rec);
    out += JSON.stringify(rec) + "\n";
  }
  if (out) { try { fs.appendFileSync(FILE, out); } catch (err) { console.warn("analytics write:", err.message); } }
  return { status: 200, json: { ok: true, received: events.length } };
}

export function statsJSON() {
  const tpl = {};
  for (const k in A.templates) { const g = A.templates[k];
    tpl[k] = { name: g.name, plays: g.plays, finishes: g.finishes, answers: g.attempts,
      accuracyPct: g.attempts ? Math.round(100 * g.firstTry / g.attempts) : null,
      avgAnswerSec: g.attempts ? Math.round(g.rtMs / g.attempts / 100) / 10 : null,
      avgStars: g.ratingsN ? Math.round(10 * g.ratingsSum / g.ratingsN) / 10 : null,
      ratings: g.ratingsN, difficultyVotes: g.diff }; }
  const days = {};
  for (const k of Object.keys(A.days).sort()) { const d = A.days[k];
    days[k] = { activeDevices: d.devices.size, minutes: d.minutes, answers: d.answers, gamesStarted: d.games }; }
  const skills = {};
  for (const k in A.skills) { const s = A.skills[k];
    skills[k] = { answers: s.attempts, accuracyPct: s.attempts ? Math.round(100 * s.firstTry / s.attempts) : null }; }
  const grades = {}; for (const k in A.grades) grades[k] = A.grades[k].size;
  return {
    ok: true, generatedAt: new Date().toISOString(),
    overview: {
      totalDevices: A.devices.size, classes: A.classes.size,
      totalPlayMinutes: A.totalMinutes, totalPlayHours: Math.round(A.totalMinutes / 6) / 10,
      gamesStarted: A.gamesStarted, gamesFinished: A.gamesFinished,
      questionsAnswered: A.totalAnswers,
      firstTryAccuracyPct: A.totalAnswers ? Math.round(100 * A.firstTry / A.totalAnswers) : null,
      firstEvent: A.firstEvent ? new Date(A.firstEvent).toISOString() : null,
      lastEvent: A.lastEvent ? new Date(A.lastEvent).toISOString() : null,
    },
    perGame: tpl, perSkill: skills, perDay: days, gradeDevices: grades, feedback: A.comments.slice().reverse(),
  };
}

export function authorized(url) {
  if (!ADMIN_KEY) return true;
  return url.searchParams.get("key") === ADMIN_KEY;
}

export function dashboardHTML(url) {
  const key = url.searchParams.get("key") || "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI.B.C — Pilot Dashboard</title><style>
body{font-family:system-ui,Segoe UI,sans-serif;background:#0d1026;color:#e8eaf5;margin:0;padding:24px}
h1{font-size:22px;margin:0 0 4px} .sub{color:#9aa3d0;font-size:13px;margin-bottom:20px}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
.card{background:#171b38;border:1px solid #2a3060;border-radius:14px;padding:14px 18px;min-width:130px}
.card b{display:block;font-size:26px;margin-bottom:2px}.card span{font-size:12px;color:#9aa3d0}
table{border-collapse:collapse;width:100%;margin-bottom:26px;font-size:13px}
th{text-align:left;color:#9aa3d0;font-weight:600;padding:6px 10px;border-bottom:1px solid #2a3060}
td{padding:6px 10px;border-bottom:1px solid #1e2347}
h2{font-size:15px;margin:18px 0 8px;color:#bfc8f0}
.bar{height:8px;border-radius:4px;background:#2a3060;overflow:hidden;min-width:80px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#57d98a,#37b8d0)}
.cmt{background:#171b38;border:1px solid #2a3060;border-radius:10px;padding:8px 12px;margin-bottom:6px;font-size:13px}
.cmt small{color:#9aa3d0}</style></head><body>
<h1>🌆 AI.B.C — Pilot Dashboard</h1><div class="sub" id="gen">loading…</div>
<div class="cards" id="cards"></div>
<h2>🎮 Per game</h2><table id="games"><thead><tr><th>Game</th><th>Plays</th><th>Finished</th><th>Answers</th><th>First-try %</th><th>Avg sec/answer</th><th>⭐ Rating</th><th>Difficulty votes (😴/🙂/🤯)</th></tr></thead><tbody></tbody></table>
<h2>📚 Per subject / skill</h2><table id="skills"><thead><tr><th>Skill</th><th>Answers</th><th>First-try %</th><th></th></tr></thead><tbody></tbody></table>
<h2>📅 Per day</h2><table id="days"><thead><tr><th>Date</th><th>Active kids</th><th>Minutes played</th><th>Answers</th><th>Games started</th></tr></thead><tbody></tbody></table>
<h2>💬 Latest feedback</h2><div id="fb"></div>
<script>
fetch("/stats.json?key=${encodeURIComponent(key)}").then(r=>r.json()).then(s=>{
  if(!s.ok){ document.getElementById("gen").textContent="Not authorized — add ?key=YOUR_ADMIN_KEY to the URL"; return; }
  const o=s.overview;
  document.getElementById("gen").textContent="Generated "+new Date(s.generatedAt).toLocaleString()+" · data since "+(o.firstEvent?new Date(o.firstEvent).toLocaleDateString():"—");
  const cards=[["Kids (devices)",o.totalDevices],["Classes",o.classes],["Play time",o.totalPlayHours+" h"],
    ["Games started",o.gamesStarted],["Questions answered",o.questionsAnswered],["First-try accuracy",(o.firstTryAccuracyPct??"—")+"%"]];
  document.getElementById("cards").innerHTML=cards.map(c=>'<div class="card"><b>'+c[1]+'</b><span>'+c[0]+'</span></div>').join("");
  const gb=document.querySelector("#games tbody");
  gb.innerHTML=Object.entries(s.perGame).sort((a,b)=>b[1].plays-a[1].plays).map(([k,g])=>
    "<tr><td>"+(g.name||k)+"</td><td>"+g.plays+"</td><td>"+g.finishes+"</td><td>"+g.answers+"</td><td>"+(g.accuracyPct??"—")+
    "%</td><td>"+(g.avgAnswerSec??"—")+"</td><td>"+(g.avgStars?g.avgStars+" ("+g.ratings+")":"—")+
    "</td><td>"+g.difficultyVotes.easy+" / "+g.difficultyVotes.right+" / "+g.difficultyVotes.hard+"</td></tr>").join("");
  const sb=document.querySelector("#skills tbody");
  sb.innerHTML=Object.entries(s.perSkill).sort((a,b)=>b[1].answers-a[1].answers).map(([k,v])=>
    "<tr><td>"+k+"</td><td>"+v.answers+"</td><td>"+(v.accuracyPct??"—")+'%</td><td><div class="bar"><i style="width:'+(v.accuracyPct||0)+'%"></i></div></td></tr>').join("");
  const db=document.querySelector("#days tbody");
  db.innerHTML=Object.entries(s.perDay).reverse().map(([k,d])=>
    "<tr><td>"+k+"</td><td>"+d.activeDevices+"</td><td>"+d.minutes+"</td><td>"+d.answers+"</td><td>"+d.gamesStarted+"</td></tr>").join("");
  document.getElementById("fb").innerHTML=s.feedback.length? s.feedback.map(c=>
    '<div class="cmt">'+(c.stars?"⭐".repeat(c.stars)+" · ":"")+(c.diff?({easy:"😴 too easy",right:"🙂 just right",hard:"🤯 too hard"})[c.diff]+" · ":"")+
    (c.text?c.text.replace(/[<>&]/g,ch=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[ch])):"<i>(no comment)</i>")+' <small>· '+(c.tpl||"")+" · "+c.d+"</small></div>").join("")
    : "<div class='cmt'><i>No feedback yet.</i></div>";
});
</script></body></html>`;
}
