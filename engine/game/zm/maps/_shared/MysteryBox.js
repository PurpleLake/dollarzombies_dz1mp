function pickWeapon(list, lastId){
  if(!list.length) return null;
  if(list.length === 1) return list[0];
  let pick = list[Math.floor(Math.random() * list.length)];
  if(pick.id === lastId){
    pick = list[(list.indexOf(pick) + 1) % list.length];
  }
  return pick;
}

function getWeaponPool(engine, poolIds){
  const db = engine?.ctx?.weapons;
  if(!db) return [];
  if(Array.isArray(poolIds) && poolIds.length){
    return poolIds.map(id=> db.get(id)).filter(Boolean);
  }
  return db.list().filter(w=> w && w.id && !String(w.id).startsWith("ar_m4_explosive"));
}

export function createMysteryBox({
  engine,
  id="mystery_box",
  position={ x:0, y:0.6, z:0 },
  cost=950,
  cooldownMs=6000,
  rollDelayMs=1200,
  weaponPool=null,
  prompt=null,
} = {}){
  const ctx = engine?.ctx;
  const entities = ctx?.entities;
  const triggers = ctx?.triggers;
  if(!entities || !triggers) return null;

  const boxPos = { x: Number(position.x||0), y: Number(position.y||0), z: Number(position.z||0) };
  entities.spawnEntity?.("box", boxPos, {
    sx: 1.4, sy: 0.8, sz: 1.0,
    color: 0x6a4a2c,
    tag: "mystery_box",
    health: 9999,
  });

  const light = ctx.world?.addLight?.({
    type: "point",
    color: 0xffd199,
    intensity: 0.6,
    position: { x: boxPos.x, y: boxPos.y + 1.4, z: boxPos.z },
    distance: 12,
    castShadow: false,
  });

  const promptText = prompt || `Mystery Box - ${cost}`;
  const triggerId = triggers.create({ x: boxPos.x, y: boxPos.y, z: boxPos.z }, 2.2, { prompt: promptText });
  triggers.setCooldown(triggerId, cooldownMs);

  const pool = getWeaponPool(engine, weaponPool);
  let busy = false;
  let lastWeaponId = null;

  const onUse = ({ triggerId: tid, player })=>{
    if(tid !== triggerId) return;
    if(busy) return;
    const cash = ctx.cash;
    if(!cash){
      engine?.events?.emit?.("dev:toast", { msg: "Cash system offline." });
      return;
    }
    const have = cash.get(player);
    if(have < cost){
      engine?.events?.emit?.("dev:toast", { msg: `Need ${cost} points.` });
      return;
    }

    cash.sub(player, cost);
    busy = true;
    triggers.setPrompt(triggerId, "Mystery Box - rolling...");

    setTimeout(()=>{
      const pick = pickWeapon(pool, lastWeaponId);
      if(!pick){
        engine?.events?.emit?.("dev:toast", { msg: "Mystery Box empty." });
        triggers.setPrompt(triggerId, promptText);
        busy = false;
        return;
      }
      lastWeaponId = pick.id;
      const p = ctx.player || ctx.game?.players;
      const wc = p?.weaponCtl;
      if(wc){
        if(!wc.inventory.includes(pick.id)){
          wc.inventory.push(pick.id);
        }
        wc.setWeaponById(pick.id);
      }
      engine?.events?.emit?.("dev:toast", { msg: `Mystery Box: ${pick.name}` });
      triggers.setPrompt(triggerId, promptText);
      busy = false;
    }, rollDelayMs);
  };

  const offUse = engine.events.on("trigger:use", onUse);
  const offEnd = engine.events.on("zm:gameEnd", ()=> offUse?.());
  return {
    triggerId,
    light,
    dispose: ()=>{
      offUse?.();
      offEnd?.();
    },
  };
}
