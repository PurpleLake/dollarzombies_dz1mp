export class LobbyState {
  constructor({ mode = "zm", maps = [], motd = "MOTD: Welcome to Dollar Zombies. Be nice. Shoot straighter." } = {}){
    this.mode = mode;
    this.maps = maps.slice(0, 2);
    this.motd = motd;
    this.readyByPlayerId = new Map();
    this.voteByPlayerId = new Map();
    this.playerOrder = [];
    this.players = [];
  }

  setMode(mode){
    this.mode = mode || "zm";
  }

  setMaps(maps){
    this.maps = (maps || []).slice(0, 2);
  }

  setMotd(text){
    this.motd = text || "";
  }

  setPlayers(list = []){
    const ids = [];
    for(const p of list){
      const pid = String(p.id ?? p.playerId ?? "");
      if(!pid) continue;
      if(!this.playerOrder.includes(pid)) this.playerOrder.push(pid);
      ids.push(pid);
    }
    this.players = list.slice();

    // Drop stale ready/vote state for disconnected players
    for(const key of Array.from(this.readyByPlayerId.keys())){
      if(!ids.includes(key)) this.readyByPlayerId.delete(key);
    }
    for(const key of Array.from(this.voteByPlayerId.keys())){
      if(!ids.includes(key)) this.voteByPlayerId.delete(key);
    }
  }

  getHostId(){
    for(const id of this.playerOrder){
      if(this.players.find(p => String(p.id) === id)) return id;
    }
    // fallback to first player entry
    const first = this.players[0];
    return first ? String(first.id) : null;
  }

  getConnectedCount(){
    return this.players.length;
  }

  getReadyCount(){
    let c = 0;
    for(const p of this.players){
      if(this.readyByPlayerId.get(String(p.id))) c++;
    }
    return c;
  }

  getRequiredReady(){
    const total = this.getConnectedCount();
    if(total <= 0) return 0;
    return Math.ceil(total / 2);
  }

  isReadyToStart(){
    const req = this.getRequiredReady();
    return req === 0 ? false : this.getReadyCount() >= req;
  }

  setReady(playerId, ready = true){
    if(!playerId) return;
    this.readyByPlayerId.set(String(playerId), Boolean(ready));
  }

  toggleReady(playerId){
    if(!playerId) return false;
    const cur = this.readyByPlayerId.get(String(playerId)) || false;
    const next = !cur;
    this.readyByPlayerId.set(String(playerId), next);
    return next;
  }

  setVote(playerId, mapId){
    if(!playerId) return;
    this.voteByPlayerId.set(String(playerId), mapId ? String(mapId) : null);
  }

  getVoteCounts(){
    const counts = new Map();
    for(const m of this.maps) counts.set(String(m.id), 0);
    for(const [pid, mapId] of this.voteByPlayerId.entries()){
      if(!this.players.find(p => String(p.id) === pid)) continue;
      if(!mapId) continue;
      const key = String(mapId);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  getPlayerVote(playerId){
    return this.voteByPlayerId.get(String(playerId)) || null;
  }

  pickWinningMapId(){
    if(!this.maps.length) return null;
    const counts = this.getVoteCounts();
    let best = [];
    let max = -1;
    for(const m of this.maps){
      const id = String(m.id);
      const c = counts.get(id) || 0;
      if(c > max){
        max = c;
        best = [id];
      } else if (c === max){
        best.push(id);
      }
    }
    if(best.length === 0) return String(this.maps[0].id);
    if(best.length === 1) return best[0];
    return best[Math.floor(Math.random() * best.length)];
  }
}
