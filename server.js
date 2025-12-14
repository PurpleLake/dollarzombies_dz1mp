const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const TICK_HZ = 20;
const DT = 1 / TICK_HZ;

const DEV_ALLOW_MIDROUND = true; // dev menu can swap guns mid-wave

const ARENA = { size: 120 }; // square arena, centered at origin
const PLAYER = { speed: 8.0, radius: 0.45, height: 1.7 };
const ZOMBIE = { speed: 2.1, radius: 0.55, hpBase: 90 };

// ----- Obstacles (boxes) -----
// Server-authoritative so players/zombies can't walk through them.
// Axis-aligned on the XZ plane.
// { id, x, z, hx, hz, h }
const OBSTACLES = [];

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
  for (let i=0;i<count;i++){
    const hx = 0.9 + rnd()*1.4;
    const hz = 0.9 + rnd()*1.4;
    let x = (rnd()*2-1) * s;
    let z = (rnd()*2-1) * s;
    // keep center area clearer
    if (Math.hypot(x,z) < 12){
      x += (x<0?-1:1) * 14;
      z += (z<0?-1:1) * 14;
    }
    OBSTACLES.push({ id:`box_${i}`, x, z, hx, hz, h: 1.25 + rnd()*0.85 });
  }
}

function parseScriptValue(v){
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

function loadScriptFile(){
  // Minimal scripting foundation (v0): a tiny line-based script that can spawn entities.
  // Format examples:
  //   spawn box x=10 z=5 hx=1.2 hz=1.2 h=1.4
  //   spawn zombie x=20 z=-20
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'scripts', 'level1.dzs');
  if (!fs.existsSync(scriptPath)) return;
  const txt = fs.readFileSync(scriptPath, 'utf8');
  const lines = txt.split(/\r?\n/);
  for (const raw of lines){
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] !== 'spawn') continue;
    const kind = parts[1];
    const kv = {};
    for (const p of parts.slice(2)){
      const [k,v] = p.split('=');
      if (!k) continue;
      kv[k] = parseScriptValue(v);
    }
    if (kind === 'box'){
      OBSTACLES.push({
        id: kv.id || uid(),
        x: Number(kv.x ?? 0),
        z: Number(kv.z ?? 0),
        hx: Number(kv.hx ?? 1.2),
        hz: Number(kv.hz ?? 1.2),
        h: Number(kv.h ?? 1.5),
      });
    }
    if (kind === 'zombie'){
      const hp = ZOMBIE.hpBase + wave*14;
      const speed = ZOMBIE.speed + wave*0.06;
      zombies.push({ id: kv.id || uid(), x:Number(kv.x ?? 0), y:0, z:Number(kv.z ?? 0), hp, speed });
    }
  }
}

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

const WEAPONS = {
  // --- Pistols (semi-auto) ---
  // Target baseline: 20 body damage at close range
  glock:   { name:"Glock", slot:"pistol", mode:"semi", fireMs:180, dmgClose:20, dmgFar:14, spread:0.010, pellets:1, range:55, mag:17, reloadMs:1000 },
  p99:     { name:"P99",   slot:"pistol", mode:"semi", fireMs:160, dmgClose:20, dmgFar:14, spread:0.012, pellets:1, range:52, mag:15, reloadMs:1050 },
  fiveseven:{ name:"Five-Seven", slot:"pistol", mode:"semi", fireMs:170, dmgClose:22, dmgFar:15, spread:0.011, pellets:1, range:58, mag:20, reloadMs:1150 },

  // --- Shotguns ---
  // Target baseline: 70 total body damage if most pellets land at close range
  shotgun_semi:{ name:"Shotgun (Semi)", slot:"primary", mode:"semi", fireMs:520, dmgClose:10, dmgFar:6, spread:0.080, pellets:7, range:22, mag:8, reloadMs:1450 },
  shotgun_auto:{ name:"Shotgun (Auto)", slot:"primary", mode:"auto", fireMs:230, dmgClose:10, dmgFar:6, spread:0.090, pellets:7, range:20, mag:12, reloadMs:1600 },

  // --- Assault Rifles ---
  // Target baseline: 34 body damage at close range
  ar_burst: { name:"AR (Burst)", slot:"primary", mode:"burst", fireMs:320, burst:3, burstGapMs:65, dmgClose:34, dmgFar:22, spread:0.020, pellets:1, range:65, mag:30, reloadMs:1500 },
  ar_full:  { name:"AR (Full)",  slot:"primary", mode:"auto",  fireMs:95,  dmgClose:34, dmgFar:22, spread:0.024, pellets:1, range:62, mag:30, reloadMs:1550 },

  // --- DMR (semi-auto) ---
  // Target baseline: 60 body damage, 5-round mag
  dmr_5:    { name:"DMR (5-Round)", slot:"primary", mode:"semi", fireMs:260, dmgClose:60, dmgFar:42, spread:0.010, pellets:1, range:95, mag:5, reloadMs:1700 },

  // --- LMG ---
  // Target baseline: 27 body damage
  mg42:     { name:"MG42", slot:"primary", mode:"auto", fireMs:65, dmgClose:27, dmgFar:18, spread:0.030, pellets:1, range:70, mag:75, reloadMs:2200 },
};

const PRIMARY_LIST = ["shotgun_semi","shotgun_auto","ar_burst","ar_full","dmr_5","mg42"];
const PISTOL_LIST = ["glock","p99","fiveseven"];

function weaponStateFor(id){
  const w = WEAPONS[id];
  return { id, mag:w.mag, reserve:w.mag*4, reloading:false, reloadUntil:0, nextFireAt:0, burstLeft:0, burstNextAt:0 };
}

const players = new Map(); // id -> player
let zombies = []; // {id,x,y,z,hp,kind,speed}
let wave = 1;
let betweenRounds = true;
let roundStartAt = Date.now();
let zombiesTarget = 8;
let zombiesSpawned = 0;
let zombiesKilled = 0;
let spawnEveryMs = 700;
let lastSpawnAt = 0;

// Build deterministic obstacles and then allow scripts to add more.
genObstacles();
loadScriptFile();

function arenaClamp(p){
  const s = ARENA.size/2 - 1;
  p.x = clamp(p.x, -s, s);
  p.z = clamp(p.z, -s, s);
}

function broadcast(obj){
  const msg = JSON.stringify(obj);
  for (const c of wss.clients){
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
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

function spawnZombie(){
  const edge = Math.floor(Math.random()*4);
  const s = ARENA.size/2 + 4;
  let x=0,z=0;
  if (edge===0){ x=rand(-s,s); z=-s; }
  if (edge===1){ x=s; z=rand(-s,s); }
  if (edge===2){ x=rand(-s,s); z=s; }
  if (edge===3){ x=-s; z=rand(-s,s); }

  const hp = ZOMBIE.hpBase + wave*14;
  const speed = ZOMBIE.speed + wave*0.06 + (Math.random()<Math.min(0.18, 0.05+wave*0.01) ? 0.9 : 0);
  zombies.push({ id: uid(), x, y:0, z, hp, speed });
}

function startNextWave(){
  betweenRounds = false;
  roundStartAt = Date.now();
  zombiesTarget = Math.floor(8 + wave*2.4);
  spawnEveryMs = clamp(760 - wave*18, 280, 760);
  zombiesSpawned = 0;
  zombiesKilled = 0;
  lastSpawnAt = 0;
  broadcast({ type:"round", between:false, wave, zombiesTarget });
}

function endWave(){
  betweenRounds = true;
  wave += 1;
  broadcast({ type:"round", between:true, wave, zombiesTarget:0 });
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

function lineHitsZombie(origin, dir, maxDist, z){
  // Two-sphere hitboxes: body + head (robust ray-sphere intersections)
  const tBody = raySphere(origin, dir, { x:z.x, y:1.0, z:z.z }, 0.70, maxDist);
  const tHead = raySphere(origin, dir, { x:z.x, y:1.55, z:z.z }, 0.28, maxDist);

  let best = null;
  if (tBody != null) best = { t: tBody, part: "body" };
  if (tHead != null && (!best || tHead < best.t)) best = { t: tHead, part: "head" };
  return best;
}

function computeDamage(w, part, dist){
  // Foundation: simple linear falloff from dmgClose -> dmgFar over [0..range]
  const close = (w.dmgClose != null) ? w.dmgClose : (w.damage != null ? w.damage : 20);
  const far = (w.dmgFar != null) ? w.dmgFar : Math.max(1, Math.round(close * 0.65));
  const r = Math.max(1, w.range || 50);
  const t = Math.max(0, Math.min(1, dist / r));
  const base = Math.round(close + (far - close) * t);
  const mult = (part === 'head') ? 2.0 : 1.0;
  return Math.max(1, Math.round(base * mult));
}

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

    const dmg = computeDamage(w, h.part, h.t);
    z.hp -= dmg;

    if (z.hp <= 0){
      zombies = zombies.filter(zz=>zz.id!==zid);
      zombiesKilled += 1;
      p.cash += 6 + Math.floor(wave*0.4);
      broadcast({ type:"zdead", zid, by:p.id, cash:p.cash, zk:zombiesKilled, part: h.part, dmg });
      if (!betweenRounds && zombiesKilled >= zombiesTarget) endWave();
    } else {
      broadcast({ type:"zhit", zid, by:p.id, hp:z.hp, part: h.part, dmg });
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
          const dmg = computeDamage(w, best.part, best.t);
          z.hp -= dmg;
          if (z.hp<=0){
            zombies = zombies.filter(zz=>zz.id!==best.zid);
            zombiesKilled += 1;
            p.cash += 6 + Math.floor(wave*0.4);
            broadcast({ type:"zdead", zid:best.zid, by:p.id, cash:p.cash, zk:zombiesKilled, part: best.part, dmg });
            if (!betweenRounds && zombiesKilled >= zombiesTarget) endWave();
          } else {
            broadcast({ type:"zhit", zid:best.zid, by:p.id, hp:z.hp, part: best.part, dmg });
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
}
function updateZombies(){
  for (const z of zombies){
    const target = nearestPlayer(z.x, z.z);
    if (!target) continue;
    const dx = target.x - z.x;
    const dz = target.z - z.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    z.x += (dx/d) * z.speed * DT;
    z.z += (dz/d) * z.speed * DT;

    // obstacle collision
    resolveObstacleCollisionsFor(z, ZOMBIE.radius);

    // attack if close
    const dist = Math.hypot(target.x - z.x, target.z - z.z);
    if (dist < (PLAYER.radius + ZOMBIE.radius + 0.25)){
      const now = Date.now();
      if (now >= target.nextHitAt){
        target.nextHitAt = now + 650;
        const dmg = 10 + Math.floor(wave*0.4);
        const reduced = dmg * (1 - target.armor);
        target.hp = clamp(target.hp - reduced, 0, 100);
        broadcast({ type:"phit", id:target.id, hp:target.hp });
        if (target.hp <= 0){
          broadcast({ type:"pdown", id:target.id });
          // simple respawn on next betweenRounds
        }
      }
    }
  }
}

function spawnLogic(){
  if (betweenRounds) return;
  if (zombiesSpawned >= zombiesTarget) return;
  const now = Date.now();
  if (now - lastSpawnAt < spawnEveryMs) return;
  lastSpawnAt = now;
  zombiesSpawned += 1;
  spawnZombie();
}

function snapshotFor(p){
  return {
    id:p.id, name:p.name,
    x:p.x, y:p.y, z:p.z,
    yaw:p.yaw, pitch:p.pitch,
    hp:p.hp, cash:p.cash,
    pistol:{ id:p.pistol.id, mag:p.pistol.mag, reserve:p.pistol.reserve },
    primary:p.primary ? { id:p.primary.id, mag:p.primary.mag, reserve:p.primary.reserve } : null,
    armor:p.armor,
    speed:p.speed
  };
}

wss.on("connection", (ws) => {
  const id = uid();
  const p = {
    id, name:"Player-"+id.slice(0,4),
    x: rand(-8,8), y:0, z: rand(-8,8),
    yaw:0, pitch:0,
    hp:100, cash:20,
    armor:0,
    speed:PLAYER.speed,
    nextHitAt:0,

    pistol: weaponStateFor(PISTOL_LIST[Math.floor(Math.random()*PISTOL_LIST.length)]),
    primary: null,

    // pick rules
    primaryLast: null,
    primaryCooldowns: {},

    lastAim: { yaw:0, pitch:0 }
  };
  players.set(id, p);

  ws.send(JSON.stringify({
    type:"welcome",
    id,
    arena: ARENA,
    obstacles: OBSTACLES,
    weapons: WEAPONS,
    lists: { primary: PRIMARY_LIST, pistols: PISTOL_LIST },
    round: { between: betweenRounds, wave, zombiesTarget }
  }));

  ws.send(JSON.stringify({
    type:"snapshot",
    players: Array.from(players.values()).map(snapshotFor),
    zombies
  }));

  broadcast({ type:"join", player: snapshotFor(p) });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const me = players.get(id);
    if (!me) return;

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
      fireHitscan(me, wid, msg.aim || { yaw: me.yaw, pitch: me.pitch });
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
      broadcast({ type:"loadout", id:me.id, pistol: me.pistol });
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
    if (msg.type === "pickPrimary"){
      if (!betweenRounds) return;
      const res = canPickPrimary(me, msg.weapon);
      if (!res.ok){
        ws.send(JSON.stringify({ type:"pickDenied", reason: res.reason }));
        return;
      }
      applyPrimaryPick(me, msg.weapon);
      broadcast({ type:"loadout", id:me.id, primary: me.primary, cash: me.cash, wave });
    }

    if (msg.type === "ready"){
      if (!betweenRounds) return;
      // start wave when any player ready; you can refine to require all players
      startNextWave();
    }

    if (msg.type === "buy"){
      if (!betweenRounds) return;
      const item = msg.item;
      const prices = { medkit:10, armor:40, speed:25 };
      const cost = prices[item];
      if (!cost) return;
      if (me.cash < cost){ ws.send(JSON.stringify({ type:"toast", msg:"Not enough cash." })); return; }
      me.cash -= cost;
      if (item==="medkit") me.hp = clamp(me.hp + 35, 0, 100);
      if (item==="armor") me.armor = clamp(me.armor + 0.25, 0, 0.6);
      if (item==="speed") me.speed = clamp(me.speed + 0.9, PLAYER.speed, PLAYER.speed*1.8);
      broadcast({ type:"bought", id:me.id, item, cash:me.cash, hp:me.hp, armor:me.armor, speed:me.speed });
    }
  });

  ws.on("close", () => {
    players.delete(id);
    broadcast({ type:"leave", id });
  });
});

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

    // simple respawn if down and betweenRounds
    if (p.hp<=0 && betweenRounds){
      p.hp = 100;
      p.x = rand(-8,8);
      p.z = rand(-8,8);
      p.cash = Math.max(p.cash, 10);
    }
  }
}

setInterval(() => {
  integratePlayers();
  spawnLogic();
  updateZombies();
  resolveCollisions();
  tickBurstFire();

  broadcast({
    type:"state",
    round: { between: betweenRounds, wave, zombiesTarget, zombiesSpawned, zombiesKilled },
    players: Array.from(players.values()).map(snapshotFor),
    zombies
  });
}, 1000 / TICK_HZ);

server.listen(3000, () => console.log("Server on http://localhost:3000"));
