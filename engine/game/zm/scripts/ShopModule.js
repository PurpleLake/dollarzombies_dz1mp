export class ShopModule {
  constructor({ engine, cash }){
    this.engine = engine;
    this.cash = cash;
    this.items = new Map(); // id -> {id,name,cost,kind,data}
    engine.ctx.shop = this;
  }

  register({ id, name=null, cost=0, kind="generic", data=null }){
    if(!id) return false;
    this.items.set(String(id), { id:String(id), name: name??String(id), cost: Math.floor(Number(cost)||0), kind, data });
    return true;
  }

  list(){
    return Array.from(this.items.values());
  }

  purchase(player, itemId){
    const it = this.items.get(String(itemId));
    if(!it) return { ok:false, reason:"unknown_item" };
    const cost = it.cost;
    const have = this.cash.get(player);
    if(have < cost) return { ok:false, reason:"insufficient_cash", need: cost, have };
    this.cash.sub(player, cost);
    // Let scripts react
    this.engine.events.emit("shop:purchase", { player, item: it });
    return { ok:true, item: it, cost };
  }
}
