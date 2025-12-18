# GSC-Style Scripting (DZS)

This build adds a GSC-style layer on top of DZS so custom modes can use `self`, `level`, threads, and signals safely.

## Core concepts

- `self` is entity-scoped for the current thread (player/zombie/etc).
- `level` is match-scoped and shared across scripts.
- `self.someVar = x` and `level.someVar = x` write to script-owned JSON-ish stores, not engine objects.

## Threads

Start background threads on an entity or on the level:

```dzs
on onGameStart {
  level thread modeController()
}

on onPlayerSpawned {
  self thread playerLoop()
}
```

If you pass args, they show up in the new thread as `event.args`.

## Signals: notify / waittill / endon

- `notify "signal" ...args` emits a signal (defaults to `self` if present, else `level`).
- `waittill "signal"` pauses the current thread until the signal fires (returns args array).
- `endon "signal"` kills the current thread when the signal fires.

```dzs
playerLoop(){
  endon "disconnect"
  while(true){
    waittill "death"
    iPrintLnAll ^1Player died.
  }
}
```

## Time and safety

- `wait` uses seconds (`wait 0.5` = 500ms).
- Threads are budgeted per yield to avoid runaway scripts.
- `waittill` has a depth limit to avoid unbounded waits.

## Server-only builtins

Gameplay-affecting builtins are gated to the host/server. On non-host clients they no-op and log:

```
[dzs] server-only builtin: <name>
```

This keeps multiplayer deterministic.

## Sample template

Use the template at `public/scripts/gsc_sample.dzs` or open the Dev menu (DZS Help) to copy/download it.
