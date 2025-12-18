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
