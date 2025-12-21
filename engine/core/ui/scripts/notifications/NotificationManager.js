import { renderCodColorCodes } from "./ColorCodes.js";

export class NotificationManager {
  constructor(engine){
    this.engine = engine;
    this.playerRoots = new Map();
  }

  _getRoots(player){
    if(this.playerRoots.has(player)) return this.playerRoots.get(player);

    const root = document.createElement("div");
    root.className = "dz-notify-root";

    const br = document.createElement("div");
    br.className = "dz-notify-br";

    const center = document.createElement("div");
    center.className = "dz-notify-center";

    root.appendChild(br);
    root.appendChild(center);
    document.body.appendChild(root);

    const obj = { root, br, center };
    this.playerRoots.set(player, obj);
    return obj;
  }

  notify(player, text, { bold = false } = {}){
    if(!player) return;
    const { br, center } = this._getRoots(player);
    const el = document.createElement("div");
    el.className = bold ? "dz-notify-bold" : "dz-notify";
    el.appendChild(renderCodColorCodes(text));

    (bold ? center : br).appendChild(el);

    setTimeout(() => {
      el.classList.add("fade-out");
      setTimeout(() => el.remove(), 300);
    }, bold ? 2000 : 2500);
  }

  notifyAll(text, opts){
    const players = this.engine?.ctx?.players || [];
    if(players.length){
      for(const p of players){
        this.notify(p, text, opts);
      }
      return;
    }
    const fallback = this.engine?.ctx?.player || this.engine?.ctx?.net?.clientId || "p0";
    this.notify(fallback, text, opts);
  }
}
