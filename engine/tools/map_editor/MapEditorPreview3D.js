import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

function degToRad(d){
  return (Number(d || 0) * Math.PI) / 180;
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
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
  constructor({ container, getState }){
    this.container = container;
    this.getState = getState;
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

    const hemi = new THREE.HemisphereLight(0x88aaff, 0x111122, 0.7);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 18, 8);
    this.scene.add(dir);

    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

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
      this.controls.dragging = true;
      this.controls.lastX = e.clientX;
      this.controls.lastY = e.clientY;
    };
    this._onMouseMove = (e)=>{
      if(!this.controls.dragging) return;
      const dx = e.clientX - this.controls.lastX;
      const dy = e.clientY - this.controls.lastY;
      this.controls.lastX = e.clientX;
      this.controls.lastY = e.clientY;
      this.controls.theta -= dx * 0.005;
      this.controls.phi = clamp(this.controls.phi + dy * 0.005, 0.2, Math.PI * 0.48);
      this._updateCamera();
      this.render();
    };
    this._onMouseUp = ()=>{ this.controls.dragging = false; };
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

  _rebuild(){
    const { mapData, selected } = this.getState();
    for(const child of Array.from(this.mapGroup.children)){
      disposeObject(child);
      this.mapGroup.remove(child);
    }
    if(!mapData) return;

    const bounds = mapData.bounds || { minX:-25, minY:-25, maxX:25, maxY:25 };
    const width = Math.abs(bounds.maxX - bounds.minX);
    const depth = Math.abs(bounds.maxY - bounds.minY);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minY + bounds.maxY) / 2;
    this.controls.target.set(centerX, 0, centerZ);

    const floorGeo = new THREE.PlaneGeometry(width || 1, depth || 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c2431, roughness: 0.9, metalness: 0.05 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0, centerZ);
    this.mapGroup.add(floor);

    const grid = new THREE.GridHelper(Math.max(width, depth) || 1, Math.max(4, Math.floor(Math.max(width, depth))));
    grid.position.set(centerX, 0.01, centerZ);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    this.mapGroup.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5b7ca6, roughness: 0.8 });
    const wallSelMat = new THREE.MeshStandardMaterial({ color: 0xf2b26b, roughness: 0.7 });
    for(const w of (mapData.walls || [])){
      const ww = Math.abs(Number(w.w || 1));
      const hh = Math.abs(Number(w.h || 1));
      const geo = new THREE.BoxGeometry(ww, 3, hh);
      const mat = (selected?.type === "wall" && selected?.id === w.id) ? wallSelMat : wallMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Number(w.x || 0), 1.5, Number(w.y || 0));
      mesh.rotation.y = -degToRad(w.rot || 0);
      this.mapGroup.add(mesh);
    }

    const propMat = new THREE.MeshStandardMaterial({ color: 0xb08b44, roughness: 0.85 });
    const propSelMat = new THREE.MeshStandardMaterial({ color: 0xf4d27a, roughness: 0.7 });
    for(const p of (mapData.props || [])){
      const s = Math.max(0.4, Number(p.scale || 1));
      const geo = new THREE.BoxGeometry(s, s, s);
      const mat = (selected?.type === "prop" && selected?.id === p.id) ? propSelMat : propMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Number(p.x || 0), s / 2, Number(p.y || 0));
      mesh.rotation.y = -degToRad(p.rot || 0);
      this.mapGroup.add(mesh);
    }

    const playerMat = new THREE.MeshStandardMaterial({ color: 0x5cc8ff, roughness: 0.6 });
    const playerSelMat = new THREE.MeshStandardMaterial({ color: 0xbef0ff, roughness: 0.4 });
    for(const s of (mapData.spawns?.player || [])){
      const geo = new THREE.ConeGeometry(0.45, 1.2, 6);
      const mat = (selected?.type === "player" && selected?.id === s.id) ? playerSelMat : playerMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Number(s.x || 0), 0.6, Number(s.y || 0));
      mesh.rotation.y = -degToRad(s.rot || 0);
      this.mapGroup.add(mesh);
    }

    const zombieMat = new THREE.MeshStandardMaterial({ color: 0x56d082, roughness: 0.6 });
    const zombieSelMat = new THREE.MeshStandardMaterial({ color: 0xb0f7c6, roughness: 0.4 });
    for(const s of (mapData.spawns?.zombie || [])){
      const geo = new THREE.ConeGeometry(0.45, 1.2, 6);
      const mat = (selected?.type === "zombie" && selected?.id === s.id) ? zombieSelMat : zombieMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Number(s.x || 0), 0.6, Number(s.y || 0));
      this.mapGroup.add(mesh);
    }

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xf8d07a, emissive: 0x332200, roughness: 0.4 });
    const lightSelMat = new THREE.MeshStandardMaterial({ color: 0xffe8a8, emissive: 0x553300, roughness: 0.3 });
    for(const l of (mapData.lights || [])){
      const geo = new THREE.SphereGeometry(0.3, 12, 10);
      const mat = (selected?.type === "light" && selected?.id === l.id) ? lightSelMat : lightMat;
      const mesh = new THREE.Mesh(geo, mat);
      const z = Number(l.z || 4);
      mesh.position.set(Number(l.x || 0), z, Number(l.y || 0));
      this.mapGroup.add(mesh);
      if(l.kind === "point"){
        const light = new THREE.PointLight(l.color || "#ffffff", Number(l.intensity || 1), 40, 1.6);
        light.position.copy(mesh.position);
        this.mapGroup.add(light);
      }
      if(l.kind === "ambient"){
        const light = new THREE.AmbientLight(l.color || "#ffffff", Number(l.intensity || 0.6));
        this.mapGroup.add(light);
      }
      if(l.kind === "directional"){
        const light = new THREE.DirectionalLight(l.color || "#ffffff", Number(l.intensity || 0.8));
        light.position.set(Number(l.x || 0), z + 10, Number(l.y || 0));
        this.mapGroup.add(light);
      }
    }

    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xd98ab5, wireframe: true });
    const zoneSelMat = new THREE.MeshBasicMaterial({ color: 0xffb7da, wireframe: true });
    for(const z of (mapData.zones || [])){
      const ww = Math.abs(Number(z.w || 1));
      const hh = Math.abs(Number(z.h || 1));
      const geo = new THREE.BoxGeometry(ww, 2, hh);
      const mat = (selected?.type === "zone" && selected?.id === z.id) ? zoneSelMat : zoneMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Number(z.x || 0), 1, Number(z.y || 0));
      this.mapGroup.add(mesh);
    }

    this._updateCamera();
    this.render();
  }
}
