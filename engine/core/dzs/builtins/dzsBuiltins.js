import { clamp } from "../../utilities/Math.js";

// Used by the Dev Menu to display syntax + usage + examples.
export const BUILTIN_DOCS = Object.freeze([
  { name:"log", sig:"log(...words)", desc:"Prints a line to the in-game log.", example:"log Hello from DZS" },

  // Notifications
  { name:"iPrintLn", sig:"iPrintLn(player, text)", desc:"Small notification (bottom-right).", example:"iPrintLn(player, ^2Purchased!)" },
  { name:"iPrintLnBold", sig:"iPrintLnBold(player, text)", desc:"Bold notification (center).", example:"iPrintLnBold(player, ^1WARNING!)" },
  { name:"iPrintLnAll", sig:"iPrintLnAll(text)", desc:"Notify all players.", example:"iPrintLnAll(^3Round start)" },

  // HUD
  { name:"createHudItem", sig:"createHudItem(player, color, w, h, x, y, text, shader)", desc:"Creates a HUD panel item.", example:"id = createHudItem(player, #ffffff, 220, 40, 20, 20, Hello, )" },
  { name:"createHudText", sig:"createHudText(player, color, x, y, text, shader)", desc:"Creates a HUD text item.", example:"id = createHudText(player, #ffffff, 20, 60, Hi, )" },
  { name:"setHudText", sig:"setHudText(hudId, text)", desc:"Updates a HUD item text.", example:"setHudText(id, Score:100)" },
  { name:"removeHud", sig:"removeHud(hudId)", desc:"Removes a HUD item.", example:"removeHud(id)" },

  // Players
  { name:"getAllPlayers", sig:"getAllPlayers()", desc:"Returns an array of player objects.", example:"players = getAllPlayers();" },
  { name:"getPlayerByName", sig:"getPlayerByName(name)", desc:"Returns the first player matching name or null.", example:"p = getPlayerByName Player0" },

  // Cash
  { name:"getCash", sig:"getCash(player)", desc:"Returns player cash.", example:"c = getCash(player)" },
  { name:"cashAdd", sig:"cashAdd(player, amount)", desc:"Adds cash.", example:"cashAdd(player, 50)" },

  // Triggers
  { name:"createTrigger", sig:"createTrigger(origin, radius, prompt)", desc:"Creates an interaction trigger.", example:"tid = createTrigger(player, 3, ^2Press F)" },
  { name:"onTriggerUse", sig:"onTriggerUse(id, handlerName)", desc:"Bind a handler for trigger use.", example:"onTriggerUse(tid, buyWall)" },
  { name:"setTriggerCooldown", sig:"setTriggerCooldown(id, ms)", desc:"Cooldown between uses.", example:"setTriggerCooldown(tid, 500)" },
  { name:"setTriggerHoldTime", sig:"setTriggerHoldTime(id, ms)", desc:"Require holding F/E for ms.", example:"setTriggerHoldTime(tid, 600)" },

  // Entities
  { name:"spawnEntity", sig:"spawnEntity(type, origin, opts)", desc:"Spawns a script entity (box/sphere/cylinder/model).", example:"e = spawnEntity(box, player, {tag:wallbuy})" },
  { name:"spawnModel", sig:"spawnModel(path, origin, opts)", desc:"Convenience model spawner.", example:"e = spawnModel(/assets/wall.glb, {x:0,y:1,z:0}, {tag:wallbuy})" },
  { name:"attachEntity", sig:"attachEntity(child, parent, offset)", desc:"Attach an entity to another.", example:"attachEntity(child, parent, {x:0,y:1,z:0})" },
  { name:"raycast", sig:"raycast(origin, dir, maxDist)", desc:"Raycast against script entities.", example:"hit = raycast(player, {x:0,y:0,z:-1}, 20)" },

  // Timers & Vars
  { name:"setTimeout", sig:"setTimeout(handlerName, ms)", desc:"Run a handler after delay.", example:"setTimeout(hostHud, 1000)" },
  { name:"setInterval", sig:"setInterval(handlerName, ms)", desc:"Run a handler repeatedly.", example:"setInterval(hostHud, 250)" },
  { name:"setVar", sig:"setVar(key, val)", desc:"Set a global script variable.", example:"setVar(powerOn, 1)" },
  { name:"getVar", sig:"getVar(key)", desc:"Get a global script variable.", example:"v = getVar(powerOn)" },

  // Audio
  { name:"playSound", sig:"playSound(player, soundId)", desc:"Play a sound (client-side).", example:"playSound(player, buy)" },
  { name:"playSoundAll", sig:"playSoundAll(soundId)", desc:"Play a sound for everyone (client-side).", example:"playSoundAll(round_start)" },
  { name:"wait", sig:"wait(ms)", desc:"Pause the current handler without freezing the game (cooperative).", example:"wait 500" },
  { name:"thread", sig:"thread handlerName", desc:"Start a handler in the background (cooperative thread).", example:"thread hostHud" },
  { name:"startThread", sig:"startThread(handlerName, payload)", desc:"Start a background handler. Returns threadId.", example:"tid = startThread(\"hostHud\")" },
  { name:"stopThread", sig:"stopThread(threadId)", desc:"Stop a background thread (best-effort).", example:"stopThread(tid)" },
  { name:"getAllThreads", sig:"getAllThreads()", desc:"List active script threads.", example:"threads = getAllThreads()" },
]);

function _clampText(s, max=300){
  const t = String(s ?? "");
  return t.length <= max ? t : t.slice(0, max);
}

function _safeNum(n, def=0, min=-1e9, max=1e9){
  const v = Number(n);
  if(Number.isNaN(v)) return def;
  return Math.max(min, Math.min(max, v));
}

function _resolvePos(obj){
  if(!obj) return null;
  if(typeof obj === "object"){
    // player-like
    if(obj.position?.x != null) return obj.position;
    if(obj.pos?.x != null) return obj.pos;
    if(obj.camera?.position?.x != null) return obj.camera.position;
    if(obj.cam?.position?.x != null) return obj.cam.position;
    if(obj.object3d?.position?.x != null) return obj.object3d.position;
    if(obj.raw?.pos?.x != null) return obj.raw.pos;
    if(obj.x != null && obj.y != null && obj.z != null) return obj;
  }
  return null;
}

function _normalizePlayer(p, ctx){
  if(!p) return "p0";
  if(typeof p === "string") return p;
  if(typeof p === "object"){
    return String(p.id ?? p.name ?? "p0");
  }
  return String(p);
}

// Notifications helpers (DZS-visible)
export function iPrintLn(player, text, ctx){
  ctx.notifications?.notify?.(player, String(text));
}
export function iPrintLnBold(player, text, ctx){
  ctx.notifications?.notify?.(player, String(text), { bold:true });
}
export function iPrintLnAll(text, ctx){
  ctx.notifications?.notifyAll?.(String(text));
}
export function iPrintLnBoldAll(text, ctx){
  ctx.notifications?.notifyAll?.(String(text), { bold:true });
}

export function makeBuiltins(ctx){
  const dzs = ctx.scripts?.dzs;
  const triggers = ctx.triggers;
  const entities = ctx.entities;

  return {
    // Logging
    log: (...args)=> ctx.events.emit("log", { msg: "[dzs] " + args.map(a=>String(a)).join(" ") }),

    // Players
    getAllPlayers: ()=> (ctx.players || []),
    getPlayerByName: (name)=>{
      const n = String(name ?? "");
      return (ctx.players || []).find(p=>String(p.name) === n) || null;
    },

    // Cash
    getCash: (player)=> ctx.cash?.get?.(_normalizePlayer(player, ctx)) ?? 0,
    setCash: (player, amount)=> ctx.cash?.set?.(_normalizePlayer(player, ctx), amount),
    cashAdd: (player, amount)=> ctx.cash?.add?.(_normalizePlayer(player, ctx), amount),
    cashSub: (player, amount)=> ctx.cash?.sub?.(_normalizePlayer(player, ctx), amount),

    // Notifications
    iPrintLn: (player, text)=> ctx.notifications?.notify?.(player, String(text)),
    iPrintLnBold: (player, text)=> ctx.notifications?.notify?.(player, String(text), { bold:true }),
    iPrintLnAll: (text)=> ctx.notifications?.notifyAll?.(String(text)),
    iPrintLnBoldAll: (text)=> ctx.notifications?.notifyAll?.(String(text), { bold:true }),

    // HUD
    createHudItem: (player, color="#ffffff", width=220, height=40, x=20, y=20, text="", shader="")=>{
      return ctx.hud?.createItem?.({
        player: _normalizePlayer(player, ctx),
        color: String(color),
        width: _safeNum(width, 220, 0, 5000),
        height: _safeNum(height, 40, 0, 5000),
        x: _safeNum(x, 20, -5000, 5000),
        y: _safeNum(y, 20, -5000, 5000),
        text: _clampText(text, 500),
        shader: _clampText(shader, 120),
      }) ?? null;
    },
    createHudText: (player, color="#ffffff", x=20, y=20, text="", shader="")=>{
      return ctx.hud?.createText?.({
        player: _normalizePlayer(player, ctx),
        color: String(color),
        x: _safeNum(x, 20, -5000, 5000),
        y: _safeNum(y, 20, -5000, 5000),
        text: _clampText(text, 500),
        shader: _clampText(shader, 120),
      }) ?? null;
    },
    setHudText: (hudId, text)=> ctx.hud?.setText?.(hudId, _clampText(text, 700)),
    setHudColor: (hudId, color)=> ctx.hud?.setColor?.(hudId, String(color)),
    setHudPos: (hudId, x, y)=> ctx.hud?.setPos?.(hudId, _safeNum(x,0,-5000,5000), _safeNum(y,0,-5000,5000)),
    setHudSize: (hudId, w, h)=> ctx.hud?.setSize?.(hudId, _safeNum(w,0,0,5000), _safeNum(h,0,0,5000)),
    setHudVisible: (hudId, visible)=> ctx.hud?.setVisible?.(hudId, !!visible),
    setHudZ: (hudId, z)=> ctx.hud?.setZ?.(hudId, _safeNum(z,0,-9999,9999)),
    setHudBackground: (hudId, css)=> ctx.hud?.setBackground?.(hudId, _clampText(css, 200)),
    setHudShader: (hudId, shader)=> ctx.hud?.setShader?.(hudId, _clampText(shader, 120)),
    removeHud: (hudId)=> ctx.hud?.remove?.(hudId),

    // Timers
    setTimeout: (handlerName, ms)=>{
      if(!dzs) return null;
      const id = String((dzs._timerSeq ?? 1));
      dzs._timerSeq += 1;
      dzs._timers.set(id, { type:"timeout", ms:Number(ms||0), nextAt:(dzs._nowMs||0)+Number(ms||0), handlerName:String(handlerName||""), cancelled:false });
      return id;
    },
    setInterval: (handlerName, ms)=>{
      if(!dzs) return null;
      const id = String((dzs._timerSeq ?? 1));
      dzs._timerSeq += 1;
      dzs._timers.set(id, { type:"interval", ms:Number(ms||0), nextAt:(dzs._nowMs||0)+Number(ms||0), handlerName:String(handlerName||""), cancelled:false });
      return id;
    },
    clearTimer: (id)=>{
      if(!dzs) return false;
      const t = dzs._timers.get(String(id));
      if(!t) return false;
      t.cancelled = true;
      dzs._timers.set(String(id), t);
      return true;
    },

    // Vars
    setVar: (key, val)=>{ if(dzs) dzs._globals.set(String(key), val); },
    getVar: (key)=> dzs ? (dzs._globals.get(String(key)) ?? null) : null,
    setPlayerVar: (player, key, val)=>{
      if(!dzs) return;
      const pid = dzs._pid(player);
      if(!dzs._playerVars.has(pid)) dzs._playerVars.set(pid, new Map());
      dzs._playerVars.get(pid).set(String(key), val);
    },
    getPlayerVar: (player, key)=>{
      if(!dzs) return null;
      const pid = dzs._pid(player);
      return dzs._playerVars.get(pid)?.get(String(key)) ?? null;
    },
    setEntityVar: (ent, key, val)=>{
      if(!dzs) return;
      const eid = dzs._eid(ent);
      if(!dzs._entityVars.has(eid)) dzs._entityVars.set(eid, new Map());
      dzs._entityVars.get(eid).set(String(key), val);
    },
    getEntityVar: (ent, key)=>{
      if(!dzs) return null;
      const eid = dzs._eid(ent);
      return dzs._entityVars.get(eid)?.get(String(key)) ?? null;
    },

    // Triggers
    createTrigger: (origin, radius=2, prompt="")=>{
      const o = _resolvePos(origin) || origin;
      return triggers?.create?.(o, _safeNum(radius, 2, 0.25, 50), { prompt: _clampText(prompt, 220) }) ?? null;
    },
    destroyTrigger: (id)=> triggers?.destroy?.(id),
    setTriggerPrompt: (id, text)=> triggers?.setPrompt?.(id, _clampText(text, 220)),
    onTriggerUse: (id, handlerName)=> triggers?.setHandler?.(id, "use", handlerName),
    onTriggerEnter: (id, handlerName)=> triggers?.setHandler?.(id, "enter", handlerName),
    onTriggerExit: (id, handlerName)=> triggers?.setHandler?.(id, "exit", handlerName),
    setTriggerRadius: (id, r)=> triggers?.setRadius?.(id, _safeNum(r, 2, 0.25, 50)),
    setTriggerEnabled: (id, enabled)=> triggers?.setEnabled?.(id, !!enabled),
    setTriggerCooldown: (id, ms)=> triggers?.setCooldown?.(id, _safeNum(ms, 0, 0, 600000)),
    setTriggerHoldTime: (id, ms)=> triggers?.setHoldTime?.(id, _safeNum(ms, 0, 0, 20000)),
    getTriggerHoldProgress: (id)=> triggers?.getHoldProgress?.(id) || 0,
    getAllTriggers: ()=> triggers?.getAll?.() || [],

    // Entities
    spawnEntity: async (type, origin, opts={})=>{
      const o = _resolvePos(origin) || origin;
      return await entities?.spawnEntity?.(type, o, opts) ?? null;
    },
    spawnModel: async (path, origin, opts={})=>{
      const o = _resolvePos(origin) || origin;
      return await entities?.spawnEntity?.("model", o, { ...(opts||{}), model: String(path ?? "") }) ?? null;
    },
    deleteEntity: (ent)=> entities?.deleteEntity?.(ent),
    getAllEntities: ()=> entities?.getAll?.() || [],
    getEntityById: (id)=> entities?.getById?.(id) || null,
    getEntitiesByTag: (tag)=> entities?.getByTag?.(tag) || [],
    getEntitiesInRadius: (origin, r)=> {
      const o = _resolvePos(origin) || origin;
      return entities?.inRadius?.(o, _safeNum(r,0,0,5000)) || [];
    },
    getEntityPos: (ent)=> entities?.getPos?.(ent),
    setEntityPos: (ent, pos)=> entities?.setPos?.(ent, pos),
    getEntityAngles: (ent)=> entities?.getAngles?.(ent),
    setEntityAngles: (ent, ang)=> entities?.setAngles?.(ent, ang),
    setEntityHealth: (ent, hp)=> entities?.setHealth?.(ent, hp),
    damageEntity: (ent, amt, source)=> entities?.damage?.(ent, amt, source||null),
    setEntityTag: (ent, tag)=> entities?.setTag?.(ent, tag),
    setEntityVisible: (ent, visible)=> entities?.setVisible?.(ent, !!visible),
    setEntityScale: (ent, s)=> entities?.setScale?.(ent, _safeNum(s,1,0.01,500)),
    attachEntity: (child, parent, offset)=> entities?.attach?.(child, parent, offset||{x:0,y:0,z:0}),
    raycast: (origin, dir, maxDist=50)=>{
      const o = _resolvePos(origin) || origin;
      const d = dir || {x:0,y:0,z:-1};
      return entities?.raycast?.(o, d, _safeNum(maxDist,50,0,5000)) || null;
    },

    // Audio
    playSound: (player, soundId)=> ctx.audio?.play?.(String(soundId)),
    playSoundAll: (soundId)=> ctx.audio?.play?.(String(soundId)),

    // World helpers (bridge to WorldBuilder/ZmWorld)
    worldClear: ()=> ctx.world?.clearWorld?.() ?? ctx.world?.clear?.(),
    addFloor: (size=50)=> ctx.world?.addFloor?.({ size }),
    addWalls: (size=50, height=3)=> ctx.world?.addBoundaryWalls?.({ size, height }),
    addCrate: (x=0, y=0.5, z=0)=> ctx.world?.addCrate?.({ x, y, z }),
    setPlayerSpawn: (x=0, z=0)=> ctx.game?.players?.setSpawn?.(Number(x||0), Number(z||0)),
    addZombieSpawn: (x=0, z=0)=> ctx.game?.zombies?.addSpawn?.(Number(x||0), Number(z||0)),
    setWaveTarget: (n)=> ctx.game?.waves?.setTarget?.(Number(n||0)),
    setSpawnEveryMs: (ms)=> ctx.game?.waves?.setSpawnEveryMs?.(Number(ms||0)),
  };
}
