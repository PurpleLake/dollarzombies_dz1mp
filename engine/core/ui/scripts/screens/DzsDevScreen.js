import { Button } from "../widgets/Button.js";
import { ListBox } from "../widgets/ListBox.js";
import { MapEditorScreen } from "/engine/tools/map_editor/MapEditorScreen.js";

const GSC_SAMPLE_PATH = "/public/scripts/gsc_sample.dzs";
const GSC_SAMPLE_TEXT = `# GSC-style sample script for custom modes.

on onGameStart {
  level.wave = 1
  level thread modeController()
}

modeController(){
  endon "game_end"
  while(true){
    wait 30
    level.wave = (level.wave || 1) + 1
    iPrintLnAll ^3Wave:^7 level.wave
  }
}

on onPlayerSpawned {
  self thread playerDeathLoop()
}

playerDeathLoop(){
  endon "disconnect"
  while(true){
    waittill "death"
    iPrintLnAll ^1Player died.
  }
}`;

const MONACO_CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs";
const MONACO_LANG = "dzs";

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

function loadMonaco(){
  if(window.monaco) return Promise.resolve(window.monaco);
  if(window.__dzsMonacoPromise) return window.__dzsMonacoPromise;
  window.__dzsMonacoPromise = new Promise((resolve, reject)=>{
    const loader = document.createElement("script");
    loader.src = `${MONACO_CDN}/loader.min.js`;
    loader.async = true;
    loader.onload = ()=>{
      try{
        window.require.config({ paths: { vs: MONACO_CDN } });
        window.require(["vs/editor/editor.main"], ()=> resolve(window.monaco));
      } catch (err){
        reject(err);
      }
    };
    loader.onerror = reject;
    document.head.appendChild(loader);
  });
  return window.__dzsMonacoPromise;
}

function registerDzsLanguage(monaco, docs){
  if(window.__dzsMonacoLangRegistered) return;
  window.__dzsMonacoLangRegistered = true;

  monaco.languages.register({ id: MONACO_LANG });
  monaco.languages.setMonarchTokensProvider(MONACO_LANG, {
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/\/\/.*$/, "comment"],
        [/\bon\b/, "keyword"],
        [/\b(wait|waittill|endon|notify|thread)\b/, "keyword"],
        [/\b(self|level|event)\b/, "keyword"],
        [/\b(true|false|null)\b/, "constant"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string_dq"],
        [/'/, "string", "@string_sq"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/\b[A-Za-z_][\w-]*\b/, "identifier"],
      ],
      string_dq: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],
      string_sq: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, "string", "@pop"],
      ],
    }
  });
  monaco.languages.setLanguageConfiguration(MONACO_LANG, {
    comments: { lineComment: "//" },
    brackets: [["{","}"], ["(",")"], ["[","]"]],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "\"", close: "\"" },
      { open: "'", close: "'" },
    ],
  });
  monaco.languages.registerCompletionItemProvider(MONACO_LANG, {
    provideCompletionItems: ()=>{
      const list = Array.isArray(docs) ? docs : [];
      const suggestions = list.map((d)=>({
        label: d.name,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: d.name,
        detail: d.sig,
        documentation: d.desc || "",
      }));
      return { suggestions };
    },
  });
}

function toMonacoMarkers(errors){
  const out = [];
  for(const err of (errors || [])){
    out.push({
      severity: 8,
      message: err.message || "Error",
      startLineNumber: Math.max(1, Number(err.line || 1)),
      startColumn: Math.max(1, Number(err.col || 1)),
      endLineNumber: Math.max(1, Number(err.line || 1)),
      endColumn: Math.max(1, Number(err.col || 1)) + 1,
    });
  }
  return out;
}

export function DzsDevScreen({ engine, onClose }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";
  screen.style.background = "rgba(0,0,0,0.62)";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 95vw)";
  panel.style.height = "min(86vh, 780px)";
  panel.style.gridTemplateRows = "1fr";
  panel.style.display = "grid";
  panel.style.gridTemplateColumns = "320px 1fr";
  panel.style.gap = "12px";
  panel.style.padding = "14px";
  panel.style.boxSizing = "border-box";

  // LEFT: navigation / sections
  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "10px";
  left.style.height = "100%";
  left.style.minHeight = "0";
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
    { value:"servermaster", label:"SERVER MASTER", meta:"matches + queues" },
    { value:"dzs", label:"DSZ HELP", meta:"builtins + syntax" },
    { value:"mapeditor", label:"MAP EDITOR", meta:"build .dzmap layouts" },
    { value:"studio", label:"SCRIPT STUDIO", meta:"library + editor + inject" },
  ];

  let active = "dzs";
  let selectedMatchId = null;
  let studioEditor = null;
  let studioModel = null;
  let studioEditorEl = null;
  const studioState = {
    library: [],
    installed: [],
    problems: [],
    output: [],
    queue: [],
    current: { filename:"untitled.dzs", text:"" },
  };
  const studioRefs = {
    libraryList: null,
    installedList: null,
    problemsList: null,
    outputList: null,
    searchInput: null,
    fileLabel: null,
    statusLine: null,
  };
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
  right.style.height = "100%";
  right.style.minHeight = "0";

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
  body.style.height = "100%";
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

  function getMatchId(){
    return engine?.ctx?.matchSession?.matchId || null;
  }

  function getClientId(){
    return engine?.ctx?.net?.clientId || null;
  }

  function isHost(){
    const hostId = engine?.ctx?.matchSession?.hostPlayerId || null;
    const clientId = getClientId();
    if(!hostId || !clientId) return false;
    return String(hostId) === String(clientId);
  }

  function isLobby(){
    return engine?.ctx?.matchSession?.state === "LOBBY";
  }

  function studioLog(msg){
    studioState.output.push({ msg: String(msg || ""), ts: Date.now() });
    if(studioState.output.length > 200) studioState.output.shift();
    renderStudioOutput();
  }

  function renderStudioOutput(){
    const list = studioRefs.outputList;
    if(!list) return;
    list.innerHTML = "";
    for(const line of studioState.output.slice(-120)){
      const row = document.createElement("div");
      row.className = "dz-help";
      row.textContent = line.msg;
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  function renderStudioProblems(){
    const list = studioRefs.problemsList;
    if(!list) return;
    list.innerHTML = "";
    if(!studioState.problems.length){
      const none = document.createElement("div");
      none.className = "dz-help";
      none.textContent = "No problems.";
      list.appendChild(none);
      return;
    }
    for(const p of studioState.problems){
      const row = document.createElement("div");
      row.className = "dz-help";
      row.textContent = `L${p.line || 1}:C${p.col || 1} ${p.message || "Error"} | ${p.snippet || ""}`.trim();
      list.appendChild(row);
    }
  }

  function updateStudioStatus(){
    if(!studioRefs.statusLine) return;
    const host = isHost();
    const lobby = isLobby();
    const matchId = getMatchId() || "n/a";
    const queued = studioState.queue.length;
    studioRefs.statusLine.textContent = `Match: ${matchId} | Host: ${host ? "yes" : "no"} | Lobby: ${lobby ? "yes" : "no"} | Queued: ${queued}`;
  }

  function setEditorText(text, filename){
    studioState.current.text = String(text || "");
    studioState.current.filename = String(filename || "untitled.dzs");
    if(studioRefs.fileLabel) studioRefs.fileLabel.textContent = studioState.current.filename;
    if(studioModel) studioModel.setValue(studioState.current.text);
  }

  function getEditorText(){
    if(studioModel) return studioModel.getValue();
    return studioState.current.text || "";
  }

  function clearMarkers(){
    if(window.monaco && studioModel){
      window.monaco.editor.setModelMarkers(studioModel, "dzs", []);
    }
  }

  async function validateCurrent(){
    const text = getEditorText();
    studioState.problems = [];
    clearMarkers();
    try{
      const res = await fetch("/api/dzs/validate", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if(!data?.ok){
        studioState.problems = Array.isArray(data?.errors) ? data.errors : [];
        if(window.monaco && studioModel){
          window.monaco.editor.setModelMarkers(studioModel, "dzs", toMonacoMarkers(studioState.problems));
        }
        studioLog("Validation failed.");
        renderStudioProblems();
        return false;
      }
      studioLog("Validation ok.");
      renderStudioProblems();
      return true;
    } catch (err){
      studioLog(`Validation error: ${err?.message || err}`);
      return false;
    }
  }

  async function refreshLibrary(){
    try{
      const res = await fetch("/api/dzs/library");
      const data = await res.json();
      studioState.library = Array.isArray(data?.scripts) ? data.scripts : [];
      renderStudioLibrary();
    } catch (err){
      studioLog(`Library load failed: ${err?.message || err}`);
    }
  }

  async function refreshInstalled(){
    try{
      const matchId = getMatchId() || "global";
      const res = await fetch(`/api/dzs/installed?matchId=${encodeURIComponent(matchId)}`, {
        headers: {
          "x-dzs-client-id": getClientId() || "",
          "x-dzs-match-id": matchId,
        },
      });
      const data = await res.json();
      studioState.installed = Array.isArray(data?.scripts) ? data.scripts : [];
      renderStudioInstalled();
    } catch (err){
      studioLog(`Installed list failed: ${err?.message || err}`);
    }
  }

  function queueAction(action){
    studioState.queue.push(action);
    studioLog(`Queued: ${action.type} (${action.filename || action.scriptId || "script"})`);
    updateStudioStatus();
  }

  async function flushQueue(){
    if(!isLobby()) return;
    if(!isHost()) return;
    if(studioState.queue.length === 0) return;
    studioLog(`Applying ${studioState.queue.length} queued change(s)...`);
    const pending = studioState.queue.slice();
    studioState.queue.length = 0;
    for(const action of pending){
      if(action.type === "inject"){
        await injectScript({ filename: action.filename, text: action.text, skipQueue: true });
      } else if(action.type === "disable"){
        await disableScript(action.scriptId, true);
      } else if(action.type === "unload"){
        await unloadScript(action.scriptId, true);
      }
    }
    updateStudioStatus();
  }

  async function injectScript({ filename, text, skipQueue=false } = {}){
    if(String(filename || "").toLowerCase().endsWith(".dzmap")){
      studioLog("Inject blocked: .dzmap is map data only.");
      return;
    }
    const host = isHost();
    if(!host){
      studioLog("Inject blocked: host-only.");
      return;
    }
    if(!isLobby()){
      if(!skipQueue){
        queueAction({ type:"inject", filename, text });
      } else {
        studioLog("Inject blocked: lobby-only.");
      }
      return;
    }
    const matchId = getMatchId() || "global";
    const clientId = getClientId();
    const res = await fetch("/api/dzs/inject", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "x-dzs-client-id": clientId || "",
        "x-dzs-match-id": matchId,
      },
      body: JSON.stringify({ filename, text, matchId, clientId }),
    });
    const data = await res.json();
    if(!data?.ok){
      studioLog(`Inject failed: ${data?.error || res.status}`);
      return;
    }
    const scriptId = data.scriptId;
    engine?.ctx?.dzsStudio?.installDzs?.({ filename, text, ownerId: clientId, scriptId });
    studioLog(`Injected: ${scriptId}`);
    await refreshInstalled();
  }

  async function disableScript(scriptId, skipQueue=false){
    if(!isHost()){
      studioLog("Disable blocked: host-only.");
      return;
    }
    if(!isLobby()){
      if(!skipQueue){
        queueAction({ type:"disable", scriptId });
      } else {
        studioLog("Disable blocked: lobby-only.");
      }
      return;
    }
    const matchId = getMatchId() || "global";
    const clientId = getClientId();
    const res = await fetch("/api/dzs/disable", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "x-dzs-client-id": clientId || "",
        "x-dzs-match-id": matchId,
      },
      body: JSON.stringify({ scriptId, matchId, clientId }),
    });
    const data = await res.json();
    if(!data?.ok){
      studioLog(`Disable failed: ${data?.error || res.status}`);
      return;
    }
    engine?.ctx?.dzsStudio?.disable?.(scriptId);
    studioLog(`Disabled: ${scriptId}`);
    await refreshInstalled();
  }

  async function unloadScript(scriptId, skipQueue=false){
    if(!isHost()){
      studioLog("Unload blocked: host-only.");
      return;
    }
    if(!isLobby()){
      if(!skipQueue){
        queueAction({ type:"unload", scriptId });
      } else {
        studioLog("Unload blocked: lobby-only.");
      }
      return;
    }
    const matchId = getMatchId() || "global";
    const clientId = getClientId();
    const res = await fetch("/api/dzs/unload", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "x-dzs-client-id": clientId || "",
        "x-dzs-match-id": matchId,
      },
      body: JSON.stringify({ scriptId, matchId, clientId }),
    });
    const data = await res.json();
    if(!data?.ok){
      studioLog(`Unload failed: ${data?.error || res.status}`);
      return;
    }
    engine?.ctx?.dzsStudio?.remove?.(scriptId);
    studioLog(`Unloaded: ${scriptId}`);
    await refreshInstalled();
  }

  // --- section renderers ---
  function renderWeapons(){
    rightTitle.textContent = "WEAPONS";
    rightHint.textContent = "Press ` or ' to toggle. This overlay does not pause the game yet.";
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
    rightHint.textContent = "Press ` or ' to toggle. This overlay does not pause the game yet.";
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
    rightHint.textContent = "Press ` or ' to toggle. This overlay does not pause the game yet.";
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

  function renderServerMaster(){
    rightTitle.textContent = "SERVER MASTER";
    rightHint.textContent = "Server diagnostics (TODO: gate behind login).";
    scroll.innerHTML = "";
    // TODO: gate Server Master behind login before shipping.
    if(!engine?.ctx?.serverMaster){
      engine?.ctx?.net?.sendServerMaster?.();
    }

    const actions = mkCard();
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.justifyContent = "space-between";
    actions.style.gap = "10px";
    const label = document.createElement("div");
    label.className = "dz-help";
    label.textContent = selectedMatchId ? `Selected match: #${selectedMatchId}` : "Live server snapshot.";
    const actionRow = document.createElement("div");
    actionRow.className = "dz-row";
    const refresh = Button({ text:"Refresh", variant:"secondary", onClick: ()=>engine?.ctx?.net?.sendServerMaster?.() });
    const endBtn = Button({ text:"End Selected", variant:"secondary", onClick: ()=>{
      if(selectedMatchId) engine?.ctx?.net?.sendEndMatchAdmin?.(selectedMatchId);
    }});
    endBtn.disabled = !selectedMatchId;
    actionRow.appendChild(refresh);
    actionRow.appendChild(endBtn);
    actions.appendChild(label);
    actions.appendChild(actionRow);
    scroll.appendChild(actions);

    const data = engine?.ctx?.serverMaster || {};
    const queues = data.queues || {};

    const summary = mkCard();
    summary.appendChild(sectionTitle("Queues"));
    const s = document.createElement("div");
    s.className = "dz-help";
    s.textContent = `Solo: ${queues.solo ?? 0} | Zombies: ${queues.zombies ?? 0} | Max Matches: ${data.maxMatches ?? "n/a"}`;
    summary.appendChild(s);
    scroll.appendChild(summary);

    const matchesWrap = mkCard();
    matchesWrap.appendChild(sectionTitle("Matches"));
    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";
    list.style.marginTop = "10px";

    const matches = Array.isArray(data.matches) ? data.matches : [];
    if(!matches.length){
      const empty = document.createElement("div");
      empty.className = "dz-help";
      empty.textContent = "No active matches.";
      list.appendChild(empty);
    } else {
      for(const match of matches){
        const row = mkCard();
        row.style.padding = "8px 10px";
        row.style.background = "rgba(0,0,0,0.3)";
        row.style.cursor = "pointer";
        row.style.borderColor = String(match.matchId) === String(selectedMatchId)
          ? "rgba(255,200,120,0.6)"
          : "rgba(255,255,255,0.08)";
        const line = document.createElement("div");
        line.className = "dz-help";
        const players = `${match.playerCount ?? 0}/${match.maxPlayers ?? "?"}`;
        line.textContent = `#${match.matchId} | ${match.mode} | ${match.status} | ${players} | Host: ${match.hostName || "n/a"} | Uptime: ${match.uptimeSeconds ?? 0}s`;
        row.appendChild(line);
        row.addEventListener("click", ()=>{
          selectedMatchId = String(match.matchId);
          renderServerMaster();
        });
        list.appendChild(row);
      }
    }

    matchesWrap.appendChild(list);
    scroll.appendChild(matchesWrap);
  }

  function renderDzs(){
    rightTitle.textContent = "DSZ HELP";
    rightHint.textContent = "Press ` or ' to toggle. This overlay does not pause the game yet.";
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
    syn.textContent = `on <eventName> {\n  <builtin> arg1 arg2 ...\n  self thread myLoop()\n  level thread controller()\n  wait 0.5\n  waittill "signal"\n  endon "signal"\n  notify "signal" arg1\n}\n\nmyLoop(){\n  // ...\n}\n\n// Example\non zm:build {\n  addFloor 60\n  addWalls 60 4\n  setPlayerSpawn 0 10\n}`;
    syntax.appendChild(syn);
    scroll.appendChild(syntax);

    const template = mkCard();
    template.appendChild(sectionTitle("GSC Template"));
    const tHint = document.createElement("div");
    tHint.className = "dz-help";
    tHint.textContent = "Use this as a starting point for custom modes.";
    const tPre = document.createElement("pre");
    tPre.style.margin="10px 0 0 0";
    tPre.style.padding="10px";
    tPre.style.borderRadius="12px";
    tPre.style.background="rgba(0,0,0,0.35)";
    tPre.style.border="1px solid rgba(255,255,255,0.08)";
    tPre.style.overflow="auto";
    tPre.style.fontFamily="var(--ui-mono)";
    tPre.style.fontSize="12px";
    tPre.textContent = GSC_SAMPLE_TEXT;
    const tActions = document.createElement("div");
    tActions.className = "dz-row";
    tActions.style.marginTop = "10px";
    const dl = Button({ text:"Download .dzs", variant:"secondary", onClick: ()=>{
      const a = document.createElement("a");
      a.href = GSC_SAMPLE_PATH;
      a.download = "gsc_sample.dzs";
      a.click();
    }});
    tActions.appendChild(dl);
    template.appendChild(tHint);
    template.appendChild(tPre);
    template.appendChild(tActions);
    scroll.appendChild(template);

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
      card.style.padding = "0";
      card.style.overflow = "hidden";

      const header = document.createElement("button");
      header.type = "button";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.gap = "10px";
      header.style.width = "100%";
      header.style.padding = "12px";
      header.style.border = "none";
      header.style.background = "transparent";
      header.style.color = "inherit";
      header.style.cursor = "pointer";

      const caret = document.createElement("div");
      caret.style.fontFamily = "var(--ui-mono)";
      caret.style.opacity = "0.8";
      caret.textContent = ">";

      const h = document.createElement("div");
      h.style.display="flex";
      h.style.justifyContent="space-between";
      h.style.gap="12px";
      h.style.flex = "1";
      const name = document.createElement("div");
      name.style.fontWeight="950";
      name.textContent = d.name;
      const sig = document.createElement("div");
      sig.style.fontFamily = "var(--ui-mono)";
      sig.style.opacity = "0.85";
      sig.textContent = d.sig;
      h.appendChild(name);
      h.appendChild(sig);

      header.appendChild(caret);
      header.appendChild(h);

      const panel = document.createElement("div");
      panel.style.display = "none";
      panel.style.padding = "0 12px 12px 36px";
      panel.style.borderTop = "1px solid rgba(255,255,255,0.08)";
      panel.style.background = "rgba(255,255,255,0.02)";

      const desc = document.createElement("div");
      desc.className="dz-help";
      desc.style.marginTop="10px";
      desc.textContent = d.desc;

      const sigText = document.createElement("div");
      sigText.className = "dz-help";
      sigText.style.fontFamily = "var(--ui-mono)";
      sigText.style.opacity = "0.9";
      sigText.style.marginTop = "6px";
      sigText.textContent = `Signature: ${d.sig}`;

      const ex = document.createElement("pre");
      ex.style.margin="10px 0 0 0";
      ex.style.padding="10px";
      ex.style.borderRadius="12px";
      ex.style.background="rgba(0,0,0,0.35)";
      ex.style.border="1px solid rgba(255,255,255,0.08)";
      ex.style.overflow="auto";
      ex.style.fontFamily="var(--ui-mono)";
      ex.style.fontSize="12px";
      const exLine = d.example || `${d.name} ...args`;
      ex.textContent = `on zm:build {\n  ${exLine}\n}`;

      panel.appendChild(desc);
      panel.appendChild(sigText);
      panel.appendChild(ex);

      let open = false;
      const toggle = ()=>{
        open = !open;
        panel.style.display = open ? "block" : "none";
        caret.textContent = open ? "v" : ">";
      };
      header.addEventListener("click", toggle);

      card.appendChild(header);
      card.appendChild(panel);
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

  function renderMapEditor(){
    rightTitle.textContent = "MAP EDITOR";
    rightHint.textContent = "Grid editor for .dzmap files.";
    scroll.innerHTML = "";

    const intro = mkCard();
    const desc = document.createElement("div");
    desc.className = "dz-help";
    desc.textContent = "Build DZ maps with walls, spawns, props, lights, and zones. Export .dzmap or test in-engine.";
    const row = document.createElement("div");
    row.className = "dz-row";
    row.style.marginTop = "10px";
    const openBtn = Button({ text:"Open Map Editor", variant:"secondary", onClick: ()=>{
      const menu = engine.ctx.menu;
      if(!menu) return;
      menu.setOverlay(MapEditorScreen({ engine, onClose: ()=> menu.setOverlay(null) }));
    }});
    row.appendChild(openBtn);
    intro.appendChild(desc);
    intro.appendChild(row);
    scroll.appendChild(intro);
  }

  function renderStudioLibrary(){
    const list = studioRefs.libraryList;
    if(!list) return;
    list.innerHTML = "";
    const q = (studioRefs.searchInput?.value || "").toLowerCase().trim();
    const items = studioState.library.filter((s)=>{
      const hay = `${s.name} ${s.desc} ${(s.tags||[]).join(" ")} ${s.filename}`.toLowerCase();
      return !q || hay.includes(q);
    });
    if(items.length === 0){
      const none = document.createElement("div");
      none.className = "dz-help";
      none.textContent = "No scripts found.";
      list.appendChild(none);
      return;
    }
    for(const s of items){
      const row = mkCard();
      row.style.padding = "8px 10px";
      row.style.cursor = "pointer";
      row.style.background = "rgba(0,0,0,0.3)";
      const name = document.createElement("div");
      name.style.fontWeight = "900";
      name.textContent = s.name || s.filename;
      const meta = document.createElement("div");
      meta.className = "dz-help";
      const tags = Array.isArray(s.tags) && s.tags.length ? ` | ${s.tags.join(", ")}` : "";
      const version = s.version ? `v${s.version}` : "v?";
      meta.textContent = `${version}${tags}`;
      const desc = document.createElement("div");
      desc.className = "dz-help";
      desc.style.opacity = "0.8";
      desc.textContent = s.desc || s.filename;
      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(desc);
      row.addEventListener("click", async ()=>{
        try{
          const res = await fetch(`/api/dzs/library/read?filename=${encodeURIComponent(s.filename)}`);
          const data = await res.json();
          if(!data?.ok){
            studioLog(`Read failed: ${data?.error || res.status}`);
            return;
          }
          setEditorText(data.text || "", s.filename || "library.dzs");
          studioLog(`Loaded: ${s.filename}`);
        } catch (err){
          studioLog(`Read failed: ${err?.message || err}`);
        }
      });
      list.appendChild(row);
    }
  }

  function renderStudioInstalled(){
    const list = studioRefs.installedList;
    if(!list) return;
    list.innerHTML = "";
    if(!studioState.installed.length){
      const none = document.createElement("div");
      none.className = "dz-help";
      none.textContent = "No scripts installed.";
      list.appendChild(none);
      return;
    }
    for(const s of studioState.installed){
      const row = mkCard();
      row.style.padding = "8px 10px";
      row.style.display = "grid";
      row.style.gridTemplateColumns = "70px 1fr auto";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.background = "rgba(0,0,0,0.3)";

      const badge = document.createElement("div");
      badge.style.padding = "4px 6px";
      badge.style.borderRadius = "8px";
      badge.style.textAlign = "center";
      badge.style.fontSize = "11px";
      badge.style.fontWeight = "900";
      badge.style.background = s.enabled ? "rgba(80,200,120,0.2)" : "rgba(255,160,120,0.2)";
      badge.style.border = `1px solid ${s.enabled ? "rgba(80,200,120,0.5)" : "rgba(255,160,120,0.5)"}`;
      badge.textContent = s.enabled ? "ENABLED" : "DISABLED";

      const info = document.createElement("div");
      const name = document.createElement("div");
      name.style.fontWeight = "900";
      name.textContent = s.name || s.filename;
      const meta = document.createElement("div");
      meta.className = "dz-help";
      meta.textContent = `${s.filename || "dzs"} | ${s.scriptId || ""}`;
      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "dz-row";
      const disableBtn = Button({ text:"Disable", variant:"secondary", onClick: ()=>disableScript(s.scriptId) });
      const unloadBtn = Button({ text:"Unload", variant:"secondary", onClick: ()=>unloadScript(s.scriptId) });
      disableBtn.disabled = !isHost();
      unloadBtn.disabled = !isHost();
      actions.appendChild(disableBtn);
      actions.appendChild(unloadBtn);

      row.appendChild(badge);
      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }

  function renderStudio(){
    rightTitle.textContent = "SCRIPT STUDIO";
    rightHint.textContent = "Open the full editor in a new tab.";
    scroll.innerHTML = "";

    const card = mkCard();
    card.appendChild(sectionTitle("Standalone Studio"));
    const info = document.createElement("div");
    info.className = "dz-help";
    info.textContent = "The Script Studio now opens in a dedicated tab with the full editor, library, and install controls.";

    const meta = document.createElement("div");
    meta.className = "dz-help";
    const matchId = engine?.ctx?.matchSession?.matchId || "n/a";
    const hostId = engine?.ctx?.matchSession?.hostPlayerId || "n/a";
    const clientId = engine?.ctx?.net?.clientId || "n/a";
    meta.textContent = `Match: ${matchId} | Host: ${hostId} | You: ${clientId}`;

    const btn = Button({ text:"Open Script Studio", variant:"primary", onClick: ()=>{
      const q = new URLSearchParams();
      if(matchId && matchId !== "n/a") q.set("matchId", matchId);
      if(clientId && clientId !== "n/a") q.set("clientId", clientId);
      const url = `/public/dzs_studio.html${q.toString() ? "?" + q.toString() : ""}`;
      window.open(url, "_blank", "noopener");
    }});

    card.appendChild(info);
    card.appendChild(meta);
    card.appendChild(btn);
    scroll.appendChild(card);
  }

  function renderRight(){
    // Clear body and rebuild per section
    body.innerHTML = "";
    scroll.style.overflow = "auto";

    if(active === "dzs"){
      body.appendChild(dzsControls);
    }

    body.appendChild(scroll);

    if(active === "weapons") renderWeapons();
    else if(active === "entities") renderEntities();
    else if(active === "clients") renderClients();
    else if(active === "servermaster") renderServerMaster();
    else if(active === "mapeditor") renderMapEditor();
    else if(active === "studio") renderStudio();
    else renderDzs();
  }

  search.addEventListener("input", ()=>{ if(active === "dzs") renderRight(); });
  engine?.events?.on?.("server:master", ()=>{ if(active === "servermaster") renderServerMaster(); });
  engine?.events?.on?.("match:lobbyState", ()=>{ updateStudioStatus(); flushQueue(); });
  engine?.events?.on?.("match:found", ()=>{ updateStudioStatus(); flushQueue(); });
  engine?.events?.on?.("match:started", ()=>{ updateStudioStatus(); });
  engine?.events?.on?.("match:ended", ()=>{ updateStudioStatus(); });
  renderRight();

  right.appendChild(rightHeader);
  right.appendChild(body);

  panel.appendChild(left);
  panel.appendChild(right);
  screen.appendChild(panel);
  return screen;
}
