import { Engine } from "/engine/core/scripts/Engine.js";
import { Log } from "/engine/core/utilities/Log.js";
import { ScriptLoader } from "/engine/core/scripts/ScriptLoader.js";
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

import { MainMenuScreen } from "/engine/core/ui/scripts/screens/MainMenuScreen.js";
import { LoadoutSelectScreen } from "/engine/core/ui/scripts/screens/LoadoutSelectScreen.js";
import { SettingsScreen } from "/engine/core/ui/scripts/screens/SettingsScreen.js";
import { PauseMenuOverlay } from "/engine/core/ui/scripts/screens/PauseMenuOverlay.js";
  import { HudSystem } from "/engine/core/ui/scripts/HudSystem.js";

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
engine.ctx.menu = menu;

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
const mode = options.get("gameMode") || "zm";
  engine.ctx.net?.setMode?.(mode);
  const game = (mode === "mp") ? new MpGame({ engine, scripts }) : new ZmGame({ engine, scripts });
  engine.ctx.game = game;

// Apply options live
options.onChange((data, key, value)=>{
  if(key === "mouseSensitivity" && engine.ctx.input) engine.ctx.input.mouse.sensitivity = value;
  if(key === "fov" && engine.ctx.renderer){
    engine.ctx.renderer.camera.fov = value;
    engine.ctx.renderer.camera.updateProjectionMatrix();
  }
});

async function loadAllScripts(){
  if(logEl) logEl.innerHTML = "";
  uiLog("Loading manifest...");
  const mode = options.get("gameMode") || "zm";
  const manifest = (mode === "mp") ? "/scripts/mp_manifest.json" : "/scripts/manifest.json";
  scripts.dzs?.clear?.();
  await scripts.loadManifest(manifest);
  uiLog("Loading scripts...");
  await scripts.loadAll();
  uiLog("Binding DZS handlers...");
  scripts.bindAll();
  uiLog("Ready.");
}

async function startGame(){
  try{
  await loadAllScripts();
  await game.start();
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
    onBack: ()=>{
      if(overlay) showPauseOverlay();
      else showMainMenu();
    }
  });
  if(overlay) menu.setOverlay(node);
  else menu.setScreen(node);
}


function showClassSelect(){
  const mode = options.get("gameMode") || "zm";
  if(mode === "mp") return showMpClass();
  menu.showHud(false);
  menu.setOverlay(null);

  const weapons = engine.ctx.weapons?.list?.() || [];
  const currentPrimary = options.get("loadoutPrimary") || weapons[0]?.id || null;
  const currentSecondary = options.get("loadoutSecondary") || (weapons.find(w=> (w.attributes||[]).includes("pistol"))?.id) || weapons[0]?.id || null;

  menu.setScreen(LoadoutSelectScreen({
    weapons,
    selectedPrimaryId: currentPrimary,
    selectedSecondaryId: currentSecondary,
    onBack: ()=> showMainMenu(),
    onConfirm: ({ primaryId, secondaryId })=>{
      if(primaryId) options.set("loadoutPrimary", primaryId);
      if(secondaryId) options.set("loadoutSecondary", secondaryId);
      menu.toast(`Loadout set: ${primaryId || "none"} / ${secondaryId || "none"}`);
      startGame();
    }
  }));
}

function showMainMenu(){
  menu.showHud(false);
  menu.setOverlay(null);
  menu.setScreen(MainMenuScreen({
    onPlay: ()=> showClassSelect(),
    onClass: ()=> showClassSelect(),
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
  // soft-reset
  try { engine.ctx.game?.zombies?.clear?.(); } catch {}
  try { engine.ctx.game?.world?.clear?.(); } catch {}
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


function showMpClass(){
  clearScreen();
  const s = MpClassScreen({
    engine,
    onBack: ()=> showMainMenu(),
  });
  mountScreen(s);
}
