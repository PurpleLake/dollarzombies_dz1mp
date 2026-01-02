export function validateScene(scene){
  const errors = [];
  const ids = new Set();
  const objects = Array.isArray(scene?.objects) ? scene.objects : [];
  let playerSpawns = 0;
  let zombieSpawns = 0;
  for(const obj of objects){
    if(!obj.id){ errors.push({ id: obj.id, msg: "Missing id" }); }
    if(ids.has(obj.id)) errors.push({ id: obj.id, msg: "Duplicate id" });
    ids.add(obj.id);
    if(!isFinite(obj.position?.x)||!isFinite(obj.position?.y)||!isFinite(obj.position?.z)) errors.push({ id: obj.id, msg: "Invalid position" });
    if(obj.type === "spawn" && obj.prefab === "player_spawn") playerSpawns++;
    if(obj.type === "spawn" && obj.prefab === "zombie_spawn") zombieSpawns++;
    if(obj.collider){
      const sz = obj.collider.size || {};
      if(sz.x<=0||sz.y<=0||sz.z<=0) errors.push({ id: obj.id, msg: "Collider size must be >0" });
    }
  }
  if(playerSpawns !== 1) errors.push({ msg: "Exactly one player_spawn required" });
  if(zombieSpawns < 1) errors.push({ msg: "At least one zombie_spawn recommended" });
  return { ok: errors.length===0, errors };
}
