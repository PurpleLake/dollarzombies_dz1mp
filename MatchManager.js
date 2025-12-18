const DEFAULT_MAX_MATCHES = 10;
const DEFAULT_GRACE_MS = 10000;

export const MODE_CFG = {
  MP: {
    minPlayers: 2,
    maxPlayers: 12,
    baseMapId: "mp_base",
    mapChoices: [
      { id: "mp_base", name: "Base Arena" },
      { id: "mp_outpost", name: "Outpost" },
    ],
  },
  ZM: {
    minPlayers: 1,
    maxPlayers: 4,
    baseMapId: "zm_facility",
    mapChoices: [
      { id: "zm_facility", name: "Facility" },
      { id: "zm_silo", name: "Silo" },
    ],
  },
  SOLO: {
    minPlayers: 1,
    maxPlayers: 1,
    baseMapId: "zm_facility",
    mapChoices: [
      { id: "zm_facility", name: "Facility" },
      { id: "zm_silo", name: "Silo" },
    ],
  },
};

function nowSeconds(nowMs){
  return Math.floor(nowMs / 1000);
}

function normalizeMode(mode){
  const key = String(mode || "").toUpperCase();
  return MODE_CFG[key] ? key : null;
}

export class MatchManager {
  constructor({ wsSend, maxMatches = DEFAULT_MAX_MATCHES, graceMs = DEFAULT_GRACE_MS, now = () => Date.now() } = {}){
    this.wsSend = wsSend;
    this.maxMatches = maxMatches;
    this.graceMs = graceMs;
    this.now = now;

    this.matches = new Map(); // matchId -> match
    this.players = new Map(); // playerId -> player
    this.queues = { MP: [], ZM: [] };

    this.nextMatchId = 1;
    this.nextPlayerId = 1;
  }

  registerPlayer(sock){
    const id = String(this.nextPlayerId++);
    const player = {
      id,
      sock,
      name: `Player${id}`,
      connectedAt: this.now(),
      matchId: null,
      queuedMode: null,
      lastSnap: { pos: { x: 0, y: 1.7, z: 0 }, rot: { yaw: 0, pitch: 0 }, hp: 100, weaponId: null },
    };
    this.players.set(id, player);
    return player;
  }

  getPlayer(id){
    return this.players.get(String(id)) || null;
  }

  removePlayer(id){
    const player = this.players.get(String(id));
    if(!player) return;
    this.queueLeave(player);
    if(player.matchId) this.leaveMatch(player, "disconnect");
    this.players.delete(player.id);
  }

  queueJoin(player, mode){
    const norm = normalizeMode(mode);
    if(!player || !norm) return;

    if(norm === "SOLO"){
      this.queueLeave(player);
      if(player.matchId) this.leaveMatch(player, "queueJoin");
      this._createSoloMatch(player);
      return;
    }

    if(player.matchId) this.leaveMatch(player, "queueJoin");
    this.queueLeave(player);

    player.queuedMode = norm;
    this.queues[norm].push(player);
    this.sendQueueStatus(norm);
    this.processQueues();
  }

  queueLeave(player){
    if(!player || !player.queuedMode) return;
    const mode = player.queuedMode;
    const queue = this.queues[mode] || [];
    this.queues[mode] = queue.filter(p => p.id !== player.id);
    player.queuedMode = null;
    this.sendQueueStatus(mode);
  }

  processQueues(){
    for(const mode of Object.keys(this.queues)){
      const cfg = MODE_CFG[mode];
      let queue = this.queues[mode];
      while(queue.length >= cfg.minPlayers && this._getLiveMatchCount() < this.maxMatches){
        const take = queue.splice(0, cfg.maxPlayers);
        take.forEach(p => { p.queuedMode = null; });

        const match = this.createMatch(mode, cfg);
        for(const p of take){
          this._addPlayerToMatch(match, p);
        }
        this._assignHost(match);
        this._notifyMatchFound(match, take);
        this.broadcastLobbyState(match);
        queue = this.queues[mode];
      }
      this.sendQueueStatus(mode);
    }
  }

  createMatch(mode, cfg = {}){
    const matchId = String(this.nextMatchId++);
    const createdAt = this.now();
    const maps = this._selectLobbyMaps(mode, matchId, cfg.mapChoices || []);
    const match = {
      matchId,
      mode,
      status: "lobby",
      createdAt,
      startedAt: null,
      endedAt: null,
      hostPlayerId: null,
      players: new Map(),
      lobby: {
        motd: `Welcome to ${mode}`,
        maps,
        lockedMapId: null,
        readyById: new Map(),
        voteById: new Map(),
      },
      settings: {
        minPlayers: cfg.minPlayers || 1,
        maxPlayers: cfg.maxPlayers || 4,
        baseMapId: cfg.baseMapId || null,
      },
    };
    this.matches.set(matchId, match);
    return match;
  }

  joinMatch(matchId, player){
    const match = this.matches.get(String(matchId));
    if(!match) return { ok: false, reason: "notFound" };
    if(match.status !== "lobby") return { ok: false, reason: "notLobby" };
    if(match.players.size >= match.settings.maxPlayers) return { ok: false, reason: "full" };

    if(player.matchId && player.matchId !== match.matchId){
      this.leaveMatch(player, "switchMatch");
    }
    this.queueLeave(player);

    this._addPlayerToMatch(match, player);
    if(!match.hostPlayerId) this._assignHost(match);

    this.send(player, {
      t: "matchFound",
      matchId: match.matchId,
      mode: match.mode,
      hostPlayerId: match.hostPlayerId,
      youAreHost: match.hostPlayerId === player.id,
    });
    this.sendLobbyState(match, player);
    this.broadcastLobbyState(match);
    return { ok: true };
  }

  leaveMatch(player, reason = "left"){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match) {
      if(player) player.matchId = null;
      return;
    }
    match.players.delete(player.id);
    match.lobby.readyById.delete(player.id);
    match.lobby.voteById.delete(player.id);
    player.matchId = null;

    const wasHost = match.hostPlayerId === player.id;
    if(match.players.size === 0){
      this.endMatch(match.matchId, "empty");
      return;
    }

    if(wasHost){
      if(match.mode === "SOLO"){
        this.endMatch(match.matchId, "hostLeft");
        return;
      }
      this._assignHost(match);
      this.broadcastHostChanged(match);
    }

    if(match.status !== "ended") this.broadcastLobbyState(match);
  }

  handleLobbyReady(player, ready){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match || match.status !== "lobby") return;
    match.lobby.readyById.set(player.id, Boolean(ready));
    const readyCount = this._getReadyCount(match);
    const total = match.players.size;
    this.broadcast(match, { t: "lobby_ready", playerId: player.id, ready: Boolean(ready), readyCount, total });
  }

  handleLobbyVote(player, mapId){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match || match.status !== "lobby") return;
    const valid = this._isMapChoice(match, mapId) ? String(mapId) : null;
    match.lobby.voteById.set(player.id, valid);
    const counts = this._getVoteCounts(match);
    this.broadcast(match, { t: "lobby_vote", playerId: player.id, mapId: valid, counts });
  }

  handleLobbyStart(player){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match || match.status !== "lobby") return { ok: false, reason: "invalid" };
    if(match.hostPlayerId !== player.id) return { ok: false, reason: "notHost" };
    if(!this._isReadyToStart(match)) return { ok: false, reason: "notReady" };

    const locked = this._pickWinningMapId(match);
    match.lobby.lockedMapId = locked;
    match.status = "active";
    match.startedAt = this.now();

    this.broadcast(match, { t: "lobby_lock", lockedMapId: locked });
    this.broadcast(match, { t: "matchStarted", matchId: match.matchId, mode: match.mode, lockedMapId: locked });
    return { ok: true };
  }

  endMatch(matchId, reason = "ended"){
    const match = this.matches.get(String(matchId));
    if(!match || match.status === "ended") return;
    match.status = "ended";
    match.endedAt = this.now();

    const players = Array.from(match.players.values());
    for(const player of players){
      this.send(player, { t: "matchEnded", matchId: match.matchId, reason });
      player.matchId = null;
    }
    match.players.clear();

    if(match._cleanupTimer) clearTimeout(match._cleanupTimer);
    match._cleanupTimer = setTimeout(()=>{
      this.matches.delete(match.matchId);
    }, this.graceMs);
    this.processQueues();
  }

  sendServerList(player, { showAll = false } = {}){
    const now = this.now();
    const servers = [];
    for(const match of this.matches.values()){
      if(match.status === "ended") continue;
      if(!showAll && match.status !== "lobby") continue;
      const host = match.hostPlayerId ? match.players.get(match.hostPlayerId) : null;
      servers.push({
        matchId: match.matchId,
        mode: match.mode,
        status: match.status,
        playerCount: match.players.size,
        maxPlayers: match.settings.maxPlayers,
        hostName: host?.name || "Unknown",
        mapOptions: (match.lobby.maps || []).map(m => ({ id: m.id, name: m.name })),
        ageSeconds: nowSeconds(now - match.createdAt),
      });
    }
    this.send(player, {
      t: "serverList",
      servers,
      maxMatches: this.maxMatches,
      queueSizes: {
        MP: this.queues.MP.length,
        ZM: this.queues.ZM.length,
      },
    });
  }

  handleSnapshot(player, msg){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match || match.status !== "active") return;
    player.lastSnap = {
      pos: msg.pos,
      rot: msg.rot,
      hp: msg.hp,
      weaponId: msg.weaponId,
    };
  }

  handleHit(player, msg){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match || match.status !== "active" || match.mode !== "MP") return;
    const targetId = String(msg.targetId || "");
    const target = match.players.get(targetId);
    if(!target) return;

    const dmg = Math.max(1, Math.min(200, Number(msg.amount || 20)));
    target.lastSnap = target.lastSnap || {};
    const hp0 = Number(target.lastSnap.hp ?? 100);
    const hp1 = Math.max(0, hp0 - dmg);
    target.lastSnap.hp = hp1;

    this.send(player, { t: "hitConfirm", targetId, amount: dmg, hp: hp1 });
    this.send(target, { t: "gotHit", attackerId: player.id, amount: dmg, hp: hp1 });
    if(hp1 <= 0){
      target.lastSnap.hp = 100;
      this.send(target, { t: "died", attackerId: player.id });
      this.send(player, { t: "killed", targetId });
    }
  }

  relayToMatch(player, msg){
    const match = player?.matchId ? this.matches.get(player.matchId) : null;
    if(!match) return;
    this.broadcast(match, msg);
  }

  tick(){
    for(const match of this.matches.values()){
      if(match.status !== "active") continue;
      const players = Array.from(match.players.values());
      const roster = players.map(p => ({
        id: p.id,
        name: p.name,
        team: 0,
        mode: match.mode,
        hp: p.lastSnap?.hp ?? 100,
        pos: p.lastSnap?.pos ?? { x: 0, y: 1.7, z: 0 },
        rot: p.lastSnap?.rot ?? { yaw: 0, pitch: 0 },
        weaponId: p.lastSnap?.weaponId ?? null,
      }));
      for(const p of players){
        this.send(p, { t: "state", players: roster });
      }
    }
  }

  sendQueueStatus(mode){
    const queue = this.queues[mode] || [];
    for(const player of queue){
      this.send(player, { t: "queueStatus", mode, queuedCount: queue.length, eta: null });
    }
  }

  broadcastLobbyState(match){
    const payload = this._buildLobbyState(match);
    this.broadcast(match, payload);
  }

  sendLobbyState(match, player){
    this.send(player, this._buildLobbyState(match));
  }

  broadcastHostChanged(match){
    this.broadcast(match, {
      t: "hostChanged",
      matchId: match.matchId,
      hostPlayerId: match.hostPlayerId,
    });
  }

  _buildLobbyState(match){
    const readyById = {};
    for(const [id, ready] of match.lobby.readyById.entries()){
      readyById[id] = Boolean(ready);
    }
    const voteById = {};
    for(const [id, mapId] of match.lobby.voteById.entries()){
      voteById[id] = mapId || null;
    }
    const readyCount = this._getReadyCount(match);
    return {
      t: "lobby_state",
      lobby: {
        matchId: match.matchId,
        mode: match.mode,
        status: match.status,
        hostPlayerId: match.hostPlayerId,
        players: Array.from(match.players.values()).map(p => ({ id: p.id, name: p.name })),
        readyById,
        voteById,
        readyCount,
        total: match.players.size,
        maps: match.lobby.maps || [],
        lockedMapId: match.lobby.lockedMapId || null,
        motd: match.lobby.motd || "",
      },
    };
  }

  _createSoloMatch(player){
    if(this._getLiveMatchCount() >= this.maxMatches) return;
    const cfg = MODE_CFG.SOLO;
    const match = this.createMatch("SOLO", cfg);
    this._addPlayerToMatch(match, player);
    this._assignHost(match);
    this._notifyMatchFound(match, [player]);
    this.sendLobbyState(match, player);
    this.broadcastLobbyState(match);
  }

  _addPlayerToMatch(match, player){
    match.players.set(player.id, player);
    player.matchId = match.matchId;
  }

  _assignHost(match){
    const candidates = Array.from(match.players.values());
    if(candidates.length === 0){
      match.hostPlayerId = null;
      return;
    }
    candidates.sort((a, b)=>{
      const na = Number(a.id);
      const nb = Number(b.id);
      if(Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return (a.connectedAt || 0) - (b.connectedAt || 0);
    });
    match.hostPlayerId = candidates[0].id;
  }

  _notifyMatchFound(match, players){
    for(const player of players){
      this.send(player, {
        t: "matchFound",
        matchId: match.matchId,
        mode: match.mode,
        hostPlayerId: match.hostPlayerId,
        youAreHost: match.hostPlayerId === player.id,
      });
    }
  }

  _selectLobbyMaps(mode, matchId, choices){
    const cfgChoices = Array.isArray(choices) ? choices : [];
    if(cfgChoices.length <= 2) return cfgChoices.slice();
    const start = (Number(matchId) - 1) % cfgChoices.length;
    const first = cfgChoices[start % cfgChoices.length];
    const second = cfgChoices[(start + 1) % cfgChoices.length];
    return [first, second];
  }

  _isMapChoice(match, mapId){
    if(!mapId) return false;
    return (match.lobby.maps || []).some(m => String(m.id) === String(mapId));
  }

  _getVoteCounts(match){
    const counts = {};
    for(const map of match.lobby.maps || []){
      counts[String(map.id)] = 0;
    }
    for(const mapId of match.lobby.voteById.values()){
      if(!mapId) continue;
      const key = String(mapId);
      if(counts[key] === undefined) counts[key] = 0;
      counts[key] += 1;
    }
    return counts;
  }

  _pickWinningMapId(match){
    const counts = this._getVoteCounts(match);
    const options = (match.lobby.maps || []).map(m => String(m.id));
    if(options.length === 0) return match.settings.baseMapId || null;
    let best = options[0];
    let bestCount = counts[best] || 0;
    for(const id of options){
      const c = counts[id] || 0;
      if(c > bestCount || (c === bestCount && id < best)){
        best = id;
        bestCount = c;
      }
    }
    return bestCount > 0 ? best : (match.settings.baseMapId || best);
  }

  _getReadyCount(match){
    let count = 0;
    for(const id of match.players.keys()){
      if(match.lobby.readyById.get(id)) count += 1;
    }
    return count;
  }

  _isReadyToStart(match){
    const total = match.players.size;
    if(total < match.settings.minPlayers) return false;
    const readyCount = this._getReadyCount(match);
    if(match.mode === "MP"){
      return readyCount >= Math.ceil(total / 2);
    }
    return readyCount >= 1;
  }

  _getLiveMatchCount(){
    let count = 0;
    for(const match of this.matches.values()){
      if(match.status !== "ended") count += 1;
    }
    return count;
  }

  send(player, payload){
    try { this.wsSend?.(player.sock, payload); } catch {}
  }

  broadcast(match, payload){
    for(const player of match.players.values()){
      this.send(player, payload);
    }
  }
}
