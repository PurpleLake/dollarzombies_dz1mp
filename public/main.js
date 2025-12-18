import { Engine } from "/engine/core/scripts/Engine.js";
import { ECS } from "/engine/core/scripts/ECS.js";
import { Log } from "/engine/core/utilities/Log.js";
import { ScriptLoader } from "/engine/core/scripts/ScriptLoader.js";
import { DzsScriptManager } from "/engine/core/dzs/runtime/DzsScriptManager.js";
import { ZmGame } from "/engine/game/zm/scripts/ZmGame.js";
import { MpGame } from "/engine/game/mp/scripts/MpGame.js";
import { NetClient } from "/engine/core/scripts/net/NetClient.js";
import { TriggerSystem } from "/engine/core/scripts/triggers/TriggerSystem.js";
import { EntityRegistry } from "/engine/core/scripts/entities/EntityRegistry.js";
import { AudioSystem } from "/engine/core/scripts/audio/AudioSystem.js";
import { WeaponDB } from "/engine/core/weapons/scripts/WeaponDB.js";
import { NotificationManager } from "/engine/core/ui/scripts/notifications/NotificationManager.js";
import { NameplateManager } from "/engine/core/ui/scripts/nameplates/NameplateManager.js";
import { injectNameplateStyles } from "/engine/core/ui/scripts/nameplates/NameplateStyles.js";
import { injectNotificationStyles } from "/engine/core/ui/scripts/notifications/NotificationStyles.js";

import { UIRoot } from "/engine/core/ui/scripts/UIRoot.js";
import { ThemeManager } from "/engine/core/ui/scripts/Theme.js";
import { OptionsStore } from "/engine/core/ui/scripts/Options.js";
import { MenuManager } from "/engine/core/ui/scripts/MenuManager.js";
import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

import { MainMenuScreen } from "/engine/core/ui/scripts/screens/MainMenuScreen.js";
import { MapSelectScreen } from "/engine/core/ui/scripts/screens/MapSelectScreen.js";
import { LoadoutSelectScreen } from "/engine/core/ui/scripts/screens/LoadoutSelectScreen.js";
import { SettingsScreen } from "/engine/core/ui/scripts/screens/SettingsScreen.js";
import { PauseMenuOverlay } from "/engine/core/ui/scripts/screens/PauseMenuOverlay.js";
import { QueueScreen } from "/engine/core/ui/scripts/screens/QueueScreen.js";
import { ServerBrowserScreen } from "/engine/core/ui/scripts/screens/ServerBrowserScreen.js";
import { HudSystem } from "/engine/core/ui/scripts/HudSystem.js";
import { DevModule } from "/engine/game/zm/dev/scripts/DevModule.js";
import { zmMaps, getZmMap } from "/engine/game/zm/maps/MapRegistry.js";
import { mpMaps, getMpMap } from "/engine/game/mp/maps/MapRegistry.js";
import { LobbyController } from "/engine/core/scripts/lobby/LobbyController.js";

// Debug log (bottom-left)
const logEl = document.getElementById("log");
function uiLog(line){
  if(!logEl) return;
  const div = document.createElement("div");
  div.textContent = line;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

// HUD elements (top-left pills)
const waveNum = document.getElementById("waveNum");
const aliveNum = document.getElementById("aliveNum");
const hpNum = document.getElementById("hpNum");
  const cashNum = document.getElementById("cashNum");
const weaponName = document.getElementById("weaponName");
const ammoText = document.getElementById("ammoText");

// Engine UI root + theme + options
const uiRoot = new UIRoot();
const theme = new ThemeManager();
theme.apply();
const options = new OptionsStore();

// Move HUD under engine-owned HUD layer
const hudEl = document.getElementById("hud");
try { uiRoot.layers.hud.appendChild(hudEl); } catch {}

// Core engine
const engine = new Engine();
const menu = new MenuManager({ uiRoot, events: engine.events, theme });

  const hudSystem = new HudSystem({ uiRoot, events: engine.events });
  engine.ctx.hud = hudSystem;

engine.ctx.ui = { uiLog };
engine.ctx.uiRoot = uiRoot;
engine.ctx.theme = theme;
engine.ctx.options = options;
engine.ctx.menu = menu;

// Networking (WS) - used by Zombies (4p co-op) and Multiplayer (6v6)
const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
engine.ctx.net = new NetClient({ url: wsUrl, engine, desiredMode: options.get("gameMode") || "zm" });
engine.ctx.net.connect();

// Core subsystems
engine.ctx.audio = new AudioSystem();
engine.ctx.entities = new EntityRegistry(engine);
engine.ctx.triggers = new TriggerSystem(engine);

// Trigger prompt UI
const promptEl = document.createElement("div");
promptEl.style.position = "fixed";
promptEl.style.left = "50%";
promptEl.style.bottom = "64px";
promptEl.style.transform = "translateX(-50%)";
promptEl.style.zIndex = "9997";
promptEl.style.padding = "10px 14px";
promptEl.style.borderRadius = "12px";
promptEl.style.background = "rgba(0,0,0,0.45)";
promptEl.style.backdropFilter = "blur(10px)";
promptEl.style.color = "#fff";
promptEl.style.fontFamily = "system-ui, Segoe UI, Arial";
promptEl.style.fontSize = "14px";
promptEl.style.letterSpacing = "0.3px";
promptEl.style.display = "none";
document.body.appendChild(promptEl);

engine.events.on("trigger:prompt", (e)=>{
  const txt = String(e?.prompt || "");
  if(!txt){ promptEl.style.display="none"; promptEl.textContent=""; return; }
  promptEl.style.display="block";
  promptEl.textContent = txt.replace(/\^\d/g, ""); // plain fallback; color handled by notifications/HUD
});
  // Preload weapons for menus (mode-agnostic)
  engine.ctx.weapons = new WeaponDB();
  injectNotificationStyles();
  injectNameplateStyles();
  engine.ctx.notifications = new NotificationManager(engine);
  engine.ctx.nameplates = new NameplateManager(engine);
// Dev menu (global listener + overlay)
const dev = new DevModule({ engine });
engine.ctx.devModule = dev;
engine.events.on("menu:toast", ({ msg })=> menu.toast(msg));

// Hook UI updates
engine.events.on("log", ({ msg }) => uiLog(msg));
engine.events.on("zm:wave", ({ wave }) => { if(waveNum) waveNum.textContent = String(wave); });
engine.events.on("zm:alive", ({ alive }) => { if(aliveNum) aliveNum.textContent = String(alive); });
engine.events.on("player:hp", ({ hp }) => { if(hpNum) hpNum.textContent = String(Math.max(0, Math.floor(hp))); });

  engine.events.on("cash:change", ({ cash })=>{ if(cashNum) cashNum.textContent = String(cash); });

engine.events.on("weapon:equipped", ({ name, clip, reserve }) => {
  if(weaponName) weaponName.textContent = name;
  if(ammoText) ammoText.textContent = ` ${clip}/${reserve}`;
});
engine.events.on("weapon:reloadEnd", ({ clip, reserve }) => {
  if(ammoText) ammoText.textContent = ` ${clip}/${reserve}`;
});

// Scripts + game
const scripts = new ScriptLoader({ engine });
engine.ctx.dzsStudio = new DzsScriptManager({ runtime: scripts.dzs, events: engine.events });
let game = null;

const initialMode = options.get("gameMode") || "zm";
const defaultZm = getZmMap(options.get("zmMap"));
const defaultMp = getMpMap(options.get("mpMap"));
const session = engine.ctx.session = {
  mode: initialMode,
  mapSelections: { zm: defaultZm.id, mp: defaultMp.id },
  mapId: initialMode === "mp" ? defaultMp.id : defaultZm.id,
};
engine.ctx.net?.setMode?.(session.mode);

const ClientState = Object.freeze({
  MENU: "MENU",
  QUEUEING: "QUEUEING",
  LOBBY: "LOBBY",
  IN_MATCH: "IN_MATCH",
});

const matchSession = engine.ctx.matchSession = {
  state: ClientState.MENU,
  matchId: null,
  matchMode: null,
  hostPlayerId: null,
};

function uiModeToMatch(mode){
  return mode === "zm" ? "zombies" : "solo";
}

function matchModeToUi(mode){
  return mode === "zombies" ? "zm" : "mp";
}

function setClientState(next){
  matchSession.state = next;
}

function getModeMaps(mode){
  return mode === "mp" ? mpMaps : zmMaps;
}

function getModeSelection(mode){
  return mode === "mp" ? session.mapSelections.mp : session.mapSelections.zm;
}

function setModeSelection(mode, id){
  if(mode === "mp") session.mapSelections.mp = id;
  else session.mapSelections.zm = id;
}

function resolveMapIdForMode(mode){
  const maps = getModeMaps(mode);
  const fallback = maps.find(m=>!m.disabled) || maps[0];
  const selected = getModeSelection(mode) || fallback?.id;
  const valid = maps.find(m=>m.id === selected && !m.disabled) ? selected : fallback?.id;
  if(valid) setModeSelection(mode, valid);
  return valid;
}

function isMapIdValidForMode(mode, id){
  if(!id) return false;
  const maps = getModeMaps(mode);
  return Boolean(maps.find(m=>m.id === id && !m.disabled));
}

const lobby = new LobbyController({
  engine,
  menu,
  options,
  onStartGame: (mapId)=>{
    const mode = session.mode || "zm";
    session.mapId = mapId;
    if(mode === "mp") session.mapSelections.mp = mapId;
    else session.mapSelections.zm = mapId;
    engine.ctx.net?.sendStartMatch?.();
  },
  onBackToMenu: ()=> leaveMatchToMenu(),
  onCreateClass: ()=> showClassSelect({ returnToLobby:true }),
});
engine.ctx.lobby = { controller: lobby, state: lobby.state };

let queueView = null;
let serverBrowserView = null;
const serverBrowserState = { servers: [], showAll: false };

engine.events.on("queue:status", ({ mode, queuedCount })=>{
  if(!queueView || matchSession.state !== ClientState.QUEUEING) return;
  if(mode !== matchSession.matchMode) return;
  queueView.setStatus?.(`In queue: ${queuedCount} player${queuedCount === 1 ? "" : "s"}`);
});

engine.events.on("match:found", ({ matchId, mode, hostPlayerId })=>{
  matchSession.matchId = String(matchId);
  matchSession.matchMode = mode;
  matchSession.hostPlayerId = hostPlayerId || null;
  const uiMode = matchModeToUi(mode);
  session.mode = uiMode;
  session.mapId = resolveMapIdForMode(uiMode);
  showLobby(uiMode);
});

engine.events.on("match:lobbyState", (payload)=>{
  if(!payload?.matchId) return;
  matchSession.matchId = String(payload.matchId);
  matchSession.matchMode = payload.mode || matchSession.matchMode;
  matchSession.hostPlayerId = payload.hostPlayerId || matchSession.hostPlayerId;
});

engine.events.on("match:started", ({ matchId })=>{
  if(matchSession.matchId && String(matchSession.matchId) !== String(matchId)) return;
  const mode = matchModeToUi(matchSession.matchMode || "zombies");
  session.mode = mode;
  startGame(mode);
});

engine.events.on("match:ended", ({ matchId, reason })=>{
  if(matchSession.matchId && String(matchSession.matchId) !== String(matchId)) return;
  matchSession.matchId = null;
  matchSession.matchMode = null;
  matchSession.hostPlayerId = null;
  destroyCurrentGame();
  showMainMenu();
  if(reason) menu.toast(`Match ended: ${reason}`);
});

engine.events.on("match:joinFailed", ({ reason })=>{
  menu.toast(`Join failed: ${reason || "unknown"}`);
  showServerBrowser();
});

engine.events.on("match:endDenied", ({ reason })=>{
  menu.toast(`End denied: ${reason || "not permitted"}`);
});

engine.events.on("server:list", ({ servers })=>{
  serverBrowserState.servers = Array.isArray(servers) ? servers : [];
  serverBrowserView?.setServers?.(serverBrowserState.servers);
});

engine.events.on("server:master", (payload)=>{
  engine.ctx.serverMaster = payload;
});

function getCurrentMapDef(mode=session.mode){
  const pick = isMapIdValidForMode(mode, session.mapId)
    ? session.mapId
    : resolveMapIdForMode(mode);
  session.mapId = pick;
  if(mode === "mp") return getMpMap(pick);
  return getZmMap(pick);
}

function resetEcs(){
  engine.ecs = new ECS();
  engine.ctx.ecs = engine.ecs;
}

function destroyCurrentGame(){
  if(game){
    try{ game.dispose?.(); } catch {}
  }
  game = null;
  engine.ctx.game = null;
  engine.ctx.canvas = null;
  engine.ctx.renderer = null;
  engine.ctx.input = null;
  engine.ctx.world = null;
  engine.ctx.worldBuilder = null;
  resetEcs();
}

// Apply options live
options.onChange((data, key, value)=>{
  if(key === "mouseSensitivity" && engine.ctx.input) engine.ctx.input.mouse.sensitivity = value;
  if(key === "fov" && engine.ctx.renderer){
    engine.ctx.renderer.camera.fov = value;
    engine.ctx.renderer.camera.updateProjectionMatrix();
  }
});

async function loadAllScripts(mode=session.mode){
  if(logEl) logEl.innerHTML = "";
  uiLog("Loading manifest...");
  const manifestCandidates = (mode === "mp")
    ? ["/public/scripts/mp_manifest.json", "/scripts/mp_manifest.json"]
    : ["/public/scripts/manifest.json", "/scripts/manifest.json"];
  scripts.dzs?.clear?.();
  let loaded = false;
  let lastErr = null;
  for(const manifest of manifestCandidates){
    try {
      await scripts.loadManifest(manifest);
      loaded = true;
      break;
    } catch (err){
      lastErr = err;
    }
  }
  if(!loaded){
    throw lastErr || new Error("Manifest load failed");
  }
  uiLog("Loading scripts...");
  await scripts.loadAll();
  uiLog("Binding DZS handlers...");
  scripts.bindAll();
  uiLog("Ready.");
}

async function loadMapForMode(mode, mapDef){
  const existingBuilder = engine.ctx.worldBuilder || engine.ctx.world;
  const builder = existingBuilder || new WorldBuilder({ engine, renderer: engine.ctx.renderer });
  engine.ctx.world = builder;
  engine.ctx.worldBuilder = builder;
  try { builder.clearWorld?.(); } catch {}

  const mod = await import(mapDef.entryScript + `?v=${Date.now()}`);
  const buildResult = (typeof mod.buildMap === "function") ? await mod.buildMap(engine, builder) : null;
  const spawns = mod.spawnPoints || buildResult || {};
  const mapCtx = { id: mapDef.id, mode, root: mapDef.root, def: mapDef, spawnPoints: spawns };
  if(mode === "mp"){
    mapCtx.mpSpawnsTeam0 = spawns.teamA || spawns.team0 || spawns.mpSpawnsTeam0 || [];
    mapCtx.mpSpawnsTeam1 = spawns.teamB || spawns.team1 || spawns.mpSpawnsTeam1 || [];
  } else {
    mapCtx.playerSpawns = spawns.players || spawns.playerSpawns || [];
    mapCtx.zombieSpawns = spawns.zombies || spawns.zombieSpawns || [];
  }
  engine.ctx.map = mapCtx;
  engine.events.emit(`${mode}:mapLoaded`, { map: mapDef.id });
  return spawns;
}

async function startGame(modeOverride){
  const mode = modeOverride || session.mode || "zm";
  const mapDef = getCurrentMapDef(mode);
  session.mapId = mapDef.id;
  try{
    options.set("gameMode", mode);
    if(mode === "mp") options.set("mpMap", mapDef.id);
    else options.set("zmMap", mapDef.id);
    engine.ctx.net?.setMode?.(mode);

    destroyCurrentGame();
    game = (mode === "mp") ? new MpGame({ engine, scripts }) : new ZmGame({ engine, scripts });
    engine.ctx.game = game;

    await loadAllScripts(mode);
    const spawnPoints = await loadMapForMode(mode, mapDef);
    if(typeof game.applySpawnPoints === "function") game.applySpawnPoints(spawnPoints);
    await game.start({ mapDef, spawnPoints });

    // initialize option values after game constructs input/renderer
    if(engine.ctx.input) engine.ctx.input.mouse.sensitivity = options.get("mouseSensitivity");
    if(engine.ctx.renderer){
      engine.ctx.renderer.camera.fov = options.get("fov");
      engine.ctx.renderer.camera.updateProjectionMatrix();
    }
    if(!engine.loop.running) engine.start();
    engine.ctx.timeScale = 1;
    menu.setScreen(null);
    menu.setOverlay(null);
    menu.showHud(true);
    setClientState(ClientState.IN_MATCH);
  } catch (err){
    uiLog('[scripts] ERROR: ' + (err?.stack || err));
    menu.toast('Script load failed (see log)');
    throw err;
  }
}


function showSettings({ overlay=false } = {}){
  const node = SettingsScreen({
    menu,
    theme,
    options,
    engine,
    onBack: ()=>{
      if(overlay) showPauseOverlay();
      else showMainMenu();
    }
  });
  if(overlay) menu.setOverlay(node);
  else menu.setScreen(node);
}

function showQueue(mode=session.mode){
  const label = mode === "mp" ? "Solo" : "Zombies";
  const view = QueueScreen({
    modeLabel: label,
    onCancel: ()=> leaveQueueToMenu(),
  });
  queueView = view;
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(view.screen);
}

function queueForMode(mode){
  session.mode = mode || "zm";
  session.mapId = resolveMapIdForMode(session.mode);
  matchSession.matchMode = uiModeToMatch(session.mode);
  matchSession.matchId = null;
  matchSession.hostPlayerId = null;
  setClientState(ClientState.QUEUEING);
  showQueue(session.mode);
  engine.ctx.net?.sendQueueJoin?.(matchSession.matchMode);
}

function leaveQueueToMenu(){
  engine.ctx.net?.sendQueueLeave?.();
  matchSession.matchMode = null;
  setClientState(ClientState.MENU);
  showMainMenu();
}

function leaveMatchToMenu(){
  engine.ctx.net?.sendLeaveMatch?.();
  matchSession.matchId = null;
  matchSession.matchMode = null;
  matchSession.hostPlayerId = null;
  destroyCurrentGame();
  showMainMenu();
}

function showMapSelect(mode="zm"){
  const maps = mode === "mp" ? mpMaps : zmMaps;
  const fallback = maps.find(m=>!m.disabled) || maps[0];
  session.mode = mode;
  let selectedId = (mode === "mp" ? session.mapSelections.mp : session.mapSelections.zm) || fallback?.id;
  if(maps.find(m=>m.id === selectedId && m.disabled)) selectedId = fallback?.id;
  session.mapId = selectedId;

  const applySelection = (id)=>{
    const def = mode === "mp" ? getMpMap(id) : getZmMap(id);
    selectedId = def.id;
    session.mapId = def.id;
    if(mode === "mp") session.mapSelections.mp = def.id;
    else session.mapSelections.zm = def.id;
  };

  applySelection(selectedId);
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(MapSelectScreen({
    mode,
    maps,
    selectedId,
    onSelect: (id)=> applySelection(id),
    onBack: ()=> showMainMenu(),
    onPlay: (id)=>{
      applySelection(id || selectedId);
      // Map select flow now routes through lobby start
      queueForMode(mode);
    },
  }));
}

function showServerBrowser(){
  const view = ServerBrowserScreen({
    servers: serverBrowserState.servers,
    showAll: serverBrowserState.showAll,
    onRefresh: (showAll)=>{
      serverBrowserState.showAll = Boolean(showAll);
      engine.ctx.net?.sendServerList?.(serverBrowserState.showAll);
    },
    onJoin: (matchId)=> engine.ctx.net?.sendJoinMatch?.(matchId),
    onBack: ()=> showMainMenu(),
  });
  serverBrowserView = view;
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(view.screen);
  engine.ctx.net?.sendServerList?.(serverBrowserState.showAll);
}

function showLobby(mode=session.mode){
  const m = mode || "zm";
  session.mode = m;
  session.mapId = resolveMapIdForMode(m);
  engine.ctx.net?.setMode?.(m);
  setClientState(ClientState.LOBBY);
  lobby.show(m);
}


function showClassSelect({ returnToLobby=false } = {}){
  const mode = session.mode || "zm";
  if(mode === "mp"){
    menu.toast("Multiplayer class editor coming soon.");
    return returnToLobby ? showLobby(mode) : showMainMenu();
  }
  menu.showHud(false);
  menu.setOverlay(null);

  const weapons = engine.ctx.weapons?.list?.() || [];
  const currentPrimary = options.get("loadoutPrimary") || weapons[0]?.id || null;
  const currentSecondary = options.get("loadoutSecondary") || (weapons.find(w=> (w.attributes||[]).includes("pistol"))?.id) || weapons[0]?.id || null;

  menu.setScreen(LoadoutSelectScreen({
    weapons,
    selectedPrimaryId: currentPrimary,
    selectedSecondaryId: currentSecondary,
    onBack: ()=> returnToLobby ? showLobby(session.mode) : showMainMenu(),
    onConfirm: ({ primaryId, secondaryId })=>{
      if(primaryId) options.set("loadoutPrimary", primaryId);
      if(secondaryId) options.set("loadoutSecondary", secondaryId);
      menu.toast(`Loadout set: ${primaryId || "none"} / ${secondaryId || "none"}`);
      if(returnToLobby) showLobby(session.mode);
      else showMainMenu();
    }
  }));
}

function showMainMenu(){
  setClientState(ClientState.MENU);
  engine.ctx.net?.setMode?.("idle");
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(MainMenuScreen({
    mode: session.mode,
    onMode: (m)=> queueForMode(m),
    onPlay: ()=> queueForMode(session.mode),
    onClass: ()=> showClassSelect(),
    onBrowser: ()=> showServerBrowser(),
    onSettings: ()=> showSettings({ overlay:false }),
  }));
}

function showPauseOverlay(){
  menu.setScreen(null);
  menu.setOverlay(PauseMenuOverlay({
    onResume: ()=> resumeFromPause(),
    onSettings: ()=> showSettings({ overlay:true }),
    onQuit: ()=> exitToMenu(),
  }));
}

function pauseGame(){
  engine.ctx.timeScale = 0;
  if(document.pointerLockElement) document.exitPointerLock();
  showPauseOverlay();
}

function resumeFromPause(){
  engine.ctx.timeScale = 1;
  menu.setOverlay(null);
  menu.toast("Resumed");
}

function exitToMenu(){
  engine.ctx.timeScale = 1;
  menu.setOverlay(null);
  engine.ctx.net?.sendLeaveMatch?.();
  engine.ctx.net?.sendQueueLeave?.();
  matchSession.matchId = null;
  matchSession.matchMode = null;
  matchSession.hostPlayerId = null;
  // soft-reset
  try { engine.ctx.game?.zombies?.clear?.(); } catch {}
  try { engine.ctx.game?.world?.clearWorld?.(); } catch {}
  destroyCurrentGame();
  showMainMenu();
}

// Pause toggle (Esc)
engine.events.on("menu:togglePause", ()=>{
  const inGame = (menu.screenEl === null); // if no full screen menu, assume in-game
  if(!inGame) return;
  if(engine.ctx.timeScale === 0) resumeFromPause();
  else pauseGame();
});


// Keep ammo UI fresh
engine.events.on("engine:tick", ()=>{
  const p = engine.ctx.player;
  if(p?.weapon && ammoText){
    ammoText.textContent = ` ${p.weapon.clip}/${p.weapon.reserve}`;
  }
});

// Boot: show main menu
showMainMenu();

// If something throws, show it
window.addEventListener("error", (e) => uiLog("[error] " + (e?.error?.stack || e.message)));
Log.info("Boot ok");
