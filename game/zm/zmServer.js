// game/zm/zmServer.js (CommonJS)

const fs = require('fs');
const path = require('path');
const { createCombatSystem } = require('../../engine/server/combat');

const { WEAPONS, PRIMARY_LIST, PISTOL_LIST, weaponStateFor } = require('./weapons');
const { computeWeaponDamage } = require('./combat/damageSystem');
const { createPlayerLogic } = require('./players/playerLogic');
const { createPlayerLifecycle } = require('./players/playerLifecycle');
const { createHudSystem } = require('./players/hudSystem');
const { createZombieLogic } = require('./zombies/zombieLogic');
const { createDzsEngine } = require('./scripts/dzsEngine');

let _tickHandle = null;
let clients = new Set();
let combat = null;
let playerLifecycle = null;
let hud = null;
let dzs = null;
let runScriptEvent = () => {};
let loadScript = () => {};
let loadAllDzs = () => {};

// playerId -> ws
const wsByPlayerId = new Map();

/* eslint-disable */
const TICK_HZ = 20;
const DT = 1 / TICK_HZ;

const DEV_ALLOW_MIDROUND = true; // dev menu can swap guns mid-wave

const ARENA = { size: 120 }; // square arena, centered at origin
const PLAYER = { speed: 8.0, radius: 0.45, height: 1.7 };
const ZOMBIE = { speed: 2.1, radius: 0.55, hpBase: 90 };

// Deterministic player spawn "home base".
// We bias spawns toward this anchor and ensure obstacle generation avoids it.
// This solves cases where a random spawn lands inside a "bush" crate/prop.
const PLAYER_SPAWN_ANCHOR = { x: 0, z: -48 };


// ----- Pickups (spawnable entities) -----
// Weapon pickups are server-authoritative. Clients render them and the server
// awards on overlap.
// { id, kind:'weapon', weaponId, x, z, y }
const PICKUPS = [];

// ----- Obstacles (boxes) -----
// Server-authoritative so players/zombies can't walk through them.
// Axis-aligned on the XZ plane.
// { id, x, z, hx, hz, h }
const OBSTACLES = [];

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
function uid(){ return Math.random().toString(36).slice(2,10); }

function raySphere(origin, dir, center, radius, maxDist){
  // Ray: o + d*t, t>=0. Returns nearest t within maxDist or null.
  const ox=origin.x-center.x, oy=origin.y-center.y, oz=origin.z-center.z;
  const b = ox*dir.x + oy*dir.y + oz*dir.z;
  const c = ox*ox + oy*oy + oz*oz - radius*radius;
  const disc = b*b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  // smallest positive t
  let t = -b - s;
  if (t < 0) t = -b + s;
  if (t < 0 || t > maxDist) return null;
  return t;
}

const players = new Map(); // id -> player
let zombies = []; // {id,x,y,z,hp,kind,speed}
// Weapon pickups: { id, kind:'weapon', weaponId, x, y, z }
// (y is render-only; simulation is in XZ)
let wave = 1;
let betweenRounds = true;
let roundStartAt = Date.now();
let zombiesTarget = 8;
let zombiesSpawned = 0;
let zombiesKilled = 0;
let spawnEveryMs = 700;
let lastSpawnAt = 0;

// Wave/zombie logic is modularized under game/zm/zombies.
// WS message handlers are defined at module scope, so we keep wired function refs here.
let startNextWaveFn = null;
let endWaveFn = null;
let integratePlayersFn = null;
let spawnLogicFn = null;
let updateZombiesFn = null;


function integratePlayers(){
  if (!integratePlayersFn) return;
  return integratePlayersFn();
}
function spawnLogic(){
  if (!spawnLogicFn) return;
  return spawnLogicFn();
}
function updateZombies(){
  if (!updateZombiesFn) return;
  return updateZombiesFn();
}



function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function genObstacles(){
  OBSTACLES.length = 0;
  const rnd = mulberry32(0xD011A2B1); // stable seed (just a fun number)
  const s = ARENA.size/2 - 10;
  const count = 18;
  const avoidPts = [
    { x: PLAYER_SPAWN_ANCHOR.x, z: PLAYER_SPAWN_ANCHOR.z, r: 14 },
    { x: 0, z: 0, r: 10 },
  ];
  for (let i=0;i<count;i++){
    // Re-roll until this obstacle doesn't crowd the spawn anchor.
    // Deterministic because rnd() is deterministic.
    let x=0, z=0, hx=1.2, hz=1.2;
    for (let tries=0; tries<50; tries++){
      hx = 0.9 + rnd()*1.4;
      hz = 0.9 + rnd()*1.4;
      x = (rnd()*2-1) * s;
      z = (rnd()*2-1) * s;

      // keep center area clearer
      if (Math.hypot(x,z) < 12){
        x += (x<0?-1:1) * 14;
        z += (z<0?-1:1) * 14;
      }

      // keep away from key zones (player spawn anchor, etc.)
      let ok = true;
      for (const p of avoidPts){
        if (Math.hypot(x - p.x, z - p.z) < p.r){ ok = false; break; }
      }
      if (ok) break;
    }
    OBSTACLES.push({ id:`box_${i}`, x, z, hx, hz, h: 1.25 + rnd()*0.85 });
  }
}

function loadScriptFile(){ /* scripts now autoload inside createZMServer via dzsEngine */ }

// Build deterministic obstacles and then allow scripts to add more.
genObstacles();
loadScriptFile();

// ---------------- Script APIs (JS customscripts + DSL) ----------------
function clampInt(n, lo, hi){
  const v = Math.floor(Number(n) || 0);
  return Math.max(lo, Math.min(hi, v));
}

function resolvePlayer(entityOrId){
  if (!entityOrId) return null;
  if (typeof entityOrId === 'string') return players.get(entityOrId) || null;
  if (typeof entityOrId === 'object' && entityOrId.id) return players.get(entityOrId.id) || entityOrId;
  return null;
}

function weaponStateWithAmmo(weaponId, mode){
  const st = weaponStateFor(weaponId);
  const w = WEAPONS[weaponId];
  if (!w) return st;
  const clipMax = w.clipMaxAmmo ?? w.mag ?? 0;
  const reserveMax = w.reserveMaxAmmo ?? w.reserve ?? 0;
  const m = (mode || 'full').toLowerCase();
  if (m === 'none'){
    st.mag = 0;
    st.reserve = 0;
  } else if (m === 'clip'){
    st.mag = clipMax;
    st.reserve = 0;
  } else {
    st.mag = clipMax;
    st.reserve = reserveMax;
  }
  return st;
}

function syncInventorySlot(p, slot, weaponId){
  if (!p?.inventory?.weapons) return;
  if (!p.inventory.weapons[slot]) return;
  p.inventory.weapons[slot].id = weaponId || null;
}

function apiGiveWeapon(entityOrId, weaponId, opts){
  const p = resolvePlayer(entityOrId);
  const w = WEAPONS[weaponId];
  if (!p || !w) return false;
  const o = (opts && typeof opts === 'object') ? opts : { withAmmo: opts };
  const withAmmo = o.withAmmo || 'full';
  const equip = (o.equip !== undefined) ? !!o.equip : true;
  const st = weaponStateWithAmmo(weaponId, withAmmo);

  if (w.slot === 'pistol'){
    p.pistol = st;
    syncInventorySlot(p, 'pistol', weaponId);
  } else {
    // default to primary
    p.primary = st;
    syncInventorySlot(p, 'primary', weaponId);
  }

  if (equip){
    p._equipped = weaponId;
  }

  broadcast({ type:"loadout", id:p.id, pistol:p.pistol, primary:p.primary, inventory:p.inventory });
  return true;
}

function apiTakeWeapon(entityOrId, weaponId){
  const p = resolvePlayer(entityOrId);
  if (!p) return false;
  let changed = false;
  if (p.pistol && p.pistol.id === weaponId){
    p.pistol = weaponStateFor(PISTOL_LIST[0] || 'glock');
    syncInventorySlot(p, 'pistol', p.pistol.id);
    changed = true;
  }
  if (p.primary && p.primary.id === weaponId){
    p.primary = null;
    syncInventorySlot(p, 'primary', null);
    changed = true;
  }
  if (changed){
    broadcast({ type:"loadout", id:p.id, pistol:p.pistol, primary:p.primary, inventory:p.inventory });
  }
  return changed;
}

function apiSetAmmo(entityOrId, weaponId, clip, reserve){
  const p = resolvePlayer(entityOrId);
  const w = WEAPONS[weaponId];
  if (!p || !w) return false;
  const ref = (p.pistol && p.pistol.id===weaponId) ? p.pistol : (p.primary && p.primary.id===weaponId ? p.primary : null);
  if (!ref) return false;
  const clipMax = w.clipMaxAmmo ?? w.mag ?? ref.mag ?? 0;
  const reserveMax = w.reserveMaxAmmo ?? w.reserve ?? ref.reserve ?? 0;
  ref.mag = clampInt(clip, 0, clipMax);
  ref.reserve = clampInt(reserve, 0, reserveMax);
  broadcast({ type:"ammo", id:p.id, weapon:weaponId, mag:ref.mag, reserve:ref.reserve });
  return true;
}

function apiRestockAmmo(entityOrId, weaponIdOrAll, mode){
  const p = resolvePlayer(entityOrId);
  if (!p) return false;
  const m = (mode || 'full').toLowerCase();
  const ids = [];
  if (!weaponIdOrAll || weaponIdOrAll === 'all'){
    if (p.pistol?.id) ids.push(p.pistol.id);
    if (p.primary?.id) ids.push(p.primary.id);
  } else {
    ids.push(weaponIdOrAll);
  }

  let any = false;
  for (const wid of ids){
    const w = WEAPONS[wid];
    if (!w) continue;
    const ref = (p.pistol && p.pistol.id===wid) ? p.pistol : (p.primary && p.primary.id===wid ? p.primary : null);
    if (!ref) continue;
    const clipMax = w.clipMaxAmmo ?? w.mag ?? 0;
    const reserveMax = w.reserveMaxAmmo ?? w.reserve ?? 0;
    if (m === 'reserve'){
      ref.reserve = reserveMax;
    } else if (m === 'clip'){
      ref.mag = clipMax;
    } else {
      ref.mag = clipMax;
      ref.reserve = reserveMax;
    }
    broadcast({ type:"ammo", id:p.id, weapon:wid, mag:ref.mag, reserve:ref.reserve });
    any = true;
  }
  return any;
}

function resolvePlayerId(entityOrId){
  const p = resolvePlayer(entityOrId);
  return p ? p.id : (typeof entityOrId === 'string' ? entityOrId : null);
}

function apiHudText(entityOrId, key, text, x, y, opts){
  if (!hud) return false;
  const pid = resolvePlayerId(entityOrId);
  if (!pid) return false;
  hud.setText(pid, key, text, x, y, opts);
  return true;
}

function apiHudRect(entityOrId, key, x, y, w, h, opts){
  if (!hud) return false;
  const pid = resolvePlayerId(entityOrId);
  if (!pid) return false;
  hud.setRect(pid, key, x, y, w, h, opts);
  return true;
}

function apiHudClear(entityOrId, key){
  if (!hud) return false;
  const pid = resolvePlayerId(entityOrId);
  if (!pid) return false;
  hud.clear(pid, key);
  return true;
}

const SCRIPT_API = {
  Players: {
    all: () => Array.from(players.values()),
    byId: (id) => players.get(id) || null,
    inRadius: (pos, r) => {
      const cx = Number(pos?.x)||0, cz = Number(pos?.z)||0;
      const rr = (Number(r)||0);
      const out = [];
      for (const p of players.values()){
        const dx = p.x - cx, dz = p.z - cz;
        if (dx*dx + dz*dz <= rr*rr) out.push(p);
      }
      return out;
    },
    filter: (fn) => Array.from(players.values()).filter(fn),
  },
  weapons: {
    give: apiGiveWeapon,
    take: apiTakeWeapon,
    restockAmmo: apiRestockAmmo,
    setAmmo: apiSetAmmo,
  },
  hud: {
    text: apiHudText,
    rect: apiHudRect,
    clear: apiHudClear,
  }
};

// --- Optional JS event handlers (scriptable, but game must work without them) ---
// Built-in: root/game/zm/scripts/events.js
// Custom:   root/game/zm/customscripts/*.js
// Each exports an object: { onGameStart(){}, onRoundStart(){}, onZombieSpawn(){}, ... }
// name -> [fn, fn, ...]
const JS_EVENT_HANDLERS = Object.create(null);

function registerJSEvents(obj, label){
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)){
    if (typeof v !== 'function') continue;
    if (!JS_EVENT_HANDLERS[k]) JS_EVENT_HANDLERS[k] = [];
    JS_EVENT_HANDLERS[k].push(v);
  }
}

function tryLoadJSEvents(modPath, label){
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    let m = require(modPath);
    if (m && m.default) m = m.default;
    registerJSEvents(m, label);
  } catch (e) {
    // Optional, ignore if missing
  }
}

// Load built-in events
tryLoadJSEvents('./scripts/events', 'builtin');

// Load customscripts folder
try {
  const dir = path.join(__dirname, 'customscripts');
  if (fs.existsSync(dir)){
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .sort((a,b)=> a.localeCompare(b));
    for (const f of files){
      tryLoadJSEvents(path.join(dir, f), `custom:${f}`);
    }
  }
} catch (e) {
  console.warn('[customscripts] failed to load:', e?.stack || e);
}

function emitJSEvent(name, payload){
  // Attach script API helpers (players targeting, weapon actions, etc.)
  // so customscripts can do for-loops and group targeting safely.
  if (payload && typeof payload === 'object' && !payload.api){
    payload.api = SCRIPT_API;
  }
  const list = JS_EVENT_HANDLERS[name];
  if (!list || !list.length) return;
  for (const fn of list){
    try { fn(payload); } catch (e) {
      console.warn(`[js-events] ${name} threw:`, e?.stack || e);
    }
  }
}



function spawnWeaponPickup(weaponId, x, z, opts = {}){
  if (!WEAPONS[weaponId]) return null;
  const p = {
    id: opts.id || uid(),
    kind: 'weapon',
    weaponId,
    x: Number(x ?? 0),
    z: Number(z ?? 0),
    y: Number(opts.y ?? 0.35),
  };
  PICKUPS.push(p);
  return p;
}

function arenaClamp(p){
  const s = ARENA.size/2 - 1;
  p.x = clamp(p.x, -s, s);
  p.z = clamp(p.z, -s, s);
}

function broadcast(obj){
  const msg = JSON.stringify(obj);
  for (const c of clients){
    if (c.readyState === 1) c.send(msg);
  }
}

function sendTo(playerId, obj){
  const ws = wsByPlayerId.get(String(playerId));
  if (!ws || ws.readyState !== 1) return false;
  try { ws.send(JSON.stringify(obj)); } catch { return false; }
  return true;
}









function canPickPrimary(p, weaponId){
  if (!PRIMARY_LIST.includes(weaponId)) return { ok:false, reason:"Not a primary weapon." };
  if (p.primaryLast === weaponId) return { ok:false, reason:"Can't pick the same weapon twice in a row." };
  const cdUntil = p.primaryCooldowns[weaponId] || 0;
  if (wave < cdUntil) return { ok:false, reason:`Locked for ${cdUntil - wave + 1} more round(s).` };
  return { ok:true };
}

function applyPrimaryPick(p, weaponId){
  // cannot use for 3 rounds after picking: picked on wave W -> locked for W+1..W+3, available on W+4
  p.primaryCooldowns[weaponId] = wave + 3;
  p.primaryLast = weaponId;
  p.primary = weaponStateFor(weaponId);
  if (p.inventory?.weapons?.primary) p.inventory.weapons.primary.id = p.primary.id;
}



function lineHitsZombie(origin, dir, maxDist, z){
  // Two-sphere hitboxes: body + head (robust ray-sphere intersections)
  const tBody = raySphere(origin, dir, { x:z.x, y:1.0, z:z.z }, 0.70, maxDist);
  const tHead = raySphere(origin, dir, { x:z.x, y:1.55, z:z.z }, 0.28, maxDist);

  let best = null;
  if (tBody != null) best = { t: tBody, part: "body" };
  if (tHead != null && (!best || tHead < best.t)) best = { t: tHead, part: "head" };
  return best;
}

// Damage calculation moved to game/zm/combat/damageSystem.js

function fireHitscan(p, weaponId, aim){
  const w = WEAPONS[weaponId];
  if (!w) return;

  const ws = (weaponId === p.pistol.id) ? p.pistol : p.primary;
  if (!ws || ws.id !== weaponId) return;

  const now = Date.now();
  if (ws.reloading){
    if (now < ws.reloadUntil) return;
    ws.reloading = false;
  }
  if (now < ws.nextFireAt) return;

  // ammo
  if (ws.mag <= 0){
    // auto reload
    if (ws.reserve > 0){
      ws.reloading = true;
      ws.reloadUntil = now + w.reloadMs;
      const need = w.mag;
      const take = Math.min(need, ws.reserve);
      ws.mag = take;
      ws.reserve -= take;
      broadcast({ type:"reload", id:p.id, weapon:weaponId, until:ws.reloadUntil });
    }
    return;
  }

  // handle burst weapons
  if (w.burst){
    if (ws.burstLeft <= 0){
      ws.burstLeft = w.burst;
      ws.burstNextAt = now;
    }
  }

  const origin = { x:p.x, y:1.6, z:p.z };
  let hits = []; // {zid, part}

  const shootOne = () => {
    // spread
    const yaw = aim.yaw + (Math.random()*2-1)*w.spread;
    const pitch = clamp(aim.pitch + (Math.random()*2-1)*w.spread, -1.4, 1.4);

    const cy=Math.cos(yaw), sy=Math.sin(yaw);
    const cp=Math.cos(pitch), sp=Math.sin(pitch);
    const dir = { x: -sy*cp, y: -sp, z: -cy*cp };

    // find closest zombie hit
    let best = null;
    for (const z of zombies){
      const hit = lineHitsZombie(origin, dir, w.range, z);
      if (hit && (!best || hit.t < best.t)) best = { t: hit.t, zid: z.id, part: hit.part };
    }

    if (best){
      hits.push({ zid: best.zid, part: best.part, t: best.t });
    }
  };

  for (let i=0;i<w.pellets;i++) shootOne();

  // apply damage (pellets can stack, but we cap per-zombie pellet hits for consistency)
  hits.sort((a,b)=>a.t-b.t);
  const perZombie = new Map();
  for (const h of hits){
    const zid = h.zid;
    const used = perZombie.get(zid) || 0;
    if (used >= 2) continue;
    perZombie.set(zid, used + 1);
    const z = zombies.find(zz=>zz.id===zid);
    if (!z) continue;

    const dmg = computeWeaponDamage(w, h.part, h.t);
    z.hp -= dmg;

    // Default money system:
    // +$1 per hit, +$5 bonus on kill.
    // Script hooks run on top of these defaults.
    p.cash += 1;

    const killed = (z.hp <= 0);
    if (killed){
      p.cash += 5;
      zombies = zombies.filter(zz=>zz.id!==zid);
      zombiesKilled += 1;

      runScriptEvent('damage', { player:p, zombie:z, weaponId:weaponId, part:h.part, dmg, dist:h.t, killed:true });
      runScriptEvent('kill',   { player:p, zombie:z, weaponId:weaponId, part:h.part, dmg, dist:h.t, killed:true });

      broadcast({ type:"zdead", zid, by:p.id, cash:p.cash, zk:zombiesKilled, part: h.part, dmg });
    } else {
      runScriptEvent('damage', { player:p, zombie:z, weaponId:weaponId, part:h.part, dmg, dist:h.t, killed:false });
      broadcast({ type:"zhit", zid, by:p.id, hp:z.hp, cash:p.cash, part: h.part, dmg });
    }
  }

  ws.mag -= 1;
  ws.nextFireAt = now + w.fireMs;

  broadcast({
    type:"shot",
    id:p.id,
    weapon:weaponId,
    mag:ws.mag,
    reserve:ws.reserve
  });

  // Continue burst shots server-side by scheduling via tick (burstNextAt)
}

function tickBurstFire(){
  const now = Date.now();
  for (const p of players.values()){
    const w = WEAPONS[p.primary?.id];
    if (!w || !w.burst) continue;
    const ws = p.primary;
    if (!ws || ws.id !== p.primary.id) continue;
    if (ws.burstLeft > 0 && now >= ws.burstNextAt){
      // fire a burst bullet without new client message
      // Use lastAim stored on player
      if (ws.mag <= 0){
        ws.burstLeft = 0;
        continue;
      }
      // We call the same logic but avoid resetting burst: temporary hack
      const origin = { x:p.x, y:1.6, z:p.z };
      const aim = p.lastAim || { yaw:p.yaw, pitch:p.pitch };

      // spreaded single shot
      const yaw = aim.yaw + (Math.random()*2-1)*w.spread;
      const pitch = clamp(aim.pitch + (Math.random()*2-1)*w.spread, -1.4, 1.4);
      const cy=Math.cos(yaw), sy=Math.sin(yaw);
      const cp=Math.cos(pitch), sp=Math.sin(pitch);
      const dir = { x: -sy*cp, y: -sp, z: -cy*cp };

      let best=null;
      for (const z of zombies){
        const hit = lineHitsZombie(origin, dir, w.range, z);
        if (hit && (!best || hit.t < best.t)) best = { t:hit.t, zid:z.id, part: hit.part };
      }
      if (best){
        const z = zombies.find(zz=>zz.id===best.zid);
        if (z){
          const dmg = computeWeaponDamage(w, best.part, best.t);
          z.hp -= dmg;
          // Default money system for burst bullets: +$1 hit, +$5 kill bonus
          p.cash += 1;

          if (z.hp<=0){
            p.cash += 5;
            zombies = zombies.filter(zz=>zz.id!==best.zid);
            zombiesKilled += 1;

            runScriptEvent('damage', { player:p, zombie:z, weaponId:ws.id, part: best.part, dmg, dist: best.t, killed:true });
            runScriptEvent('kill',   { player:p, zombie:z, weaponId:ws.id, part: best.part, dmg, dist: best.t, killed:true });

            broadcast({ type:"zdead", zid:best.zid, by:p.id, cash:p.cash, zk:zombiesKilled, part: best.part, dmg });
          } else {
            runScriptEvent('damage', { player:p, zombie:z, weaponId:ws.id, part: best.part, dmg, dist: best.t, killed:false });
            broadcast({ type:"zhit", zid:best.zid, by:p.id, hp:z.hp, cash:p.cash, part: best.part, dmg });
          }
        }
      }

      ws.mag -= 1;
      broadcast({ type:"shot", id:p.id, weapon:ws.id, mag:ws.mag, reserve:ws.reserve, burst:true });

      ws.burstLeft -= 1;
      ws.burstNextAt = now + w.burstGapMs;
      if (ws.burstLeft <= 0){
        ws.nextFireAt = now + w.fireMs;
      }
    }
  }
}


function separateCircles(a, b, ra, rb){
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const min = ra + rb;
  if (dist >= min) return;
  const push = (min - dist) * 0.5;
  const nx = dx / dist;
  const nz = dz / dist;
  // push apart equally
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
}

function pushCircleOutOfAABB(ent, r, box){
  const minX = box.x - box.hx, maxX = box.x + box.hx;
  const minZ = box.z - box.hz, maxZ = box.z + box.hz;
  const cx = clamp(ent.x, minX, maxX);
  const cz = clamp(ent.z, minZ, maxZ);
  let dx = ent.x - cx;
  let dz = ent.z - cz;
  const d2 = dx*dx + dz*dz;
  if (d2 > r*r) return false;
  // If we're exactly inside (rare but possible), choose a stable push direction
  if (d2 < 1e-9){
    const left = Math.abs(ent.x - minX);
    const right = Math.abs(maxX - ent.x);
    const back = Math.abs(ent.z - minZ);
    const front = Math.abs(maxZ - ent.z);
    const m = Math.min(left, right, back, front);
    if (m === left) { dx = -1; dz = 0; }
    else if (m === right) { dx = 1; dz = 0; }
    else if (m === back) { dx = 0; dz = -1; }
    else { dx = 0; dz = 1; }
  }
  const d = Math.hypot(dx, dz) || 1e-6;
  const push = (r - d);
  ent.x += (dx / d) * push;
  ent.z += (dz / d) * push;
  return true;
}

function resolveObstacleCollisionsFor(ent, r){
  // Iterate a couple of times to deal with corner cases.
  for (let iter=0; iter<2; iter++){
    let moved = false;
    for (const b of OBSTACLES){
      moved = pushCircleOutOfAABB(ent, r, b) || moved;
    }
    if (!moved) break;
  }
}

function resolveCollisions(){
  // player-player
  const ps = Array.from(players.values());
  for (let i=0;i<ps.length;i++){
    for (let j=i+1;j<ps.length;j++){
      if (ps[i].hp<=0 || ps[j].hp<=0) continue;
      separateCircles(ps[i], ps[j], 0.45, 0.45);
      arenaClamp(ps[i]); arenaClamp(ps[j]);
    }
  }

  // zombie-zombie
  for (let i=0;i<zombies.length;i++){
    for (let j=i+1;j<zombies.length;j++){
      separateCircles(zombies[i], zombies[j], 0.55, 0.55);
    }
  }

  // player-zombie (push zombie slightly more so players don't get stuck)
  for (const p of players.values()){
    if (p.hp<=0) continue;
    for (const z of zombies){
      const dx = z.x - p.x, dz = z.z - p.z;
      const dist = Math.hypot(dx, dz) || 1e-6;
      const min = 0.45 + 0.55;
      if (dist >= min) continue;
      const nx = dx / dist, nz = dz / dist;
      const push = (min - dist);
      // push zombie away, tiny push to player
      z.x += nx * push * 0.85; z.z += nz * push * 0.85;
      p.x -= nx * push * 0.15; p.z -= nz * push * 0.15;
      arenaClamp(p);
    }
  }

  // obstacle constraints last so everything ends up in-bounds and not inside boxes
  for (const p of players.values()){
    if (p.hp<=0) continue;
    resolveObstacleCollisionsFor(p, PLAYER.radius);
    arenaClamp(p);
  }
  for (const z of zombies){
    resolveObstacleCollisionsFor(z, ZOMBIE.radius);
  }

  // pickups (weapon) overlap check
  // server awards and removes pickup; client learns via state sync
  if (PICKUPS.length){
    for (const p of players.values()){
      if (p.hp<=0) continue;
      for (let i=PICKUPS.length-1;i>=0;i--){
        const pu = PICKUPS[i];
        if (pu.kind !== 'weapon') continue;
        const dx = pu.x - p.x;
        const dz = pu.z - p.z;
        const dist = Math.hypot(dx,dz);
        if (dist > (PLAYER.radius + 0.6)) continue;
        const w = WEAPONS[pu.weaponId];
        if (!w){ PICKUPS.splice(i,1); continue; }

        if (w.slot === 'pistol'){
          p.pistol = weaponStateFor(pu.weaponId);
        } else {
          p.primary = weaponStateFor(pu.weaponId);
        }
        PICKUPS.splice(i,1);
        broadcast({ type:"loadout", id:p.id, pistol:p.pistol, primary:p.primary });
        broadcast({ type:"toast", msg: `${p.name || 'Player'} picked up ${w.name}` });
      }
    }
  }
}




function snapshotFor(p){
  return {
    id:p.id, name:p.name,
    x:p.x, y:p.y, z:p.z,
    yaw:p.yaw, pitch:p.pitch,
    hp:p.hp, cash:p.cash,
    pistol:{ id:p.pistol.id, mag:p.pistol.mag, reserve:p.pistol.reserve },
    primary:p.primary ? { id:p.primary.id, mag:p.primary.mag, reserve:p.primary.reserve } : null,
    // Phase 1 inventory (server authoritative). Client can display or ignore fields it doesn't know yet.
    inventory: p.inventory || null,
    armor:p.armor,
    speed:p.speed,
    godMode: !!p.godMode
  };
}

function makeDefaultInventory(p){
  return {
    weapons: {
      primary: { id: p.primary ? p.primary.id : null },
      pistol: { id: p.pistol ? p.pistol.id : null },
      launcher: { id: null }, // rocket launcher slot
    },
    equipment: {
      medkit: { count: 0, max: 2 },
      frag: { count: 0, max: 3 },
      stun: { count: 0, max: 3 },
    },
    perks: [],
    meta: {
      // reserved for later
    }
  };
}

// Player spawn selection should avoid every collision box.
function dist2(x1, z1, x2, z2){
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.hypot(dx, dz);
}

function tooCloseToBox(x, z, o, pad=0.9){
  const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
  const hx = Math.abs(o.hx || 0);
  const hz = Math.abs(o.hz || 0);
  const boxRadius = Math.hypot(hx, hz);
  return dist2(x, z, o.x, o.z) <= (boxRadius + r + pad);
}

function isSpawnBlocked(x, z, pad=0.65){
  const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
  const extra = r + pad;
  for (const o of OBSTACLES){
    const hx = (o.hx||0) + extra;
    const hz = (o.hz||0) + extra;
    // AABB overlap
    if (Math.abs(x - o.x) <= hx && Math.abs(z - o.z) <= hz) return true;
    // Corner safety radius
    if (tooCloseToBox(x, z, o, pad)) return true;
  }
  return false;
}

function nudgeSpawnOut(x, z){
  const r = (PLAYER && PLAYER.radius != null) ? PLAYER.radius : 0.55;
  const extra = r + 0.75;
  let px = x, pz = z;
  for (let iter=0; iter<8; iter++){
    let moved=false;
    for (const o of OBSTACLES){
      const hx = (o.hx||0) + extra;
      const hz = (o.hz||0) + extra;
      const dx = px - o.x;
      const dz = pz - o.z;
      const ax = Math.abs(dx);
      const az = Math.abs(dz);
      if (ax <= hx && az <= hz){
        const penX = hx - ax;
        const penZ = hz - az;
        if (penX < penZ) px += (dx >= 0 ? 1 : -1) * (penX + 0.05);
        else pz += (dz >= 0 ? 1 : -1) * (penZ + 0.05);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
}

function findSafeSpawn(){
  // First: jitter around the anchor. This is the most reliable way to avoid
  // "spawn in bush" situations, because the anchor zone is kept clear when
  // obstacles are generated.
  for (let i=0;i<80;i++){
    const ang = Math.random()*Math.PI*2;
    const rad = 1.5 + Math.random()*7.5;
    const x = PLAYER_SPAWN_ANCHOR.x + Math.cos(ang)*rad;
    const z = PLAYER_SPAWN_ANCHOR.z + Math.sin(ang)*rad;
    if (!isSpawnBlocked(x,z,0.9)) return nudgeSpawnOut(x,z);
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
      if (isSpawnBlocked(x,z)) continue;
      return nudgeSpawnOut(x,z);
    }
  }
  const pts = [
    {x:-14,z:-14},{x:14,z:-14},{x:-14,z:14},{x:14,z:14},
    {x:0,z:-18},{x:0,z:18},{x:-18,z:0},{x:18,z:0}
  ];
  for (const p of pts){ if (!isSpawnBlocked(p.x,p.z,1.0)) return nudgeSpawnOut(p.x,p.z); }
  for (let gx=-22; gx<=22; gx+=2){
    for (let gz=-22; gz<=22; gz+=2){
      if (!isSpawnBlocked(gx,gz,1.0)) return nudgeSpawnOut(gx,gz);
    }
  }
  return nudgeSpawnOut(0,0);
}

function handleConnection(ws){
  const id = uid();
  wsByPlayerId.set(id, ws);
  ws._pid = id;
  const sp = findSafeSpawn();
  const p = {
    id, name:"Player-"+id.slice(0,4),
    x: sp.x, y:0, z: sp.z,
    yaw:0, pitch:0,
    hp:100, cash:20,
    armor:0,
    speed:PLAYER.speed,
    nextHitAt:0,

    godMode:false,

    pistol: weaponStateFor(PISTOL_LIST[Math.floor(Math.random()*PISTOL_LIST.length)]),
    primary: null,

    // Phase 1: inventory system. Weapon states still live at top-level for compatibility,
    // but inventory is the canonical slot registry going forward.
    inventory: null,

    // pick rules
    primaryLast: null,
    primaryCooldowns: {},

    lastAim: { yaw:0, pitch:0 }
  };

  p.inventory = makeDefaultInventory(p);
  players.set(id, p);

  emitJSEvent('onPlayerConnect', {
    playerId: p.id,
    player: { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, hp: p.hp, cash: p.cash },
    time: Date.now(),
    wave,
    betweenRounds,
  });

  emitJSEvent('onPlayerSpawned', {
    playerId: p.id,
    player: { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, hp: p.hp, cash: p.cash },
    time: Date.now(),
    wave,
    betweenRounds,
  });


// .dzs hook: playerSpawn
try {
  runScriptEvent('playerSpawn', { player: p, time: Date.now() });
} catch (e) {}

  ws.send(JSON.stringify({
    type:"welcome",
    id,
    arena: ARENA,
    obstacles: OBSTACLES,
    pickups: PICKUPS,
    weapons: WEAPONS,
    lists: { primary: PRIMARY_LIST, pistols: PISTOL_LIST },
    round: { between: betweenRounds, wave, zombiesTarget }
  }));

  ws.send(JSON.stringify({
    type:"snapshot",
    players: Array.from(players.values()).map(snapshotFor),
    zombies,
    pickups: PICKUPS,
  }));

  broadcast({ type:"join", player: snapshotFor(p) });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const me = players.get(id);
    if (!me) return;

    if (msg.type === "getDzsHelp"){
      try{ ws.send(JSON.stringify({ type:"dzsHelp", help: dzs?.getHelp?.() || null })); }catch(_e){}
      return;
    }

    if (msg.type === "input"){
      // Server integrates based on inputs, but accept latest yaw/pitch
      me.yaw = msg.yaw ?? me.yaw;
      me.pitch = clamp(msg.pitch ?? me.pitch, -1.4, 1.4);
      me.lastAim = { yaw: me.yaw, pitch: me.pitch };
      me._keys = msg.keys || {};
      me._dtClient = msg.dt || 0;
    }

    if (msg.type === "shoot"){
      if (betweenRounds) return;
      const wid = msg.weapon;
      combat.fireHitscan(me, wid, msg.aim || { yaw: me.yaw, pitch: me.pitch });
    }

    if (msg.type === "reload"){
      const wid = msg.weapon;
      const w = WEAPONS[wid];
      if (!w) return;
      const wsRef = (me.pistol && me.pistol.id===wid) ? me.pistol : (me.primary && me.primary.id===wid ? me.primary : null);
      if (!wsRef) return;
      if (wsRef.reloading) return;
      if (wsRef.reserve <= 0) return;
      wsRef.reloading = true;
      wsRef.reloadUntil = Date.now() + w.reloadMs;
      const need = w.mag;
      const take = Math.min(need, wsRef.reserve);
      wsRef.mag = take;
      wsRef.reserve -= take;
      broadcast({ type:"reload", id:me.id, weapon:wid, until:wsRef.reloadUntil, mag:wsRef.mag, reserve:wsRef.reserve });
    }

    if (msg.type === "pickPistol"){
      if (!PISTOL_LIST.includes(msg.weapon)) return;
      if (!betweenRounds && wave>1) return; // only between rounds or before first wave
      me.pistol = weaponStateFor(msg.weapon);
      if (me.inventory?.weapons?.pistol) me.inventory.weapons.pistol.id = me.pistol.id;
      broadcast({ type:"loadout", id:me.id, pistol: me.pistol, inventory: me.inventory });
    }



    if (msg.type === "devSetLoadout"){
      if (!DEV_ALLOW_MIDROUND) return;
      // Allow swapping weapons mid-round for testing.
      if (msg.primary){
        const wid = msg.primary;
        const w = WEAPONS[wid];
        if (w && w.slot === "primary"){
          me.primary = weaponStateFor(wid);
        }
      }
      if (msg.pistol){
        const wid = msg.pistol;
        const w = WEAPONS[wid];
        if (w && w.slot === "pistol"){
          me.pistol = weaponStateFor(wid);
        }
      }
      broadcast({ type:"loadout", id:me.id, pistol: me.pistol, primary: me.primary });
    }
    
    if (msg.type === "devEquipWeapon"){
      if (!DEV_ALLOW_MIDROUND) return;
      const wid = msg.weapon;
      const w = WEAPONS[wid];
      if (!w) return;
      if (w.slot === "primary"){
        me.primary = weaponStateFor(wid);
        if (me.inventory?.weapons?.primary) me.inventory.weapons.primary.id = me.primary.id;
        broadcast({ type:"loadout", id:me.id, primary: me.primary, inventory: me.inventory });
      } else if (w.slot === "pistol"){
        me.pistol = weaponStateFor(wid);
        if (me.inventory?.weapons?.pistol) me.inventory.weapons.pistol.id = me.pistol.id;
        broadcast({ type:"loadout", id:me.id, pistol: me.pistol, inventory: me.inventory });
      }
    }

    if (msg.type === "devGiveWeapon"){
      if (!DEV_ALLOW_MIDROUND) return;
      const wid = msg.weapon;
      const w = WEAPONS[wid];
      if (!w) return;
      // "Give" adds the weapon to the appropriate slot without changing the client's active slot.
      // (The client decides what slot is active; the server is authoritative over inventory.)
      if (w.slot === "primary"){
        me.primary = weaponStateFor(wid);
        if (me.inventory?.weapons?.primary) me.inventory.weapons.primary.id = me.primary.id;
        broadcast({ type:"loadout", id:me.id, primary: me.primary, inventory: me.inventory });
      } else if (w.slot === "pistol"){
        me.pistol = weaponStateFor(wid);
        if (me.inventory?.weapons?.pistol) me.inventory.weapons.pistol.id = me.pistol.id;
        broadcast({ type:"loadout", id:me.id, pistol: me.pistol, inventory: me.inventory });
      }
    }

    if (msg.type === "devSetGodMode"){
      const targetId = msg.targetId || me.id;
      const t = players.get(targetId);
      if (!t) return;
      t.godMode = !!msg.enabled;
      broadcast({ type:"state", players: Array.from(players.values()).map(snapshotFor), zombies, pickups: PICKUPS, round: { between: betweenRounds, wave, zombiesTarget } });
    }

    if (msg.type === "devTeleportZombieToPlayer"){
      const zid = msg.zid;
      const z = zombies.find(zz=>zz.id===zid);
      if (!z) return;
      const targetId = msg.targetId || me.id;
      const t = players.get(targetId);
      if (!t) return;
      z.x = t.x; z.z = t.z;
      broadcast({ type:"snapshot", players: Array.from(players.values()).map(snapshotFor), zombies, pickups: PICKUPS });
    }

    if (msg.type === "pickPrimary"){
      if (!betweenRounds) return;
      const res = canPickPrimary(me, msg.weapon);
      if (!res.ok){
        ws.send(JSON.stringify({ type:"pickDenied", reason: res.reason }));
        return;
      }
      applyPrimaryPick(me, msg.weapon);
      broadcast({ type:"loadout", id:me.id, primary: me.primary, inventory: me.inventory, cash: me.cash, wave });
    }

    if (msg.type === "ready"){
      if (!betweenRounds) return;
      // start wave when any player ready; you can refine to require all players
      if (startNextWaveFn) startNextWaveFn();
    }

    if (msg.type === "restart"){
      // Player requested a full restart (default on death popup)
      if (playerLifecycle) playerLifecycle.restartMatch(`Restarted by ${me.name || me.id}`);
      if (hud) hud.clearAll();
      return;
    }

    if (msg.type === "useMedkit"){
      // Consumable medkit from inventory (Phase 1).
      const slot = me.inventory?.equipment?.medkit;
      if (!slot || slot.count <= 0){
        ws.send(JSON.stringify({ type:"toast", msg:"No medkits." }));
        return;
      }
      if (me.hp >= 100){
        ws.send(JSON.stringify({ type:"toast", msg:"HP already full." }));
        return;
      }
      slot.count -= 1;
      me.hp = clamp(me.hp + 35, 0, 100);
      broadcast({ type:"loadout", id:me.id, inventory: me.inventory, hp: me.hp });
    }

    if (msg.type === "buy"){
      if (!betweenRounds) return;
      const item = msg.item;
      const prices = { medkit:10, armor:40, speed:25 };
      const cost = prices[item];
      if (!cost) return;
      if (me.cash < cost){ ws.send(JSON.stringify({ type:"toast", msg:"Not enough cash." })); return; }
      me.cash -= cost;
      if (item==="medkit"){
        const slot = me.inventory?.equipment?.medkit;
        if (!slot){ ws.send(JSON.stringify({ type:"toast", msg:"Medkit slot missing." })); return; }
        if (slot.count >= slot.max){
          me.cash += cost; // refund
          ws.send(JSON.stringify({ type:"toast", msg:`Medkits full (${slot.max}).` }));
          return;
        }
        slot.count += 1;
      }
      if (item==="armor") me.armor = clamp(me.armor + 0.25, 0, 0.6);
      if (item==="speed") me.speed = clamp(me.speed + 0.9, PLAYER.speed, PLAYER.speed*1.8);
      broadcast({ type:"bought", id:me.id, item, cash:me.cash, hp:me.hp, armor:me.armor, speed:me.speed, inventory: me.inventory });
    }
  });

  ws.on("close", () => {
    players.delete(id);
    wsByPlayerId.delete(id);
    broadcast({ type:"leave", id });
  });
}




// TICK_LOOP_REMOVED


// Replaced tick loop. Uses the same ordering as v16.
function tick(){
  // Wired module functions (set in createZMServer)
  if (integratePlayersFn) integratePlayersFn();
  if (spawnLogicFn) spawnLogicFn();
  if (updateZombiesFn) updateZombiesFn();
  resolveCollisions();
  combat.tickBurstFire();

  // Stream script HUD updates (only when dirty).
  if (hud) hud.flush();

  // .dzs hook: tick
  try { runScriptEvent('tick', { time: Date.now() }); } catch (e) {}

  // End-of-wave condition:
  // Only end the wave once we've spawned the full quota AND all zombies are dead.
  // This prevents premature wave endings if a wave starts with a low initial spawn.
  if (!betweenRounds && zombiesTarget > 0 && zombiesSpawned >= zombiesTarget && zombiesKilled >= zombiesTarget && zombies.length === 0){
    if (endWaveFn) endWaveFn();
  }

  // Snapshot broadcast (authoritative world state).
  // Throttled so clients stay responsive without spamming bandwidth.
  tick._snapCounter = (tick._snapCounter || 0) + 1;
  const SNAP_EVERY = 3; // ~20Hz if TICK_HZ=60
  if ((tick._snapCounter % SNAP_EVERY) === 0){
    broadcast({
      type:'snapshot',
      round: { between: betweenRounds, wave, zombiesTarget, zombiesSpawned, zombiesKilled },
      players: Array.from(players.values()).map(snapshotFor),
      zombies,
      pickups: PICKUPS,
    });
  }
}


function startTickLoop(){
  if (_tickHandle) return;
  _tickHandle = setInterval(() => {
    try {
      tick();
    } catch (e){
      console.error('[tick] error:', e?.stack || e);
    }
  }, 1000 / TICK_HZ);
}
function createZMServer(opts){
  clients = opts.clients || clients;

  // HUD system (server -> client overlay), available to custom scripts.
  hud = createHudSystem({ sendTo });

  // DZS engine (parser moved out of zmServer.js)
  dzs = createDzsEngine({
    baseDir: __dirname,
    arena: ARENA,
    obstacles: OBSTACLES,
    pickups: PICKUPS,
    players,
    weapons: WEAPONS,
    hud,
    getWave: () => wave,
    log: (...a) => console.log(...a),
  });
  runScriptEvent = dzs.runScriptEvent;
  loadScript = dzs.loadScript;
  loadAllDzs = dzs.loadAllDzs;

  // Auto-load all .dzs scripts from supported directories (scripts/, ../../scripts/, customscripts/)
  try { loadAllDzs(); } catch (e){ console.warn('[dzs] autoload failed:', e?.message || e); }


  // Modularized logic (players + zombies)
  const playerLogic = createPlayerLogic({
    players,
    ARENA,
    PLAYER,
    DT,
    rand,
    arenaClamp,
    resolveObstacleCollisionsFor,
    obstacles: OBSTACLES,
    getBetweenRounds: () => betweenRounds,
  });

  // Player lifecycle (death handling + match restart)
  playerLifecycle = createPlayerLifecycle({
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
    obstacles: OBSTACLES,
    spawnAnchor: PLAYER_SPAWN_ANCHOR,
    // round state accessors
    getWave: () => wave,
    setWave: (v) => { wave = v; },
    getBetweenRounds: () => betweenRounds,
    setBetweenRounds: (v) => { betweenRounds = !!v; },
    setZombiesTarget: (v) => { zombiesTarget = v; },
    setZombiesSpawned: (v) => { zombiesSpawned = v; },
    setZombiesKilled: (v) => { zombiesKilled = v; },
    setLastSpawnAt: (v) => { lastSpawnAt = v; },
  });

  const zombieLogic = createZombieLogic({
    zombies,
    players,
    ARENA,
    PLAYER,
    ZOMBIE,
    DT,
    rand,
    uid,
    resolveObstacleCollisionsFor,
    nearestPlayer: playerLogic.nearestPlayer,
    broadcast,
    emitGameEvent: emitJSEvent,
    clamp,

    // shared round state accessors
    getWave: () => wave,
    setWave: (v) => { wave = v; },
    getBetweenRounds: () => betweenRounds,
    setBetweenRounds: (v) => { betweenRounds = !!v; },
    getZombiesTarget: () => zombiesTarget,
    setZombiesTarget: (v) => { zombiesTarget = v; },
    getZombiesSpawned: () => zombiesSpawned,
    setZombiesSpawned: (v) => { zombiesSpawned = v; },
    setZombiesKilled: (v) => { zombiesKilled = v; },
    getSpawnEveryMs: () => spawnEveryMs,
    setSpawnEveryMs: (v) => { spawnEveryMs = v; },
    getLastSpawnAt: () => lastSpawnAt,
    setLastSpawnAt: (v) => { lastSpawnAt = v; },
    setRoundStartAt: (v) => { roundStartAt = v; },

    // default death behavior: prompt restart
    onPlayerDeathDefault: (pid, cause) => {
      try {
        const pl = players.get(pid);
        runScriptEvent('playerDeath', { player: pl || { id: pid }, time: Date.now(), cause });
      } catch (e) {}
      if (playerLifecycle) playerLifecycle.handlePlayerDeath(pid, cause);
    },
  });

  const { nearestPlayer, lineHitsPlayer, integratePlayers } = playerLogic;
  const { spawnZombie, updateZombies, startNextWave, endWave, spawnLogic } = zombieLogic;

  // Wire module APIs for the tick loop and WS handlers.
  integratePlayersFn = integratePlayers;
  spawnLogicFn = spawnLogic;
  updateZombiesFn = updateZombies;
  startNextWaveFn = startNextWave;
  endWaveFn = endWave;

  // Create engine combat pipeline that can notify scripts.
  combat = createCombatSystem({
    getWeapons: () => WEAPONS,
    getZombies: () => zombies,
    setZombies: (next) => { zombies = next; },
    getPlayers: () => players,
    broadcast,
    runScriptEvent,
    emitGameEvent: emitJSEvent,
    getWave: () => wave,
    endWave,
    getBetweenRounds: () => betweenRounds,
    onZombieKilled: () => { zombiesKilled += 1; },
    clamp,
  });

  // Load default map/script if present.
  try {
    // keep v16 default behaviour (scripts/level1.dzs)
    if (!opts.skipDefaultScript){
      loadScript(path.join(__dirname, '../../scripts/level1.dzs'));
    }
  } catch (e){
    console.warn('[script] load failed:', e?.message || e);
  }

  startTickLoop();
  emitJSEvent('onGameStart', { time: Date.now(), wave, betweenRounds });
  try { runScriptEvent('gameStart', { time: Date.now() }); } catch (e) {}

  // Best-effort shutdown hooks for onGameEnd.
  if (!global.__ZM_GAME_END_HOOKS_INSTALLED){
    global.__ZM_GAME_END_HOOKS_INSTALLED = true;
    const end = (reason) => {
      try { emitJSEvent('onGameEnd', { time: Date.now(), reason, wave, betweenRounds }); } catch {}
    };
    process.once('SIGINT', () => { end('SIGINT'); process.exit(0); });
    process.once('SIGTERM', () => { end('SIGTERM'); process.exit(0); });
    process.once('exit', () => { end('exit'); });
  }
  return { handleConnection };
}

module.exports = { createZMServer };
