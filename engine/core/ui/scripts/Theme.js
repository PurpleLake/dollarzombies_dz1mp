const THEMES = Object.freeze({
  neon: {
    name: "Neon Night",
    bg: "#05060a",
    panel: "rgba(18,22,40,0.78)",
    panelBorder: "rgba(120,160,255,0.25)",
    text: "#e8ecff",
    textDim: "rgba(232,236,255,0.75)",
    accent: "#7aa0ff",
    accent2: "#ffb450",
    shadow: "rgba(0,0,0,0.45)",
    focus: "rgba(122,160,255,0.45)",
  },
  dusk: {
    name: "Dusk Ops",
    bg: "#07080d",
    panel: "rgba(20,16,28,0.78)",
    panelBorder: "rgba(215,140,255,0.20)",
    text: "#f2eaff",
    textDim: "rgba(242,234,255,0.72)",
    accent: "#d78cff",
    accent2: "#7af0ff",
    shadow: "rgba(0,0,0,0.5)",
    focus: "rgba(215,140,255,0.40)",
  },
  ember: {
    name: "Ember Arcade",
    bg: "#0a0705",
    panel: "rgba(26,18,12,0.78)",
    panelBorder: "rgba(255,180,80,0.22)",
    text: "#fff2e6",
    textDim: "rgba(255,242,230,0.72)",
    accent: "#ffb450",
    accent2: "#7aa0ff",
    shadow: "rgba(0,0,0,0.55)",
    focus: "rgba(255,180,80,0.38)",
  },
});

const DEFAULT_THEME = "neon";

export class ThemeManager {
  constructor({ storageKey = "dz_theme" } = {}){
    this.storageKey = storageKey;
    const saved = (typeof localStorage !== "undefined") ? localStorage.getItem(storageKey) : null;
    this.key = saved && THEMES[saved] ? saved : DEFAULT_THEME;
    this.theme = THEMES[this.key];
    this.listeners = new Set();
  }

  list(){
    return Object.entries(THEMES).map(([key, t])=>({ key, ...t }));
  }

  set(key){
    if(!THEMES[key]) return false;
    this.key = key;
    this.theme = THEMES[key];
    try { localStorage.setItem(this.storageKey, key); } catch {}
    this._applyCssVars();
    this._emit();
    return true;
  }

  _emit(){
    for(const fn of this.listeners){
      try{ fn(this.theme, this.key); } catch {}
    }
  }

  onChange(fn){
    this.listeners.add(fn);
    return ()=>this.listeners.delete(fn);
  }

  apply(){
    this._applyCssVars();
  }

  _applyCssVars(){
    const t = this.theme;
    const r = document.documentElement;
    r.style.setProperty("--ui-bg", t.bg);
    r.style.setProperty("--ui-panel", t.panel);
    r.style.setProperty("--ui-panel-border", t.panelBorder);
    r.style.setProperty("--ui-text", t.text);
    r.style.setProperty("--ui-text-dim", t.textDim);
    r.style.setProperty("--ui-accent", t.accent);
    r.style.setProperty("--ui-accent2", t.accent2);
    r.style.setProperty("--ui-shadow", t.shadow);
    r.style.setProperty("--ui-focus", t.focus);
  }
}
