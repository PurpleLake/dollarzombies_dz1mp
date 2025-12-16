export class NetClient {
  constructor({ url, engine, desiredMode="zm" }){
    this.engine = engine;
    this.url = url;
    this.mode = desiredMode;
    this.ws = null;

    this.clientId = null;
    this.name = null;
    this.team = null;

    this.players = new Map(); // id -> {id,name,team,hp,pos,rot,mode}
    this.connected = false;

    this._prevHp = new Map();

    this._lastSend = 0;
  }

  connect(){
    if(this.ws) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", ()=>{
      this.connected = true;
      this._send({ t:"hello", mode:this.mode });
      this.engine?.events?.emit?.("net:open", {});
    });

    ws.addEventListener("message", (ev)=>{
      try {
        const msg = JSON.parse(ev.data);
        this._onMsg(msg);
      } catch {}
    });

    ws.addEventListener("close", ()=>{
      this.connected = false;

    this._prevHp = new Map();
      this.ws = null;
      this.engine?.events?.emit?.("net:close", {});
    });

    ws.addEventListener("error", ()=>{
      this.engine?.events?.emit?.("net:error", {});
    });
  }

  setMode(mode){
    this.mode = mode;
    if(this.connected) this._send({ t:"setMode", mode });
  }

  _onMsg(msg){
    if(msg.t === "welcome"){
      this.clientId = msg.id;
      this.name = msg.name;
      this.team = msg.team ?? null;
      this.engine?.events?.emit?.("net:welcome", msg);
      return;
    }
    
if(msg.t === "hitConfirm"){
  this.engine?.events?.emit?.("mp:hitConfirm", msg);
  return;
}
if(msg.t === "gotHit"){
  // local player got hit
  this.engine?.events?.emit?.("mp:playerDamaged", { playerId: this.clientId, attackerId: msg.attackerId, amount: msg.amount, hp: msg.hp });
  return;
}
if(msg.t === "died"){
  this.engine?.events?.emit?.("mp:playerDeath", { playerId: this.clientId, attackerId: msg.attackerId });
  return;
}
if(msg.t === "killed"){
  this.engine?.events?.emit?.("mp:kill", msg);
  return;
}

    if(msg.t === "state"){
      // full roster snapshot
      const prev = this._prevHp;
      this.players.clear();
      for(const p of (msg.players||[])){
        const pid = String(p.id);
        const hp = Number(p.hp ?? 100);
        const old = prev.get(pid);
        if(old !== undefined && hp !== old){
          if(hp < old){
            this.engine?.events?.emit?.("mp:playerDamaged", { playerId: pid, amount: (old-hp), hp });
          }
          if(hp <= 0 && old > 0){
            this.engine?.events?.emit?.("mp:playerDeath", { playerId: pid });
          }
        }
        prev.set(pid, hp);
        this.players.set(p.id, p);
      }
      this.engine?.ctx?.players && (this.engine.ctx.players = (msg.players||[]).map(p=>({
        id:p.id, name:p.name, team:p.team, health:p.hp, position:p.pos, weapon:p.weaponId, raw:p
      })));
      this.engine?.events?.emit?.("net:state", msg);
      return;
    }
  }

  _send(obj){
    try { this.ws?.send(JSON.stringify(obj)); } catch {}
  }

  sendLocalSnapshot({ pos, rot, hp, weaponId }){
    const now = performance.now();
    // cap outbound to 20hz
    if(now - this._lastSend < 50) return;
    this._lastSend = now;
    this._send({ t:"snap", mode:this.mode, pos, rot, hp, weaponId });
  }
}
