const DEFAULT_GRID = 1;

function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function isFiniteNumber(n){
  return Number.isFinite(Number(n));
}

function degToRad(d){
  return (Number(d || 0) * Math.PI) / 180;
}

function radToDeg(r){
  return (Number(r || 0) * 180) / Math.PI;
}

function snapValue(v, step){
  const s = Number(step || 1);
  if(!s) return v;
  return Math.round(v / s) * s;
}

function pointInRotRect(px, py, rect){
  const rot = degToRad(rect.rot || 0);
  const dx = px - rect.x;
  const dy = py - rect.y;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  const halfW = Math.abs(rect.w || 0) / 2;
  const halfH = Math.abs(rect.h || 0) / 2;
  return rx >= -halfW && rx <= halfW && ry >= -halfH && ry <= halfH;
}

function pointInRect(px, py, rect){
  const halfW = Math.abs(rect.w || 0) / 2;
  const halfH = Math.abs(rect.h || 0) / 2;
  return (
    px >= rect.x - halfW &&
    px <= rect.x + halfW &&
    py >= rect.y - halfH &&
    py <= rect.y + halfH
  );
}

function rectHandles(rect){
  const halfW = Math.abs(rect.w || 0) / 2;
  const halfH = Math.abs(rect.h || 0) / 2;
  return [
    { key:"nw", x: rect.x - halfW, y: rect.y - halfH },
    { key:"ne", x: rect.x + halfW, y: rect.y - halfH },
    { key:"se", x: rect.x + halfW, y: rect.y + halfH },
    { key:"sw", x: rect.x - halfW, y: rect.y + halfH },
  ];
}

export class MapEditorCanvas {
  constructor({ canvas, getState, onMutate, onSelect }){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getState = getState;
    this.onMutate = onMutate;
    this.onSelect = onSelect;
    this.tool = "select";
    this.snap = true;
    this.grid = DEFAULT_GRID;
    this.pan = { x: 0, y: 0 };
    this.zoom = 12;
    this.drag = null;
    this.asset = null;
    this._raf = null;

    this._onResize = ()=> this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
    this.bindEvents();
    this.render();
  }

  dispose(){
    window.removeEventListener("resize", this._onResize);
    if(this._raf) cancelAnimationFrame(this._raf);
  }

  setTool(tool){
    this.tool = tool;
  }

  setAsset(asset){
    this.asset = asset || null;
  }

  setSnap(enabled){
    this.snap = !!enabled;
  }

  resize(){
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width));
    this.canvas.height = Math.max(1, Math.floor(rect.height));
    this.render();
  }

  bindEvents(){
    const canvas = this.canvas;
    canvas.addEventListener("mousedown", (e)=> this.onMouseDown(e));
    canvas.addEventListener("mousemove", (e)=> this.onMouseMove(e));
    canvas.addEventListener("mouseup", (e)=> this.onMouseUp(e));
    canvas.addEventListener("mouseleave", (e)=> this.onMouseUp(e));
    canvas.addEventListener("wheel", (e)=> this.onWheel(e), { passive: false });
    canvas.addEventListener("contextmenu", (e)=> e.preventDefault());
  }

  worldToScreen(x, y){
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    return {
      x: cx + (x * this.zoom) + this.pan.x,
      y: cy - (y * this.zoom) + this.pan.y,
    };
  }

  screenToWorld(x, y){
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    return {
      x: (x - cx - this.pan.x) / this.zoom,
      y: -(y - cy - this.pan.y) / this.zoom,
    };
  }

  render(){
    const ctx = this.ctx;
    const { mapData, selected } = this.getState();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();
    this.drawBounds(mapData.bounds);
    this.drawZones(mapData.zones || [], selected);
    this.drawWalls(mapData.walls || [], selected);
    this.drawProps(mapData.props || [], selected);
    this.drawSpawns(mapData.spawns || {}, selected);
    this.drawLights(mapData.lights || [], selected);
    this.drawSelectionHandles(mapData, selected);
  }

  drawGrid(){
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2 + this.pan.x;
    const cy = h / 2 + this.pan.y;
    const zoom = this.zoom;

    ctx.save();
    ctx.fillStyle = "#0d1118";
    ctx.fillRect(0, 0, w, h);

    let step = this.grid;
    let spacing = step * zoom;
    while(spacing < 16){ step *= 2; spacing = step * zoom; }
    while(spacing > 80){ step /= 2; spacing = step * zoom; }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;

    const startX = cx % spacing;
    const startY = cy % spacing;

    ctx.beginPath();
    for(let x = startX; x <= w; x += spacing){
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for(let y = startY; y <= h; y += spacing){
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    ctx.restore();
  }

  drawBounds(bounds){
    if(!bounds) return;
    const ctx = this.ctx;
    const minX = Number(bounds.minX || 0);
    const minY = Number(bounds.minY || 0);
    const maxX = Number(bounds.maxX || 0);
    const maxY = Number(bounds.maxY || 0);
    const p0 = this.worldToScreen(minX, minY);
    const p1 = this.worldToScreen(maxX, maxY);
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  drawWalls(walls, selected){
    const ctx = this.ctx;
    for(const w of walls){
      if(!isFiniteNumber(w.x) || !isFiniteNumber(w.y)) continue;
      const pos = this.worldToScreen(Number(w.x), Number(w.y));
      const ww = Math.abs(Number(w.w || 0)) * this.zoom;
      const hh = Math.abs(Number(w.h || 0)) * this.zoom;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-degToRad(w.rot || 0));
      ctx.fillStyle = (selected?.id === w.id && selected?.type === "wall")
        ? "rgba(255,180,90,0.7)"
        : "rgba(80,120,160,0.6)";
      ctx.fillRect(-ww/2, -hh/2, ww, hh);
      ctx.restore();
    }
  }

  drawProps(props, selected){
    const ctx = this.ctx;
    for(const p of props){
      if(!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue;
      const pos = this.worldToScreen(Number(p.x), Number(p.y));
      const size = Math.max(6, Number(p.scale || 1) * this.zoom * 0.5);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-degToRad(p.rot || 0));
      ctx.fillStyle = (selected?.id === p.id && selected?.type === "prop")
        ? "rgba(240,210,120,0.9)"
        : "rgba(190,150,70,0.8)";
      ctx.fillRect(-size/2, -size/2, size, size);
      ctx.restore();
    }
  }

  drawSpawns(spawns, selected){
    const players = Array.isArray(spawns.player) ? spawns.player : [];
    const zombies = Array.isArray(spawns.zombie) ? spawns.zombie : [];
    const ctx = this.ctx;
    for(const s of players){
      if(!isFiniteNumber(s.x) || !isFiniteNumber(s.y)) continue;
      const pos = this.worldToScreen(Number(s.x), Number(s.y));
      ctx.save();
      ctx.fillStyle = (selected?.id === s.id && selected?.type === "player")
        ? "rgba(120,220,255,0.95)"
        : "rgba(80,160,255,0.85)";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    for(const s of zombies){
      if(!isFiniteNumber(s.x) || !isFiniteNumber(s.y)) continue;
      const pos = this.worldToScreen(Number(s.x), Number(s.y));
      ctx.save();
      ctx.fillStyle = (selected?.id === s.id && selected?.type === "zombie")
        ? "rgba(140,255,140,0.95)"
        : "rgba(80,200,120,0.85)";
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - 6);
      ctx.lineTo(pos.x + 6, pos.y + 6);
      ctx.lineTo(pos.x - 6, pos.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawLights(lights, selected){
    const ctx = this.ctx;
    for(const l of lights){
      if(!isFiniteNumber(l.x) || !isFiniteNumber(l.y)) continue;
      const pos = this.worldToScreen(Number(l.x), Number(l.y));
      ctx.save();
      ctx.strokeStyle = (selected?.id === l.id && selected?.type === "light")
        ? "rgba(255,240,120,0.95)"
        : "rgba(255,220,80,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x - 6, pos.y);
      ctx.lineTo(pos.x + 6, pos.y);
      ctx.moveTo(pos.x, pos.y - 6);
      ctx.lineTo(pos.x, pos.y + 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawZones(zones, selected){
    const ctx = this.ctx;
    for(const z of zones){
      if(!isFiniteNumber(z.x) || !isFiniteNumber(z.y)) continue;
      const pos = this.worldToScreen(Number(z.x), Number(z.y));
      const ww = Math.abs(Number(z.w || 0)) * this.zoom;
      const hh = Math.abs(Number(z.h || 0)) * this.zoom;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.strokeStyle = (selected?.id === z.id && selected?.type === "zone")
        ? "rgba(255,160,200,0.95)"
        : "rgba(200,120,160,0.75)";
      ctx.setLineDash([6,4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(-ww/2, -hh/2, ww, hh);
      ctx.restore();
    }
  }

  drawSelectionHandles(mapData, selected){
    if(!selected) return;
    if(selected.type !== "wall" && selected.type !== "zone") return;
    const list = selected.type === "wall" ? mapData.walls : mapData.zones;
    const item = list.find(i=>i.id === selected.id);
    if(!item) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const handles = rectHandles(item);
    for(const h of handles){
      const p = this.worldToScreen(h.x, h.y);
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    ctx.restore();
  }

  hitTest(pos){
    const { mapData } = this.getState();
    const px = pos.x;
    const py = pos.y;

    const zones = (mapData.zones || []).slice().reverse();
    for(const z of zones){
      if(pointInRect(px, py, z)) return { type:"zone", id:z.id };
    }

    const walls = (mapData.walls || []).slice().reverse();
    for(const w of walls){
      if(pointInRotRect(px, py, w)) return { type:"wall", id:w.id };
    }

    const props = (mapData.props || []).slice().reverse();
    for(const p of props){
      const dx = px - Number(p.x||0);
      const dy = py - Number(p.y||0);
      if(Math.sqrt(dx*dx+dy*dy) <= 0.6) return { type:"prop", id:p.id };
    }

    const players = (mapData.spawns?.player || []).slice().reverse();
    for(const s of players){
      const dx = px - Number(s.x||0);
      const dy = py - Number(s.y||0);
      if(Math.sqrt(dx*dx+dy*dy) <= 0.6) return { type:"player", id:s.id };
    }
    const zombies = (mapData.spawns?.zombie || []).slice().reverse();
    for(const s of zombies){
      const dx = px - Number(s.x||0);
      const dy = py - Number(s.y||0);
      if(Math.sqrt(dx*dx+dy*dy) <= 0.6) return { type:"zombie", id:s.id };
    }

    const lights = (mapData.lights || []).slice().reverse();
    for(const l of lights){
      const dx = px - Number(l.x||0);
      const dy = py - Number(l.y||0);
      if(Math.sqrt(dx*dx+dy*dy) <= 0.6) return { type:"light", id:l.id };
    }

    return null;
  }

  handleAt(pos, rect){
    const handles = rectHandles(rect);
    for(const h of handles){
      const p = this.worldToScreen(h.x, h.y);
      const dx = pos.sx - p.x;
      const dy = pos.sy - p.y;
      if(Math.abs(dx) <= 6 && Math.abs(dy) <= 6) return h.key;
    }
    return null;
  }

  onMouseDown(e){
    const isPan = e.button === 2 || e.button === 1;
    const { mapData, selected } = this.getState();
    const pos = this.screenToWorld(e.offsetX, e.offsetY);
    if(isPan){
      this.drag = { mode:"pan", startX:e.clientX, startY:e.clientY, panX:this.pan.x, panY:this.pan.y };
      return;
    }

    if(this.tool === "select"){
      let hit = this.hitTest(pos);
      if(hit){
        const list = (hit.type === "wall" ? mapData.walls :
          hit.type === "zone" ? mapData.zones :
          hit.type === "prop" ? mapData.props :
          hit.type === "player" ? mapData.spawns.player :
          hit.type === "zombie" ? mapData.spawns.zombie :
          mapData.lights);
        const item = list.find(i=>i.id === hit.id);
        let handle = null;
        if(hit.type === "wall" || hit.type === "zone"){
          handle = this.handleAt({ sx:e.offsetX, sy:e.offsetY }, item);
        }
        this.onSelect?.(hit);
        this.drag = { mode: handle ? "resize" : "move", type: hit.type, id: hit.id, start: clone(item), startWorld: pos, handle, started:false };
        return;
      }
      this.onSelect?.(null);
      return;
    }

    // Placement tools
    if(this.tool === "wall" || this.tool === "zone"){
      const start = this.snap ? { x: snapValue(pos.x, this.grid), y: snapValue(pos.y, this.grid) } : pos;
      const id = `${this.tool === "wall" ? "w" : "z"}${Date.now()}`;
      this.onMutate((draft)=>{
        const list = (this.tool === "wall") ? draft.walls : draft.zones;
        list.push({ id, x:start.x, y:start.y, w:1, h:1, rot:0, name:"", type:"" });
      }, { commit:true });
      this.onSelect?.({ type:this.tool, id });
      this.drag = { mode:"resize", type:this.tool, id, startWorld:start, handle:"se", started:true };
      return;
    }

    const item = this.makePointItem(this.tool, pos);
    if(item){
      this.onMutate((draft)=>{
        if(this.tool === "prop" || this.tool === "asset") draft.props.push(item);
        else if(this.tool === "player") draft.spawns.player.push(item);
        else if(this.tool === "zombie") draft.spawns.zombie.push(item);
        else if(this.tool === "light") draft.lights.push(item);
      }, { commit:true });
      const selType = this.tool === "asset" ? "prop" : this.tool;
      this.onSelect?.({ type:selType, id:item.id });
    }
  }

  makePointItem(tool, pos){
    const snap = this.snap;
    const p = {
      x: snap ? snapValue(pos.x, this.grid) : pos.x,
      y: snap ? snapValue(pos.y, this.grid) : pos.y,
    };
    const id = `${tool[0]}${Date.now()}`;
    if(tool === "prop" || tool === "asset"){
      const a = this.asset;
      if(a && tool === "asset"){
        return {
          id,
          type: a.id,
          assetId: a.id,
          kind: a.kind,
          model: a.model,
          material: a.material,
          collision: a.collision,
          collider: a.collider,
          x: p.x,
          y: p.y,
          z: 0,
          rot: 0,
          scale: Number(a.scale || 1),
        };
      }
      return { id, type:"crate", x:p.x, y:p.y, z:0, rot:0, scale:1 };
    }
    if(tool === "player"){
      return { id, x:p.x, y:p.y, z:0, rot:0, team:"A" };
    }
    if(tool === "zombie"){
      return { id, x:p.x, y:p.y, z:0 };
    }
    if(tool === "light"){
      return { id, kind:"point", x:p.x, y:p.y, z:4, intensity:1, range:40, color:"#ffffff" };
    }
    return null;
  }

  onMouseMove(e){
    if(!this.drag) return;
    if(this.drag.mode === "pan"){
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      this.pan.x = this.drag.panX + dx;
      this.pan.y = this.drag.panY + dy;
      this.render();
      return;
    }

    const pos = this.screenToWorld(e.offsetX, e.offsetY);
    const snapPos = this.snap ? { x: snapValue(pos.x, this.grid), y: snapValue(pos.y, this.grid) } : pos;
    const { mapData } = this.getState();
    const list = (this.drag.type === "wall" ? mapData.walls :
      this.drag.type === "zone" ? mapData.zones :
      this.drag.type === "prop" ? mapData.props :
      this.drag.type === "player" ? mapData.spawns.player :
      this.drag.type === "zombie" ? mapData.spawns.zombie :
      mapData.lights);
    const item = list.find(i=>i.id === this.drag.id);
    if(!item) return;

    if(this.drag.mode === "move"){
      if(!this.drag.started){
        this.onMutate(()=>{}, { commit:true });
        this.drag.started = true;
      }
      this.onMutate((draft)=>{
        const l = (this.drag.type === "wall" ? draft.walls :
          this.drag.type === "zone" ? draft.zones :
          this.drag.type === "prop" ? draft.props :
          this.drag.type === "player" ? draft.spawns.player :
          this.drag.type === "zombie" ? draft.spawns.zombie :
          draft.lights);
        const it = l.find(i=>i.id === this.drag.id);
        if(!it) return;
        it.x = snapPos.x;
        it.y = snapPos.y;
      }, { commit:false });
      this.render();
      return;
    }

    if(this.drag.mode === "resize"){
      if(!this.drag.started){
        this.onMutate(()=>{}, { commit:true });
        this.drag.started = true;
      }
      const start = this.drag.startWorld || { x:item.x, y:item.y };
      const dx = snapPos.x - start.x;
      const dy = snapPos.y - start.y;
      const w = Math.abs(dx) * 2 || 1;
      const h = Math.abs(dy) * 2 || 1;
      const cx = (start.x + snapPos.x) / 2;
      const cy = (start.y + snapPos.y) / 2;
      this.onMutate((draft)=>{
        const l = (this.drag.type === "wall" ? draft.walls : draft.zones);
        const it = l.find(i=>i.id === this.drag.id);
        if(!it) return;
        it.x = cx;
        it.y = cy;
        it.w = w;
        it.h = h;
      }, { commit:false });
      this.render();
    }
  }

  onMouseUp(){
    if(this.drag){
      this.drag = null;
    }
  }

  onWheel(e){
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    const factor = dir > 0 ? 1.1 : 0.9;
    const before = this.screenToWorld(e.offsetX, e.offsetY);
    this.zoom = Math.min(60, Math.max(3, this.zoom * factor));
    const after = this.screenToWorld(e.offsetX, e.offsetY);
    this.pan.x += (after.x - before.x) * this.zoom;
    this.pan.y += -(after.y - before.y) * this.zoom;
    this.render();
  }

  rotateSelected(delta){
    const { mapData, selected } = this.getState();
    if(!selected) return;
    if(selected.type !== "wall" && selected.type !== "prop" && selected.type !== "player") return;
    const list = (selected.type === "wall") ? mapData.walls :
      (selected.type === "prop") ? mapData.props :
      mapData.spawns.player;
    const item = list.find(i=>i.id === selected.id);
    if(!item) return;
    const next = radToDeg(degToRad(item.rot || 0) + degToRad(delta));
    this.onMutate((draft)=>{
      const l = (selected.type === "wall") ? draft.walls :
        (selected.type === "prop") ? draft.props :
        draft.spawns.player;
      const it = l.find(i=>i.id === selected.id);
      if(it) it.rot = next;
    }, { commit:true });
    this.render();
  }
}
