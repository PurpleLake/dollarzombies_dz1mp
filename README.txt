$1 Zombies FPS (Multiplayer) — Node + WebSockets + Three.js

Run:
  npm install
  npm start
Open:
  http://localhost:3000  (open in 2+ tabs/browsers to test multiplayer)

Controls:
  - Click Play (pointer lock)
  - WASD move
  - Mouse aim
  - Click shoot
  - R reload
  - 1 pistol / 2 primary

Between rounds:
  - Pick a primary weapon (cannot pick same twice in a row; picked weapon locks for 3 rounds)
  - Pick a pistol
  - Buy upgrades
  - Start next wave

Notes:
  - Server is authoritative for zombies, damage, and pick rules.
  - Rendering is intentionally lightweight (simple arena + capsule players/zombies).


v2 notes:
- Added obvious 3D depth: crates/props, shadows, fog, weapon viewmodel + muzzle flash + recoil.
- If you still see 2D, make sure you're running `npm start` and opening http://localhost:3000 (not opening index.html directly).


v3 add-ons:
- Added a simple 3D zombie model (body + head + arms) and server-side hitboxes.
- Headshots do 2x damage and trigger a "Headshot!" toast.


v4 fixes:
- Movement is now camera-relative (W always moves where you're looking).
- Server aim direction aligned with Three.js (yaw=0 shoots toward -Z), so zombies take damage properly.
- Zombies now use a low-poly blocky model.


v5 updates:
- Added server-side collision resolution (player-player, zombie-zombie, player-zombie) so entities don't overlap.
- Reworked hit detection to robust ray-sphere intersections and capped pellet stacking per zombie for consistency.
