import { makeWeaponState } from "./WeaponState.js";

export class WeaponController {
  constructor({ events, weaponDB }){
    this.events = events;
    this.db = weaponDB;
    this.inventory = []; // weapon ids
    this.index = 0;
    this.weaponDef = null;
    this.weapon = null;

    this.reloadTime = 1.6; // seconds baseline (can be per-weapon later)
    this.reloading = false;
    this.reloadT = 0;
  }

  setInventory(ids){
    this.inventory = ids.slice();
    this.index = 0;
    this.setWeaponByIndex(0);
  }

  setWeaponById(id){
    const i = this.inventory.indexOf(id);
    if(i >= 0) this.setWeaponByIndex(i);
    else this._equip(id);
  }

  setWeaponByIndex(i){
    if(!this.inventory.length) return;
    const n = this.inventory.length;
    this.index = ((i % n) + n) % n;
    this._equip(this.inventory[this.index]);
  }

  next(){ this.setWeaponByIndex(this.index + 1); }
  prev(){ this.setWeaponByIndex(this.index - 1); }

_equip(id){
    if(!this.db){
      this.events?.emit?.("dev:toast", { msg: "WeaponDB not ready (engine.ctx.weapons missing)" });
      return;
    }

    const def = this.db.get(id);
    if(!def) {
      this.events.emit("dev:toast", { msg: `Missing weapon: ${id}` });
      return;
    }
    this.weaponDef = def;
    this.currentDef = def;
    this.weapon = makeWeaponState(def);
    this.reloading = false;
    this.reloadT = 0;
    this.events.emit("weapon:equipped", { id: def.id, name: def.name, clip: this.weapon.clip, reserve: this.weapon.reserve });
    this.events.emit("dev:toast", { msg: `Equipped: ${def.name}` });
  }

  requestReload(){
    if(!this.weaponDef || !this.weapon) return false;
    if(this.reloading) return false;
    if(this.weapon.clip >= this.weaponDef.ammoClip) return false;
    if(this.weapon.reserve <= 0) return false;

    this.reloading = true;
    this.reloadT = 0;
    this.events.emit("weapon:reloadStart", { id: this.weaponDef.id });
    return true;
  }

  tick(dt){
    if(!this.reloading) return;
    this.reloadT += dt;
    if(this.reloadT >= this.reloadTime){
      this._finishReload();
    }
  }

  _finishReload(){
    const def = this.weaponDef;
    const st = this.weapon;
    if(!def || !st) return;

    const need = def.ammoClip - st.clip;
    const take = Math.min(need, st.reserve);
    st.clip += take;
    st.reserve -= take;

    this.reloading = false;
    this.reloadT = 0;

    this.events.emit("weapon:reloadEnd", { id: def.id, clip: st.clip, reserve: st.reserve });
    this.events.emit("dev:toast", { msg: `Reloaded (${st.clip}/${st.reserve})` });
  }
}
