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
