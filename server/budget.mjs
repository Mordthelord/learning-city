/* ============================================================================
   AI.B.C — API spend guardrails (r22)
   ----------------------------------------------------------------------------
   Protects the Anthropic credit balance with layered, env-tunable caps.
   Cache hits are free — these gates apply only to real API calls.

   Env vars (all optional — safe defaults):
     ANTHROPIC_MODEL          default "claude-sonnet-5"
     MAX_TOKENS_PER_CALL      default 1500
     MAX_CALLS_PER_DAY        default 60      (≈ $1.50/day worst case)
     MAX_CALLS_PER_MONTH      default 600
     MAX_SPEND_USD_MONTH      default 15      (hard stop from token counts)
     MAX_CALLS_PER_DEVICE_HR  default 6       (one kid can't drain the pool)
     PRICE_IN_PER_MTOK        default 3       (Sonnet 5 standard input $/MTok)
     PRICE_OUT_PER_MTOK       default 15      (Sonnet 5 standard output $/MTok)
     AI_DISABLED              set to "1" to kill-switch AI entirely
   When any cap trips, the server answers with ok:false and the game falls
   back to its built-in offline generators — kids never see an error.
   ============================================================================ */
const N = (v, d) => { const x = parseInt(v, 10); return Number.isFinite(x) && x > 0 ? x : d; };
const F = (v, d) => { const x = parseFloat(v); return Number.isFinite(x) && x > 0 ? x : d; };

export const LIMITS = {
  maxTokens:   N(process.env.MAX_TOKENS_PER_CALL, 1500),
  dayCalls:    N(process.env.MAX_CALLS_PER_DAY, 60),
  monthCalls:  N(process.env.MAX_CALLS_PER_MONTH, 600),
  monthUSD:    F(process.env.MAX_SPEND_USD_MONTH, 15),
  deviceHour:  N(process.env.MAX_CALLS_PER_DEVICE_HR, 6),
  priceIn:     F(process.env.PRICE_IN_PER_MTOK, 3),
  priceOut:    F(process.env.PRICE_OUT_PER_MTOK, 15),
  disabled:    process.env.AI_DISABLED === "1",
};

const dayKey   = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);
const hourKey  = () => new Date().toISOString().slice(0, 13);

const S = {
  day: dayKey(),   dayCalls: 0,
  month: monthKey(), monthCalls: 0, inTok: 0, outTok: 0,
  devices: new Map(),          // deviceId -> {hour, calls}
  refused: 0, lastRefusal: null,
};
function roll() {
  if (S.day !== dayKey())   { S.day = dayKey();     S.dayCalls = 0; }
  if (S.month !== monthKey()) { S.month = monthKey(); S.monthCalls = 0; S.inTok = 0; S.outTok = 0; }
}
export function spendUSD() {
  return (S.inTok / 1e6) * LIMITS.priceIn + (S.outTok / 1e6) * LIMITS.priceOut;
}
/* gate() — call right before hitting the API. Returns {ok} or {ok:false,reason}. */
export function gate(deviceId) {
  roll();
  const no = (reason) => { S.refused++; S.lastRefusal = reason; return { ok: false, reason }; };
  if (LIMITS.disabled)                 return no("ai disabled by admin");
  if (S.dayCalls   >= LIMITS.dayCalls)   return no("daily AI budget reached — offline questions until tomorrow");
  if (S.monthCalls >= LIMITS.monthCalls) return no("monthly AI call budget reached");
  if (spendUSD()   >= LIMITS.monthUSD)   return no("monthly spend cap reached");
  if (deviceId) {
    const d = S.devices.get(deviceId) || { hour: hourKey(), calls: 0 };
    if (d.hour !== hourKey()) { d.hour = hourKey(); d.calls = 0; }
    if (d.calls >= LIMITS.deviceHour) return no("device hourly limit — try again in a bit");
    d.calls++; S.devices.set(deviceId, d);
    if (S.devices.size > 2000) S.devices.delete(S.devices.keys().next().value);
  }
  S.dayCalls++; S.monthCalls++;
  return { ok: true };
}
/* record real token usage from the API response's usage block */
export function recordUsage(usage) {
  if (!usage) return;
  S.inTok  += usage.input_tokens  || 0;
  S.outTok += usage.output_tokens || 0;
}
export function budgetJSON() {
  roll();
  return {
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    today:  { calls: S.dayCalls,   cap: LIMITS.dayCalls },
    month:  { calls: S.monthCalls, cap: LIMITS.monthCalls,
              inTokens: S.inTok, outTokens: S.outTok,
              estSpendUSD: +spendUSD().toFixed(3), capUSD: LIMITS.monthUSD },
    perDeviceHourly: LIMITS.deviceHour,
    maxTokensPerCall: LIMITS.maxTokens,
    refused: S.refused, lastRefusal: S.lastRefusal,
    disabled: LIMITS.disabled,
    note: "counters reset if the server restarts (free-tier disk is ephemeral) — caps are sized so even a fresh counter can't overspend",
  };
}
