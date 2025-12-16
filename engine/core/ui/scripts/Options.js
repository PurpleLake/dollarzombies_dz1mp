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
      zmMap: "zm_facility",
      mpMap: "mp_arena",
      mpClasses: [
        { name:"Assault", primary:"ar_m4", secondary:"glock_19" },
        { name:"SMG Rush", primary:"smg_mp5", secondary:"p_1911" },
        { name:"LMG", primary:"lmg_mg42", secondary:"p_m9" },
        { name:"Shotgun", primary:"sg_pump", secondary:"p_usp" },
        { name:"Sniper", primary:"sn_m700", secondary:"p_deagle" }
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
