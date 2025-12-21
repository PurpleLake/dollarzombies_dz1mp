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
        --ui-bg:#070a08;
        --ui-panel:rgba(13,17,14,0.88);
        --ui-panel-border:rgba(205,210,195,0.18);
        --ui-text:#f0f2ed;
        --ui-text-dim:rgba(230,232,224,0.68);
        --ui-accent:#9cc55b;
        --ui-accent2:#e7a93b;
        --ui-shadow:rgba(0,0,0,0.45);
        --ui-focus:rgba(156,197,91,0.45);
        --ui-radius:4px;
        --ui-gap:8px;
        --ui-font: "Agency FB", "Bahnschrift", "Arial Narrow", system-ui, Segoe UI, Roboto, Arial;
        --ui-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono";
      }

      .dz-screen{
        position:absolute; inset:0;
        display:grid; place-items:center;
        background:
          repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 4px),
          repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 7px),
          radial-gradient(circle at 15% 18%, rgba(106,132,74,0.22), transparent 42%),
          radial-gradient(circle at 78% 70%, rgba(168,120,55,0.16), transparent 48%),
          rgba(6,8,7,0.94);
        background-size: cover;
        background-position: center;
        pointer-events:auto;
      }
      #ui-root[data-ui-mode="mp"] .dz-screen{
        background:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 140px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 120px),
          repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 8px),
          radial-gradient(circle at 15% 20%, rgba(120,160,90,0.22), transparent 45%),
          linear-gradient(180deg, rgba(6,8,6,0.88), rgba(7,9,7,0.96));
      }
      #ui-root[data-ui-mode="zm"] .dz-screen{
        background:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 160px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.024) 0 1px, transparent 1px 130px),
          repeating-linear-gradient(135deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 9px),
          radial-gradient(circle at 20% 30%, rgba(150,70,60,0.22), transparent 48%),
          linear-gradient(180deg, rgba(6,6,7,0.88), rgba(9,7,7,0.96));
      }

      .dz-panel{
        width:min(780px, 92vw);
        background:
          linear-gradient(180deg, rgba(18,22,16,0.78), rgba(8,10,8,0.9)),
          linear-gradient(90deg, rgba(156,197,91,0.12), transparent 30%),
          var(--ui-panel);
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
        background:
          linear-gradient(180deg, rgba(255,255,255,0.04), transparent 40%, rgba(0,0,0,0.4)),
          linear-gradient(90deg, rgba(231,169,59,0.06), transparent 40%);
        pointer-events:none;
      }
      .dz-panel > *{
        position:relative;
        z-index:1;
      }

      .dz-title{font-size:16px;margin:0 0 6px 0;letter-spacing:0.22em;text-transform:uppercase}
      .dz-sub{margin:0 0 10px 0;color:var(--ui-text-dim);line-height:1.35;font-size:11px;letter-spacing:0.06em}

      .dz-row{display:flex; gap:var(--ui-gap); align-items:center; flex-wrap:wrap}
      .dz-col{display:flex; flex-direction:column; gap:var(--ui-gap)}
      .dz-spacer{flex:1}

      .dz-btn{
        pointer-events:auto; cursor:pointer;
        border:1px solid color-mix(in srgb, var(--ui-accent) 45%, rgba(255,255,255,0.18));
        background: linear-gradient(180deg, rgba(17,20,15,0.86), rgba(7,9,7,0.92));
        color:#f2f2f2;
        padding:6px 10px;
        border-radius:4px;
        font-weight:700;
        font-size:11px;
        letter-spacing:0.18em;
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
        border-radius:6px;
        border:1px solid color-mix(in srgb, var(--ui-panel-border) 75%, transparent);
        background: rgba(0,0,0,0.45);
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
        border-radius:8px;
        border:1px solid color-mix(in srgb, var(--ui-panel-border) 65%, transparent);
        background: rgba(0,0,0,0.3);
        overflow:auto;
        min-width:280px;
        max-height:340px;
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
        border-radius:8px;
        box-shadow: 0 10px 30px var(--ui-shadow);
        max-width:min(420px, 92vw);
      }
      .dz-scroll{
        overflow:auto;
        min-height:0;
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
