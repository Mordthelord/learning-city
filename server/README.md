# AI.B.C server — AI questions + class battles

One free server, two jobs: the AI question backend (`POST /generate-content`,
`/class-create`, `/class-get`) and the multiplayer relay for class-PIN battles
(WebSocket `/ws`). The game at the root of this repo auto-connects when this
server is live at `https://learning-city-api.onrender.com`.

Deploy: Render.com → New → Blueprint → pick this repo → set `ANTHROPIC_API_KEY`.
The key lives ONLY in Render's environment settings — never in code or this repo.

Health check: `GET /health` → `{ ok, ws, keyConfigured, model }`.

## Pilot analytics (added r14)
The server now tracks gameplay telemetry sent by the game (anonymous device ids only — never child names):
- `POST /track` — batched events from the game: play-minutes (heartbeats), game starts/finishes, every question (first-try, tier, response time, subject/skill), and "Rate this game" feedback (stars, difficulty vote, comment).
- `GET /stats.json?key=ADMIN_KEY` — aggregated JSON: totals, per-game, per-skill, per-day, latest feedback.
- `GET /dashboard?key=ADMIN_KEY` — a ready-made HTML dashboard over those numbers (open it in any browser).

Set `ADMIN_KEY` in Render's dashboard (same place as `ANTHROPIC_API_KEY`) to protect the stats; without it they're public.
Data is appended to `$DATA_DIR/telemetry.jsonl` (default `./data`) and aggregates rebuild on restart.
Note: Render's free tier has an ephemeral disk — raw history resets on redeploys. Fine for the pilot; upgrade to a paid disk (or point DATA_DIR at one) if long-term history matters.


## Spend guardrails (r22)

The server protects your Anthropic credits with layered caps — **cache hits are free**,
so repeated topics cost nothing. All caps are env vars with safe defaults:

| Env var | Default | Meaning |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Sonnet 5 — $3/$15 per MTok (intro $2/$10 through Aug 31, 2026) |
| `MAX_TOKENS_PER_CALL` | 1500 | Hard output cap per generation (≈ $0.02–0.03/call) |
| `MAX_CALLS_PER_DAY` | 60 | Daily API-call budget (≈ $1.50/day worst case) |
| `MAX_CALLS_PER_MONTH` | 600 | Monthly call budget |
| `MAX_SPEND_USD_MONTH` | 15 | Hard stop computed from real token usage |
| `MAX_CALLS_PER_DEVICE_HR` | 6 | One kid/device can't drain the pool |
| `AI_DISABLED` | unset | Set to `1` for an instant kill switch |

When any cap trips the server refuses politely and the game **falls back to its
built-in offline question generators — kids never see an error.**

Monitor live: `GET /budget.json?key=ADMIN_KEY` — calls today/month, token counts,
estimated spend. The `/dashboard` shows the same as cards at the top.

Note: counters live in memory (free-tier disk is ephemeral), so a server restart
resets them. The caps are sized so even a fresh counter cannot overspend: worst
case ≈ $1.50/day regardless.
