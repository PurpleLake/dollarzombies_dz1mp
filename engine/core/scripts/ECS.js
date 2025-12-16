export class ECS {
  constructor(){
    this.nextId = 1;
    this.entities = new Set();
    this.components = new Map(); // name -> Map(id->data)
    this.systems = [];
  }
  create(){ const id=this.nextId++; this.entities.add(id); return id; }
  destroy(id){
    this.entities.delete(id);
    for(const m of this.components.values()) m.delete(id);
  }
  add(id, name, data={}){
    if(!this.components.has(name)) this.components.set(name, new Map());
    this.components.get(name).set(id, data);
    return data;
  }
  get(name){ return this.components.get(name) ?? new Map(); }
  query(...names){
    const maps = names.map(n=>this.get(n));
    const out=[];
    for(const id of this.entities){
      let ok=true;
      for(const m of maps){ if(!m.has(id)){ ok=false; break; } }
      if(ok) out.push(id);
    }
    return out;
  }
  use(system){ this.systems.push(system); }
  tick(dt, ctx){ for(const s of this.systems) s(dt, this, ctx); }
}
