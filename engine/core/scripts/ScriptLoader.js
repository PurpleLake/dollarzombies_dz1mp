import { DzsRuntime } from "../dzs/runtime/DzsRuntime.js";

export class ScriptLoader {
  constructor({ engine }){
    this.engine = engine;
    this.files = [];
    this.baseUrl = "";
    this.dzs = new DzsRuntime({ events: engine.events, ctx: engine.ctx });
    // expose to engine context for dev UI
    engine.ctx.scripts = this;
    this.jsModules = [];
    this._unsubs = [];

    // Route engine events to DZS handlers
    const route = (evt, handlers=[])=>{
      const off = this.engine.events.on(evt, (payload)=>{
        const owner = this.dzs.resolveOwner(payload);
        const matchId = this.engine?.ctx?.matchSession?.matchId ?? null;
        this.dzs.run(evt, payload, { owner, matchId });
        for(const h of handlers) this.dzs.run(h, payload, { owner, matchId });
      });
      this._unsubs.push(off);
    };

    const zmRoutes = [
      ["zm:preload", ["onGamePreload"]],
      ["zm:build", ["onGameBuild"]],
      ["zm:start", ["onGameStart"]],
      ["zm:tick", ["onTick"]],
      ["zm:waveStart", ["onRoundStart"]],
      ["zm:waveEnd", ["onRoundEnd"]],
      ["zm:zombieSpawn", ["onEntitySpawn", "onZombieSpawn"]],
      ["zm:zombieDeath", ["onEntityDeath", "onZombieDeath"]],
      ["zm:playerSpawn", ["onPlayerSpawn", "onPlayerSpawned"]],
      ["zm:playerDeath", ["onPlayerDeath"]],
      ["zm:playerDamaged", ["onPlayerDamaged"]],
      ["zm:weaponFired", ["onWeaponFired"]],
      ["zm:zombieDamaged", ["onEntityDamaged", "onZombieDamaged"]],
      ["zm:purchase", ["onPurchase"]],
    ];
    const mpRoutes = [
      ["mp:preload", ["onGamePreload"]],
      ["mp:build", ["onGameBuild"]],
      ["mp:start", ["onGameStart"]],
      ["mp:tick", ["onTick"]],
      ["mp:playerSpawn", ["onPlayerSpawn", "onPlayerSpawned"]],
      ["mp:playerDamaged", ["onPlayerDamaged"]],
      ["mp:playerDeath", ["onPlayerDeath"]],
      ["mp:weaponFired", ["onWeaponFired"]],
      ["net:welcome", ["onPlayerConnect"]],
      ["mp:gameEnd", ["onGameEnd"]],
    ];

    for (const [evt, handlers] of zmRoutes) route(evt, handlers);
    for (const [evt, handlers] of mpRoutes) route(evt, handlers);

    // TriggerSystem and other systems can call explicit DZS handlers.
    const offDzsCall = this.engine.events.on("dzs:call", ({ handler, payload })=>{
      if(!handler) return;
      const owner = this.dzs.resolveOwner(payload);
      const matchId = this.engine?.ctx?.matchSession?.matchId ?? null;
      this.dzs.run(String(handler), payload, { owner, matchId });
    });
    this._unsubs.push(offDzsCall);

    // Script tick (timers)
    const offTick = this.engine.events.on("engine:tick", ({ dt, t })=>{
      this.dzs.tick(dt, (t ?? 0) * 1000);
    });
    this._unsubs.push(offTick);

    // GSC-style notify bridge
    const notifyLevel = (signal, ...args)=> this.dzs.notifyLevel(signal, ...args);
    const notifyEntity = (entityId, signal, ...args)=> this.dzs.notifyEntity(entityId, signal, ...args);

    const offWaveStart = this.engine.events.on("zm:waveStart", (payload)=>{
      notifyLevel("round_start", payload?.wave ?? null, payload);
    });
    const offWaveEnd = this.engine.events.on("zm:waveEnd", (payload)=>{
      notifyLevel("round_end", payload?.wave ?? null, payload);
    });
    const offZmStart = this.engine.events.on("zm:start", (payload)=>{
      notifyLevel("game_start", payload);
    });
    const offMpStart = this.engine.events.on("mp:start", (payload)=>{
      notifyLevel("game_start", payload);
    });
    const offZmEnd = this.engine.events.on("zm:gameEnd", (payload)=>{
      notifyLevel("game_end", payload);
      const matchId = this.engine?.ctx?.matchSession?.matchId ?? null;
      setTimeout(()=> this.dzs.resetBetweenGames(matchId), 0);
    });
    const offMpEnd = this.engine.events.on("mp:gameEnd", (payload)=>{
      notifyLevel("game_end", payload);
      const matchId = this.engine?.ctx?.matchSession?.matchId ?? null;
      setTimeout(()=> this.dzs.resetBetweenGames(matchId), 0);
    });
    const offMatchEnd = this.engine.events.on("match:ended", ({ matchId })=>{
      this.dzs.resetBetweenGames(matchId);
    });
    const offZmDeath = this.engine.events.on("zm:playerDeath", (payload)=>{
      const pid = this.dzs._pid(payload?.player);
      notifyEntity(pid, "death", payload);
    });
    const offMpDeath = this.engine.events.on("mp:playerDeath", (payload)=>{
      const pid = payload?.playerId != null ? String(payload.playerId) : this.dzs._pid(payload?.player);
      notifyEntity(pid, "death", payload);
    });
    const offDisconnect = this.engine.events.on("net:playerDisconnect", ({ playerId })=>{
      const pid = String(playerId ?? "");
      if(!pid) return;
      notifyEntity(pid, "disconnect", { playerId: pid });
      const matchId = this.engine?.ctx?.matchSession?.matchId ?? null;
      this.dzs.cancelOwnerThreads(matchId, "entity", pid, "disconnect");
      this.dzs.clearEntityVars(matchId, pid);
    });

    this._unsubs.push(
      offWaveStart,
      offWaveEnd,
      offZmStart,
      offMpStart,
      offZmEnd,
      offMpEnd,
      offMatchEnd,
      offZmDeath,
      offMpDeath,
      offDisconnect,
    );

  }

  async loadManifest(url){
    this.engine.events.emit("log", { msg: `[scripts] fetch manifest: ${url}` });
    const res = await fetch(url, { cache:"no-store" });
    if(!res.ok) throw new Error(`Manifest load failed: ${res.status} ${url}`);
    const json = await res.json();
    this.files = Array.isArray(json.files) ? json.files.slice() : [];
    try {
      const resolved = new URL(url, window.location.href);
      this.baseUrl = resolved.href.replace(/[^/]*$/, "");
    } catch {
      this.baseUrl = "";
    }
  }

  resolveFileUrl(path){
    if(!path) return path;
    if(/^https?:\/\//i.test(path)) return path;
    if(path.startsWith("/")) return path;
    if(this.baseUrl) return this.baseUrl + path;
    return "/" + path.replace(/^\//, "");
  }

  async loadAll(){
    this.dzs.unloadAll?.();
    this.jsModules.length = 0;

    for(const f of this.files){
      const fileUrl = this.resolveFileUrl(f);
      this.engine.events.emit("log", { msg: `[scripts] loading: ${f}` });
      if(f.endsWith(".dzs")){
        const res = await fetch(fileUrl, { cache:"no-store" });
        if(!res.ok) throw new Error(`DZS load failed: ${res.status} ${f}`);
        const text = await res.text();
        this.dzs.loadText(text, f, f);
        this.engine.events.emit("log", { msg: `[scripts] loaded dzs: ${f}` });
      } else if (f.endsWith(".js")) {
        let mod;
        try{
          mod = await import(fileUrl + `?v=${Date.now()}`);
        } catch (e){
          this.engine.events.emit("log", { msg: `[scripts] JS import failed: ${f}` });
          throw e;
        }
        this.jsModules.push(mod);
        if(typeof mod.register === "function") mod.register(this.engine.ctx);
        this.engine.events.emit("log", { msg: `[scripts] loaded js: ${f}` });
      } else {
        this.engine.events.emit("log", { msg: `[scripts] skipped unknown: ${f}` });
      }
    }
  }

  bindAll(){
    this.dzs.bindAll();
  }
}
