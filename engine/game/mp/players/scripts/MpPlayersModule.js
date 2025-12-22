import { ViewModel } from "../../../../core/weapons/scripts/ViewModel.js";
import { WeaponController } from "../../../../core/weapons/scripts/WeaponController.js";
import { clamp } from "../../../../core/utilities/Math.js";
import { jitterDirection } from "../../../../core/weapons/utilities/WeaponMath.js";

import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { GLTFLoader } from "https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js";

function degToRad(d){
  return (Number(d || 0) * Math.PI) / 180;
}

export class MpPlayersModule {
  constructor(engine, renderer, input, weapons){
    this.engine = engine;
    this.renderer = renderer;
    this.input = input;
    this.weapons = weapons;

    // Local player uses existing FPS controller from ZM players module? Keep minimal.
    // We'll create a lightweight camera rig for MP, similar to ZM.
    this.cam = renderer.camera;
    this.cam.position.set(0, 1.7, 5);

    this.weaponCtrl = new WeaponController({ events: engine.events, weaponDB: engine.ctx.weapons });
    this.viewModel = new ViewModel({ renderer: engine.ctx.renderer, camera: this.cam });
    this._lastVmWeapon = null;
    this.weaponDef = null;
    this.weapon = null;

    this.engine.ctx.player = this;

    this.vel = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.move = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0;
    this._fireHeld = false;
    this._shootCooldown = 0;
    this._onMouseDown = (e)=>{ if(e.button === 0) this._fireHeld = true; };
    this._onMouseUp = (e)=>{ if(e.button === 0) this._fireHeld = false; };
    window.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);

    // Remote avatars
    this.remotes = new Map();

    this._spawned = false;
    this._dead = false;
    this._respawnAt = 0;
    this._spawnProtectionMs = 0;
    this._frozen = false;
    this._spectateTargetId = null;
    this._killcamEndAt = 0;
    this._weaponInv = null; // id -> mesh group
    this.weaponLoader = new GLTFLoader();
    this.weaponCache = new Map(); // url -> scene
    this.weaponPending = new Map(); // url -> Promise
  }

  _ensureRemote(p){
    if(this.remotes.has(p.id)) return this.remotes.get(p.id);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.1, 4, 8),
      new THREE.MeshStandardMaterial({ color: (p.team===1)?0x3366ff:0xff3344 })
    );
    body.position.y = 1.0;
    g.add(body);

    this.renderer.scene.add(g);
    g.userData._remoteId = String(p.id);
    g.userData._weaponId = null;
    g.userData._weaponObj = null;
    this.remotes.set(p.id, g);
    return g;
  }

  _weaponFallback(){
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.08, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.2 })
    );
    body.position.set(0.12, 1.05, -0.12);
    g.add(body);
    return g;
  }

  async _getWeaponScene(url){
    const key = String(url);
    if(this.weaponCache.has(key)) return this.weaponCache.get(key);
    if(this.weaponPending.has(key)) return this.weaponPending.get(key);
    const p = new Promise((resolve)=> {
      this.weaponLoader.load(key, (gltf)=>{
        const scene = gltf.scene || gltf.scenes?.[0] || null;
        if(scene) this.weaponCache.set(key, scene);
        resolve(scene || null);
      }, undefined, ()=> resolve(null));
    });
    this.weaponPending.set(key, p);
    const res = await p;
    this.weaponPending.delete(key);
    return res;
  }

  async _applyRemoteWeapon(g, weaponId){
    if(!g) return;
    const nextId = weaponId ? String(weaponId) : null;
    if(g.userData._weaponId === nextId) return;
    if(g.userData._weaponObj){
      try { g.remove(g.userData._weaponObj); } catch {}
      g.userData._weaponObj = null;
    }
    g.userData._weaponId = nextId;
    if(!nextId){
      return;
    }

    const def = this.engine.ctx.weapons?.get?.(nextId) || null;
    const modelUrl = def?.model || def?.modelPath || null;
    if(!modelUrl){
      const fallback = this._weaponFallback();
      g.add(fallback);
      g.userData._weaponObj = fallback;
      return;
    }

    const scene = await this._getWeaponScene(modelUrl);
    if(!scene || g.userData._weaponId !== nextId) return;
    const obj = scene.clone(true);
    obj.traverse?.((n)=>{ if(n.isMesh){ n.castShadow = true; n.receiveShadow = false; } });
    obj.scale.setScalar(0.6);
    obj.position.set(0.2, 1.0, -0.1);
    obj.rotation.set(0, Math.PI, 0);
    g.add(obj);
    g.userData._weaponObj = obj;
  }

  _cleanupRemoteIds(activeIds){
    for(const [id, g] of this.remotes){
      if(activeIds.has(id)) continue;
      try { this.renderer.scene.remove(g); } catch {}
            this.remotes.delete(id);
    }
  }

tryShoot(){
  if(this._frozen || this._dead || this._spectateTargetId) return false;
  const def = this.weaponCtrl.weaponDef || this.weaponCtrl.currentDef || this.weaponCtrl.getCurrentDef?.();
  const weapon = this.weaponCtrl.weapon;
  if(!def || !weapon) return false;
  if(this.weaponCtrl.reloading) return false;

  this._shootCooldown = this._shootCooldown ?? 0;
  if(this._shootCooldown > 0) return false;
  if(weapon.clip <= 0){
    this.engine.events.emit("dev:toast", { msg: "Click. Empty clip." });
    this._shootCooldown = 0.2;
    return false;
  }

  const spb = 60 / Math.max(60, def.rpm || 600);
  this._shootCooldown = spb;
  weapon.clip -= 1;
  this.viewModel?.triggerFire?.();
  this.weaponDef = def;
  this.weapon = weapon;

  const net = this.engine.ctx.net;
  this.engine.events.emit("mp:weaponFired", { playerId: net?.clientId, weaponId: def.id, weapon: def });

  // hitscan: ray from camera forward, hit remote capsules
  const origin = this.cam.getWorldPosition(new THREE.Vector3());
  const forward = this.cam.getWorldDirection(new THREE.Vector3()).normalize();
  this.raycaster.far = def.range || 40;

  // build target meshes list
  const targets = [];
  for(const [id, g] of this.remotes){
    targets.push(g);
  }

  const pellets = Math.max(1, Math.floor(def.pellets || 1));
  const spread = Number(def.spreadRad || 0);
  let bestHit = null;
  let totalDamage = 0;

  for(let p = 0; p < pellets; p++){
    const dir = pellets > 1 ? jitterDirection(forward, spread) : forward.clone();
    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects(targets, true);
    if(hits && hits.length){
      const hit = hits[0];
      let obj = hit.object;
      while(obj && !obj.userData._remoteId) obj = obj.parent;
      const rid = obj?.userData?._remoteId;
      if(rid){
        if(!bestHit) bestHit = { rid, dist: hit.distance };
        totalDamage += Math.round(this._damageForDistance(def, hit.distance));
      }
    }
  }

  if(bestHit?.rid && totalDamage > 0 && net?.connected){
    net._send({ t:"hit", targetId: bestHit.rid, amount: totalDamage, weaponId: def.id });
  }

  return true;
}

  tick(dt){
const now = performance.now();
const net = this.engine.ctx.net;
if(this._killcamEndAt && now >= this._killcamEndAt){
  this.stopKillcam();
}
if(this._dead && now >= this._respawnAt){
  this._dead = false;
  this._spawned = false;
}
if(!this._spawned && !this._dead){
  this._spawned = true;
  const team = net?.team ?? 0;
  const map = this.engine.ctx.map || {};
  const spawns = (team===0 ? map.mpSpawnsTeam0 : map.mpSpawnsTeam1) || [];
  const idx = Math.floor(Math.random() * Math.max(1, spawns.length));
  const s = spawns[idx] || { x: 0, y: 1.7, z: 0 };
  this.cam.position.set(s.x, s.y, s.z);

  // Apply active class
  const opts = this.engine.ctx.options;
  const classes = opts.get("mpClasses") || [];
  const active = opts.get("mpActiveClass") || 0;
  const c = classes[active] || classes[0] || { primary:"ar_m4", secondary:"glock_19", name:"Class", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] };
  this._weaponInv = { primary: c.primary, secondary: c.secondary, frag: c.frag, perks: c.perks, name: c.name };

      // Equip and display viewmodel
      this.weaponCtrl.setInventory([c.primary, c.secondary].filter(Boolean));
      this.weaponCtrl.setWeaponByIndex(0);
      const cur = this.weaponCtrl.weaponDef || this.weaponCtrl.currentDef || this.weaponCtrl.getCurrentDef?.();
      if(cur) this.viewModel.setWeapon(cur);
      this.weaponDef = this.weaponCtrl.weaponDef;
      this.weapon = this.weaponCtrl.weapon;

  this.engine.events.emit("mp:playerSpawn", { playerId: net?.clientId, team, class: this._weaponInv });
  this.engine.ctx.notifications?.notify?.({ id: net?.clientId, name: net?.name }, `^4MP^7 Spawned as ^2${this._weaponInv.name}^7`, { bold:false });
  this.engine.ctx.net?.sendPlayerSpawned?.({ playerId: net?.clientId, team, pos: s });
}

    const md = this.input.consumeMouseDelta?.() || { dx:0, dy:0 };
    if(this.input.mouse?.locked && !this._frozen && !this._dead && !this._spectateTargetId){
      this.yaw -= md.dx * (this.input.mouse.sensitivity || 0.0022);
      this.pitch = clamp(this.pitch - md.dy * (this.input.mouse.sensitivity || 0.0022), -1.4, 1.4);
    }
    this.cam.rotation.set(this.pitch, this.yaw, 0, "YXZ");

    // Basic WASD movement
    if(!this._frozen && !this._dead && !this._spectateTargetId){
      const speed = 4.8;
      const fwd = (this.input.isDown?.("KeyW") ? 1 : 0) - (this.input.isDown?.("KeyS") ? 1 : 0);
      const str = (this.input.isDown?.("KeyD") ? 1 : 0) - (this.input.isDown?.("KeyA") ? 1 : 0);

      this.move.set(str, 0, -fwd);
      if(this.move.lengthSq()>0) this.move.normalize();

      const dir = new THREE.Vector3(this.move.x,0,this.move.z);
      dir.applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
      const next = this.cam.position.clone().addScaledVector(dir, speed*dt);
      if(!this._collides(next.x, next.z)){
        this.cam.position.copy(next);
      }
    } else if(this._spectateTargetId){
      if(!this._applyKillcamView(net)) this.stopKillcam();
    }

    this._shootCooldown = Math.max(0, this._shootCooldown - dt);
    if(this.input.isDown?.("KeyR") && !this._frozen && !this._dead && !this._spectateTargetId){
      if(this.weaponCtrl.requestReload()) this.viewModel?.triggerReload?.();
    }
    if(!this._spectateTargetId) this.weaponCtrl.tick(dt);

    if(this._fireHeld && this.input.mouse?.locked && !this._frozen && !this._dead && !this._spectateTargetId){
      this.tryShoot();
    }

    // Networking snapshots
    const pos = { x:this.cam.position.x, y:this.cam.position.y, z:this.cam.position.z };
    const rot = { yaw: this.yaw, pitch: this.pitch };
    if(this.input.isDown?.("Digit1")) this.weaponCtrl.setWeaponByIndex(0);
    if(this.input.isDown?.("Digit2")) this.weaponCtrl.setWeaponByIndex(1);
    const cur = this.weaponCtrl.weaponDef || this.weaponCtrl.currentDef || this.weaponCtrl.getCurrentDef?.();
    if(cur?.id && cur.id !== this._lastVmWeapon){
      this._lastVmWeapon = cur.id;
      this.viewModel.setWeapon(cur);
    }
    this.weaponDef = this.weaponCtrl.weaponDef;
    this.weapon = this.weaponCtrl.weapon;
    this.viewModel.tick(dt, this.input);

    if(!this._spectateTargetId && !this._dead){
      this.engine.ctx.net?.sendLocalSnapshot?.({ pos, rot, hp:100, weaponId: cur?.id ?? null });
    }

    // Update remotes from net state
    // net already resolved above
    const active = new Set();
    if(net?.players){
      for(const p of net.players.values()){
        active.add(p.id);
        if(p.id === net.clientId) continue;
        const g = this._ensureRemote(p);
        if(p.pos){
          g.position.set(p.pos.x||0, (p.pos.y||0)-1.7, p.pos.z||0);
        }
        if(p.weaponId != null){
          this._applyRemoteWeapon(g, p.weaponId);
        }
      }
      this._cleanupRemoteIds(active);
    }
  }

  _damageForDistance(def, dist){
    const r = Math.max(1, def.range);
    const drop = Math.max(0, Math.min(1, Number(def.dropoff || 0))) * 0.6;
    if(dist <= r) return def.damage;
    const minD = def.damage * (1 - drop);
    const extra = Math.min(1, (dist - r) / r);
    return Math.max(minD, def.damage * (1 - extra * drop));
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

  requestRespawn(delayMs=0, spawnProtectionMs=0){
    this._dead = true;
    this._respawnAt = performance.now() + Math.max(0, Number(delayMs || 0));
    this._spawnProtectionMs = Math.max(0, Number(spawnProtectionMs || 0));
    this._fireHeld = false;
    return true;
  }

  setFrozen(frozen=true){
    this._frozen = !!frozen;
    if(this._frozen) this._fireHeld = false;
  }

  startKillcam({ killerId=null, durationMs=4500 } = {}){
    const targetId = killerId != null ? String(killerId) : null;
    if(!targetId) return false;
    this._spectateTargetId = targetId;
    this._killcamEndAt = performance.now() + Math.max(0, Number(durationMs || 0));
    this.setFrozen(true);
    return true;
  }

  stopKillcam(){
    this._spectateTargetId = null;
    this._killcamEndAt = 0;
    this.setFrozen(false);
  }

  _applyKillcamView(net){
    if(!net?.players || !this._spectateTargetId) return false;
    const target = net.players.get(this._spectateTargetId);
    if(!target?.pos) return false;
    const pos = target.pos;
    this.cam.position.set(pos.x || 0, pos.y || 1.7, pos.z || 0);
    if(target.rot){
      this.yaw = Number(target.rot.yaw ?? this.yaw);
      this.pitch = Number(target.rot.pitch ?? this.pitch);
      this.cam.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }
    return true;
  }

  dispose(){
    window.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);
  }

}
