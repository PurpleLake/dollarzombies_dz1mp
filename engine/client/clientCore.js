// IMPORTANT: load Three.js with a top-level await so we can surface failures
// on-screen (some environments block CDNs, which would otherwise look like a silent hang).
let THREE = null;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js");
} catch (e) {
  // We don't throw here so the UI + WS can still boot and show a readable error.
  console.error("Three.js failed to load", e);
}
import { initDevMenu } from "./dev/devMenu.js";

// We try to use a real low-poly zombie model (glTF). If it fails to load for any reason,
// we fall back to the built-in procedural zombie so the game still works.
let GLTFLoader = null;

const $ = (id)=>document.getElementById(id);

const ui = {
  status: $("status"),
  hp: $("hp"),
  cash: $("cash"),
  wave: $("wave"),
  z: $("z"),
  weapon: $("weapon"),
  ammo: $("ammo"),
  toast: $("toast"),
  btnPlay: $("btnPlay"),
  btnPause: $("btnPause"),
  panelPause: $("panelPause"),
  btnResume: $("btnResume"),
  btnLeave: $("btnLeave"),
  panelStart: $("panelStart"),
  panelRound: $("panelRound"),
  primaryList: $("primaryList"),
  pistolList: $("pistolList"),
  btnReady: $("btnReady"),
  btnDev: $("btnDev"),
  devMenu: $("devMenu"),
  devBody: $("devBody"),
  btnDevClose: $("btnDevClose"),
};

// On-screen debug overlay (so you can diagnose startup even when DevTools isn't open).
const dbg = (()=>{
  const el = document.createElement('div');
  el.id = 'dbg';
  el.style.position = 'fixed';
  el.style.left = '10px';
  el.style.bottom = '10px';
  el.style.maxWidth = 'min(520px, 95vw)';
  el.style.maxHeight = '45vh';
  el.style.overflow = 'auto';
  el.style.padding = '10px 12px';
  el.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  el.style.background = 'rgba(0,0,0,0.6)';
  el.style.color = '#fff';
  el.style.border = '1px solid rgba(255,255,255,0.18)';
  el.style.borderRadius = '10px';
  el.style.zIndex = '9999';
  el.style.pointerEvents = 'none';
  el.textContent = 'boot: starting…\n';
  document.body.appendChild(el);
  const lines = [];
  const log = (msg)=>{
    lines.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    while (lines.length > 20) lines.shift();
    el.textContent = lines.join('\n');
  };
  return { el, log };
})();

// Debug UI visibility can be toggled from the Dev Menu.
let debugVisible = true;
function setDebugVisible(v){
  debugVisible = !!v;
  dbg.el.style.display = debugVisible ? 'block' : 'none';
}
function isDebugVisible(){ return debugVisible; }

window.addEventListener('error', (e)=>{
  dbg.log(`ERROR: ${e.message}`);
  try { ui.status.textContent = `Error: ${e.message}`; } catch {}
});
window.addEventListener('unhandledrejection', (e)=>{
  dbg.log(`PROMISE: ${e.reason?.message || e.reason}`);
  try { ui.status.textContent = `Error: ${e.reason?.message || e.reason}`; } catch {}
});

if (!THREE){
  // Surface the root issue directly in the UI.
  dbg.log('boot: Three.js FAILED to load (CDN blocked/offline?)');
  try {
    ui.status.textContent = 'Three.js failed to load. Check internet/CDN access (cdn.jsdelivr.net).';
    if (ui.btnPlay) ui.btnPlay.disabled = true;
    if (ui.panelStart){
      const b = ui.panelStart.querySelector('.panelBody');
      if (b){
        const note = document.createElement('div');
        note.style.marginTop = '10px';
        note.style.opacity = '0.95';
        note.innerHTML = '<b>Render engine missing.</b> The game cannot start because Three.js failed to load. If you are offline or your network blocks CDNs, the client will appear to hang.';
        b.appendChild(note);
      }
    }
  } catch {}
}

function relockPointerSoon(){
  // Pointer lock can only be requested from a user gesture in some browsers.
  // We call this from click handlers (Resume/Close/etc.) and also schedule a
  // micro-delay so DOM changes settle.
  try {
    setTimeout(()=>{
      if (!renderer?.domElement) return;
      if (paused) return;
      if (!ui.panelStart?.classList.contains('hidden')) return;
      if (!ui.panelRound?.classList.contains('hidden')) return;
      if (!ui.panelPause?.classList.contains('hidden')) return;
      if (!ui.devMenu?.classList.contains('hidden')) return;
      const popup = document.getElementById('devPopup');
      if (popup && !popup.classList.contains('hidden')) return;
      renderer.domElement.requestPointerLock();
    }, 25);
  } catch (e) {}
}

function unlockPointer(){
  try { document.exitPointerLock?.(); } catch (e) {}
}

function toast(msg){
  ui.toast.textContent = msg;
  ui.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>ui.toast.classList.remove("show"), 900);
}

// Build the weapon pick lists (primary + pistol) for between-rounds UI.
// The server is authoritative; the client only displays options and sends picks.
function rebuildLists(){
  if (!ui.primaryList || !ui.pistolList) return;

  const me = (myId && state.players.has(myId)) ? state.players.get(myId) : null;
  const canPick = !!round?.between;

  const makeBtn = (wid, slot) => {
    const def = weapons?.[wid];
    const label = def?.name || wid;
    const cost = def?.cost != null ? def.cost : 0;

    const btn = document.createElement("button");
    btn.className = "item";
    btn.type = "button";

    const left = document.createElement("span");
    left.textContent = label;
    const right = document.createElement("b");
    right.textContent = cost ? `$${cost}` : "FREE";
    btn.appendChild(left);
    btn.appendChild(right);

    const isSelected = (slot === "primary")
      ? (me?.primary?.id === wid)
      : (me?.pistol?.id === wid);

    if (!canPick) btn.disabled = true;
    if (isSelected) btn.classList.add("active");

    btn.addEventListener("click", () => {
      if (!canPick) return;
      if (!ws || ws.readyState !== 1) return;
      if (slot === "primary"){
        // Selecting a primary should immediately reflect in the HUD.
        state.activeSlot = "primary";
        ws.send(JSON.stringify({ type: "pickPrimary", weapon: wid }));
        updateHUD();
      } else {
        state.activeSlot = "pistol";
        ws.send(JSON.stringify({ type: "pickPistol", weapon: wid }));
        updateHUD();
      }
    });

    return btn;
  };

  ui.primaryList.innerHTML = "";
  ui.pistolList.innerHTML = "";

  for (const wid of (lists?.primary || [])) ui.primaryList.appendChild(makeBtn(wid, "primary"));
  for (const wid of (lists?.pistols || [])) ui.pistolList.appendChild(makeBtn(wid, "pistol"));
}


function getWeaponDef(id){
  return (id && weapons) ? weapons[id] : null;
}

function activeWeaponSnapshot(me){
  return (state.activeSlot === "pistol") ? me.pistol : me.primary;
}

function isAutoWeapon(id){
  const w = getWeaponDef(id);
  return !!(w && w.mode === "auto");
}

let myId = null;
let arena = { size: 120 };
let obstacles = [];
let pickups = [];
let weapons = {};
let lists = { primary:[], pistols:[] };
let round = { between:true, wave:1, zombiesTarget:0, zombiesSpawned:0, zombiesKilled:0 };
let paused = false;

const wsProto = (location.protocol === "https:") ? "wss" : "ws";
if (!location.host){
  ui.status.textContent = "No server detected. Run: node server.js then open http://localhost:3000";
}
let bootReady = false;
const pendingMsgs = [];

const ws = new WebSocket(`${wsProto}://${location.host}/ws`);
ws.addEventListener("open", ()=>{
  ui.status.textContent = "Connected. Click Play.";
  dbg.log('ws: open');
});
ws.addEventListener("close", ()=>{
  ui.status.textContent = "Disconnected.";
  dbg.log('ws: close');
});
ws.addEventListener("error", ()=>{
  ui.status.textContent = "Connection error. Is server.js running?";
  dbg.log('ws: error');
});
ws.addEventListener("message", (e)=> onMsg(JSON.parse(e.data)));

dbg.log('boot: ws created');

const state = {
  players: new Map(), // id -> snapshot
  zombies: new Map(), // id -> {x,y,z,hp}
  keys: { w:false,a:false,s:false,d:false },
  yaw: 0,
  pitch: 0,
  // If you haven't picked a primary yet, default to pistol so shooting always works.
  activeSlot: "pistol",
  lastSendAt: 0,
  mouseDown: false,
  nextClientFireAt: 0,
};

// Script HUD items streamed by server (custom scripts)
let scriptHudItems = [];

function onMsg(msg){
  if (!bootReady) { pendingMsgs.push(msg); return; }
  if (msg.type === "welcome"){
    myId = msg.id;
    arena = msg.arena;
    obstacles = msg.obstacles || [];
    pickups = msg.pickups || [];
    weapons = msg.weapons;
    lists = msg.lists;
    round = msg.round;
    buildArena();
    rebuildObstacles();
    rebuildPickups();
    rebuildLists();
    ui.status.textContent = `Welcome ${myId}.`;
    setRoundUI(round.between);
  }
  if (msg.type === "snapshot"){
    state.players.clear();
    for (const p of msg.players) state.players.set(p.id, p);
    state.zombies.clear();
    for (const z of msg.zombies) state.zombies.set(z.id, z);
    pickups = msg.pickups || pickups;
    rebuildPickups();
  }
  if (msg.type === "join"){
    state.players.set(msg.player.id, msg.player);
  }
  if (msg.type === "leave"){
    state.players.delete(msg.id);
    const mesh = otherMeshes.get(msg.id);
    if (mesh){ scene.remove(mesh); otherMeshes.delete(msg.id); }
  }

  if (msg.type === "dzsHelp"){
    state.dzsHelp = msg.help;
    // If the DZS help popup is open, refresh it so new data appears.
    try{ devUI?.refreshDevPopup?.(); }catch(_e){}
  }
  if (msg.type === "round"){
    round.between = msg.between;
    round.wave = msg.wave;
    round.zombiesTarget = msg.zombiesTarget;
    setRoundUI(round.between);
    rebuildLists();
    toast(round.between ? "Round cleared. Pick your loadout." : `Wave ${round.wave} started.`);
  }

  // Hard reset from server (used for match restart). Clears any stuck input so you don't moon-walk.
  if (msg.type === "restartAck"){
    state.keys = { w:false, a:false, s:false, d:false };
    state.mouseDown = false;
    state.nextClientFireAt = 0;
    state.yaw = 0;
    state.pitch = 0;
    paused = false;
    setPauseUI(false);
    unlockPointer();
    toast("Restarted. Pick your loadout.");
  }
  if (msg.type === "pickDenied"){
    toast(msg.reason || "Pick denied.");
  }
  if (msg.type === "toast"){
    toast(msg.msg);
  }
  if (msg.type === "state"){
    round = { ...round, ...msg.round };
    for (const p of msg.players) state.players.set(p.id, p);
    state.zombies.clear();
    for (const z of msg.zombies) state.zombies.set(z.id, z);
    pickups = msg.pickups || pickups;
    syncPickups();
    updateHUD();
  }

  if (msg.type === "hud"){
    scriptHudItems = Array.isArray(msg.items) ? msg.items : [];
  }
  if (msg.type === "loadout"){
    const p = state.players.get(msg.id);
    if (p){
      if (msg.pistol) p.pistol = msg.pistol;
      if (msg.primary) p.primary = msg.primary;
      if (msg.inventory) p.inventory = msg.inventory;
      if (msg.cash != null) p.cash = msg.cash;
      if (msg.hp != null) p.hp = msg.hp;
      state.players.set(msg.id, p);
    }
    if (msg.id === myId) rebuildLists();
    if (msg.id === myId){
      // Ensure weapon pill updates immediately when the server accepts a pick.
      updateHUD();
    }
  }
  if (msg.type === "reload"){
    if (msg.id === myId) toast("Reloading…");
  }
  if (msg.type === "bought"){
    if (msg.id === myId) toast("Purchased.");
  }

  // Server-authoritative cash updates (used by scripts + some events)
  if (msg.type === "cash"){
    const p = state.players.get(msg.id);
    if (p){
      p.cash = msg.cash;
      state.players.set(msg.id, p);
      if (msg.id === myId) updateHUD();
    }
  }
  if (msg.type === "phit"){
    if (msg.id === myId) toast("Hit!");
  }
  if (msg.type === "pdown"){
    if (msg.id === myId) toast("Down!");
  }

  if (msg.type === "playerDead"){
    if (msg.id === myId){
      // Default behavior: prompt a restart.
      setPauseUI(true);
      const ok = window.confirm(msg.msg || "You died. Restart?");
      if (ok && ws && ws.readyState === 1){
        ws.send(JSON.stringify({ type: "restart" }));
      }
    }
  }

  if (msg.type === "zhit" || msg.type === "zdead"){
    // These events include the shooter's updated cash
    if (msg.cash != null && msg.by){
      const shooter = state.players.get(msg.by);
      if (shooter){
        shooter.cash = msg.cash;
        state.players.set(msg.by, shooter);
        if (msg.by === myId) updateHUD();
      }
    }
    const mesh = zombieMeshes.get(msg.zid);
    if (mesh && mesh.userData){
      mesh.userData.flash = 0.12;
      if (msg.part === "head" && mesh.userData.head){
        mesh.userData.head.material.emissive = new THREE.Color(0.55, 0.55, 0.55);
        mesh.userData.head.material.emissiveIntensity = 0.9;
        setTimeout(()=>{
          if (mesh.userData && mesh.userData.head && mesh.userData.head.material){
            mesh.userData.head.material.emissiveIntensity = 0.0;
          }
        }, 90);
      }
    }
    if (msg.by === myId && msg.part === "head") toast("Headshot!");
  }
}

function setRoundUI(between){
  ui.panelRound.classList.toggle("hidden", !between);
  if (between){
    // Need cursor for gun selection.
    unlockPointer();
  } else {
    relockPointerSoon();
  }
}

function weaponLabel(id){
  const w = getWeaponDef(id);
  if (!w) return id;
  const d = (w.dmgClose ?? w.damage ?? '?');
  return `${w.name}  •  ${w.mode || 'semi'}  •  dmg ${d}  •  r ${w.range}`;
}


// Dev menu / popup lives in engine/client/dev/devMenu.js
const devUI = initDevMenu({
  ui,
  getWs: ()=>ws,
  toast,
  state,
  getMyId: ()=>myId,
  getWeapons: ()=>weapons,
  setDebugVisible,
  isDebugVisible,
  unlockPointer,
  relockPointerSoon,
});

function toggleDevMenu(force){
  return devUI.toggleDevMenu(force);
}
function closeDevPopup(){
  return devUI.closeDevPopup();
}

ui.btnPlay.onclick = () => {
  ui.panelStart.classList.add("hidden");
  renderer.domElement.requestPointerLock();
};

function setPauseUI(show){
  if (!ui.panelPause) return;
  ui.panelPause.classList.toggle('hidden', !show);
  if (show) unlockPointer();
  else relockPointerSoon();
}

function togglePause(force){
  const next = (force != null) ? !!force : !paused;
  paused = next;
  setPauseUI(paused);
}

ui.btnPause && (ui.btnPause.onclick = ()=> togglePause());
ui.btnResume && (ui.btnResume.onclick = ()=> togglePause(false));
ui.btnLeave && (ui.btnLeave.onclick = ()=> {
  // Soft leave: show start panel again. (Server keeps you connected.)
  paused = false;
  setPauseUI(false);
  ui.panelStart?.classList.remove('hidden');
  unlockPointer();
  toast('Left match');
});

window.addEventListener('keydown', (e)=>{
  if (e.code === 'Escape'){
    // Let Escape toggle pause regardless of pointer lock state.
    e.preventDefault();
    // Don't pause if start screen is up.
    if (!ui.panelStart?.classList.contains('hidden')) return;
    // If round menu open, Escape simply re-locks once it closes; we keep menu open.
    if (round?.between) return;
    // If dev menu open, close it first.
    if (ui.devMenu && !ui.devMenu.classList.contains('hidden')){ toggleDevMenu(false); return; }
    const popup = document.getElementById('devPopup');
    if (popup && !popup.classList.contains('hidden')){ closeDevPopup(); return; }
    togglePause();
  }
}, { passive:false });
// Start next wave (between-rounds). Server only honors this when `betweenRounds` is true.
ui.btnReady && (ui.btnReady.onclick = () => {
  if (!ws || ws.readyState !== 1){
    toast("Not connected.");
    console.warn("[ui] Start Next Wave: websocket not open");
    return;
  }
  ws.send(JSON.stringify({ type: "ready" }));
  toast("Ready ✔");
});


// Input
// Use window listeners (explicit) and prevent browser defaults so WASD never gets eaten by focus/scroll.
function isTypingTarget(t){
  const tag = (t && t.tagName) ? String(t.tagName).toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
window.addEventListener("keydown", (e)=>{
  if (isTypingTarget(e.target)) return;
  if (["KeyW","KeyA","KeyS","KeyD","Space"].includes(e.code)) e.preventDefault();
  if (e.code==="KeyW") state.keys.w = true;
  if (e.code==="KeyA") state.keys.a = true;
  if (e.code==="KeyS") state.keys.s = true;
  if (e.code==="KeyD") state.keys.d = true;
  if (e.code==="Digit1") state.activeSlot = "pistol";
  if (e.code==="Digit2") state.activeSlot = "primary";
  if (e.code==="Digit3") state.activeSlot = "launcher";
  if (e.code==="KeyQ"){
    // Use medkit
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type:"useMedkit" }));
  }
  if (e.code==="KeyR") sendReload();
  updateHUD();
}, { passive:false });

window.addEventListener("keyup", (e)=>{
  if (isTypingTarget(e.target)) return;
  if (e.code==="KeyW") state.keys.w = false;
  if (e.code==="KeyA") state.keys.a = false;
  if (e.code==="KeyS") state.keys.s = false;
  if (e.code==="KeyD") state.keys.d = false;
}, { passive:true });

let pendingShoot = false;
addEventListener("mousedown", ()=> {
  if (document.pointerLockElement !== renderer.domElement) return;
  state.mouseDown = true;
  // Semi/burst fire: one shot per click. Auto fire is handled in the frame loop.
  const me = state.players.get(myId);
  const active = me ? activeWeaponSnapshot(me) : null;
  const wid = active?.id;
  if (!wid || !isAutoWeapon(wid)) pendingShoot = true;
});
addEventListener("mouseup", ()=> { state.mouseDown = false; });

document.addEventListener("mousemove", (e)=>{
  if (document.pointerLockElement !== renderer.domElement) return;
  state.yaw -= e.movementX * 0.0022;
  state.pitch -= e.movementY * 0.0020;
  state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch));
});

// Three.js
const canvas = document.getElementById("three");
const scriptHudCanvas = document.getElementById("scriptHud");
const scriptHudCtx = scriptHudCanvas ? scriptHudCanvas.getContext('2d') : null;
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Script HUD canvas (2D overlay) setup
if (scriptHudCanvas){
  scriptHudCanvas.width = Math.floor(innerWidth * (devicePixelRatio || 1));
  scriptHudCanvas.height = Math.floor(innerHeight * (devicePixelRatio || 1));
  scriptHudCanvas.style.width = innerWidth + 'px';
  scriptHudCanvas.style.height = innerHeight + 'px';
  if (scriptHudCtx) scriptHudCtx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050811);
scene.fog = new THREE.Fog(0x050811, 10, 190);

const camera = new THREE.PerspectiveCamera(78, innerWidth/innerHeight, 0.1, 600);
camera.position.set(0, 1.6, 5);
camera.rotation.order = "YXZ";

// Lighting
const hemi = new THREE.HemisphereLight(0xd8e8ff, 0x1b1020, 1.05);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.35);
dir.position.set(12, 22, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(1024,1024);
dir.shadow.camera.left = -70;
dir.shadow.camera.right = 70;
dir.shadow.camera.top = 70;
dir.shadow.camera.bottom = -70;
scene.add(dir);

// Sun (visual + stronger key light feel)
const sunGeo = new THREE.SphereGeometry(2.2, 18, 14);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1c7 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.set(80, 60, -70);
scene.add(sunMesh);

function makeCanvasTexture(drawFn, size=256){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 4);
  tex.needsUpdate = true;
  return tex;
}

const grassTex = makeCanvasTexture((ctx, s)=>{
  ctx.fillStyle = '#0b2a13';
  ctx.fillRect(0,0,s,s);
  // mottled noise
  for (let i=0;i<18000;i++){
    const x = (Math.random()*s)|0;
    const y = (Math.random()*s)|0;
    const g = 60 + (Math.random()*110)|0;
    const a = 0.08 + Math.random()*0.18;
    ctx.fillStyle = `rgba(20,${g},35,${a})`;
    ctx.fillRect(x,y,1,1);
  }
  // subtle blade streaks
  ctx.globalAlpha = 0.10;
  for (let i=0;i<220;i++){
    ctx.strokeStyle = `rgb(${20+Math.random()*20|0},${110+Math.random()*80|0},${30+Math.random()*30|0})`;
    ctx.beginPath();
    const x = Math.random()*s;
    ctx.moveTo(x, Math.random()*s);
    ctx.lineTo(x + (Math.random()*10-5), Math.random()*s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}, 256);
grassTex.repeat.set(24,24);

const buildingTex = makeCanvasTexture((ctx, s)=>{
  ctx.fillStyle = '#2b2f38';
  ctx.fillRect(0,0,s,s);
  // bricks
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  const bh = 18;
  for (let y=0; y<s; y+=bh){
    const offset = (y/bh)%2 ? 10 : 0;
    for (let x=-offset; x<s; x+=40){
      ctx.strokeRect(x+offset, y, 40, bh);
    }
  }
  // windows
  for (let i=0;i<40;i++){
    const x = (Math.random()*(s-28)+14)|0;
    const y = (Math.random()*(s-28)+14)|0;
    const w = 10 + (Math.random()*10)|0;
    const h = 12 + (Math.random()*16)|0;
    const lit = Math.random() < 0.35;
    ctx.fillStyle = lit ? 'rgba(255,224,160,0.55)' : 'rgba(30,40,60,0.55)';
    ctx.fillRect(x, y, w, h);
  }
}, 256);
buildingTex.repeat.set(6,2);


// Floor
const floorMat = new THREE.MeshStandardMaterial({ color: 0x18301e, roughness: 1.0, metalness: 0.0, map: grassTex });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(500,500,1,1), floorMat);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

// Obstacles (server-authoritative)
const props = new THREE.Group();
scene.add(props);

// Pickups
const pickupsGroup = new THREE.Group();
scene.add(pickupsGroup);
const pickupMeshes = new Map(); // id -> mesh

function makeWeaponPickupMesh(weaponId){
  const w = getWeaponDef(weaponId);
  const base = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35, metalness: 0.25, emissive: new THREE.Color(0x6b4f00), emissiveIntensity: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.45, metalness: 0.15, emissive: new THREE.Color(0x0b2a52), emissiveIntensity: 0.55 });

  // A tiny "gun" silhouette: box + barrel
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.18), coreMat);
  body.position.set(0, 0, 0);
  body.castShadow = true; body.receiveShadow = true;
  base.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 10), accentMat);
  barrel.rotation.z = Math.PI/2;
  barrel.position.set(0.25, 0.02, 0);
  barrel.castShadow = true;
  base.add(barrel);

  // Floating ring so it's easy to spot
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 10, 20), accentMat);
  ring.rotation.x = Math.PI/2;
  ring.position.set(0, -0.08, 0);
  ring.castShadow = false;
  base.add(ring);

  // Label hint via scale (primary looks slightly bigger)
  if (w && w.slot === 'primary') base.scale.set(1.1,1.1,1.1);
  return base;
}

function rebuildPickups(){
  pickupsGroup.clear();
  pickupMeshes.clear();
  for (const p of (pickups || [])){
    if (p.kind === 'weapon'){
      const mesh = makeWeaponPickupMesh(p.weaponId);
      mesh.position.set(p.x, p.y ?? 0.35, p.z);
      pickupsGroup.add(mesh);
      pickupMeshes.set(p.id, mesh);
    }
  }
}

function syncPickups(){
  // Add/update/remove based on current pickups array
  const alive = new Set((pickups||[]).map(p=>p.id));
  for (const [id, mesh] of pickupMeshes.entries()){
    if (!alive.has(id)){
      pickupsGroup.remove(mesh);
      pickupMeshes.delete(id);
    }
  }
  for (const p of (pickups||[])){
    let mesh = pickupMeshes.get(p.id);
    if (!mesh){
      if (p.kind === 'weapon') mesh = makeWeaponPickupMesh(p.weaponId);
      if (!mesh) continue;
      pickupsGroup.add(mesh);
      pickupMeshes.set(p.id, mesh);
    }
    mesh.position.set(p.x, p.y ?? 0.35, p.z);
  }
}

const crateTex = makeCanvasTexture((ctx, s)=>{
  // a "bushy" camo-ish texture for crates/boxes
  ctx.fillStyle = '#1b2b1e';
  ctx.fillRect(0,0,s,s);
  for (let i=0;i<9000;i++){
    const x = (Math.random()*s)|0;
    const y = (Math.random()*s)|0;
    const r = 20 + (Math.random()*25)|0;
    const g = 55 + (Math.random()*85)|0;
    const b = 20 + (Math.random()*30)|0;
    const a = 0.14 + Math.random()*0.28;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(x,y,1,1);
  }
  // faint "woven" lines
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#0f1c12';
  for (let y=0;y<s;y+=12){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s,y); ctx.stroke();
  }
  for (let x=0;x<s;x+=12){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,s); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}, 256);
crateTex.repeat.set(1,1);

const crateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0, map: crateTex });

function rebuildObstacles(){
  props.clear();
  for (const b of (obstacles || [])){
    const w = Math.max(0.6, b.hx*2);
    const d = Math.max(0.6, b.hz*2);
    const h = Math.max(0.8, b.h ?? 1.4);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), crateMat);
    mesh.position.set(b.x, h/2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    props.add(mesh);
  }
}

// Arena walls
const walls = new THREE.Group();
scene.add(walls);

function buildArena(){
  walls.clear();
  const s = arena.size/2;
  const h = 7, t=1.2;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: buildingTex });
  const mk = (w,d,x,z)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,h/2,z);
    m.castShadow = true;
    m.receiveShadow = true;
    walls.add(m);
  };
  mk(arena.size+t*2, t, 0, -s);
  mk(arena.size+t*2, t, 0,  s);
  mk(t, arena.size+t*2, -s, 0);
  mk(t, arena.size+t*2,  s, 0);
}

// Other players + zombies
const otherMeshes = new Map();
const zombieMeshes = new Map();

// Zombie model (glTF) is shipped with the Zombies module so it isn't tied to
// the top-level public folder:
//   /game/zm/zombies/resources/models/zombie.gltf
// If it fails to load for any reason, we fall back to a built-in procedural
// zombie model so gameplay still works.
let zombiePrefab = null;
let zombiePrefabClone = null;

async function ensureGLTFLoader(){
  if (GLTFLoader) return GLTFLoader;
  try {
    const mod = await import('three/addons/loaders/GLTFLoader.js');
    GLTFLoader = mod.GLTFLoader;
    return GLTFLoader;
  } catch (e){
    console.warn('[client] GLTFLoader import failed, using procedural zombies:', e?.message || e);
    return null;
  }
}

async function loadZombiePrefab(){
  if (zombiePrefab) return;
  const L = await ensureGLTFLoader();
  if (!L){
    dbg.log('zombie: GLTFLoader unavailable, using procedural model');
    return;
  }
  try {
    const loader = new L();
    const gltf = await new Promise((resolve, reject)=>{
      // NOTE: served by server.js via the /game/ static mount.
      loader.load('/game/zm/zombies/resources/models/zombie.gltf', resolve, undefined, reject);
    });
    const prefab = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!prefab) throw new Error('GLTF had no scene');
    prefab.traverse?.((o)=>{
      if (o.isMesh){
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // Normalize size/position so it reliably appears at human scale.
    try {
      const box = new THREE.Box3().setFromObject(prefab);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      // Avoid divide-by-zero; target roughly ~1.8m tall.
      const h = Math.max(0.001, size.y || 0.001);
      const s = 1.8 / h;
      prefab.scale.set(s, s, s);
      // Recompute after scaling, then move so feet sit on y=0 and model is centered.
      const box2 = new THREE.Box3().setFromObject(prefab);
      const min = box2.min.clone();
      const c2 = new THREE.Vector3();
      box2.getCenter(c2);
      prefab.position.x += -c2.x;
      prefab.position.z += -c2.z;
      prefab.position.y += -min.y;
    } catch (e) {
      // If normalization fails, keep whatever the author shipped.
      prefab.scale.set(1,1,1);
    }
    zombiePrefab = prefab;
    // Some glTF zombies are skinned. A plain .clone(true) can produce invisible
    // meshes (skeleton not wired). If we detect a skinned mesh, use SkeletonUtils.
    zombiePrefabClone = () => zombiePrefab.clone(true);
    try {
      let hasSkinned = false;
      zombiePrefab.traverse?.((o)=>{ if (o.isSkinnedMesh) hasSkinned = true; });
      if (hasSkinned){
        const util = await import('three/addons/utils/SkeletonUtils.js');
        if (util?.clone) zombiePrefabClone = () => util.clone(zombiePrefab);
      }
    } catch (e){ /* keep default clone */ }
    console.log('[client] Zombie model loaded (gltf).');
    dbg.log('zombie model: loaded ✅ (gltf)');
  } catch (e){
    const msg = e?.message || String(e);
    console.warn('[client] Zombie glTF failed to load, using procedural zombies:', msg);
    dbg.log(`zombie model: FAILED ❌ (${msg})`);
  }
}

function makeOtherMesh(){
  const g = new THREE.CapsuleGeometry(0.35, 1.0, 6, 12);
  const m = new THREE.MeshStandardMaterial({ color: 0x7cd2ff, roughness: 0.55 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeZombieMesh(){
  // Prefer the glTF prefab if available.
  if (zombiePrefab){
    const c = (zombiePrefabClone ? zombiePrefabClone() : zombiePrefab.clone(true));
    // Ensure it stands on the ground.
    c.position.set(0,0,0);
    return c;
  }
  // Procedural low-poly zombie: chunky body/head/legs/arms
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8fe85f, roughness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x5fb83a, roughness: 0.95 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xb7ff88, roughness: 0.85 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), bodyMat);
  body.position.set(0, 1.05, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMat);
  head.position.set(0, 1.65, -0.05);
  head.castShadow = true; head.receiveShadow = true;
  g.add(head);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), darkMat);
  legL.position.set(-0.18, 0.35, 0);
  legL.castShadow = true;
  g.add(legL);

  const legR = legL.clone();
  legR.position.set(0.18, 0.35, 0);
  g.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), darkMat);
  armL.position.set(-0.55, 1.05, 0.02);
  armL.rotation.z = 0.30;
  armL.castShadow = true;
  g.add(armL);

  const armR = armL.clone();
  armR.position.set(0.55, 1.05, 0.02);
  armR.rotation.z = -0.30;
  g.add(armR);

  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b1220 });
  const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.02), eyeMat);
  const eye2 = eye1.clone();
  eye1.position.set(-0.09, 1.68, -0.26);
  eye2.position.set( 0.09, 1.68, -0.26);
  g.add(eye1); g.add(eye2);

  g.userData = { body, head, flash: 0 };
  return g;
}

// Simple viewmodel gun (attached to camera)
const gunGroup = new THREE.Group();
camera.add(gunGroup);
scene.add(camera);

const gunMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.1 });
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.6), gunMat);
gunBody.position.set(0.22, -0.22, -0.55);
gunBody.castShadow = false;
gunGroup.add(gunBody);

const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.4,12), gunMat);
gunBarrel.rotation.x = Math.PI/2;
gunBarrel.position.set(0.22, -0.20, -0.86);
gunGroup.add(gunBarrel);

const muzzleFlash = new THREE.Mesh(
  new THREE.PlaneGeometry(0.18,0.18),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.0, side:THREE.DoubleSide })
);
muzzleFlash.position.set(0.22, -0.20, -1.05);
gunGroup.add(muzzleFlash);

let recoil = 0;
let bobT = 0;

function updateWorldMeshes(){
  for (const [id,p] of state.players){
    if (id === myId) continue;
    let mesh = otherMeshes.get(id);
    if (!mesh){
      mesh = makeOtherMesh();
      scene.add(mesh);
      otherMeshes.set(id, mesh);
    }
    mesh.position.set(p.x, 1.0, p.z);
  }

  const seen = new Set();
  for (const [zid,z] of state.zombies){
    seen.add(zid);
    let mesh = zombieMeshes.get(zid);
    if (!mesh){
      mesh = makeZombieMesh();
      scene.add(mesh);
      zombieMeshes.set(zid, mesh);
      // Log a light signal for debugging without flooding.
      if (!updateWorldMeshes._zLogged){
        updateWorldMeshes._zLogged = 0;
      }
      updateWorldMeshes._zLogged++;
      if (updateWorldMeshes._zLogged <= 5){
        dbg.log(`zombie: spawn mesh #${updateWorldMeshes._zLogged} (${zombiePrefab ? 'gltf' : 'procedural'})`);
      }
    }
    mesh.position.set(z.x, 0.0, z.z);
    // subtle idle wobble (by moving parts)
    const wob = Math.sin(performance.now()*0.004 + (zid.charCodeAt(0)||0))*0.03;
    if (mesh.userData?.body) mesh.userData.body.position.y = 1.05 + wob;
    if (mesh.userData?.head) mesh.userData.head.position.y = 1.65 + wob*0.6;

    // face nearest player (approx: my player)
    const me = state.players.get(myId);
    if (me){
      const dx = me.x - z.x, dz = me.z - z.z;
      mesh.rotation.y = Math.atan2(dx, dz);
    }

    // hit flash
    if (mesh.userData){
      mesh.userData.flash = Math.max(0, (mesh.userData.flash || 0) - 0.016);
      const f = mesh.userData.flash || 0;
      if (mesh.userData.body?.material){
        mesh.userData.body.material.emissive = new THREE.Color(0.4, 0.2, 0.1);
        mesh.userData.body.material.emissiveIntensity = f * 2.0;
      }
    }
  }
  for (const [zid,mesh] of zombieMeshes){
    if (!seen.has(zid)){
      scene.remove(mesh);
      zombieMeshes.delete(zid);
    }
  }
}

function updateHUD(){
  const me = state.players.get(myId);
  if (!me) return;

  ui.hp.textContent = Math.ceil(me.hp);
  ui.cash.textContent = Math.floor(me.cash);
  ui.wave.textContent = round.wave;
  ui.z.textContent = `${round.zombiesKilled}/${round.zombiesTarget || 0}`;

  const active = (state.activeSlot==="pistol") ? me.pistol : me.primary;
  const wid = active?.id || (me.pistol?.id || "");
  ui.weapon.textContent = weapons[wid]?.name || (active ? wid : "Pick a primary");
  ui.ammo.textContent = active ? `${active.mag}/${active.reserve}` : "—";

  window.__hud = { hp: me.hp, cash: me.cash, wave: round.wave, between: round.between };
}

function sendInput(dt){
  if (ws.readyState !== 1) return;
  const now = performance.now();
  if (now - state.lastSendAt < 40) return;
  state.lastSendAt = now;
  ws.send(JSON.stringify({
    type:"input",
    yaw: state.yaw,
    pitch: state.pitch,
    keys: state.keys,
    dt
  }));
}

function sendShoot(){
  const me = state.players.get(myId);
  if (!me || round.between) return;

  // If a primary isn't selected yet, fall back to pistol so you can always shoot.
  let active = (state.activeSlot==="pistol") ? me.pistol : me.primary;
  if (!active) active = me.pistol;
  if (!active) return;
  ws.send(JSON.stringify({ type:"shoot", weapon: active.id, aim: { yaw: state.yaw, pitch: state.pitch } }));
  // local recoil + muzzle flash so it's visually "FPS"
  const _wdef = getWeaponDef(active.id);
  const _rs = (_wdef && typeof _wdef.recoilScale === 'number') ? _wdef.recoilScale : 1;
  recoil = Math.min(1, recoil + 0.9 * _rs);
  muzzleFlash.material.opacity = 0.85;
}

function sendReload(){
  const me = state.players.get(myId);
  if (!me) return;
  let active = (state.activeSlot==="pistol") ? me.pistol : me.primary;
  if (!active) active = me.pistol;
  if (!active) return;
  ws.send(JSON.stringify({ type:"reload", weapon: active.id }));
}



function tryAutoFire(me){
  if (!state.mouseDown) return;
  if (round.between) return;
  const active = activeWeaponSnapshot(me);
  if (!active) return;
  const wid = active.id;
  if (!isAutoWeapon(wid)) return;
  const w = getWeaponDef(wid);
  if (!w) return;
  const now = performance.now();
  if (now < state.nextClientFireAt) return;
  // small cushion so we don't spam the server too hard
  state.nextClientFireAt = now + Math.max(30, w.fireMs * 0.92);
  sendShoot();
}
addEventListener("resize", ()=>{
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  if (scriptHudCanvas){
    scriptHudCanvas.width = Math.floor(innerWidth * (devicePixelRatio || 1));
    scriptHudCanvas.height = Math.floor(innerHeight * (devicePixelRatio || 1));
    scriptHudCanvas.style.width = innerWidth + 'px';
    scriptHudCanvas.style.height = innerHeight + 'px';
    if (scriptHudCtx) scriptHudCtx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
  }
});

let last = performance.now();

function drawScriptHud(){
  if (!scriptHudCtx || !scriptHudCanvas) return;
  scriptHudCtx.clearRect(0, 0, innerWidth, innerHeight);
  if (!scriptHudItems || !scriptHudItems.length) return;

  for (const it of scriptHudItems){
    if (!it || !it.kind) continue;
    if (it.kind === 'text'){
      const o = it.opts || {};
      const x = (Number(it.x) <= 1 && Number(it.x) >= 0) ? Number(it.x) * innerWidth : Number(it.x);
      const y = (Number(it.y) <= 1 && Number(it.y) >= 0) ? Number(it.y) * innerHeight : Number(it.y);
      const size = Number(o.size || 18);
      const font = o.font || 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial';
      scriptHudCtx.font = `${Math.max(8, size)}px ${font}`;
      scriptHudCtx.textAlign = o.align || 'left';
      scriptHudCtx.textBaseline = o.baseline || 'top';
      scriptHudCtx.globalAlpha = (o.alpha != null) ? Number(o.alpha) : 1;
      if (o.shadow){
        scriptHudCtx.shadowColor = 'rgba(0,0,0,0.55)';
        scriptHudCtx.shadowBlur = 8;
        scriptHudCtx.shadowOffsetX = 1;
        scriptHudCtx.shadowOffsetY = 2;
      } else {
        scriptHudCtx.shadowColor = 'rgba(0,0,0,0)';
        scriptHudCtx.shadowBlur = 0;
        scriptHudCtx.shadowOffsetX = 0;
        scriptHudCtx.shadowOffsetY = 0;
      }
      scriptHudCtx.fillStyle = o.color || 'rgba(235,245,255,0.92)';
      scriptHudCtx.fillText(String(it.text ?? ''), x, y);
      scriptHudCtx.globalAlpha = 1;
    }
    if (it.kind === 'rect'){
      const o = it.opts || {};
      const x = (Number(it.x) <= 1 && Number(it.x) >= 0) ? Number(it.x) * innerWidth : Number(it.x);
      const y = (Number(it.y) <= 1 && Number(it.y) >= 0) ? Number(it.y) * innerHeight : Number(it.y);
      const w = (Number(it.w) <= 1 && Number(it.w) >= 0) ? Number(it.w) * innerWidth : Number(it.w);
      const h = (Number(it.h) <= 1 && Number(it.h) >= 0) ? Number(it.h) * innerHeight : Number(it.h);
      scriptHudCtx.globalAlpha = (o.alpha != null) ? Number(o.alpha) : 1;
      if (o.fill){
        scriptHudCtx.fillStyle = o.fill;
        scriptHudCtx.fillRect(x, y, w, h);
      }
      if (o.stroke){
        scriptHudCtx.strokeStyle = o.stroke;
        scriptHudCtx.lineWidth = Number(o.lineWidth || 2);
        scriptHudCtx.strokeRect(x, y, w, h);
      }
      scriptHudCtx.globalAlpha = 1;
    }
  }
}
function frame(){
  const t = performance.now();
  const dt = Math.min(0.033, (t-last)/1000);
  last = t;

  if (!paused){
    sendInput(dt);

    const me = state.players.get(myId);
    if (me){
      // camera at player
      camera.position.set(me.x, 1.65, me.z);

      // head bob from movement
      const moving = state.keys.w || state.keys.a || state.keys.s || state.keys.d;
      if (moving) bobT += dt * 10;
      const bob = moving ? Math.sin(bobT) * 0.03 : 0;

      // apply yaw/pitch + recoil
      recoil = Math.max(0, recoil - dt * 6.5);
      muzzleFlash.material.opacity = Math.max(0, muzzleFlash.material.opacity - dt * 8);

      camera.rotation.y = state.yaw;
      camera.rotation.x = state.pitch - recoil*0.06;

      gunGroup.position.set(0, bob*0.8, 0);
      gunGroup.rotation.set(bob*0.15, 0, -recoil*0.10);

      // auto fire while holding mouse (for AUTO weapons)
      tryAutoFire(me);

      // shoot once per click
      if (pendingShoot){
        pendingShoot = false;
        sendShoot();
      }
    }

    updateWorldMeshes();

    // make pickups feel gamey: float + slow spin
    const tt = t * 0.001;
    for (const mesh of pickupMeshes.values()){
      mesh.rotation.y = tt;
      mesh.position.y = 0.35 + Math.sin(tt*2 + mesh.position.x*0.3 + mesh.position.z*0.3) * 0.08;
    }
  }

  renderer.render(scene, camera);
  drawScriptHud();
  requestAnimationFrame(frame);
}
// Kick off model loads (non-blocking). If it fails, we fall back safely.

// Defer processing WS messages until client is fully initialized (prevents TDZ errors).
bootReady = true;
while (pendingMsgs.length) onMsg(pendingMsgs.shift());

loadZombiePrefab();

frame();