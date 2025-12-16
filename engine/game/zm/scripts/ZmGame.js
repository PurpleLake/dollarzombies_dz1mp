import { Renderer3D } from "../../../core/scripts/Renderer3D.js";
import { MapLoader } from "../../../core/scripts/MapLoader.js";
import { EntityRegistry } from "../../../core/scripts/EntityRegistry.js";
import { ModelSpawner } from "../../../core/scripts/ModelSpawner.js";
import { Input } from "../../../core/scripts/Input.js";
import { ZmWorld } from "./ZmWorld.js";
import { ZmWaves } from "./ZmWaves.js";
import { PlayersModule } from "../players/scripts/PlayersModule.js";
import { ZombiesModule } from "../zombies/scripts/ZombiesModule.js";
import { DevModule } from "../dev/scripts/DevModule.js";
import { CashModule } from "./CashModule.js";
import { ShopModule } from "./ShopModule.js";
import { WeaponDB } from "../../../core/weapons/scripts/WeaponDB.js";

export class ZmGame {
  constructor({ engine, scripts }){
    this.engine = engine;
    this.scripts = scripts;

    this.renderer = new Renderer3D();
    const canvas = this.renderer.mount();
    this.engine.ctx.canvas = canvas;
    this.engine.ctx.renderer = this.renderer;

    this.entities = new EntityRegistry({ scene: this.renderer.scene, events: engine.events });
    this.modelSpawner = new ModelSpawner({ renderer: this.renderer, entities: this.entities, events: engine.events });
    this.engine.ctx.entities = this.entities;
    this.engine.ctx.modelSpawner = this.modelSpawner;

    this.input = new Input({ canvas, events: engine.events });
    this.engine.ctx.input = this.input;

    this.world = new ZmWorld({ engine, renderer: this.renderer });
    this.waves = new ZmWaves({ engine });

    this.mapLoader = new MapLoader(engine);

    this.players = new PlayersModule({ engine, renderer: this.renderer, input: this.input });
    this.zombies = new ZombiesModule({ engine, renderer: this.renderer });

    this.weapons = engine.ctx.weapons || new WeaponDB();

      // expose weapons
      this.engine.ctx.weapons = this.weapons;

      this.dev = new DevModule({ engine });

    // Systems tick order
    engine.ecs.use((dt, ecs, ctx)=>this.world.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.players.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.zombies.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.waves.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.dev.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.renderTick(dt, ecs, ctx));
  }

  async start(){
    // Pointer lock on click inside canvas once menu is hidden
    this.engine.ctx.canvas.addEventListener("click", ()=>{
      if(!document.pointerLockElement) this.engine.ctx.canvas.requestPointerLock();
    });

    // Fire bootstrap events so dzs can build the world.
    this.engine.events.emit("zm:preload", {});
    this.engine.events.emit("zm:build", {});
    this.engine.events.emit("zm:start", {});

// Game end bridge
this.engine.events.on("zm:playerDeath", (e)=>{
  this.engine.events.emit("zm:gameEnd", { reason:"playerDeath", event:e });
});
    this.waves.startWave(1);
  }

  renderTick(){
    this.engine.events.emit("zm:tick", {});
    this.renderer.render();
  }
}
