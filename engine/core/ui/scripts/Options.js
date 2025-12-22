export class OptionsStore {
  constructor({ storageKey="dz_options" } = {}){
    this.storageKey = storageKey;
    this.data = {
      mouseSensitivity: 0.0022,
      fov: 75,
      showFps: false,
      loadoutPrimary: "ar_m4",
      loadoutSecondary: "glock_19",
      gameMode: "zm",
      mpActiveClass: 0,
      zmActiveClass: 0,
      zmMap: "zm_facility",
      mpMap: "mp_arena",
      mpGamemode: "TDM",
      playerName: "",
      mpClasses: [
        { name:"Assault", primary:"ar_m4", secondary:"glock_19", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"SMG Rush", primary:"smg_mp5", secondary:"p_1911", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"LMG", primary:"lmg_mg42", secondary:"p_m9", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"Shotgun", primary:"sg_pump", secondary:"p_usp", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"Sniper", primary:"sn_m700", secondary:"p_deagle", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] }
      ],
      zmClasses: [
        { name:"Survivor", primary:"ar_m4", secondary:"glock_19", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"Brawler", primary:"sg_pump", secondary:"p_1911", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"Sprinter", primary:"smg_mp5", secondary:"p_m9", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"Heavy", primary:"lmg_mg42", secondary:"p_usp", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] },
        { name:"Marksman", primary:"sn_m700", secondary:"p_deagle", frag:"Frag", perks:["Perk 1","Perk 2","Perk 3"] }
      ],
    };
    this._load();
    this.listeners = new Set();
  }

  _load(){
    try{
      const raw = localStorage.getItem(this.storageKey);
      if(!raw) return;
      const obj = JSON.parse(raw);
      Object.assign(this.data, obj || {});
    } catch {}
  }

  _save(){
    try{ localStorage.setItem(this.storageKey, JSON.stringify(this.data)); } catch {}
  }

  set(key, value){
    this.data[key] = value;
    this._save();
    for(const fn of this.listeners){
      try{ fn(this.data, key, value); } catch {}
    }
  }

  get(key){ return this.data[key]; }

  onChange(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); }
}
