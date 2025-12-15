// game/zm/scripts/events.js
// Optional server-side JS event handlers.
// If this file is missing or throws, the game should still run.

module.exports = {
  // Game lifecycle
  onGameStart: (_e) => {},
  onGameEnd: (_e) => {},

  // Round lifecycle
  onRoundStart: (_e) => {},
  onRoundEnd: (_e) => {},

  // Zombie lifecycle
  onZombieSpawn: (_e) => {},
  onZombieDamaged: (_e) => {},
  onZombieDeath: (_e) => {},

  // Player lifecycle
  onPlayerConnect: (_e) => {},
  onPlayerSpawned: (_e) => {},
  onPlayerDamaged: (_e) => {},
  onPlayerDeath: (_e) => {},
};
