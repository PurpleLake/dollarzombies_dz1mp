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
    },
    bounds: { minX: -25, minY: -25, maxX: 25, maxY: 25 },
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
  next.bounds = next.bounds || { minX:-25, minY:-25, maxX:25, maxY:25 };
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

export function MapEditorScreen({ engine, onClose }){
  ensureCss();
  const menu = engine?.ctx?.menu;
  const compiler = new MapCompiler(engine);
  const undo = new UndoStack(120);
  let mapData = defaultMapData();
  let selected = null;
  let tool = "select";
  let snap = true;
  let testing = false;
  let testSession = null;
  let viewMode = "split";
  let assets = [];
  let selectedAsset = null;
  let assetMode = engine?.ctx?.session?.mode || "zm";

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
  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.type = "button";
  fullscreenBtn.className = "dzme-view-tab";
  fullscreenBtn.textContent = "Fullscreen 3D";
  fullscreenBtn.addEventListener("click", ()=>{
    screen.classList.toggle("dzme-fullscreen");
    setViewMode("3d");
    setTimeout(()=> preview3d.resize(), 50);
  });
  viewActions.appendChild(fullscreenBtn);
  viewHeader.appendChild(viewActions);

  const viewBody = document.createElement("div");
  viewBody.className = "dzme-view-body";

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
      mapData = next;
      refreshAll();
    },
    onSelect: (sel)=>{
      selected = sel;
      refreshInspector();
      refreshList();
      canvasView.render();
      preview3d.update();
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
        scale: Number(asset.scale || 1),
      };
      onMutateProp(item);
    },
    onSelect: (sel)=>{
      selected = sel;
      refreshInspector();
      refreshList();
      canvasView.render();
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

  const listCard = makeCard("Elements");
  const listWrap = listCard.wrap;
  const listBody = document.createElement("div");
  listBody.className = "dzme-list";
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

  right.appendChild(inspectorWrap);
  right.appendChild(validationWrap);

  const actionsLeft = document.createElement("div");
  actionsLeft.className = "dzme-actions";
  const actionsRight = document.createElement("div");
  actionsRight.className = "dzme-actions";

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

  function refreshList(){
    listBody.innerHTML = "";
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
        const row = document.createElement("div");
        row.className = "dzme-list-item";
        row.textContent = item.id;
        row.addEventListener("click", ()=>{
          selected = { type:g.type, id:item.id };
          canvasView.render();
          refreshInspector();
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
      fields.push(makeField({ label:"Material", value:item.material?.color || "#ffffff", onChange:(v)=>{
        applyInspectorChange((draft, it)=> it.material = { ...(it.material||{}), color: String(v || "#ffffff") });
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
      mapData = next;
      selected = null;
      refreshAll();
    }});

    for(const f of fields) inspectorBody.appendChild(f);
    inspectorBody.appendChild(removeBtn);
  }

  function applyInspectorChange(fn, { pushUndo=true, updateSelectedId=null } = {}){
    if(pushUndo) undo.push(mapData);
    const next = clone(mapData);
    const type = selected.type;
    const list = (type === "wall") ? next.walls :
      (type === "prop") ? next.props :
      (type === "player") ? next.spawns.player :
      (type === "zombie") ? next.spawns.zombie :
      (type === "light") ? next.lights :
      next.zones;
    const it = list.find(i=>i.id === selected.id);
    if(it) fn(next, it);
    mapData = next;
    if(updateSelectedId && selected){
      selected = { ...selected, id: updateSelectedId };
    }
    refreshAll();
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
      row.addEventListener("click", ()=>{
        selectedAsset = a;
        canvasView.setAsset(a);
        setTool("asset");
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
    mapData = next;
    selected = { type:"prop", id:item.id };
    refreshAll();
  }

  function onMutateWall(item){
    if(!item) return;
    undo.push(mapData);
    const next = clone(mapData);
    next.walls.push(item);
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
    refreshInspector();
    refreshValidation(false);
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
      prevOverlay: menu?.overlayEl || null,
      prevScreen: menu?.screenEl || null,
    };

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
        mapData = next;
        selected = null;
        refreshAll();
      }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){
      const prev = undo.undoState(mapData);
      if(prev){
        mapData = prev;
        refreshAll();
      }
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y"){
      const next = undo.redoState(mapData);
      if(next){
        mapData = next;
        refreshAll();
      }
    }
    if(e.key.toLowerCase() === "r"){
      canvasView.rotateSelected(e.shiftKey ? -15 : 15);
    }
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
  loadAssetLibrary();
  setViewMode(viewMode);
  refreshAll();

  return screen;
}
