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

    route("zm:preload", ["onGamePreload"]);
    route("zm:build", ["onGameBuild"]);
    route("zm:start", ["onGameStart"]);
    route("zm:tick", ["onTick"]);
    route("zm:waveStart", ["onRoundStart"]);
    route("zm:waveEnd", ["onRoundEnd"]);
    route("zm:zombieSpawn", ["onEntitySpawn", "onZombieSpawn"]);
    route("zm:zombieDeath", ["onEntityDeath", "onZombieDeath"]);
    route("zm:playerSpawn", ["onPlayerSpawn", "onPlayerSpawned"]);
    route("zm:playerDeath", ["onPlayerDeath"]);
    route("zm:playerDamaged", ["onPlayerDamaged"]);
    route("zm:zombieDamaged", ["onEntityDamaged", "onZombieDamaged"]);
    route("zm:purchase", ["onPurchase"]);\n\n
// Multiplayer events
route("mp:preload", ["onGamePreload"]);
route("mp:build", ["onGameBuild"]);
route("mp:start", ["onGameStart"]);
route("mp:tick", ["onTick"]);
route("mp:playerSpawn", ["onPlayerSpawn", "onPlayerSpawned"]);
route("mp:playerDamaged", ["onPlayerDamaged"]);
route("mp:playerDeath", ["onPlayerDeath"]);
route("mp:weaponFired", ["onWeaponFired"]);
route("net:welcome", ["onPlayerConnect"]);
route("mp:gameEnd", ["onGameEnd"]);

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
