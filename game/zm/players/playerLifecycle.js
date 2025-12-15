// game/zm/players/playerLifecycle.js (CommonJS)
// Player lifecycle: death handling and full match restart.

function createPlayerLifecycle(ctx){
  const {
    players,
    zombies,
    PICKUPS,
    PLAYER,
    rand,
    broadcast,
    sendTo,
    snapshotFor,
    weaponStateFor,
    PISTOL_LIST,
    makeDefaultInventory,
    ARENA,
    obstacles,
    spawnAnchor,
    // round state accessors
    getWave,
    setWave,
    getBetweenRounds,
    setBetweenRounds,
    setZombiesTarget,
    setZombiesSpawned,
    setZombiesKilled,
    setLastSpawnAt,
  } = ctx;

  // 2D distance helper (XZ plane)
  function dist2(x1, z1, x2, z2){
    const dx = x1 - x2;
    const dz = z1 - z2;
    return Math.hypot(dx, dz);
  }

  // AABB checks are necessary but not always sufficient when the player spawns very near a
  // box corner (you can still intersect due to radius + integration). We add a conservative
  // distance check against each obstacle's "circumradius" as an extra guard.
  function tooCloseToBox(x, z, o, pad = 0.9){
    const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
    const hx = Math.abs(o.hx || 0);
    const hz = Math.abs(o.hz || 0);
    const boxRadius = Math.hypot(hx, hz);
    return dist2(x, z, o.x, o.z) <= (boxRadius + r + pad);
  }

  function isInsideAnyBox(x,z, pad=0.65){
    const obs = obstacles || [];
    const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
    const extra = r + pad;
    for (const o of obs){
      const hx = (o.hx||0) + extra;
      const hz = (o.hz||0) + extra;
      // AABB overlap
      if (Math.abs(x - o.x) <= hx && Math.abs(z - o.z) <= hz) return true;
      // Corner safety radius
      if (tooCloseToBox(x, z, o, pad)) return true;
    }
    return false;
  }

  function nudgeOutOfBoxes(pos){
    // If a script/object was spawned right on top of a spawn point, push the player out.
    const obs = obstacles || [];
    const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
    const extra = r + 0.75;
    let x = pos.x, z = pos.z;
    for (let iter=0; iter<8; iter++){
      let moved = false;
      for (const o of obs){
        const hx = (o.hx||0) + extra;
        const hz = (o.hz||0) + extra;
        const dx = x - o.x;
        const dz = z - o.z;
        const ax = Math.abs(dx);
        const az = Math.abs(dz);
        if (ax <= hx && az <= hz){
          // Choose the shallowest penetration axis and push out.
          const penX = hx - ax;
          const penZ = hz - az;
          if (penX < penZ){
            x += (dx >= 0 ? 1 : -1) * (penX + 0.05);
          } else {
            z += (dz >= 0 ? 1 : -1) * (penZ + 0.05);
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    return { x, z };
  }

  function findSafeSpawn(){
    // Prefer an explicit anchor if provided. Server guarantees this zone stays clear.
    if (spawnAnchor && typeof spawnAnchor.x === 'number' && typeof spawnAnchor.z === 'number'){
      for (let i=0;i<80;i++){
        const ang = Math.random()*Math.PI*2;
        const rad = 1.5 + Math.random()*7.5;
        const x = spawnAnchor.x + Math.cos(ang)*rad;
        const z = spawnAnchor.z + Math.sin(ang)*rad;
        if (!isInsideAnyBox(x,z,0.9)) return nudgeOutOfBoxes({ x, z });
      }
    }
    const tries = [
      { n: 40, min:-8,  max: 8 },
      { n: 50, min:-16, max: 16 },
      { n: 60, min:-24, max: 24 },
    ];
    for (const t of tries){
      for (let i=0;i<t.n;i++){
        const x = rand(t.min, t.max);
        const z = rand(t.min, t.max);
        if (isInsideAnyBox(x,z)) continue;
        return nudgeOutOfBoxes({ x, z });
      }
    }
    const pts = [
      {x:-14,z:-14},{x:14,z:-14},{x:-14,z:14},{x:14,z:14},
      {x:0,z:-18},{x:0,z:18},{x:-18,z:0},{x:18,z:0}
    ];
    for (const p of pts){ if (!isInsideAnyBox(p.x,p.z,1.0)) return nudgeOutOfBoxes(p); }
    for (let gx=-22; gx<=22; gx+=2){
      for (let gz=-22; gz<=22; gz+=2){
        if (!isInsideAnyBox(gx,gz,1.0)) return nudgeOutOfBoxes({ x:gx, z:gz });
      }
    }
    return nudgeOutOfBoxes({ x:0, z:0 });
  }

  function resetPlayer(p){
    const sp = findSafeSpawn();
    p.x = sp.x;
    p.z = sp.z;
    p.y = 0;
    p.yaw = 0;
    p.pitch = 0;
    p.hp = 100;
    p.cash = 20;
    p.armor = 0;
    p.speed = PLAYER.speed;
    p.nextHitAt = 0;
    p.godMode = false;

    // Keep pistol stable if you want; but for a clean restart we reset to a random pistol.
    const pistolId = PISTOL_LIST && PISTOL_LIST.length
      ? PISTOL_LIST[Math.floor(Math.random() * PISTOL_LIST.length)]
      : (p.pistol?.id || 'glock');
    p.pistol = weaponStateFor(pistolId);
    p.primary = null;

    p.primaryLast = null;
    p.primaryCooldowns = {};
    p._equipped = pistolId;
    p._keys = { w:false,a:false,s:false,d:false };
    p.lastAim = { yaw:0, pitch:0 };

    p.inventory = makeDefaultInventory(p);
  }

  function restartMatch(reason){
    // Wipe non-player entities
    zombies.length = 0;
    if (Array.isArray(PICKUPS)) PICKUPS.length = 0;

    // Reset round state
    setBetweenRounds(true);
    setWave(1);
    setZombiesTarget(0);
    setZombiesSpawned(0);
    setZombiesKilled(0);
    setLastSpawnAt(0);

    // Reset all players
    for (const p of players.values()) resetPlayer(p);

    // Tell clients to hard-reset local input state (prevents stuck keys/mouse)
    broadcast({ type: 'restartAck' });

    // Send the fresh authoritative state so clients fully resync.
    if (typeof snapshotFor === 'function'){
      broadcast({
        type: 'state',
        players: Array.from(players.values()).map(snapshotFor),
        zombies,
        pickups: PICKUPS,
        round: { between: true, wave: 1, zombiesTarget: 0, zombiesKilled: 0 }
      });
    }

    broadcast({ type: 'toast', msg: reason || 'Match restarted.' });
    broadcast({ type: 'round', between: true, wave: 1, zombiesTarget: 0 });
  }

  function handlePlayerDeath(playerId, cause){
    const p = players.get(playerId);
    if (!p) return;

    // Mark dead (server authoritative)
    p.hp = 0;

    // Default behavior requested: prompt restart
    sendTo(playerId, {
      type: 'playerDead',
      id: playerId,
      cause: cause || 'unknown',
      msg: 'You died. Restart the match?'
    });
  }

  return { restartMatch, handlePlayerDeath };
}

module.exports = { createPlayerLifecycle };
