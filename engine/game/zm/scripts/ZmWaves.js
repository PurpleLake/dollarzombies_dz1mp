export class ZmWaves {
  constructor({ engine }){
    this.engine = engine;
    this.wave = 0;
    this.target = 10;
    this.spawnEveryMs = 900;
    this._spawnTimer = 0;
    this._spawnedThisWave = 0;
    this._running = false;
  }

  setTarget(n){ this.target = Math.max(1, Math.floor(n)); }
  setSpawnEveryMs(ms){ this.spawnEveryMs = Math.max(80, Math.floor(ms)); }

  startWave(n){
    this.wave = n;
    this._spawnTimer = 0;
    this._spawnedThisWave = 0;
    this._running = true;
    this.engine.events.emit("zm:wave", { wave: this.wave });
    this.engine.events.emit("zm:waveStart", { wave: this.wave, target: this.target });
  }

  tick(dt, ecs, ctx){
    if(!this._running) return;

    // update alive
    const alive = ctx.game?.zombies?.aliveCount() ?? 0;
    this.engine.events.emit("zm:alive", { alive });

    this._spawnTimer += dt * 1000;

    if(this._spawnedThisWave < this.target && this._spawnTimer >= this.spawnEveryMs){
      this._spawnTimer = 0;
      this._spawnedThisWave++;
      ctx.game?.zombies?.spawnOne();
    }

    // Wave completion: all spawned + all dead
    if(this._spawnedThisWave >= this.target && alive === 0){
      this.engine.events.emit("zm:waveEnd", { wave: this.wave });
      this.startWave(this.wave + 1);
    }
  }
}
