import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

export class ModelSpawner {
  constructor({ renderer, entities, events }){
    this.r = renderer;
    this.entities = entities;
    this.events = events;
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async spawnModel({ kind="box", url="", id=null, name="", x=0,y=0,z=0, rx=0,ry=0,rz=0, sx=1,sy=1,sz=1, meta={} } = {}){
    if(this.entities?.spawnEntity){
      const type = (kind === "gltf") ? "model" : kind;
      const scale = Number(sx || 1);
      const ent = await this.entities.spawnEntity(type, { x, y, z }, {
        id,
        model: url,
        scale,
        tag: meta?.tag,
        health: meta?.health,
        meta,
      });
      if(this.entities?.setAngles && (rx || ry || rz)){
        this.entities.setAngles(ent, { x: rx, y: ry, z: rz });
      }
      return ent?.id ?? null;
    }

    let obj = null;

    if(kind === "box"){
      obj = new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({ color: 0x6b7cff, roughness: 0.7, metalness: 0.05 })
      );
      obj.castShadow = true; obj.receiveShadow = true;
    } else if(kind === "sphere"){
      obj = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xffb450, roughness: 0.6, metalness: 0.1 })
      );
      obj.castShadow = true; obj.receiveShadow = true;
    } else if(kind === "gltf"){
      const scene = await this._loadGltf(url);
      obj = scene.clone(true);
    } else {
      obj = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color: 0xaa3355 }));
    }

    const ent = this.entities.spawn({
      id,
      type: "model",
      name: name || (kind === "gltf" ? (String(url).split("/").pop()||"gltf") : kind),
      object: obj,
      position: {x,y,z},
      rotation: {x:rx,y:ry,z:rz},
      scale: {x:sx,y:sy,z:sz},
      meta: { kind, url, ...meta },
    });

    return ent.id;
  }

  async _loadGltf(url){
    const key = String(url);
    if(this.cache.has(key)) return this.cache.get(key);
    this.events?.emit?.("log", { msg: `[models] load gltf: ${key}` });
    const gltf = await new Promise((resolve, reject)=> this.loader.load(key, resolve, undefined, reject));
    const scene = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if(!scene) throw new Error("GLTF has no scene");
    this.cache.set(key, scene);
    return scene;
  }
}
