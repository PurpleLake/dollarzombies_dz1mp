export function injectNotificationStyles(){
  if(document.getElementById("dz-notify-styles")) return;
  const style = document.createElement("style");
  style.id = "dz-notify-styles";
  style.textContent = `
  .dz-notify-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    font-family: var(--ui-font, sans-serif);
    z-index: 9999;
  }
  .dz-notify-br {
    position: absolute;
    right: 18px;
    bottom: 18px;
    display: flex;
    flex-direction: column-reverse;
    gap: 6px;
  }
  .dz-notify {
    background: rgba(0,0,0,0.55);
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
    opacity: 0;
    animation: dzFadeIn 0.15s forwards;
  }
  .dz-notify-center {
    position: absolute;
    top: 45%;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .dz-notify-bold {
    background: rgba(0,0,0,0.7);
    color: #fff;
    padding: 14px 22px;
    border-radius: 12px;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.5px;
    opacity: 0;
    animation: dzPopIn 0.18s forwards;
  }
  .fade-out {
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  @keyframes dzFadeIn { to { opacity: 1; } }
  @keyframes dzPopIn { to { opacity: 1; transform: scale(1); } }
  .dz-cc { white-space: pre-wrap; }
/* COD-style ^0-^9 color codes (approx palette) */
.cc0 { color: #000000; } /* black */
.cc1 { color: #ff3b30; } /* red */
.cc2 { color: #34c759; } /* green */
.cc3 { color: #ffcc00; } /* yellow */
.cc4 { color: #0a84ff; } /* blue */
.cc5 { color: #bf5af2; } /* purple */
.cc6 { color: #ff9f0a; } /* orange */
.cc7 { color: #ffffff; } /* white */
.cc8 { color: #64d2ff; } /* light blue */
.cc9 { color: #ffd60a; } /* bright yellow */
  `;
  document.head.appendChild(style);
}
