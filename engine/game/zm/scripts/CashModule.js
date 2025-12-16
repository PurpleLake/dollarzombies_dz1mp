export class CashModule {
  constructor({ engine }){
    this.engine = engine;
    this.cash = new Map(); // playerKey -> int
    engine.ctx.cash = this;

    // award rules
    this.hitReward = 5;
    this.killReward = 20;

    engine.events.on("zm:zombieDamaged", ({ player })=>{
      if(player == null) return;
      this.add(player, this.hitReward);
    });
    engine.events.on("zm:zombieDeath", ({ player })=>{
      if(player == null) return;
      this.add(player, this.killReward);
    });
  }

  _key(player){
    if(player && typeof player === "object"){
      if(player.raw) return "p0"; // current single player
      if(player.name) return String(player.name);
    }
    return String(player ?? "p0");
  }

  get(player="p0"){
    return this.cash.get(this._key(player)) ?? 0;
  }

  set(player, amount){
    const v = Math.max(0, Math.floor(Number(amount) || 0));
    const k = this._key(player);
    this.cash.set(k, v);
    this.engine.events.emit("cash:change", { player: k, cash: v });
    return v;
  }

  add(player, amount){
    const k = this._key(player);
    const v = this.get(k) + Math.floor(Number(amount)||0);
    return this.set(k, v);
  }

  sub(player, amount){
    const k = this._key(player);
    const v = this.get(k) - Math.floor(Number(amount)||0);
    return this.set(k, v);
  }
}
