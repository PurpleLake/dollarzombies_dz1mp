import { renderCodColorCodes } from "./notifications/ColorCodes.js";

// Simple engine HUD system (DOM-based) with "shader" placeholder for future renderers.
// Items are stored by id and can be addressed by DZS scripts.
export class HudSystem {
  constructor({ uiRoot, events }){
    this.uiRoot = uiRoot;
    this.events = events;
    this.items = new Map(); // id -> {el, textEl, player}
    this._nextId = 1;
    this.maxItems = 220;
    this.maxPerPlayer = 60;

    // root container (within HUD layer)
    this.root = document.createElement("div");
    this.root.style.position = "absolute";
    this.root.style.inset = "0";
    this.root.style.pointerEvents = "none";
    this.uiRoot.layers.hud.appendChild(this.root);
  }

  _countForPlayer(pid){
    let n=0;
    for(const it of this.items.values()) if(it.player===String(pid)) n++;
    return n;
  }

  _id(){
    return "hud_" + (this._nextId++);
  }

  clear(player=null){
    for(const [id, it] of this.items){
      if(player == null || String(it.player) === String(player)){
        it.el.remove();
        this.items.delete(id);
      }
    }
  }

  remove(id){
    const it = this.items.get(String(id));
    if(!it) return false;
    it.el.remove();
    this.items.delete(String(id));
    return true;
  }

  setText(id, text=""){
    const it = this.items.get(String(id));
    if(!it) return false;
    if(it.textEl) it.textEl.textContent = String(text);
    return true;
  }


setColor(id, color="#ffffff"){
  const it = this.items.get(String(id));
  if(!it) return false;
  const c = String(color);
  if(it.textEl) it.textEl.style.color = c;
  it.el.style.border = "1px solid color-mix(in srgb, " + c + " 35%, rgba(255,255,255,0.14))";
  return true;
}

setPos(id, x, y){
  const it = this.items.get(String(id));
  if(!it) return false;
  if(x != null) it.el.style.left = `${Number(x)}px`;
  if(y != null) it.el.style.top = `${Number(y)}px`;
  return true;
}

setSize(id, w, h){
  const it = this.items.get(String(id));
  if(!it) return false;
  if(w != null) it.el.style.width = `${Number(w)}px`;
  if(h != null) it.el.style.height = `${Number(h)}px`;
  return true;
}

setVisible(id, visible=true){
  const it = this.items.get(String(id));
  if(!it) return false;
  it.el.style.display = visible ? "" : "none";
  return true;
}

setZ(id, z){
  const it = this.items.get(String(id));
  if(!it) return false;
  it.el.style.zIndex = String(Number(z||0));
  return true;
}

setBackground(id, css="rgba(0,0,0,0.35)"){
  const it = this.items.get(String(id));
  if(!it) return false;
  it.el.style.background = String(css);
  return true;
}

setShader(id, shader=""){
  const it = this.items.get(String(id));
  if(!it) return false;
  it.el.dataset.shader = String(shader ?? "");
  return true;
}

  // createHudItem(player, color, width, height, x, y, text, shader)
  createItem({ player="0", color="#ffffff", width=220, height=40, x=20, y=20, text="", shader="" } = {}){
    const pid = String(player);
    if(this.items.size >= this.maxItems) return null;
    if(this._countForPlayer(pid) >= this.maxPerPlayer) return null;
    const id = this._id();
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${Number(x)}px`;
    el.style.top = `${Number(y)}px`;
    el.style.width = `${Number(width)}px`;
    el.style.height = `${Number(height)}px`;
    el.style.borderRadius = "14px";
    el.style.background = "rgba(0,0,0,0.35)";
    el.style.border = "1px solid color-mix(in srgb, " + String(color) + " 35%, rgba(255,255,255,0.14))";
    el.style.boxShadow = "0 10px 26px rgba(0,0,0,0.35)";
    el.style.pointerEvents = "none";

    const textEl = document.createElement("div");
    textEl.style.position = "absolute";
    textEl.style.inset = "0";
    textEl.style.display = "grid";
    textEl.style.placeItems = "center";
    textEl.style.fontFamily = "var(--ui-font, system-ui)";
    textEl.style.fontWeight = "800";
    textEl.style.fontSize = "13px";
    textEl.style.letterSpacing = "0.02em";
    textEl.style.color = String(color);
    textEl.style.textShadow = "0 2px 10px rgba(0,0,0,0.55)";
    textEl.textContent = String(text ?? "");
    el.appendChild(textEl);

    // shader placeholder: store for future renderer
    el.dataset.shader = String(shader ?? "");

    this.root.appendChild(el);
    this.items.set(id, { el, textEl, player: pid });
    return id;
  }

  // createHudText(player, color, x, y, text, shader)
  createText({ player="0", color="#ffffff", x=20, y=20, text="", shader="" } = {}){
    const pid = String(player);
    if(this.items.size >= this.maxItems) return null;
    if(this._countForPlayer(pid) >= this.maxPerPlayer) return null;
    const id = this._id();
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${Number(x)}px`;
    el.style.top = `${Number(y)}px`;
    el.style.pointerEvents = "none";
    el.style.fontFamily = "var(--ui-font, system-ui)";
    el.style.fontWeight = "900";
    el.style.fontSize = "14px";
    el.style.color = String(color);
    el.style.textShadow = "0 2px 12px rgba(0,0,0,0.6)";
    el.textContent = String(text ?? "");
    el.dataset.shader = String(shader ?? "");

    this.root.appendChild(el);
    this.items.set(id, { el, textEl: el, player: pid });
    return id;
  }
}
