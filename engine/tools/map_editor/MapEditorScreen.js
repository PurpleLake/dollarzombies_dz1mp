import { Button } from "/engine/core/ui/scripts/widgets/Button.js";
import { ListBox } from "/engine/core/ui/scripts/widgets/ListBox.js";
import { ECS } from "/engine/core/scripts/ECS.js";
import { ZmGame } from "/engine/game/zm/scripts/ZmGame.js";
import { MapCompiler, dzmapToDzs } from "./MapCompiler.js";
import { MapEditorCanvas } from "./MapEditorCanvas.js";
import { MapEditorPreview3D } from "./MapEditorPreview3D.js";
import { UndoStack } from "./UndoStack.js";
import { validateDzmap } from "./validateDzmap.js";

const WORKSPACE_KEY = "dzmap_workspace_v1";

function ensureCss(){
  if(document.getElementById("dz-map-editor-css")) return;
  const link = document.createElement("link");
  link.id = "dz-map-editor-css";
  link.rel = "stylesheet";
  link.href = "/engine/tools/map_editor/mapEditor.css";
  document.head.appendChild(link);
}

function clone(obj){
  return JSON.parse(JSON.stringify(obj));
}

function defaultMapData(){
  return {
    format: "dzmap",
    version: 1,
    meta: {
      name: "untitled",
      modes: ["ZM"],
      author: "Host",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    bounds: { minX: -25, minY: -25, maxX: 25, maxY: 25 },
    floor: { color: "#0c1222", roughness: 0.95, metalness: 0.0 },
    walls: [],
    props: [],
    spawns: { player: [], zombie: [] },
    lights: [],
    zones: [],
  };
}

function normalizeMapData(data){
  const next = clone(data || {});
  next.format = "dzmap";
  next.version = Number(next.version || 1);
  next.meta = next.meta || {};
  next.meta.name = next.meta.name || "untitled";
  next.meta.modes = Array.isArray(next.meta.modes) ? next.meta.modes : ["ZM"];
  next.meta.author = next.meta.author || "Host";
  next.meta.createdAt = next.meta.createdAt || Date.now();
  next.meta.updatedAt = next.meta.updatedAt || next.meta.createdAt || Date.now();
  next.bounds = next.bounds || { minX:-25, minY:-25, maxX:25, maxY:25 };
  next.floor = next.floor || {};
  next.floor.color = next.floor.color || "#0c1222";
  next.floor.roughness = Number.isFinite(Number(next.floor.roughness)) ? Number(next.floor.roughness) : 0.95;
  next.floor.metalness = Number.isFinite(Number(next.floor.metalness)) ? Number(next.floor.metalness) : 0.0;
  next.walls = Array.isArray(next.walls) ? next.walls : [];
  next.props = Array.isArray(next.props) ? next.props : [];
  next.spawns = next.spawns || { player: [], zombie: [] };
  next.spawns.player = Array.isArray(next.spawns.player) ? next.spawns.player : [];
  next.spawns.zombie = Array.isArray(next.spawns.zombie) ? next.spawns.zombie : [];
  next.lights = Array.isArray(next.lights) ? next.lights : [];
  next.zones = Array.isArray(next.zones) ? next.zones : [];
  return next;
}

function safeParse(text){
  try { return JSON.parse(text); } catch { return null; }
}

function makeField({ label, value, onChange, type="text" }){
  const wrap = document.createElement("div");
  wrap.className = "dzme-field";
  const lab = document.createElement("div");
  lab.className = "dzme-label";
  lab.textContent = label;
  const input = document.createElement("input");
  input.className = "dzme-input";
  input.type = type;
  input.value = value == null ? "" : String(value);
  input.addEventListener("input", ()=> onChange?.(input.value));
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}

function makeSelect({ label, value, options, onChange }){
  const wrap = document.createElement("div");
  wrap.className = "dzme-field";
  const lab = document.createElement("div");
  lab.className = "dzme-label";
  lab.textContent = label;
  const sel = document.createElement("select");
  sel.className = "dzme-input";
  for(const opt of options){
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if(String(opt.value) === String(value)) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", ()=> onChange?.(sel.value));
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return wrap;
}

function makeCheckbox({ label, checked=false, onChange }){
  const wrap = document.createElement("label");
  wrap.className = "dzme-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  const text = document.createElement("span");
  text.textContent = label;
  input.addEventListener("change", ()=> onChange?.(input.checked));
  wrap.appendChild(input);
  wrap.appendChild(text);
  return wrap;
}

function makeCard(title){
  const wrap = document.createElement("div");
  wrap.className = "dzme-card";
  const header = document.createElement("div");
  header.className = "dzme-card-header";
  const t = document.createElement("div");
  t.className = "dzme-card-title";
  t.textContent = title;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "dzme-card-toggle";
  toggle.textContent = "Hide";
  header.appendChild(t);
  header.appendChild(toggle);
  const body = document.createElement("div");
  body.className = "dzme-card-body";
  wrap.appendChild(header);
  wrap.appendChild(body);
  let open = true;
  toggle.addEventListener("click", ()=>{
    open = !open;
    wrap.classList.toggle("is-collapsed", !open);
    toggle.textContent = open ? "Hide" : "Show";
  });
  return { wrap, body };
}

function getListForType(data, type){
  if(type === "wall") return data.walls;
  if(type === "prop") return data.props;
  if(type === "player") return data.spawns.player;
  if(type === "zombie") return data.spawns.zombie;
  if(type === "light") return data.lights;
  return data.zones;
}

function formatNumber(n, digits=2){
  if(!Number.isFinite(Number(n))) return "0";
  return Number(n).toFixed(digits);
}

export function MapEditorScreen({ engine, onClose }){
  ensureCss();
  const menu = engine?.ctx?.menu;
  const compiler = new MapCompiler(engine);
  const undo = new UndoStack(120);
  let mapData = defaultMapData();
  let selected = null;
  let tool = "select";
  let snap = true;
  let gridSize = 1;
  let testing = false;
  let testSession = null;
  let viewMode = "split";
  let assets = [];
  let selectedAsset = null;
  let assetMode = engine?.ctx?.session?.mode || "zm";
  let clipboard = null;
  let cursorPos = { x: 0, y: 0 };
  let listFilter = "";

  const stored = localStorage.getItem(WORKSPACE_KEY);
  const parsed = stored ? safeParse(stored) : null;
  if(parsed?.format === "dzmap"){
    mapData = normalizeMapData(parsed);
  }

  const screen = document.createElement("div");
  screen.className = "dz-screen dz-map-editor";

  const panel = document.createElement("div");
  panel.className = "dzme-panel";

  const header = document.createElement("div");
  header.className = "dzme-header";
  const title = document.createElement("div");
  title.className = "dzme-title";
  title.textContent = "MAP EDITOR";
  const headerActions = document.createElement("div");
  headerActions.className = "dzme-header-actions";
  const closeBtn = Button({ text:"Close", variant:"secondary", onClick: ()=> handleClose() });
  headerActions.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(headerActions);

  const body = document.createElement("div");
  body.className = "dzme-body";

  const left = document.createElement("div");
  left.className = "dzme-left";

  const center = document.createElement("div");
  center.className = "dzme-center";

  const right = document.createElement("div");
  right.className = "dzme-right";

  const footer = document.createElement("div");
  footer.className = "dzme-footer";

  const viewHeader = document.createElement("div");
  viewHeader.className = "dzme-view-header";
  const viewTitle = document.createElement("div");
  viewTitle.className = "dzme-view-title";
  viewTitle.textContent = "Views";
  const viewTabs = document.createElement("div");
  viewTabs.className = "dzme-view-tabs";
  const viewModes = [
    { value:"2d", label:"2D" },
    { value:"3d", label:"3D" },
    { value:"split", label:"Split" },
  ];
  const viewButtons = [];
  for(const v of viewModes){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dzme-view-tab";
    btn.textContent = v.label;
    btn.dataset.mode = v.value;
    btn.addEventListener("click", ()=> setViewMode(v.value));
    viewButtons.push(btn);
    viewTabs.appendChild(btn);
  }
  viewHeader.appendChild(viewTitle);
  viewHeader.appendChild(viewTabs);

  const viewActions = document.createElement("div");
  viewActions.className = "dzme-view-tabs";
  const zoomInBtn = document.createElement("button");
  zoomInBtn.type = "button";
  zoomInBtn.className = "dzme-view-tab";
  zoomInBtn.textContent = "+";
  zoomInBtn.title = "Zoom in";
  zoomInBtn.addEventListener("click", ()=> canvasView.zoomBy(1.15));
  const zoomOutBtn = document.createElement("button");
  zoomOutBtn.type = "button";
  zoomOutBtn.className = "dzme-view-tab";
  zoomOutBtn.textContent = "-";
  zoomOutBtn.title = "Zoom out";
  zoomOutBtn.addEventListener("click", ()=> canvasView.zoomBy(0.9));
  const fitBtn = document.createElement("button");
  fitBtn.type = "button";
  fitBtn.className = "dzme-view-tab";
  fitBtn.textContent = "Fit";
  fitBtn.addEventListener("click", ()=> canvasView.focusBounds(mapData.bounds));
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "dzme-view-tab";
  resetBtn.textContent = "Reset";
  resetBtn.addEventListener("click", ()=> canvasView.resetView());
  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.type = "button";
  fullscreenBtn.className = "dzme-view-tab";
  fullscreenBtn.textContent = "Fullscreen 3D";
  fullscreenBtn.addEventListener("click", ()=>{
    screen.classList.toggle("dzme-fullscreen");
    setViewMode("3d");
    setTimeout(()=> preview3d.resize(), 50);
  });
  viewActions.appendChild(zoomInBtn);
  viewActions.appendChild(zoomOutBtn);
  viewActions.appendChild(fitBtn);
  viewActions.appendChild(resetBtn);
  viewActions.appendChild(fullscreenBtn);
  viewHeader.appendChild(viewActions);

  const viewBody = document.createElement("div");
  viewBody.className = "dzme-view-body";

  function commitChange(mutator, { pushUndo=false } = {}){
    if(pushUndo) undo.push(mapData);
    const next = clone(mapData);
    mutator?.(next);
    next.meta = next.meta || {};
    next.meta.updatedAt = Date.now();
    mapData = next;
    refreshAll();
  }

  const view2d = document.createElement("div");
  view2d.className = "dzme-view dzme-view-2d";
  const canvas = document.createElement("canvas");
  canvas.className = "dzme-canvas";
  view2d.appendChild(canvas);

  const view3d = document.createElement("div");
  view3d.className = "dzme-view dzme-view-3d";
  const previewHost = document.createElement("div");
  previewHost.className = "dzme-preview-3d";
  view3d.appendChild(previewHost);

  viewBody.appendChild(view2d);
  viewBody.appendChild(view3d);
  center.appendChild(viewHeader);
  center.appendChild(viewBody);

  const canvasView = new MapEditorCanvas({
    canvas,
    getState: ()=>({ mapData, selected }),
    onMutate: (mutator, { commit=false } = {})=>{
      if(commit) undo.push(mapData);
      const next = clone(mapData);
      mutator(next);
      next.meta = next.meta || {};
      next.meta.updatedAt = Date.now();
      mapData = next;
      refreshAll();
    },
    onSelect: (sel)=>{
      selected = sel;
      refreshInspector();
      refreshList();
      refreshStatus();
      canvasView.render();
      preview3d.update();
    },
    onHover: (pos)=>{
      cursorPos = pos || { x: 0, y: 0 };
      refreshStatus();
    },
  });

  const preview3d = new MapEditorPreview3D({
    container: previewHost,
    getState: ()=>({ mapData, selected }),
    getTool: ()=> tool,
    getSelectedAsset: ()=> selectedAsset,
    onPlace: (payload)=>{
      if(!payload) return;
      const { x, y, z, asset, tool } = payload;
      if(tool === "wall"){
        const item = {
          id: `w${Date.now()}`,
          x: Number(x || 0),
          y: Number(y || 0),
          w: 2,
          h: 2,
          rot: 0,
          height: 2.6,
        };
        onMutateWall(item);
        return;
      }
      if(tool === "zone"){
        const item = {
          id: `z${Date.now()}`,
          x: Number(x || 0),
          y: Number(y || 0),
          w: 4,
          h: 4,
          name: "",
        };
        commitChange((draft)=>{ draft.zones.push(item); }, { pushUndo:true });
        selected = { type:"zone", id:item.id };
        refreshAll();
        return;
      }
      if(tool === "player"){
        const item = {
          id: `p${Date.now()}`,
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
          rot: 0,
          team: "A",
        };
        commitChange((draft)=>{ draft.spawns.player.push(item); }, { pushUndo:true });
        selected = { type:"player", id:item.id };
        refreshAll();
        return;
      }
      if(tool === "zombie"){
        const item = {
          id: `z${Date.now()}`,
          x: Number(x || 0),
          y: Number(y || 0),
          z: Number(z || 0),
        };
        commitChange((draft)=>{ draft.spawns.zombie.push(item); }, { pushUndo:true });
        selected = { type:"zombie", id:item.id };
        refreshAll();
        return;
      }
      if(tool === "light"){
        const item = {
          id: `l${Date.now()}`,
          kind: "point",
          x: Number(x || 0),
          y: Number(y || 0),
          z: 4,
          intensity: 1,
          range: 40,
          color: "#ffffff",
        };
        commitChange((draft)=>{ draft.lights.push(item); }, { pushUndo:true });
        selected = { type:"light", id:item.id };
        refreshAll();
        return;
      }
      if(tool === "asset" && !asset) return;
      const base = {
        id: `p${Date.now()}`,
        x: Number(x || 0),
        y: Number(y || 0),
        z: Number(z || 0),
        rot: 0,
      };
      if(tool === "prop" || !asset){
        onMutateProp({ ...base, type:"crate", scale: 1 });
        return;
      }
      const item = {
        ...base,
        type: asset.id,
        assetId: asset.id,
        kind: asset.kind,
        model: asset.model,
        material: asset.material,
        collision: asset.collision,
        collider: asset.collider,
        sx: asset.sx,
        sy: asset.sy,
        sz: asset.sz,
        r: asset.r,
        rTop: asset.rTop,
        rBottom: asset.rBottom,
        h: asset.h,
        scale: Number(asset.scale || 1),
      };
      onMutateProp(item);
    },
    onSelect: (sel)=>{
      selected = sel;
      refreshInspector();
      refreshList();
      canvasView.render();
      refreshStatus();
    },
    onMove: (sel, pos, { commit=false } = {})=>{
      if(!sel) return;
      applyInspectorChange((draft, it)=>{
        it.x = Number(pos.x || 0);
        it.y = Number(pos.y || 0);
      }, { pushUndo: commit });
    },
  });

  const tools = [
    { value:"select", label:"Select" },
    { value:"wall", label:"Wall" },
    { value:"prop", label:"Prop" },
    { value:"asset", label:"Asset" },
    { value:"player", label:"Player Spawn" },
    { value:"zombie", label:"Zombie Spawn" },
    { value:"light", label:"Light" },
    { value:"zone", label:"Zone/Trigger" },
  ];

  function setTool(next){
    tool = next;
    canvasView.setTool(next);
    toolButtons.forEach(btn=>{
      btn.classList.toggle("is-active", btn.dataset.tool === next);
    });
  }

  function setViewMode(next){
    viewMode = next;
    viewBody.classList.remove("mode-2d", "mode-3d", "mode-split");
    viewBody.classList.add(`mode-${viewMode}`);
    viewButtons.forEach(btn=>{
      btn.classList.toggle("is-active", btn.dataset.mode === viewMode);
    });
    canvasView.resize();
    preview3d.resize();
  }

  const toolCard = makeCard("Tools");
  const toolWrap = toolCard.wrap;
  const toolButtons = [];
  const toolList = document.createElement("div");
  toolList.className = "dzme-tool-list";
  for(const t of tools){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dzme-tool";
    btn.dataset.tool = t.value;
    btn.textContent = t.label;
    btn.addEventListener("click", ()=> setTool(t.value));
    toolButtons.push(btn);
    toolList.appendChild(btn);
  }
  toolCard.body.appendChild(toolList);

  const snapToggle = document.createElement("label");
  snapToggle.className = "dzme-toggle";
  const snapInput = document.createElement("input");
  snapInput.type = "checkbox";
  snapInput.checked = snap;
  const snapLabel = document.createElement("span");
  snapLabel.textContent = "Snap to grid";
  snapInput.addEventListener("change", ()=>{
    snap = snapInput.checked;
    canvasView.setSnap(snap);
  });
  snapToggle.appendChild(snapInput);
  snapToggle.appendChild(snapLabel);
  toolCard.body.appendChild(snapToggle);

  const gridField = makeSelect({
    label:"Grid Size",
    value:gridSize,
    options:[
      { value:0.25, label:"0.25m" },
      { value:0.5, label:"0.5m" },
      { value:1, label:"1m" },
      { value:2, label:"2m" },
      { value:4, label:"4m" },
    ],
    onChange:(v)=>{
      gridSize = Number(v || 1);
      canvasView.setGrid(gridSize);
    },
  });
  toolCard.body.appendChild(gridField);

  const listCard = makeCard("Elements");
  const listWrap = listCard.wrap;
  const listSearch = document.createElement("input");
  listSearch.className = "dzme-input";
  listSearch.placeholder = "Filter elements";
  listSearch.addEventListener("input", ()=>{
    listFilter = listSearch.value || "";
    refreshList();
  });
  const listBody = document.createElement("div");
  listBody.className = "dzme-list";
  listCard.body.appendChild(listSearch);
  listCard.body.appendChild(listBody);

  const templateCard = makeCard("Templates");
  const templateWrap = templateCard.wrap;
  const templateList = document.createElement("div");
  templateList.className = "dzme-template-list";
  const templates = [
    { label:"MP Base", path:"/engine/tools/map_editor/templates/mp_base.dzmap" },
    { label:"MP Scarab Range", path:"/engine/tools/map_editor/templates/mp_scarab_range.dzmap" },
    { label:"ZM Base", path:"/engine/tools/map_editor/templates/zm_base.dzmap" },
  ];
  for(const t of templates){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dzme-template";
    btn.textContent = t.label;
    btn.addEventListener("click", async ()=>{
      const res = await fetch(t.path, { cache:"no-store" });
      if(!res.ok) return engine.events.emit("dev:toast", { msg:"Template load failed" });
      const data = await res.json();
      undo.push(mapData);
      mapData = normalizeMapData(data);
      selected = null;
      refreshAll();
    });
    templateList.appendChild(btn);
  }
  templateCard.body.appendChild(templateList);

  const assetCard = makeCard("Asset Library");
  const assetWrap = assetCard.wrap;
  const assetSearch = document.createElement("input");
  assetSearch.className = "dzme-input";
  assetSearch.placeholder = "Search assets";
  const assetList = document.createElement("div");
  assetList.className = "dzme-list";
  assetSearch.addEventListener("input", ()=> renderAssetList());
  assetCard.body.appendChild(assetSearch);
  assetCard.body.appendChild(assetList);

  left.appendChild(toolWrap);
  left.appendChild(listWrap);
  left.appendChild(assetWrap);
  left.appendChild(templateWrap);

  const settingsCard = makeCard("Map Settings");
  const settingsWrap = settingsCard.wrap;
  const settingsBody = document.createElement("div");
  settingsBody.className = "dzme-settings";
  settingsCard.body.appendChild(settingsBody);

  const nameField = makeField({
    label:"Map Name",
    value: mapData.meta?.name || "untitled",
    onChange:(v)=> commitChange((draft)=>{ draft.meta.name = String(v || "untitled"); }),
  });
  const nameInput = nameField.querySelector("input");

  const authorField = makeField({
    label:"Author",
    value: mapData.meta?.author || "Host",
    onChange:(v)=> commitChange((draft)=>{ draft.meta.author = String(v || "Host"); }),
  });
  const authorInput = authorField.querySelector("input");

  const modeWrap = document.createElement("div");
  modeWrap.className = "dzme-field";
  const modeLabel = document.createElement("div");
  modeLabel.className = "dzme-label";
  modeLabel.textContent = "Modes";
  const modeList = document.createElement("div");
  modeList.className = "dzme-mode-list";
  const modeZm = document.createElement("label");
  modeZm.className = "dzme-toggle";
  const modeZmInput = document.createElement("input");
  modeZmInput.type = "checkbox";
  const modeZmText = document.createElement("span");
  modeZmText.textContent = "ZM";
  modeZm.appendChild(modeZmInput);
  modeZm.appendChild(modeZmText);
  const modeMp = document.createElement("label");
  modeMp.className = "dzme-toggle";
  const modeMpInput = document.createElement("input");
  modeMpInput.type = "checkbox";
  const modeMpText = document.createElement("span");
  modeMpText.textContent = "MP";
  modeMp.appendChild(modeMpInput);
  modeMp.appendChild(modeMpText);
  modeList.appendChild(modeZm);
  modeList.appendChild(modeMp);
  modeWrap.appendChild(modeLabel);
  modeWrap.appendChild(modeList);
  const updateModes = ()=>{
    const modes = [];
    if(modeZmInput.checked) modes.push("ZM");
    if(modeMpInput.checked) modes.push("MP");
    if(modes.length === 0){
      modes.push("ZM");
      modeZmInput.checked = true;
    }
    commitChange((draft)=>{ draft.meta.modes = modes; });
  };
  modeZmInput.addEventListener("change", updateModes);
  modeMpInput.addEventListener("change", updateModes);

  const boundsHeader = document.createElement("div");
  boundsHeader.className = "dzme-label";
  boundsHeader.textContent = "Bounds";
  const boundsGrid = document.createElement("div");
  boundsGrid.className = "dzme-grid";
  const minXField = makeField({
    label:"Min X",
    value: mapData.bounds?.minX ?? -25,
    type:"number",
    onChange:(v)=> commitChange((draft)=>{ draft.bounds.minX = Number(v || 0); }),
  });
  const minXInput = minXField.querySelector("input");
  const minYField = makeField({
    label:"Min Y",
    value: mapData.bounds?.minY ?? -25,
    type:"number",
    onChange:(v)=> commitChange((draft)=>{ draft.bounds.minY = Number(v || 0); }),
  });
  const minYInput = minYField.querySelector("input");
  const maxXField = makeField({
    label:"Max X",
    value: mapData.bounds?.maxX ?? 25,
    type:"number",
    onChange:(v)=> commitChange((draft)=>{ draft.bounds.maxX = Number(v || 0); }),
  });
  const maxXInput = maxXField.querySelector("input");
  const maxYField = makeField({
    label:"Max Y",
    value: mapData.bounds?.maxY ?? 25,
    type:"number",
    onChange:(v)=> commitChange((draft)=>{ draft.bounds.maxY = Number(v || 0); }),
  });
  const maxYInput = maxYField.querySelector("input");
  boundsGrid.appendChild(minXField);
  boundsGrid.appendChild(minYField);
  boundsGrid.appendChild(maxXField);
  boundsGrid.appendChild(maxYField);

  const boundsActions = document.createElement("div");
  boundsActions.className = "dzme-row";
  const fitBoundsBtn = document.createElement("button");
  fitBoundsBtn.type = "button";
  fitBoundsBtn.className = "dzme-btn";
  fitBoundsBtn.textContent = "Fit View";
  fitBoundsBtn.addEventListener("click", ()=> canvasView.focusBounds(mapData.bounds));
  const resetBoundsBtn = document.createElement("button");
  resetBoundsBtn.type = "button";
  resetBoundsBtn.className = "dzme-btn";
  resetBoundsBtn.textContent = "Reset Bounds";
  resetBoundsBtn.addEventListener("click", ()=> commitChange((draft)=>{
    draft.bounds = { minX: -25, minY: -25, maxX: 25, maxY: 25 };
  }, { pushUndo:true }));
  boundsActions.appendChild(fitBoundsBtn);
  boundsActions.appendChild(resetBoundsBtn);

  const metaStamp = document.createElement("div");
  metaStamp.className = "dzme-meta";

  const groundHeader = document.createElement("div");
  groundHeader.className = "dzme-label";
  groundHeader.textContent = "Ground";

  const groundPresets = [
    { value:"default", label:"Default", color:"#0c1222" },
    { value:"dirt", label:"Dirt", color:"#3b2a1b" },
    { value:"grass", label:"Grass", color:"#2c4b2f" },
    { value:"gravel", label:"Gravel", color:"#3a3f45" },
    { value:"concrete", label:"Concrete", color:"#53575c" },
    { value:"custom", label:"Custom", color:null },
  ];

  const groundSelect = makeSelect({
    label:"Ground Preset",
    value:"default",
    options: groundPresets.map(p=>({ value:p.value, label:p.label })),
    onChange:(v)=>{
      const preset = groundPresets.find(p=>p.value === v) || groundPresets[0];
      if(preset.color){
        commitChange((draft)=>{
          draft.floor = draft.floor || {};
          draft.floor.color = preset.color;
        });
        syncInput(groundColorInput, preset.color);
      }
    },
  });
  const groundSelectInput = groundSelect.querySelector("select");
  const groundColorField = makeField({
    label:"Ground Color",
    value: mapData.floor?.color || "#0c1222",
    type:"color",
    onChange:(v)=> commitChange((draft)=>{
      draft.floor = draft.floor || {};
      draft.floor.color = String(v || "#0c1222");
    }),
  });
  const groundColorInput = groundColorField.querySelector("input");

  settingsBody.appendChild(nameField);
  settingsBody.appendChild(authorField);
  settingsBody.appendChild(modeWrap);
  settingsBody.appendChild(boundsHeader);
  settingsBody.appendChild(boundsGrid);
  settingsBody.appendChild(boundsActions);
  settingsBody.appendChild(groundHeader);
  settingsBody.appendChild(groundSelect);
  settingsBody.appendChild(groundColorField);
  settingsBody.appendChild(metaStamp);

  const inspectorCard = makeCard("Inspector");
  const inspectorWrap = inspectorCard.wrap;
  const inspectorBody = document.createElement("div");
  inspectorBody.className = "dzme-inspector";
  inspectorCard.body.appendChild(inspectorBody);

  const validationCard = makeCard("Validation");
  const validationWrap = validationCard.wrap;
  const validationBody = document.createElement("div");
  validationBody.className = "dzme-validation";
  validationCard.body.appendChild(validationBody);

  const shortcutsCard = makeCard("Shortcuts");
  const shortcutsWrap = shortcutsCard.wrap;
  const shortcutsBody = document.createElement("div");
  shortcutsBody.className = "dzme-shortcuts";
  const shortcuts = [
    ["Select", "1"],
    ["Wall", "2"],
    ["Prop", "3"],
    ["Asset", "4"],
    ["Player Spawn", "5"],
    ["Zombie Spawn", "6"],
    ["Light", "7"],
    ["Zone", "8"],
    ["Rotate", "R (Shift = -15)"],
    ["Nudge", "Arrow keys"],
    ["Duplicate", "Ctrl + D"],
    ["Copy/Paste", "Ctrl + C / Ctrl + V"],
    ["Undo/Redo", "Ctrl + Z / Ctrl + Y"],
  ];
  for(const [label, keys] of shortcuts){
    const row = document.createElement("div");
    row.className = "dzme-shortcut";
    const left = document.createElement("div");
    left.textContent = label;
    const right = document.createElement("div");
    right.textContent = keys;
    row.appendChild(left);
    row.appendChild(right);
    shortcutsBody.appendChild(row);
  }
  shortcutsCard.body.appendChild(shortcutsBody);

  right.appendChild(settingsWrap);
  right.appendChild(inspectorWrap);
  right.appendChild(validationWrap);
  right.appendChild(shortcutsWrap);

  const actionsLeft = document.createElement("div");
  actionsLeft.className = "dzme-actions";
  const actionsRight = document.createElement("div");
  actionsRight.className = "dzme-actions";
  const status = document.createElement("div");
  status.className = "dzme-status";

  const newBtn = Button({ text:"New", variant:"secondary", onClick: ()=>{
    undo.push(mapData);
    mapData = defaultMapData();
    selected = null;
    refreshAll();
  }});

  const openBtn = Button({ text:"Open (.dzmap)", variant:"secondary", onClick: ()=>{
    fileInput.click();
  }});

  const saveBtn = Button({ text:"Save Workspace", variant:"secondary", onClick: ()=>{
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(mapData));
    engine.events.emit("dev:toast", { msg:"Workspace saved" });
  }});

  const validateBtn = Button({ text:"Validate", variant:"secondary", onClick: ()=>{
    refreshValidation(true);
  }});

  const testBtn = Button({ text:"Test Map", variant:"secondary", onClick: ()=> startTest() });
  const exitTestBtn = Button({ text:"Exit Test", variant:"secondary", onClick: ()=> stopTest() });
  exitTestBtn.style.display = "none";

  const exportBtn = Button({ text:"Export (.dzmap)", variant:"secondary", onClick: ()=> exportDzmap() });
  const exportDzsBtn = Button({ text:"Export DZS", variant:"secondary", onClick: ()=> exportDzs() });

  actionsLeft.appendChild(newBtn);
  actionsLeft.appendChild(openBtn);
  actionsLeft.appendChild(saveBtn);
  actionsLeft.appendChild(validateBtn);
  actionsLeft.appendChild(testBtn);
  actionsLeft.appendChild(exitTestBtn);

  actionsRight.appendChild(exportBtn);
  actionsRight.appendChild(exportDzsBtn);

  footer.appendChild(actionsLeft);
  footer.appendChild(status);
  footer.appendChild(actionsRight);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".dzmap,application/json";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", ()=>{
    const file = fileInput.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const data = safeParse(reader.result);
      if(!data || data.format !== "dzmap"){
        engine.events.emit("dev:toast", { msg:"Invalid dzmap file" });
        return;
      }
      undo.push(mapData);
      mapData = normalizeMapData(data);
      selected = null;
      refreshAll();
    };
    reader.readAsText(file);
  });
  screen.appendChild(fileInput);

  body.appendChild(left);
  body.appendChild(center);
  body.appendChild(right);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  screen.appendChild(panel);

  function syncInput(input, value){
    if(!input) return;
    if(document.activeElement === input) return;
    input.value = value == null ? "" : String(value);
  }

  function refreshSettings(){
    const meta = mapData.meta || {};
    syncInput(nameInput, meta.name || "untitled");
    syncInput(authorInput, meta.author || "Host");
    const modes = Array.isArray(meta.modes) && meta.modes.length ? meta.modes : ["ZM"];
    modeZmInput.checked = modes.includes("ZM");
    modeMpInput.checked = modes.includes("MP");
    syncInput(minXInput, mapData.bounds?.minX ?? -25);
    syncInput(minYInput, mapData.bounds?.minY ?? -25);
    syncInput(maxXInput, mapData.bounds?.maxX ?? 25);
    syncInput(maxYInput, mapData.bounds?.maxY ?? 25);
    const floorColor = mapData.floor?.color || "#0c1222";
    syncInput(groundColorInput, floorColor);
    if(groundSelectInput){
      const match = groundPresets.find(p=>p.color && p.color.toLowerCase() === String(floorColor).toLowerCase());
      groundSelectInput.value = match ? match.value : "custom";
    }
    const created = meta.createdAt ? new Date(meta.createdAt).toLocaleString() : "Unknown";
    const updated = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString() : created;
    metaStamp.textContent = `Created ${created} | Updated ${updated}`;
  }

  function refreshStatus(){
    const selText = selected ? `${selected.type.toUpperCase()} ${selected.id}` : "None";
    const cursorText = `${formatNumber(cursorPos.x, 2)}, ${formatNumber(cursorPos.y, 2)}`;
    const counts = `W ${mapData.walls.length} | P ${mapData.props.length} | L ${mapData.lights.length} | Z ${mapData.zones.length}`;
    status.textContent = `Cursor ${cursorText} | Selected ${selText} | ${counts}`;
  }

  function refreshList(){
    listBody.innerHTML = "";
    const query = String(listFilter || "").toLowerCase().trim();
    const groups = [
      { label:"Walls", type:"wall", items: mapData.walls },
      { label:"Props", type:"prop", items: mapData.props },
      { label:"Player Spawns", type:"player", items: mapData.spawns.player },
      { label:"Zombie Spawns", type:"zombie", items: mapData.spawns.zombie },
      { label:"Lights", type:"light", items: mapData.lights },
      { label:"Zones", type:"zone", items: mapData.zones },
    ];
    for(const g of groups){
      const header = document.createElement("div");
      header.className = "dzme-list-header";
      header.textContent = `${g.label} (${g.items.length})`;
      listBody.appendChild(header);
      for(const item of g.items){
        const label = g.type === "prop"
          ? `${item.id} / ${item.type || item.assetId || "prop"}`
          : g.type === "zone"
            ? `${item.id} / ${item.name || "zone"}`
            : item.id;
        if(query && !label.toLowerCase().includes(query)) continue;
        const row = document.createElement("div");
        row.className = "dzme-list-item";
        row.textContent = label;
        row.classList.toggle("is-selected", selected?.id === item.id && selected?.type === g.type);
        row.addEventListener("click", ()=>{
          selected = { type:g.type, id:item.id };
          canvasView.render();
          refreshInspector();
          preview3d.update();
          refreshStatus();
        });
        listBody.appendChild(row);
      }
    }
  }

  function refreshInspector(){
    inspectorBody.innerHTML = "";
    if(!selected){
      const hint = document.createElement("div");
      hint.className = "dzme-help";
      hint.textContent = "Select an element to edit properties.";
      inspectorBody.appendChild(hint);
      return;
    }
    const type = selected.type;
    const list = (type === "wall") ? mapData.walls :
      (type === "prop") ? mapData.props :
      (type === "player") ? mapData.spawns.player :
      (type === "zombie") ? mapData.spawns.zombie :
      (type === "light") ? mapData.lights :
      mapData.zones;
    const item = list.find(i=>i.id === selected.id);
    if(!item){
      inspectorBody.textContent = "Selection not found.";
      return;
    }

    const fields = [];
    fields.push(makeField({ label:"Id", value:item.id, onChange:(v)=>{
      const nextId = String(v || "");
      applyInspectorChange((draft, it)=> it.id = nextId, { updateSelectedId: nextId });
    }}));
    fields.push(makeField({ label:"X", value:item.x, onChange:(v)=>{
      applyInspectorChange((draft, it)=> it.x = Number(v || 0));
    }, type:"number" }));
    fields.push(makeField({ label:"Y", value:item.y, onChange:(v)=>{
      applyInspectorChange((draft, it)=> it.y = Number(v || 0));
    }, type:"number" }));

    if(type === "wall" || type === "zone"){
      fields.push(makeField({ label:"W", value:item.w, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.w = Number(v || 0));
      }, type:"number" }));
      fields.push(makeField({ label:"H", value:item.h, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.h = Number(v || 0));
      }, type:"number" }));
    }

    if(type === "wall" || type === "prop" || type === "player"){
      fields.push(makeField({ label:"Rot", value:item.rot || 0, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.rot = Number(v || 0));
      }, type:"number" }));
    }

    if(type === "wall"){
      fields.push(makeField({ label:"Height", value:item.height ?? 2.6, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.height = Number(v || 0));
      }, type:"number" }));
      fields.push(makeField({ label:"Texture URL", value:item.material?.texture || "", onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.material = { ...(it.material||{}), texture: String(v || "") });
      }}));
    }

    if(type === "prop"){
      fields.push(makeField({ label:"Z", value:item.z || 0, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.z = Number(v || 0));
      }, type:"number" }));
      fields.push(makeSelect({ label:"Mesh", value:item.kind || "box", options:[
        { value:"box", label:"Box" },
        { value:"sphere", label:"Sphere" },
        { value:"cylinder", label:"Cylinder" },
        { value:"model", label:"Model (GLTF)" },
        { value:"tile", label:"Tile (Ground)" },
      ], onChange:(v)=> applyInspectorChange((draft, it)=> it.kind = String(v || "box")) }));
      if(String(item.kind || "box") === "model" || item.model){
        fields.push(makeField({ label:"Model Path", value:item.model || "", onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.model = String(v || ""));
        }}));
      }
      fields.push(makeField({ label:"Type", value:item.type, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.type = String(v || "crate"));
      }}));
      fields.push(makeField({ label:"Scale", value:item.scale || 1, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.scale = Number(v || 1));
      }, type:"number" }));
      if(String(item.kind || "box") === "box" || String(item.kind || "box") === "tile"){
        fields.push(makeField({ label:"Size X", value:item.sx ?? item.scale ?? 1, onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.sx = Number(v || 1));
        }, type:"number" }));
        fields.push(makeField({ label:"Size Y", value:item.sy ?? item.scale ?? 1, onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.sy = Number(v || 1));
        }, type:"number" }));
        fields.push(makeField({ label:"Size Z", value:item.sz ?? item.scale ?? 1, onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.sz = Number(v || 1));
        }, type:"number" }));
      }
      if(String(item.kind || "box") === "cylinder"){
        fields.push(makeField({ label:"Radius Top", value:item.rTop ?? item.scale ?? 0.5, onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.rTop = Number(v || 0.5));
        }, type:"number" }));
        fields.push(makeField({ label:"Radius Bottom", value:item.rBottom ?? item.scale ?? 0.5, onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.rBottom = Number(v || 0.5));
        }, type:"number" }));
        fields.push(makeField({ label:"Height", value:item.h ?? item.scale ?? 1, onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.h = Number(v || 1));
        }, type:"number" }));
      }
      if(String(item.kind || "box") === "sphere"){
        fields.push(makeField({ label:"Radius", value:item.r ?? (item.scale ? item.scale * 0.5 : 0.5), onChange:(v)=>{
          applyInspectorChange((draft, it)=> it.r = Number(v || 0.5));
        }, type:"number" }));
      }
      fields.push(makeField({ label:"Material", value:item.material?.color || "#ffffff", onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.material = { ...(it.material||{}), color: String(v || "#ffffff") });
      }}));
      fields.push(makeField({ label:"Texture URL", value:item.material?.texture || "", onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.material = { ...(it.material||{}), texture: String(v || "") });
      }}));
      fields.push(makeCheckbox({ label:"Collision", checked: item.collision !== false, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.collision = Boolean(v));
      }}));
    }

    if(type === "player"){
      fields.push(makeField({ label:"Z", value:item.z || 0, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.z = Number(v || 0));
      }, type:"number" }));
      fields.push(makeSelect({ label:"Team", value:item.team || "A", options:[
        { value:"A", label:"A" },
        { value:"B", label:"B" },
      ], onChange:(v)=> applyInspectorChange((draft, it)=> it.team = v) }));
    }

    if(type === "zombie"){
      fields.push(makeField({ label:"Z", value:item.z || 0, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.z = Number(v || 0));
      }, type:"number" }));
    }

    if(type === "light"){
      fields.push(makeSelect({ label:"Kind", value:item.kind || "point", options:[
        { value:"point", label:"Point" },
        { value:"ambient", label:"Ambient" },
        { value:"directional", label:"Directional" },
      ], onChange:(v)=> applyInspectorChange((draft, it)=> it.kind = v) }));
      fields.push(makeField({ label:"Z", value:item.z || 4, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.z = Number(v || 0));
      }, type:"number" }));
      fields.push(makeField({ label:"Intensity", value:item.intensity || 1, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.intensity = Number(v || 1));
      }, type:"number" }));
      fields.push(makeField({ label:"Spread", value:item.range || 40, onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.range = Number(v || 0));
      }, type:"number" }));
      fields.push(makeField({ label:"Color", value:item.color || "#ffffff", onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.color = String(v || "#ffffff"));
      }}));
    }

    if(type === "zone"){
      fields.push(makeField({ label:"Name", value:item.name || "", onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.name = String(v || ""));
      }}));
    }

    const duplicateBtn = Button({ text:"Duplicate", variant:"secondary", onClick: ()=> duplicateSelected() });
    const copyBtn = Button({ text:"Copy", variant:"secondary", onClick: ()=> copySelected() });

    const removeBtn = Button({ text:"Delete", variant:"secondary", onClick: ()=>{
      undo.push(mapData);
      const next = clone(mapData);
      const target = (type === "wall") ? next.walls :
        (type === "prop") ? next.props :
        (type === "player") ? next.spawns.player :
        (type === "zombie") ? next.spawns.zombie :
        (type === "light") ? next.lights :
        next.zones;
      const idx = target.findIndex(i=>i.id === item.id);
      if(idx >= 0) target.splice(idx, 1);
      next.meta = next.meta || {};
      next.meta.updatedAt = Date.now();
      mapData = next;
      selected = null;
      refreshAll();
    }});

    for(const f of fields) inspectorBody.appendChild(f);
    inspectorBody.appendChild(duplicateBtn);
    inspectorBody.appendChild(copyBtn);
    inspectorBody.appendChild(removeBtn);
  }

  function applyInspectorChange(fn, { pushUndo=true, updateSelectedId=null } = {}){
    if(pushUndo) undo.push(mapData);
    const next = clone(mapData);
    const type = selected.type;
    const list = getListForType(next, type);
    const it = list.find(i=>i.id === selected.id);
    if(it) fn(next, it);
    next.meta = next.meta || {};
    next.meta.updatedAt = Date.now();
    mapData = next;
    if(updateSelectedId && selected){
      selected = { ...selected, id: updateSelectedId };
    }
    refreshAll();
  }

  function getSelectedItem(){
    if(!selected) return null;
    const list = getListForType(mapData, selected.type);
    const item = list.find(i=>i.id === selected.id);
    if(!item) return null;
    return { list, item };
  }

  function duplicateSelected(){
    const found = getSelectedItem();
    if(!found) return;
    const copy = clone(found.item);
    copy.id = `${selected.type[0]}${Date.now()}`;
    if("x" in copy) copy.x = Number(copy.x || 0) + gridSize;
    if("y" in copy) copy.y = Number(copy.y || 0) + gridSize;
    selected = { type: selected.type, id: copy.id };
    commitChange((draft)=>{ getListForType(draft, selected.type).push(copy); }, { pushUndo:true });
  }

  function copySelected(){
    const found = getSelectedItem();
    if(!found) return;
    clipboard = { type: selected.type, item: clone(found.item) };
  }

  function pasteClipboard(){
    if(!clipboard?.item || !clipboard?.type) return;
    const copy = clone(clipboard.item);
    copy.id = `${clipboard.type[0]}${Date.now()}`;
    if("x" in copy) copy.x = Number(copy.x || 0) + gridSize;
    if("y" in copy) copy.y = Number(copy.y || 0) + gridSize;
    selected = { type: clipboard.type, id: copy.id };
    commitChange((draft)=>{ getListForType(draft, clipboard.type).push(copy); }, { pushUndo:true });
  }

  function nudgeSelected(dx, dy){
    if(!selected) return;
    applyInspectorChange((draft, it)=>{
      if("x" in it) it.x = Number(it.x || 0) + dx;
      if("y" in it) it.y = Number(it.y || 0) + dy;
    }, { pushUndo:true });
  }

  function renderAssetList(){
    assetList.innerHTML = "";
    const query = String(assetSearch.value || "").toLowerCase();
    const filtered = assets.filter(a=>{
      if(!query) return true;
      return String(a.name || a.id).toLowerCase().includes(query);
    });
    if(filtered.length === 0){
      const empty = document.createElement("div");
      empty.className = "dzme-help";
      empty.textContent = "No assets in library.";
      assetList.appendChild(empty);
      return;
    }
    for(const a of filtered){
      const row = document.createElement("div");
      row.className = "dzme-list-item";
      row.textContent = a.name || a.id;
      row.classList.toggle("is-selected", selectedAsset?.id === a.id);
      row.addEventListener("click", ()=>{
        selectedAsset = a;
        canvasView.setAsset(a);
        setTool("asset");
        renderAssetList();
      });
      assetList.appendChild(row);
    }
  }

  async function loadAssetLibrary(){
    const mode = (engine?.ctx?.session?.mode || "zm");
    assetMode = mode;
    const base = mode === "mp" ? "/engine/game/mp/map_assets/assetLibrary.json" : "/engine/game/zm/map_assets/assetLibrary.json";
    try{
      const res = await fetch(base, { cache:"no-store" });
      if(!res.ok) throw new Error("asset load failed");
      const data = await res.json();
      assets = Array.isArray(data.assets) ? data.assets : [];
    } catch {
      assets = [];
    }
    selectedAsset = assets[0] || null;
    canvasView.setAsset(selectedAsset);
    renderAssetList();
  }

  function onMutateProp(item){
    if(!item) return;
    undo.push(mapData);
    const next = clone(mapData);
    next.props.push(item);
    next.meta = next.meta || {};
    next.meta.updatedAt = Date.now();
    mapData = next;
    selected = { type:"prop", id:item.id };
    refreshAll();
  }

  function onMutateWall(item){
    if(!item) return;
    undo.push(mapData);
    const next = clone(mapData);
    next.walls.push(item);
    next.meta = next.meta || {};
    next.meta.updatedAt = Date.now();
    mapData = next;
    selected = { type:"wall", id:item.id };
    refreshAll();
  }

  function refreshValidation(force){
    const result = validateDzmap(mapData);
    validationBody.innerHTML = "";
    if(result.errors.length === 0 && result.warnings.length === 0){
      const ok = document.createElement("div");
      ok.className = "dzme-help";
      ok.textContent = force ? "No validation issues." : "Ready.";
      validationBody.appendChild(ok);
      return;
    }
    for(const e of result.errors){
      const row = document.createElement("div");
      row.className = "dzme-error";
      row.textContent = e;
      validationBody.appendChild(row);
    }
    for(const w of result.warnings){
      const row = document.createElement("div");
      row.className = "dzme-warn";
      row.textContent = w;
      validationBody.appendChild(row);
    }
  }

  function refreshAll(){
    refreshList();
    refreshSettings();
    refreshInspector();
    refreshValidation(false);
    refreshStatus();
    canvasView.render();
    preview3d.update();
  }

  function exportDzmap(){
    const blob = new Blob([JSON.stringify(mapData, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mapData.meta?.name || "map"}.dzmap`;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }

  function exportDzs(){
    const text = dzmapToDzs(mapData);
    const blob = new Blob([text], { type:"text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${mapData.meta?.name || "map"}.dzs`;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
  }

  function startTest(){
    if(testing) return;
    if(engine?.ctx?.matchSession?.state === "IN_MATCH"){
      engine.events.emit("dev:toast", { msg:"Exit match before testing map." });
      return;
    }
    testing = true;
    exitTestBtn.style.display = "";
    testBtn.style.display = "none";

    testSession = {
      prevEcs: engine.ecs,
      prevCtxEcs: engine.ctx.ecs,
      prevGame: engine.ctx.game,
      prevMap: engine.ctx.map,
      prevLoopRunning: engine.loop.running,
      prevTimeScale: engine.ctx.timeScale,
      prevOverlay: menu?.overlayEl || null,
      prevScreen: menu?.screenEl || null,
    };

    engine.ctx.timeScale = 1;
    engine.ecs = new ECS();
    engine.ctx.ecs = engine.ecs;

    const game = new ZmGame({ engine, scripts: engine.ctx.scripts });
    engine.ctx.game = game;

    const build = compiler.compile(mapData, { mode:"zm", clearWorld:true });
    game.applySpawnPoints(build.spawnPoints);
    game.start();

    if(!engine.loop.running) engine.start();
    menu?.showHud?.(true);
    menu?.setOverlay?.(null);
    menu?.setScreen?.(null);
  }

  function stopTest(){
    if(!testing) return;
    testing = false;
    exitTestBtn.style.display = "none";
    testBtn.style.display = "";
    try { engine.ctx.game?.dispose?.(); } catch {}
    engine.ctx.game = testSession?.prevGame || null;
    engine.ctx.map = testSession?.prevMap || null;
    engine.ecs = testSession?.prevEcs || engine.ecs;
    engine.ctx.ecs = testSession?.prevCtxEcs || engine.ctx.ecs;
    if(testSession?.prevTimeScale != null) engine.ctx.timeScale = testSession.prevTimeScale;
    if(!testSession?.prevLoopRunning) engine.stop();
    if(menu){
      menu.showHud(false);
      if(testSession?.prevScreen) menu.setScreen(testSession.prevScreen);
      else menu.setScreen(null);
      if(testSession?.prevOverlay) menu.setOverlay(testSession.prevOverlay);
      else menu.setOverlay(screen);
    }
    testSession = null;
  }

  const onKeyDown = (e)=>{
    const tag = document.activeElement?.tagName;
    if(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if(e.key === "Delete" && selected){
      const type = selected.type;
      const list = (type === "wall") ? mapData.walls :
        (type === "prop") ? mapData.props :
        (type === "player") ? mapData.spawns.player :
        (type === "zombie") ? mapData.spawns.zombie :
        (type === "light") ? mapData.lights :
        mapData.zones;
      const idx = list.findIndex(i=>i.id === selected.id);
      if(idx >= 0){
        undo.push(mapData);
        const next = clone(mapData);
        const list2 = (type === "wall") ? next.walls :
          (type === "prop") ? next.props :
          (type === "player") ? next.spawns.player :
          (type === "zombie") ? next.spawns.zombie :
          (type === "light") ? next.lights :
          next.zones;
        list2.splice(idx, 1);
        next.meta = next.meta || {};
        next.meta.updatedAt = Date.now();
        mapData = next;
        selected = null;
        refreshAll();
      }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){
      e.preventDefault();
      const prev = undo.undoState(mapData);
      if(prev){
        mapData = prev;
        refreshAll();
      }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y"){
      e.preventDefault();
      const next = undo.redoState(mapData);
      if(next){
        mapData = next;
        refreshAll();
      }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){
      e.preventDefault();
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(mapData));
      engine.events.emit("dev:toast", { msg:"Workspace saved" });
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o"){
      e.preventDefault();
      fileInput.click();
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d"){
      e.preventDefault();
      duplicateSelected();
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c"){
      e.preventDefault();
      copySelected();
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v"){
      e.preventDefault();
      pasteClipboard();
    }
    if(e.key.toLowerCase() === "r"){
      e.preventDefault();
      canvasView.rotateSelected(e.shiftKey ? -15 : 15);
    }
    if(e.key === "ArrowUp"){
      e.preventDefault();
      nudgeSelected(0, e.shiftKey ? gridSize * 5 : gridSize);
    }
    if(e.key === "ArrowDown"){
      e.preventDefault();
      nudgeSelected(0, e.shiftKey ? -gridSize * 5 : -gridSize);
    }
    if(e.key === "ArrowLeft"){
      e.preventDefault();
      nudgeSelected(-gridSize * (e.shiftKey ? 5 : 1), 0);
    }
    if(e.key === "ArrowRight"){
      e.preventDefault();
      nudgeSelected(gridSize * (e.shiftKey ? 5 : 1), 0);
    }
    if(e.key === "1") setTool("select");
    if(e.key === "2") setTool("wall");
    if(e.key === "3") setTool("prop");
    if(e.key === "4") setTool("asset");
    if(e.key === "5") setTool("player");
    if(e.key === "6") setTool("zombie");
    if(e.key === "7") setTool("light");
    if(e.key === "8") setTool("zone");
  };
  document.addEventListener("keydown", onKeyDown);

  function handleClose(){
    if(testing) stopTest();
    document.removeEventListener("keydown", onKeyDown);
    canvasView.dispose();
    preview3d.dispose();
    onClose?.();
  }

  setTool("select");
  canvasView.setGrid(gridSize);
  canvasView.setSnap(snap);
  loadAssetLibrary();
  setViewMode(viewMode);
  refreshAll();

  return screen;
}
