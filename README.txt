$1 Zombies FPS (Multiplayer) - Engine Layout (v17)

Run:
  node server.js
Then open:
  http://localhost:3000

Key folders:
  /engine   -> reusable mini engine (networking + combat pipeline)
  /game/zm  -> Zombies game module
    /zombies  /players  /maps each has scripts/ and resources/

Notes:
- Client code currently lives in /engine/client/clientCore.js and is loaded by /public/client.js.
- All hitscan + damage now routes through /engine/server/combat.js.
