import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

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
let weapons = {};
let lists = { primary:[], pistols:[] };
let round = { between:true, wave:1, zombiesTarget:0, zombiesSpawned:0, zombiesKilled:0 };
let paused = false;

const ws = new WebSocket(`ws://${location.host}`);
ws.addEventListener("open", ()=> ui.status.textContent = "Connected. Click Play.");
ws.addEventListener("close", ()=> ui.status.textContent = "Disconnected.");
ws.addEventListener("message", (e)=> onMsg(JSON.parse(e.data)));

const state = {
  players: new Map(), // id -> snapshot
  zombies: new Map(), // id -> {x,y,z,hp}
  keys: { w:false,a:false,s:false,d:false },
  yaw: 0,
  pitch: 0,
  activeSlot: "primary",
  lastSendAt: 0,
  mouseDown: false,
  nextClientFireAt: 0,
};

function onMsg(msg){
  if (msg.type === "welcome"){
    myId = msg.id;
    arena = msg.arena;
    obstacles = msg.obstacles || [];
    weapons = msg.weapons;
    lists = msg.lists;
    round = msg.round;
    buildArena();
    rebuildObstacles();
    rebuildLists();
    ui.status.textContent = `Welcome ${myId}.`;
    setRoundUI(round.between);
  }
  if (msg.type === "snapshot"){
    state.players.clear();
    for (const p of msg.players) state.players.set(p.id, p);
    state.zombies.clear();
    for (const z of msg.zombies) state.zombies.set(z.id, z);
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
  if (msg.type === "phit"){
    if (msg.id === myId) toast("Hit!");
  }
  if (msg.type === "pdown"){
    if (msg.id === myId) toast("Down!");
  }

  if (msg.type === "zhit" || msg.type === "zdead"){
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

function renderDevMenu(){
  if (!ui.devBody) return;
  const me = state.players.get(myId);
  const active = me ? activeWeaponSnapshot(me) : null;
  const activeId = active?.id || (me?.pistol?.id || "");
  const w = getWeaponDef(activeId);

  const section = (title)=>{
    const s = document.createElement("div");
    s.className = "devSection";
    const h = document.createElement("div");
    h.className = "h";
    h.textContent = title;
    s.appendChild(h);
    return s;
  };
  const row = (k, el)=>{
    const r = document.createElement("div");
    r.className = "devRow";
    const kk = document.createElement("div");
    kk.className = "k";
    kk.textContent = k;
    r.appendChild(kk);
    r.appendChild(el);
    return r;
  };

  ui.devBody.innerHTML = "";

  // Weapons
  const s1 = section("Weapons");
  const selPrimary = document.createElement("select");
  const selPistol = document.createElement("select");

  const mkOpt = (sel, id)=>{
    const o = document.createElement("option");
    o.value = id;
    o.textContent = weaponLabel(id);
    sel.appendChild(o);
  };

  // Populate selects
  selPrimary.innerHTML = "";
  for (const wid of (lists.primary || [])) mkOpt(selPrimary, wid);
  selPistol.innerHTML = "";
  for (const wid of (lists.pistols || [])) mkOpt(selPistol, wid);

  // Default values
  if (me?.primary?.id) selPrimary.value = me.primary.id;
  if (me?.pistol?.id) selPistol.value = me.pistol.id;

  const btnEquipPrimary = document.createElement("button");
  btnEquipPrimary.className = "btn primary";
  btnEquipPrimary.textContent = "Equip Primary (mid-round)";
  btnEquipPrimary.onclick = () => {
    ws.send(JSON.stringify({ type:"devSetLoadout", primary: selPrimary.value }));
    toast("Primary swapped.");
  };

  const btnEquipPistol = document.createElement("button");
  btnEquipPistol.className = "btn";
  btnEquipPistol.textContent = "Equip Pistol (mid-round)";
  btnEquipPistol.onclick = () => {
    ws.send(JSON.stringify({ type:"devSetLoadout", pistol: selPistol.value }));
    toast("Pistol swapped.");
  };

  s1.appendChild(row("Primary", selPrimary));
  s1.appendChild(btnEquipPrimary);
  s1.appendChild(document.createElement("div"));
  s1.appendChild(row("Pistol", selPistol));
  s1.appendChild(btnEquipPistol);
  ui.devBody.appendChild(s1);

  // Active weapon stats
  const s2 = section("Active Weapon Stats");
  const grid = document.createElement("div");
  grid.className = "devGrid";
  const stat = (k,v)=>{
    const d = document.createElement("div");
    d.className = "devStat";
    const kk = document.createElement("div");
    kk.className = "k"; kk.textContent = k;
    const vv = document.createElement("div");
    vv.className = "v"; vv.textContent = v;
    d.appendChild(kk); d.appendChild(vv);
    return d;
  };
  if (w){
    grid.appendChild(stat("Name", w.name));
    grid.appendChild(stat("Mode", (w.mode||"semi").toUpperCase()));
    grid.appendChild(stat("Damage", `${w.dmgClose ?? w.damage ?? "?"} → ${w.dmgFar ?? "?"} (head x2)`));
    grid.appendChild(stat("Range", `${w.range}`));
    grid.appendChild(stat("Mag", `${w.mag}`));
    grid.appendChild(stat("Fire", `${w.fireMs}ms`));
  } else {
    grid.appendChild(stat("Active", "No weapon"));
  }
  s2.appendChild(grid);
  ui.devBody.appendChild(s2);

  // Controls
  const s3 = section("Controls");
  const btnP = document.createElement("button");
  btnP.className = "btn";
  btnP.textContent = "Set Slot: Pistol (1)";
  btnP.onclick = ()=> state.activeSlot = "pistol";
  const btnR = document.createElement("button");
  btnR.className = "btn";
  btnR.textContent = "Set Slot: Primary (2)";
  btnR.onclick = ()=> state.activeSlot = "primary";
  s3.appendChild(btnP);
  s3.appendChild(btnR);
  const tip = document.createElement("div");
  tip.style.opacity = .75;
  tip.style.fontSize = "12px";
  tip.style.marginTop = "10px";
  tip.textContent = "Tip: press ` to toggle this menu. Auto guns fire while holding mouse.";
  s3.appendChild(tip);
  ui.devBody.appendChild(s3);

  // Spawning helpers (foundation for scripting)
  const s4 = section("Spawner Helpers");
  const pos = document.createElement('div');
  pos.className = 'devMono';
  if (me){
    pos.textContent = `pos: x=${me.x.toFixed(2)} z=${me.z.toFixed(2)}  yaw=${state.yaw.toFixed(3)} pitch=${state.pitch.toFixed(3)}`;
  } else {
    pos.textContent = 'pos: —';
  }
  const mkCopy = (label, textFn)=>{
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = label;
    b.onclick = async ()=>{
      try{
        const t = textFn();
        await navigator.clipboard.writeText(t);
        toast('Copied to clipboard');
      } catch {
        toast('Copy failed');
      }
    };
    return b;
  };
  s4.appendChild(pos);
  s4.appendChild(mkCopy('Copy: spawn zombie here', ()=>{
    if (!me) return '';
    return `spawn zombie x=${me.x.toFixed(2)} z=${me.z.toFixed(2)}`;
  }));
  s4.appendChild(mkCopy('Copy: spawn box here', ()=>{
    if (!me) return '';
    return `spawn box x=${me.x.toFixed(2)} z=${me.z.toFixed(2)} hx=1.2 hz=1.2 h=1.4`;
  }));
  const note = document.createElement('div');
  note.style.opacity = .75;
  note.style.fontSize = '12px';
  note.style.marginTop = '10px';
  note.textContent = 'These lines match scripts/level1.dzs (server reads it on startup).';
  s4.appendChild(note);
  ui.devBody.appendChild(s4);
}

function rebuildLists(){
  ui.primaryList.innerHTML = "";
  for (const wid of lists.primary){
    const btn = document.createElement("button");
    btn.className = "item";
    btn.textContent = weapons[wid]?.name || wid;
    btn.onclick = () => ws.send(JSON.stringify({ type:"pickPrimary", weapon: wid }));
    ui.primaryList.appendChild(btn);
  }

  ui.pistolList.innerHTML = "";
  for (const wid of lists.pistols){
    const btn = document.createElement("button");
    btn.className = "item";
    btn.textContent = weapons[wid]?.name || wid;
    btn.onclick = () => ws.send(JSON.stringify({ type:"pickPistol", weapon: wid }));
    ui.pistolList.appendChild(btn);
  }
}

ui.btnReady.onclick = () => ws.send(JSON.stringify({ type:"ready" }));
document.querySelectorAll("[data-buy]").forEach(el=>{
  el.addEventListener("click", ()=> ws.send(JSON.stringify({ type:"buy", item: el.getAttribute("data-buy") })));
});

ui.btnPause.onclick = () => {
  paused = !paused;
  ui.btnPause.textContent = paused ? "Resume" : "Pause";
  if (paused){
    // free the cursor so UI clicks work
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    // lock cursor back in
    renderer.domElement.requestPointerLock();
  }
};

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
const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x120b18, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(12, 22, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(1024,1024);
dir.shadow.camera.left = -70;
dir.shadow.camera.right = 70;
dir.shadow.camera.top = 70;
dir.shadow.camera.bottom = -70;
scene.add(dir);

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

// Floor
const floorMat = new THREE.MeshStandardMaterial({ color: 0x18301e, roughness: 1.0, metalness: 0.0, map: grassTex });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(500,500,1,1), floorMat);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

// Obstacles (server-authoritative)
const props = new THREE.Group();
scene.add(props);

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
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85 });
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

function makeOtherMesh(){
  const g = new THREE.CapsuleGeometry(0.35, 1.0, 6, 12);
  const m = new THREE.MeshStandardMaterial({ color: 0x7cd2ff, roughness: 0.55 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeZombieMesh(){
  // Low-poly zombie model: chunky body/head/legs/arms
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

  const active = (state.activeSlot==="pistol") ? me.pistol : me.primary;
  if (!active){
    toast("Pick a primary between rounds.");
    return;
  }
  ws.send(JSON.stringify({ type:"shoot", weapon: active.id, aim: { yaw: state.yaw, pitch: state.pitch } }));
  // local recoil + muzzle flash so it's visually "FPS"
  recoil = Math.min(1, recoil + 0.9);
  muzzleFlash.material.opacity = 0.85;
}

function sendReload(){
  const me = state.players.get(myId);
  if (!me) return;
  const active = (state.activeSlot==="pistol") ? me.pistol : me.primary;
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
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
