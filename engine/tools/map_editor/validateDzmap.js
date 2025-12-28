function isFiniteNumber(n){
  return Number.isFinite(Number(n));
}

function pointInRect(px, py, r){
  const halfW = Math.abs(Number(r.w || 0)) / 2;
  const halfH = Math.abs(Number(r.h || 0)) / 2;
  return (
    px >= Number(r.x) - halfW &&
    px <= Number(r.x) + halfW &&
    py >= Number(r.y) - halfH &&
    py <= Number(r.y) + halfH
  );
}

export function validateDzmap(dzmap){
  const errors = [];
  const warnings = [];

  if(!dzmap || dzmap.format !== "dzmap"){
    errors.push("Missing format: dzmap");
    return { errors, warnings };
  }
  if(!isFiniteNumber(dzmap.version)){
    errors.push("Missing or invalid version");
  }

  const bounds = dzmap.bounds || {};
  if(!isFiniteNumber(bounds.minX) || !isFiniteNumber(bounds.minY) || !isFiniteNumber(bounds.maxX) || !isFiniteNumber(bounds.maxY)){
    errors.push("Bounds missing numeric minX/minY/maxX/maxY");
  } else if(bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY){
    errors.push("Bounds min must be less than max");
  }

  const modes = (dzmap.meta?.modes && Array.isArray(dzmap.meta.modes)) ? dzmap.meta.modes.map(m=>String(m).toUpperCase()) : [];
  const isMp = modes.includes("MP");
  const isZm = modes.includes("ZM") || modes.includes("SOLO") || modes.length === 0;

  const playerSpawns = dzmap.spawns?.player || [];
  const zombieSpawns = dzmap.spawns?.zombie || [];

  if(isZm && (!Array.isArray(playerSpawns) || playerSpawns.length < 1)){
    errors.push("At least 1 player spawn required for ZM/SOLO");
  }
  if(isMp && Array.isArray(playerSpawns) && playerSpawns.length < 8){
    warnings.push("MP maps should have at least 8 player spawns");
  }
  if(isZm && (!Array.isArray(zombieSpawns) || zombieSpawns.length === 0)){
    warnings.push("ZM maps should include zombie spawns");
  }

  const walls = Array.isArray(dzmap.walls) ? dzmap.walls : [];
  const props = Array.isArray(dzmap.props) ? dzmap.props : [];

  for(const s of playerSpawns){
    if(!isFiniteNumber(s?.x) || !isFiniteNumber(s?.y)) errors.push(`Player spawn ${s?.id || ""} has invalid coords`);
    for(const w of walls){
      if(pointInRect(Number(s.x||0), Number(s.y||0), w)){
        warnings.push(`Player spawn ${s?.id || ""} is inside a wall`);
        break;
      }
    }
  }
  for(const s of zombieSpawns){
    if(!isFiniteNumber(s?.x) || !isFiniteNumber(s?.y)) errors.push(`Zombie spawn ${s?.id || ""} has invalid coords`);
    for(const w of walls){
      if(pointInRect(Number(s.x||0), Number(s.y||0), w)){
        warnings.push(`Zombie spawn ${s?.id || ""} is inside a wall`);
        break;
      }
    }
  }

  if(bounds && isFiniteNumber(bounds.minX)){
    for(const p of props){
      if(!isFiniteNumber(p?.x) || !isFiniteNumber(p?.y)) continue;
      if(p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY){
        warnings.push(`Prop ${p?.id || ""} is outside bounds`);
      }
    }
  }

  // Check stable IDs
  const idSets = [
    { name:"walls", list:walls },
    { name:"props", list:props },
    { name:"lights", list:dzmap.lights || [] },
    { name:"zones", list:dzmap.zones || [] },
    { name:"player spawns", list:playerSpawns },
    { name:"zombie spawns", list:zombieSpawns },
  ];
  for(const group of idSets){
    const seen = new Set();
    for(const item of group.list){
      const id = String(item?.id || "");
      if(!id) errors.push(`${group.name} missing id`);
      if(seen.has(id)) errors.push(`${group.name} duplicate id: ${id}`);
      seen.add(id);
    }
  }

  for(const w of walls){
    if(w?.height != null && !isFiniteNumber(w.height)){
      errors.push(`Wall ${w?.id || ""} has invalid height`);
    }
  }

  return { errors, warnings };
}
