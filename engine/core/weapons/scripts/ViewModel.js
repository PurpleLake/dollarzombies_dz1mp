import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";
import { WeaponAttributes as A } from "../utilities/WeaponAttributes.js";

const AUTO_PLACEHOLDER_MODEL = "/engine/core/weapons/assets/assault/m4a1_model/source/M4A1sss.glb";
const SHOTGUN_PLACEHOLDER_MODEL = "/engine/core/weapons/assets/shotguns/shot_gun.glb";

export class ViewModel {
  constructor({ renderer, camera }){
    this.renderer = renderer;
    this.camera = camera;

    this.group = new THREE.Group();
    this.group.name = "ViewModel";
    this.group.position.set(0.32, -0.28, -0.55);
    this.group.rotation.set(0, Math.PI, 0);

    this.camera.add(this.group);

    this.loader = new GLTFLoader();
    this.current = null;
    this.currentId = null;
    this.recoilT = 0;
    this.reloadT = 0;
    this.fireDuration = 0.08;
    this._basePos = this.group.position.clone();
    this._baseRot = this.group.rotation.clone();

    // fallback simple gun
    this.fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.12, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.2 })
    );
    this.fallback.position.set(0.05, -0.05, 0.0);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.3 })
    );
    barrel.rotation.z = Math.PI/2;
    barrel.position.set(0.18, -0.02, -0.15);
    this.fallback.add(barrel);
  }

  _placeholderFor(def){
    const g = new THREE.Group();
    const attrs = new Set(def?.attributes || []);
    const color = attrs.has(A.Launcher) ? 0x665544
      : attrs.has(A.Sniper) ? 0x2b2f36
      : attrs.has(A.LMG) ? 0x35312b
      : attrs.has(A.Shotgun) ? 0x3a2f2a
      : attrs.has(A.SMG) ? 0x2b3338
      : attrs.has(A.Pistol) ? 0x2d2d2d
      : 0x303235;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 });

    const bodyLen = attrs.has(A.Sniper) ? 0.85 : attrs.has(A.LMG) ? 0.75 : attrs.has(A.Pistol) ? 0.4 : 0.6;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, bodyLen), mat);
    body.position.set(0.08, -0.02, 0);
    g.add(body);

    const barrelLen = attrs.has(A.Sniper) ? 0.7 : attrs.has(A.Shotgun) ? 0.55 : 0.45;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, barrelLen, 12), mat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.14, 0.01, -0.2 - barrelLen * 0.4);
    g.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.12), mat);
    grip.position.set(0.02, -0.12, 0.05);
    grip.rotation.x = -0.3;
    g.add(grip);

    if(attrs.has(A.LMG) || attrs.has(A.SMG) || attrs.has(A.Rifle)){
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.16), mat);
      mag.position.set(0.02, -0.11, -0.08);
      g.add(mag);
    }

    if(attrs.has(A.Launcher)){
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 16), mat);
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0.1, -0.02, -0.1);
      g.add(tube);
    }

    return g;
  }

  clear(){
    while(this.group.children.length) this.group.remove(this.group.children[0]);
    this.current = null;
    this.currentId = null;
  }

  async setWeapon(def){
    const id = def?.id || null;
    if(!id) return;
    if(this.currentId === id) return;
    this.clear();
    this.currentId = id;

    const attrs = new Set(def?.attributes || []);
    const rpm = Number(def?.rpm || 600);
    const cycle = 60 / Math.max(60, rpm);
    this.fireDuration = Math.max(0.04, Math.min(0.12, cycle * 0.9));
    const shotgunModel = attrs.has(A.Shotgun) ? SHOTGUN_PLACEHOLDER_MODEL : null;
    const autoModel = !shotgunModel && attrs.has(A.FullAuto) ? AUTO_PLACEHOLDER_MODEL : null;
    const model = shotgunModel || autoModel || def?.model || def?.modelPath || def?.gunModel || null;
    if(!model){
      this.group.add(this._placeholderFor(def));
      return;
    }

    try{
      const gltf = await new Promise((resolve, reject)=>{
        this.loader.load(model, resolve, undefined, reject);
      });
      const obj = gltf.scene || gltf.scenes?.[0] || gltf;
      obj.traverse?.((n)=>{ if(n.isMesh){ n.castShadow = true; n.receiveShadow = false; } });
      obj.scale.setScalar(def?.viewScale ?? 1.0);
      obj.position.set(def?.viewOffsetX ?? 0, def?.viewOffsetY ?? 0, def?.viewOffsetZ ?? 0);
      obj.rotation.set(def?.viewRotX ?? 0, def?.viewRotY ?? 0, def?.viewRotZ ?? 0);
      this.group.add(obj);
      this.current = obj;
    } catch (e){
      // fallback
      this.group.add(this._placeholderFor(def));
    }
  }

  triggerFire(){
    this.recoilT = this.fireDuration;
  }

  triggerReload(){
    this.reloadT = 0.6;
  }

  // light sway placeholder
  tick(dt, input){
    if(!this.group) return;
    const t = performance.now() * 0.001;
    const swayX = Math.sin(t*2.2)*0.005;
    const swayY = Math.sin(t*1.7)*0.004;

    if(this.recoilT > 0){
      const dur = Math.max(0.01, this.fireDuration);
      this.recoilT = Math.max(0, this.recoilT - dt);
      const k = this.recoilT / dur;
      this.group.position.z = this._basePos.z + (1 - k) * 0.06;
      this.group.rotation.x = this._baseRot.x - (1 - k) * 0.08;
    } else {
      this.group.position.z = this._basePos.z;
      this.group.rotation.x = this._baseRot.x;
    }

    if(this.reloadT > 0){
      this.reloadT = Math.max(0, this.reloadT - dt);
      const k = 1 - (this.reloadT / 0.6);
      this.group.rotation.z = this._baseRot.z + Math.sin(k * Math.PI) * -0.35;
      this.group.position.y = this._basePos.y + Math.sin(k * Math.PI) * -0.08;
    } else {
      this.group.rotation.z = this._baseRot.z;
      this.group.position.y = this._basePos.y;
    }

    this.group.position.x = this._basePos.x + swayX;
    this.group.position.y += swayY;
  }
}
