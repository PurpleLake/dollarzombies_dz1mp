import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

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

    const model = def?.model || def?.modelPath || def?.gunModel || null;
    if(!model){
      this.group.add(this.fallback.clone());
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
      this.group.add(this.fallback.clone());
    }
  }

  // light sway placeholder
  tick(dt, input){
    if(!this.group) return;
    const t = performance.now() * 0.001;
    this.group.position.x = 0.32 + Math.sin(t*2.2)*0.005;
    this.group.position.y = -0.28 + Math.sin(t*1.7)*0.004;
  }
}
