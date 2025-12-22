import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

function dist(a,b){
  const dx = a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
  return Math.sqrt(dx*dx+dy*dy+dz*dz);
}

export class EntityRegistry {
  constructor(engine){
    this.engine = engine;
    this.entities = new Map(); // id -> ent
    this._seq = 1;
    this.loader = new GLTFLoader();
  }

  clear(){
    for(const ent of this.entities.values()){
      try{ this.engine.ctx.renderer?.scene?.remove(ent.object3d); } catch {}
    }
    this.entities.clear();
  }

  async spawnEntity(type, origin, opts={}){
    const id = String(opts.id || (this._seq++));
    const tag = opts.tag ? String(opts.tag) : null;
    const health = (opts.health == null) ? 100 : Number(opts.health);
    const scene = this.engine.ctx.renderer?.scene;

    const ent = {
      id, type: String(type||"entity"), tag,
      health,
      object3d: null,
    };

    const t = String(type||"box");
    let obj = null;

    if(t === "box"){
      obj = new THREE.Mesh(
        new THREE.BoxGeometry(opts.sx||1, opts.sy||1, opts.sz||1),
        new THREE.MeshStandardMaterial({ color: opts.color ?? 0x6b7280, roughness: 0.85 })
      );
    } else if(t === "sphere"){
      obj = new THREE.Mesh(
        new THREE.SphereGeometry(opts.r||0.6, 16, 12),
        new THREE.MeshStandardMaterial({ color: opts.color ?? 0x9ca3af, roughness: 0.8 })
      );
    } else if(t === "cylinder"){
      obj = new THREE.Mesh(
        new THREE.CylinderGeometry(opts.rTop||0.5, opts.rBottom||0.5, opts.h||1.2, 14),
        new THREE.MeshStandardMaterial({ color: opts.color ?? 0x8b5cf6, roughness: 0.75 })
      );
    } else if(t === "model"){
      const model = opts.model || opts.path || opts.url;
      if(model){
        try{
          const gltf = await new Promise((resolve, reject)=> this.loader.load(String(model), resolve, undefined, reject));
          obj = gltf.scene || gltf.scenes?.[0] || null;
        } catch {
          obj = new THREE.Mesh(
            new THREE.BoxGeometry(1,1,1),
            new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.9 })
          );
        }
      } else {
        obj = new THREE.Mesh(
          new THREE.BoxGeometry(1,1,1),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.9 })
        );
      }
    } else {
      obj = new THREE.Mesh(
        new THREE.BoxGeometry(1,1,1),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 })
      );
    }

    if(obj){
      obj.position.set(origin.x, origin.y, origin.z);
      obj.userData.entId = id;
      ent.object3d = obj;
      if(opts.scale != null){
        const s = Number(opts.scale);
        if(Number.isFinite(s)) obj.scale.setScalar(s);
      }
      if(opts.visible === false) obj.visible = false;
      scene?.add(obj);
    }

    this.entities.set(id, ent);
    this.engine.events.emit("entity:spawn", { ent });
    return ent;
  }

  getById(id){
    return this.entities.get(String(id)) || null;
  }

  deleteEntity(entOrId){
    const id = String(entOrId?.id ?? entOrId);
    const ent = this.entities.get(id);
    if(!ent) return false;
    try{ this.engine.ctx.renderer?.scene?.remove(ent.object3d); } catch {}
    this.entities.delete(id);
    this.engine.events.emit("entity:delete", { ent });
    return true;
  }

  getAll(){
    return Array.from(this.entities.values());
  }

  getByTag(tag){
    const t = String(tag||"");
    return this.getAll().filter(e=>e.tag === t);
  }

  inRadius(origin, r){
    return this.getAll().filter(e=>{
      const p = e.object3d?.position;
      if(!p) return false;
      return dist(p, origin) <= r;
    });
  }

  setPos(entOrId, pos){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e?.object3d) return false;
    e.object3d.position.set(pos.x, pos.y, pos.z);
    return true;
  }

  getPos(entOrId){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e?.object3d) return null;
    const p = e.object3d.position;
    return { x:p.x, y:p.y, z:p.z };
  }

  setAngles(entOrId, ang){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e?.object3d) return false;
    e.object3d.rotation.set(ang.x||0, ang.y||0, ang.z||0);
    return true;
  }

  getAngles(entOrId){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e?.object3d) return null;
    const r = e.object3d.rotation;
    return { x:r.x, y:r.y, z:r.z };
  }

  setHealth(entOrId, hp){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e) return false;
    e.health = Number(hp);
    return true;
  }

  damage(entOrId, amount, source=null){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e) return false;
    const a = Number(amount||0);
    e.health = Math.max(0, e.health - a);
    this.engine.events.emit("entity:damaged", { ent:e, amount:a, source });
    if(e.health <= 0){
      this.engine.events.emit("entity:death", { ent:e, source });
    }
    return true;
  }

  setTag(entOrId, tag){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e) return false;
    e.tag = String(tag);
    return true;
  }

  setVisible(entOrId, visible){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e?.object3d) return false;
    e.object3d.visible = !!visible;
    return true;
  }

  setScale(entOrId, s){
    const e = this.getById(entOrId?.id ?? entOrId);
    if(!e?.object3d) return false;
    const v = Number(s);
    if(!Number.isFinite(v)) return false;
    e.object3d.scale.setScalar(v);
    return true;
  }

  attach(childEntOrId, parentEntOrId, offset={x:0,y:0,z:0}){
    const c = this.getById(childEntOrId?.id ?? childEntOrId);
    const p = this.getById(parentEntOrId?.id ?? parentEntOrId);
    if(!c?.object3d || !p?.object3d) return false;
    p.object3d.add(c.object3d);
    c.object3d.position.set(offset.x||0, offset.y||0, offset.z||0);
    return true;
  }

  raycast(origin, dir, maxDist=50){
    const o = new THREE.Vector3(origin.x, origin.y, origin.z);
    const d = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const rc = new THREE.Raycaster(o, d, 0, Number(maxDist||50));
    const objs = [];
    for(const e of this.entities.values()){
      if(e.object3d) objs.push(e.object3d);
    }
    const hits = rc.intersectObjects(objs, true);
    if(!hits?.length) return null;
    let obj = hits[0].object;
    while(obj && !obj.userData?.entId) obj = obj.parent;
    return {
      entId: obj?.userData?.entId || null,
      dist: hits[0].distance,
      point: { x:hits[0].point.x, y:hits[0].point.y, z:hits[0].point.z }
    };
  }
}
