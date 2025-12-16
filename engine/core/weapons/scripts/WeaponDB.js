import { WeaponDefs } from "./WeaponDefs.js";
import { validateWeaponDef } from "../utilities/WeaponValidate.js";

export class WeaponDB {
  constructor(){
    this.map = new Map();
    for(const def of Object.values(WeaponDefs)){
      validateWeaponDef(def);
      this.map.set(def.id, def);
    }
  }

  get(id){
    return this.map.get(id) || null;
  }

  list(){
    return Array.from(this.map.values());
  }

  // convenience groups for UI later
  listByAttribute(attr){
    return this.list().filter(w => w.attributes.includes(attr));
  }
}
