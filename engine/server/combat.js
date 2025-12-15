// engine/server/combat.js (CommonJS)
// Centralized hitscan + damage pipeline.
// Scripts can listen/react via onDamage/onKill hooks, but hit detection is always engine-owned.

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

function raySphere(origin, dir, center, radius, maxDist){
  const ox=origin.x-center.x, oy=origin.y-center.y, oz=origin.z-center.z;
  const b = ox*dir.x + oy*dir.y + oz*dir.z;
  const c = ox*ox + oy*oy + oz*oz - radius*radius;
  const disc = b*b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  if (t < 0 || t > maxDist) return null;
  return t;
}

function lineHitsZombie(origin, dir, maxDist, z){
  const tBody = raySphere(origin, dir, { x:z.x, y:1.0, z:z.z }, 0.70, maxDist);
  const tHead = raySphere(origin, dir, { x:z.x, y:1.55, z:z.z }, 0.28, maxDist);
  let best = null;
  if (tBody != null) best = { t: tBody, part: 'body' };
  if (tHead != null && (!best || tHead < best.t)) best = { t: tHead, part: 'head' };
  return best;
}

function computeDamage(w, part, dist){
  const close = (w.dmgClose != null) ? w.dmgClose : (w.damage != null ? w.damage : 20);
  const far = (w.dmgFar != null) ? w.dmgFar : Math.max(1, Math.round(close * 0.65));
  const r = Math.max(1, w.range || 50);
  const t = Math.max(0, Math.min(1, dist / r));
  const base = Math.round(close + (far - close) * t);
  const mult = (part === 'head') ? 2.0 : 1.0;
  return Math.max(1, Math.round(base * mult));
}

/**
 * createCombatSystem
 * @param {{
 *  getZombies:()=>any[],
 *  setZombies:(zs:any[])=>void,
 *  players: Map<string, any>,
 *  weapons: Record<string, any>,
 *  broadcast:(msg:any)=>void,
 *  runScriptEvent:(evt:'damage'|'kill', ctx:any)=>void,
 *  endWave:()=>void,
 *  getRoundState:()=>{betweenRounds:boolean,zombiesTarget:number,zombiesKilled:number}
 * }} deps
 */
function createCombatSystem(deps){
  const {
    getZombies,
    setZombies,
    broadcast,
    runScriptEvent,
  } = deps;

  // Back-compat: some callers provide getters instead of direct references.
  const getPlayersMap = () => {
    if (deps.players && typeof deps.players.values === 'function') return deps.players;
    if (typeof deps.getPlayers === 'function') return deps.getPlayers();
    return undefined;
  };

  const getWeaponsTable = () => {
    if (deps.weapons && typeof deps.weapons === 'object') return deps.weapons;
    if (typeof deps.getWeapons === 'function') return deps.getWeapons();
    return undefined;
  };

  const endWave = (typeof deps.endWave === 'function')
    ? deps.endWave
    : (typeof deps.endWave === 'function' ? deps.endWave : (()=>{}));

  const getRoundState = (typeof deps.getRoundState === 'function')
    ? deps.getRoundState
    : (() => ({
      betweenRounds: (typeof deps.getBetweenRounds === 'function') ? !!deps.getBetweenRounds() : false,
      zombiesTarget: (typeof deps.getZombiesTarget === 'function') ? (deps.getZombiesTarget()|0) : 0,
      zombiesKilled: (typeof deps.getZombiesKilled === 'function') ? (deps.getZombiesKilled()|0) : 0,
    }));

  function fireHitscan(p, weaponId, aim){
    const weapons = getWeaponsTable();
    if (!weapons) return;
    const w = weapons[weaponId];
    if (!w) return;

    const ws = (p.pistol && weaponId === p.pistol.id) ? p.pistol : p.primary;
    if (!ws || ws.id !== weaponId) return;

    const now = Date.now();
    if (ws.reloading){
      if (now < ws.reloadUntil) return;
      ws.reloading = false;
    }
    if (now < ws.nextFireAt) return;

    if (ws.mag <= 0){
      if (ws.reserve > 0){
        ws.reloading = true;
        ws.reloadUntil = now + w.reloadMs;
        const need = w.mag;
        const take = Math.min(need, ws.reserve);
        ws.mag = take;
        ws.reserve -= take;
        broadcast({ type:'reload', id:p.id, weapon:weaponId, until:ws.reloadUntil });
      }
      return;
    }

    if (w.burst){
      if (ws.burstLeft <= 0){
        ws.burstLeft = w.burst;
        ws.burstNextAt = now;
      }
    }

    const origin = { x:p.x, y:1.6, z:p.z };
    const hits = [];

    const shootOne = () => {
      const yaw = aim.yaw + (Math.random()*2-1)*w.spread;
      const pitch = clamp(aim.pitch + (Math.random()*2-1)*w.spread, -1.4, 1.4);

      const cy=Math.cos(yaw), sy=Math.sin(yaw);
      const cp=Math.cos(pitch), sp=Math.sin(pitch);
      const dir = { x: -sy*cp, y: -sp, z: -cy*cp };

      let best = null;
      const zs = getZombies();
      for (const z of zs){
        const hit = lineHitsZombie(origin, dir, w.range, z);
        if (hit && (!best || hit.t < best.t)) best = { t: hit.t, zid: z.id, part: hit.part };
      }
      if (best) hits.push({ zid: best.zid, part: best.part, t: best.t });
    };

    for (let i=0;i<w.pellets;i++) shootOne();

    hits.sort((a,b)=>a.t-b.t);
    const perZombie = new Map();

    for (const h of hits){
      const zid = h.zid;
      const used = perZombie.get(zid) || 0;
      if (used >= 2) continue;
      perZombie.set(zid, used + 1);

      const zs = getZombies();
      const z = zs.find(zz=>zz.id===zid);
      if (!z) continue;

      const dmg = computeDamage(w, h.part, h.t);

      // --- Damage pipeline (engine-owned hit detection; scripts can react via events) ---
      z.hp -= dmg;

      // Notify JS-level game events (optional)
      if (typeof deps.emitGameEvent === 'function'){
        deps.emitGameEvent('onZombieDamaged', {
          zombieId: zid,
          zombie: { ...z },
          playerId: p.id,
          weaponId,
          part: h.part,
          dmg,
          dist: h.t,
          wave: (typeof deps.getWave === 'function') ? deps.getWave() : undefined,
        });
      }

      // Default economy
      p.cash += 1;

      const killed = (z.hp <= 0);
      if (killed){
        p.cash += 5;
        const newZ = zs.filter(zz=>zz.id!==zid);
        setZombies(newZ);

        // Notify the game server so it can maintain counters/economy.
        if (typeof deps.onZombieKilled === 'function'){
          try {
            deps.onZombieKilled({ zombieId: zid, zombie: z, playerId: p.id, weaponId, part: h.part, dmg, dist: h.t });
          } catch (e){
            // Never let scripts/game hooks break combat.
            console.warn('[combat] onZombieKilled hook threw:', e?.message || e);
          }
        }

        if (typeof deps.emitGameEvent === 'function'){
          deps.emitGameEvent('onZombieDeath', {
            zombieId: zid,
            zombie: { ...z },
            playerId: p.id,
            weaponId,
            part: h.part,
            dmg,
            dist: h.t,
            wave: (typeof deps.getWave === 'function') ? deps.getWave() : undefined,
          });
        }

        const rs = getRoundState();
        const ctx = { player:p, zombie:z, weaponId, part:h.part, dmg, dist:h.t, killed:true };
        runScriptEvent('damage', ctx);
        runScriptEvent('kill', ctx);

        broadcast({ type:'zdead', zid, by:p.id, cash:p.cash, part:h.part, dmg });

        // NOTE: Wave end is handled by the main server tick loop.
        // Combat should never advance rounds directly.
      } else {
        runScriptEvent('damage', { player:p, zombie:z, weaponId, part:h.part, dmg, dist:h.t, killed:false });
        broadcast({ type:'zhit', zid, by:p.id, hp:z.hp, cash:p.cash, part:h.part, dmg });
      }
    }

    ws.mag -= 1;
    ws.nextFireAt = now + w.fireMs;

    broadcast({ type:'shot', id:p.id, weapon:weaponId, mag:ws.mag, reserve:ws.reserve });
  }

  function tickBurstFire(){
    const now = Date.now();
    const players = getPlayersMap();
    const weapons = getWeaponsTable();
    if (!players || !weapons) return;

    for (const p of players.values()){
      const w = weapons[p.primary?.id];
      if (!w || !w.burst) continue;
      const ws = p.primary;
      if (!ws || ws.id !== p.primary.id) continue;

      if (ws.burstLeft > 0 && now >= ws.burstNextAt){
        if (ws.mag <= 0){ ws.burstLeft = 0; continue; }
        ws.burstLeft -= 1;
        ws.burstNextAt = now + (w.burstGapMs || 70);

        // Fire one burst bullet using stored aim
        fireHitscan(p, ws.id, p.lastAim || { yaw:p.yaw||0, pitch:p.pitch||0 });

        if (ws.burstLeft <= 0){
          // burst ends, apply main cooldown
          ws.nextFireAt = Math.max(ws.nextFireAt, now + w.fireMs);
        }
      }
    }
  }

  return { fireHitscan, tickBurstFire, computeDamage };
}

module.exports = { createCombatSystem };
