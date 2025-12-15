# Custom Scripts

Drop **optional** server-side JavaScript modules in this folder to hook game events.

Each file should export either:

- `module.exports = { onRoundStart(){}, ... }`, or
- `module.exports.default = { ... }`

All handlers are optional. Multiple scripts can define the same handler; they will run in filename order.

Supported handlers (current):
- onGameStart, onGameEnd
- onRoundStart, onRoundEnd
- onZombieSpawn, onZombieDamaged, onZombieDeath
- onPlayerConnect, onPlayerSpawned, onPlayerDamaged, onPlayerDeath
