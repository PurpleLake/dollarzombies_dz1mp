import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { WeaponController } from "../../../../core/weapons/scripts/WeaponController.js";
import { ViewModel } from "../../../../core/weapons/scripts/ViewModel.js";
import { jitterDirection } from "../../../../core/weapons/utilities/WeaponMath.js";

function degToRad(d){
  return (Number(d || 0) * Math.PI) / 180;
}

export class PlayersModule {
  constructor({ engine, renderer, input }){
    this.engine = engine;
    this.r = renderer;
    this.input = input;

    this.spawn = { x: 0, z: 10 };
    this.speed = 5.2;
    this.sprintMul = 1.55;

    this.yaw = 0;
    this.pitch = 0;

    this.hp = 100;
    this._shootCooldown = 0;
    this._lastVmWeapon = null;
    this.damageScale = 2.5;

    // camera rig for FPS look
    this.camPivot = new THREE.Object3D();
    this.camPivot.position.set(this.spawn.x, 1.65, this.spawn.z);
    this.r.scene.add(this.camPivot);

    this.camPitch = new THREE.Object3D();
    this.camPivot.add(this.camPitch);

    // attach camera
    this.camPitch.add(this.r.camera);
    this.r.camera.position.set(0, 0, 0);

    // raycaster for hitscan
    this.ray = new THREE.Raycaster();

    // weapons
    const db = engine.ctx.weapons;
    this.weaponCtl = new WeaponController({ events: engine.events, weaponDB: db });

    // starter inventory from zombies class selection
    const opts = engine.ctx.options;
    const classes = opts?.get("zmClasses") || [];
    const active = opts?.get("zmActiveClass") || 0;
    const c = classes[active] || classes[0] || { primary:"ar_m4", secondary:"glock_19", name:"Class" };
    const inv = [c.primary, c.secondary].filter(Boolean);
    this.weaponCtl.setInventory(inv.length ? inv : ["glock_19","ar_m4"]);
    this.weaponCtl.setWeaponByIndex(0);
    this.weaponDef = this.weaponCtl.weaponDef;
    this.weapon = this.weaponCtl.weapon;
    this.viewModel = new ViewModel({ renderer: this.r, camera: this.r.camera });
    this._lastVmWeapon = null;
    if(this.weaponDef) this.viewModel.setWeapon(this.weaponDef);

    // mouse wheel weapon cycling
    this._onWheel = (e)=>{
      if(!this.input.mouse.locked) return;
      if(e.deltaY > 0) this.weaponCtl.next();
      else this.weaponCtl.prev();
      this.weaponDef = this.weaponCtl.weaponDef;
      this.weapon = this.weaponCtl.weapon;
      if(this.weaponDef?.id && this.weaponDef.id !== this._lastVmWeapon){
        this._lastVmWeapon = this.weaponDef.id;
        this.viewModel?.setWeapon?.(this.weaponDef);
      }
    };
    window.addEventListener("wheel", this._onWheel, { passive:true });

    // expose for other systems + UI
    this.engine.ctx.player = this;
    this.engine.events.emit("player:hp", { hp: this.hp });
    // initial state broadcast: no damage yet
    this.engine.events.emit("zm:playerDamaged", { player: this, amount: 0, hp: this.hp });
  }

  setSpawn(x, z){
    this.spawn.x = x;
    this.spawn.z = z;
    this.camPivot.position.set(x, 1.65, z);
  }

  damage(amount){
    this.hp = Math.max(0, this.hp - amount);
    this.engine.events.emit("player:hp", { hp: this.hp });
    this.engine.events.emit("zm:playerDamaged", { player: this, amount, hp: this.hp });
    if(this.hp <= 0){
      this.engine.events.emit("player:death", {});
      this.engine.events.emit("zm:playerDeath", { player: this });
      this.engine.events.emit("dev:toast", { msg: "You died. Refresh to restart." });
    }
  }

  tick(dt, ecs, ctx){
    if(Array.isArray(this.engine.ctx.players) && this.engine.ctx.players[0]){
      this.engine.ctx.players[0].health = this.hp;
      this.engine.ctx.players[0].weapon = this.weaponDef;
      this.engine.ctx.players[0].position = this.camPivot?.position;
    }

    // look
    const md = this.input.consumeMouseDelta();
    if(this.input.mouse.locked){
      this.yaw -= md.dx * this.input.mouse.sensitivity;
      this.pitch -= md.dy * this.input.mouse.sensitivity;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    }
    this.camPivot.rotation.y = this.yaw;
    this.camPitch.rotation.x = this.pitch;

    // weapon switching based on class inventory
    if(this.input.isDown("Digit1")) this.weaponCtl.setWeaponByIndex(0);
    if(this.input.isDown("Digit2")) this.weaponCtl.setWeaponByIndex(1);
    this.weaponDef = this.weaponCtl.weaponDef;
    this.weapon = this.weaponCtl.weapon;
    if(this.weaponDef?.id && this.weaponDef.id !== this._lastVmWeapon){
      this._lastVmWeapon = this.weaponDef.id;
      this.viewModel?.setWeapon?.(this.weaponDef);
    }

    // reload
    if(this.input.isDown("KeyR")){
      if(this.weaponCtl.requestReload()) this.viewModel?.triggerReload?.();
    }
    this.weaponCtl.tick(dt);

    // movement
    const forward = (this.input.isDown("KeyW") ? 1 : 0) + (this.input.isDown("KeyS") ? -1 : 0);
    const strafe  = (this.input.isDown("KeyD") ? 1 : 0) + (this.input.isDown("KeyA") ? -1 : 0);
    const sprint = this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight");

    const dir = new THREE.Vector3(strafe, 0, -forward);
    if(dir.lengthSq() > 0){
      dir.normalize();
      dir.applyAxisAngle(new THREE.Vector3(0,1,0), this.yaw);
      const sp = this.speed * (sprint ? this.sprintMul : 1);
      const next = this.camPivot.position.clone().addScaledVector(dir, sp * dt);
      if(!this._collides(next.x, next.z)){
        this.camPivot.position.copy(next);
      }
    }

    // cooldown
    this._shootCooldown = Math.max(0, this._shootCooldown - dt);
    this.viewModel?.tick?.(dt, this.input);
  }

  tryShoot(){
    if(!this.weaponDef || !this.weapon) return false;
    if(this.weaponCtl.reloading) return false;

    if(this._shootCooldown > 0) return false;
    if(this.weapon.clip <= 0){
      this.engine.events.emit("dev:toast", { msg: "Click. Empty clip." });
      this._shootCooldown = 0.2;
      return false;
    }

    const spb = 60 / Math.max(60, this.weaponDef.rpm); // seconds per bullet
    this._shootCooldown = spb;
    this.weapon.clip -= 1;
    this.viewModel?.triggerFire?.();

    this.engine.events.emit("zm:weaponFired", { player: this, weaponId: this.weaponDef.id, weapon: this.weaponDef });

    const origin = new THREE.Vector3();
    this.r.camera.getWorldPosition(origin);

    const q = new THREE.Quaternion();
    this.r.camera.getWorldQuaternion(q);
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(q).normalize();

    const pellets = Math.max(1, Math.floor(this.weaponDef.pellets || 1));
    const spread = Number(this.weaponDef.spreadRad || 0);

    let didHit = false;

    for(let p=0; p<pellets; p++){
      const dir = pellets > 1 ? jitterDirection(forward, spread) : forward.clone();
      this.ray.set(origin, dir);
      this.ray.far = 80;

      const hit = this.engine.ctx.game?.zombies?.raycast(this.ray);
      if(!hit) continue;

      didHit = true;
      const dmg = this._damageForDistance(this.weaponDef, hit.distance);
      this.engine.ctx.game?.zombies?.damage(hit.entityId, dmg, this);

      // Explosive AOE on impact
      if(this.weaponDef.aoeRadius){
        const r = Number(this.weaponDef.aoeRadius);
        const mul = Number(this.weaponDef.aoeDamageMul ?? 0.6);
        this.engine.ctx.game?.zombies?.damageRadius(hit.point, r, dmg * mul, this);
        this.engine.events.emit("zm:explosion", { point: hit.point, radius: r });
      }
    }

    return didHit;
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

  _damageForDistance(def, dist){
    const r = Math.max(1, def.range);
    if(dist <= r) return def.damage * this.damageScale;
    const minD = def.damage * (1 - Math.max(0, Math.min(1, def.dropoff)));
    const extra = Math.min(1, (dist - r) / r);
    const base = Math.max(minD, def.damage * (1 - extra * def.dropoff));
    return base * this.damageScale;
  }

  dispose(){
    if(this._onWheel) window.removeEventListener("wheel", this._onWheel);
  }
}
