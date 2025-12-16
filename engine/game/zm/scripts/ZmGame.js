import { Renderer3D } from "../../../core/scripts/Renderer3D.js";
import { EntityRegistry } from "../../../core/scripts/EntityRegistry.js";
import { ModelSpawner } from "../../../core/scripts/ModelSpawner.js";
import { Input } from "../../../core/scripts/Input.js";
import { ZmWorld } from "./ZmWorld.js";
import { ZmWaves } from "./ZmWaves.js";
import { PlayersModule } from "../players/scripts/PlayersModule.js";
import { ZombiesModule } from "../zombies/scripts/ZombiesModule.js";
import { CashModule } from "./CashModule.js";
import { ShopModule } from "./ShopModule.js";
import { WeaponDB } from "../../../core/weapons/scripts/WeaponDB.js";

export class ZmGame {
  constructor({ engine, scripts }){
    this.engine = engine;
    this.scripts = scripts;
    this.mode = "zm";
    this._unsubs = [];
    this._onCanvasClick = null;

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
    this.engine.ctx.world = this.world;
    this.engine.ctx.worldBuilder = this.world;
    this.waves = new ZmWaves({ engine });

    this.players = new PlayersModule({ engine, renderer: this.renderer, input: this.input });
    this.zombies = new ZombiesModule({ engine, renderer: this.renderer });

    this.weapons = engine.ctx.weapons || new WeaponDB();

      // expose weapons
      this.engine.ctx.weapons = this.weapons;

    // Systems tick order
    engine.ecs.use((dt, ecs, ctx)=>this.world.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.players.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.zombies.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.waves.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.renderTick(dt, ecs, ctx));
  }

  applySpawnPoints(spawnPoints={}){
    const playerSpawns = spawnPoints.players || spawnPoints.playerSpawns || [];
    const zombieSpawns = spawnPoints.zombies || spawnPoints.zombieSpawns || [];

    if(Array.isArray(zombieSpawns) && zombieSpawns.length){
      this.zombies.spawns = zombieSpawns.map(s=>({ x:Number(s.x||0), z:Number(s.z||0) }));
    }
    if(Array.isArray(playerSpawns) && playerSpawns[0]){
      const s = playerSpawns[0];
      this.players.setSpawn(Number(s.x||0), Number(s.z||0));
    }
  }

  async start(){
    // Pointer lock on click inside canvas once menu is hidden
    if(!this._onCanvasClick){
      this._onCanvasClick = ()=>{
        if(!document.pointerLockElement) this.engine.ctx.canvas.requestPointerLock();
      };
      this.engine.ctx.canvas.addEventListener("click", this._onCanvasClick);
    }

    // Fire bootstrap events so dzs can build the world.
    this.engine.events.emit("zm:preload", {});
    this.engine.events.emit("zm:build", {});
    this.engine.events.emit("zm:start", {});

// Game end bridge
const offEnd = this.engine.events.on("zm:playerDeath", (e)=>{
  this.engine.events.emit("zm:gameEnd", { reason:"playerDeath", event:e });
});
    this._unsubs.push(offEnd);
    this.waves.startWave(1);
  }

  renderTick(){
    this.engine.events.emit("zm:tick", {});
    this.renderer.render();
  }

  dispose(){
    try { this.players?.dispose?.(); } catch {}
    try { this.input?.dispose?.(); } catch {}
    try { this.world?.clearWorld?.(); } catch {}
    try { this.zombies?.clear?.(); } catch {}
    try { this.renderer?.domElement?.remove?.(); } catch {}
    try { this.renderer?.renderer?.dispose?.(); } catch {}
    for(const off of this._unsubs) try { off?.(); } catch {}
    this._unsubs.length = 0;
    if(this._onCanvasClick && this.engine?.ctx?.canvas){
      try { this.engine.ctx.canvas.removeEventListener("click", this._onCanvasClick); } catch {}
    }
    this._onCanvasClick = null;
  }
}
