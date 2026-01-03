import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

function degToRad(d){
  return (Number(d || 0) * Math.PI) / 180;
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

function toNumber(n, fallback=0){
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function disposeObject(obj){
  if(obj.geometry) obj.geometry.dispose?.();
  if(obj.material){
    if(Array.isArray(obj.material)){
      for(const m of obj.material) m.dispose?.();
    } else {
      obj.material.dispose?.();
    }
  }
}

export class MapEditorPreview3D {
  constructor({ container, getState, getTool, getSelectedAsset, onPlace, onSelect, onMove }){
    this.container = container;
    this.getState = getState;
    this.getTool = getTool;
    this.getSelectedAsset = getSelectedAsset;
    this.onPlace = onPlace;
    this.onSelect = onSelect;
    this.onMove = onMove;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f16);
    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    this.controls = {
      theta: Math.PI * 0.25,
      phi: Math.PI * 0.35,
      radius: 40,
      target: new THREE.Vector3(0, 0, 0),
      dragging: false,
      lastX: 0,
      lastY: 0,
    };

    const hemi = new THREE.HemisphereLight(0x88aaff, 0x111122, 1.1);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(10, 18, 8);
    this.scene.add(dir);
    const fill = new THREE.PointLight(0xffd4a1, 0.7, 120, 1.6);
    fill.position.set(0, 6, 0);
    this.scene.add(fill);

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._drag = null;
    this._selectables = [];
    this._textureCache = new Map();
    this._textureLoader = new THREE.TextureLoader();

    this._onResize = ()=> this.resize();
    window.addEventListener("resize", this._onResize);

    this._bindEvents();
    this.resize();
    this._rebuild();
  }

  dispose(){
    window.removeEventListener("resize", this._onResize);
    this._unbindEvents();
    for(const child of Array.from(this.mapGroup.children)){
      disposeObject(child);
      this.mapGroup.remove(child);
    }
    this.renderer.dispose?.();
    this.container.innerHTML = "";
  }

  _bindEvents(){
    const el = this.renderer.domElement;
    this._onMouseDown = (e)=>{
      if(e.button !== 0) return;
      const tool = this.getTool?.() || "select";
      const hit = this._pick(e);
      if(tool === "select"){
        if(hit?.selectable){
          this.onSelect?.(hit.selectable);
          if(hit.selectable.type === "prop"){
            this._drag = { sel: hit.selectable, started: false };
          }
        } else {
          this.onSelect?.(null);
        }
        this.controls.dragging = true;
        this.controls.lastX = e.clientX;
        this.controls.lastY = e.clientY;
        return;
      }

      if(tool === "prop" || tool === "asset"){
        const asset = this.getSelectedAsset?.();
        const point = this._pickGround(e);
        if(point){
          if(tool === "asset" && !asset) return;
          this.onPlace?.({ x: point.x, y: point.z, z: 0, asset, tool });
        }
      }
      if(tool === "wall"){
        const point = this._pickGround(e);
        if(point){
          this.onPlace?.({ x: point.x, y: point.z, z: 0, tool });
        }
      }
      if(tool === "player" || tool === "zombie" || tool === "light" || tool === "zone"){
        const point = this._pickGround(e);
        if(point){
          this.onPlace?.({ x: point.x, y: point.z, z: 0, tool });
        }
      }
      this.controls.dragging = true;
      this.controls.lastX = e.clientX;
      this.controls.lastY = e.clientY;
    };
    this._onMouseMove = (e)=>{
      if(!this.controls.dragging) return;
      if(this._drag){
        const point = this._pickGround(e);
        if(point){
          const commit = !this._drag.started;
          this._drag.started = true;
          this.onMove?.(this._drag.sel, { x: point.x, y: point.z }, { commit });
        }
        return;
      }
      const dx = e.clientX - this.controls.lastX;
      const dy = e.clientY - this.controls.lastY;
      this.controls.lastX = e.clientX;
      this.controls.lastY = e.clientY;
      this.controls.theta -= dx * 0.005;
      this.controls.phi = clamp(this.controls.phi + dy * 0.005, 0.2, Math.PI * 0.48);
      this._updateCamera();
      this.render();
    };
    this._onMouseUp = ()=>{
      this.controls.dragging = false;
      this._drag = null;
    };
    this._onWheel = (e)=>{
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      this.controls.radius = clamp(this.controls.radius + dir * 2, 8, 120);
      this._updateCamera();
      this.render();
    };
    el.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
    el.addEventListener("wheel", this._onWheel, { passive:false });
  }

  _unbindEvents(){
    const el = this.renderer.domElement;
    el.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup", this._onMouseUp);
    el.removeEventListener("wheel", this._onWheel);
  }

  resize(){
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._updateCamera();
    this.render();
  }

  _updateCamera(){
    const c = this.controls;
    const x = c.target.x + Math.cos(c.theta) * Math.cos(c.phi) * c.radius;
    const y = c.target.y + Math.sin(c.phi) * c.radius;
    const z = c.target.z + Math.sin(c.theta) * Math.cos(c.phi) * c.radius;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(c.target);
  }

  render(){
    this.renderer.render(this.scene, this.camera);
  }

  update(){
    this._rebuild();
  }

  _updatePointer(e){
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pickGround(e){
    this._updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    const ok = this.raycaster.ray.intersectPlane(this._ground, hit);
    return ok ? hit : null;
  }

  _pick(e){
    this._updatePointer(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this._selectables, true);
    if(!hits?.length) return null;
    let obj = hits[0].object;
    while(obj && !obj.userData?.selectable) obj = obj.parent;
    return obj?.userData?.selectable ? { selectable: obj.userData.selectable } : null;
  }

  _rebuild(){
    const { mapData, selected } = this.getState();
    for(const child of Array.from(this.mapGroup.children)){
      disposeObject(child);
      this.mapGroup.remove(child);
    }
    this._selectables = [];
    if(!mapData) return;

    const bounds = mapData.bounds || { minX:-25, minY:-25, maxX:25, maxY:25 };
    const minX = toNumber(bounds.minX, -25);
    const minY = toNumber(bounds.minY, -25);
    const maxX = toNumber(bounds.maxX, 25);
    const maxY = toNumber(bounds.maxY, 25);
    const width = Math.max(1, Math.abs(maxX - minX));
    const depth = Math.max(1, Math.abs(maxY - minY));
    const centerX = (minX + maxX) / 2;
    const centerZ = (minY + maxY) / 2;
    this.controls.target.set(centerX, 0, centerZ);

    const floorGeo = new THREE.PlaneGeometry(width || 1, depth || 1);
    const floorColor = mapData.floor?.color || "#1c2431";
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: toNumber(mapData.floor?.roughness, 0.9),
      metalness: toNumber(mapData.floor?.metalness, 0.05),
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0, centerZ);
    this.mapGroup.add(floor);

    const grid = new THREE.GridHelper(Math.max(width, depth) || 1, Math.max(4, Math.floor(Math.max(width, depth))));
    grid.position.set(centerX, 0.01, centerZ);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.mapGroup.add(grid);

    for(const w of (mapData.walls || [])){
      const ww = Math.max(0.1, Math.abs(toNumber(w.w, 1)));
      const hh = Math.max(0.1, Math.abs(toNumber(w.h, 1)));
      const wallHeight = Math.max(0.1, toNumber(w.height, 2.6));
      const geo = new THREE.BoxGeometry(ww, wallHeight, hh);
      const isSelected = (selected?.type === "wall" && selected?.id === w.id);
      const mat = this._makeMaterial({
        baseColor: 0x5b7ca6,
        selected: isSelected,
        texture: w.material?.texture,
        roughness: 0.8,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(toNumber(w.x, 0), wallHeight / 2, toNumber(w.y, 0));
      mesh.rotation.y = -degToRad(w.rot || 0);
      mesh.userData.selectable = { type:"wall", id:w.id };
      this._selectables.push(mesh);
      this.mapGroup.add(mesh);
    }

    for(const p of (mapData.props || [])){
      const s = Math.max(0.4, toNumber(p.scale, 1));
      const isSelected = (selected?.type === "prop" && selected?.id === p.id);
      const color = p.material?.color || "#b08b44";
      const mat = this._makeMaterial({
        baseColor: color,
        selected: isSelected,
        texture: p.material?.texture,
        roughness: 0.85,
      });
      let geo = null;
      const kind = String(p.kind || "box");
      if(kind === "sphere") geo = new THREE.SphereGeometry(s * 0.5, 16, 12);
      else if(kind === "cylinder") geo = new THREE.CylinderGeometry(s * 0.35, s * 0.35, s, 12);
      else if(kind === "tile") geo = new THREE.BoxGeometry(s, 0.08, s);
      else geo = new THREE.BoxGeometry(s, s, s);
      const mesh = new THREE.Mesh(geo, mat);
      const y = (kind === "tile") ? (0.04 + toNumber(p.z, 0)) : ((s / 2) + toNumber(p.z, 0));
      mesh.position.set(toNumber(p.x, 0), y, toNumber(p.y, 0));
      mesh.rotation.y = -degToRad(p.rot || 0);
      mesh.userData.selectable = { type:"prop", id:p.id };
      this._selectables.push(mesh);
      this.mapGroup.add(mesh);
    }

    const playerMat = new THREE.MeshStandardMaterial({ color: 0x5cc8ff, roughness: 0.6 });
    const playerSelMat = new THREE.MeshStandardMaterial({ color: 0xbef0ff, roughness: 0.4 });
    for(const s of (mapData.spawns?.player || [])){
      const geo = new THREE.ConeGeometry(0.45, 1.2, 6);
      const mat = (selected?.type === "player" && selected?.id === s.id) ? playerSelMat : playerMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(toNumber(s.x, 0), 0.6 + toNumber(s.z, 0), toNumber(s.y, 0));
      mesh.rotation.y = -degToRad(s.rot || 0);
      mesh.userData.selectable = { type:"player", id:s.id };
      this._selectables.push(mesh);
      this.mapGroup.add(mesh);
    }

    const zombieMat = new THREE.MeshStandardMaterial({ color: 0x56d082, roughness: 0.6 });
    const zombieSelMat = new THREE.MeshStandardMaterial({ color: 0xb0f7c6, roughness: 0.4 });
    for(const s of (mapData.spawns?.zombie || [])){
      const geo = new THREE.ConeGeometry(0.45, 1.2, 6);
      const mat = (selected?.type === "zombie" && selected?.id === s.id) ? zombieSelMat : zombieMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(toNumber(s.x, 0), 0.6 + toNumber(s.z, 0), toNumber(s.y, 0));
      mesh.userData.selectable = { type:"zombie", id:s.id };
      this._selectables.push(mesh);
      this.mapGroup.add(mesh);
    }

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xf8d07a, emissive: 0x332200, roughness: 0.4 });
    const lightSelMat = new THREE.MeshStandardMaterial({ color: 0xffe8a8, emissive: 0x553300, roughness: 0.3 });
    for(const l of (mapData.lights || [])){
      const geo = new THREE.SphereGeometry(0.3, 12, 10);
      const mat = (selected?.type === "light" && selected?.id === l.id) ? lightSelMat : lightMat;
      const mesh = new THREE.Mesh(geo, mat);
      const z = toNumber(l.z, 4);
      mesh.position.set(toNumber(l.x, 0), z, toNumber(l.y, 0));
      mesh.userData.selectable = { type:"light", id:l.id };
      this._selectables.push(mesh);
      this.mapGroup.add(mesh);
      if(l.kind === "point"){
        const light = new THREE.PointLight(l.color || "#ffffff", toNumber(l.intensity, 1), toNumber(l.range, 40), 1.6);
        light.position.copy(mesh.position);
        this.mapGroup.add(light);
      }
      if(l.kind === "ambient"){
        const light = new THREE.AmbientLight(l.color || "#ffffff", toNumber(l.intensity, 0.6));
        this.mapGroup.add(light);
      }
      if(l.kind === "directional"){
        const light = new THREE.DirectionalLight(l.color || "#ffffff", toNumber(l.intensity, 0.8));
        light.position.set(toNumber(l.x, 0), z + 10, toNumber(l.y, 0));
        this.mapGroup.add(light);
      }
    }

    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xd98ab5, wireframe: true });
    const zoneSelMat = new THREE.MeshBasicMaterial({ color: 0xffb7da, wireframe: true });
    for(const z of (mapData.zones || [])){
      const ww = Math.max(0.1, Math.abs(toNumber(z.w, 1)));
      const hh = Math.max(0.1, Math.abs(toNumber(z.h, 1)));
      const geo = new THREE.BoxGeometry(ww, 2, hh);
      const mat = (selected?.type === "zone" && selected?.id === z.id) ? zoneSelMat : zoneMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(toNumber(z.x, 0), 1, toNumber(z.y, 0));
      mesh.userData.selectable = { type:"zone", id:z.id };
      this._selectables.push(mesh);
      this.mapGroup.add(mesh);
    }

    this._updateCamera();
    this.render();
  }

  _makeMaterial({ baseColor, selected=false, texture=null, roughness=0.85 } = {}){
    const useTexture = texture && String(texture).trim();
    const color = useTexture ? 0xffffff : baseColor;
    const mat = new THREE.MeshStandardMaterial({ color, roughness });
    if(useTexture){
      const tex = this._getTexture(String(texture));
      if(tex) mat.map = tex;
      mat.color = new THREE.Color(0xffffff);
    }
    if(selected){
      mat.emissive = new THREE.Color(0x553300);
      mat.emissiveIntensity = 0.35;
    }
    return mat;
  }

  _getTexture(url){
    if(!url) return null;
    const key = String(url);
    if(this._textureCache.has(key)) return this._textureCache.get(key);
    const tex = this._textureLoader.load(key, ()=> this.render());
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    this._textureCache.set(key, tex);
    return tex;
  }
}
