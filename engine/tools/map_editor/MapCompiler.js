function isFiniteNumber(n){
  return Number.isFinite(Number(n));
}

function toNumber(n, def=0){
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function parseColorHex(color, fallback=0xffffff){
  if(typeof color === "number" && Number.isFinite(color)) return color;
  const s = String(color || "").trim();
  if(!s) return fallback;
  if(s.startsWith("#")){
    const hex = s.slice(1);
    const num = parseInt(hex, 16);
    return Number.isFinite(num) ? num : fallback;
  }
  const num = parseInt(s, 16);
  return Number.isFinite(num) ? num : fallback;
}

function degToRad(deg){
  return (Number(deg || 0) * Math.PI) / 180;
}

function centerFromBounds(bounds){
  const minX = toNumber(bounds?.minX, -25);
  const minY = toNumber(bounds?.minY, -25);
  const maxX = toNumber(bounds?.maxX, 25);
  const maxY = toNumber(bounds?.maxY, 25);
  return {
    minX, minY, maxX, maxY,
    sizeX: Math.max(1, Math.abs(maxX - minX)),
    sizeY: Math.max(1, Math.abs(maxY - minY)),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function ensureMapCtx(engine, mode, name){
  const map = engine.ctx.map || {};
  engine.ctx.map = {
    ...map,
    mode: mode || map.mode || "zm",
    map: name || map.map || "dzmap",
    playerSpawns: [],
    zombieSpawns: [],
    mpSpawnsTeam0: [],
    mpSpawnsTeam1: [],
    zones: [],
    colliders: [],
  };
  return engine.ctx.map;
}

function clearDzmapEntities(ctx){
  const ents = ctx.entities?.getByTag?.("dzmap-prop") || [];
  for(const ent of ents){
    try { ctx.entities?.deleteEntity?.(ent); } catch {}
  }
}

export class MapCompiler {
  constructor(engine){
    this.engine = engine;
    this._texCache = new Map();
    this._texLoader = null;
  }

  _getTexture(url){
    if(!url) return null;
    const key = String(url);
    if(this._texCache.has(key)) return this._texCache.get(key);
    const THREE = this.engine?.ctx?.renderer?.THREE;
    if(!THREE) return null;
    if(!this._texLoader) this._texLoader = new THREE.TextureLoader();
    const tex = this._texLoader.load(key);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this._texCache.set(key, tex);
    return tex;
  }

  compile(dzmapData, { mode="zm", clearWorld=true, mapDef=null } = {}){
    if(!dzmapData || dzmapData.format !== "dzmap"){
      throw new Error("Invalid dzmap data");
    }

    const engine = this.engine;
    const ctx = engine.ctx;
    const world = ctx.world || ctx.worldBuilder;
    const bounds = centerFromBounds(dzmapData.bounds || {});

    if(clearWorld){
      try { world?.clearWorld?.(); } catch {}
      clearDzmapEntities(ctx);
    }

    const mapCtx = ensureMapCtx(engine, mode, dzmapData.meta?.name);
    if(mapDef){
      mapCtx.id = mapDef.id || mapCtx.map;
      mapCtx.root = mapDef.root || mapCtx.root;
      mapCtx.def = mapDef;
    }
    mapCtx.bounds = {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    };
    mapCtx.zones = [];
    mapCtx.colliders = [];

    // Floor + bounds
    if(world?.addFloor){
      const floorColor = parseColorHex(dzmapData.floor?.color, 0x0c1222);
      const floor = world.addFloor({
        size: Math.max(bounds.sizeX, bounds.sizeY),
        color: floorColor,
        roughness: toNumber(dzmapData.floor?.roughness, 0.95),
        metalness: toNumber(dzmapData.floor?.metalness, 0.0),
      });
      if(floor?.position?.set){
        floor.position.set(bounds.centerX, 0, bounds.centerY);
      }
    }
    if(world?.addWallBox){
      const wallHeight = 2.6;
      const thickness = 0.6;
      const halfX = bounds.sizeX / 2;
      const halfY = bounds.sizeY / 2;
      const cx = bounds.centerX;
      const cy = bounds.centerY;
      world.addWallBox({ width: bounds.sizeX, height: wallHeight, depth: thickness, x: cx, y: wallHeight/2, z: cy - halfY });
      world.addWallBox({ width: bounds.sizeX, height: wallHeight, depth: thickness, x: cx, y: wallHeight/2, z: cy + halfY });
      world.addWallBox({ width: thickness, height: wallHeight, depth: bounds.sizeY, x: cx - halfX, y: wallHeight/2, z: cy });
      world.addWallBox({ width: thickness, height: wallHeight, depth: bounds.sizeY, x: cx + halfX, y: wallHeight/2, z: cy });
      mapCtx.colliders.push(
        { type:"box", x:cx, y:0, z:cy-halfY, sx:bounds.sizeX, sy:wallHeight, sz:thickness, rot:0 },
        { type:"box", x:cx, y:0, z:cy+halfY, sx:bounds.sizeX, sy:wallHeight, sz:thickness, rot:0 },
        { type:"box", x:cx-halfX, y:0, z:cy, sx:thickness, sy:wallHeight, sz:bounds.sizeY, rot:0 },
        { type:"box", x:cx+halfX, y:0, z:cy, sx:thickness, sy:wallHeight, sz:bounds.sizeY, rot:0 },
      );
    }

    // Walls
    const walls = Array.isArray(dzmapData.walls) ? dzmapData.walls : [];
    for(const w of walls){
      if(!isFiniteNumber(w?.x) || !isFiniteNumber(w?.y) || !isFiniteNumber(w?.w) || !isFiniteNumber(w?.h)) continue;
      const wallHeight = toNumber(w?.height, 2.6);
      const mesh = world?.addWallBox?.({
        width: Math.abs(Number(w.w)),
        height: wallHeight,
        depth: Math.abs(Number(w.h)),
        x: Number(w.x),
        y: wallHeight / 2,
        z: Number(w.y),
      });
      if(mesh?.rotation){
        mesh.rotation.y = degToRad(w.rot || 0);
      }
      const wallTexture = w.material?.texture;
      if(mesh?.material && wallTexture){
        const tex = this._getTexture(String(wallTexture));
        if(tex){
          mesh.material.map = tex;
          mesh.material.needsUpdate = true;
        }
      }
      mapCtx.colliders.push({
        type: "box",
        x: Number(w.x || 0),
        y: 0,
        z: Number(w.y || 0),
        sx: Math.abs(Number(w.w || 1)),
        sy: wallHeight,
        sz: Math.abs(Number(w.h || 1)),
        rot: Number(w.rot || 0),
      });
    }

    // Props
    const props = Array.isArray(dzmapData.props) ? dzmapData.props : [];
    for(const p of props){
      if(!isFiniteNumber(p?.x) || !isFiniteNumber(p?.y)) continue;
      const scale = Number(p.scale || 1);
      const kind = String(p.kind || (p.model ? "model" : "box"));
      const sx = toNumber(p.sx, scale);
      const sy = toNumber(p.sy, (kind === "tile" ? 0.08 : scale));
      const sz = toNumber(p.sz, scale);
      const rTop = toNumber(p.rTop, scale * 0.35);
      const rBottom = toNumber(p.rBottom, scale * 0.35);
      const h = toNumber(p.h, scale);
      const r = toNumber(p.r, scale * 0.5);
      const height = (kind === "sphere") ? (r) : (kind === "cylinder" ? h : (kind === "tile" ? sy : sy));
      const baseY = Number(p.z || 0);
      const pos = { x: Number(p.x), y: baseY + height * 0.5, z: Number(p.y) };
      const color = parseColorHex(p.material?.color, 0x6a4a2c);

      if(ctx.entities?.spawnEntity){
        if(kind === "model"){
          ctx.entities.spawnEntity("model", pos, {
            model: p.model,
            scale,
            texture: p.material?.texture,
            tag: "dzmap-prop",
          });
        } else if(kind === "sphere"){
          ctx.entities.spawnEntity("sphere", pos, {
            r,
            color,
            texture: p.material?.texture,
            tag: "dzmap-prop",
          });
        } else if(kind === "cylinder"){
          ctx.entities.spawnEntity("cylinder", pos, {
            rTop,
            rBottom,
            h,
            color,
            texture: p.material?.texture,
            tag: "dzmap-prop",
          });
        } else if(kind === "tile"){
          ctx.entities.spawnEntity("box", pos, {
            sx,
            sy,
            sz,
            color,
            texture: p.material?.texture,
            tag: "dzmap-prop",
          });
        } else {
          ctx.entities.spawnEntity("box", pos, {
            sx,
            sy,
            sz,
            color,
            texture: p.material?.texture,
            tag: "dzmap-prop",
          });
        }
      } else if(world?.addCrate){
        world.addCrate({
          x: Number(p.x),
          y: pos.y,
          z: Number(p.y),
          size: sx,
          color,
        });
      }

      if(p.collision !== false){
        const col = p.collider || {};
        const colType = String(col.type || kind || "box");
        if(colType === "sphere"){
          mapCtx.colliders.push({
            type: "sphere",
            x: Number(p.x || 0),
            y: baseY,
            z: Number(p.y || 0),
            r: Number(col.r || r),
          });
        } else if(colType === "cylinder"){
          mapCtx.colliders.push({
            type: "cylinder",
            x: Number(p.x || 0),
            y: baseY,
            z: Number(p.y || 0),
            rTop: Number(col.rTop || rTop),
            rBottom: Number(col.rBottom || rBottom),
            h: Number(col.h || h),
          });
        } else {
          mapCtx.colliders.push({
            type: "box",
            x: Number(p.x || 0),
            y: baseY,
            z: Number(p.y || 0),
            sx: Number(col.sx || sx),
            sy: Number(col.sy || sy),
            sz: Number(col.sz || sz),
            rot: Number(p.rot || 0),
          });
        }
      }
    }

    // Lights
    const lights = Array.isArray(dzmapData.lights) ? dzmapData.lights : [];
    for(const l of lights){
      if(!isFiniteNumber(l?.x) || !isFiniteNumber(l?.y)) continue;
      world?.addLight?.({
        type: String(l.kind || "point"),
        color: parseColorHex(l.color, 0xffffff),
        intensity: toNumber(l.intensity, 1),
        position: { x:Number(l.x), y: toNumber(l.z, 4), z:Number(l.y) },
        distance: toNumber(l.range, 40),
        castShadow: true,
      });
    }

    // Spawns
    const spawns = dzmapData.spawns || {};
    const playerSpawns = Array.isArray(spawns.player) ? spawns.player : [];
    const zombieSpawns = Array.isArray(spawns.zombie) ? spawns.zombie : [];

    if(mode === "mp"){
      const team0 = [];
      const team1 = [];
      for(const s of playerSpawns){
        if(!isFiniteNumber(s?.x) || !isFiniteNumber(s?.y)) continue;
        const entry = { x:Number(s.x), y: toNumber(s.z, 1.2), z:Number(s.y), rot: toNumber(s.rot, 0) };
        if(String(s.team || "").toUpperCase() === "B") team1.push(entry);
        else team0.push(entry);
      }
      mapCtx.mpSpawnsTeam0 = team0;
      mapCtx.mpSpawnsTeam1 = team1;
    } else {
      mapCtx.playerSpawns = playerSpawns
        .filter(s=>isFiniteNumber(s?.x) && isFiniteNumber(s?.y))
        .map(s=>({ x:Number(s.x), y: toNumber(s.z, 1.2), z:Number(s.y), rot: toNumber(s.rot, 0) }));
      mapCtx.zombieSpawns = zombieSpawns
        .filter(s=>isFiniteNumber(s?.x) && isFiniteNumber(s?.y))
        .map(s=>({ x:Number(s.x), y: toNumber(s.z, 1.2), z:Number(s.y) }));
    }

    // Zones (store in map ctx)
    const zones = Array.isArray(dzmapData.zones) ? dzmapData.zones : [];
    for(const z of zones){
      if(!isFiniteNumber(z?.x) || !isFiniteNumber(z?.y) || !isFiniteNumber(z?.w) || !isFiniteNumber(z?.h)) continue;
      mapCtx.zones.push({
        id: String(z.id || ""),
        name: String(z.name || ""),
        x: Number(z.x),
        y: Number(z.y),
        w: Number(z.w),
        h: Number(z.h),
      });
    }

    return {
      mapCtx,
      spawnPoints: {
        players: mapCtx.playerSpawns,
        zombies: mapCtx.zombieSpawns,
        teamA: mapCtx.mpSpawnsTeam0,
        teamB: mapCtx.mpSpawnsTeam1,
      }
    };
  }
}

export function dzmapToDzs(dzmapData){
  if(!dzmapData || dzmapData.format !== "dzmap") return "// Invalid dzmap";
  const lines = [];
  lines.push("// Generated from .dzmap");
  lines.push("on zm:build {");
  lines.push("  worldClear");
  lines.push("  addFloor 60");
  lines.push("  addWalls 60 3");
  const walls = Array.isArray(dzmapData.walls) ? dzmapData.walls : [];
    for(const w of walls){
      const wallHeight = toNumber(w?.height, 2.6);
      lines.push(`  spawnEntity box {x:${Number(w.x||0)},y:${wallHeight/2},z:${Number(w.y||0)}} {sx:${Number(w.w||1)},sy:${wallHeight},sz:${Number(w.h||1)},tag:wall}`);
    }
  const props = Array.isArray(dzmapData.props) ? dzmapData.props : [];
  for(const p of props){
    lines.push(`  spawnEntity box {x:${Number(p.x||0)},y:0.5,z:${Number(p.y||0)}} {sx:${Number(p.scale||1)},sy:${Number(p.scale||1)},sz:${Number(p.scale||1)},tag:prop}`);
  }
  const players = dzmapData.spawns?.player || [];
  if(players[0]){
    lines.push(`  setPlayerSpawn ${Number(players[0].x||0)} ${Number(players[0].y||0)}`);
  }
  const zombies = dzmapData.spawns?.zombie || [];
  for(const s of zombies){
    lines.push(`  addZombieSpawn ${Number(s.x||0)} ${Number(s.y||0)}`);
  }
  lines.push("}");
  return lines.join("\n");
}
