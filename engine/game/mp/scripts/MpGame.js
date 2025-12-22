import { Renderer3D } from "../../../core/scripts/Renderer3D.js";
import { Input } from "../../../core/scripts/Input.js";
import { WeaponDB } from "../../../core/weapons/scripts/WeaponDB.js";
import { MpPlayersModule } from "../players/scripts/MpPlayersModule.js";
import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export class MpGame {
  constructor({ engine, scripts }){
    this.engine = engine;
    this.scripts = scripts;
    this.mode = "mp";
    this._unsubs = [];
    this._onCanvasClick = null;

    // Renderer
    this.renderer = new Renderer3D();
    const canvas = this.renderer.mount();
    engine.ctx.canvas = canvas;
    engine.ctx.renderer = this.renderer;

    // Input
    this.input = new Input({ canvas, events: engine.events });
    engine.ctx.input = this.input;

    // Weapons (shared core registry)
    this.weapons = engine.ctx.weapons || new WeaponDB();
    engine.ctx.weapons = this.weapons;

    this.players = new MpPlayersModule(engine, this.renderer, this.input, this.weapons);
    this.world = new WorldBuilder({ engine, renderer: this.renderer });
    engine.ctx.world = this.world;
    engine.ctx.worldBuilder = this.world;

    // Systems
    engine.ecs.use((dt, ecs, ctx)=>this.tick(dt, ecs, ctx));
    engine.ecs.use((dt, ecs, ctx)=>this.renderTick(dt, ecs, ctx));

    this._unsubs.push(engine.events.on("mp:killcam", (payload)=>{
      this.players?.startKillcam?.({
        killerId: payload?.killerId ?? payload?.lastKill?.killerId,
        durationMs: payload?.durationMs ?? 4500,
      });
    }));
    this._unsubs.push(engine.events.on("mp:matchState", ({ state })=>{
      this.applyMatchState(state);
    }));
  }

  applySpawnPoints(spawnPoints={}){
    const t0 = spawnPoints.teamA || spawnPoints.team0 || spawnPoints.mpTeam0 || spawnPoints.mpTeamA || spawnPoints.mpSpawnsTeam0 || [];
    const t1 = spawnPoints.teamB || spawnPoints.team1 || spawnPoints.mpTeam1 || spawnPoints.mpTeamB || spawnPoints.mpSpawnsTeam1 || [];
    const map = this.engine.ctx.map || {};
    map.mpSpawnsTeam0 = t0;
    map.mpSpawnsTeam1 = t1;
    this.engine.ctx.map = map;
  }

  async start(){
    if(!this._onCanvasClick){
      this._onCanvasClick = ()=>{
        if(!document.pointerLockElement) this.engine.ctx.canvas.requestPointerLock();
      };
      this.engine.ctx.canvas.addEventListener("click", this._onCanvasClick);
    }

    this.engine.events.emit("mp:preload", {});
    this.engine.events.emit("mp:build", {});
    this.engine.events.emit("mp:start", {});
    this._ensureDefaultWorld();
    this.applyMatchState(this.engine.ctx.matchState || {});
    const offNet = this.engine.events.on("net:close", ()=>{
      this.engine.events.emit("mp:gameEnd", { reason:"netClose" });
    });
    this._unsubs.push(offNet);
  }

  tick(dt){
    this.players.tick(dt);
    this.engine.events.emit("mp:tick", { dt });
    this.engine.ctx.nameplates?.tick?.();
  }

  renderTick(dt){
    this.renderer.render(dt);
  }

  applyMatchState(state){
    const tdm = state?.tdm || {};
    const frozen = Boolean(tdm.frozen || tdm.status === "ending");
    this.players?.setFrozen?.(frozen);
  }

  dispose(){
    try { this.players?.dispose?.(); } catch {}
    try { this.input?.dispose?.(); } catch {}
    try { this.world?.clearWorld?.(); } catch {}
    try { this.renderer?.domElement?.remove?.(); } catch {}
    try { this.renderer?.renderer?.dispose?.(); } catch {}
    for(const off of this._unsubs) try { off?.(); } catch {}
    this._unsubs.length = 0;
    if(this._onCanvasClick && this.engine?.ctx?.canvas){
      try { this.engine.ctx.canvas.removeEventListener("click", this._onCanvasClick); } catch {}
    }
    this._onCanvasClick = null;
  }

  _ensureDefaultWorld(){
    const world = this.world;
    if(!world) return;
    if(!world.floor) world.addFloor(70);
    if(!Array.isArray(world.lights) || world.lights.length === 0){
      world.addLight({ type: "ambient", color: 0x52637a, intensity: 0.45 });
      world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: 6, y: 14, z: -6 }, castShadow: true });
      world.addLight({ type: "point", color: 0xffc68a, intensity: 0.65, position: { x: 0, y: 4, z: 0 }, castShadow: false });
    }
  }
}
