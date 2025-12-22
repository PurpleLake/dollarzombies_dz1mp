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
    this.matchId = null;
    this.matchMode = null;
    this.matchGamemode = null;

    this._prevHp = new Map();

    this._lastSend = 0;
  }

  connect(){
    if(this.ws) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", ()=>{
      this.connected = true;
      this._send({ t:"hello", mode:this.mode, name: this.name });
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

    if(msg.t === "queueStatus"){
      this.engine?.events?.emit?.("queue:status", msg);
      return;
    }
    if(msg.t === "matchFound"){
      this.matchId = msg.matchId;
      this.matchMode = msg.mode;
      this.matchGamemode = msg.gamemode ?? null;
      this.engine?.events?.emit?.("match:found", msg);
      return;
    }
    if(msg.t === "joinFailed"){
      this.engine?.events?.emit?.("match:joinFailed", msg);
      return;
    }
    if(msg.t === "serverList"){
      this.engine?.events?.emit?.("server:list", msg);
      return;
    }
    if(msg.t === "serverMaster"){
      this.engine?.events?.emit?.("server:master", msg);
      return;
    }
    if(msg.t === "lobbyState"){
      this.engine?.events?.emit?.("match:lobbyState", msg);
      return;
    }
    if(msg.t === "hostChanged"){
      this.engine?.events?.emit?.("match:hostChanged", msg);
      return;
    }
    if(msg.t === "matchStarted"){
      this.engine?.events?.emit?.("match:started", msg);
      return;
    }
    if(msg.t === "matchEnded"){
      this.matchId = null;
      this.matchMode = null;
      this.matchGamemode = null;
      this.team = null;
      this.engine?.events?.emit?.("match:ended", msg);
      return;
    }
    if(msg.t === "endMatchDenied"){
      this.engine?.events?.emit?.("match:endDenied", msg);
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
if(msg.t === "mpKill"){
  this.engine?.events?.emit?.("mp:kill", msg);
  return;
}
if(msg.t === "teamAssigned"){
  this.team = msg.team ?? this.team ?? null;
  this.engine?.events?.emit?.("mp:teamAssigned", msg);
  return;
}
if(msg.t === "matchState"){
  const state = msg.state || {};
  if(this.engine?.ctx){
    const cur = this.engine.ctx.matchState || {};
    this.engine.ctx.matchState = { ...cur, ...state };
  }
  this.engine?.events?.emit?.("mp:matchState", { state: msg.state || {}, matchId: msg.matchId });
  return;
}
if(msg.t === "matchEvent"){
  const name = String(msg.name || "");
  if(name) this.engine?.events?.emit?.(name, msg.payload || {});
  return;
}

    if(msg.t === "lobby_ready"){
      this.engine?.events?.emit?.("lobby:ready", { playerId: msg.playerId, ready: msg.ready });
      return;
    }
    if(msg.t === "lobby_vote"){
      this.engine?.events?.emit?.("lobby:vote", { playerId: msg.playerId, mapId: msg.mapId });
      return;
    }
    if(msg.t === "lobby_motd"){
      this.engine?.events?.emit?.("lobby:motd", { text: msg.text });
      return;
    }

    if(msg.t === "state"){
      // full roster snapshot
      const prev = this._prevHp;
      const prevIds = new Set(this.players.keys());
      this.players.clear();
      const nextIds = new Set();
      for(const p of (msg.players||[])){
        const pid = String(p.id);
        nextIds.add(pid);
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
      for(const pid of prevIds){
        if(nextIds.has(pid)) continue;
        prev.delete(pid);
        this.engine?.events?.emit?.("net:playerDisconnect", { playerId: pid });
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

  setName(name){
    const next = String(name || "").trim();
    if(!next) return;
    this.name = next;
    if(this.connected) this._send({ t:"setName", name: next });
  }

  sendLobbyReady(ready){
    this._send({ t:"lobby_ready", playerId: this.clientId, ready: Boolean(ready) });
  }

  sendLobbyVote(mapId){
    this._send({ t:"lobby_vote", playerId: this.clientId, mapId });
  }

  sendLobbyMotd(text){
    this._send({ t:"lobby_motd", text });
  }

  sendQueueJoin(mode){
    const gamemode = this.engine?.ctx?.session?.mpGamemode || null;
    this._send({ t:"queueJoin", mode, gamemode });
  }

  sendQueueLeave(){
    this._send({ t:"queueLeave" });
  }

  sendServerList(showAll=false){
    this._send({ t:"serverList", showAll });
  }

  sendJoinMatch(matchId){
    this._send({ t:"joinMatch", matchId });
  }

  sendLeaveMatch(){
    this._send({ t:"leaveMatch" });
  }

  sendStartMatch(){
    this._send({ t:"startMatch" });
  }

  sendEndMatch(reason){
    this._send({ t:"endMatch", reason });
  }

  sendEndMatchAdmin(matchId){
    this._send({ t:"endMatchAdmin", matchId });
  }

  sendMatchState(patch){
    if(!patch) return;
    this._send({ t:"matchState", patch });
  }

  sendMatchEvent(name, payload){
    if(!name) return;
    this._send({ t:"matchEvent", name, payload });
  }

  sendPlayerSpawned(payload = {}){
    this._send({ t:"playerSpawned", playerId: payload.playerId, team: payload.team, pos: payload.pos });
  }

  sendServerMaster(){
    this._send({ t:"serverMaster" });
  }

  sendLocalSnapshot({ pos, rot, hp, weaponId }){
    const now = performance.now();
    // cap outbound to 20hz
    if(now - this._lastSend < 50) return;
    this._lastSend = now;
    this._send({ t:"snap", mode:this.mode, pos, rot, hp, weaponId });
  }
}
