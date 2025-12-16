export class MenuManager {
  constructor({ uiRoot, events, theme }){
    this.uiRoot = uiRoot;
    this.events = events;
    this.theme = theme;
    this.stack = [];
    this.screenEl = null;
    this.overlayEl = null;

    // Toast container
    this.toastWrap = document.createElement("div");
    this.toastWrap.className = "dz-toast-wrap";
    this.uiRoot.layers.toast.appendChild(this.toastWrap);

    this.events.on("dev:toast", ({ msg }) => this.toast(msg));

    // Pause handling (Esc)
    window.addEventListener("keydown", (e)=>{
      if(e.code === "Escape"){
        this.events.emit("menu:togglePause", {});
      }
    });
  }

  toast(msg){
    const t = document.createElement("div");
    t.className = "dz-toast";
    t.textContent = msg;
    this.toastWrap.appendChild(t);
    setTimeout(()=>t.remove(), 2200);
  }

  // Screen = full-screen menu (main menu / settings)
  setScreen(node){
    if(this.screenEl) this.screenEl.remove();
    this.screenEl = node;
    if(node) this.uiRoot.layers.screen.appendChild(node);
  }

  // Overlay = pause menu
  setOverlay(node){
    if(this.overlayEl) this.overlayEl.remove();
    this.overlayEl = node;
    if(node) this.uiRoot.layers.overlay.appendChild(node);
  }

  showHud(show){
    this.uiRoot.layers.hud.style.display = show ? "" : "none";
  }
}
