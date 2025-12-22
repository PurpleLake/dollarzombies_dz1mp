import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

function dist(a,b){
  const dx = (a.x-b.x), dy=(a.y-b.y), dz=(a.z-b.z);
  return Math.sqrt(dx*dx+dy*dy+dz*dz);
}

export class TriggerSystem {
  constructor(engine){
    this.engine = engine;
    this.triggers = new Map(); // id -> {id, origin, radius, prompt, onUse, onEnter, onExit, visible, _inside}
    this._lastPromptId = null;
  }

  clear(){
    this.triggers.clear();
    this._lastPromptId = null;
    this.engine?.events?.emit?.("trigger:prompt", { triggerId: null, prompt: "" });
  }

  create(origin, radius=2.0, opts={}){
    const id = String(opts.id || crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    const t = {
      id,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      radius,
      prompt: opts.prompt || "",
      enabled: (opts.enabled !== false),
      cooldownMs: Number(opts.cooldownMs||0),
      holdMs: Number(opts.holdMs||0),
      _lastUseAt: 0,
      _holdStartAt: 0,
      onUse: opts.onUse || null,   // dzs handler name string
      onEnter: opts.onEnter || null,
      onExit: opts.onExit || null,
      _inside: false,
    };
    this.triggers.set(id, t);
    return id;
  }

  destroy(id){
    this.triggers.delete(String(id));
  }

  setRadius(id, radius){
    const t = this.triggers.get(String(id));
    if(t) t.radius = Number(radius||t.radius||2);
  }

  setEnabled(id, enabled){
    const t = this.triggers.get(String(id));
    if(t) t.enabled = !!enabled;
  }

  setCooldown(id, ms){
    const t = this.triggers.get(String(id));
    if(t) t.cooldownMs = Number(ms||0);
  }

  setHoldTime(id, ms){
    const t = this.triggers.get(String(id));
    if(t) t.holdMs = Number(ms||0);
  }

  getHoldProgress(id){
    const t = this.triggers.get(String(id));
    if(!t) return 0;
    if(!t.holdMs) return 1;
    if(!t._holdStartAt) return 0;
    const p = (performance.now() - t._holdStartAt) / t.holdMs;
    return Math.max(0, Math.min(1, p));
  }

  setPrompt(id, text){
    const t = this.triggers.get(String(id));
    if(t) t.prompt = String(text ?? "");
  }

  setHandler(id, type, handlerName){
    const t = this.triggers.get(String(id));
    if(!t) return;
    const name = handlerName ? String(handlerName) : null;
    if(type === "use") t.onUse = name;
    if(type === "enter") t.onEnter = name;
    if(type === "exit") t.onExit = name;
  }

  getAll(){
    return Array.from(this.triggers.values()).map(t=>({ id:t.id, origin:t.origin, radius:t.radius, prompt:t.prompt }));
  }

  tick(player, input){
    if(!player) return;
    const pos = player.position || player.pos || player.camPivot?.position || player.cam?.position || player.camera?.position;
    if(!pos) return;

    const holdPressed = !!(input?.keys?.["KeyF"] || input?.keys?.["KeyE"]);

    let best = null;
    let bestD = Infinity;

    for(const t of this.triggers.values()){
      if(!t.enabled) continue;
      const d = dist(pos, t.origin);
      const inside = d <= t.radius;

      // enter/exit
      if(inside && !t._inside){
        t._inside = true;
        this.engine?.events?.emit?.("trigger:enter", { triggerId: t.id, player });
        if(t.onEnter) this.engine?.events?.emit?.("dzs:call", { handler: t.onEnter, payload: { triggerId:t.id, player } });
      }
      if(!inside && t._inside){
        t._inside = false;
        this.engine?.events?.emit?.("trigger:exit", { triggerId: t.id, player });
        if(t.onExit) this.engine?.events?.emit?.("dzs:call", { handler: t.onExit, payload: { triggerId:t.id, player } });
      }

      if(inside && d < bestD){
        best = t;
        bestD = d;
      }
    }

    // prompt + use
    if(best && best.prompt){
      if(!holdPressed) best._holdStartAt = 0;
      const prog = best.holdMs ? this.getHoldProgress(best.id) : 0;
      const cooling = best.cooldownMs ? (performance.now() - best._lastUseAt) < best.cooldownMs : false;
      this.engine?.events?.emit?.("trigger:prompt", { triggerId: best.id, prompt: best.prompt, dist: bestD, progress: prog, cooling });
      if(holdPressed){
        // hold-to-use
        if(best.holdMs){
          if(!best._holdStartAt) best._holdStartAt = performance.now();
          const p = this.getHoldProgress(best.id);
          if(p < 1) {
            return; // keep holding
          }
        }
        const now = performance.now();
        if(best.cooldownMs && (now - best._lastUseAt) < best.cooldownMs){
          return;
        }
        best._lastUseAt = now;
        best._holdStartAt = 0;

        this.engine?.events?.emit?.("trigger:use", { triggerId: best.id, player });
        // generic handler
        this.engine?.events?.emit?.("dzs:call", { handler: "onTriggerUse", payload: { triggerId: best.id, player } });
        if(best.onUse){
          this.engine?.events?.emit?.("dzs:call", { handler: best.onUse, payload: { triggerId: best.id, player } });
        }
      }
    } else {
      this.engine?.events?.emit?.("trigger:prompt", { triggerId: null, prompt: "" });
    }
  }
}
