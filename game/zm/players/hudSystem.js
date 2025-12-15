// game/zm/players/hudSystem.js (CommonJS)
// Server-authoritative lightweight HUD element channel.
// Custom scripts can write HUD elements which the server streams to clients.

function createHudSystem(ctx){
  const { sendTo } = ctx;

  // playerId -> Map(key -> element)
  const hudByPlayer = new Map();
  const dirty = new Set();

  function _bucket(playerId){
    if (!hudByPlayer.has(playerId)) hudByPlayer.set(playerId, new Map());
    return hudByPlayer.get(playerId);
  }

  function setText(playerId, key, text, x, y, opts){
    const b = _bucket(playerId);
    b.set(String(key || 'text'), {
      key: String(key || 'text'),
      kind: 'text',
      text: String(text ?? ''),
      x: Number(x ?? 0),
      y: Number(y ?? 0),
      opts: (opts && typeof opts === 'object') ? opts : {}
    });
    dirty.add(playerId);
  }

  function setRect(playerId, key, x, y, w, h, opts){
    const b = _bucket(playerId);
    b.set(String(key || 'rect'), {
      key: String(key || 'rect'),
      kind: 'rect',
      x: Number(x ?? 0),
      y: Number(y ?? 0),
      w: Number(w ?? 0),
      h: Number(h ?? 0),
      opts: (opts && typeof opts === 'object') ? opts : {}
    });
    dirty.add(playerId);
  }

  function clear(playerId, key){
    const b = hudByPlayer.get(playerId);
    if (!b) return;
    if (key == null){
      b.clear();
    } else {
      b.delete(String(key));
    }
    dirty.add(playerId);
  }

  function clearAll(){
    hudByPlayer.clear();
    dirty.clear();
  }

  function flush(){
    // Only send to players whose HUD changed.
    for (const playerId of Array.from(dirty)){
      dirty.delete(playerId);
      const b = hudByPlayer.get(playerId);
      const items = b ? Array.from(b.values()) : [];
      sendTo(playerId, { type: 'hud', items });
    }
  }

  return { setText, setRect, clear, clearAll, flush };
}

module.exports = { createHudSystem };
