import { DzsRuntime } from "../dzs/runtime/DzsRuntime.js";

export class ScriptLoader {
  constructor({ engine }){
    this.engine = engine;
    this.files = [];
    this.dzs = new DzsRuntime({ events: engine.events, ctx: engine.ctx });
    // expose to engine context for dev UI
    engine.ctx.scripts = this;
    this.jsModules = [];
    this._unsubs = [];

    // Route engine events to DZS handlers
    const route = (evt, handlers=[])=>{
      const off = this.engine.events.on(evt, (payload)=>{
        this.dzs.run(evt, payload);
        for(const h of handlers) this.dzs.run(h, payload);
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

  }

  async loadManifest(url){
    this.engine.events.emit("log", { msg: `[scripts] fetch manifest: ${url}` });
    const res = await fetch(url, { cache:"no-store" });
    if(!res.ok) throw new Error(`Manifest load failed: ${res.status} ${url}`);
    const json = await res.json();
    this.files = Array.isArray(json.files) ? json.files.slice() : [];
  }

  async loadAll(){
    this.dzs.clear();
    this.jsModules.length = 0;

    for(const f of this.files){
      this.engine.events.emit("log", { msg: `[scripts] loading: ${f}` });
      if(f.endsWith(".dzs")){
        const res = await fetch("/" + f.replace(/^\//,""), { cache:"no-store" });
        if(!res.ok) throw new Error(`DZS load failed: ${res.status} ${f}`);
        const text = await res.text();
        this.dzs.loadText(text, f);
        this.engine.events.emit("log", { msg: `[scripts] loaded dzs: ${f}` });
      } else if (f.endsWith(".js")) {
        let mod;
        try{
          mod = await import("/" + f.replace(/^\//,"") + `?v=${Date.now()}`);
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
