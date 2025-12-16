import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export class EntityRegistry {
  constructor({ scene, events }){
    this.scene = scene;
    this.events = events;
    this.map = new Map();
    this._next = 1;
  }
  _id(prefix="ent"){ return `${prefix}_${this._next++}`; }

  spawn({ id=null, type="model", name="", object=null, position={x:0,y:0,z:0}, rotation={x:0,y:0,z:0}, scale={x:1,y:1,z:1}, meta={} } = {}){
    const entId = String(id || this._id(type));
    const origin = new THREE.Object3D();
    origin.position.set(Number(position.x||0), Number(position.y||0), Number(position.z||0));
    origin.rotation.set(Number(rotation.x||0), Number(rotation.y||0), Number(rotation.z||0));
    origin.scale.set(Number(scale.x||1), Number(scale.y||1), Number(scale.z||1));
    if(object) origin.add(object);
    this.scene.add(origin);

    const ent = { id: entId, type, name: String(name || entId), origin, object, meta: meta||{}, createdAt: performance.now() };
    this.map.set(entId, ent);
    this.events?.emit?.("ent:spawn", { id: entId, type, name: ent.name });
    return ent;
  }

  delete(id){
    const ent = this.map.get(String(id));
    if(!ent) return false;
    try { ent.origin.removeFromParent(); } catch {}
    this.map.delete(String(id));
    this.events?.emit?.("ent:delete", { id: String(id) });
    return true;
  }

  get(id){ return this.map.get(String(id)); }
  all(){ return Array.from(this.map.values()); }
}
