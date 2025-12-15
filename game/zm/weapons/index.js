// game/zm/weapons/index.js
// Central weapon definitions for Zombies mode.
//
// Required attributes (requested):
//  - damage
//  - range
//  - clipMaxAmmo
//  - reserveMaxAmmo
//  - rangeDropOff
//  - recoilScale
//  - model
//
// Note: The combat pipeline currently uses dmgClose/dmgFar/spread/pellets/fireMs/etc.
// We keep those for compatibility while also providing the requested normalized fields.

function withDerivedFields(id, w){
  const clipMaxAmmo = w.mag;
  const reserveMaxAmmo = (typeof w.reserveMaxAmmo === 'number') ? w.reserveMaxAmmo : (clipMaxAmmo * 4);
  const range = w.range;
  const dmgClose = w.dmgClose;
  const dmgFar = w.dmgFar;

  return {
    ...w,

    // Requested normalized fields
    damage: (typeof w.damage === 'number') ? w.damage : dmgClose,
    range,
    clipMaxAmmo,
    reserveMaxAmmo,

    // How damage falls off over distance. Linear between start and end.
    // start/end are in world units (same as `range`).
    rangeDropOff: w.rangeDropOff || {
      start: Math.round(range * 0.35),
      end: range,
      closeDamage: dmgClose,
      farDamage: dmgFar,
    },

    recoilScale: (typeof w.recoilScale === 'number') ? w.recoilScale : 1.0,

    // Model identifier/path for future 3D weapon rendering.
    // (Not all weapons have real models yet; the client can fall back.)
    model: w.model || `/models/weapons/${id}.gltf`,
  };
}

const RAW_WEAPONS = {
  // --- Pistols (semi-auto) ---
  glock:    { name:"Glock",        slot:"pistol", mode:"semi", fireMs:180, dmgClose:20, dmgFar:14, spread:0.010, pellets:1, range:55, mag:17, reloadMs:1000, recoilScale:0.85 },
  p99:      { name:"P99",          slot:"pistol", mode:"semi", fireMs:160, dmgClose:20, dmgFar:14, spread:0.012, pellets:1, range:52, mag:15, reloadMs:1050, recoilScale:0.90 },
  fiveseven:{ name:"Five-Seven",   slot:"pistol", mode:"semi", fireMs:170, dmgClose:22, dmgFar:15, spread:0.011, pellets:1, range:58, mag:20, reloadMs:1150, recoilScale:0.95 },

  // --- Shotguns ---
  // Total close damage is dmgClose * pellets if most pellets land.
  shotgun_semi:{ name:"Shotgun (Semi)", slot:"primary", mode:"semi", fireMs:520, dmgClose:10, dmgFar:6, spread:0.080, pellets:7, range:22, mag:8,  reloadMs:1450, recoilScale:1.35 },
  shotgun_auto:{ name:"Shotgun (Auto)", slot:"primary", mode:"auto", fireMs:230, dmgClose:10, dmgFar:6, spread:0.090, pellets:7, range:20, mag:12, reloadMs:1600, recoilScale:1.55 },

  // --- Assault Rifles ---
  ar_burst: { name:"AR (Burst)", slot:"primary", mode:"burst", fireMs:320, burst:3, burstGapMs:65, dmgClose:34, dmgFar:22, spread:0.020, pellets:1, range:65, mag:30, reloadMs:1500, recoilScale:1.05 },
  ar_full:  { name:"AR (Full)",  slot:"primary", mode:"auto",  fireMs:95,  dmgClose:34, dmgFar:22, spread:0.024, pellets:1, range:62, mag:30, reloadMs:1550, recoilScale:1.10 },

  // --- DMR (semi-auto) ---
  dmr_5:    { name:"DMR (5-Round)", slot:"primary", mode:"semi", fireMs:260, dmgClose:60, dmgFar:42, spread:0.010, pellets:1, range:95, mag:5, reloadMs:1700, recoilScale:1.25 },

  // --- LMG ---
  mg42:     { name:"MG42", slot:"primary", mode:"auto", fireMs:65, dmgClose:27, dmgFar:18, spread:0.030, pellets:1, range:70, mag:75, reloadMs:2200, recoilScale:1.20 },
};

const WEAPONS = Object.fromEntries(
  Object.entries(RAW_WEAPONS).map(([id, w]) => [id, withDerivedFields(id, w)])
);

const PRIMARY_LIST = ["shotgun_semi","shotgun_auto","ar_burst","ar_full","dmr_5","mg42"];
const PISTOL_LIST  = ["glock","p99","fiveseven"];

function weaponStateFor(id){
  const w = WEAPONS[id];
  if (!w) return null;
  return {
    id,
    mag: w.mag,
    reserve: w.reserveMaxAmmo,
    reloading: false,
    reloadUntil: 0,
    nextFireAt: 0,
    burstLeft: 0,
    burstNextAt: 0,
  };
}

module.exports = {
  WEAPONS,
  PRIMARY_LIST,
  PISTOL_LIST,
  weaponStateFor,
};
