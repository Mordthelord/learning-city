/* ============================================================================
   AI.B.C — Learning City production server
   ----------------------------------------------------------------------------
   One free-tier server, two jobs:
     1. AI question backend:  POST /generate-content | /class-create | /class-get
     2. Multiplayer relay:    WebSocket /ws  (class-PIN live battles)

   Deploy on Render (render.yaml in this folder) with env var:
     ANTHROPIC_API_KEY = <your key — set it in Render's dashboard, never in code>
   ============================================================================ */
import http from "node:http";
import { WebSocketServer } from "ws";
import { handleGenerate, handleClassCreate, handleClassGet, SHARED_CACHE, CONFIG } from "./generate.core.mjs";
import { handleTrack, statsJSON, dashboardHTML, exportAll, exportCSV } from "./analytics.mjs";
import { gate, recordUsage, budgetJSON, LIMITS } from "./budget.mjs";
import { handleConsent, handlePurge } from "./consent.mjs";
import { pilotHTML, pilotDataJSON, deviceJSON } from "./pilot.mjs";
import { keyAuth, rateLimit, readBody, ipOf, SEC_HEADERS } from "./security.mjs";

const PORT = process.env.PORT || 8787;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const env = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL || CONFIG.model,
  cache: SHARED_CACHE,
  maxTokens: LIMITS.maxTokens,          // r22 spend guardrails
  gate, onUsage: recordUsage,
};
if (!env.apiKey) console.warn("⚠  ANTHROPIC_API_KEY is not set — AI generation disabled until you set it (offline fallbacks still work in-game).");

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  const url = new URL(req.url, "http://x");
  const J = (status, obj) => { res.writeHead(status, { "content-type": "application/json", ...CORS, ...SEC_HEADERS }); res.end(JSON.stringify(obj)); };
  const HTML = (html) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...SEC_HEADERS }); res.end(html); };
  /* admin auth with timing-safe compare + per-IP brute-force lockout (r28) */
  const admin = () => { const a = keyAuth(req, url); if (!a.ok) J(a.status, { ok: false, reason: a.reason }); return a.ok; };

  if (url.pathname === "/health") {
    return J(200, { ok: true, ws: true, track: true, keyConfigured: !!env.apiKey, model: env.model,
      aiToday: budgetJSON().today });
  }
  if (url.pathname === "/budget.json") { if (!admin()) return; return J(200, { ok: true, budget: budgetJSON() }); }
  if (url.pathname === "/stats.json")  { if (!admin()) return; return J(200, statsJSON()); }
  if (url.pathname === "/dashboard")   { return HTML(dashboardHTML(url)); }

  /* ---- r28: Pilot Data Portal + full data access ---- */
  if (url.pathname === "/pilot")           { return HTML(pilotHTML()); }
  if (url.pathname === "/pilot-data.json") { if (!admin()) return; return J(200, pilotDataJSON()); }
  if (url.pathname === "/device.json")     { if (!admin()) return; return J(200, deviceJSON(String(url.searchParams.get("device") || ""))); }
  if (url.pathname === "/export.json") {
    if (!admin()) return;
    res.writeHead(200, { "content-type": "application/json", "content-disposition": "attachment; filename=aibc-pilot-data.json", ...SEC_HEADERS });
    return res.end(JSON.stringify({ exportedAt: new Date().toISOString(), events: exportAll() }));
  }
  if (url.pathname === "/export.csv") {
    if (!admin()) return;
    res.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=aibc-pilot-data.csv", ...SEC_HEADERS });
    return res.end(exportCSV());
  }
  /* a family's own data by device id (the id itself is the credential) */
  if (url.pathname === "/my-data.json") {
    const device = String(url.searchParams.get("device") || "");
    if (!rateLimit("mydata:" + ipOf(req), 20, 600e3)) return J(429, { ok: false, reason: "slow down" });
    return J(200, deviceJSON(device));
  }

  const routes = { "/generate-content": handleGenerate, "/class-create": handleClassCreate, "/class-get": handleClassGet,
    "/track": handleTrack, "/consent": handleConsent, "/purge": handlePurge };
  const route = routes[url.pathname];
  if (req.method !== "POST" || !route) {
    return J(404, { ok: false, reason: "POST /generate-content | /class-create | /class-get | /track | /consent | /purge · GET /pilot | /dashboard | /stats.json | /export.json | /export.csv · WS /ws" });
  }
  /* r28: per-IP rate limits on the open POST endpoints + bounded bodies */
  const ip = ipOf(req);
  const RL = { "/track": [120, 600e3], "/consent": [10, 600e3], "/purge": [5, 600e3] }[url.pathname];
  if (RL && !rateLimit(url.pathname + ":" + ip, RL[0], RL[1])) return J(429, { ok: false, reason: "rate limited" });
  let raw = "";
  try { raw = await readBody(req, 512 * 1024); } catch (e) { return J(413, { ok: false, reason: "body too large" }); }
  let body = {}; try { body = JSON.parse(raw || "{}"); } catch (_) {}
  try {
    const out = await route(body, env);
    J(out.status, out.json);
  } catch (e) {
    J(500, { ok: false, reason: String(e && e.message || e) });
  }
});

/* ---------------- multiplayer relay: rooms keyed by class PIN ---------------- */
const wss = new WebSocketServer({ server, path: "/ws" });
const rooms = {};   // pin -> {pin, gameId, started, players:[{id,name,score,done}], clients:Set, ts}
const clean = (x) => String(x == null ? "" : x).slice(0, 24);
const pack = (r) => JSON.stringify({ type: "room", pin: r.pin, room: {
  pin: r.pin, gameId: r.gameId, started: r.started,
  players: r.players.map(p => ({ id: p.id, name: p.name, score: p.score, done: p.done })) } });
const cast = (r) => { r.ts = Date.now(); const m = pack(r); r.clients.forEach(c => { if (c.readyState === 1) c.send(m); }); };

wss.on("connection", (sock) => {
  sock.on("message", (buf) => {
    let m = {}; try { m = JSON.parse(buf); } catch (_) { return; }
    const pin = clean(m.pin); if (!pin) return;
    let r = rooms[pin];
    if (m.t === "host") {
      r = rooms[pin] = { pin, gameId: m.gameId || null, started: false,
        players: [{ id: clean(m.id), name: clean(m.name) || "Host", score: 0, done: false }],
        clients: new Set([sock]), ts: Date.now() };
      return cast(r);
    }
    if (m.t === "join") {
      if (!r) r = rooms[pin] = { pin, gameId: null, started: false, players: [], clients: new Set(), ts: Date.now() };
      r.clients.add(sock);
      if (!r.players.find(p => p.id === clean(m.id)) && r.players.length < 60)
        r.players.push({ id: clean(m.id), name: clean(m.name) || "Player", score: 0, done: false });
      return cast(r);
    }
    if (!r) return;
    if (m.t === "sub")    { r.clients.add(sock); return sock.readyState === 1 && sock.send(pack(r)); }
    if (m.t === "start")  { r.started = true; r.gameId = m.gameId || r.gameId; return cast(r); }
    if (m.t === "update") { const p = r.players.find(p => p.id === clean(m.id)); if (p && !p.done) p.score = Math.max(0, +m.score || 0); return cast(r); }
    if (m.t === "submit") { const p = r.players.find(p => p.id === clean(m.id)); if (p) { p.score = Math.max(0, +m.score || 0); p.done = true; } return cast(r); }
  });
  sock.on("close", () => { for (const pin in rooms) rooms[pin].clients.delete(sock); });
});
/* stale-room garbage collection */
setInterval(() => { const now = Date.now();
  for (const pin in rooms) if (rooms[pin].clients.size === 0 && now - rooms[pin].ts > 3600e3) delete rooms[pin];
}, 600e3);

server.listen(PORT, () => console.log(`🌆 AI.B.C server on :${PORT} — content API + /ws relay · key ${env.apiKey ? "OK" : "MISSING"}`));
