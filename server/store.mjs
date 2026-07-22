/* ============================================================================
   AI.B.C — durable storage layer (r28)
   ----------------------------------------------------------------------------
   One tiny zero-dependency store used by analytics, consent and budget.

   WHERE DATA LIVES (first match wins):
     1. $DATA_DIR                    — set it explicitly if you want
     2. /var/data/aibc               — a Render persistent disk mounted at
                                       /var/data (survives deploys & restarts)
     3. ./data                       — fallback; on Render's free tier this is
                                       EPHEMERAL (wiped on every deploy/restart)

   To make pilot data permanent on Render: service → Settings → Disks →
   Add Disk (mount path /var/data, 1 GB ≈ $0.25/mo, needs a paid instance).
   No code change required — this file auto-detects it on next boot.
   ============================================================================ */
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.DATA_DIR
  || (fs.existsSync("/var/data") ? "/var/data/aibc" : "./data");
export const DURABLE = DATA_DIR.startsWith("/var/data") || !!process.env.DATA_DIR;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.warn("store: mkdir failed:", e.message); }

export const fileOf = (name) => path.join(DATA_DIR, name);

/* append one JSON record as a line (crash-safe: a torn last line is skipped on replay) */
export function appendLine(name, obj) {
  try { fs.appendFileSync(fileOf(name), JSON.stringify(obj) + "\n"); return true; }
  catch (e) { console.warn("store append " + name + ":", e.message); return false; }
}

/* replay every valid line through fn; returns how many lines were applied */
export function readLines(name, fn) {
  const f = fileOf(name);
  if (!fs.existsSync(f)) return 0;
  let n = 0;
  const lines = fs.readFileSync(f, "utf8").split("\n");
  for (const l of lines) { if (!l.trim()) continue; try { fn(JSON.parse(l)); n++; } catch (_) {} }
  return n;
}

/* rewrite a JSONL file keeping only records keepFn approves (atomic via tmp+rename) */
export function rewriteLines(name, keepFn) {
  const f = fileOf(name);
  if (!fs.existsSync(f)) return { kept: 0, dropped: 0 };
  let kept = 0, dropped = 0, out = "";
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    if (!l.trim()) continue;
    let rec; try { rec = JSON.parse(l); } catch (_) { continue; }
    if (keepFn(rec)) { out += l + "\n"; kept++; } else dropped++;
  }
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, out); fs.renameSync(tmp, f);
  return { kept, dropped };
}

/* small JSON state files (budget counters etc.) — atomic write */
export function saveJSON(name, obj) {
  try { const f = fileOf(name), tmp = f + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, f); return true;
  } catch (e) { console.warn("store save " + name + ":", e.message); return false; }
}
export function loadJSON(name, fallback) {
  try { const f = fileOf(name);
    if (!fs.existsSync(f)) return fallback;
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (_) { return fallback; }
}

export function fileSize(name) {
  try { return fs.statSync(fileOf(name)).size; } catch (_) { return 0; }
}

console.log(`💾 store: DATA_DIR=${DATA_DIR} (${DURABLE ? "durable disk" : "EPHEMERAL — add a Render disk at /var/data to keep pilot data across deploys"})`);
