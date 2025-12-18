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

    this.matchId = null;
    this.matchMode = null;
    this.matchStatus = null;
    this.hostPlayerId = null;
    this.lobbyPlayers = [];
    this.serverList = [];
    this.serverStats = { maxMatches: null, queueSizes: { MP: 0, ZM: 0 } };
    this.queueStatus = null;
    this.youAreHost = false;
  }

  connect(){
    if(this.ws) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", ()=>{
      this.connected = true;
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
      this._clearMatchState();
      this.ws = null;
      this.engine?.events?.emit?.("net:close", {});
    });

    ws.addEventListener("error", ()=>{
      this.engine?.events?.emit?.("net:error", {});
    });
  }

  setMode(mode){
    this.mode = mode;
    // mode is now purely local for client-side systems
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

    if(msg.t === "lobby_ready"){
      this.engine?.events?.emit?.("lobby:ready", { playerId: msg.playerId, ready: msg.ready, readyCount: msg.readyCount, total: msg.total });
      return;
    }
    if(msg.t === "lobby_vote"){
      this.engine?.events?.emit?.("lobby:vote", { playerId: msg.playerId, mapId: msg.mapId, counts: msg.counts });
      return;
    }
    if(msg.t === "lobby_motd"){
      this.engine?.events?.emit?.("lobby:motd", { text: msg.text });
      return;
    }

    if(msg.t === "queueStatus"){
      this.queueStatus = msg;
      this.engine?.events?.emit?.("net:queueStatus", msg);
      return;
    }
    if(msg.t === "matchFound"){
      this.matchId = msg.matchId || null;
      this.matchMode = msg.mode || null;
      this.matchStatus = "lobby";
      this.hostPlayerId = msg.hostPlayerId || null;
      this.youAreHost = Boolean(msg.youAreHost);
      this.engine?.events?.emit?.("net:matchFound", msg);
      return;
    }
    if(msg.t === "lobby_state"){
      const lobby = msg.lobby || {};
      this.matchId = lobby.matchId || this.matchId;
      this.matchMode = lobby.mode || this.matchMode;
      this.matchStatus = lobby.status || this.matchStatus || "lobby";
      this.hostPlayerId = lobby.hostPlayerId || this.hostPlayerId;
      this.lobbyPlayers = Array.isArray(lobby.players) ? lobby.players.slice() : [];
      this.engine?.events?.emit?.("net:lobby_state", msg);
      return;
    }
    if(msg.t === "hostChanged"){
      this.hostPlayerId = msg.hostPlayerId || null;
      this.engine?.events?.emit?.("net:hostChanged", msg);
      return;
    }
    if(msg.t === "lobby_lock"){
      this.engine?.events?.emit?.("net:lobby_lock", msg);
      return;
    }
    if(msg.t === "matchStarted"){
      this.matchStatus = "active";
      this.engine?.events?.emit?.("net:matchStarted", msg);
      return;
    }
    if(msg.t === "matchEnded"){
      this.matchStatus = "ended";
      this.engine?.events?.emit?.("net:matchEnded", msg);
      this._clearMatchState();
      return;
    }
    if(msg.t === "serverList"){
      this.serverList = Array.isArray(msg.servers) ? msg.servers.slice() : [];
      if(msg.maxMatches !== undefined) this.serverStats.maxMatches = msg.maxMatches;
      if(msg.queueSizes) this.serverStats.queueSizes = msg.queueSizes;
      this.engine?.events?.emit?.("net:serverList", msg);
      return;
    }

    if(msg.t === "state"){
      // full roster snapshot
      if(this.matchStatus !== "active") return;
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

  _clearMatchState(){
    this.matchId = null;
    this.matchMode = null;
    this.matchStatus = null;
    this.hostPlayerId = null;
    this.youAreHost = false;
    this.lobbyPlayers = [];
    this.players.clear();
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

  queueJoin(mode){
    this._send({ t:"queueJoin", mode });
  }

  queueLeave(){
    this._send({ t:"queueLeave" });
  }

  requestServerList({ showAll=false } = {}){
    this._send({ t:"serverList", showAll: Boolean(showAll) });
  }

  joinMatch(matchId){
    if(!matchId) return;
    this._send({ t:"joinMatch", matchId });
  }

  leaveMatch(){
    this._send({ t:"leaveMatch" });
    this._clearMatchState();
  }

  startLobby(){
    this._send({ t:"lobby_start" });
  }

  endMatch(){
    this._send({ t:"endMatch" });
  }

  sendLocalSnapshot({ pos, rot, hp, weaponId }){
    if(this.matchStatus !== "active") return;
    const now = performance.now();
    // cap outbound to 20hz
    if(now - this._lastSend < 50) return;
    this._lastSend = now;
    this._send({ t:"snap", mode:this.mode, pos, rot, hp, weaponId });
  }
}
