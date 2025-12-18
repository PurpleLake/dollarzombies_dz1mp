const DEFAULT_GRACE_MS = 10000;
const SOLO_MAX = 1;
const ZOMBIES_MAX = 4;

function nowMs(){
  return Date.now();
}

function getMaxPlayers(mode){
  return mode === "zombies" ? ZOMBIES_MAX : SOLO_MAX;
}

export class MatchManager {
  constructor({ maxMatches = 10, send }) {
    this.maxMatches = maxMatches;
    this.send = send;
    this.matches = new Map(); // matchId -> match
    this._seq = 1;
  }

  createMatch(mode, settings = {}) {
    if (this.matches.size >= this.maxMatches) return null;
    const matchId = String(this._seq++);
    const match = {
      matchId,
      mode,
      status: "lobby",
      hostPlayerId: null,
      players: new Map(),
      readyByPlayerId: new Map(),
      voteByPlayerId: new Map(),
      state: {},
      settings,
      createdAt: nowMs(),
      startedAt: null,
      endedAt: null,
      cleanupAt: null,
    };
    this.matches.set(matchId, match);
    return matchId;
  }

  getMatch(matchId) {
    return this.matches.get(String(matchId)) || null;
  }

  joinMatch(matchId, client) {
    const match = this.getMatch(matchId);
    if (!match) return { ok: false, reason: "not_found" };
    if (match.status !== "lobby") return { ok: false, reason: "not_joinable" };
    if (match.players.size >= getMaxPlayers(match.mode)) return { ok: false, reason: "full" };
    if (!client) return { ok: false, reason: "invalid" };

    match.players.set(String(client.id), {
      id: String(client.id),
      name: client.name || `Player${client.id}`,
      ws: client.ws,
      joinedAt: nowMs(),
      lastSnap: client.lastSnap || null,
    });
    client.matchId = match.matchId;
    if (!match.hostPlayerId) {
      match.hostPlayerId = String(client.id);
    }
    return { ok: true, match };
  }

  leaveMatch(client, reason = "left") {
    if (!client || !client.matchId) return null;
    const match = this.getMatch(client.matchId);
    if (!match) {
      client.matchId = null;
      return null;
    }
    const pid = String(client.id);
    match.players.delete(pid);
    match.readyByPlayerId.delete(pid);
    match.voteByPlayerId.delete(pid);
    client.matchId = null;

    if (match.hostPlayerId === pid) {
      const nextHost = this.pickNextHost(match);
      if (nextHost) {
        match.hostPlayerId = nextHost;
        this.broadcast(match, { t: "hostChanged", matchId: match.matchId, hostPlayerId: nextHost });
      } else {
        this.endMatch(match.matchId, reason === "disconnect" ? "hostDisconnect" : "hostLeft");
        return match;
      }
    }

    if (match.players.size === 0) {
      this.endMatch(match.matchId, "empty");
      return match;
    }

    this.sendLobbyState(match);
    return match;
  }

  startMatch(matchId, client) {
    const match = this.getMatch(matchId);
    if (!match) return { ok: false, reason: "not_found" };
    if (match.status !== "lobby") return { ok: false, reason: "not_in_lobby" };
    if (client && String(client.id) !== String(match.hostPlayerId)) return { ok: false, reason: "not_host" };
    match.status = "active";
    match.startedAt = nowMs();
    this.broadcast(match, { t: "matchStarted", matchId: match.matchId });
    return { ok: true, match };
  }

  endMatch(matchId, reason = "ended") {
    const match = this.getMatch(matchId);
    if (!match) return null;
    if (match.status === "ended") return match;
    match.status = "ended";
    match.endedAt = nowMs();
    match.cleanupAt = match.endedAt + DEFAULT_GRACE_MS;
    this.broadcast(match, { t: "matchEnded", matchId: match.matchId, reason });
    return match;
  }

  broadcast(match, msg) {
    if (!match || !msg) return;
    for (const p of match.players.values()) {
      this.send(p.ws, msg);
    }
  }

  sendLobbyState(match) {
    if (!match) return;
    const players = [];
    for (const p of match.players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        ready: match.readyByPlayerId.get(String(p.id)) || false,
      });
    }
    this.broadcast(match, {
      t: "lobbyState",
      matchId: match.matchId,
      mode: match.mode,
      players,
      hostPlayerId: match.hostPlayerId,
    });
  }

  setReady(matchId, playerId, ready) {
    const match = this.getMatch(matchId);
    if (!match) return null;
    match.readyByPlayerId.set(String(playerId), Boolean(ready));
    this.sendLobbyState(match);
    return match;
  }

  setVote(matchId, playerId, mapId) {
    const match = this.getMatch(matchId);
    if (!match) return null;
    match.voteByPlayerId.set(String(playerId), mapId ? String(mapId) : null);
    this.broadcast(match, { t: "lobby_vote", playerId, mapId });
    return match;
  }

  pickNextHost(match) {
    let best = null;
    for (const p of match.players.values()) {
      if (!best) {
        best = p;
        continue;
      }
      if (p.joinedAt < best.joinedAt) best = p;
      else if (p.joinedAt === best.joinedAt && String(p.id) < String(best.id)) best = p;
    }
    return best ? String(best.id) : null;
  }

  tick() {
    const now = nowMs();
    for (const match of this.matches.values()) {
      if (match.status === "ended" && match.cleanupAt && now >= match.cleanupAt) {
        this.matches.delete(match.matchId);
      }
    }
  }

  buildServerList({ showAll = false } = {}) {
    const list = [];
    const now = nowMs();
    for (const match of this.matches.values()) {
      if (!showAll && match.status !== "lobby") continue;
      const host = match.hostPlayerId ? match.players.get(String(match.hostPlayerId)) : null;
      list.push({
        matchId: match.matchId,
        mode: match.mode,
        status: match.status,
        playerCount: match.players.size,
        maxPlayers: getMaxPlayers(match.mode),
        hostName: host?.name || null,
        mapName: match.settings?.mapName || null,
        ageSeconds: Math.max(0, Math.floor((now - match.createdAt) / 1000)),
        isPrivate: Boolean(match.settings?.isPrivate),
      });
    }
    return list;
  }

  buildServerMaster() {
    const now = nowMs();
    const matches = [];
    for (const match of this.matches.values()) {
      const host = match.hostPlayerId ? match.players.get(String(match.hostPlayerId)) : null;
      matches.push({
        matchId: match.matchId,
        mode: match.mode,
        status: match.status,
        playerCount: match.players.size,
        maxPlayers: getMaxPlayers(match.mode),
        hostName: host?.name || null,
        uptimeSeconds: Math.max(0, Math.floor((now - match.createdAt) / 1000)),
      });
    }
    return { matches, maxMatches: this.maxMatches };
  }
}
