import fs from "fs";
import { DZMAP_VERSION, buildTagMask } from "./dzmapFormat.js";

export function writeDzmap(scene, outPath){
  const prefabs = [];
  const tagRegistry = [];
  function prefabIndex(key){
    let idx = prefabs.indexOf(key);
    if(idx === -1){ prefabs.push(key); idx = prefabs.length-1; }
    return idx;
  }
  function addTags(tags){ for(const t of tags||[]){ if(!tagRegistry.includes(t)) tagRegistry.push(t); } }

  const objects = [];
  const colliders = [];
  const lights = [];
  const spawns = { player:null, zombies: [] };
  const bounds = [Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];

  for(const obj of scene.objects||[]){
    addTags(obj.tags);
    const pIdx = prefabIndex(obj.prefab || "unknown");
    const pos = obj.position||{}; const rot=obj.rotation||{}; const scl=obj.scale||{x:1,y:1,z:1};
    bounds[0] = Math.min(bounds[0], pos.x||0); bounds[1] = Math.min(bounds[1], pos.y||0); bounds[2] = Math.min(bounds[2], pos.z||0);
    bounds[3] = Math.max(bounds[3], pos.x||0); bounds[4] = Math.max(bounds[4], pos.y||0); bounds[5] = Math.max(bounds[5], pos.z||0);
    const flags = (
      (obj.type === "static" ? 1:0) |
      ((obj.collider?.enabled)?2:0) |
      (obj.type === "trigger" ? 4:0) |
      8 // visible
    );
    const tagMask = buildTagMask(obj.tags||[], tagRegistry);
    objects.push([pIdx, pos.x||0,pos.y||0,pos.z||0, rot.x||0,rot.y||0,rot.z||0, scl.x||1,scl.y||1,scl.z||1, flags, tagMask]);
    if(obj.collider?.enabled){
      const shape = obj.collider.shape||"box";
      const idx = objects.length-1;
      if(shape === "sphere") colliders.push([2, idx, obj.collider.radius||0.5,0,0,0,0,0]);
      else if(shape === "capsule") colliders.push([3, idx, obj.collider.radius||0.5, obj.collider.height||1,0,0,0,0]);
      else {
        const sz = obj.collider.size||{};
        colliders.push([1, idx, sz.x||1, sz.y||1, sz.z||1,0,0,0]);
      }
    }
    if(obj.type === "light"){
      lights.push([pos.x||0,pos.y||0,pos.z||0, obj.custom?.intensity||1, obj.custom?.range||6, obj.custom?.color||0xffffff]);
    }
    if(obj.type === "spawn"){
      if(obj.prefab === "player_spawn" && !spawns.player){ spawns.player = [pos.x||0,pos.y||0,pos.z||0, rot.y||0]; }
      if(obj.prefab === "zombie_spawn"){ spawns.zombies.push([pos.x||0,pos.y||0,pos.z||0, obj.custom?.typeId||0, obj.custom?.weight||1]); }
    }
  }
  const out = {
    v: DZMAP_VERSION,
    name: scene.name || "map",
    bounds: bounds.map(v=> Number.isFinite(v)?v:0),
    prefabs,
    objects,
    colliders,
    spawns,
    lights,
  };
  fs.writeFileSync(outPath, JSON.stringify(out));
  return out;
}
