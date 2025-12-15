// game/zm/players/playerLogic.js (CommonJS)
// Player movement, collision, and targeting helpers extracted from zmServer.

function createPlayerLogic(ctx){
  const { players, ARENA, PLAYER, DT, rand, arenaClamp, resolveObstacleCollisionsFor, getBetweenRounds, obstacles } = ctx;

  function isInsideAnyBox(x,z, pad=0.65){
    // Treat the player as a circle; expand obstacle AABB by player radius + padding.
    const obs = obstacles || [];
    const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
    const extra = r + pad;
    for (const o of obs){
      const hx = (o.hx||0) + extra;
      const hz = (o.hz||0) + extra;
      if (Math.abs(x - o.x) <= hx && Math.abs(z - o.z) <= hz) return true;
    }
    return false;
  }

  function findSafeSpawn(){
    // Prefer center-ish first (typically clear), then broaden.
    const tries = [
      { n: 30, min:-8,  max: 8 },
      { n: 40, min:-16, max: 16 },
      { n: 50, min:-24, max: 24 },
    ];
    for (const t of tries){
      for (let i=0;i<t.n;i++){
        const x = rand(t.min, t.max);
        const z = rand(t.min, t.max);
        if (isInsideAnyBox(x,z)) continue;
        return { x, z };
      }
    }
    // Fallback: ring spawns
    const pts = [
      {x:-14,z:-14},{x:14,z:-14},{x:-14,z:14},{x:14,z:14},
      {x:0,z:-18},{x:0,z:18},{x:-18,z:0},{x:18,z:0}
    ];
    for (const p of pts){
      if (!isInsideAnyBox(p.x,p.z,1.0)) return p;
    }
    // Last resort: grid scan
    for (let gx=-22; gx<=22; gx+=2){
      for (let gz=-22; gz<=22; gz+=2){
        if (!isInsideAnyBox(gx,gz,1.0)) return { x:gx, z:gz };
      }
    }
    return { x:0, z:0 };
  }

function nearestPlayer(x,z){
  let best=null, bd=1e9;
  for (const p of players.values()){
    if (p.hp<=0) continue;
    const dx=p.x-x, dz=p.z-z;
    const d=dx*dx+dz*dz;
    if (d<bd){ bd=d; best=p; }
  }
  return best;
}

function lineHitsPlayer(origin, dir, maxDist, target){
  // target is capsule-ish cylinder around head/chest
  const ox=origin.x, oy=origin.y, oz=origin.z;
  const dx=dir.x, dy=dir.y, dz=dir.z;

  const tx=target.x, ty=target.y+1.2, tz=target.z;
  const vx = tx-ox, vy=ty-oy, vz=tz-oz;
  const t = vx*dx + vy*dy + vz*dz;
  if (t<0 || t>maxDist) return null;
  const cx = ox+dx*t, cy=oy+dy*t, cz=oz+dz*t;
  const distSq = (tx-cx)**2 + (ty-cy)**2 + (tz-cz)**2;
  const r=0.55;
  if (distSq <= r*r) return { t };
  return null;
}

function integratePlayers(){
  for (const p of players.values()){
    const k = p._keys || {};
    const forward = (k.w ? 1 : 0) + (k.s ? -1 : 0); // w=forward, s=back
    const strafe  = (k.d ? 1 : 0) + (k.a ? -1 : 0); // d=right, a=left

    // Movement is relative to view yaw (FPS-style)
    // Three.js camera forward at yaw=0 is -Z, so forward vector is (-sin(yaw), -cos(yaw))
    const sy = Math.sin(p.yaw);
    const cy = Math.cos(p.yaw);
    const fx = -sy, fz = -cy;
    const rx =  cy, rz = -sy;

    let vx = fx * forward + rx * strafe;
    let vz = fz * forward + rz * strafe;

    const mag = Math.hypot(vx, vz);
    if (mag > 0){
      vx /= mag; vz /= mag;
      p.x += vx * p.speed * DT;
      p.z += vz * p.speed * DT;
      arenaClamp(p);
      resolveObstacleCollisionsFor(p, PLAYER.radius);
      arenaClamp(p);
    }

    // simple respawn if down and getBetweenRounds()
    if (p.hp<=0 && getBetweenRounds()){
      p.hp = 100;
      const s = findSafeSpawn();
      p.x = s.x; p.z = s.z;
      p.cash = Math.max(p.cash, 10);
    }
  }
}

  return { nearestPlayer, lineHitsPlayer, integratePlayers, findSafeSpawn };
}

module.exports = { createPlayerLogic };
