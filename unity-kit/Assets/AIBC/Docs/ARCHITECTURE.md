# AI.B.C Unity — Architecture Notes (for developers)

Namespace `AIBC`, zero external packages beyond the URP template (uGUI + legacy
Input only — deliberate, for WebGL friendliness and zero-setup imports).
Everything is runtime-constructed: no scenes, prefabs or asset references are
required to run; `GameBootstrap` is the single entry component.

## Module map

| Script | Role | Web-build equivalent |
|---|---|---|
| `GameBootstrap` | entry point: lighting, services, city, player | `10-init.js` |
| `PlayerController` | CharacterController move + orbit cam + collision zoom | `02-player.js` |
| `Interactable` / `InteractionScanner` | E-to-interact + prompt | `cityScanInteract` |
| `CityBuilder` | profile → districts → plots/buildings/trees/chests/NPCs | `03-districts.js` |
| `PrefabRegistry` (ScriptableObject) | THE asset plug-in point; primitives are the fallback everywhere | — |
| `QuestionService` | banks, difficulty ramp (3-streak up / 2-miss down), no-repeat exclude, backend→offline fallback | `makeDifficulty` + CONTENT |
| `BackendClient` | POST /generate-content, /health | autowire block |
| `OfflineQuestionFallback` | procedural banks when offline | offline generators |
| `QuestionUI` | runtime uGUI question panel; wrong answers teach + retry | game question flow |
| `QuestionChest` | the core loop object: E → question → coins → cooldown | interior chests |
| `CoinWallet` | PlayerPrefs-backed economy + change events | `addCoins`/CSAVE |
| `GameSession` | attempts/first-try/streak accounting → telemetry | `LOG` |
| `TelemetryClient` | anonymous device id, event queue in PlayerPrefs, batch flush to POST /track — **identical event schema to the web build**, one dashboard for both | r14 TELEM |
| `RateGameCard` | stars + difficulty + comment, 2nd-then-every-4th gating | r14 rating card |
| `BattleRelayClient` | class-PIN battles over the same /ws relay (needs a WebSocket lib on WebGL — phase 3) | WsNet |
| `ProfileModels` / `DistrictSelector` | profile JSON + interests→districts mapping | questionnaire handoff |
| `DemoBootstrap` | console-only smoke test of backend+profile (kept for CI-ish sanity) | — |

## Design rules

1. **Primitives-first, registry-swap.** Every visual asks `PrefabRegistry.Active`
   first and falls back to primitives. Art is a data change, never a code change.
2. **Same backend, same schema.** `/generate-content`, `/track`, `/health` are the
   contracts. The Unity build and the HTML build are two clients of one server —
   the pilot dashboard aggregates both without changes.
3. **Runtime-built UI.** uGUI constructed in code (no scene serialization to
   merge-conflict, no TMP import step). When the team grows, migrate to prefabs.
4. **Input locking.** Any modal UI sets `PlayerController.InputLocked = true` and
   frees the cursor; unlock + re-lock cursor on close.

## Phase roadmap (from the migration plan, concretized)

| Phase | Deliverable | Acceptance |
|---|---|---|
| 1 (now) | this scaffold: walkable slice + chest loop + telemetry | press Play in a fresh URP project, loop works offline |
| 1.5 | asset pass: Synty/Kenney packs via PrefabRegistry, Mixamo player + anims | city reads as a real place; player runs/idles with animation |
| 2 | profile fetch (family/class code → questionnaire web page JSON), real district layouts per district type | entering a code builds *that child's* city |
| 3 | 3–4 minigames (answer-gate race, quiz blitz, target range) + class battles via relay | vertical slice a kid can play for 20 min |
| 4 | full city: interiors, economy shops, vehicles | feature parity with the HTML build's core |
| 5 | WebGL export tuning (compression, texture budgets) + pilot build | runs on a school Chromebook in browser |

## Gotchas already handled

- `LegacyRuntime.ttf` (not Arial) for built-in font — Unity 2022+/6.
- No emoji in uGUI strings (legacy fonts render boxes).
- Camera tag set on the GameObject, URP/Standard shader fallback in `CityBuilder.Mat`.
- Render free-tier cold starts: `BackendClient` timeout is 45 s; telemetry
  health-gates before flushing and never loses queued events.
