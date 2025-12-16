# Dollar Zombies Engine (3D FPS) - v1

## Run
1) Install Node 18+
2) `node server.js`
3) Open http://localhost:3000

## Controls
- Click canvas to lock mouse (Pointer Lock)
- WASD move, Shift sprint
- Left click shoot
- ` (backquote) toggles dev (toast only for now)

## Script loading (sorted)
- `/scripts/manifest.json` controls load order.
- Supports `.dzs` (data + event scripts)
- Optionally supports `.js` modules that export `register(ctx)`.

## DZS
- Basic syntax:
  on eventName {
    call builtin arg1 arg2
  }

## Weapons
- Definitions: `engine/game/zm/weapons/scripts/WeaponDefs.js`
- DB: `engine/game/zm/weapons/scripts/WeaponDB.js`
- Runtime ammo: `engine/game/zm/weapons/scripts/WeaponState.js`

## Combat
- Weapon switching: Mouse wheel or 1-6
- Reload: R
- Shotguns: pellet spread + multiple raycasts
- Explosive rounds: impact AOE via `aoeRadius` / `aoeDamageMul`
