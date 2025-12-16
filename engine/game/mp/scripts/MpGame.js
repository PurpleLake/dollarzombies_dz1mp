import { Renderer3D } from "../../../core/scripts/Renderer3D.js";
import { MapLoader } from "../../../core/scripts/MapLoader.js";
import { Input } from "../../../core/scripts/Input.js";
import { ScriptLoader } from "../../../core/scripts/ScriptLoader.js";
import { WeaponDB } from "../../../core/weapons/scripts/WeaponDB.js";
import { MpPlayersModule } from "../players/scripts/MpPlayersModule.js";

export class MpGame {
  constructor(engine){
    this.engine = engine;

    // Renderer
    this.renderer = new Renderer3D();
    engine.ctx.renderer = this.renderer;

    // Input
    this.input = new Input(this.renderer.dom);
    engine.ctx.input = this.input;

    // Weapons (shared core registry)
    this.weapons = engine.ctx.weapons || new WeaponDB();
    engine.ctx.weapons = this.weapons;

    // Script loader (mode scripts optional)
    this.scripts = new ScriptLoader(engine, {
      scriptsRoot: "/public/scripts",
      manifestPath: "/public/scripts/mp_manifest.json",
      customFolder: "/public/scripts/custom"
    });

    // Players
    this.mapLoader = new MapLoader(engine);

    this.players = new MpPlayersModule(engine, this.renderer, this.input, this.weapons);

    // Systems
    engine.ecs.use((dt, ecs, ctx)=>this.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.renderTick(dt, ecs, ctx));
  }

  async start(){
    this.engine.events.emit("mp:preload", {});
    await this.mapLoader.load({ mode:"mp", map: this.engine.ctx.options?.get?.("mpMap") || "arena01" });
    await this.scripts.loadAll();
    this.engine.events.emit("mp:build", {});
    this.engine.events.emit("mp:start", {});
    this.engine.events.on("net:close", ()=>{
      this.engine.events.emit("mp:gameEnd", { reason:"netClose" });
    });
  }

  tick(dt){
    this.players.tick(dt);
    this.engine.events.emit("mp:tick", { dt });
    this.engine.ctx.nameplates?.tick?.();
  }

  renderTick(dt){
    this.renderer.render(dt);
  }
}
