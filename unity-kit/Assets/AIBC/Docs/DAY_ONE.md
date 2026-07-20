# AI.B.C Unity kit — Day One (60 minutes, zero Unity experience assumed)

## 1. Install (20 min, one-time)
1. Download **Unity Hub** → unity.com/download
2. In the Hub: **Installs ▸ Install Editor ▸ Unity 6 LTS** (or 2022 LTS). No extra modules needed yet
   (add **WebGL Build Support** later for the browser export).
3. **New Project ▸ Universal 3D (URP)** ▸ name it `AIBC` ▸ Create.

## 2. Drop in this kit (5 min)
1. Copy the `Assets/AIBC` folder from this kit into your project's `Assets/` folder.
2. Wait for the import spinner. Zero errors expected — EXCEPT `BattleRelayClient.cs`
   needs one package: **Window ▸ Package Manager ▸ + ▸ Add package from git URL** →
   `https://github.com/endel/NativeWebSocket.git#upm`
   (Or just delete BattleRelayClient.cs for day one — nothing else depends on it.)

## 3. Prove the whole loop (10 min)
1. **File ▸ New Scene** (Basic URP).
2. **GameObject ▸ Create Empty**, name it `Boot`.
3. Drag `DemoBootstrap.cs` onto it (the BackendClient joins automatically).
4. Press **Play** and open the Console (Ctrl+Shift+C). You'll see:
   - the districts chosen from Max's interests (same logic as the web city),
   - a REAL question bank from the server (or the offline fallback if the server
     isn't deployed yet — play never breaks, same guarantee as the web build).

That's the entire nervous system of the game running in Unity: profile → personal
city plan → curriculum questions. Everything after this is art and game feel.

## 4. What to build next (in order)
1. **Gray-box city**: a plane + cubes laid out by `DistrictSelector` output.
2. **Question UI**: a world-space canvas showing `bank.prompt` + 3 answer buttons.
3. **First asset pack**: see ASSET_SHOPPING_LIST.md — Synty POLYGON City makes the
   gray boxes look like a real stylized city in an afternoon.
4. **Character controller**: Unity's Starter Assets (free, on the Asset Store) gives
   walk/run/jump with a rigged character out of the box.
5. Re-read `engine_migration_plan.md` (project docs) for the full 9–12 week map.
