export class UIRoot {
  constructor({ id="ui-root" } = {}){
    this.id = id;
    this.el = document.getElementById(id);
    if(!this.el){
      this.el = document.createElement("div");
      this.el.id = id;
      document.body.appendChild(this.el);
    }
    this.el.style.position = "fixed";
    this.el.style.inset = "0";
    this.el.style.pointerEvents = "none";
    this.el.style.zIndex = "50";

    this.layers = {
      screen: this._mkLayer("ui-layer-screen", 10),
      overlay: this._mkLayer("ui-layer-overlay", 20),
      hud: this._mkLayer("ui-layer-hud", 30),
      toast: this._mkLayer("ui-layer-toast", 40),
    };

    this._ensureBaseStyles();
  }

  _mkLayer(className, z){
    const d = document.createElement("div");
    d.className = className;
    d.style.position = "absolute";
    d.style.inset = "0";
    d.style.pointerEvents = "none";
    d.style.zIndex = String(z);
    this.el.appendChild(d);
    return d;
  }

  _ensureBaseStyles(){
    if(document.getElementById("dz-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "dz-ui-styles";
    style.textContent = `
      :root{
        --ui-bg:#05060a;
        --ui-panel:rgba(14,18,26,0.82);
        --ui-panel-border:rgba(255,255,255,0.12);
        --ui-text:#f2f5f8;
        --ui-text-dim:rgba(242,245,248,0.72);
        --ui-accent:#7aa0ff;
        --ui-accent2:#ffb450;
        --ui-shadow:rgba(0,0,0,0.45);
        --ui-focus:rgba(122,160,255,0.45);
        --ui-radius:6px;
        --ui-gap:8px;
        --ui-font: "Bahnschrift", "Agency FB", "Arial Narrow", system-ui, Segoe UI, Roboto, Arial;
        --ui-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono";
      }

      .dz-screen{
        position:absolute; inset:0;
        display:grid; place-items:center;
        background:
          repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 6px),
          radial-gradient(circle at 18% 20%, rgba(110,140,110,0.18), transparent 40%),
          radial-gradient(circle at 82% 70%, rgba(200,140,60,0.14), transparent 45%),
          rgba(4,6,8,0.9);
        pointer-events:auto;
      }

      .dz-panel{
        width:min(780px, 92vw);
        background:linear-gradient(180deg, rgba(16,20,28,0.7), rgba(8,10,14,0.85));
        border:1px solid var(--ui-panel-border);
        border-radius:var(--ui-radius);
        box-shadow: 0 14px 40px var(--ui-shadow);
        color:var(--ui-text);
        font-family:var(--ui-font);
        padding:12px;
        position:relative;
        overflow:hidden;
      }
      .dz-panel::before{
        content:"";
        position:absolute;
        inset:0;
        background:linear-gradient(180deg, rgba(255,255,255,0.04), transparent 40%, rgba(0,0,0,0.35));
        pointer-events:none;
      }
      .dz-panel > *{
        position:relative;
        z-index:1;
      }

      .dz-title{font-size:16px;margin:0 0 6px 0;letter-spacing:0.18em;text-transform:uppercase}
      .dz-sub{margin:0 0 10px 0;color:var(--ui-text-dim);line-height:1.35;font-size:11px;letter-spacing:0.04em}

      .dz-row{display:flex; gap:var(--ui-gap); align-items:center; flex-wrap:wrap}
      .dz-col{display:flex; flex-direction:column; gap:var(--ui-gap)}
      .dz-spacer{flex:1}

      .dz-btn{
        pointer-events:auto; cursor:pointer;
        border:1px solid rgba(255,255,255,0.18);
        background: rgba(0,0,0,0.4);
        color:#f2f2f2;
        padding:6px 10px;
        border-radius:6px;
        font-weight:700;
        font-size:11px;
        letter-spacing:0.16em;
        text-transform:uppercase;
        user-select:none;
      }
      .dz-btn:hover{animation:dz-ui-text-fade 1.1s ease-in-out infinite;filter:none}
      .dz-btn:active{transform:translateY(1px)}
      .dz-btn.dz-secondary{
        border:1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.25);
      }

      .dz-field{
        pointer-events:auto;
        display:flex; flex-direction:column; gap:6px;
        min-width:220px;
      }
      .dz-label{
        font-size:12px;
        color:var(--ui-text-dim);
        letter-spacing:0.02em;
        text-transform:uppercase;
      }
      .dz-help{font-size:12px;color:var(--ui-text-dim)}

      .dz-input, .dz-select{
        pointer-events:auto;
        width:100%;
        border-radius:12px;
        border:1px solid color-mix(in srgb, var(--ui-panel-border) 70%, transparent);
        background: rgba(0,0,0,0.35);
        color: var(--ui-text);
        padding:10px 10px;
        outline:none;
      }
      .dz-input:focus, .dz-select:focus{
        box-shadow: 0 0 0 3px var(--ui-focus);
        border-color: color-mix(in srgb, var(--ui-accent) 60%, var(--ui-panel-border));
      }

      .dz-checkbox{
        pointer-events:auto;
        display:flex; gap:10px; align-items:center;
        padding:10px 10px;
        border-radius:14px;
        border:1px solid color-mix(in srgb, var(--ui-panel-border) 55%, transparent);
        background: rgba(0,0,0,0.25);
        user-select:none;
      }
      .dz-checkbox input{width:18px;height:18px; accent-color: var(--ui-accent);}

      .dz-slider{
        pointer-events:auto;
        display:flex; flex-direction:column; gap:6px;
        min-width:260px;
      }
      .dz-slider input[type=range]{ width:100% }
      .dz-slider .dz-value{font-family:var(--ui-mono); font-size:12px; color:var(--ui-text-dim)}

      .dz-listbox{
        pointer-events:auto;
        border-radius:14px;
        border:1px solid color-mix(in srgb, var(--ui-panel-border) 60%, transparent);
        background: rgba(0,0,0,0.25);
        overflow:hidden;
        min-width:280px;
      }
      .dz-listbox .dz-item{
        padding:10px 12px;
        cursor:pointer;
        display:flex; justify-content:space-between; gap:10px;
        border-top:1px solid rgba(255,255,255,0.05);
        user-select:none;
      }
      .dz-listbox .dz-item:first-child{border-top:none}
      .dz-listbox .dz-item:hover{background: rgba(255,255,255,0.04)}
      .dz-listbox .dz-item.dz-active{
        background: color-mix(in srgb, var(--ui-accent) 20%, rgba(0,0,0,0.25));
        outline: 2px solid color-mix(in srgb, var(--ui-accent) 40%, transparent);
        outline-offset: -2px;
      }

      .dz-divider{height:1px;background:rgba(255,255,255,0.06); margin:12px 0}

      .dz-toast-wrap{
        position:fixed; right:12px; top:12px;
        display:flex; flex-direction:column; gap:8px;
        pointer-events:none;
      }
      .dz-toast{
        background:var(--ui-panel);
        border:1px solid color-mix(in srgb, var(--ui-accent2) 28%, var(--ui-panel-border));
        color:var(--ui-text);
        padding:10px 12px;
        border-radius:14px;
        box-shadow: 0 10px 30px var(--ui-shadow);
        max-width:min(420px, 92vw);
      }
      @keyframes dz-ui-text-fade{
        0%{color:#ffffff;}
        50%{color:#0a0a0a;}
        100%{color:#ffffff;}
      }
    `;
    document.head.appendChild(style);
  }
}
