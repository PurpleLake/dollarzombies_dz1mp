import { ViewModel } from "../../../../core/weapons/scripts/ViewModel.js";
import { WeaponController } from "../../../../core/weapons/scripts/WeaponController.js";

import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export class MpPlayersModule {
  constructor(engine, renderer, input, weapons){
    this.engine = engine;
    this.renderer = renderer;
    this.input = input;
    this.weapons = weapons;

    this.weaponCtrl = new WeaponController(engine.ctx.weapons);
    this.viewModel = new ViewModel({ renderer: engine.ctx.renderer, camera: this.cam });
    this._lastVmWeapon = null;


    // Local player uses existing FPS controller from ZM players module? Keep minimal.
    // We'll create a lightweight camera rig for MP, similar to ZM.
    this.cam = renderer.camera;
    this.cam.position.set(0, 1.7, 5);

    this.vel = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.move = new THREE.Vector3();

    // Remote avatars
    this.remotes = new Map();

    this._spawned = false;
    this._weaponInv = null; // id -> mesh group
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
    this.remotes.set(p.id, g);
    return g;
  }

  _cleanupRemoteIds(activeIds){
    for(const [id, g] of this.remotes){
      if(activeIds.has(id)) continue;
      try { this.renderer.scene.remove(g); } catch {}
            this.remotes.delete(id);
    }
  }

  tick(dt){

if(!this._spawned){
  this._spawned = true;
  const net = this.engine.ctx.net;
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
  const c = classes[active] || classes[0] || { primary:"ar_m4", secondary:"glock_19", name:"Class" };
  this._weaponInv = { primary: c.primary, secondary: c.secondary, name: c.name };

      // Equip and display viewmodel
      this.weaponCtrl.setInventory([c.primary, c.secondary].filter(Boolean));
      this.weaponCtrl.setWeaponByIndex(0);
      const cur = this.weaponCtrl.currentDef || this.weaponCtrl.getCurrentDef?.();
      if(cur) this.viewModel.setWeapon(cur);


  this.engine.events.emit("mp:playerSpawn", { playerId: net?.clientId, team, class: this._weaponInv });
  this.engine.ctx.notifications?.notify?.({ id: net?.clientId, name: net?.name }, `^4MP^7 Spawned as ^2${this._weaponInv.name}^7`, { bold:false });
}

    // Basic WASD fly/ground movement (placeholder, proper MP movement later)
    const speed = 4.8;
    const fwd = (this.input.keys["KeyW"]?1:0) - (this.input.keys["KeyS"]?1:0);
    const str = (this.input.keys["KeyD"]?1:0) - (this.input.keys["KeyA"]?1:0);

    this.move.set(str, 0, -fwd);
    if(this.move.lengthSq()>0) this.move.normalize();

    // Rotate by mouse
    const yaw = this.input.mouse.yaw;
    const pitch = this.input.mouse.pitch;
    this.cam.rotation.set(pitch, yaw, 0, "YXZ");

    // Move in camera space
    const dir = new THREE.Vector3(this.move.x,0,this.move.z);
    dir.applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    this.cam.position.addScaledVector(dir, speed*dt);

    this._shootCooldown = Math.max(0, this._shootCooldown - dt);
    if(this.input.mouse?.left || this.input.mouse?.buttons?.[0]){
      this.tryShoot();
    }

    // Networking snapshots
    const pos = { x:this.cam.position.x, y:this.cam.position.y, z:this.cam.position.z };
    const rot = { yaw, pitch };
    if(this.input.keys["Digit1"]) this.weaponCtrl.setWeaponByIndex(0);
    if(this.input.keys["Digit2"]) this.weaponCtrl.setWeaponByIndex(1);
    const cur = this.weaponCtrl.currentDef || this.weaponCtrl.getCurrentDef?.();
    if(cur?.id && cur.id !== this._lastVmWeapon){
      this._lastVmWeapon = cur.id;
      this.viewModel.setWeapon(cur);
    }
    this.viewModel.tick(dt, this.input);

    this.engine.ctx.net?.sendLocalSnapshot?.({ pos, rot, hp:100, weaponId: cur?.id ?? null });

    // Update remotes from net state
    const net = this.engine.ctx.net;
    const active = new Set();
    if(net?.players){
      for(const p of net.players.values()){
        active.add(p.id);
        if(p.id === net.clientId) continue;
        const g = this._ensureRemote(p);
        if(p.pos){
          g.position.set(p.pos.x||0, (p.pos.y||0)-1.7, p.pos.z||0);
        }
      }
      this._cleanupRemoteIds(active);
    }
  }

tryShoot(){
  const def = this.weaponCtrl.currentDef || this.weaponCtrl.getCurrentDef?.();
  if(!def) return false;

  this._shootCooldown = this._shootCooldown ?? 0;
  if(this._shootCooldown > 0) return false;
  const spb = 60 / Math.max(60, def.rpm || 600);
  this._shootCooldown = spb;

  const net = this.engine.ctx.net;
  this.engine.events.emit("mp:weaponFired", { playerId: net?.clientId, weaponId: def.id, weapon: def });

  // hitscan: ray from camera forward, hit remote capsules
  const origin = this.cam.getWorldPosition(new THREE.Vector3());
  const dir = this.cam.getWorldDirection(new THREE.Vector3()).normalize();
  this.raycaster.set(origin, dir);
  this.raycaster.far = def.range || 40;

  // build target meshes list
  const targets = [];
  for(const [id, g] of this.remotes){
    targets.push(g);
  }
  const hits = this.raycaster.intersectObjects(targets, true);
  if(hits && hits.length){
    // walk up to find remote group root
    let obj = hits[0].object;
    while(obj && !obj.userData._remoteId) obj = obj.parent;
    const rid = obj?.userData?._remoteId;
    if(rid && net?.connected){
      const dmg = Math.round(def.damage ?? def.dmg ?? 25);
      net._send({ t:"hit", targetId: rid, amount: dmg });
    }
  }

  return true;
}

}
