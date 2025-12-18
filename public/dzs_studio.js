const MONACO_CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs";
const MONACO_LANG = "dzs";

const els = {
  matchId: document.getElementById("matchId"),
  clientId: document.getElementById("clientId"),
  statusLine: document.getElementById("statusLine"),
  librarySearch: document.getElementById("librarySearch"),
  libraryList: document.getElementById("libraryList"),
  installedList: document.getElementById("installedList"),
  problems: document.getElementById("problems"),
  output: document.getElementById("output"),
  fileLabel: document.getElementById("fileLabel"),
  validateBtn: document.getElementById("validateBtn"),
  injectBtn: document.getElementById("injectBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  importBtn: document.getElementById("importBtn"),
  fileInput: document.getElementById("fileInput"),
  refreshBtn: document.getElementById("refreshBtn"),
};

const channel = new BroadcastChannel("dzs-studio");
const state = {
  library: [],
  installed: [],
  problems: [],
  output: [],
  queue: [],
  builtins: [],
  matchStatus: null,
  hostPlayerId: null,
  editor: null,
  model: null,
  current: { filename: "untitled.dzs", text: "" },
};

function log(msg){
  state.output.push({ msg: String(msg || ""), ts: Date.now() });
  if(state.output.length > 200) state.output.shift();
  renderOutput();
}

function renderOutput(){
  els.output.innerHTML = "";
  for(const line of state.output.slice(-120)){
    const div = document.createElement("div");
    div.textContent = line.msg;
    els.output.appendChild(div);
  }
  els.output.scrollTop = els.output.scrollHeight;
}

function renderProblems(){
  els.problems.innerHTML = "";
  if(!state.problems.length){
    const div = document.createElement("div");
    div.textContent = "No problems.";
    els.problems.appendChild(div);
    return;
  }
  for(const p of state.problems){
    const div = document.createElement("div");
    div.textContent = `L${p.line || 1}:C${p.col || 1} ${p.message || "Error"} | ${p.snippet || ""}`.trim();
    els.problems.appendChild(div);
  }
}

function isHost(){
  const clientId = String(els.clientId.value || "");
  const hostId = String(state.hostPlayerId || "");
  return clientId && hostId && clientId === hostId;
}

function isLobby(){
  return state.matchStatus === "lobby";
}

function updateStatus(){
  const matchId = els.matchId.value || "n/a";
  const hostId = state.hostPlayerId || "n/a";
  const clientId = els.clientId.value || "n/a";
  const status = state.matchStatus || "n/a";
  const queued = state.queue.length;
  els.statusLine.textContent = `Match: ${matchId} | Host: ${hostId} | You: ${clientId} | Status: ${status} | Queued: ${queued}`;
  els.injectBtn.disabled = !isHost();
}

function setEditorText(text, filename){
  state.current.text = String(text || "");
  state.current.filename = String(filename || "untitled.dzs");
  els.fileLabel.textContent = state.current.filename;
  if(state.model) state.model.setValue(state.current.text);
}

function getEditorText(){
  return state.model ? state.model.getValue() : state.current.text;
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

function toMarkers(errors){
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

async function validate(){
  const text = getEditorText();
  state.problems = [];
  if(window.monaco && state.model){
    window.monaco.editor.setModelMarkers(state.model, "dzs", []);
  }
  try{
    const res = await fetch("/api/dzs/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if(!data?.ok){
      state.problems = Array.isArray(data?.errors) ? data.errors : [];
      if(window.monaco && state.model){
        window.monaco.editor.setModelMarkers(state.model, "dzs", toMarkers(state.problems));
      }
      renderProblems();
      log("Validation failed.");
      return false;
    }
    renderProblems();
    log("Validation ok.");
    return true;
  } catch (err){
    log(`Validation error: ${err?.message || err}`);
    return false;
  }
}

async function fetchLibrary(){
  try{
    const res = await fetch("/api/dzs/library");
    const data = await res.json();
    state.library = Array.isArray(data?.scripts) ? data.scripts : [];
    renderLibrary();
  } catch (err){
    log(`Library load failed: ${err?.message || err}`);
  }
}

async function fetchInstalled(){
  const matchId = els.matchId.value || "global";
  try{
    const res = await fetch(`/api/dzs/installed?matchId=${encodeURIComponent(matchId)}`, {
      headers: {
        "x-dzs-client-id": els.clientId.value || "",
        "x-dzs-match-id": matchId,
      },
    });
    const data = await res.json();
    state.installed = Array.isArray(data?.scripts) ? data.scripts : [];
    renderInstalled();
  } catch (err){
    log(`Installed load failed: ${err?.message || err}`);
  }
}

async function fetchStatus(){
  const matchId = els.matchId.value || "";
  if(!matchId){
    state.matchStatus = null;
    state.hostPlayerId = null;
    updateStatus();
    return;
  }
  try{
    const res = await fetch(`/api/dzs/status?matchId=${encodeURIComponent(matchId)}`);
    const data = await res.json();
    state.matchStatus = data?.status || null;
    state.hostPlayerId = data?.hostPlayerId || null;
  } catch (err){
    log(`Status load failed: ${err?.message || err}`);
  }
  updateStatus();
  await flushQueue();
}

function renderLibrary(){
  els.libraryList.innerHTML = "";
  const q = (els.librarySearch.value || "").toLowerCase().trim();
  const items = state.library.filter((s)=>{
    const hay = `${s.name} ${s.desc} ${(s.tags||[]).join(" ")} ${s.filename}`.toLowerCase();
    return !q || hay.includes(q);
  });
  if(!items.length){
    const div = document.createElement("div");
    div.textContent = "No scripts found.";
    els.libraryList.appendChild(div);
    return;
  }
  for(const s of items){
    const card = document.createElement("div");
    card.className = "library-item";
    const name = document.createElement("h4");
    name.textContent = s.name || s.filename;
    const meta = document.createElement("p");
    const tags = Array.isArray(s.tags) && s.tags.length ? ` | ${s.tags.join(", ")}` : "";
    const version = s.version ? `v${s.version}` : "v?";
    meta.textContent = `${version}${tags}`;
    const desc = document.createElement("p");
    desc.textContent = s.desc || s.filename;
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(desc);
    card.addEventListener("click", async ()=>{
      try{
        const res = await fetch(`/api/dzs/library/read?filename=${encodeURIComponent(s.filename)}`);
        const data = await res.json();
        if(!data?.ok){
          log(`Read failed: ${data?.error || res.status}`);
          return;
        }
        setEditorText(data.text || "", s.filename || "library.dzs");
        log(`Loaded: ${s.filename}`);
      } catch (err){
        log(`Read failed: ${err?.message || err}`);
      }
    });
    els.libraryList.appendChild(card);
  }
}

function renderInstalled(){
  els.installedList.innerHTML = "";
  if(!state.installed.length){
    const div = document.createElement("div");
    div.textContent = "No scripts installed.";
    els.installedList.appendChild(div);
    return;
  }
  for(const s of state.installed){
    const card = document.createElement("div");
    card.className = "library-item";
    const row = document.createElement("div");
    row.className = "row";
    const badge = document.createElement("span");
    badge.className = "badge " + (s.enabled ? "ok" : "off");
    badge.textContent = s.enabled ? "ENABLED" : "DISABLED";
    const name = document.createElement("div");
    name.style.fontWeight = "800";
    name.textContent = s.name || s.filename;
    row.appendChild(badge);
    row.appendChild(name);
    const meta = document.createElement("p");
    meta.textContent = `${s.filename || "dzs"} | ${s.scriptId || ""}`;

    const actions = document.createElement("div");
    actions.className = "row";
    const disableBtn = document.createElement("button");
    disableBtn.className = "btn";
    disableBtn.textContent = "Disable";
    disableBtn.disabled = !isHost();
    disableBtn.addEventListener("click", ()=>disableScript(s.scriptId));
    const unloadBtn = document.createElement("button");
    unloadBtn.className = "btn";
    unloadBtn.textContent = "Unload";
    unloadBtn.disabled = !isHost();
    unloadBtn.addEventListener("click", ()=>unloadScript(s.scriptId));
    actions.appendChild(disableBtn);
    actions.appendChild(unloadBtn);

    card.appendChild(row);
    card.appendChild(meta);
    card.appendChild(actions);
    els.installedList.appendChild(card);
  }
}

function queueAction(action){
  state.queue.push(action);
  log(`Queued: ${action.type} (${action.filename || action.scriptId || "script"})`);
  updateStatus();
}

async function flushQueue(){
  if(!isLobby()) return;
  if(!isHost()) return;
  if(state.queue.length === 0) return;
  const pending = state.queue.slice();
  state.queue.length = 0;
  log(`Applying ${pending.length} queued change(s)...`);
  for(const action of pending){
    if(action.type === "inject"){
      await injectScript(action.filename, action.text, true);
    } else if(action.type === "disable"){
      await disableScript(action.scriptId, true);
    } else if(action.type === "unload"){
      await unloadScript(action.scriptId, true);
    }
  }
  updateStatus();
}

async function injectScript(filename, text, skipQueue=false){
  if(!isHost()){
    log("Inject blocked: host-only.");
    return;
  }
  if(!isLobby()){
    if(!skipQueue) queueAction({ type: "inject", filename, text });
    else log("Inject blocked: lobby-only.");
    return;
  }
  const matchId = els.matchId.value || "global";
  const clientId = els.clientId.value || "";
  const res = await fetch("/api/dzs/inject", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dzs-client-id": clientId,
      "x-dzs-match-id": matchId,
    },
    body: JSON.stringify({ filename, text, matchId, clientId }),
  });
  const data = await res.json();
  if(!data?.ok){
    log(`Inject failed: ${data?.error || res.status}`);
    return;
  }
  channel.postMessage({
    t: "dzs:install",
    scriptId: data.scriptId,
    filename,
    text,
    ownerId: clientId,
  });
  log(`Injected: ${data.scriptId}`);
  await fetchInstalled();
}

async function disableScript(scriptId, skipQueue=false){
  if(!isHost()){
    log("Disable blocked: host-only.");
    return;
  }
  if(!isLobby()){
    if(!skipQueue) queueAction({ type: "disable", scriptId });
    else log("Disable blocked: lobby-only.");
    return;
  }
  const matchId = els.matchId.value || "global";
  const clientId = els.clientId.value || "";
  const res = await fetch("/api/dzs/disable", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dzs-client-id": clientId,
      "x-dzs-match-id": matchId,
    },
    body: JSON.stringify({ scriptId, matchId, clientId }),
  });
  const data = await res.json();
  if(!data?.ok){
    log(`Disable failed: ${data?.error || res.status}`);
    return;
  }
  channel.postMessage({ t: "dzs:disable", scriptId });
  log(`Disabled: ${scriptId}`);
  await fetchInstalled();
}

async function unloadScript(scriptId, skipQueue=false){
  if(!isHost()){
    log("Unload blocked: host-only.");
    return;
  }
  if(!isLobby()){
    if(!skipQueue) queueAction({ type: "unload", scriptId });
    else log("Unload blocked: lobby-only.");
    return;
  }
  const matchId = els.matchId.value || "global";
  const clientId = els.clientId.value || "";
  const res = await fetch("/api/dzs/unload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dzs-client-id": clientId,
      "x-dzs-match-id": matchId,
    },
    body: JSON.stringify({ scriptId, matchId, clientId }),
  });
  const data = await res.json();
  if(!data?.ok){
    log(`Unload failed: ${data?.error || res.status}`);
    return;
  }
  channel.postMessage({ t: "dzs:remove", scriptId });
  log(`Unloaded: ${scriptId}`);
  await fetchInstalled();
}

async function loadBuiltins(){
  try{
    const res = await fetch("/api/dzs/builtins");
    const data = await res.json();
    state.builtins = Array.isArray(data?.builtins) ? data.builtins : [];
  } catch (err){
    log(`Builtins load failed: ${err?.message || err}`);
  }
}

function attachEvents(){
  els.librarySearch.addEventListener("input", renderLibrary);
  els.validateBtn.addEventListener("click", validate);
  els.injectBtn.addEventListener("click", async ()=>{
    const ok = await validate();
    if(!ok) return;
    await injectScript(state.current.filename || "studio.dzs", getEditorText(), false);
  });
  els.downloadBtn.addEventListener("click", ()=>{
    const text = getEditorText();
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.current.filename || "script.dzs";
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 0);
  });
  els.importBtn.addEventListener("click", ()=> els.fileInput.click());
  els.fileInput.addEventListener("change", ()=>{
    const file = els.fileInput.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      setEditorText(String(reader.result || ""), file.name || "imported.dzs");
      log(`Imported: ${file.name || "file"}`);
    };
    reader.readAsText(file);
  });
  els.refreshBtn.addEventListener("click", async ()=>{
    await fetchStatus();
    await fetchLibrary();
    await fetchInstalled();
  });
  els.matchId.addEventListener("change", async ()=>{
    await fetchStatus();
    await fetchInstalled();
  });
  els.clientId.addEventListener("change", updateStatus);
}

async function boot(){
  const params = new URLSearchParams(location.search);
  els.matchId.value = params.get("matchId") || "";
  els.clientId.value = params.get("clientId") || "";

  attachEvents();
  await loadBuiltins();

  await loadMonaco();
  registerDzsLanguage(window.monaco, state.builtins);
  state.model = window.monaco.editor.createModel(state.current.text, MONACO_LANG);
  state.model.onDidChangeContent(()=>{ state.current.text = state.model.getValue(); });
  state.editor = window.monaco.editor.create(document.getElementById("editor"), {
    model: state.model,
    theme: "vs-dark",
    minimap: { enabled: false },
    fontSize: 13,
    wordWrap: "on",
    automaticLayout: true,
  });

  await fetchStatus();
  await fetchLibrary();
  await fetchInstalled();
  renderProblems();
  renderOutput();
}

boot();
