export class DzsScriptManager {
  constructor({ runtime, events } = {}){
    this.runtime = runtime || null;
    this.events = events || null;
    this._scripts = new Map(); // scriptId -> record
    this._seq = 1;
  }

  _emit(msg){
    this.events?.emit?.("log", { msg: `[dzs studio] ${msg}` });
  }

  list(){
    return Array.from(this._scripts.values()).map(s=>({ ...s }));
  }

  listAll(){
    const out = new Map();
    for(const record of this._scripts.values()){
      out.set(record.scriptId, { ...record });
    }
    const runtimeScripts = this.runtime?._scripts;
    if(runtimeScripts && typeof runtimeScripts[Symbol.iterator] === "function"){
      for(const entry of runtimeScripts){
        const scriptId = String(entry || "");
        if(!scriptId) continue;
        if(out.has(scriptId)){
          const rec = out.get(scriptId);
          rec.loaded = true;
          if(rec.enabled == null) rec.enabled = true;
        } else {
          out.set(scriptId, {
            scriptId,
            filename: scriptId,
            name: scriptId,
            enabled: true,
            loaded: true,
            source: "runtime",
          });
        }
      }
    }
    return Array.from(out.values());
  }

  installDzs({ filename="(dzs)", text="", ownerId=null, scriptId=null } = {}){
    const resolvedId = scriptId ? String(scriptId) : `studio_${this._seq++}`;
    const record = {
      scriptId: resolvedId,
      filename: String(filename || "(dzs)"),
      text: String(text || ""),
      enabled: false,
      ownerId: ownerId != null ? String(ownerId) : null,
      installedAt: Date.now(),
    };
    this._scripts.set(resolvedId, record);
    this.enable(resolvedId);
    return resolvedId;
  }

  enable(scriptId){
    const id = String(scriptId || "");
    const record = this._scripts.get(id);
    if(!record || record.enabled) return false;
    if(!this.runtime?.loadText){
      this._emit(`runtime missing; cannot enable ${id}`);
      return false;
    }
    this.runtime.loadText(record.text, record.filename, record.scriptId);
    record.enabled = true;
    record.lastEnabledAt = Date.now();
    return true;
  }

  reenableAll(){
    if(!this.runtime?.loadText) return 0;
    let count = 0;
    for(const record of this._scripts.values()){
      if(!record.enabled) continue;
      this.runtime.loadText(record.text, record.filename, record.scriptId);
      count += 1;
    }
    return count;
  }

  disable(scriptId){
    const id = String(scriptId || "");
    const record = this._scripts.get(id);
    if(!record || !record.enabled) return false;
    this.runtime?.unloadScript?.(record.scriptId);
    record.enabled = false;
    record.lastDisabledAt = Date.now();
    return true;
  }

  remove(scriptId){
    const id = String(scriptId || "");
    if(!this._scripts.has(id)) return false;
    this.disable(id);
    this._scripts.delete(id);
    return true;
  }

  clear(){
    for(const id of Array.from(this._scripts.keys())){
      this.remove(id);
    }
  }
}
