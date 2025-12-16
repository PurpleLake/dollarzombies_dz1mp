import { Button } from "../widgets/Button.js";
import { ListBox } from "../widgets/ListBox.js";

function sectionTitle(text){
  const h = document.createElement("div");
  h.style.fontWeight = "950";
  h.style.letterSpacing = "0.03em";
  h.style.textTransform = "uppercase";
  h.style.opacity = "0.9";
  h.style.fontSize = "12px";
  h.textContent = text;
  return h;
}

function mkCard(){
  const c = document.createElement("div");
  c.style.border = "1px solid rgba(255,255,255,0.08)";
  c.style.borderRadius = "14px";
  c.style.padding = "12px";
  c.style.background = "rgba(0,0,0,0.22)";
  return c;
}

export function DzsDevScreen({ engine, onClose }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";
  screen.style.background = "rgba(0,0,0,0.62)";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 95vw)";
  panel.style.height = "min(86vh, 780px)";
  panel.style.display = "grid";
  panel.style.gridTemplateColumns = "320px 1fr";
  panel.style.gap = "12px";
  panel.style.padding = "14px";

  // LEFT: navigation / sections
  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "10px";
  left.style.minWidth = "0";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "10px";

  const title = document.createElement("div");
  title.style.fontWeight = "950";
  title.style.fontSize = "16px";
  title.textContent = "DEVELOPER MENU";

  const spacer = document.createElement("div");
  spacer.style.flex = "1";

  const closeBtn = Button({ text:"Close (` or ')", variant:"secondary", onClick: ()=>onClose?.() });

  header.appendChild(title);
  header.appendChild(spacer);
  header.appendChild(closeBtn);

  const sub = document.createElement("div");
  sub.className = "dz-help";
  sub.textContent = "Panels for Weapons, Entities, Clients, and DZS Help.";

  const navItems = [
    { value:"weapons", label:"WEAPONS", meta:"defs + live state" },
    { value:"entities", label:"ENTITIES (ZOMBIES)", meta:"spawns + counts" },
    { value:"clients", label:"CLIENTS (PLAYERS)", meta:"input + stats" },
    { value:"dzs", label:"DSZ HELP", meta:"builtins + syntax" },
  ];

  let active = "dzs";
  const nav = ListBox({
    label: "Sections",
    items: navItems,
    value: active,
    onChange: (v)=> { active = v; renderRight(); },
    help: "Use mouse or type in DZS search.",
  });

  left.appendChild(header);
  left.appendChild(sub);
  left.appendChild(nav);

  // RIGHT: content
  const right = document.createElement("div");
  right.style.minWidth = "0";
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.gap = "10px";

  const rightHeader = mkCard();
  rightHeader.style.display = "flex";
  rightHeader.style.alignItems = "center";
  rightHeader.style.justifyContent = "space-between";
  rightHeader.style.gap = "10px";

  const rightTitle = document.createElement("div");
  rightTitle.style.fontWeight = "950";
  rightTitle.textContent = "DSZ HELP";

  const rightHint = document.createElement("div");
  rightHint.className = "dz-help";
  rightHint.style.marginLeft = "10px";
  rightHint.textContent = "Press ` or ' to toggle. This overlay does not pause the game yet.";

  rightHeader.appendChild(rightTitle);
  rightHeader.appendChild(rightHint);

  const body = mkCard();
  body.style.flex = "1";
  body.style.minHeight = "0";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "10px";

  // Shared: scrollable inner area
  const scroll = document.createElement("div");
  scroll.style.flex = "1";
  scroll.style.minHeight = "0";
  scroll.style.overflow = "auto";
  scroll.style.paddingRight = "6px";
  scroll.style.display = "flex";
  scroll.style.flexDirection = "column";
  scroll.style.gap = "10px";

  // DZS Help controls (search)
  const dzsControls = document.createElement("div");
  dzsControls.className = "dz-row";
  dzsControls.style.alignItems = "flex-end";

  const searchWrap = document.createElement("div");
  searchWrap.className = "dz-field";
  searchWrap.style.minWidth = "320px";

  const searchLab = document.createElement("div");
  searchLab.className = "dz-label";
  searchLab.textContent = "Search builtins";

  const search = document.createElement("input");
  search.className = "dz-input";
  search.placeholder = "type to filter builtins…";

  searchWrap.appendChild(searchLab);
  searchWrap.appendChild(search);

  dzsControls.appendChild(searchWrap);
  dzsControls.appendChild(document.createElement("div")).className = "dz-spacer";

  // --- section renderers ---
  function renderWeapons(){
    rightTitle.textContent = "WEAPONS";
    scroll.innerHTML = "";

    const db = engine?.ctx?.weapons;
    const arr = db?.list?.() || [];

    const intro = document.createElement("div");
    intro.className = "dz-help";
    intro.textContent = "Weapon defs live in engine/game/core/weapons/scripts/WeaponDefs.js. This panel reads WeaponDB at runtime.";
    scroll.appendChild(intro);

    if(arr.length === 0){
      const none = document.createElement("div");
      none.className = "dz-help";
      none.textContent = "No weapons loaded (WeaponDB missing).";
      scroll.appendChild(none);
      return;
    }

    for(const wpn of arr){
      const card = mkCard();
      const h = document.createElement("div");
      h.style.display="flex";
      h.style.justifyContent="space-between";
      h.style.gap="12px";
      const name = document.createElement("div");
      name.style.fontWeight="950";
      name.textContent = wpn.name;
      const id = document.createElement("div");
      id.style.fontFamily="var(--ui-mono)";
      id.style.opacity="0.8";
      id.textContent = wpn.id;
      h.appendChild(name);
      h.appendChild(id);

      const meta = document.createElement("div");
      meta.className="dz-help";
      meta.textContent = `DMG ${wpn.damage} | RNG ${wpn.range} | DROP ${wpn.dropoff} | CLIP ${wpn.ammoClip} | MAG ${wpn.ammoMag} | RPM ${wpn.rpm}`;

      const attrs = document.createElement("div");
      attrs.style.fontFamily="var(--ui-mono)";
      attrs.style.fontSize="12px";
      attrs.style.opacity="0.85";
      attrs.textContent = `ATTR: ${(wpn.attributes||[]).join(", ")}`;

      card.appendChild(h);
      card.appendChild(meta);
      card.appendChild(attrs);
      scroll.appendChild(card);
    }
  }

  function renderEntities(){
    rightTitle.textContent = "ENTITIES (ZOMBIES)";
    scroll.innerHTML = "";

    const z = engine?.ctx?.game?.zombies;
    const alive = z?.zombies?.size ?? 0;
    const spawns = z?.spawns?.length ?? 0;

    const summary = mkCard();
    summary.appendChild(sectionTitle("Live"));
    const s = document.createElement("div");
    s.className="dz-help";
    s.textContent = `Alive: ${alive} | Spawn points: ${spawns}`;
    summary.appendChild(s);
    scroll.appendChild(summary);

    const hint = document.createElement("div");
    hint.className="dz-help";
    hint.textContent = "Next: add per-zombie inspector, hitboxes, and model load status.";
    scroll.appendChild(hint);
  }

  function renderClients(){
    rightTitle.textContent = "CLIENTS (PLAYERS)";
    scroll.innerHTML = "";

    const p = engine?.ctx?.player;
    const card = mkCard();
    card.appendChild(sectionTitle("Player 0"));
    const hp = p?.hp ?? 0;
    const pos = p?.camPivot?.position;
    const posText = pos ? `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}` : "n/a";
    const wpn = p?.weaponDef?.name ?? "n/a";
    const ammo = p?.weapon ? `${p.weapon.clip}/${p.weapon.reserve}` : "n/a";
    const info = document.createElement("div");
    info.className="dz-help";
    info.textContent = `HP: ${hp} | POS: ${posText} | WEAPON: ${wpn} | AMMO: ${ammo}`;
    card.appendChild(info);
    scroll.appendChild(card);

    const hint = document.createElement("div");
    hint.className="dz-help";
    hint.textContent = "Next: show connected clients (multiplayer) and per-client input state.";
    scroll.appendChild(hint);
  }

  function renderDzs(){
    rightTitle.textContent = "DSZ HELP";
    scroll.innerHTML = "";

    // Controls at top of body for DZS help
    const syntax = mkCard();
    syntax.appendChild(sectionTitle("Syntax"));
    const syn = document.createElement("pre");
    syn.style.margin="10px 0 0 0";
    syn.style.padding="10px";
    syn.style.borderRadius="12px";
    syn.style.background="rgba(0,0,0,0.35)";
    syn.style.border="1px solid rgba(255,255,255,0.08)";
    syn.style.overflow="auto";
    syn.style.fontFamily="var(--ui-mono)";
    syn.style.fontSize="12px";
    syn.textContent = `on <eventName> {\n  <builtin> arg1 arg2 ...\n  <builtin> ...\n}\n\n// Example\non zm:build {\n  addFloor 60\n  addWalls 60 4\n  setPlayerSpawn 0 10\n}`;
    syntax.appendChild(syn);
    scroll.appendChild(syntax);

    const docsArr = engine?.ctx?.scripts?.dzs?.builtinDocs || [];
    const q = (search.value || "").toLowerCase().trim();
    const show = (Array.isArray(docsArr) ? docsArr : []).filter(d=>{
      const hay = `${d.name} ${d.sig} ${d.desc} ${d.example}`.toLowerCase();
      return !q || hay.includes(q);
    });

    const docsWrap = mkCard();
    docsWrap.appendChild(sectionTitle("Builtins"));
    const docsList = document.createElement("div");
    docsList.style.display="flex";
    docsList.style.flexDirection="column";
    docsList.style.gap="10px";
    docsList.style.marginTop="10px";

    for(const d of show){
      const card = mkCard();
      card.style.background = "rgba(0,0,0,0.28)";

      const h = document.createElement("div");
      h.style.display="flex";
      h.style.justifyContent="space-between";
      h.style.gap="12px";
      const name = document.createElement("div");
      name.style.fontWeight="950";
      name.textContent = d.name;
      const sig = document.createElement("div");
      sig.style.fontFamily = "var(--ui-mono)";
      sig.style.opacity = "0.85";
      sig.textContent = d.sig;
      h.appendChild(name);
      h.appendChild(sig);

      const desc = document.createElement("div");
      desc.className="dz-help";
      desc.style.marginTop="6px";
      desc.textContent = d.desc;

      card.appendChild(h);
      card.appendChild(desc);

      if(d.example){
        const ex = document.createElement("pre");
        ex.style.margin="10px 0 0 0";
        ex.style.padding="10px";
        ex.style.borderRadius="12px";
        ex.style.background="rgba(0,0,0,0.35)";
        ex.style.border="1px solid rgba(255,255,255,0.08)";
        ex.style.overflow="auto";
        ex.style.fontFamily="var(--ui-mono)";
        ex.style.fontSize="12px";
        ex.textContent = `on zm:build {\n  ${d.example}\n}`;
        card.appendChild(ex);
      }

      docsList.appendChild(card);
    }

    if(show.length == 0){
      const none = document.createElement("div");
      none.className="dz-help";
      none.textContent = "No matching builtins.";
      docsList.appendChild(none);
    }

    docsWrap.appendChild(docsList);
    scroll.appendChild(docsWrap);
  }

  function renderRight(){
    // Clear body and rebuild per section
    body.innerHTML = "";

    if(active === "dzs"){
      body.appendChild(dzsControls);
    }

    body.appendChild(scroll);

    if(active === "weapons") renderWeapons();
    else if(active === "entities") renderEntities();
    else if(active === "clients") renderClients();
    else renderDzs();
  }

  search.addEventListener("input", ()=>{ if(active === "dzs") renderRight(); });
  renderRight();

  right.appendChild(rightHeader);
  right.appendChild(body);

  panel.appendChild(left);
  panel.appendChild(right);
  screen.appendChild(panel);
  return screen;
}
