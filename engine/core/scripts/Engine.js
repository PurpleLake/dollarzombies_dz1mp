import { Events } from "./Events.js";
import { ECS } from "./ECS.js";
import { Loop } from "./Loop.js";

export class Engine {
  constructor(){
    this.events = new Events();
    this.ecs = new ECS();
    this.ctx = {
      engine: this,
      events: this.events,
      ecs: this.ecs,
      time: { t: 0 },
        timeScale: 1
    };
    this.loop = new Loop({
      tickHz: 60,
      onTick: (dt)=>{
        const scale = Number(this.ctx.timeScale ?? 1);
        const scaled = dt * (Number.isFinite(scale) ? scale : 1);
        this.ctx.time.t += scaled;
        this.ecs.tick(scaled, this.ctx);
        this.events.emit("engine:tick", { dt: scaled, t: this.ctx.time.t });
      }
    });
  }
  start(){ this.loop.start(); }
  stop(){ this.loop.stop(); }
}
