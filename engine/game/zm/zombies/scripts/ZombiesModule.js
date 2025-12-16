import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export class ZombiesModule {
  constructor({ engine, renderer }){
    this.engine = engine;
    this.r = renderer;
    this.THREE = THREE;

    this.spawns = [];
    this.zombies = new Map(); // id -> {mesh,hp,speed}
    this._nextId = 1;

    this.engine.ctx.zombies = this;
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

    const geo = new THREE.CapsuleGeometry(0.35, 1.0, 6, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5aa06a, roughness: 0.9, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sp.x, 1.05, sp.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.entityId = id;

    this.r.scene.add(mesh);
    this.zombies.set(id, { mesh, hp: 100, speed: 1.35 });

    this.engine.events.emit("zm:zombieSpawn", { id });
    this.engine.events.emit("zm:alive", { alive: this.zombies.size });
  }

  damage(id, amount, player=null){
    const z = this.zombies.get(id);
    if(!z) return;
    z.hp -= amount;
    this.engine.events.emit("zm:zombieDamaged", { id, amount, player });
    if(z.hp <= 0){
      this.r.scene.remove(z.mesh);
      z.mesh.geometry?.dispose?.();
      z.mesh.material?.dispose?.();
      this.zombies.delete(id);
      this.engine.events.emit("zm:zombieDeath", { id, player });
      this.engine.events.emit("zm:alive", { alive: this.zombies.size });
    }
  }

  raycast(raycaster){
    // naive: intersect zombie meshes
    const meshes = [];
    for(const z of this.zombies.values()) meshes.push(z.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if(!hits.length) return null;
    const mesh = hits[0].object;
    const entityId = mesh.userData.entityId;
    return { entityId, point: hits[0].point, distance: hits[0].distance };
  }

  tick(dt, ecs, ctx){
    const player = ctx.game?.players;
    if(!player) return;

    const ppos = new THREE.Vector3();
    player.r.camera.getWorldPosition(ppos);

    for(const [id, z] of this.zombies){
      const m = z.mesh;

      // move toward player (XZ)
      const dx = ppos.x - m.position.x;
      const dz = ppos.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      if(dist > 0.001){
        const vx = dx / dist;
        const vz = dz / dist;
        m.position.x += vx * z.speed * dt;
        m.position.z += vz * z.speed * dt;
        m.rotation.y = Math.atan2(vx, vz); // face player
      }

      // melee damage if close
      if(dist < 1.15){
        // cheap tick-based damage
        player.damage(10 * dt);
        this.engine.events.emit("zm:playerDamaged", { player, amount: 10*dt, hp: player.hp });
      }
    }
  }
}