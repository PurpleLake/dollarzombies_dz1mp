import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const ZM_COLORS = ["#64d2ff", "#34c759", "#ffd60a", "#bf5af2"]; // cyan, green, yellow, purple

export class NameplateManager {
  constructor(engine){
    this.engine = engine;
    this.plates = new Map(); // key -> { el, color, lastSeen }
  }

  _key(p){ return String(p.id ?? p.name ?? "unknown"); }

  _ensure(key){
    let plate = this.plates.get(key);
    if(plate) return plate;

    const el = document.createElement("div");
    el.className = "dz-nameplate";
    el.style.display = "none";

    const name = document.createElement("div");
    name.className = "dz-nameplate-name";
    el.appendChild(name);

    document.body.appendChild(el);

    plate = { el, name, lastSeen: performance.now() };
    this.plates.set(key, plate);
    return plate;
  }

  _projectToScreen(pos, camera, canvas){
    if(!pos || !camera || !canvas) return null;
    const v = new THREE.Vector3(pos.x, pos.y, pos.z);
    v.project(camera);

    if(v.z < -1 || v.z > 1) return null;

    const rect = canvas.getBoundingClientRect();
    const x = (v.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
    return { x, y };
  }

  tick(){
    const eng = this.engine;
    const renderer = eng?.ctx?.renderer;
    const camera = renderer?.camera;
    const canvas = renderer?.dom;

    const net = eng?.ctx?.net;
    const mode = eng?.ctx?.options?.get?.("gameMode") || "zm";

    // determine roster source
    let roster = [];
    if(net?.players && net.players.size){
      roster = Array.from(net.players.values());
    } else if(Array.isArray(eng?.ctx?.players)){
      roster = eng.ctx.players.map(p=>p.raw || p);
    }

    const now = performance.now();

    // build order list for zm coloring (stable sort by id)
    let zmOrder = roster.slice();
    zmOrder.sort((a,b)=>String(a.id||a.name).localeCompare(String(b.id||b.name)));

    const localId = net?.clientId;
    const localTeam = net?.team;

    const seen = new Set();

    for(const p of roster){
      if(!p) continue;
      // hide local player's plate by default
      if(localId && String(p.id) === String(localId)) continue;

      const key = this._key(p);
      const plate = this._ensure(key);
      plate.lastSeen = now;
      seen.add(key);

      const name = p.name || `Player${key}`;
      plate.name.textContent = name;

      // Determine color
      let color = "#ffffff";
      if(mode === "mp"){
        // green for teammates, red for enemies
        const team = p.team ?? null;
        if(team !== null && localTeam !== null){
          color = (team === localTeam) ? "#34c759" : "#ff3b30";
        } else {
          color = "#ffffff";
        }
      } else {
        // Zombies: 4 distinct player colors
        const idx = zmOrder.findIndex(x=>String(x.id||x.name)===String(p.id||p.name));
        color = ZM_COLORS[(idx>=0?idx:0) % 4];
      }
      plate.el.style.borderColor = color;
      plate.name.style.color = color;

      // Position: use net pos if available; otherwise player camPivot position
      const pos = p.pos || p.position || p.camPivot?.position;
      const head = { x: pos?.x ?? 0, y: (pos?.y ?? 0) + 0.6, z: pos?.z ?? 0 };
      const screen = this._projectToScreen(head, camera, canvas);
      if(!screen){
        plate.el.style.display = "none";
        continue;
      }
      plate.el.style.transform = `translate(-50%, -100%) translate(${screen.x}px, ${screen.y}px)`;
      plate.el.style.display = "block";
    }

    // cleanup stale plates
    for(const [key, plate] of this.plates){
      if(seen.has(key)) continue;
      if(now - plate.lastSeen > 2000){
        try{ plate.el.remove(); } catch {}
        this.plates.delete(key);
      } else {
        plate.el.style.display = "none";
      }
    }
  }

  clear(){
    for(const plate of this.plates.values()){
      try{ plate.el.remove(); } catch {}
    }
    this.plates.clear();
  }
}
