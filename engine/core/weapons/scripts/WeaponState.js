export function makeWeaponState(def){
  return {
    id: def.id,
    clip: def.ammoClip,
    reserve: Math.max(0, def.ammoMag - def.ammoClip),
    lastShotAt: 0,
  };
}
