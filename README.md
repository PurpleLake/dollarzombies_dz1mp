# Dollar Zombies Engine (3D FPS)

Browser-first FPS prototype with Zombies survival, Multiplayer, a DZS scripting runtime, and built-in tooling.

## Run
1) Install Node 18+
2) `node server.js`
3) Open `http://localhost:3000`

## Modes
- Zombies (Co-op and Solo)
- Multiplayer (Team Deathmatch prototype)

## Features
- Custom classes for Zombies and Multiplayer (loadouts saved in options)
- Server browser and matchmaking queues
- DZS scripting language (GSC-style) with runtime events
- Script injection via DZS Studio (dev menu)
- Map editor with dzmap export and compiler
- Basic HUD, nameplates, notifications, and weapon viewmodels

## Controls
- Click canvas to lock mouse (Pointer Lock)
- WASD move, Shift sprint
- Left click shoot
- Mouse wheel or 1/2 switch weapons
- R reload
- Esc pause
- ` (backquote) or ' toggle dev menu

## DZS Scripting
- DZS scripts load from `/public/scripts/manifest.json` (or `/public/scripts/mp_manifest.json` for MP).
- Syntax supports `on eventName { ... }` blocks and helpers like `wait`, `notify`, `thread`.
- DZS Studio is available in the dev menu to validate, edit, and inject scripts at runtime.
- Library scripts live in `dzs_library/`.

## DZS Studio Dev Workflow
1) Launch the game and open the dev menu (` or ') → Script Studio.
2) Load a library script or paste new DZS code in the editor.
3) Click Validate to check syntax; fix any errors.
4) Inject the script to run it in the current match (host-only in MP).
5) Use Installed to disable/unload or hot-reload edits.
6) Download the script to keep a copy or move it into `dzs_library/`.

## Map Editor
- Tooling lives under `engine/tools/map_editor/`.
- Build and export `.dzmap` files with walls, props, lights, spawns, and zones.
- Compiler runs in-game when a dzmap is loaded.

## Weapons
- Definitions: `engine/core/weapons/scripts/WeaponDefs.js`
- DB: `engine/core/weapons/scripts/WeaponDB.js`
- Runtime ammo: `engine/core/weapons/scripts/WeaponState.js`

## Networking
- Server: `server.js`
- Server browser and lobby management included.

## Notes
- Multiplayer is prototype-grade and actively evolving.
- If a map has no lighting, the renderer applies a global fallback light setup.
