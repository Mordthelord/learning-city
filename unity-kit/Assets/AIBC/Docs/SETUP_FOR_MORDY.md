# AI.B.C in Unity — Setup From Zero (no Unity experience needed)

Follow this top to bottom. In ~30 minutes you'll be walking around a Learning City
block in Unity, opening question chests, earning coins — with the same AI backend
and the same analytics dashboard as the web game.

## 1. Install Unity (one time, ~20 min mostly downloading)

1. Go to **unity.com/download** and install **Unity Hub** (it's the launcher).
2. Open Unity Hub → **Installs** → **Install Editor** → pick the newest **Unity 6 LTS**
   (any 6000.x LTS version is fine).
3. On the modules screen, tick **WebGL Build Support** (that's our browser export
   for school Chromebooks). Everything else can stay default. Install.
4. It will ask you to make a free Unity account — do it (Personal license, $0).

## 2. Create the project (2 min)

1. Unity Hub → **Projects** → **New project**.
2. Pick the **Universal 3D** template (this is URP — our render pipeline). If you
   only see "Universal 3D Sample", that works too.
3. Name it `LearningCityUnity`, choose a folder, **Create project**. First open
   takes a few minutes.

## 3. Drop in the AI.B.C kit (2 min)

1. In your file explorer, find this kit's `Assets/AIBC` folder
   (from the repo: `unity-kit/Assets/AIBC`).
2. Copy the whole `AIBC` folder into your project's `Assets` folder
   (`LearningCityUnity/Assets/AIBC`).
3. Go back to Unity — it imports automatically. Wait for the progress bar.
   ✅ No red errors in the Console (bottom panel) = you're good.

> If the Console shows errors about "Input": Edit → Project Settings → Player →
> Other Settings → **Active Input Handling** → set to **Both** → restart when asked.

## 4. Press Play (1 min)

1. In the **Hierarchy** panel (left), right-click → **Create Empty**. Name it `Game`.
2. With `Game` selected, in the **Inspector** (right) click **Add Component**,
   type `GameBootstrap`, add it.
3. Press the **▶ Play** button at the top.

You should be standing in a primitive Learning City: plaza, roads, colored district
plots with floating names (picked from Max's interests — same logic as the web game),
trees, wandering NPCs, and brown **question chests**.

- **WASD** move · **mouse** look · **Shift** sprint · **Space** jump
- Walk to a chest → **E** → answer the question → **coins!**
- Wrong answers explain and let you retry — every miss teaches, same as the web build.
- Questions come from the live AI backend when it's deployed; until then the
  offline generator kicks in automatically (you'll see it in the Console).

**Play a chest a few times and the "Rate this game" card appears — that feedback
and all play stats go to the same pilot dashboard as the web game.**

## 5. What you're looking at (the honest version)

Everything is colored blocks right now **on purpose** — this proves the whole
GAME works in Unity before we spend a shekel on art. Making it beautiful is now
purely an asset drop:

1. Buy/import an art pack (see `ASSET_SHOPPING_LIST.md` — free options first).
2. In the Project panel: right-click → **Create → AIBC → Prefab Registry**.
3. Drag the pack's prefabs into the slots (player, houses, trees, chest…).
4. Drag that registry asset onto the `Game` object's **GameBootstrap → Prefabs** slot.
5. Press Play — same city, real art. No code changes.

## 6. When something breaks

- **Screen is pink/magenta**: a material isn't URP. Our scripts handle this, but a
  downloaded asset may need: Window → Rendering → Render Pipeline Converter →
  convert materials.
- **Mouse stuck / can't click UI**: press **Escape** to free the cursor.
- **"LegacyRuntime.ttf" error** (very old Unity versions): use Unity 6 as above.
- Anything else: screenshot the Console and send it to me in this chat — we debug
  together.

## 7. First WebGL export (when you want to show someone)

File → Build Profiles → **WebGL** → Switch Platform (one-time wait) → **Build**.
Upload the output folder to any static host (GitHub Pages works — same as the
current game). Expect a bigger download than the HTML build; that's normal.
