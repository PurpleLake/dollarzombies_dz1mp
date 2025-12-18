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

    // Floor + bounds
    if(world?.addFloor){
      const floor = world.addFloor({ size: Math.max(bounds.sizeX, bounds.sizeY) });
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
    }

    // Walls
    const walls = Array.isArray(dzmapData.walls) ? dzmapData.walls : [];
    for(const w of walls){
      if(!isFiniteNumber(w?.x) || !isFiniteNumber(w?.y) || !isFiniteNumber(w?.w) || !isFiniteNumber(w?.h)) continue;
      const mesh = world?.addWallBox?.({
        width: Math.abs(Number(w.w)),
        height: 2.6,
        depth: Math.abs(Number(w.h)),
        x: Number(w.x),
        y: 1.3,
        z: Number(w.y),
      });
      if(mesh?.rotation){
        mesh.rotation.y = degToRad(w.rot || 0);
      }
    }

    // Props
    const props = Array.isArray(dzmapData.props) ? dzmapData.props : [];
    for(const p of props){
      if(!isFiniteNumber(p?.x) || !isFiniteNumber(p?.y)) continue;
      const type = String(p?.type || "crate");
      if(world?.addCrate){
        world.addCrate({
          x: Number(p.x),
          y: 0.5 * (Number(p.scale || 1)),
          z: Number(p.y),
          size: Number(p.scale || 1),
        });
        continue;
      }
      if(ctx.entities?.spawnEntity){
        ctx.entities.spawnEntity("box", { x:Number(p.x), y:0.5, z:Number(p.y) }, {
          sx: Number(p.scale || 1),
          sy: Number(p.scale || 1),
          sz: Number(p.scale || 1),
          tag: "dzmap-prop",
        });
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
        const entry = { x:Number(s.x), y:1.2, z:Number(s.y), rot: toNumber(s.rot, 0) };
        if(String(s.team || "").toUpperCase() === "B") team1.push(entry);
        else team0.push(entry);
      }
      mapCtx.mpSpawnsTeam0 = team0;
      mapCtx.mpSpawnsTeam1 = team1;
    } else {
      mapCtx.playerSpawns = playerSpawns
        .filter(s=>isFiniteNumber(s?.x) && isFiniteNumber(s?.y))
        .map(s=>({ x:Number(s.x), y:1.2, z:Number(s.y), rot: toNumber(s.rot, 0) }));
      mapCtx.zombieSpawns = zombieSpawns
        .filter(s=>isFiniteNumber(s?.x) && isFiniteNumber(s?.y))
        .map(s=>({ x:Number(s.x), y:1.2, z:Number(s.y) }));
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
    lines.push(`  spawnEntity box {x:${Number(w.x||0)},y:1.3,z:${Number(w.y||0)}} {sx:${Number(w.w||1)},sy:2.6,sz:${Number(w.h||1)},tag:wall}`);
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
