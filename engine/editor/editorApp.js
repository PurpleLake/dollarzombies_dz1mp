import { createToolbar } from "./ui/toolbar.js";
import { createHierarchyPanel } from "./ui/hierarchyPanel.js";
import { createInspector } from "./ui/inspectorPanel.js";
import { createAssetsPanel } from "./ui/assetsPanel.js";
import { createConsole } from "./ui/consolePanel.js";
import { createViewport } from "./ui/viewportPanel.js";
import { DEFAULT_PREFABS, createEmptyScene } from "./io/dzsSchema.js";
import { validateScene } from "./io/dzsValidator.js";
import { loadDzsFile, saveDzs } from "./io/dzsFileIO.js";
import { loadAutosave, saveAutosave } from "./io/autosave.js";
import { UndoRedo } from "./tools/undoRedo.js";

const toolbarEl = document.getElementById("toolbar");
const hierarchyEl = document.getElementById("hierarchy");
const inspectorEl = document.getElementById("inspector");
const assetsEl = document.getElementById("assets");
const viewportEl = document.getElementById("viewport");
const consoleEl = document.getElementById("console");

const consolePanel = createConsole(consoleEl);

const undo = new UndoRedo();
let state = loadAutosave() || createEmptyScene("sample");
let selection = new Set(state.meta?.selection || []);
let snapSize = 0.5;

const viewport = createViewport(viewportEl, {
  getState: ()=> state,
  getSnap: ()=> snapSize,
  onSelect: (obj)=> select(obj ? obj.id : null),
  onTransform: (obj)=> { pushUndo(); dirty(); inspector.render(obj); },
  onCreate: (prefab, point)=> {
    const obj = createObject(prefab.key, prefab.type, point);
    select(obj.id);
  },
});

const toolbar = createToolbar(toolbarEl, {
  new: ()=>{ state = createEmptyScene("untitled"); selection.clear(); sync(); log("info","New scene"); },
  open: ()=> openFile(),
  save: ()=> saveCurrent(),
  saveAs: ()=> saveCurrent(true),
  compile: ()=> log("info","Use npm run compile:map -- --in maps/<name>.dzs --out public/maps/<name>.dzmap"),
  drop: ()=> viewport.dropSelection(),
  setMode: (m)=> viewport.setMode(m),
  setSnap: (s)=> { snapSize = Number.isFinite(s)?s:0; },
});

const hierarchy = createHierarchyPanel(hierarchyEl, {
  onSelect: (obj)=> select(obj?.id || null),
  onDelete: ()=> deleteSelection(),
  onAdd: ()=> addDefault(),
});

const inspector = createInspector(inspectorEl, { onChange: ()=> { pushUndo(); dirty(); viewport.syncAll(); } });
const assets = createAssetsPanel(assetsEl, DEFAULT_PREFABS, { onAdd: (prefab)=> {
  const obj = createObject(prefab.key, prefab.type, { x:0,y:0,z:0 });
  select(obj.id);
} });

function log(type, msg){ consolePanel.log(type, msg); }

function dirty(){ saveAutosave(state); viewport.syncAll(); hierarchy.render(state.objects, selection); inspector.render(getSelected()); validate(); }

function sync(){ viewport.syncAll(); hierarchy.render(state.objects, selection); inspector.render(getSelected()); validate(); }

function createObject(prefabKey, type, pos){
  const id = `${prefabKey}_${Math.floor(Math.random()*100000)}`;
  const obj = {
    id,
    name: id,
    type: type || "prop",
    prefab: prefabKey,
    position: { x: pos.x||0, y: pos.y||0, z: pos.z||0 },
    rotation: { x:0,y:0,z:0 },
    scale: { x:1,y:1,z:1 },
    collider: { enabled:true, shape:"box", size:{x:1,y:1,z:1} },
    tags: [],
    custom: {},
  };
  state.objects.push(obj);
  pushUndo();
  dirty();
  return obj;
}

function getSelected(){
  const id = Array.from(selection)[0];
  return state.objects.find(o=>o.id===id) || null;
}

function select(id){
  selection.clear();
  if(id) selection.add(id);
  state.meta.selection = Array.from(selection);
  inspector.render(getSelected());
  viewport.updateSelection(getSelected());
  hierarchy.render(state.objects, selection);
}

function deleteSelection(){
  const ids = new Set(selection);
  state.objects = state.objects.filter(o=> !ids.has(o.id));
  selection.clear();
  pushUndo();
  dirty();
}

function addDefault(){
  const prefab = DEFAULT_PREFABS[0];
  const obj = createObject(prefab.key, prefab.type, {x:0,y:0,z:0});
  select(obj.id);
}

function pushUndo(){ undo.push(state); }

window.addEventListener("keydown", (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){
    const prev = undo.undo(); if(prev){ state = prev; selection = new Set(state.meta?.selection||[]); sync(); }
  }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="y"){
    const next = undo.redo(); if(next){ state = next; selection = new Set(state.meta?.selection||[]); sync(); }
  }
});

function openFile(){
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".dzs";
  input.addEventListener("change", async ()=>{
    if(!input.files?.length) return;
    const data = await loadDzsFile(input.files[0]);
    state = data; selection = new Set(state.meta?.selection||[]); sync(); log("info","Loaded "+input.files[0].name);
  });
  input.click();
}

function saveCurrent(forceName){
  const result = validateScene(state);
  if(!result.ok){
    log("error", `Validation failed: ${result.errors.map(e=>e.msg).join(", ")}`);
    return;
  }
  const name = forceName? prompt("Filename", `${state.name||"map"}.dzs`) : `${state.name||"map"}.dzs`;
  saveDzs(state, name);
  log("info", `Saved ${name}`);
}

function validate(){
  const result = validateScene(state);
  if(result.ok){ log("info","Scene valid"); }
  else { log("warn", `Issues: ${result.errors.map(e=>e.msg).join("; ")}`); }
}

// initial
pushUndo();
sync();
setInterval(()=> saveAutosave(state), 30000);
