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
    this.matchId = null;
    this.matchMode = null;

    this.state = new LobbyState({ motd: DEFAULT_MOTD });
    this.ui = new LobbyUI({
      state: this.state,
      onBack: ()=>this.handleBack(),
      onReadyToggle: ()=>this.handleReadyToggle(),
      onVote: (mapId)=>this.handleVote(mapId),
      onStart: ()=>this.handleStart(),
      onCreateClass: ()=>this.handleCreateClass(),
      onScriptToggle: (script, selected)=>this.handleScriptToggle(script, selected),
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
    this._unsubs.push(ev.on("match:lobbyState", (payload)=>this.applyLobbyState(payload)));
    this._unsubs.push(ev.on("match:hostChanged", ({ matchId, hostPlayerId })=>{
      if(this.matchId && String(matchId) === String(this.matchId)){
        this.state.setHostId(hostPlayerId);
        this.ui.update();
      }
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
    const list = mode === "mp" ? mpMaps : zmMaps;
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
    if(net?.players?.size){
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
    const m = mode || this.engine.ctx.session?.mode || "zm";
    this.state.setMode(m);
    this.state.setMaps(this.pickMaps(m));
    if(!this.state.motd) this.state.setMotd(DEFAULT_MOTD);
    this.refreshPlayersFromNet();
    this.refreshDzsLibrary();

    // Exit pointer lock for mouse-driven lobby
    if(document.pointerLockElement) document.exitPointerLock();

    this.menu.showHud(false);
    this.menu.setOverlay(null);
    this.menu.setScreen(this.ui.screen);
    this.ui.update();
  }

  isHost(){
    const hostId = this.state.getHostId();
    const localId = this.getLocalPlayerId();
    return hostId && localId && String(hostId) === String(localId);
  }

  async refreshDzsLibrary(){
    try{
      const res = await fetch("/api/dzs/library");
      const data = await res.json();
      const list = Array.isArray(data?.scripts) ? data.scripts : [];
      this.state.setDzsLibrary(list);
      this.ui.update();
    } catch (err){
      this.engine.events.emit("menu:toast", { msg: `Scripts load failed: ${err?.message || err}` });
    }
  }

  async handleScriptToggle(script, selected){
    const filename = String(script?.filename || "");
    if(!filename) return;
    if(!this.isHost()){
      this.engine.events.emit("menu:toast", { msg: "Host-only script preload." });
      return;
    }
    const matchId = this.engine?.ctx?.matchSession?.matchId;
    const clientId = this.engine?.ctx?.net?.clientId;
    if(!matchId || !clientId){
      this.engine.events.emit("menu:toast", { msg: "Missing match or client id." });
      return;
    }
    if(selected){
      const entry = this.state.getDzsSelection(filename);
      if(entry?.scriptId){
        try{
          const res = await fetch("/api/dzs/unload", {
            method: "POST",
            headers: {
              "Content-Type":"application/json",
              "x-dzs-client-id": clientId,
              "x-dzs-match-id": matchId,
            },
            body: JSON.stringify({ scriptId: entry.scriptId, matchId, clientId }),
          });
          const data = await res.json();
          if(!data?.ok){
            this.engine.events.emit("menu:toast", { msg: `Unload failed: ${data?.error || res.status}` });
            return;
          }
        } catch (err){
          this.engine.events.emit("menu:toast", { msg: `Unload failed: ${err?.message || err}` });
          return;
        }
        this.engine?.ctx?.dzsStudio?.remove?.(entry.scriptId);
      }
      this.state.removeDzsSelection(filename);
      this.ui.update();
      return;
    }

    let text = "";
    try{
      const res = await fetch(`/api/dzs/library/read?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if(!data?.ok){
        this.engine.events.emit("menu:toast", { msg: `Read failed: ${data?.error || res.status}` });
        return;
      }
      text = String(data?.text || "");
    } catch (err){
      this.engine.events.emit("menu:toast", { msg: `Read failed: ${err?.message || err}` });
      return;
    }

    try{
      const res = await fetch("/api/dzs/inject", {
        method: "POST",
        headers: {
          "Content-Type":"application/json",
          "x-dzs-client-id": clientId,
          "x-dzs-match-id": matchId,
        },
        body: JSON.stringify({ filename, text, matchId, clientId }),
      });
      const data = await res.json();
      if(!data?.ok){
        this.engine.events.emit("menu:toast", { msg: `Inject failed: ${data?.error || res.status}` });
        return;
      }
      const scriptId = data.scriptId;
      this.engine?.ctx?.dzsStudio?.installDzs?.({ scriptId, filename, text, ownerId: clientId });
      this.state.setDzsSelection({
        filename,
        name: script?.name || filename,
        desc: script?.desc || "",
        tags: script?.tags || [],
        scriptId,
      });
      this.ui.update();
    } catch (err){
      this.engine.events.emit("menu:toast", { msg: `Inject failed: ${err?.message || err}` });
    }
  }

  applyLobbyState(payload = {}){
    const mode = payload.mode === "zombies" ? "zm" : "mp";
    this.matchId = payload.matchId ? String(payload.matchId) : this.matchId;
    this.matchMode = payload.mode || this.matchMode;
    this.state.setMode(mode);
    this.state.setHostId(payload.hostPlayerId || null);
    const players = (payload.players || []).map(p=>({
      id: String(p.id),
      name: p.name || `Player${p.id}`,
    }));
    this.state.setPlayers(players);
    this.state.readyByPlayerId.clear();
    for(const p of (payload.players || [])){
      this.state.setReady(String(p.id), Boolean(p.ready));
    }
    this.ui.update();
  }

  handleBack(){
    this.menu.setScreen(null);
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
    if(!this.state.isReadyToStart()){
      this.engine.events.emit("menu:toast", { msg: "Need more players ready" });
      return;
    }
    const winnerId = this.state.pickWinningMapId();
    const mode = this.state.mode || this.engine.ctx.session?.mode || "zm";
    const mapDef = mode === "mp" ? getMpMap(winnerId) : getZmMap(winnerId);
    this.onStartGame?.(mapDef?.id || winnerId);
  }
}
