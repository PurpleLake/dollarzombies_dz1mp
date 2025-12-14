import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

// NOTE: We intentionally do NOT rely on GLTFLoader here.
// In many local/dev setups, external module imports (and import maps) can be flaky.
// To keep zombies reliable, we always render the built-in procedural low-poly zombie.
// (The included /public/models/zombie.gltf can be re-enabled later once you bundle loaders.)
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
      if (slot === "primary") ws.send(JSON.stringify({ type: "pickPrimary", weapon: wid }));
      else ws.send(JSON.stringify({ type: "pickPistol", weapon: wid }));
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
const ws = new WebSocket(`${wsProto}://${location.host}/ws`);
ws.addEventListener("open", ()=> ui.status.textContent = "Connected. Click Play.");
ws.addEventListener("close", ()=> ui.status.textContent = "Disconnected." );
ws.addEventListener("error", ()=> ui.status.textContent = "Connection error. Is server.js running?" );
ws.addEventListener("message", (e)=> onMsg(JSON.parse(e.data)));

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

function onMsg(msg){
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
  if (msg.type === "round"){
    round.between = msg.between;
    round.wave = msg.wave;
    round.zombiesTarget = msg.zombiesTarget;
    setRoundUI(round.between);
    rebuildLists();
    toast(round.between ? "Round cleared. Pick your loadout." : `Wave ${round.wave} started.`);
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
  if (msg.type === "loadout"){
    const p = state.players.get(msg.id);
    if (p){
      if (msg.pistol) p.pistol = msg.pistol;
      if (msg.primary) p.primary = msg.primary;
      if (msg.cash != null) p.cash = msg.cash;
      state.players.set(msg.id, p);
    }
    if (msg.id === myId) rebuildLists();
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
}

function weaponLabel(id){
  const w = getWeaponDef(id);
  if (!w) return id;
  const d = (w.dmgClose ?? w.damage ?? '?');
  return `${w.name}  •  ${w.mode || 'semi'}  •  dmg ${d}  •  r ${w.range}`;
}


function ensureDevPopup(){
  let el = document.getElementById("devPopup");
  if (el) return el;
  el = document.createElement("div");
  el.id = "devPopup";
  el.className = "devPopup hidden";
  el.innerHTML = `
    <div class="devPopupOverlay"></div>
    <div class="devPopupCard">
      <div class="devPopupTop">
        <div class="devPopupTitle" id="devPopupTitle">Dev</div>
        <button class="btn" id="devPopupClose">Close</button>
      </div>
      <div class="devPopupBody" id="devPopupBody"></div>
    </div>
  `;
  document.body.appendChild(el);
  el.querySelector("#devPopupClose").onclick = ()=> closeDevPopup();
  el.querySelector(".devPopupOverlay").onclick = ()=> closeDevPopup();
  return el;
}

let devPopupMode = null;

function openDevPopup(mode){
  devPopupMode = mode;
  const el = ensureDevPopup();
  el.classList.remove("hidden");
  renderDevPopup();
}
function closeDevPopup(){
  const el = ensureDevPopup();
  el.classList.add("hidden");
  devPopupMode = null;
}

function weaponCategory(id, w){
  if (!w) return "Other";
  if (w.slot === "pistol") return "Pistols";
  if ((w.pellets||1) > 1 || String(id).includes("shotgun")) return "Shotguns";
  if (String(id).includes("mg") || String(id).includes("mg42") || /MG/i.test(w.name||"")) return "Light Machine Guns";
  if (String(id).includes("dmr")) return "DMR";
  return "Assault Rifles";
}

function renderDevMenu(){
  if (!ui.devBody) return;
  ui.devBody.innerHTML = "";

  const section = (title)=>{
    const s = document.createElement("div");
    s.className = "devSection";
    const h = document.createElement("div");
    h.className = "h";
    h.textContent = title;
    s.appendChild(h);
    return s;
  };

  const bigBtn = (label, onClick)=>{
    const b = document.createElement("button");
    b.className = "btn wide";
    b.textContent = label;
    b.onclick = onClick;
    return b;
  };

  const s = section("DEV MENU");
  s.appendChild(bigBtn("Weapons", ()=> openDevPopup("weapons")));
  s.appendChild(bigBtn("Placeholder", ()=> toast("Placeholder (coming soon)")));
  s.appendChild(bigBtn("Placeholder", ()=> toast("Placeholder (coming soon)")));
  s.appendChild(bigBtn("Placeholder", ()=> toast("Placeholder (coming soon)")));
  s.appendChild(bigBtn("Players", ()=> openDevPopup("players")));
  s.appendChild(bigBtn("Entities", ()=> openDevPopup("entities")));
  ui.devBody.appendChild(s);
}

function renderDevPopup(){
  const el = ensureDevPopup();
  const titleEl = el.querySelector("#devPopupTitle");
  const bodyEl = el.querySelector("#devPopupBody");
  if (!titleEl || !bodyEl) return;
  bodyEl.innerHTML = "";

  const mkSection = (t)=>{
    const wrap = document.createElement("div");
    wrap.className = "devSection";
    const h = document.createElement("div");
    h.className = "h";
    h.textContent = t;
    wrap.appendChild(h);
    bodyEl.appendChild(wrap);
    return wrap;
  };

  const me = state.players.get(myId);

  if (devPopupMode === "weapons"){
    titleEl.textContent = "Weapons";
    const cats = new Map();
    for (const [id, w] of Object.entries(weapons || {})){
      const c = weaponCategory(id, w);
      if (!cats.has(c)) cats.set(c, []);
      cats.get(c).push({ id, w });
    }
    const order = ["Pistols","Shotguns","Assault Rifles","Light Machine Guns","DMR","Other"];
    for (const c of order){
      const items = cats.get(c);
      if (!items || !items.length) continue;
      items.sort((a,b)=> (a.w.name||a.id).localeCompare(b.w.name||b.id));
      const sec = mkSection(c);
      const grid = document.createElement("div");
      grid.className = "devGrid";
      for (const it of items){
        const b = document.createElement("button");
        b.className = "btn";
        const dmg = `${Math.round(it.w.dmgClose||0)}→${Math.round(it.w.dmgFar||0)}`;
        b.textContent = `${it.w.name || it.id}  (DMG ${dmg}, R ${it.w.range||0}, MAG ${it.w.mag||0})`;
        b.onclick = ()=>{
          ws?.send(JSON.stringify({ type:"devEquipWeapon", weapon: it.id }));
          toast(`Equipped ${it.w.name || it.id}`);
          closeDevPopup();
        };
        grid.appendChild(b);
      }
      sec.appendChild(grid);
    }
    // also show quick help
    const hint = document.createElement("div");
    hint.className = "devHint";
    hint.textContent = "Click a weapon to equip instantly. (Mid-round enabled for dev.)";
    bodyEl.appendChild(hint);
    return;
  }

  if (devPopupMode === "players"){
    titleEl.textContent = "Players";
    const sec = mkSection("Players");
    const list = document.createElement("div");
    list.className = "devList";
    const arr = Array.from(state.players.values()).slice().sort((a,b)=> (a.name||a.id).localeCompare(b.name||b.id));
    for (const p of arr){
      const rowEl = document.createElement("div");
      rowEl.className = "devRow";
      const left = document.createElement("div");
      left.className = "devRowLeft";
      left.textContent = `${p.name || p.id}  (HP ${Math.round(p.hp||0)}  $${Math.round(p.cash||0)})`;
      const right = document.createElement("div");
      right.className = "devRowRight";
      const lbl = document.createElement("label");
      lbl.className = "devToggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!p.godMode;
      cb.onchange = ()=>{
        ws?.send(JSON.stringify({ type:"devSetGodMode", targetId: p.id, enabled: cb.checked }));
        toast(`${p.name || p.id}: god mode ${cb.checked ? "ON" : "OFF"}`);
      };
      const span = document.createElement("span");
      span.textContent = "God";
      lbl.appendChild(cb);
      lbl.appendChild(span);
      right.appendChild(lbl);
      rowEl.appendChild(left);
      rowEl.appendChild(right);
      list.appendChild(rowEl);
    }
    sec.appendChild(list);
    return;
  }

  if (devPopupMode === "entities"){
    titleEl.textContent = "Entities";
    const sec = mkSection("Zombies");
    const list = document.createElement("div");
    list.className = "devList";
    const zs = Array.from(state.zombies.values()).slice().sort((a,b)=> (a.id||"").localeCompare(b.id||""));
    if (!zs.length){
      const d = document.createElement("div");
      d.className = "devHint";
      d.textContent = "No zombies alive right now.";
      sec.appendChild(d);
      return;
    }
    for (const z of zs){
      const b = document.createElement("button");
      b.className = "btn wide";
      b.textContent = `Zombie ${String(z.id).slice(0,6)}  (HP ${Math.max(0, Math.round(z.hp||0))})`;
      b.onclick = ()=>{
        ws?.send(JSON.stringify({ type:"devTeleportZombieToPlayer", zid: z.id, targetId: myId }));
        toast("Zombie teleported to you.");
        closeDevPopup();
      };
      list.appendChild(b);
    }
    sec.appendChild(list);
    const hint = document.createElement("div");
    hint.className = "devHint";
    hint.textContent = "Click a zombie to teleport it to your position.";
    bodyEl.appendChild(hint);
    return;
  }

  titleEl.textContent = "Dev";
  const hint = document.createElement("div");
  hint.className = "devHint";
  hint.textContent = "Select a section from the Dev Menu.";
  bodyEl.appendChild(hint);
}
function toggleDevMenu(force){
  const show = (force != null) ? !!force : ui.devMenu.classList.contains("hidden");
  ui.devMenu.classList.toggle("hidden", !show);
  if (show){
    renderDevMenu();
    clearInterval(toggleDevMenu._t);
    toggleDevMenu._t = setInterval(()=>{
      if (ui.devMenu.classList.contains('hidden')) return;
      renderDevMenu();
    }, 450);
  } else {
    clearInterval(toggleDevMenu._t);
  }
}

ui.btnDev?.addEventListener("click", ()=> toggleDevMenu());
ui.btnDevClose?.addEventListener("click", ()=> toggleDevMenu(false));
addEventListener("keydown", (e)=>{
  if (e.code === "Backquote"){
    e.preventDefault();
    toggleDevMenu();
  }
});

ui.btnPlay.onclick = () => {
  ui.panelStart.classList.add("hidden");
  renderer.domElement.requestPointerLock();
};
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
addEventListener("keydown", (e)=>{
  if (e.code==="KeyW") state.keys.w = true;
  if (e.code==="KeyA") state.keys.a = true;
  if (e.code==="KeyS") state.keys.s = true;
  if (e.code==="KeyD") state.keys.d = true;
  if (e.code==="Digit1") state.activeSlot = "pistol";
  if (e.code==="Digit2") state.activeSlot = "primary";
  if (e.code==="KeyR") sendReload();
});
addEventListener("keyup", (e)=>{
  if (e.code==="KeyW") state.keys.w = false;
  if (e.code==="KeyA") state.keys.a = false;
  if (e.code==="KeyS") state.keys.s = false;
  if (e.code==="KeyD") state.keys.d = false;
});

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

// Zombie model (glTF) is included in /public/models/zombie.gltf, but we keep
// rendering procedural zombies by default for reliability. If you want to
// re-enable glTF later, bundle GLTFLoader locally and add an import map.
let zombiePrefab = null;

function makeOtherMesh(){
  const g = new THREE.CapsuleGeometry(0.35, 1.0, 6, 12);
  const m = new THREE.MeshStandardMaterial({ color: 0x7cd2ff, roughness: 0.55 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeZombieMesh(){
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
  recoil = Math.min(1, recoil + 0.9);
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
});

let last = performance.now();
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
  requestAnimationFrame(frame);
}
frame();