// engine/client/dev/devMenu.js
// Dev menu + dev popup UI extracted from clientCore.js.
// This module is intentionally UI-only. Game logic stays in clientCore.

function escapeHtml(s){
  return String(s).replace(/[&<>\"]/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

// Single source of truth for the in-game DZS help UI.
// Update this object whenever you add new .dzs commands/events/functions.
export const DZS_HELP = {
  version: "v2",
  updated: "2025-12-14",
  items: [
    { name: "spawn box", kind:"command", syntax: "spawn box x=<num> z=<num> hx=<num> hz=<num> h=<num>", desc:"Spawns a static collision box (crate/barrier).",
      params:[
        ["x","World X position (required)"],
        ["z","World Z position (required)"],
        ["hx","Half-width on X (required)"],
        ["hz","Half-depth on Z (required)"],
        ["h","Height (required)"]
      ],
      examples:[`spawn box x=8 z=14 hx=1.4 hz=1.0 h=1.6`]
    },
    { name: "spawn weapon", kind:"command", syntax: "spawn weapon weapon=<weaponId> x=<num> z=<num>", desc:"Spawns a weapon pickup.",
      params:[
        ["weapon","Weapon id from weapon defs (required)"],
        ["x","World X position (required)"],
        ["z","World Z position (required)"]
      ],
      examples:[`spawn weapon weapon=glock x=2 z=6`]
    },
    { name: "spawn zombie", kind:"command", syntax: "spawn zombie x=<num> z=<num>", desc:"Spawns a zombie entity (if enabled in your build).",
      params:[["x","World X (required)"],["z","World Z (required)"]],
      examples:[`spawn zombie x=24 z=24`]
    },
    { name: "let / set", kind:"syntax", syntax: "let name = expr\nset name = expr", desc:"Create or update script variables.",
      params:[["expr","Numbers, strings, arithmetic, and other vars"]],
      examples:[`let n = 5`,`set n = n + 1`]
    },
    { name: "if / else", kind:"syntax", syntax: "if (cond) { ... } else { ... }", desc:"Conditional branching.",
      params:[["cond","Supports == != < <= > >=, &&, ||, %, parentheses"]],
      examples:[`if (wave >= 2) { spawn weapon weapon=mg42 x=0 z=-18 } else { spawn weapon weapon=shotgun_semi x=0 z=-18 }`]
    },
    { name: "for loop", kind:"syntax", syntax: "for (init; cond; step) { ... }", desc:"Looping construct.",
      params:[["init","e.g. i=0"],["cond","e.g. i<n"],["step","e.g. i=i+1"]],
      // IMPORTANT: \${...} must stay literal for DZS, never interpolate in JS.
      examples:[`let n = 5\nfor (i=0; i<n; i=i+1) { spawn box x=\${-12+i*3} z=-10 hx=1.2 hz=1.2 h=1.4 }`]
    },
    { name: "Events", kind:"events", syntax: "on <eventName> { ... }", desc:"Event hooks run on top of game defaults.",
      params:[["eventName","gameStart, tick, playerSpawn, playerDeath, damage, kill"]],
      examples:[`on gameStart { hudText target=all key=\"hud:boot\" x=0.02 y=0.02 size=18 text=\"DZS HUD online ✅\" }`]
    },
    { name: "addCash / takeCash / setCash", kind:"function", syntax: "addCash(n)\ntakeCash(n)\nsetCash(n)", desc:"Economy functions for the event player.",
      params:[["n","Number of dollars"]],
      examples:[`on kill { addCash(5) }`]
    },
    { name: "hudText", kind:"hud", syntax: "hudText target=<selector> key=\"<id>\" x=<0..1> y=<0..1> size=<n> text=\"...\" [align=left|center|right] [alpha=0..1]", desc:"Draw/update text on the script HUD.",
      params:[["target","all | self | player(id) | player:<id> | radius(x,z,r)"],["key","Stable id for updates"],["x,y","Normalized position"],["size","Font size"],["text","String"],["align","Optional"],["alpha","Optional"]],
      examples:[`on tick { hudText target=all key=\"hud:title\" x=0.02 y=0.05 size=22 text=\"DOLLAR ZOMBIES\" }`]
    },
    { name: "hudRect", kind:"hud", syntax: "hudRect target=<selector> key=\"<id>\" x=<0..1> y=<0..1> w=<0..1> h=<0..1> [alpha=0..1]", desc:"Draw/update a rectangle on the script HUD (bars/backgrounds).",
      params:[["target","all | self | player(id) | player:<id> | radius(x,z,r)"],["key","Stable id for updates"],["x,y,w,h","Normalized"],["alpha","Optional"]],
      examples:[`on tick { hudRect target=self key=\"hud:hpBg\" x=0.02 y=0.11 w=0.18 h=0.02 alpha=0.35 }`]
    },
    { name: "hudClear", kind:"hud", syntax: "hudClear target=<selector> [key=\"<id>\"]", desc:"Clears all script HUD elements for a target, or a single key.",
      params:[["target","all | self | player(id) | player:<id> | radius(x,z,r)"],["key","Optional, clears only this element"]],
      examples:[`on playerDeath { hudClear target=self }`]
    },
  ]
};


function highlightDzs(code){
  // Tiny DZS highlighter: comments, strings, numbers, keywords
  const esc = escapeHtml(code);
  const KEYWORDS = /\b(spawn|box|weapon|zombie|let|set|if|else|for|on|tick|gameStart|playerSpawn|playerDeath|damage|kill|hudText|hudRect|hudClear|addCash|takeCash|setCash)\b/g;
  let s = esc;

  // comments (#... or //...)
  s = s.replace(/(^|\n)\s*(#.*)$/g, (m,p1,p2)=> `${p1}<span class="dzsTokComment">${p2}</span>`);
  s = s.replace(/(^|\n)\s*(\/\/.*)$/g, (m,p1,p2)=> `${p1}<span class="dzsTokComment">${p2}</span>`);

  // strings
  s = s.replace(/(&quot;.*?&quot;)/g, '<span class="dzsTokString">$1</span>');

  // numbers (simple)
  s = s.replace(/(\b\d+(\.\d+)?\b)/g, '<span class="dzsTokNumber">$1</span>');

  // keywords
  s = s.replace(KEYWORDS, '<span class="dzsTokKw">$1</span>');

  // templates ${...}
  s = s.replace(/(\$\{[^}]+\})/g, '<span class="dzsTokTpl">$1</span>');
  return s;
}

function buildDzsHelpPanel(state){
  const wrap = document.createElement("div");
  wrap.className = "dzsHelp dzs-help-panel";

  // Prefer server-provided help if available, fallback to local.
  const help = (state && state.dzsHelp && Array.isArray(state.dzsHelp.items) && state.dzsHelp.items.length > 0)
    ? state.dzsHelp
    : DZS_HELP;

  const header = document.createElement("div");
  header.className = "dzsHelpHeader";
  header.innerHTML =
    `<div class="dzsHelpTitle">Dollar Zombies Script (.dzs)</div>
     <div class="dzsHelpMeta">Version ${escapeHtml(help.version || "v2")} • Updated ${escapeHtml(help.updated || "unknown")}</div>`;
  wrap.appendChild(header);

  const searchRow = document.createElement("div");
  searchRow.className = "dzsHelpSearchRow";
  const search = document.createElement("input");
  search.className = "dzsHelpSearch";
  search.placeholder = "Search commands, events, params…";
  searchRow.appendChild(search);

  const count = document.createElement("div");
  count.className = "dzsHelpCount";
  searchRow.appendChild(count);

  wrap.appendChild(searchRow);

  const scroll = document.createElement("div");
  scroll.className = "dzsHelpScroll";
  wrap.appendChild(scroll);

  const items = Array.isArray(help.items) ? help.items : [];
  const detailNodes = [];

  function normalize(s){ return String(s || "").toLowerCase(); }

  function renderItems(filter){
    scroll.innerHTML = "";
    detailNodes.length = 0;

    const f = normalize(filter);
    let shown = 0;

    for (const it of items){
      const hay = normalize([it.name, it.kind, it.syntax, it.desc,
        ...(it.params||[]).flat().map(String),
        ...(it.examples||[]).map(String)
      ].join(" "));

      if (f && !hay.includes(f)) continue;

      const details = document.createElement("details");
      details.className = "dzsHelpItem";

      const sum = document.createElement("summary");
      sum.className = "dzsHelpSummary";
      sum.innerHTML = `<span class="dzsHelpName">${escapeHtml(it.name || "")}</span>
                       <span class="dzsHelpKind">${escapeHtml(it.kind || "")}</span>`;
      details.appendChild(sum);

      const body = document.createElement("div");
      body.className = "dzsHelpBody";

      if (it.desc){
        const p = document.createElement("div");
        p.className = "dzsHelpDesc";
        p.textContent = it.desc;
        body.appendChild(p);
      }

      if (it.syntax){
        const pre = document.createElement("pre");
        pre.className = "dzsHelpCode";
        pre.innerHTML = highlightDzs(it.syntax);
        body.appendChild(pre);
      }

      if (it.params && it.params.length){
        const tbl = document.createElement("table");
        tbl.className = "dzsHelpTable";
        for (const [k,v] of it.params){
          const tr = document.createElement("tr");
          const td1 = document.createElement("td");
          td1.className = "k";
          td1.textContent = k;
          const td2 = document.createElement("td");
          td2.textContent = v;
          tr.appendChild(td1);
          tr.appendChild(td2);
          tbl.appendChild(tr);
        }
        body.appendChild(tbl);
      }

      if (it.examples && it.examples.length){
        const exTitle = document.createElement("div");
        exTitle.className = "dzsHelpExTitle";
        exTitle.textContent = "Examples";
        body.appendChild(exTitle);

        for (const ex of it.examples){
          const pre = document.createElement("pre");
          pre.className = "dzsHelpCode";
          pre.innerHTML = highlightDzs(String(ex));
          body.appendChild(pre);
        }
      }

      details.appendChild(body);
      scroll.appendChild(details);
      detailNodes.push({ details, it, hay });
      shown++;
    }

    count.textContent = `${shown}/${items.length}`;
  }

  renderItems("");

  let t = null;
  search.addEventListener("input", ()=>{
    clearTimeout(t);
    const q = search.value;
    t = setTimeout(()=> renderItems(q), 80);
  });

  return wrap;
}

function weaponCategory(id, w){
  if (!w) return "Other";
  if (w.slot === "pistol") return "Pistols";
  if ((w.pellets||1) > 1 || String(id).includes("shotgun")) return "Shotguns";
  if (String(id).includes("mg") || String(id).includes("mg42") || /MG/i.test(w.name||"")) return "Light Machine Guns";
  if (String(id).includes("dmr")) return "DMR";
  return "Assault Rifles";
}


function ensureDevMenuStyles(){
  if (document.getElementById("devMenuStyles")) return;
  const st = document.createElement("style");
  st.id = "devMenuStyles";
  st.textContent = `
    .dzs-help-panel{ color:#fff; }
    .dzsHelpHeader .dzsHelpTitle{ color:#fff; font-weight:700; }
    .dzsHelpHeader .dzsHelpMeta{ color:rgba(255,255,255,0.75); font-size:12px; }
    .dzsHelpSearchRow{ display:flex; gap:10px; align-items:center; margin:10px 0 8px; }
    .dzsHelpSearch{ flex:1; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.18);
      background: rgba(0,0,0,0.35); color:#fff; outline:none; }
    .dzsHelpSearch::placeholder{ color:rgba(255,255,255,0.55); }
    .dzsHelpCount{ color:rgba(255,255,255,0.7); font-size:12px; min-width:56px; text-align:right; }
    .dzsHelpItem{ border-bottom:1px solid rgba(255,255,255,0.14); padding:6px 0; }
    .dzsHelpSummary{ cursor:pointer; display:flex; justify-content:space-between; gap:12px; }
    .dzsHelpName{ color:#fff; font-weight:650; }
    .dzsHelpKind{ color:rgba(255,255,255,0.65); font-size:12px; }
    .dzsHelpDesc{ color:rgba(255,255,255,0.85); margin:6px 0 8px; }
    .dzsHelpTable{ width:100%; border-collapse:collapse; margin:8px 0; }
    .dzsHelpTable td{ padding:4px 6px; vertical-align:top; color:rgba(255,255,255,0.85); }
    .dzsHelpTable td.k{ color:#fff; font-weight:650; width:160px; }
    .dzsHelpExTitle{ color:#fff; font-weight:650; margin-top:6px; }
    .dzsHelpCode{ background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
      border-radius:10px; padding:10px; overflow:auto; color:#fff; }
    .dzsTokComment{ color:rgba(255,255,255,0.55); }
    .dzsTokKw{ color:#7dd3fc; font-weight:650; }
    .dzsTokString{ color:#f9a8d4; }
    .dzsTokNumber{ color:#fde68a; }
    .dzsTokTpl{ color:#86efac; }
  `;
  document.head.appendChild(st);
}
export function initDevMenu({
  ui,
  getWs,
  toast,
  state,
  getMyId,
  getWeapons,
  setDebugVisible,
  isDebugVisible,
  unlockPointer,
  relockPointerSoon,
}){
  let devPopupMode = null;
  ensureDevMenuStyles();

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

  function openDevPopup(mode){
    devPopupMode = mode;
    const el = ensureDevPopup();
    el.classList.remove("hidden");
    // Make sure the cursor is available for interacting with the popup.
    // Pointer lock can otherwise swallow clicks.
    unlockPointer();
    renderDevPopup();
  }

  function closeDevPopup(){
    const el = ensureDevPopup();
    el.classList.add("hidden");
    devPopupMode = null;
    relockPointerSoon();
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
    const bigBtn = (label, onClick, disabled=false)=>{
      const b = document.createElement("button");
      b.className = "btn wide";
      b.textContent = label;
      b.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        try { onClick?.(); } catch (err){ console.warn('devMenu click error', err); }
      });
      b.disabled = !!disabled;
      return b;
    };

    const ws = getWs();
    const connected = !!(ws && ws.readyState === 1);

    const s = section("DEV MENU");
    s.appendChild(bigBtn("Weapons", ()=> openDevPopup("weapons"), false));
    s.appendChild(bigBtn("DZS Help", ()=> openDevPopup("dzshelp"), false));
    s.appendChild(bigBtn(`${isDebugVisible?.() ? 'Hide' : 'Show'} Debug UI`, ()=>{
      const next = !(isDebugVisible?.());
      setDebugVisible?.(next);
      toast(next ? 'Debug UI enabled' : 'Debug UI hidden');
      renderDevMenu();
    }, false));
    s.appendChild(bigBtn(connected ? "Force Reset" : "Force Reset (disconnected)", ()=>{
      const w = getWs();
      if (!w || w.readyState !== 1){ toast("Not connected."); return; }
      w.send(JSON.stringify({ type:"restart", reason:"devMenu" }));
      toast("Force reset sent.");
    }, !connected));
    s.appendChild(bigBtn("Players", ()=> openDevPopup("players"), false));
    s.appendChild(bigBtn("Entities", ()=> openDevPopup("entities"), false));
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

    const myId = getMyId();
    const me = myId ? state.players.get(myId) : null;

    if (devPopupMode === "weapons"){
      titleEl.textContent = "Weapons";
      const weapons = getWeapons() || {};

      // Large weapon libraries need scrolling.
      const scroller = document.createElement('div');
      scroller.style.maxHeight = '65vh';
      scroller.style.overflow = 'auto';
      scroller.style.paddingRight = '6px';
      bodyEl.appendChild(scroller);

      const mkSectionW = (t)=>{
        const wrap = document.createElement("div");
        wrap.className = "devSection";
        const h = document.createElement("div");
        h.className = "h";
        h.textContent = t;
        wrap.appendChild(h);
        scroller.appendChild(wrap);
        return wrap;
      };
      // Auto-populate and show full weapon attributes using <details> cards.
      const cats = new Map();
      for (const [id, w] of Object.entries(weapons)){
        const c = weaponCategory(id, w);
        if (!cats.has(c)) cats.set(c, []);
        cats.get(c).push({ id, w });
      }

      const order = ["Pistols","Shotguns","Assault Rifles","Light Machine Guns","DMR","Other"];
      const mkRow = (k,v)=>{
        const r = document.createElement('div');
        r.style.display = 'flex';
        r.style.gap = '10px';
        r.style.fontSize = '12px';
        const kk = document.createElement('div');
        kk.style.opacity = '0.75';
        kk.style.width = '120px';
        kk.textContent = k;
        const vv = document.createElement('div');
        vv.style.opacity = '0.95';
        vv.textContent = v;
        r.appendChild(kk); r.appendChild(vv);
        return r;
      };

      for (const c of order){
        const items = cats.get(c);
        if (!items || !items.length) continue;
        items.sort((a,b)=> (a.w.name||a.id).localeCompare(b.w.name||b.id));
        const sec = mkSectionW(c);
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '10px';

        for (const it of items){
          const w = it.w || {};
          const dmgClose = w.damage ?? w.dmgClose ?? 0;
          const drop = w.rangeDropOff || {};
          const dropStart = drop.start ?? Math.round((w.range||0) * 0.35);
          const dropEnd   = drop.end ?? (w.range ?? 0);
          const dmgFar    = drop.farDamage ?? w.dmgFar ?? dmgClose;
          const clipMax   = w.clipMaxAmmo ?? w.mag ?? 0;
          const reserveMax= w.reserveMaxAmmo ?? w.reserve ?? 0;
          const model     = w.model || '(none)';

          const card = document.createElement('details');
          card.style.border = '1px solid rgba(255,255,255,0.10)';
          card.style.background = 'rgba(255,255,255,0.05)';
          card.style.borderRadius = '14px';
          card.style.padding = '10px 12px';

          const sum = document.createElement('summary');
          sum.style.cursor = 'pointer';
          sum.style.display = 'flex';
          sum.style.justifyContent = 'space-between';
          sum.style.alignItems = 'center';
          sum.innerHTML = `<span style="font-weight:800;">${escapeHtml(w.name || it.id)}</span>
                           <span style="opacity:.75; font-size:12px;">DMG ${Math.round(dmgClose)}→${Math.round(dmgFar)} • R ${w.range||0} • MAG ${clipMax}</span>`;
          card.appendChild(sum);

          const body = document.createElement('div');
          body.style.marginTop = '10px';
          body.appendChild(mkRow('id', it.id));
          body.appendChild(mkRow('damage', String(dmgClose)));
          body.appendChild(mkRow('range', String(w.range ?? 0)));
          body.appendChild(mkRow('clipMaxAmmo', String(clipMax)));
          body.appendChild(mkRow('reserveMaxAmmo', String(reserveMax)));
          body.appendChild(mkRow('rangeDropOff', `start ${dropStart}, end ${dropEnd}, close ${Math.round(drop.closeDamage ?? dmgClose)}, far ${Math.round(dmgFar)}`));
          body.appendChild(mkRow('recoilScale', String(w.recoilScale ?? 1)));
          body.appendChild(mkRow('model', model));

          const equipBtn = document.createElement('button');
          equipBtn.className = 'btn primary';
          equipBtn.style.marginTop = '10px';
          equipBtn.textContent = 'Equip';
          equipBtn.onclick = ()=>{
            const ws = getWs();
            if (ws && ws.readyState === 1){
              ws.send(JSON.stringify({ type:"devEquipWeapon", weapon: it.id }));
              toast(`Equipped ${w.name || it.id}`);
              closeDevPopup();
            } else {
              toast('Not connected.');
            }
          };

          const giveBtn = document.createElement('button');
          giveBtn.className = 'btn';
          giveBtn.style.marginTop = '10px';
          giveBtn.style.marginLeft = '10px';
          giveBtn.textContent = 'Give weapon';
          giveBtn.onclick = ()=>{
            const ws = getWs();
            if (ws && ws.readyState === 1){
              ws.send(JSON.stringify({ type:"devGiveWeapon", weapon: it.id }));
              toast(`Gave ${w.name || it.id}`);
            } else {
              toast('Not connected.');
            }
          };

          const btnRow = document.createElement('div');
          btnRow.style.display = 'flex';
          btnRow.style.gap = '10px';
          btnRow.appendChild(equipBtn);
          btnRow.appendChild(giveBtn);
          body.appendChild(btnRow);
          card.appendChild(body);
          list.appendChild(card);
        }
        sec.appendChild(list);
      }
      const hint = document.createElement("div");
      hint.className = "devHint";
      hint.textContent = "Click a weapon to equip instantly. (Mid-round enabled for dev.)";
      bodyEl.appendChild(hint);
      return;
    }

    if (devPopupMode === "dzshelp"){
      titleEl.textContent = "DZS Help";
      // Ask server for the authoritative supported command list (auto-generated).
      try{
        const w = getWs();
        if (w && w.readyState === 1){
          w.send(JSON.stringify({ type:"getDzsHelp" }));
        }
      }catch(_e){}
      bodyEl.appendChild(buildDzsHelpPanel(state));

      const hint = document.createElement("div");
      hint.className = "devHint";
      hint.textContent = "Update DZS_HELP (engine/client/dev/devMenu.js) when new commands/events/functions are added.";
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
          const ws = getWs();
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
      const ws = getWs();
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
      unlockPointer();
      renderDevMenu();
      clearInterval(toggleDevMenu._t);
      toggleDevMenu._t = setInterval(()=>{
        if (ui.devMenu.classList.contains('hidden')) return;
        renderDevMenu();
      }, 450);
    } else {
      clearInterval(toggleDevMenu._t);
      relockPointerSoon();
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

  return {
    toggleDevMenu,
    renderDevMenu,
    openDevPopup,
    closeDevPopup,
    refreshDevPopup: renderDevPopup,
  };
}
