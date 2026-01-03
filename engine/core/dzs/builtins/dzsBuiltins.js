import { clamp } from "../../utilities/Math.js";

// Used by the Dev Menu to display syntax + usage + examples.
export const BUILTIN_DOCS = Object.freeze([
  { name:"log", sig:"log(...words)", desc:"Prints a line to the in-game log.", example:"log Hello from DZS" },

  // Context
  { name:"self", sig:"self.<var>", desc:"Entity-scoped vars for the current thread.", example:"self.score = 10" },
  { name:"level", sig:"level.<var>", desc:"Match-scoped vars shared across scripts.", example:"level.wave = 1" },

  // Signals
  { name:"notify", sig:"notify(signal, ...args)", desc:"Send a signal (defaults to self if available, else level).", example:"notify \"round_start\" 1" },
  { name:"waittill", sig:"waittill(signal)", desc:"Wait for a signal and resume (returns args array).", example:"waittill \"death\"" },
  { name:"endon", sig:"endon(signal)", desc:"End this thread when the signal fires.", example:"endon \"disconnect\"" },

  // Notifications
  { name:"iPrintLn", sig:"iPrintLn(player, text)", desc:"Small notification (bottom-right).", example:"iPrintLn(player, ^2Purchased!)" },
  { name:"iPrintLnBold", sig:"iPrintLnBold(player, text)", desc:"Bold notification (center).", example:"iPrintLnBold(player, ^1WARNING!)" },
  { name:"iPrintLnAll", sig:"iPrintLnAll(text)", desc:"Notify all players.", example:"iPrintLnAll(^3Round start)" },
  { name:"iPrintLnBoldAll", sig:"iPrintLnBoldAll(text)", desc:"Bold notify all players.", example:"iPrintLnBoldAll(^1WARNING!)" },

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
  { name:"deleteEntity", sig:"deleteEntity(entity)", desc:"Delete a script entity.", example:"deleteEntity(ent)" },
  { name:"getAllEntities", sig:"getAllEntities()", desc:"Returns all script entities.", example:"ents = getAllEntities()" },
  { name:"getEntityById", sig:"getEntityById(id)", desc:"Returns an entity by id.", example:"ent = getEntityById(1)" },
  { name:"getEntitiesByTag", sig:"getEntitiesByTag(tag)", desc:"Returns entities with the given tag.", example:"ents = getEntitiesByTag(wallbuy)" },
  { name:"getEntitiesInRadius", sig:"getEntitiesInRadius(origin, radius)", desc:"Returns entities near an origin.", example:"ents = getEntitiesInRadius(player, 6)" },
  { name:"getEntityPos", sig:"getEntityPos(entity)", desc:"Returns entity position.", example:"pos = getEntityPos(ent)" },
  { name:"setEntityPos", sig:"setEntityPos(entity, pos)", desc:"Sets entity position.", example:"setEntityPos(ent, {x:0,y:1,z:0})" },
  { name:"getEntityAngles", sig:"getEntityAngles(entity)", desc:"Returns entity rotation.", example:"ang = getEntityAngles(ent)" },
  { name:"setEntityAngles", sig:"setEntityAngles(entity, angles)", desc:"Sets entity rotation.", example:"setEntityAngles(ent, {x:0,y:1,z:0})" },
  { name:"setEntityHealth", sig:"setEntityHealth(entity, hp)", desc:"Sets entity health.", example:"setEntityHealth(ent, 200)" },
  { name:"damageEntity", sig:"damageEntity(entity, amount, source)", desc:"Damages an entity and fires onEntityDamaged/onEntityDeath.", example:"damageEntity(ent, 25, player)" },
  { name:"setEntityTag", sig:"setEntityTag(entity, tag)", desc:"Sets entity tag.", example:"setEntityTag(ent, wallbuy)" },
  { name:"setEntityVisible", sig:"setEntityVisible(entity, visible)", desc:"Show/hide an entity.", example:"setEntityVisible(ent, false)" },
  { name:"setEntityScale", sig:"setEntityScale(entity, scale)", desc:"Sets uniform entity scale.", example:"setEntityScale(ent, 1.5)" },

  // Timers & Threads
  { name:"setTimeout", sig:"setTimeout(handlerName, ms)", desc:"Run a handler after delay.", example:"setTimeout(hostHud, 1000)" },
  { name:"setInterval", sig:"setInterval(handlerName, ms)", desc:"Run a handler repeatedly.", example:"setInterval(hostHud, 250)" },
  { name:"clearTimer", sig:"clearTimer(timerId)", desc:"Cancel a timer or interval.", example:"clearTimer(tid)" },
  { name:"wait", sig:"wait(seconds)", desc:"Pause the current handler without freezing the game (cooperative).", example:"wait 0.5" },
  { name:"thread", sig:"thread handlerName(...args)", desc:"Start a handler in the background (cooperative thread).", example:"thread hudLoop()" },
  { name:"self thread", sig:"self thread handlerName(...args)", desc:"Start a background handler on self.", example:"self thread perksLoop()" },
  { name:"level thread", sig:"level thread handlerName(...args)", desc:"Start a background handler on level.", example:"level thread modeController()" },
  { name:"startThread", sig:"startThread(handlerName, payload)", desc:"Start a background handler. Returns threadId.", example:"tid = startThread(\"hostHud\")" },
  { name:"stopThread", sig:"stopThread(threadId)", desc:"Stop a background thread (best-effort).", example:"stopThread(tid)" },
  { name:"getAllThreads", sig:"getAllThreads()", desc:"List active script threads.", example:"threads = getAllThreads()" },
  { name:"threadEnd", sig:"threadEnd()", desc:"End the current thread immediately.", example:"threadEnd()" },

  // Vars
  { name:"setVar", sig:"setVar(key, val)", desc:"Set a global script variable.", example:"setVar(powerOn, 1)" },
  { name:"getVar", sig:"getVar(key)", desc:"Get a global script variable.", example:"v = getVar(powerOn)" },
  { name:"getScreenSize", sig:"getScreenSize()", desc:"Returns {w,h} for the current viewport.", example:"s = getScreenSize()" },
  { name:"getLocalPlayerId", sig:"getLocalPlayerId()", desc:"Returns the local player id.", example:"pid = getLocalPlayerId()" },
  { name:"isHost", sig:"isHost()", desc:"Returns true if this client is the host/server.", example:"if(isHost()){ ... }" },
  { name:"getMatchState", sig:"getMatchState(key)", desc:"Returns match state (or key) synced from server.", example:"s = getMatchState(tdm)" },
  { name:"setMatchState", sig:"setMatchState(key, val)", desc:"Host-only: merge state to server and clients.", example:"setMatchState(tdm, {scoreA:1})" },
  { name:"sendMatchEvent", sig:"sendMatchEvent(name, payload)", desc:"Host-only: broadcast a match event to all clients.", example:"sendMatchEvent(mp:killcam, {killerId:p0})" },
  { name:"endMatch", sig:"endMatch(reason)", desc:"Host-only: end the current match.", example:"endMatch(score_limit)" },
  { name:"requestRespawn", sig:"requestRespawn(delayMs, spawnProtectionMs)", desc:"Request a local respawn after delay.", example:"requestRespawn(2500, 1500)" },

  // Audio
  { name:"playSound", sig:"playSound(player, soundId)", desc:"Play a sound (client-side).", example:"playSound(player, buy)" },
  { name:"playSoundAll", sig:"playSoundAll(soundId)", desc:"Play a sound for everyone (client-side).", example:"playSoundAll(round_start)" },
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

function _serverOnly(dzs, ctx, name, fn){
  if(!dzs || dzs.isServer?.()) return fn();
  dzs?._logServerOnly?.(name);
  return null;
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
    getAllPlayers: ()=>{
      const players = Array.isArray(ctx.players) ? ctx.players : [];
      if(players.length) return players;
      return ctx.player ? [ctx.player] : [];
    },
    getPlayerByName: (name)=>{
      const n = String(name ?? "");
      const players = Array.isArray(ctx.players) ? ctx.players : [];
      const hit = players.find(p=>String(p.name) === n) || null;
      if(hit) return hit;
      if(ctx.player && String(ctx.player.name) === n) return ctx.player;
      return null;
    },

    // Cash
    getCash: (player)=> ctx.cash?.get?.(_normalizePlayer(player, ctx)) ?? 0,
    setCash: (player, amount)=> _serverOnly(dzs, ctx, "setCash", ()=> ctx.cash?.set?.(_normalizePlayer(player, ctx), amount)),
    cashAdd: (player, amount)=> _serverOnly(dzs, ctx, "cashAdd", ()=> ctx.cash?.add?.(_normalizePlayer(player, ctx), amount)),
    cashSub: (player, amount)=> _serverOnly(dzs, ctx, "cashSub", ()=> ctx.cash?.sub?.(_normalizePlayer(player, ctx), amount)),

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
      dzs._getEntityVars?.(null, eid)?.set(String(key), val);
    },
    getEntityVar: (ent, key)=>{
      if(!dzs) return null;
      const eid = dzs._eid(ent);
      return dzs._getEntityVars?.(null, eid)?.get(String(key)) ?? null;
    },
    getScreenSize: ()=>({
      w: Number(globalThis?.innerWidth || 0),
      h: Number(globalThis?.innerHeight || 0),
    }),
    getLocalPlayerId: ()=> String(ctx.net?.clientId ?? "p0"),
    isHost: ()=> dzs?.isServer?.() ?? true,
    getMatchState: (key)=>{
      const state = ctx.matchState || {};
      if(key == null) return state;
      return state[String(key)] ?? null;
    },
    setMatchState: (key, val)=> _serverOnly(dzs, ctx, "setMatchState", ()=>{
      let patch = null;
      if(key && typeof key === "object" && val === undefined){
        patch = key;
      } else if(key != null){
        patch = { [String(key)]: val };
      }
      if(!patch) return null;
      ctx.matchState = { ...(ctx.matchState || {}), ...patch };
      ctx.net?.sendMatchState?.(patch);
      ctx.events?.emit?.("mp:matchState", { state: ctx.matchState, patch });
      return true;
    }),
    sendMatchEvent: (name, payload)=> _serverOnly(dzs, ctx, "sendMatchEvent", ()=>{
      ctx.net?.sendMatchEvent?.(String(name || ""), payload ?? null);
      return true;
    }),
    endMatch: (reason)=> _serverOnly(dzs, ctx, "endMatch", ()=>{
      ctx.net?.sendEndMatch?.(reason);
      return true;
    }),
    requestRespawn: (delayMs=0, spawnProtectionMs=0)=>{
      const players = ctx.game?.players;
      if(!players?.requestRespawn) return false;
      return players.requestRespawn(delayMs, spawnProtectionMs);
    },

    // Triggers
    createTrigger: (origin, radius=2, prompt="")=>{
      const o = _resolvePos(origin) || origin;
      return _serverOnly(dzs, ctx, "createTrigger", ()=> triggers?.create?.(o, _safeNum(radius, 2, 0.25, 50), { prompt: _clampText(prompt, 220) }) ?? null);
    },
    destroyTrigger: (id)=> _serverOnly(dzs, ctx, "destroyTrigger", ()=> triggers?.destroy?.(id)),
    setTriggerPrompt: (id, text)=> _serverOnly(dzs, ctx, "setTriggerPrompt", ()=> triggers?.setPrompt?.(id, _clampText(text, 220))),
    onTriggerUse: (id, handlerName)=> _serverOnly(dzs, ctx, "onTriggerUse", ()=> triggers?.setHandler?.(id, "use", handlerName)),
    onTriggerEnter: (id, handlerName)=> _serverOnly(dzs, ctx, "onTriggerEnter", ()=> triggers?.setHandler?.(id, "enter", handlerName)),
    onTriggerExit: (id, handlerName)=> _serverOnly(dzs, ctx, "onTriggerExit", ()=> triggers?.setHandler?.(id, "exit", handlerName)),
    setTriggerRadius: (id, r)=> _serverOnly(dzs, ctx, "setTriggerRadius", ()=> triggers?.setRadius?.(id, _safeNum(r, 2, 0.25, 50))),
    setTriggerEnabled: (id, enabled)=> _serverOnly(dzs, ctx, "setTriggerEnabled", ()=> triggers?.setEnabled?.(id, !!enabled)),
    setTriggerCooldown: (id, ms)=> _serverOnly(dzs, ctx, "setTriggerCooldown", ()=> triggers?.setCooldown?.(id, _safeNum(ms, 0, 0, 600000))),
    setTriggerHoldTime: (id, ms)=> _serverOnly(dzs, ctx, "setTriggerHoldTime", ()=> triggers?.setHoldTime?.(id, _safeNum(ms, 0, 0, 20000))),
    getTriggerHoldProgress: (id)=> triggers?.getHoldProgress?.(id) || 0,
    getAllTriggers: ()=> triggers?.getAll?.() || [],

    // Entities
    spawnEntity: async (type, origin, opts={})=>{
      const o = _resolvePos(origin) || origin;
      return await _serverOnly(dzs, ctx, "spawnEntity", ()=> entities?.spawnEntity?.(type, o, opts) ?? null);
    },
    spawnModel: async (path, origin, opts={})=>{
      const o = _resolvePos(origin) || origin;
      return await _serverOnly(dzs, ctx, "spawnModel", ()=> entities?.spawnEntity?.("model", o, { ...(opts||{}), model: String(path ?? "") }) ?? null);
    },
    deleteEntity: (ent)=> _serverOnly(dzs, ctx, "deleteEntity", ()=> entities?.deleteEntity?.(ent)),
    getAllEntities: ()=> entities?.getAll?.() || [],
    getEntityById: (id)=> entities?.getById?.(id) || null,
    getEntitiesByTag: (tag)=> entities?.getByTag?.(tag) || [],
    getEntitiesInRadius: (origin, r)=> {
      const o = _resolvePos(origin) || origin;
      return entities?.inRadius?.(o, _safeNum(r,0,0,5000)) || [];
    },
    getEntityPos: (ent)=> entities?.getPos?.(ent),
    setEntityPos: (ent, pos)=> _serverOnly(dzs, ctx, "setEntityPos", ()=> entities?.setPos?.(ent, pos)),
    getEntityAngles: (ent)=> entities?.getAngles?.(ent),
    setEntityAngles: (ent, ang)=> _serverOnly(dzs, ctx, "setEntityAngles", ()=> entities?.setAngles?.(ent, ang)),
    setEntityHealth: (ent, hp)=> _serverOnly(dzs, ctx, "setEntityHealth", ()=> entities?.setHealth?.(ent, hp)),
    damageEntity: (ent, amt, source)=> _serverOnly(dzs, ctx, "damageEntity", ()=> entities?.damage?.(ent, amt, source||null)),
    setEntityTag: (ent, tag)=> _serverOnly(dzs, ctx, "setEntityTag", ()=> entities?.setTag?.(ent, tag)),
    setEntityVisible: (ent, visible)=> _serverOnly(dzs, ctx, "setEntityVisible", ()=> entities?.setVisible?.(ent, !!visible)),
    setEntityScale: (ent, s)=> _serverOnly(dzs, ctx, "setEntityScale", ()=> entities?.setScale?.(ent, _safeNum(s,1,0.01,500))),
    attachEntity: (child, parent, offset)=> _serverOnly(dzs, ctx, "attachEntity", ()=> entities?.attach?.(child, parent, offset||{x:0,y:0,z:0})),
    raycast: (origin, dir, maxDist=50)=>{
      const o = _resolvePos(origin) || origin;
      const d = dir || {x:0,y:0,z:-1};
      return entities?.raycast?.(o, d, _safeNum(maxDist,50,0,5000)) || null;
    },

    // Audio
    playSound: (player, soundId)=> ctx.audio?.play?.(String(soundId)),
    playSoundAll: (soundId)=> ctx.audio?.play?.(String(soundId)),

    // World helpers (bridge to WorldBuilder/ZmWorld)
    worldClear: ()=> _serverOnly(dzs, ctx, "worldClear", ()=> ctx.world?.clearWorld?.() ?? ctx.world?.clear?.()),
    addFloor: (size=50)=> _serverOnly(dzs, ctx, "addFloor", ()=> ctx.world?.addFloor?.({ size })),
    addWalls: (size=50, height=3)=> _serverOnly(dzs, ctx, "addWalls", ()=> ctx.world?.addBoundaryWalls?.({ size, height })),
    addCrate: (x=0, y=0.5, z=0)=> _serverOnly(dzs, ctx, "addCrate", ()=> ctx.world?.addCrate?.({ x, y, z })),
    setPlayerSpawn: (x=0, z=0)=> _serverOnly(dzs, ctx, "setPlayerSpawn", ()=> ctx.game?.players?.setSpawn?.(Number(x||0), Number(z||0))),
    addZombieSpawn: (x=0, z=0)=> _serverOnly(dzs, ctx, "addZombieSpawn", ()=> ctx.game?.zombies?.addSpawn?.(Number(x||0), Number(z||0))),
    setWaveTarget: (n)=> _serverOnly(dzs, ctx, "setWaveTarget", ()=> ctx.game?.waves?.setTarget?.(Number(n||0))),
    setSpawnEveryMs: (ms)=> _serverOnly(dzs, ctx, "setSpawnEveryMs", ()=> ctx.game?.waves?.setSpawnEveryMs?.(Number(ms||0))),
  };
}
