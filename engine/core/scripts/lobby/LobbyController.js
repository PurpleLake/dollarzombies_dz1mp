import { LobbyState } from "/engine/core/scripts/lobby/LobbyState.js";
import { LobbyUI } from "/engine/core/scripts/lobby/LobbyUI.js";
import { zmMaps, getZmMap } from "/engine/game/zm/maps/MapRegistry.js";
import { mpMaps, getMpMap } from "/engine/game/mp/maps/MapRegistry.js";

const DEFAULT_MOTD = "MOTD: Welcome to Dollar Zombies. Be nice. Shoot straighter.";

export class LobbyController {
  constructor({ engine, menu, options, onStartGame, onBackToMenu, onCreateClass }){
    this.engine = engine;
    this.menu = menu;
    this.options = options;
    this.onStartGame = onStartGame;
    this.onBackToMenu = onBackToMenu;
    this.onCreateClass = onCreateClass;

    this.state = new LobbyState({ motd: DEFAULT_MOTD });
    this.ui = new LobbyUI({
      state: this.state,
      onBack: ()=>this.handleBack(),
      onReadyToggle: ()=>this.handleReadyToggle(),
      onVote: (mapId)=>this.handleVote(mapId),
      onStart: ()=>this.handleStart(),
      onCreateClass: ()=>this.handleCreateClass(),
      getLocalPlayerId: ()=>this.getLocalPlayerId(),
    });

    this._unsubs = [];
    this._bindEvents();
  }

  dispose(){
    for(const off of this._unsubs) try { off?.(); } catch {}
    this._unsubs.length = 0;
  }

  getLocalPlayerId(){
    const net = this.engine.ctx.net;
    if(net?.clientId) return String(net.clientId);
    return "local";
  }

  _bindEvents(){
    const ev = this.engine.events;
    this._unsubs.push(ev.on("net:state", ()=>this.refreshPlayersFromNet()));
    this._unsubs.push(ev.on("net:welcome", ()=>this.refreshPlayersFromNet()));
    this._unsubs.push(ev.on("net:close", ()=>this.refreshPlayersFromNet()));
    this._unsubs.push(ev.on("net:lobby_state", (msg)=>{
      const lobby = msg.lobby || {};
      if(lobby.matchId) this.state.setMatch(lobby.matchId);
      if(lobby.hostPlayerId) this.state.setHost(lobby.hostPlayerId);
      if(lobby.mode) this.state.setMode(lobby.mode);
      if(Array.isArray(lobby.players)) this.state.setPlayers(lobby.players);
      if(lobby.readyById) this.state.setReadyMap(lobby.readyById);
      if(lobby.voteById) this.state.setVoteMap(lobby.voteById);
      if(Array.isArray(lobby.maps)){
        const resolved = lobby.maps.map((m)=>{
          const id = String(m.id);
          const isMp = lobby.mode === "MP";
          const def = isMp ? getMpMap(id) : getZmMap(id);
          return { ...def, id, name: m.name || def?.name || id };
        });
        this.state.setMaps(resolved);
      }
      if(lobby.lockedMapId) this.state.setLockedMapId(lobby.lockedMapId);
      if(typeof lobby.motd === "string") this.state.setMotd(lobby.motd);
      this.ui.update();
    }));
    this._unsubs.push(ev.on("net:hostChanged", ({ hostPlayerId })=>{
      if(hostPlayerId) this.state.setHost(hostPlayerId);
      this.ui.update();
    }));
    this._unsubs.push(ev.on("net:lobby_lock", ({ lockedMapId })=>{
      if(lockedMapId) this.state.setLockedMapId(lockedMapId);
      this.ui.update();
    }));

    // Lobby broadcasts (future-proof for net relay)
    this._unsubs.push(ev.on("lobby:ready", ({ playerId, ready })=>{
      this.state.setReady(playerId, ready);
      this.ui.update();
    }));
    this._unsubs.push(ev.on("lobby:vote", ({ playerId, mapId })=>{
      this.state.setVote(playerId, mapId);
      this.ui.update();
    }));
    this._unsubs.push(ev.on("lobby:motd", ({ text })=>{
      if(typeof text === "string"){
        this.state.setMotd(text);
        this.ui.update();
      }
    }));
  }

  pickMaps(mode){
    const list = (mode === "MP") ? mpMaps : zmMaps;
    const choices = list.filter(m => !m.hidden).slice(0, 2);
    if(choices.length >= 2) return choices;
    if(choices.length === 1){
      choices.push({
        id: `${mode}_comingsoon_placeholder`,
        name: "Coming Soon",
        desc: "More battlegrounds on the way.",
        preview: choices[0].preview,
        entryScript: "",
        disabled: true,
      });
    }
    if(choices.length === 0){
      const fallback = {
        id: `${mode}_default`,
        name: "Coming Soon",
        desc: "Maps will appear here.",
        preview: "",
        entryScript: "",
        disabled: true,
      };
      return [fallback, fallback];
    }
    return choices.slice(0, 2);
  }

  refreshPlayersFromNet(){
    const net = this.engine.ctx.net;
    let players = [];
    if(Array.isArray(net?.lobbyPlayers) && net.lobbyPlayers.length){
      players = net.lobbyPlayers.map(p=>({ id: String(p.id), name: p.name || `Player${p.id}` }));
    } else if(net?.players?.size){
      players = Array.from(net.players.values()).map(p=>({
        id: String(p.id),
        name: p.name || `Player${p.id}`,
      }));
    } else if(Array.isArray(this.engine.ctx.players) && this.engine.ctx.players.length){
      players = this.engine.ctx.players.map(p=>({
        id: String(p.id),
        name: p.name || `Player${p.id}`,
      }));
    } else {
      players = [{ id: this.getLocalPlayerId(), name: "Player" }];
    }
    this.state.setPlayers(players);
    this.ui.update();
  }

  show(mode){
    const m = mode || this.engine.ctx.session?.matchMode || "ZM";
    this.state.setMode(m);
    this.state.setMaps(this.pickMaps(m));
    if(!this.state.motd) this.state.setMotd(DEFAULT_MOTD);
    this.refreshPlayersFromNet();

    // Exit pointer lock for mouse-driven lobby
    if(document.pointerLockElement) document.exitPointerLock();

    this.menu.showHud(false);
    this.menu.setOverlay(null);
    this.menu.setScreen(this.ui.screen);
    this.ui.update();
  }

  handleBack(){
    this.menu.setScreen(null);
    this.engine.ctx.net?.leaveMatch?.();
    this.onBackToMenu?.();
  }

  handleReadyToggle(){
    const id = this.getLocalPlayerId();
    const next = this.state.toggleReady(id);
    this.engine.events.emit("lobby:ready", { playerId: id, ready: next });
    this.engine.ctx.net?.sendLobbyReady?.(next);
    this.ui.update();
  }

  handleVote(mapId){
    const id = this.getLocalPlayerId();
    this.state.setVote(id, mapId);
    this.engine.events.emit("lobby:vote", { playerId: id, mapId });
    this.engine.ctx.net?.sendLobbyVote?.(mapId);
    this.ui.update();
  }

  handleCreateClass(){
    this.onCreateClass?.();
  }

  handleStart(){
    const hostId = this.state.getHostId();
    const localId = this.getLocalPlayerId();
    if(hostId && hostId !== String(localId)){
      this.engine.events.emit("menu:toast", { msg: "Only host can start" });
      return;
    }
    const winnerId = this.state.pickWinningMapId();
    const mode = this.state.mode || this.engine.ctx.session?.matchMode || "ZM";
    const mapDef = mode === "MP" ? getMpMap(winnerId) : getZmMap(winnerId);
    const mapId = mapDef?.id || winnerId;
    this.state.setLockedMapId(mapId);
    this.engine.ctx.net?.startLobby?.();
  }
}
