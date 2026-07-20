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
import { handleTrack, statsJSON, authorized, dashboardHTML } from "./analytics.mjs";

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
};
if (!env.apiKey) console.warn("⚠  ANTHROPIC_API_KEY is not set — AI generation disabled until you set it (offline fallbacks still work in-game).");

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify({ ok: true, ws: true, track: true, keyConfigured: !!env.apiKey, model: env.model }));
  }
  /* analytics: stats + dashboard (GET, ADMIN_KEY-protected if set) */
  if (url.pathname === "/stats.json") {
    if (!authorized(url)) { res.writeHead(403, { "content-type": "application/json", ...CORS }); return res.end(JSON.stringify({ ok: false, reason: "bad key" })); }
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify(statsJSON()));
  }
  if (url.pathname === "/dashboard") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(dashboardHTML(url));
  }
  const routes = { "/generate-content": handleGenerate, "/class-create": handleClassCreate, "/class-get": handleClassGet, "/track": handleTrack };
  const route = routes[url.pathname];
  if (req.method !== "POST" || !route) {
    res.writeHead(404, { "content-type": "application/json", ...CORS });
    return res.end(JSON.stringify({ ok: false, reason: "POST /generate-content | /class-create | /class-get | /track · GET /stats.json | /dashboard · WS /ws" }));
  }
  let raw = ""; for await (const c of req) raw += c;
  let body = {}; try { body = JSON.parse(raw || "{}"); } catch (_) {}
  try {
    const out = await route(body, env);
    res.writeHead(out.status, { "content-type": "application/json", ...CORS });
    res.end(JSON.stringify(out.json));
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json", ...CORS });
    res.end(JSON.stringify({ ok: false, reason: String(e && e.message || e) }));
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
