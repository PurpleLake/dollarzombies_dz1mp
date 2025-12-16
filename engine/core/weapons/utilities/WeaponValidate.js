export function validateWeaponDef(def){
  const req = ["id","name","damage","range","dropoff","ammoClip","ammoMag","model","attributes"];
  for(const k of req){
    if(!(k in def)) throw new Error(`WeaponDef missing '${k}' for id=${def?.id ?? "unknown"}`);
  }
  if(typeof def.id !== "string" || !def.id.trim()) throw new Error("WeaponDef.id must be non-empty string");
  if(typeof def.damage !== "number" || def.damage <= 0) throw new Error(`WeaponDef.damage invalid for ${def.id}`);
  if(typeof def.range !== "number" || def.range <= 0) throw new Error(`WeaponDef.range invalid for ${def.id}`);
  if(typeof def.dropoff !== "number" || def.dropoff < 0 || def.dropoff > 1) throw new Error(`WeaponDef.dropoff must be 0..1 for ${def.id}`);
  if(!Number.isFinite(def.ammoClip) || def.ammoClip < 1) throw new Error(`WeaponDef.ammoClip invalid for ${def.id}`);
  if(!Number.isFinite(def.ammoMag) || def.ammoMag < def.ammoClip) throw new Error(`WeaponDef.ammoMag invalid for ${def.id}`);
  if(typeof def.model !== "string") throw new Error(`WeaponDef.model invalid for ${def.id}`);
  if(!Array.isArray(def.attributes)) throw new Error(`WeaponDef.attributes must be array for ${def.id}`);
  if("pellets" in def){
  if(!Number.isFinite(def.pellets) || def.pellets < 1) throw new Error(`WeaponDef.pellets invalid for ${def.id}`);
}
if("spreadRad" in def){
  if(typeof def.spreadRad !== "number" || def.spreadRad < 0) throw new Error(`WeaponDef.spreadRad invalid for ${def.id}`);
}
if("aoeRadius" in def){
  if(typeof def.aoeRadius !== "number" || def.aoeRadius <= 0) throw new Error(`WeaponDef.aoeRadius invalid for ${def.id}`);
  if(typeof def.aoeDamageMul !== "number" || def.aoeDamageMul < 0 || def.aoeDamageMul > 1) throw new Error(`WeaponDef.aoeDamageMul must be 0..1 for ${def.id}`);
}
return true;

}
