// game/zm/zombies/zombieLogic.js (CommonJS)
// Server-authoritative zombie AI + wave state.

function createZombieLogic(ctx){
  const {
    zombies,
    players,
    ARENA,
    PLAYER,
    ZOMBIE,
    DT,
    rand,
    uid,
    clamp,
    resolveObstacleCollisionsFor,
    nearestPlayer,
    broadcast,
    emitGameEvent,
    // shared round state accessors
    getWave,
    setWave,
    getBetweenRounds,
    setBetweenRounds,
    getZombiesTarget,
    setZombiesTarget,
    getZombiesSpawned,
    setZombiesSpawned,
    setZombiesKilled,
    getSpawnEveryMs,
    setSpawnEveryMs,
    getLastSpawnAt,
    setLastSpawnAt,
    setRoundStartAt,
    onPlayerDeathDefault,
  } = ctx;

  function spawnZombie(){
    const wave = getWave();
    const zombiesTarget = getZombiesTarget();
    const zombiesSpawned = getZombiesSpawned();

    const edge = Math.floor(Math.random() * 4);
    const s = ARENA.size / 2 + 4;
    let x = 0, z = 0;
    if (edge === 0){ x = rand(-s, s); z = -s; }
    if (edge === 1){ x = s; z = rand(-s, s); }
    if (edge === 2){ x = rand(-s, s); z = s; }
    if (edge === 3){ x = -s; z = rand(-s, s); }

    const hp = ZOMBIE.hpBase + wave * 14;
    const speed = ZOMBIE.speed + wave * 0.06 + (Math.random() < Math.min(0.18, 0.05 + wave * 0.01) ? 0.9 : 0);
    const ent = { id: uid(), type: 'zombie', x, y: 0, z, hp, speed };
    zombies.push(ent);

    emitGameEvent && emitGameEvent('onZombieSpawn', {
      zombie: { ...ent },
      wave,
      zombiesTarget,
      zombiesSpawned,
      zombiesAlive: zombies.length,
    });

    // lightweight debug
    if (zombiesSpawned === 1 || zombiesSpawned % 5 === 0){
      // eslint-disable-next-line no-console
      console.log(`[wave ${wave}] spawned ${zombiesSpawned}/${zombiesTarget} (alive ${zombies.length})`);
    }
  }

  function updateZombies(){
    const wave = getWave();
    for (const z of zombies){
      const target = nearestPlayer(z.x, z.z);
      if (!target) continue;

      const dx = target.x - z.x;
      const dz = target.z - z.z;
      const d = Math.hypot(dx, dz) || 1e-6;
      z.x += (dx / d) * z.speed * DT;
      z.z += (dz / d) * z.speed * DT;

      // obstacle collision
      resolveObstacleCollisionsFor(z, ZOMBIE.radius);

      // attack if close
      const dist = Math.hypot(target.x - z.x, target.z - z.z);
      if (dist < (PLAYER.radius + ZOMBIE.radius + 0.25)){
        const now = Date.now();
        if (now >= target.nextHitAt){
          // still throttle even in god mode
          target.nextHitAt = now + (target.godMode ? 250 : 650);
          if (target.godMode) continue;

          const dmg = 10 + Math.floor(wave * 0.4);
          const reduced = dmg * (1 - (target.armor || 0));
          target.hp = clamp(target.hp - reduced, 0, 100);

          emitGameEvent && emitGameEvent('onPlayerDamaged', {
            playerId: target.id,
            player: { id: target.id, x: target.x, y: target.y, z: target.z, hp: target.hp, cash: target.cash },
            damage: reduced,
            cause: 'zombie',
            wave,
          });

          broadcast({ type: 'phit', id: target.id, hp: target.hp });

          if (target.hp <= 0){
            emitGameEvent && emitGameEvent('onPlayerDeath', {
              playerId: target.id,
              player: { id: target.id, x: target.x, y: target.y, z: target.z, hp: 0, cash: target.cash },
              cause: 'zombie',
              wave,
            });
            broadcast({ type: 'pdown', id: target.id });

            // Default behavior (can be overridden by scripts, but this keeps core playable).
            if (typeof onPlayerDeathDefault === 'function'){
              try { onPlayerDeathDefault(target.id, 'zombie'); } catch (e) { /* ignore */ }
            }
          }
        }
      }
    }
  }

  function startNextWave(){
    if (!getBetweenRounds()) return;
    const wave = getWave();
    setBetweenRounds(false);
    setRoundStartAt(Date.now());

    const zombiesTarget = Math.max(8, Math.floor(8 + (Number(wave) || 1) * 2.4));
    setZombiesTarget(zombiesTarget);
    setSpawnEveryMs(clamp(760 - wave * 18, 280, 760));

    setZombiesSpawned(0);
    setZombiesKilled(0);
    setLastSpawnAt(0);

    // eslint-disable-next-line no-console
    console.log(`\n== Wave ${wave} START == target=${zombiesTarget} spawnEveryMs=${getSpawnEveryMs()}`);

    emitGameEvent && emitGameEvent('onRoundStart', { wave, zombiesTarget });
    broadcast({ type: 'round', between: false, wave, zombiesTarget });
  }

  function endWave(){
    if (getBetweenRounds()) return;
    const wave = getWave();
    const zombiesTarget = getZombiesTarget();
    const zombiesSpawned = getZombiesSpawned();

    setBetweenRounds(true);
    emitGameEvent && emitGameEvent('onRoundEnd', { wave, zombiesTarget, zombiesSpawned });

    const nextWave = wave + 1;
    setWave(nextWave);
    broadcast({ type: 'round', between: true, wave: nextWave, zombiesTarget: 0 });
  }

  function spawnLogic(){
    if (getBetweenRounds()) return;
    const zombiesSpawned = getZombiesSpawned();
    const zombiesTarget = getZombiesTarget();
    if (zombiesSpawned >= zombiesTarget) return;

    const now = Date.now();
    const last = getLastSpawnAt();
    const every = getSpawnEveryMs();
    if (now - last < every) return;

    setLastSpawnAt(now);
    setZombiesSpawned(zombiesSpawned + 1);
    spawnZombie();
  }

  return { spawnZombie, updateZombies, startNextWave, endWave, spawnLogic };
}

module.exports = { createZombieLogic };
