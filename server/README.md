# AI.B.C server — AI questions + class battles

One free server, two jobs: the AI question backend (`POST /generate-content`,
`/class-create`, `/class-get`) and the multiplayer relay for class-PIN battles
(WebSocket `/ws`). The game at the root of this repo auto-connects when this
server is live at `https://learning-city-api.onrender.com`.

Deploy: Render.com → New → Blueprint → pick this repo → set `ANTHROPIC_API_KEY`.
The key lives ONLY in Render's environment settings — never in code or this repo.

Health check: `GET /health` → `{ ok, ws, keyConfigured, model }`.
