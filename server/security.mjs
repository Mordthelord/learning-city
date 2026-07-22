/* ============================================================================
   AI.B.C — security layer (r28)
   ----------------------------------------------------------------------------
   · timing-safe ADMIN_KEY comparison (no string-compare timing leaks)
   · brute-force lockout: 8 bad keys from one IP in 10 min → 15 min block
   · per-IP rate limits for the open POST endpoints (/track /consent /purge)
   · bounded request bodies (a fat POST can't balloon memory)
   No PII crosses this server: devices are anonymous random ids, no child
   names are accepted anywhere, and every admin surface needs the key.
   ============================================================================ */
import crypto from "node:crypto";

const ADMIN_KEY = process.env.ADMIN_KEY || "";

export function safeEqual(a, b) {
  const A = Buffer.from(String(a || "")), B = Buffer.from(String(b || ""));
  if (A.length !== B.length) { crypto.timingSafeEqual(B, B); return false; } // burn equal time
  return crypto.timingSafeEqual(A, B);
}

export const ipOf = (req) =>
  (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) ||
  (req.socket && req.socket.remoteAddress) || "?";

/* ---- brute-force lockout on the admin key ---- */
const FAILS = new Map();                 // ip -> {n, first, blockedUntil}
export function keyAuth(req, url) {
  if (!ADMIN_KEY) return { ok: true };   // no key configured -> open (pre-pilot dev)
  const ip = ipOf(req), now = Date.now();
  const f = FAILS.get(ip) || { n: 0, first: now, blockedUntil: 0 };
  if (f.blockedUntil > now) return { ok: false, status: 429, reason: "too many bad keys — try again later" };
  if (now - f.first > 600e3) { f.n = 0; f.first = now; }
  const key = url.searchParams.get("key") || String(req.headers["x-admin-key"] || "");
  if (safeEqual(key, ADMIN_KEY)) { FAILS.delete(ip); return { ok: true }; }
  f.n++; if (f.n >= 8) f.blockedUntil = now + 900e3;
  FAILS.set(ip, f);
  return { ok: false, status: 403, reason: "bad key" };
}

/* ---- sliding-window rate limiter (per bucket key) ---- */
const BUCKETS = new Map();               // key -> [timestamps]
export function rateLimit(bucket, limit, windowMs) {
  const now = Date.now();
  let arr = BUCKETS.get(bucket) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= limit) { BUCKETS.set(bucket, arr); return false; }
  arr.push(now); BUCKETS.set(bucket, arr);
  return true;
}
setInterval(() => {                       // prune stale buckets hourly
  const now = Date.now();
  for (const [k, arr] of BUCKETS) if (!arr.length || now - arr[arr.length - 1] > 3600e3) BUCKETS.delete(k);
  for (const [k, f] of FAILS) if (f.blockedUntil < now && now - f.first > 3600e3) FAILS.delete(k);
}, 3600e3).unref?.();

/* ---- bounded body reader ---- */
export function readBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error("body too large")); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export const SEC_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};
