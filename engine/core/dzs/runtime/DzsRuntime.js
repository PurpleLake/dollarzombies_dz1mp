import { makeBuiltins, BUILTIN_DOCS } from "../builtins/dzsBuiltins.js";

const DEFAULT_MATCH_ID = "local";

export class DzsRuntime {
  constructor({ events, ctx }){
    this.events = events;
    this.ctx = ctx;
    this.builtins = makeBuiltins(ctx);
    this.builtinDocs = BUILTIN_DOCS;

    this.handlers = new Map(); // eventName -> Map<scriptId, lines>
    this._scripts = new Set();

    this._timers = new Map(); // id -> timer
    this._timerSeq = 1;
    this._timersByScript = new Map(); // scriptId -> Set<timerId>

    this._globals = new Map();
    this._playerVars = new Map(); // pid -> Map

    this._entityVars = new Map(); // matchId -> Map<entityId, Map>
    this._levelVars = new Map(); // matchId -> Map<key, val>

    this._threads = new Map(); // id -> thread
    this._threadSeq = 1;
    this._threadsByOwner = new Map(); // ownerKey -> Set<threadId>
    this._threadsByScript = new Map(); // scriptId -> Set<threadId>

    this._waiters = new Map(); // signalKey -> Set<{threadId, resolve}>
    this._endons = new Map(); // signalKey -> Set<threadId>

    this.maxOps = 20000; // per yield
    this.maxLineLen = 600;
    this.maxWaits = 256;
    this._warnAt = new Map(); // eventName -> lastMs

    this._nowMs = 0;
  }

  isServer(){
    const net = this.ctx?.net;
    const match = this.ctx?.matchSession;
    if(!net || !net.connected) return true;
    const hostId = match?.hostPlayerId;
    if(!hostId) return true;
    return String(net.clientId ?? "") === String(hostId);
  }

  _logServerOnly(name){
    this.events?.emit?.("log", { msg: `[dzs] server-only builtin: ${name}` });
  }

  _getMatchId(matchIdOverride){
    const raw = matchIdOverride ?? this.ctx?.matchSession?.matchId ?? this.ctx?.matchId ?? DEFAULT_MATCH_ID;
    return String(raw || DEFAULT_MATCH_ID);
  }

  _ownerKey(matchId, owner){
    return `${matchId}|${owner.type}|${owner.id}`;
  }

  _signalKey(matchId, scopeType, scopeId, signalName){
    return `${matchId}|${scopeType}|${scopeId}|${signalName}`;
  }

  clear(){
    this.unloadAll();
  }

  unloadAll(){
    for(const scriptId of Array.from(this._scripts)){
      this.unloadScript(scriptId);
    }
    this.handlers.clear();
    this._scripts.clear();
  }

  unloadScript(scriptId){
    const id = String(scriptId ?? "");
    if(!id) return;

    for(const [evt, map] of this.handlers){
      map.delete(id);
      if(map.size === 0) this.handlers.delete(evt);
    }

    const timers = this._timersByScript.get(id);
    if(timers){
      for(const tid of Array.from(timers)) this.clearTimer(tid);
      this._timersByScript.delete(id);
    }

    const threads = this._threadsByScript.get(id);
    if(threads){
      for(const tid of Array.from(threads)) this.cancelThread(tid, "scriptUnload");
      this._threadsByScript.delete(id);
    }

    this._scripts.delete(id);
  }

  resetBetweenGames(matchId){
    const mid = this._getMatchId(matchId);
    for(const t of Array.from(this._threads.values())){
      if(t.matchId === mid) this.cancelThread(t.id, "matchReset");
    }
    for(const [tid, timer] of Array.from(this._timers.entries())){
      if(timer.matchId === mid) this.clearTimer(tid);
    }
    const prefix = `${mid}|`;
    for(const key of Array.from(this._waiters.keys())){
      if(key.startsWith(prefix)) this._waiters.delete(key);
    }
    for(const key of Array.from(this._endons.keys())){
      if(key.startsWith(prefix)) this._endons.delete(key);
    }
    this._levelVars.delete(mid);
    this._entityVars.delete(mid);
  }

  clearEntityVars(matchId, entityId){
    const mid = this._getMatchId(matchId);
    const ents = this._entityVars.get(mid);
    if(ents) ents.delete(String(entityId));
  }

  loadText(text, filename="(dzs)", scriptId=null){
    const id = String(scriptId || filename);
    this._scripts.add(id);

    const lines = String(text || "").split(/\r?\n/);
    let i = 0;

    const err = (msg)=>{ throw new Error(`[dzs parse] ${filename}:${i+1} ${msg}`); };

    while(i < lines.length){
      let line = lines[i].trim();
      i++;
      if(!line || line.startsWith("//") || line.startsWith("#")) continue;

      // legacy: on eventName {
      let m = line.match(/^on\s+([a-zA-Z0-9:_-]+)\s*\{\s*$/);
      if(m){
        const name = m[1];
        const body = [];
        while(i < lines.length){
          const raw = lines[i];
          const t = raw.trim();
          i++;
          if(!t || t.startsWith("//") || t.startsWith("#")) continue;
          if(t === "}") break;
          body.push(raw);
        }
        this.on(name, body, id);
        continue;
      }

      // function style: name(){
      m = line.match(/^([A-Za-z_][\w]*)\s*\(\s*\)\s*\{\s*$/);
      if(m){
        const name = m[1];
        const body = [];
        while(i < lines.length){
          const raw = lines[i];
          const t = raw.trim();
          i++;
          if(!t || t.startsWith("//") || t.startsWith("#")) continue;
          if(t === "}") break;
          body.push(raw);
        }
        this.on(name, body, id);
        continue;
      }

      err(`Unknown statement: ${line}`);
    }
  }

  on(eventName, lines, scriptId){
    const name = String(eventName || "");
    const id = String(scriptId || "");
    if(!name || !id) return;
    if(!this.handlers.has(name)) this.handlers.set(name, new Map());
    this.handlers.get(name).set(id, lines.slice());
  }

  // Placeholder for future binding logic; DZS handlers are already routed via ScriptLoader
  bindAll(){
    return;
  }

  resolveOwner(payload){
    if(payload?.playerId != null){
      return { type:"entity", id: String(payload.playerId), entityType: "player" };
    }
    if(payload?.player != null){
      return { type:"entity", id: this._pid(payload.player), entityType: "player" };
    }
    if(payload?.entityId != null){
      return { type:"entity", id: String(payload.entityId), entityType: "entity" };
    }
    if(payload?.entity != null){
      return { type:"entity", id: this._eid(payload.entity), entityType: "entity" };
    }
    return { type:"level", id:"level", entityType: "level" };
  }

  _pid(p){
    if(p == null) return "p0";
    if(typeof p === "string" || typeof p === "number") return String(p);
    if(p.id != null) return String(p.id);
    if(p.playerId != null) return String(p.playerId);
    if(p.name != null) return String(p.name);
    if(p.raw?.id != null) return String(p.raw.id);
    return "p0";
  }

  _eid(ent){
    if(ent == null) return "e0";
    if(typeof ent === "string" || typeof ent === "number") return String(ent);
    if(ent.id != null) return String(ent.id);
    if(ent.entityId != null) return String(ent.entityId);
    if(ent.name != null) return String(ent.name);
    if(ent.raw?.id != null) return String(ent.raw.id);
    return String(ent);
  }

  async run(eventName, payload = null, opts = {}){
    const handlerMap = this.handlers.get(eventName);
    if(!handlerMap) return;

    this.ctx.event = payload;
    const matchId = this._getMatchId(opts.matchId);
    const owner = opts.owner || this.resolveOwner(payload);

    if(opts.scriptId){
      const lines = handlerMap.get(String(opts.scriptId));
      if(lines) this._spawnThread({ name:eventName, lines, payload, scriptId:String(opts.scriptId), owner, matchId });
      return;
    }

    for(const [scriptId, lines] of handlerMap){
      this._spawnThread({ name:eventName, lines, payload, scriptId, owner, matchId });
    }
  }

  startThread(handlerName, payload=null, opts = {}){
    const name = String(handlerName || "");
    if(!name) return null;
    const matchId = this._getMatchId(opts.matchId);
    const owner = opts.owner || { type:"level", id:"level", entityType:"level" };
    const scriptId = String(opts.scriptId || "");
    const map = this.handlers.get(name);
    const lines = scriptId ? map?.get(scriptId) : map?.values?.().next?.()?.value;
    if(!lines) return null;
    return this._spawnThread({ name, lines, payload, scriptId, owner, matchId });
  }

  stopThread(id){
    return this.cancelThread(id, "stopThread");
  }

  getAllThreads(){
    return Array.from(this._threads.values()).map(t=>({
      id: t.id,
      name: t.name,
      scriptId: t.scriptId,
      owner: { type: t.owner.type, id: t.owner.id }
    }));
  }

  cancelOwnerThreads(matchId, ownerType, ownerId, reason="ownerEnd"){
    const mid = this._getMatchId(matchId);
    const ownerKey = this._ownerKey(mid, { type: ownerType, id: String(ownerId) });
    const set = this._threadsByOwner.get(ownerKey);
    if(!set) return 0;
    for(const tid of Array.from(set)) this.cancelThread(tid, reason);
    return set.size;
  }

  notifyLevel(signalName, ...args){
    const mid = this._getMatchId();
    this._notify(mid, "level", "level", String(signalName || ""), args);
  }

  notifyEntity(entityId, signalName, ...args){
    const mid = this._getMatchId();
    this._notify(mid, "entity", String(entityId), String(signalName || ""), args);
  }

  tick(dt, nowMs){
    const now = (nowMs != null) ? nowMs : (performance?.now?.() ?? Date.now());
    this._nowMs = now;
    if(this._timers.size === 0) return;

    for(const timer of Array.from(this._timers.values())){
      if(timer.cancelled){
        this._removeTimer(timer.id);
        continue;
      }
      if(now < timer.nextAt) continue;
      this.run(timer.handlerName, timer.payload, {
        scriptId: timer.scriptId,
        owner: timer.owner,
        matchId: timer.matchId,
      });
      if(timer.type === "interval" && !timer.cancelled){
        timer.nextAt = now + timer.ms;
        this._timers.set(timer.id, timer);
      } else {
        this._removeTimer(timer.id);
      }
    }
  }

  clearTimer(id){
    const t = this._timers.get(String(id));
    if(!t) return false;
    t.cancelled = true;
    this._timers.set(String(id), t);
    this._removeTimer(String(id));
    return true;
  }

  _removeTimer(id){
    const t = this._timers.get(String(id));
    if(!t) return;
    this._timers.delete(String(id));
    const set = this._timersByScript.get(t.scriptId);
    if(set){
      set.delete(String(id));
      if(set.size === 0) this._timersByScript.delete(t.scriptId);
    }
  }

  _createTimer(thread, type, handlerName, ms){
    const id = String(this._timerSeq++);
    const delay = Math.max(0, Number(ms || 0));
    const now = this._nowMs || (performance?.now?.() ?? Date.now());
    const t = {
      id,
      type,
      ms: delay,
      nextAt: now + delay,
      handlerName: String(handlerName || ""),
      cancelled: false,
      scriptId: thread.scriptId,
      matchId: thread.matchId,
      owner: thread.owner,
      payload: thread.payload ?? null,
    };
    this._timers.set(id, t);
    if(!this._timersByScript.has(thread.scriptId)) this._timersByScript.set(thread.scriptId, new Set());
    this._timersByScript.get(thread.scriptId).add(id);
    return id;
  }

  cancelThread(id, reason="cancelled"){
    const t = this._threads.get(String(id));
    if(!t) return false;
    t.cancelled = true;
    t.cancelReason = reason;
    if(t._waitCancel) t._waitCancel();
    if(t.waiting?.key) this._removeWaiter(t);
    this._cleanupThread(t);
    return true;
  }

  _spawnThread({ name, lines, payload, scriptId, owner, matchId }){
    const id = String(this._threadSeq++);
    const ownerKey = this._ownerKey(matchId, owner);
    const t = {
      id,
      name,
      scriptId,
      matchId,
      owner,
      ownerKey,
      cancelled: false,
      cancelReason: null,
      waiting: null,
      endons: new Set(),
      waitDepth: 0,
      budget: this.maxOps,
      payload,
      cleaned: false,
      _waitCancel: null,
    };
    this._threads.set(id, t);

    if(!this._threadsByOwner.has(ownerKey)) this._threadsByOwner.set(ownerKey, new Set());
    this._threadsByOwner.get(ownerKey).add(id);

    if(!this._threadsByScript.has(scriptId)) this._threadsByScript.set(scriptId, new Set());
    this._threadsByScript.get(scriptId).add(id);

    (async ()=>{
      try{
        await this._exec(lines, payload, t);
      } catch (e){
        const msg = String(e?.message || e);
        if(msg.includes("DZS thread end") || msg.includes("DZS thread cancelled")) return;
        if(msg.includes("DZS overflow")){
          const now = performance?.now?.() ?? Date.now();
          const last = this._warnAt.get(name) || 0;
          if(now - last > 2000){
            this._warnAt.set(name, now);
            this.ctx?.notifications?.notifyAll?.("^3Script warning:^7 execution limit reached");
          }
          return;
        }
        this.events.emit("log", { msg: "[dzs error] " + (e?.stack || e) });
      } finally {
        this._cleanupThread(t);
      }
    })();

    return id;
  }

  _cleanupThread(thread){
    if(thread.cleaned) return;
    thread.cleaned = true;
    this._threads.delete(thread.id);

    const ownerSet = this._threadsByOwner.get(thread.ownerKey);
    if(ownerSet){
      ownerSet.delete(thread.id);
      if(ownerSet.size === 0) this._threadsByOwner.delete(thread.ownerKey);
    }

    const scriptSet = this._threadsByScript.get(thread.scriptId);
    if(scriptSet){
      scriptSet.delete(thread.id);
      if(scriptSet.size === 0) this._threadsByScript.delete(thread.scriptId);
    }

    if(thread.waiting?.key) this._removeWaiter(thread);

    for(const key of thread.endons){
      const set = this._endons.get(key);
      if(!set) continue;
      set.delete(thread.id);
      if(set.size === 0) this._endons.delete(key);
    }
  }

  _removeWaiter(thread){
    const key = thread.waiting?.key;
    const waiter = thread.waiting?.waiter;
    if(!key || !waiter) return;
    const set = this._waiters.get(key);
    if(set){
      set.delete(waiter);
      if(set.size === 0) this._waiters.delete(key);
    }
    thread.waiting = null;
  }

  _threadBuiltins(thread){
    return {
      wait: (sec)=> this._wait(thread, sec),
      waittill: (signal)=> this._waittill(thread, signal, "auto"),
      endon: (signal)=> this._endon(thread, signal, "auto"),
      notify: (signal, ...args)=> this._notifyFromThread(thread, "auto", signal, args),
      startThread: (handlerName, payload)=> this._startThreadFromThread(thread, "auto", handlerName, payload),
      stopThread: (id)=> this.stopThread(id),
      getAllThreads: ()=> this.getAllThreads(),
      setTimeout: (handlerName, ms)=> this._createTimer(thread, "timeout", handlerName, ms),
      setInterval: (handlerName, ms)=> this._createTimer(thread, "interval", handlerName, ms),
      clearTimer: (id)=> this.clearTimer(id),
      threadEnd: ()=> { thread.cancelled = true; throw new Error("DZS thread end"); },
      terminate: ()=> { thread.cancelled = true; throw new Error("DZS thread end"); },
    };
  }

  _startThreadFromThread(thread, scopeOverride, handlerName, payloadOrArgs){
    const scope = this._resolveSignalScope(thread, scopeOverride);
    if(!scope) return null;
    const name = String(handlerName || "");
    if(!name) return null;
    const handlerMap = this.handlers.get(name);
    const lines = handlerMap?.get(thread.scriptId);
    if(!lines) return null;
    let payload = payloadOrArgs;
    if(payloadOrArgs === undefined) payload = thread.payload ?? null;
    if(Array.isArray(payloadOrArgs)){
      payload = { args: payloadOrArgs, event: thread.payload ?? null };
    }
    return this._spawnThread({
      name,
      lines,
      payload,
      scriptId: thread.scriptId,
      owner: scope.owner,
      matchId: thread.matchId,
    });
  }

  _resolveSignalScope(thread, scopeOverride){
    const owner = thread.owner;
    if(scopeOverride === "self" || scopeOverride === "entity"){
      if(owner.type !== "entity") return null;
      return { type:"entity", id: owner.id, owner };
    }
    if(scopeOverride === "level"){
      return { type:"level", id:"level", owner: { type:"level", id:"level", entityType:"level" } };
    }
    if(owner.type === "entity"){
      return { type:"entity", id: owner.id, owner };
    }
    return { type:"level", id:"level", owner: { type:"level", id:"level", entityType:"level" } };
  }

  async _wait(thread, seconds){
    this._checkCancelled(thread);
    const sec = Number(seconds || 0);
    const ms = Math.max(0, sec * 1000);
    await new Promise((resolve)=>{
      const id = setTimeout(resolve, ms);
      thread._waitCancel = ()=>{ clearTimeout(id); resolve(); };
    });
    thread._waitCancel = null;
    this._resetBudget(thread);
    this._checkCancelled(thread);
  }

  async _waittill(thread, signalName, scopeOverride){
    const scope = this._resolveSignalScope(thread, scopeOverride);
    if(!scope) return [];
    if(thread.waitDepth >= this.maxWaits){
      throw new Error("DZS overflow: waittill limit exceeded");
    }
    thread.waitDepth += 1;
    const key = this._signalKey(thread.matchId, scope.type, scope.id, String(signalName || ""));
    const args = await new Promise((resolve)=>{
      const waiter = { threadId: thread.id, resolve };
      if(!this._waiters.has(key)) this._waiters.set(key, new Set());
      this._waiters.get(key).add(waiter);
      thread.waiting = { key, waiter };
      thread._waitCancel = ()=>{ this._removeWaiter(thread); resolve([]); };
    });
    thread.waitDepth = Math.max(0, thread.waitDepth - 1);
    thread._waitCancel = null;
    this._resetBudget(thread);
    this._checkCancelled(thread);
    return Array.isArray(args) ? args : [args];
  }

  _endon(thread, signalName, scopeOverride){
    const scope = this._resolveSignalScope(thread, scopeOverride);
    if(!scope) return;
    const key = this._signalKey(thread.matchId, scope.type, scope.id, String(signalName || ""));
    if(!this._endons.has(key)) this._endons.set(key, new Set());
    this._endons.get(key).add(thread.id);
    thread.endons.add(key);
  }

  _notifyFromThread(thread, scopeOverride, signalName, args){
    const scope = this._resolveSignalScope(thread, scopeOverride);
    if(!scope) return;
    this._notify(thread.matchId, scope.type, scope.id, String(signalName || ""), args);
  }

  _notify(matchId, scopeType, scopeId, signalName, args){
    const key = this._signalKey(matchId, scopeType, scopeId, signalName);
    const endons = this._endons.get(key);
    if(endons){
      for(const tid of Array.from(endons)) this.cancelThread(tid, "endon");
    }

    const waiters = this._waiters.get(key);
    if(!waiters) return;
    this._waiters.delete(key);
    const out = Array.isArray(args) ? args : [args];
    for(const waiter of waiters){
      try { waiter.resolve(out); } catch {}
    }
  }

  _resetBudget(thread){
    thread.budget = this.maxOps;
  }

  _checkCancelled(thread){
    if(thread.cancelled) throw new Error("DZS thread cancelled");
  }

  _getLevelVars(matchId){
    const id = this._getMatchId(matchId);
    if(!this._levelVars.has(id)) this._levelVars.set(id, new Map());
    return this._levelVars.get(id);
  }

  _getEntityVars(matchId, entityId){
    const id = this._getMatchId(matchId);
    if(!this._entityVars.has(id)) this._entityVars.set(id, new Map());
    const map = this._entityVars.get(id);
    const eid = String(entityId);
    if(!map.has(eid)) map.set(eid, new Map());
    return map.get(eid);
  }

  _sanitizeVar(v){
    if(v == null) return v;
    const t = typeof v;
    if(t === "string" || t === "number" || t === "boolean") return v;
    if(Array.isArray(v)) return v.map(val=>this._sanitizeVar(val));
    if(t === "object"){
      const proto = Object.getPrototypeOf(v);
      if(proto === Object.prototype || proto === null){
        const out = {};
        for(const [k, val] of Object.entries(v)) out[k] = this._sanitizeVar(val);
        return out;
      }
    }
    return String(v);
  }

  _createLevelContext(matchId, api){
    const vars = this._getLevelVars(matchId);
    const base = { matchId: this._getMatchId(matchId), varsProxy: null, api };
    const proxy = new Proxy(base, {
      get: (obj, prop)=>{
        if(prop in obj) return obj[prop];
        if(typeof prop === "symbol") return undefined;
        return vars.get(String(prop));
      },
      set: (obj, prop, value)=>{
        if(prop in obj){
          obj[prop] = value;
          return true;
        }
        if(typeof prop === "symbol") return true;
        vars.set(String(prop), this._sanitizeVar(value));
        return true;
      },
      ownKeys: (obj)=> Array.from(new Set([...Object.keys(obj), ...vars.keys()])),
      getOwnPropertyDescriptor: (obj, prop)=>{
        if(prop in obj) return Object.getOwnPropertyDescriptor(obj, prop);
        if(vars.has(String(prop))) return { configurable:true, enumerable:true, writable:true, value: vars.get(String(prop)) };
        return undefined;
      },
    });
    base.varsProxy = proxy;
    return proxy;
  }

  _createEntityContext(matchId, entityId, type, api){
    const vars = this._getEntityVars(matchId, entityId);
    const base = { entityId: String(entityId), type: type || "entity", varsProxy: null, api };
    const proxy = new Proxy(base, {
      get: (obj, prop)=>{
        if(prop in obj) return obj[prop];
        if(typeof prop === "symbol") return undefined;
        return vars.get(String(prop));
      },
      set: (obj, prop, value)=>{
        if(prop in obj){
          obj[prop] = value;
          return true;
        }
        if(typeof prop === "symbol") return true;
        vars.set(String(prop), this._sanitizeVar(value));
        return true;
      },
      ownKeys: (obj)=> Array.from(new Set([...Object.keys(obj), ...vars.keys()])),
      getOwnPropertyDescriptor: (obj, prop)=>{
        if(prop in obj) return Object.getOwnPropertyDescriptor(obj, prop);
        if(vars.has(String(prop))) return { configurable:true, enumerable:true, writable:true, value: vars.get(String(prop)) };
        return undefined;
      },
    });
    base.varsProxy = proxy;
    return proxy;
  }

  async _exec(lines, payload, thread){
    const src = this._compile(lines);
    const builtins = this._threadBuiltins(thread);
    const api = Object.assign({}, this.builtins, builtins);
    const level = this._createLevelContext(thread.matchId, api);
    const self = (thread.owner.type === "entity")
      ? this._createEntityContext(thread.matchId, thread.owner.id, thread.owner.entityType, api)
      : null;

    const scope = {
      __wait: (sec)=> this._wait(thread, sec),
      __waittill: (scopeType, signal)=> this._waittill(thread, signal, scopeType),
      __endon: (scopeType, signal)=> this._endon(thread, signal, scopeType),
      __notify: (scopeType, signal, ...args)=> this._notifyFromThread(thread, scopeType, signal, args),
      __thread: (scopeType, handlerName, args)=> this._startThreadFromThread(thread, scopeType, handlerName, args),
      __guard: ()=>{
        this._checkCancelled(thread);
        thread.budget--;
        if(thread.budget < 0) throw new Error("DZS overflow: script budget exceeded");
      },
      ...api,
      self,
      level,
      event: payload ?? null,
    };
    const fn = new Function("scope", `return (async ()=>{ with(scope){ ${src} } })();`);
    return await fn(scope);
  }

  _argToJs(tok){
    if(/^-?\d+(\.\d+)?$/.test(tok)) return tok;
    if((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) return tok;
    if(/^#[0-9a-fA-F]{3,8}$/.test(tok)) return JSON.stringify(tok);
    if(/^[A-Za-z_][\w-]*$/.test(tok)) return JSON.stringify(tok);
    return tok;
  }

  _splitTokens(line){
    const out = [];
    let cur = "";
    let quote = null;
    let escape = false;
    for(const ch of line){
      if(quote){
        cur += ch;
        if(escape){
          escape = false;
          continue;
        }
        if(ch === "\\") { escape = true; continue; }
        if(ch === quote) quote = null;
        continue;
      }
      if(ch === "'" || ch === '"'){
        quote = ch;
        cur += ch;
        continue;
      }
      if(/\s/.test(ch)){
        if(cur) out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    if(cur) out.push(cur);
    return out;
  }

  _splitArgsStr(str){
    const args = [];
    let cur = "";
    let quote = null;
    let escape = false;
    let depth = 0;
    for(const ch of str){
      if(quote){
        cur += ch;
        if(escape){
          escape = false;
          continue;
        }
        if(ch === "\\") { escape = true; continue; }
        if(ch === quote) quote = null;
        continue;
      }
      if(ch === "'" || ch === '"'){
        quote = ch;
        cur += ch;
        continue;
      }
      if(ch === "("){
        depth++;
        cur += ch;
        continue;
      }
      if(ch === ")"){
        depth = Math.max(0, depth - 1);
        cur += ch;
        continue;
      }
      if(ch === "," && depth === 0){
        const trimmed = cur.trim();
        if(trimmed) args.push(trimmed);
        cur = "";
        continue;
      }
      cur += ch;
    }
    const trimmed = cur.trim();
    if(trimmed) args.push(trimmed);
    return args;
  }

  _parseCall(rest){
    const tokens = this._splitTokens(rest);
    if(tokens.length === 0) return null;
    const name = tokens[0];
    const args = tokens.slice(1).map(t=>this._argToJs(t));
    return { name, args };
  }

  _parseThreadCall(rest){
    const m = rest.match(/^([A-Za-z_][\w]*)\s*\((.*)\)\s*$/);
    if(m){
      const name = m[1];
      const args = this._splitArgsStr(m[2]).map(a=>this._argToJs(a));
      return { name, args };
    }
    const parsed = this._parseCall(rest);
    if(!parsed) return null;
    return { name: parsed.name, args: parsed.args };
  }

  _compile(lines){
    let out = "";
    for(const raw of lines){
      let line = raw.trim();
      if(line.length > this.maxLineLen) line = line.slice(0, this.maxLineLen);
      if(!line || line.startsWith("//")) continue;

      const wasCall = line.startsWith("call ");
      if(wasCall) line = line.slice(5).trim();

      if(line.startsWith("wait ")){
        const msTok = line.slice(5).trim();
        const msJs = this._argToJs(msTok);
        out += `__guard();await __wait(${msJs});\n`;
        continue;
      }

      if(line.startsWith("waittill ")){
        const sigTok = line.slice(9).trim();
        const sigJs = this._argToJs(sigTok);
        out += `__guard();await __waittill("auto", ${sigJs});\n`;
        continue;
      }

      if(line.startsWith("self waittill ")){
        const sigTok = line.slice(14).trim();
        const sigJs = this._argToJs(sigTok);
        out += `__guard();await __waittill("self", ${sigJs});\n`;
        continue;
      }

      if(line.startsWith("level waittill ")){
        const sigTok = line.slice(15).trim();
        const sigJs = this._argToJs(sigTok);
        out += `__guard();await __waittill("level", ${sigJs});\n`;
        continue;
      }

      if(line.startsWith("endon ")){
        const sigTok = line.slice(6).trim();
        const sigJs = this._argToJs(sigTok);
        out += `__guard();__endon("auto", ${sigJs});\n`;
        continue;
      }

      if(line.startsWith("self endon ")){
        const sigTok = line.slice(11).trim();
        const sigJs = this._argToJs(sigTok);
        out += `__guard();__endon("self", ${sigJs});\n`;
        continue;
      }

      if(line.startsWith("level endon ")){
        const sigTok = line.slice(12).trim();
        const sigJs = this._argToJs(sigTok);
        out += `__guard();__endon("level", ${sigJs});\n`;
        continue;
      }

      if(line.startsWith("self notify ")){
        const rest = line.slice(12).trim();
        const parsed = this._parseCall(rest);
        if(parsed){
          const args = parsed.args.length ? ", " + parsed.args.join(",") : "";
          out += `__guard();__notify("self", ${this._argToJs(parsed.name)}${args});\n`;
          continue;
        }
      }

      if(line.startsWith("level notify ")){
        const rest = line.slice(13).trim();
        const parsed = this._parseCall(rest);
        if(parsed){
          const args = parsed.args.length ? ", " + parsed.args.join(",") : "";
          out += `__guard();__notify("level", ${this._argToJs(parsed.name)}${args});\n`;
          continue;
        }
      }

      if(line.startsWith("notify ")){
        const rest = line.slice(7).trim();
        const parsed = this._parseCall(rest);
        if(parsed){
          const args = parsed.args.length ? ", " + parsed.args.join(",") : "";
          out += `__guard();__notify("auto", ${this._argToJs(parsed.name)}${args});\n`;
          continue;
        }
      }

      if(line.startsWith("self thread ")){
        const rest = line.slice(12).trim();
        const parsed = this._parseThreadCall(rest);
        if(parsed){
          out += `__guard();__thread("self", ${JSON.stringify(parsed.name)}, [${parsed.args.join(",")}]);\n`;
          continue;
        }
      }

      if(line.startsWith("level thread ")){
        const rest = line.slice(13).trim();
        const parsed = this._parseThreadCall(rest);
        if(parsed){
          out += `__guard();__thread("level", ${JSON.stringify(parsed.name)}, [${parsed.args.join(",")}]);\n`;
          continue;
        }
      }

      if(line.startsWith("thread ")){
        const rest = line.slice(7).trim();
        const parsed = this._parseThreadCall(rest);
        if(parsed){
          out += `__guard();__thread("auto", ${JSON.stringify(parsed.name)}, [${parsed.args.join(",")}]);\n`;
          continue;
        }
      }

      // builtin call: space separated and not already using ()
      if(/^[a-zA-Z_][\w]*\s/.test(line) && !line.includes("(")){
        const parsed = this._parseCall(line);
        if(parsed){
          const args = parsed.args.join(",");
          out += `__guard();${parsed.name}(${args});\n`;
          continue;
        }
      }

      // Inject guard into single-line loop blocks like for(...){...}
      if(/\b(for|while)\s*\([^)]*\)\s*\{/.test(line) && line.includes("}")){
        line = line.replace("{", "{__guard();");
      }

      // JS control flow passthrough
      out += "__guard();" + line + "\n";
    }
    return out;
  }
}
