import { DzsDevScreen } from "/engine/core/ui/scripts/screens/DzsDevScreen.js";
export class DevModule {
  constructor({ engine }){
    this.engine = engine;
    this.open = false;
    this.node = null;

    // track mouse buttons (simple)
    this.mouseDown = false;
    window.addEventListener("mousedown", (e)=>{
      if(e.button === 0) this.mouseDown = true;
    });
    window.addEventListener("mouseup", (e)=>{
      if(e.button === 0) this.mouseDown = false;
    });

    
window.addEventListener("keydown", (e)=>{
  if(e.code === "Backquote"){
    engine.events.emit("dev:toggle", {});
  }
});

    engine.events.on("dev:toggle", ()=>{
      this.open = !this.open;
      if(this.open){
  const menu = engine.ctx.menu;
  if(menu){
    this.node = DzsDevScreen({
      engine,
      onClose: ()=>engine.events.emit("dev:toggle", {})
    });
    menu.setOverlay(this.node);
    menu.toast("Developer Menu opened");
  }
} else {
  const menu = engine.ctx.menu;
  if(menu){
    menu.setOverlay(null);
    menu.toast("Developer Menu closed");
  }
}
engine.events.emit("dev:toast", { msg: this.open ? "Dev: ON (` to close)" : "Dev: OFF" });

    });

    // quick commands via console:
    engine.ctx.dev = { toast: (m)=>engine.events.emit("dev:toast",{msg:m}) };
  }

  tick(dt, ecs, ctx){
    // fire weapon on click (no UI buttons needed)
    if(ctx.input?.mouse?.locked && this.mouseDown){
      ctx.game?.players?.tryShoot();
    }

    // dev overlay could be added later; for now, dev just adds hotkeys + logs.
  }
}
