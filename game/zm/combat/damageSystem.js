// game/zm/combat/damageSystem.js (CommonJS)
// Centralized damage calculation for Zombies mode.
//
// This module exists so damage rules are not scattered across zmServer/zombieLogic.
// It uses the normalized weapon definition fields:
//   - damage
//   - range
//   - rangeDropOff { start, end, closeDamage, farDamage }
//

function clamp(v, a, b){
  return Math.max(a, Math.min(b, v));
}

function toNumber(x, fallback){
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Compute damage for a single hit.
 * @param {object} w Weapon definition (from game/zm/weapons)
 * @param {'body'|'head'|string} part Hit part
 * @param {number} dist Distance to hit
 * @param {object} [opts]
 * @param {number} [opts.headshotMult=2.0]
 */
function computeWeaponDamage(w, part, dist, opts){
  const headshotMult = toNumber(opts?.headshotMult, 2.0);

  // Fallbacks (older defs may still rely on dmgClose/dmgFar)
  const fallbackClose = (w?.dmgClose != null) ? toNumber(w.dmgClose, 20) : toNumber(w?.damage, 20);
  const fallbackRange = Math.max(1, toNumber(w?.range, 50));
  const fallbackFar = (w?.dmgFar != null) ? toNumber(w.dmgFar, Math.max(1, Math.round(fallbackClose * 0.65)))
                                         : Math.max(1, Math.round(fallbackClose * 0.65));

  const drop = w?.rangeDropOff || {
    start: Math.round(fallbackRange * 0.35),
    end: fallbackRange,
    closeDamage: fallbackClose,
    farDamage: fallbackFar,
  };

  const start = clamp(toNumber(drop.start, 0), 0, 1e9);
  const end   = clamp(toNumber(drop.end, fallbackRange), start + 1e-6, 1e9);
  const close = Math.max(1, toNumber(drop.closeDamage, fallbackClose));
  const far   = Math.max(1, toNumber(drop.farDamage, fallbackFar));

  const d = Math.max(0, toNumber(dist, 0));
  let base;
  if (d <= start) base = close;
  else if (d >= end) base = far;
  else {
    const t = (d - start) / (end - start);
    base = close + (far - close) * t;
  }

  const mult = (part === 'head') ? headshotMult : 1.0;
  return Math.max(1, Math.round(base * mult));
}

module.exports = {
  computeWeaponDamage,
};
