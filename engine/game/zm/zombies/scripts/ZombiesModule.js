import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "https://unpkg.com/three@0.161.0/examples/jsm/utils/SkeletonUtils.js";

function degToRad(d){
  return (Number(d || 0) * Math.PI) / 180;
}

export class ZombiesModule {
  constructor({ engine, renderer }){
    this.engine = engine;
    this.r = renderer;
    this.THREE = THREE;
    this.loader = new GLTFLoader();
    this.zombieModel = null;
    this.zombieAnims = [];
    this._loadingModel = null;

    this.spawns = [];
    this.zombies = new Map(); // id -> {mesh,hp,speed,mixer,actions,hitboxes}
    this._nextId = 1;

    this.engine.ctx.zombies = this;
    this._loadZombieModel();
  }

  async _loadZombieModel(){
    if(this._loadingModel) return this._loadingModel;
    const path = "/engine/game/zm/zombies/assets/zm_models/zombie_warrior.glb";
    this._loadingModel = new Promise((resolve)=> {
      this.loader.load(path, (gltf)=>{
        this.zombieModel = gltf.scene || gltf.scenes?.[0] || null;
        this.zombieAnims = gltf.animations || [];
        resolve(true);
      }, undefined, ()=>{
        this.zombieModel = null;
        this.zombieAnims = [];
        resolve(false);
      });
    });
    return this._loadingModel;
  }

  clear(){
    for(const z of this.zombies.values()){
      this.r.scene.remove(z.mesh);
      z.mesh.geometry?.dispose?.();
      z.mesh.material?.dispose?.();
    }
    this.zombies.clear();
  }

  addSpawn(x, z){
    this.spawns.push({ x, z });
  }

  aliveCount(){ return this.zombies.size; }

  spawnOne(){
    if(this.spawns.length === 0){
      // fallback spawn ring
      const a = Math.random()*Math.PI*2;
      const r = 18;
      this.spawns.push({ x: Math.cos(a)*r, z: Math.sin(a)*r });
    }

    const sp = this.spawns[Math.floor(Math.random()*this.spawns.length)];
    const id = this._nextId++;
    const key = String(id);

    let mesh = null;
    let mixer = null;
    let actions = null;
    let hitboxes = null;
    if(this.zombieModel){
      mesh = cloneSkinned(this.zombieModel);
      mesh.traverse?.((n)=>{
        if(n.isMesh){
          n.castShadow = true;
          n.receiveShadow = true;
          n.userData.entityId = key;
          if(n.material){
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            for(const m of mats){
              if(m.color) m.color.setHex(0x5f8f62);
              if(m.emissive) m.emissive.setHex(0x132816);
            }
          }
        }
      });
      mesh.position.set(sp.x, 0, sp.z);
      mesh.scale.setScalar(1.2);
      mesh.userData.entityId = key;
      if(this.zombieAnims.length){
        mixer = new THREE.AnimationMixer(mesh);
        actions = this._buildActions(mixer, this.zombieAnims);
      }
      hitboxes = this._makeHitboxes(mesh, key);
    } else {
      const geo = new THREE.CapsuleGeometry(0.35, 1.0, 6, 10);
      const mat = new THREE.MeshStandardMaterial({ color: 0x5aa06a, roughness: 0.9, metalness: 0.0, emissive: 0x132816 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sp.x, 1.05, sp.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.entityId = key;
    }

    this.r.scene.add(mesh);
    if(hitboxes){
      for(const h of hitboxes) this.r.scene.add(h);
    }
    this.zombies.set(key, { mesh, mixer, actions, hitboxes, hp: 100, speed: 1.35, attackCooldown: 0 });

    this.engine.events.emit("zm:zombieSpawn", { id: key });
    this.engine.events.emit("zm:alive", { alive: this.zombies.size });
  }

  damage(id, amount, player=null){
    const key = String(id);
    const z = this.zombies.get(key);
    if(!z) return;
    z.hp -= amount;
    this.engine.events.emit("zm:zombieDamaged", { id, amount, player });
    if(z.hp <= 0){
      this.r.scene.remove(z.mesh);
      z.mesh.geometry?.dispose?.();
      z.mesh.material?.dispose?.();
      this.zombies.delete(key);
      this.engine.events.emit("zm:zombieDeath", { id, player });
      this.engine.events.emit("zm:alive", { alive: this.zombies.size });
    }
  }

  raycast(raycaster){
    // naive: intersect zombie meshes
    const targets = [];
    for(const z of this.zombies.values()){
      if(z.hitboxes?.length){
        targets.push(...z.hitboxes);
        continue;
      }
      if(z.mesh){
        z.mesh.traverse?.((n)=>{ if(n.isMesh) targets.push(n); });
      }
    }
    const hits = raycaster.intersectObjects(targets, false);
    if(!hits.length) return null;
    let mesh = hits[0].object;
    while(mesh && mesh.userData?.entityId == null) mesh = mesh.parent;
    const entityId = mesh?.userData?.entityId;
    return { entityId, point: hits[0].point, distance: hits[0].distance };
  }

  _collides(x, z, radius=0.35){
    const cols = this.engine?.ctx?.map?.colliders || [];
    for(const c of cols){
      const type = String(c.type || "box");
      if(type === "sphere"){
        const dx = x - Number(c.x || 0);
        const dz = z - Number(c.z || 0);
        const r = Number(c.r || 0.5) + radius;
        if((dx*dx + dz*dz) <= r*r) return true;
      } else if(type === "cylinder"){
        const dx = x - Number(c.x || 0);
        const dz = z - Number(c.z || 0);
        const r = Number(c.rTop || c.rBottom || 0.5) + radius;
        if((dx*dx + dz*dz) <= r*r) return true;
      } else {
        const rot = degToRad(c.rot || 0);
        const dx = x - Number(c.x || 0);
        const dz = z - Number(c.z || 0);
        const cos = Math.cos(-rot);
        const sin = Math.sin(-rot);
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;
        const halfX = Math.abs(Number(c.sx || 1)) / 2;
        const halfZ = Math.abs(Number(c.sz || 1)) / 2;
        if(Math.abs(rx) <= halfX + radius && Math.abs(rz) <= halfZ + radius) return true;
      }
    }
    return false;
  }

  tick(dt, ecs, ctx){
    const player = ctx.game?.players;
    if(!player) return;

    const ppos = new THREE.Vector3();
    player.r.camera.getWorldPosition(ppos);

    for(const [id, z] of this.zombies){
      const m = z.mesh;
      if(z.mixer) z.mixer.update(dt);
      if(z.hitboxes?.length){
        for(const h of z.hitboxes){
          const off = h.userData.offset || { x:0, y:0, z:0 };
          h.position.set(m.position.x + off.x, m.position.y + off.y, m.position.z + off.z);
        }
      }
      if(z.attackCooldown > 0) z.attackCooldown = Math.max(0, z.attackCooldown - dt);

      // move toward player (XZ)
      const dx = ppos.x - m.position.x;
      const dz = ppos.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      if(dist > 0.001){
        const vx = dx / dist;
        const vz = dz / dist;
        const move = this._steer({ x: vx, z: vz }, m.position, z.speed * dt, 0.35);
        if(move){
          m.position.x += move.x;
          m.position.z += move.z;
          m.rotation.y = Math.atan2(move.x, move.z); // face move dir
        }
      }

      // melee damage if close
      if(dist < 1.15){
        // cheap tick-based damage
        player.damage(10 * dt);
        this.engine.events.emit("zm:playerDamaged", { player, amount: 10*dt, hp: player.hp });
        if(z.actions?.attack && z.attackCooldown <= 0){
          z.attackCooldown = 1.2;
          z.actions.attack.reset();
          z.actions.attack.play();
          if(z.actions.walk) z.actions.walk.fadeOut(0.1);
          z.actions.attack.clampWhenFinished = true;
          z.actions.attack.setLoop(THREE.LoopOnce, 1);
          if(!z.actions._onFinish){
            z.actions._onFinish = (e)=>{
              if(e.action === z.actions.attack && z.actions.walk){
                z.actions.walk.reset().fadeIn(0.1).play();
              }
            };
            z.mixer.addEventListener("finished", z.actions._onFinish);
          }
        }
      }
    }

    // simple separation so zombies don't stack
    const list = Array.from(this.zombies.values());
    const minDist = 0.7;
    for(let i=0;i<list.length;i++){
      for(let j=i+1;j<list.length;j++){
        const a = list[i].mesh;
        const b = list[j].mesh;
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const d2 = dx*dx + dz*dz;
        if(d2 <= 0) continue;
        const d = Math.sqrt(d2);
        if(d < minDist){
          const push = (minDist - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          const ax = a.position.x + nx * push;
          const az = a.position.z + nz * push;
          const bx = b.position.x - nx * push;
          const bz = b.position.z - nz * push;
          if(!this._collides(ax, az, 0.35)){
            a.position.x = ax;
            a.position.z = az;
          }
          if(!this._collides(bx, bz, 0.35)){
            b.position.x = bx;
            b.position.z = bz;
          }
        }
      }
    }
  }

  _steer(dir, pos, step, radius){
    const base = { x: dir.x * step, z: dir.z * step };
    const tryVec = (vx, vz)=>{
      const nx = pos.x + vx;
      const nz = pos.z + vz;
      return this._collides(nx, nz, radius) ? null : { x: vx, z: vz };
    };
    let ok = tryVec(base.x, base.z);
    if(ok) return ok;
    const angles = [20, -20, 40, -40, 60, -60, 90, -90];
    for(const a of angles){
      const r = degToRad(a);
      const rx = dir.x * Math.cos(r) - dir.z * Math.sin(r);
      const rz = dir.x * Math.sin(r) + dir.z * Math.cos(r);
      ok = tryVec(rx * step, rz * step);
      if(ok) return ok;
    }
    return null;
  }

  _buildActions(mixer, clips){
    const actions = {};
    const pick = (keys)=> clips.find(c=> keys.some(k=> c.name.toLowerCase().includes(k)));
    const walkClip = pick(["walk", "run", "move"]) || clips[0];
    const attackClip = pick(["attack", "melee", "hit", "bite"]);
    if(walkClip){
      actions.walk = mixer.clipAction(walkClip);
      actions.walk.play();
    }
    if(attackClip){
      actions.attack = mixer.clipAction(attackClip);
    }
    return actions;
  }

  _makeHitboxes(mesh, id){
    try{
      mesh.updateWorldMatrix?.(true, true);
      const box = new THREE.Box3();
      mesh.traverse?.((n)=>{ if(n.isMesh) box.expandByObject(n); });
      const size = new THREE.Vector3();
      box.getSize(size);
      if(!Number.isFinite(size.x) || size.length() === 0) return null;
      const geo = new THREE.BoxGeometry(size.x * 0.6, size.y * 0.7, size.z * 0.6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.0 });
      const hit = new THREE.Mesh(geo, mat);
      const center = new THREE.Vector3();
      box.getCenter(center);
      hit.position.copy(center);
      hit.userData.entityId = id;
      hit.userData.isHitbox = true;
      hit.userData.offset = {
        x: center.x - mesh.position.x,
        y: center.y - mesh.position.y,
        z: center.z - mesh.position.z,
      };
      return [hit];
    } catch {
      return null;
    }
  }
}
