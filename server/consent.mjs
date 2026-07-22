/* ============================================================================
   AI.B.C — consent registry (r28, Customer Demands §7.2)
   ----------------------------------------------------------------------------
   POST /consent  {device, granted, role, ver, lang, cls}
     Records a timestamped consent decision for an anonymous device id.
     role: "parent" | "school" (teacher class-code profiles) — no names, ever.
   POST /purge    {device}
     The parent right-to-delete: withdraws consent AND erases every stored
     event for that device (analytics.purgeDevice). Called from the game's
     Parent Corner — the device id itself is the credential, so a family can
     only ever delete THEIR OWN data.

   Storage: consents.jsonl + purges.jsonl in $DATA_DIR (see store.mjs).
   ============================================================================ */
import { appendLine, readLines } from "./store.mjs";
import { purgeDevice } from "./analytics.mjs";

const CONSENTS = new Map();   // device -> {granted, role, at, ver, lang, cls, withdrawnAt}
let purgeCount = 0;

try {
  const n = readLines("consents.jsonl", (r) => { if (r && r.device) CONSENTS.set(r.device, r); });
  readLines("purges.jsonl", () => purgeCount++);
  if (n) console.log(`🛡 consent: replayed ${n} consent records (${CONSENTS.size} devices)`);
} catch (e) { console.warn("consent boot:", e.message); }

export async function handleConsent(body) {
  const device = String(body.device || "").slice(0, 24);
  if (!device) return { status: 400, json: { ok: false, reason: "device required" } };
  const rec = {
    device,
    granted: body.granted !== false,
    role: ["parent", "school"].includes(body.role) ? body.role : "parent",
    at: new Date().toISOString(),
    ver: String(body.ver || "v1").slice(0, 24),
    lang: String(body.lang || "en").slice(0, 8),
    cls: String(body.cls || "").slice(0, 12) || null,
  };
  CONSENTS.set(device, rec);
  appendLine("consents.jsonl", rec);
  return { status: 200, json: { ok: true, at: rec.at } };
}

export async function handlePurge(body) {
  const device = String(body.device || "").slice(0, 24);
  if (!device) return { status: 400, json: { ok: false, reason: "device required" } };
  const res = purgeDevice(device);
  const prior = CONSENTS.get(device);
  const rec = { device, granted: false, withdrawn: true, at: new Date().toISOString(),
    role: (prior && prior.role) || "parent", ver: (prior && prior.ver) || "v1" };
  CONSENTS.delete(device);
  appendLine("consents.jsonl", rec);
  appendLine("purges.jsonl", { device, at: rec.at, droppedEvents: res.droppedEvents || 0 });
  purgeCount++;
  return { status: 200, json: { ok: true, erasedEvents: res.droppedEvents || 0 } };
}

export const consentOf = (device) => CONSENTS.get(device) || null;
export function consentSummary() {
  let granted = 0, school = 0;
  for (const [, c] of CONSENTS) if (c.granted) { granted++; if (c.role === "school") school++; }
  return { devicesWithConsent: granted, viaSchool: school, viaParent: granted - school, purgedDevices: purgeCount };
}
