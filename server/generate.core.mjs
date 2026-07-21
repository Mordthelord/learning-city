/* ============================================================================
   The Learning Platform — Content Generation core (portable, dependency-free)
   ----------------------------------------------------------------------------
   Turns ANY topic a student types ("addition", "dinosaurs", "Spanish verbs")
   into a validated question bank in the exact shape the games consume:

     { subject, label, prompt, easy:[Item], medium:[Item], hard:[Item] }
     Item = { target:string, correct:string, decoys:[string, string(, string)] }

   This file has NO framework dependencies. Wrap it for Base44, Node, Deno,
   Cloudflare, Vercel, etc. (see server.node.mjs / base44-function.js).

   Security: the Anthropic API key is passed in by the wrapper (from a server
   secret) and NEVER reaches the browser.
   ============================================================================ */

export const CONFIG = {
  model: "claude-sonnet-5",            // Sonnet 5 (per pilot decision); override via env ANTHROPIC_MODEL
  maxTokens: 1500,
  perTier: 8,                          // items requested per difficulty tier
  apiVersion: "2023-06-01",
};

/* ---- 1. Input moderation (kid-safe). A blocklist is the floor, not the ceiling:
   for production add a real moderation API pass. The generation prompt is also
   instructed to refuse non-educational / age-inappropriate topics. ---- */
const BLOCKED = [
  "sex","porn","nsfw","nude","naked","kill","suicide","self-harm","drug","cocaine",
  "heroin","meth","weapon","gun","bomb","terror","gore","blood","rape","abuse",
  "gambl","casino","betting","alcohol","vodka","beer","cigarette","vape","slur"
];
export function moderateInput(topic){
  const t = String(topic||"").toLowerCase();
  if(!t.trim()) return { ok:false, reason:"empty topic" };
  if(t.length > 60) return { ok:false, reason:"topic too long" };
  if(BLOCKED.some(w => t.includes(w))) return { ok:false, reason:"not a kid-appropriate topic" };
  return { ok:true };
}

/* ---- 2. Prompt construction ---- */
const VERBS = { math:"Solve", english:"Answer", science:"Answer" };
export function buildPrompt(spec){
  const grade = spec.grade || 6;
  const per = spec.perTier || CONFIG.perTier;
  const system =
`You write short, arcade-game questions for a children's learning app (US grades 5-8).
You output ONLY valid JSON — no prose, no markdown fences.
You are an expert curriculum designer. Model your questions on the STYLE and rigor of
well-known practice sources (Khan Academy exercises, IXL skill drills, Common Core sample
items, released state-test questions) — but NEVER copy a real question. Adopt the
PATTERNS and invent fresh numbers, words, and contexts.
Vary the question pattern across items: computation, missing-value, comparison,
true-application ("3 bags of 4"), vocabulary-in-context, identify-the-example — at least
3 different patterns per tier.
The audience is children, so every topic and answer must be strictly age-appropriate and educational.
If the requested topic is not a legitimate school-learning topic, or is inappropriate for a child,
respond with exactly: {"safe":false,"reason":"<short reason>"}`;

  const exclude = Array.isArray(spec.exclude) ? spec.exclude.slice(0,120) : [];
  const curriculum = (spec.curriculum||"").slice(0,4000);
  const user =
`Make a practice bank for the topic: "${spec.topic}"  (student grade level: ${grade}).
${curriculum ? `\nALIGN STRICTLY TO THIS CURRICULUM (from the teacher — stay inside it):\n"""${curriculum}"""\n` : ""}
${exclude.length ? `\nDO NOT reuse any of these already-seen prompts (make completely NEW ones):\n${JSON.stringify(exclude)}\n` : ""}
Return JSON with this EXACT shape:
{
  "subject": "math" | "english" | "science",
  "label": "<3-24 char title of the topic, e.g. Addition>",
  "prompt": "<short instruction shown above each round, e.g. Drive into the ANSWER to>",
  "easy":   [ ${per} items ],
  "medium": [ ${per} items ],
  "hard":   [ ${per} items ]
}
Each item = { "target": "<the question, <=24 chars>", "correct": "<the answer, <=16 chars>", "decoys": ["<wrong>", "<wrong>"] }

Rules:
- "target" is the prompt the kid sees (a problem / word / clue). Keep it VERY short — it must fit on a game lane.
- "correct" is the single right answer, short.
- "decoys" are 2 plausible-but-wrong answers, each DIFFERENT from correct and from each other. For math use common mistakes (off-by-one, wrong operation). For words use same-category wrong options.
- Difficulty must actually rise easy -> medium -> hard.
- No duplicate targets within the bank, and none from the DO-NOT-REUSE list.
- subject = "math" for arithmetic/algebra/number topics, "english" for vocabulary/spelling/grammar/reading, "science" for science facts.
Output ONLY the JSON object.`;
  return { system, user };
}

/* ---- 3. Call Anthropic (fetch injected so this stays portable/testable) ---- */
export async function callAnthropic({ apiKey, model, system, user, fetchImpl, maxTokens }){
  const f = fetchImpl || globalThis.fetch;
  const res = await f("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-api-key": apiKey,
      "anthropic-version": CONFIG.apiVersion,
    },
    body: JSON.stringify({
      model: model || CONFIG.model,
      max_tokens: maxTokens || CONFIG.maxTokens,
      system,
      messages:[{ role:"user", content:user }],
    }),
  });
  if(!res.ok){ const txt = await res.text().catch(()=> ""); throw new Error("anthropic "+res.status+": "+txt.slice(0,200)); }
  const data = await res.json();
  const text = (data.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("");
  callAnthropic.lastUsage = data.usage || null;   // r22: spend tracking
  return text;
}

/* ---- 4. Parse + validate into the game's schema ---- */
function clean(s){ return String(s==null?"":s).replace(/\s+/g," ").trim(); }
function extractJSON(text){
  let t = String(text||"").trim().replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if(i>=0 && j>i) t = t.slice(i, j+1);
  return JSON.parse(t);
}
function validItem(it){
  if(!it || typeof it!=="object") return null;
  const target = clean(it.target), correct = clean(it.correct);
  if(!target || !correct || target.length>28 || correct.length>20) return null;
  let decoys = Array.isArray(it.decoys) ? it.decoys.map(clean) : [];
  decoys = [...new Set(decoys.filter(d => d && d.length<=20 && d.toLowerCase()!==correct.toLowerCase()))].slice(0,3);
  if(decoys.length < 2) return null;
  return { target, correct, decoys };
}
function dedupeTier(arr, minN){
  const seen=new Set(), out=[];
  for(const raw of (arr||[])){ const it=validItem(raw); if(!it) continue;
    const k=it.target.toLowerCase(); if(seen.has(k)) continue; seen.add(k); out.push(it); }
  return out.length>=minN ? out : null;
}
export function parseAndValidate(text, spec){
  const obj = extractJSON(text);
  if(obj && obj.safe===false) return { safe:false, reason: clean(obj.reason)||"topic not allowed" };
  const subject = ["math","english","science"].includes(obj.subject) ? obj.subject : "english";
  const minN = Math.max(4, Math.floor((spec.perTier||CONFIG.perTier)/2));
  const easy=dedupeTier(obj.easy,minN), medium=dedupeTier(obj.medium,minN), hard=dedupeTier(obj.hard,minN);
  if(!easy||!medium||!hard) throw new Error("not enough valid items per tier");
  return {
    subject,
    label: clean(obj.label).slice(0,26) || clean(spec.topic).slice(0,26),
    prompt: clean(obj.prompt).slice(0,48) || (VERBS[subject]+":"),
    easy, medium, hard, gen:true, source:"ai",
  };
}

/* ---- 5. Orchestrator: moderate -> cache -> call -> validate (1 retry) ---- */
export async function generate(spec, opts){
  opts = opts || {};
  const mod = moderateInput(spec.topic);
  if(!mod.ok) return { ok:false, safe:false, reason: mod.reason };
  const key = (spec.topic+"|"+(spec.grade||6)+"|p"+(spec.page||0)+(spec.curriculum?"|c"+String(spec.curriculum).length:"")).toLowerCase();
  if(opts.cache && opts.cache.get){ const hit = await opts.cache.get(key); if(hit) return { ok:true, bank:hit, cached:true }; }
  if(!opts.apiKey) return { ok:false, reason:"no api key configured on server" };
  if(opts.gate){ const g = opts.gate(); if(!g.ok) return { ok:false, reason:g.reason, budget:true }; }

  const { system, user } = buildPrompt(spec);
  let lastErr;
  for(let attempt=0; attempt<2; attempt++){
    try{
      const u = attempt===0 ? user : user + "\n\nREMINDER: output ONLY the JSON object with the exact shape and enough items per tier.";
      const text = await callAnthropic({ apiKey:opts.apiKey, model:opts.model, system, user:u, fetchImpl:opts.fetchImpl, maxTokens:opts.maxTokens });
      if(opts.onUsage) try{ opts.onUsage(callAnthropic.lastUsage); }catch(_){}
      const result = parseAndValidate(text, spec);
      if(result.safe===false) return { ok:false, safe:false, reason:result.reason };
      if(opts.cache && opts.cache.set) await opts.cache.set(key, result);
      return { ok:true, bank:result };
    }catch(e){ lastErr=e; }
  }
  return { ok:false, reason:"could not generate a valid bank: "+(lastErr&&lastErr.message||"unknown") };
}

/* Simple in-memory LRU cache (swap for a Base44 entity / Redis in production). */
export function memoryCache(max){ const m=new Map(); max=max||300;
  return { async get(k){ const v=m.get(k); if(v){ m.delete(k); m.set(k,v); } return v; },
           async set(k,v){ m.set(k,v); if(m.size>max) m.delete(m.keys().next().value); } }; }

/* ---- 6. CLASS MODE: teachers store a curriculum + optional questions, kids
        join with a short code. Store is pluggable (memory by default; swap
        for a Base44 entity / DB in production — see README). ---- */
export function memoryClassStore(){ const m=new Map();
  return { async get(code){ return m.get(code)||null; },
           async set(code,v){ m.set(code,v); } }; }
export const SHARED_CLASSES = memoryClassStore();
function classCode(){ const A="ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c=""; for(let i=0;i<6;i++) c+=A[Math.floor(Math.random()*A.length)]; return c; }
export async function handleClassCreate(body, env){
  const name=String(body&&body.name||"My Class").slice(0,60);
  const curriculum=String(body&&body.curriculum||"").slice(0,20000);
  const questions=Array.isArray(body&&body.questions)? body.questions.slice(0,300) : [];
  if(!curriculum && !questions.length) return { status:400, json:{ok:false, reason:"empty class: add a curriculum or questions"} };
  const store=(env&&env.classStore)||SHARED_CLASSES;
  const code=classCode();
  await store.set(code, { name, curriculum, questions, created:body&&body.created });
  return { status:200, json:{ ok:true, code, name } };
}
export async function handleClassGet(body, env){
  const code=String(body&&body.code||"").toUpperCase().trim();
  const store=(env&&env.classStore)||SHARED_CLASSES;
  const cls=await store.get(code);
  if(!cls) return { status:404, json:{ok:false, reason:"class code not found"} };
  return { status:200, json:{ ok:true, cls:Object.assign({code}, cls) } };
}

/* One-call helper used by every wrapper. */
export async function handleGenerate(body, env){
  const spec = { topic: body && body.topic, grade: body && body.grade, subject: body && body.subject, perTier: body && body.perTier,
    exclude: body && body.exclude, curriculum: body && body.curriculum, page: body && body.page };
  const device = String(body && body.device || "").slice(0, 40);
  const r = await generate(spec, {
    apiKey: env.apiKey, model: env.model, fetchImpl: env.fetchImpl,
    cache: env.cache || SHARED_CACHE, maxTokens: env.maxTokens,
    gate: env.gate ? () => env.gate(device) : null,
    onUsage: env.onUsage || null,
  });
  return r.ok ? { status:200, json:{ ok:true, bank:r.bank, cached:!!r.cached } }
             : { status: r.safe===false ? 200 : 400, json:{ ok:false, safe:r.safe, reason:r.reason } };
}
export const SHARED_CACHE = memoryCache(300);
