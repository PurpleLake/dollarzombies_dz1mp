export function injectNameplateStyles(){
  if(document.getElementById("dz-nameplate-styles")) return;
  const style = document.createElement("style");
  style.id = "dz-nameplate-styles";
  style.textContent = `
  .dz-nameplate{
    position: fixed;
    z-index: 9998;
    pointer-events: none;
    padding: 6px 10px;
    border-radius: 10px;
    border: 2px solid rgba(255,255,255,0.25);
    background: rgba(0,0,0,0.35);
    backdrop-filter: blur(4px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    transform: translate(-50%, -100%);
    min-width: 88px;
    text-align: center;
  }
  .dz-nameplate-name{
    font-weight: 950;
    font-size: 13px;
    letter-spacing: 0.3px;
    text-shadow: 0 2px 12px rgba(0,0,0,0.7);
    white-space: nowrap;
  }
  `;
  document.head.appendChild(style);
}
