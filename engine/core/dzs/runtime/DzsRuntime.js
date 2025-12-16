import { makeBuiltins, BUILTIN_DOCS } from "../builtins/dzsBuiltins.js";

export class DzsRuntime {
  constructor({ events, ctx }){
    this.events = events;
    this.ctx = ctx;
    this.builtins = makeBuiltins(ctx);
    this.builtinDocs = BUILTIN_DOCS;
    this.handlers = new Map();
    this._timers = new Map(); // id -> timer
    this._timerSeq = 1;
    this._globals = new Map();
    this._playerVars = new Map(); // pid -> Map
    this._entityVars = new Map(); // eid -> Map

    // Cooperative threads (async handlers)
    this._threads = new Map(); // id -> { name, cancelled }
    this._threadSeq = 1;

    // Overflow protection
    this.maxOps = 20000; // per run
    this.maxLineLen = 600;
    this._warnAt = new Map(); // eventName -> lastMs

  }


clear(){
  this.handlers.clear();
}

/**
 * Loads a .dzs script file.
 * Supported formats:
 * 1) function-style blocks:
 *    onGameStart(){ ... }
 *    onTick(){ ... }
 *
 * 2) legacy "on name {" blocks (also supported)
 *    on zm:start { ... }
 */
loadText(text, filename="(dzs)"){
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
      this.on(name, body);
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
      this.on(name, body);
      continue;
    }

    err(`Unknown statement: ${line}`);
  }
}

  on(eventName, lines){
    this.handlers.set(eventName, lines.slice());
  }

  // Placeholder for future binding logic; DZS handlers are already routed via ScriptLoader
  bindAll(){
    return;
  }


startThread(handlerName, payload=null){
  const name = String(handlerName||"");
  const id = String(this._threadSeq++);
  const t = { id, name, cancelled:false };
  this._threads.set(id, t);

  // fire-and-forget async execution
  (async ()=>{
    try{
      await this.run(name, payload || {});
    } catch (e){
      // errors already handled by run
    } finally {
      this._threads.delete(id);
    }
  })();

  return id;
}

stopThread(id){
  const t = this._threads.get(String(id));
  if(!t) return false;
  t.cancelled = true;
  this._threads.set(String(id), t);
  return true;
}

getAllThreads(){
  return Array.from(this._threads.values()).map(t=>({ id:t.id, name:t.name }));
}
  async run(eventName, payload = null){
    const lines = this.handlers.get(eventName);
    if(!lines) return;
    try {
      this.ctx.event = payload;
      this._exec(lines, payload);
    } catch (e){
      const msg = String(e?.message || e);
      if(msg.includes("DZS overflow")){
        const now = performance.now();
        const last = this._warnAt.get(eventName) || 0;
        if(now - last > 2000){
          this._warnAt.set(eventName, now);
          this.ctx?.notifications?.notifyAll?.("^3Script warning:^7 execution limit reached");
        }
        return;
      }
      this.events.emit("log", { msg: "[dzs error] " + (e?.stack || e) });
    }
  }
  async _exec(lines, payload){
    const src = this._compile(lines);
    const scope = {
      __wait: (ms)=> new Promise(res=>setTimeout(res, Math.max(0, Number(ms||0)))),
      startThread: (handlerName, payload)=> this.startThread(handlerName, payload || null),
      stopThread: (id)=> this.stopThread(id),
      getAllThreads: ()=> this.getAllThreads(),
      __budget: this.maxOps,
      __guard: ()=>{ scope.__budget--; if(scope.__budget < 0) throw new Error("DZS overflow: script budget exceeded"); },
      ...this.builtins,
      event: payload || null,
    };
    const fn = new Function("scope", `return (async ()=>{ with(scope){ ${src} } })();`);
    return await fn(scope);
  }

  _argToJs(tok){
    // numbers
    if(/^-?\d+(\.\d+)?$/.test(tok)) return tok;
    // quoted strings
    if((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) return tok;
    // hex colors (treat as string)
    if(/^#[0-9a-fA-F]{3,8}$/.test(tok)) return JSON.stringify(tok);
    // barewords like glow/neon etc should be strings
    if(/^[A-Za-z_][\w-]*$/.test(tok)) return JSON.stringify(tok);
    // otherwise assume it's an expression: players[i], players[i].name, etc
    return tok;
  }

  _compile(lines){
    let out = "";
    for(const raw of lines){
      let line = raw.trim();
      if(line.length > this.maxLineLen) line = line.slice(0, this.maxLineLen);
      if(!line || line.startsWith("//")) continue;


// wait keyword (cooperative): wait 1000
if(line.startsWith("wait ")){
  const msTok = line.slice(5).trim();
  const msJs = this._argToJs(msTok);
  out += `__guard();await __wait(${msJs});\n`;
  continue;
}

// thread keyword: thread handlerName
if(line.startsWith("thread ")){
  const h = line.slice(7).trim();
  const hJs = this._argToJs(h);
  out += `__guard();startThread(${hJs}, event);\n`;
  continue;
}

      // builtin call: space separated and not already using ()
      if(/^[a-zA-Z_][\w]*\s/.test(line) && !line.includes("(")){
        const parts = line.split(/\s+/);
        const name = parts.shift();
        const args = parts.map(p=>this._argToJs(p)).join(",");
        out += `__guard();${name}(${args});\n`;
        continue;
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
