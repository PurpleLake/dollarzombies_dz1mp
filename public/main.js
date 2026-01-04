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
import { ClassEditorScreen } from "/engine/core/ui/scripts/screens/ClassEditorScreen.js";
import { SettingsScreen } from "/engine/core/ui/scripts/screens/SettingsScreen.js";
import { PauseMenuOverlay } from "/engine/core/ui/scripts/screens/PauseMenuOverlay.js";
import { QueueScreen } from "/engine/core/ui/scripts/screens/QueueScreen.js";
import { ServerBrowserScreen } from "/engine/core/ui/scripts/screens/ServerBrowserScreen.js";
import { HudSystem } from "/engine/core/ui/scripts/HudSystem.js";
import { ZmGameOverScreen } from "/engine/core/ui/scripts/screens/ZmGameOverScreen.js";
import { MpModeSelectScreen } from "/engine/core/ui/scripts/screens/MpModeSelectScreen.js";
import { MpMatchResultsScreen } from "/engine/core/ui/scripts/screens/MpMatchResultsScreen.js";
import { MpClassScreen } from "/engine/core/ui/scripts/screens/MpClassScreen.js";
import { PreLobbyScreen } from "/engine/core/ui/scripts/screens/PreLobbyScreen.js";
import { DevModule } from "/engine/game/zm/dev/scripts/DevModule.js";
import { zmMaps, getZmMap } from "/engine/game/zm/maps/MapRegistry.js";
import { mpMaps, getMpMap } from "/engine/game/mp/maps/MapRegistry.js";
import { LobbyController } from "/engine/core/scripts/lobby/LobbyController.js";
import { MapCompiler } from "/engine/tools/map_editor/MapCompiler.js";
import { mpGamemodes, getMpGamemode } from "/engine/game/mp/scripts/GamemodeRegistry.js";

const buildFlags = { soloMenuOnly: false };
async function loadBuildFlags(){
  try{
    const res = await fetch("/api/config", { cache: "no-store" });
    if(!res.ok) return;
    const data = await res.json();
    buildFlags.soloMenuOnly = Boolean(data?.soloMenuOnly);
  } catch {}
}

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
const bo2Hud = document.getElementById("bo2-hud");
const mpTeamA = document.getElementById("mpTeamA");
const mpTeamB = document.getElementById("mpTeamB");
const mpScoreA = document.getElementById("mpScoreA");
const mpScoreB = document.getElementById("mpScoreB");
const mpTopCenter = document.getElementById("mp-top-center");
const bo2TopLeft = document.getElementById("bo2-top-left");
const bo2BottomLeft = document.getElementById("bo2-bottom-left");
const crosshair = document.getElementById("crosshair");

// Engine UI root + theme + options
const uiRoot = new UIRoot();
const theme = new ThemeManager();
theme.apply();
const options = new OptionsStore();
function setUiMode(mode){
  const next = (mode === "zm_solo") ? "zm" : (mode || "zm");
  if(uiRoot?.el) uiRoot.el.dataset.uiMode = next;
}

function setHudVisibility(mode){
  if(bo2Hud) bo2Hud.style.display = "";
  const isMp = mode === "mp";
  if(bo2TopLeft) bo2TopLeft.style.display = isMp ? "none" : "";
  if(bo2BottomLeft) bo2BottomLeft.style.display = isMp ? "none" : "";
  if(mpTopCenter) mpTopCenter.style.display = isMp ? "" : "none";
  if(crosshair) crosshair.style.display = "";
}

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
engine.ctx.matchState = {};
engine.ctx.buildFlags = buildFlags;

// Networking (WS) - used by Zombies (4p co-op) and Multiplayer (6v6)
const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
engine.ctx.net = new NetClient({ url: wsUrl, engine, desiredMode: options.get("gameMode") || "zm" });
engine.ctx.net.name = options.get("playerName") || engine.ctx.net.name;
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

const dzsStudioChannel = new BroadcastChannel("dzs-studio");
function broadcastDzsInstalled(){
  const mgr = engine?.ctx?.dzsStudio;
  if(!mgr) return;
  const scriptsList = mgr.listAll?.() || mgr.list?.() || [];
  dzsStudioChannel.postMessage({ t: "dzs:installedList", scripts: scriptsList });
}
dzsStudioChannel.onmessage = (ev)=>{
  const data = ev?.data || {};
  const mgr = engine?.ctx?.dzsStudio;
  if(!mgr) return;
  if(data.t === "dzs:install"){
    if(!data.scriptId) return;
    mgr.installDzs?.({ scriptId: data.scriptId, filename: data.filename, text: data.text, ownerId: data.ownerId });
    broadcastDzsInstalled();
  } else if(data.t === "dzs:disable"){
    if(!data.scriptId) return;
    mgr.disable?.(data.scriptId);
    broadcastDzsInstalled();
  } else if(data.t === "dzs:remove"){
    if(!data.scriptId) return;
    mgr.remove?.(data.scriptId);
    broadcastDzsInstalled();
  }
};

// Hook UI updates
engine.events.on("log", ({ msg }) => uiLog(msg));
engine.events.on("zm:wave", ({ wave }) => { if(waveNum) waveNum.textContent = String(wave); });
engine.events.on("zm:alive", ({ alive }) => { if(aliveNum) aliveNum.textContent = String(alive); });
engine.events.on("player:hp", ({ hp }) => { if(hpNum) hpNum.textContent = String(Math.max(0, Math.floor(hp))); });
engine.events.on("mp:playerDamaged", ({ hp }) => { if(hpNum && hp != null) hpNum.textContent = String(Math.max(0, Math.floor(hp))); });
engine.events.on("mp:playerSpawn", ()=>{
  const maxHp = Number(engine.ctx.matchState?.tdm?.maxHp ?? 100);
  if(hpNum) hpNum.textContent = String(Math.max(0, Math.floor(maxHp)));
});
engine.events.on("zm:zombieDeath", () => { zmStats.kills += 1; });
engine.events.on("zm:playerDeath", () => { zmStats.downs += 1; });

  engine.events.on("cash:change", ({ cash })=>{ if(cashNum) cashNum.textContent = String(cash); });

engine.events.on("weapon:equipped", ({ name, clip, reserve }) => {
  if(weaponName) weaponName.textContent = name;
  if(ammoText) ammoText.textContent = ` ${clip}/${reserve}`;
});
engine.events.on("weapon:reloadEnd", ({ clip, reserve }) => {
  if(ammoText) ammoText.textContent = ` ${clip}/${reserve}`;
});

engine.events.on("mp:matchState", ({ state })=>{
  const tdm = state?.tdm || {};
  if(mpTeamA) mpTeamA.textContent = String(tdm.teamAName || "Alpha");
  if(mpTeamB) mpTeamB.textContent = String(tdm.teamBName || "Bravo");
  if(mpScoreA) mpScoreA.textContent = String(tdm.scoreA ?? 0);
  if(mpScoreB) mpScoreB.textContent = String(tdm.scoreB ?? 0);
  if(hpNum && tdm.maxHp != null){
    const cur = Number(hpNum.textContent || tdm.maxHp);
    if(cur > tdm.maxHp) hpNum.textContent = String(tdm.maxHp);
  }
});

// Scripts + game
const scripts = new ScriptLoader({ engine });
engine.ctx.dzsStudio = new DzsScriptManager({ runtime: scripts.dzs, events: engine.events });
let game = null;
let mpClassPrompted = false;

const initialMode = options.get("gameMode") || "zm";
const defaultZm = getZmMap(options.get("zmMap"));
const defaultMp = getMpMap(options.get("mpMap"));
const session = engine.ctx.session = {
  mode: initialMode,
  mpGamemode: options.get("mpGamemode") || "TDM",
  mapSelections: { zm: defaultZm.id, mp: defaultMp.id },
  mapId: initialMode === "mp" ? defaultMp.id : defaultZm.id,
  matchTypeByMode: { mp: "public", zm: "public" },
};
setUiMode(session.mode);
engine.ctx.net?.setMode?.(session.mode);

const CUSTOM_MAP_KEY = "dz_custom_maps_v1";
let customMaps = loadCustomMaps();
let pendingImportMode = "zm";

function normalizeModeTag(tag){
  const t = String(tag || "").toLowerCase();
  if(t === "mp" || t === "multiplayer") return "mp";
  if(t === "zm" || t === "zombies" || t === "zombie") return "zm";
  return null;
}

function normalizeCustomMapRecord(record){
  if(!record || !record.id) return null;
  const rawModes = Array.isArray(record.modes) ? record.modes : (record.mode ? [record.mode] : []);
  const modes = rawModes.map(normalizeModeTag).filter(Boolean);
  const entryDzmapData = record.entryDzmapData || null;
  return {
    id: String(record.id),
    name: String(record.name || record.id),
    desc: String(record.desc || "Custom map"),
    preview: String(record.preview || ""),
    entryDzmapData,
    modes: modes.length ? modes : ["zm"],
    isCustom: true,
  };
}

function loadCustomMaps(){
  try{
    const raw = localStorage.getItem(CUSTOM_MAP_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCustomMapRecord).filter(Boolean);
  } catch {
    return [];
  }
}

function persistCustomMaps(){
  try{
    const payload = customMaps.map(m=>({
      id: m.id,
      name: m.name,
      desc: m.desc,
      preview: m.preview,
      modes: m.modes,
      entryDzmapData: m.entryDzmapData,
    }));
    localStorage.setItem(CUSTOM_MAP_KEY, JSON.stringify(payload));
  } catch {}
}

function getCustomMapsForMode(mode){
  const key = mode === "mp" ? "mp" : "zm";
  return customMaps.filter(m=>Array.isArray(m.modes) && m.modes.includes(key));
}

async function importCustomMapFromFile(file){
  const text = await file.text();
  let data;
  try{
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
  if(!data || data.format !== "dzmap"){
    throw new Error("Invalid dzmap file");
  }
  const baseName = String(file?.name || "custom").replace(/\.dzmap$/i, "");
  const rawModes = Array.isArray(data?.meta?.modes) ? data.meta.modes : [];
  const modes = rawModes.map(normalizeModeTag).filter(Boolean);
  const fallbackMode = pendingImportMode === "mp" ? "mp" : "zm";
  const record = {
    id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: String(data?.meta?.name || baseName || "Custom Map"),
    desc: String(data?.meta?.desc || data?.meta?.description || "Custom map"),
    preview: String(data?.meta?.preview || ""),
    entryDzmapData: data,
    modes: modes.length ? modes : [fallbackMode],
    isCustom: true,
  };
  customMaps.push(record);
  persistCustomMaps();
  return record;
}

const mapImportInput = document.createElement("input");
mapImportInput.type = "file";
mapImportInput.accept = ".dzmap,application/json";
mapImportInput.style.display = "none";
document.body.appendChild(mapImportInput);
mapImportInput.addEventListener("change", async ()=>{
  const file = mapImportInput.files?.[0] || null;
  mapImportInput.value = "";
  if(!file) return;
  try{
    const record = await importCustomMapFromFile(file);
    menu.toast(`Map imported: ${record.name}`);
    if(record?.id){
      if(pendingImportMode === "mp") session.mapSelections.mp = record.id;
      else session.mapSelections.zm = record.id;
      session.mapId = record.id;
    }
    showPreLobby(session.mode);
  } catch (err){
    menu.toast(`Map import failed: ${err?.message || err}`);
  }
});

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
  matchGamemode: null,
};

const zmStats = engine.ctx.zmStats = { kills: 0, downs: 0 };

function uiModeToMatch(mode){
  if(mode === "zm") return "zombies";
  if(mode === "mp") return "mp";
  return "solo";
}

function matchModeToUi(mode){
  if(mode === "zombies") return "zm";
  if(mode === "mp") return "mp";
  if(mode === "solo") return "mp";
  return "mp";
}

function setClientState(next){
  matchSession.state = next;
}

function getModeMaps(mode, { includeCustom = true } = {}){
  const base = mode === "mp" ? mpMaps : zmMaps;
  if(!includeCustom) return base;
  return [...base, ...getCustomMapsForMode(mode)];
}

function getModeSelection(mode){
  return mode === "mp" ? session.mapSelections.mp : session.mapSelections.zm;
}

function setModeSelection(mode, id){
  if(mode === "mp") session.mapSelections.mp = id;
  else session.mapSelections.zm = id;
}

function resolveMapIdForMode(mode, { includeCustom = true } = {}){
  const maps = getModeMaps(mode, { includeCustom });
  const fallback = maps.find(m=>!m.disabled) || maps[0];
  const selected = getModeSelection(mode) || fallback?.id;
  const valid = maps.find(m=>m.id === selected && !m.disabled) ? selected : fallback?.id;
  if(valid) setModeSelection(mode, valid);
  return valid;
}

function isMapIdValidForMode(mode, id, { includeCustom = true } = {}){
  if(!id) return false;
  const maps = getModeMaps(mode, { includeCustom });
  return Boolean(maps.find(m=>m.id === id && !m.disabled));
}

function getMatchTypeKey(mode){
  return mode === "mp" ? "mp" : "zm";
}

function getMatchType(mode){
  const key = getMatchTypeKey(mode);
  return session.matchTypeByMode[key] || "public";
}

function setMatchType(mode, type){
  const key = getMatchTypeKey(mode);
  session.matchTypeByMode[key] = type === "private" ? "private" : "public";
}

function getMapDefForMode(mode, id, { includeCustom = true } = {}){
  const maps = getModeMaps(mode, { includeCustom });
  const match = maps.find(m=>m.id === id && !m.disabled);
  return match || maps.find(m=>!m.disabled) || maps[0];
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

engine.events.on("match:found", ({ matchId, mode, hostPlayerId, gamemode })=>{
  matchSession.matchId = String(matchId);
  matchSession.matchMode = mode;
  matchSession.matchGamemode = gamemode || null;
  matchSession.hostPlayerId = hostPlayerId || null;
  engine.ctx.matchState = { gamemode: gamemode || null };
  const uiMode = matchModeToUi(mode);
  session.mode = uiMode;
  setUiMode(session.mode);
  session.mapId = resolveMapIdForMode(uiMode);
  if(matchSession.matchGamemode) session.mpGamemode = matchSession.matchGamemode;
  showLobby(uiMode);
});

engine.events.on("match:lobbyState", (payload)=>{
  if(!payload?.matchId) return;
  matchSession.matchId = String(payload.matchId);
  matchSession.matchMode = payload.mode || matchSession.matchMode;
  matchSession.matchGamemode = payload.gamemode || matchSession.matchGamemode;
  matchSession.hostPlayerId = payload.hostPlayerId || matchSession.hostPlayerId;
  if(payload.gamemode) session.mpGamemode = payload.gamemode;
  if(Array.isArray(payload.mapPool) && payload.mapPool.length){
    const first = payload.mapPool[0];
    if(first?.id){
      session.mapId = first.id;
      const uiMode = matchModeToUi(payload.mode || matchSession.matchMode || "zombies");
      setModeSelection(uiMode === "mp" ? "mp" : "zm", first.id);
    }
  }
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
  matchSession.matchGamemode = null;
  destroyCurrentGame();
  const lastMode = session.mode;
  const lastState = engine.ctx.matchState;
  if(lastMode === "mp" && lastState?.tdm){
    showMpMatchResults({ reason, state: lastState });
  } else {
    showMainMenu();
    if(reason) menu.toast(`Match ended: ${reason}`);
  }
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
  const pick = isMapIdValidForMode(mode, session.mapId, { includeCustom: true })
    ? session.mapId
    : resolveMapIdForMode(mode, { includeCustom: true });
  session.mapId = pick;
  return getMapDefForMode(mode, pick, { includeCustom: true });
}

function resetEcs(){
  engine.ecs = new ECS();
  engine.ctx.ecs = engine.ecs;
}

function destroyCurrentGame(){
  try { engine.ctx.triggers?.clear?.(); } catch {}
  try { engine.ctx.entities?.clear?.(); } catch {}
  try { engine.ctx.nameplates?.clear?.(); } catch {}
  try { engine.ctx.hud?.clear?.(); } catch {}
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
  engine.ctx.map = null;
  engine.ctx.players = [];
  mpClassPrompted = false;
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
  engine.ctx.dzsStudio?.reenableAll?.();
  broadcastDzsInstalled();
  uiLog("Ready.");
}

async function loadMapForMode(mode, mapDef){
  const existingBuilder = engine.ctx.worldBuilder || engine.ctx.world;
  const builder = existingBuilder || new WorldBuilder({ engine, renderer: engine.ctx.renderer });
  engine.ctx.world = builder;
  engine.ctx.worldBuilder = builder;
  try { builder.clearWorld?.(); } catch {}

  if(mapDef?.entryDzmapData){
    const compiler = new MapCompiler(engine);
    const raw = mapDef.entryDzmapData;
    let data = raw;
    if(typeof raw === "string"){
      try { data = JSON.parse(raw); } catch { throw new Error("Invalid dzmap data"); }
    }
    const build = compiler.compile(data, { mode, clearWorld:false, mapDef });
    const spawns = build.spawnPoints || {};
    engine.events.emit(`${mode}:mapLoaded`, { map: mapDef.id });
    return spawns;
  }

  const dzmapPath = mapDef.entryDzmap || (mapDef.entryScript && mapDef.entryScript.endsWith(".dzmap") ? mapDef.entryScript : null);
  if(dzmapPath){
    const res = await fetch(dzmapPath, { cache:"no-store" });
    if(!res.ok) throw new Error(`Failed to load dzmap: ${dzmapPath}`);
    const data = await res.json();
    const compiler = new MapCompiler(engine);
    const build = compiler.compile(data, { mode, clearWorld:false, mapDef });
    const spawns = build.spawnPoints || {};
    engine.events.emit(`${mode}:mapLoaded`, { map: mapDef.id });
    return spawns;
  }

  const mod = await import(mapDef.entryScript + `?v=${Date.now()}`);
  const buildResult = (typeof mod.buildMap === "function") ? await mod.buildMap(engine, builder) : null;
  const spawns = mod.spawnPoints || buildResult || {};
  const mapCtx = {
    id: mapDef.id,
    mode,
    root: mapDef.root,
    def: mapDef,
    spawnPoints: spawns,
    colliders: Array.isArray(builder?.colliders) ? builder.colliders.slice() : [],
  };
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
    scripts.dzs?.resetBetweenGames?.(matchSession.matchId);
    options.set("gameMode", mode);
    if(mode === "mp") options.set("mpMap", mapDef.id);
    else options.set("zmMap", mapDef.id);
    if(mode === "mp") options.set("mpGamemode", session.mpGamemode || "TDM");
    engine.ctx.net?.setMode?.(mode);

    destroyCurrentGame();
    if(mode === "zm"){
      zmStats.kills = 0;
      zmStats.downs = 0;
    }
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
      setHudVisibility(mode);
      setClientState(ClientState.IN_MATCH);
      if(mode === "mp" && !mpClassPrompted){
        mpClassPrompted = true;
        showMpClassSelect({ initial:true });
      }
    } catch (err){
    uiLog('[scripts] ERROR: ' + (err?.stack || err));
    menu.toast('Script load failed (see log)');
    throw err;
  }
}

function showMpClassSelect({ initial=false, returnToPause=false } = {}){
  if(document.pointerLockElement) document.exitPointerLock();
  if(initial) engine.ctx.timeScale = 0;
  menu.setScreen(null);
  menu.setOverlay(MpClassScreen({
    engine,
    onBack: ()=>{
      if(returnToPause) showPauseOverlay();
      else {
        engine.ctx.timeScale = 1;
        menu.setOverlay(null);
      }
    },
  }));
}


function showSettings({ overlay=false } = {}){
  setUiMode(session.mode);
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

function showPreLobby(mode=session.mode){
  const nextMode = mode || "zm";
  session.mode = nextMode;
  setUiMode(session.mode);

  const isMp = session.mode === "mp";
  const mapMode = isMp ? "mp" : "zm";
  const currentMatchType = getMatchType(mapMode);
  const isPrivate = currentMatchType === "private";
  const baseMaps = getModeMaps(mapMode, { includeCustom: false });
  const customMaps = isPrivate ? getCustomMapsForMode(mapMode) : [];
  const maps = isMp ? (isPrivate ? baseMaps : []) : baseMaps;
  const mapId = maps.length ? resolveMapIdForMode(mapMode, { includeCustom: isPrivate }) : null;
  if(mapId) session.mapId = mapId;

  if(isMp){
    const gm = getMpGamemode(session.mpGamemode || "TDM");
    session.mpGamemode = gm?.id || "TDM";
    options.set("mpGamemode", session.mpGamemode);
  }

  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(PreLobbyScreen({
    mode: session.mode,
    matchType: currentMatchType,
    maps,
    customMaps: isPrivate ? customMaps : [],
    selectedMapId: mapId,
    preferSolo: session.mode === "zm_solo",
    onSelectMap: (id)=>{
      if(!id) return;
      session.mapId = id;
      setModeSelection(mapMode, id);
    },
    onSelectMatchType: (type)=>{
      setMatchType(mapMode, type);
      if(type === "private"){
        const nextId = resolveMapIdForMode(mapMode, { includeCustom: true });
        if(nextId) session.mapId = nextId;
      }
    },
    onEditClass: ()=> showClassSelect({ returnToPreLobby:true }),
    onBack: ()=> showMainMenu(),
    onFindPublicGame: ()=> isMp ? showMpModeSelect() : queueForMode("zm"),
    onCreatePrivateMatch: ()=> createPrivateLobby(mapMode),
    onPlaySolo: ()=> queueForMode("zm_solo"),
    onImportMap: ()=> openMapImportDialog(mapMode),
  }));
}

function openMapImportDialog(mode){
  pendingImportMode = mode === "mp" ? "mp" : "zm";
  mapImportInput.click();
}

function showQueue(mode=session.mode){
  setUiMode(mode);
  const label = mode === "mp"
    ? `Multiplayer (${session.mpGamemode || "TDM"})`
    : (mode === "zm_solo" ? "Zombies (Solo)" : "Zombies");
  const view = QueueScreen({
    modeLabel: label,
    onCancel: ()=> leaveQueueToMenu(),
  });
  queueView = view;
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(view.screen);
}

function createPrivateLobby(mode="zm"){
  const uiMode = mode === "mp" ? "mp" : "zm";
  const mapId = resolveMapIdForMode(uiMode, { includeCustom: true });
  if(mapId) session.mapId = mapId;
  const mapDef = getMapDefForMode(uiMode, mapId, { includeCustom: true });
  const mapPool = mapDef ? [mapDef] : [];
  const gamemode = uiMode === "mp" ? (session.mpGamemode || "TDM") : null;
  matchSession.matchMode = uiModeToMatch(uiMode);
  matchSession.matchGamemode = gamemode;
  matchSession.matchId = null;
  matchSession.hostPlayerId = null;
  menu.toast("Creating private lobby...");
  engine.ctx.net?.sendCreateMatch?.({
    mode: matchSession.matchMode,
    gamemode,
    isPrivate: true,
    mapPool,
  });
}

function queueForMode(mode){
  session.mode = mode || "zm";
  setUiMode(session.mode);
  if(session.mode === "zm_solo"){
    session.mapId = resolveMapIdForMode("zm", { includeCustom: true });
    startGame("zm_solo");
    return;
  }
  if(session.mode === "mp"){
    const g = getMpGamemode(session.mpGamemode || "TDM");
    session.mpGamemode = g?.id || "TDM";
    options.set("mpGamemode", session.mpGamemode);
  }
  const mapMode = session.mode === "mp" ? "mp" : "zm";
  const includeCustom = getMatchType(mapMode) === "private";
  session.mapId = resolveMapIdForMode(mapMode, { includeCustom });
  matchSession.matchMode = uiModeToMatch(session.mode);
  matchSession.matchId = null;
  matchSession.hostPlayerId = null;
  matchSession.matchGamemode = session.mode === "mp" ? session.mpGamemode : null;
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
  setUiMode(session.mode);
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

function showMpModeSelect(){
  session.mode = "mp";
  setUiMode(session.mode);
  const pick = getMpGamemode(session.mpGamemode || "TDM");
  const selectedId = pick?.id || "TDM";
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(MpModeSelectScreen({
    modes: mpGamemodes,
    selectedId,
    onSelect: (id)=>{
      const gm = getMpGamemode(id);
      session.mpGamemode = gm?.id || "TDM";
      options.set("mpGamemode", session.mpGamemode);
    },
    onBack: ()=> showMainMenu(),
    onContinue: ()=> queueForMode("mp"),
  }));
}

function showServerBrowser(){
  setUiMode(session.mode);
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
  setUiMode(session.mode);
  session.mapId = resolveMapIdForMode(m);
  engine.ctx.net?.setMode?.(m);
  setClientState(ClientState.LOBBY);
  lobby.show(m);
}


function showClassSelect({ returnToLobby=false, returnToPreLobby=false } = {}){
  const mode = session.mode || "zm";
  setUiMode(mode);
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(ClassEditorScreen({
    engine,
    mode,
    onBack: ()=> returnToLobby ? showLobby(session.mode) : (returnToPreLobby ? showPreLobby(session.mode) : showMainMenu()),
    onConfirm: ()=>{
      menu.toast(`${mode === "mp" ? "Multiplayer" : "Zombies"} class updated.`);
      if(returnToLobby) showLobby(session.mode);
      else if(returnToPreLobby) showPreLobby(session.mode);
      else showMainMenu();
    },
  }));
}

function showCustomGames(){
  const baseMode = session.mode === "mp" ? "mp" : "zm";
  setMatchType(baseMode, "private");
  showPreLobby(baseMode);
}

function showMainMenu(){
  setClientState(ClientState.MENU);
  engine.ctx.net?.setMode?.("idle");
  engine.ctx.matchState = {};
  setUiMode(session.mode);
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(MainMenuScreen({
    mode: session.mode,
    onMode: (m)=> showPreLobby(m),
    onPlay: ()=> showPreLobby(session.mode),
    onClass: ()=> showClassSelect(),
    onBrowser: ()=> showServerBrowser(),
    onSettings: ()=> showSettings({ overlay:false }),
    onCustomGames: ()=> showCustomGames(),
    playerName: options.get("playerName"),
    soloOnly: engine.ctx.buildFlags?.soloMenuOnly,
    onName: (name)=>{
      options.set("playerName", name);
      engine.ctx.net?.setName?.(name);
    },
  }));
}

function showPauseOverlay(){
  setUiMode(session.mode);
  menu.setScreen(null);
  menu.setOverlay(PauseMenuOverlay({
    onResume: ()=> resumeFromPause(),
    onSettings: ()=> showSettings({ overlay:true }),
    onQuit: ()=> exitToMenu(),
    onClass: session.mode === "mp" ? ()=> showMpClassSelect({ returnToPause:true }) : null,
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

function showZmGameOver(){
  engine.ctx.timeScale = 0;
  menu.showHud(false);
  menu.setScreen(null);
  menu.setOverlay(ZmGameOverScreen({
    stats: {
      money: engine.ctx.cash?.get?.("p0") ?? 0,
      kills: zmStats.kills,
      downs: zmStats.downs,
    },
    onRestart: ()=>{
      engine.ctx.timeScale = 1;
      menu.setOverlay(null);
      startGame("zm");
    },
    onEnd: ()=> exitToMenu(),
  }));
}

function showMpMatchResults({ reason=null, state=null } = {}){
  engine.ctx.timeScale = 1;
  menu.showHud(false);
  menu.setScreen(null);
  menu.setOverlay(MpMatchResultsScreen({
    reason,
    state,
    onContinue: ()=> showMainMenu(),
  }));
}

// Pause toggle (Esc)
engine.events.on("menu:togglePause", ()=>{
  const inGame = (menu.screenEl === null); // if no full screen menu, assume in-game
  if(!inGame) return;
  if(engine.ctx.timeScale === 0) resumeFromPause();
  else pauseGame();
});

engine.events.on("zm:gameEnd", ()=> showZmGameOver());

engine.events.on("menu:chooseClass", ()=>{
  if(session.mode !== "mp") return;
  showMpClassSelect({ returnToPause: false });
});


// Keep ammo UI fresh
engine.events.on("engine:tick", ()=>{
  const p = engine.ctx.player;
  if(p?.weapon && ammoText){
    ammoText.textContent = ` ${p.weapon.clip}/${p.weapon.reserve}`;
  }
});

// Boot: resolve flags before showing menu
async function boot(){
  await loadBuildFlags();
  if(buildFlags.soloMenuOnly){
    session.mode = "zm_solo";
    setUiMode(session.mode);
  }
  showMainMenu();
}
boot();

// If something throws, show it
window.addEventListener("error", (e) => uiLog("[error] " + (e?.error?.stack || e.message)));
Log.info("Boot ok");
