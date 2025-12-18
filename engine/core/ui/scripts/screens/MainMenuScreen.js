import { Button } from "../widgets/Button.js";

function modeTab({ label, active, onClick }){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dz-btn";
  btn.textContent = label;
  btn.style.opacity = active ? "1" : "0.65";
  btn.style.borderColor = active ? "rgba(255,180,80,0.5)" : "rgba(255,255,255,0.18)";
  btn.addEventListener("click", ()=>onClick?.());
  return btn;
}

export function MainMenuScreen({ onPlay, onClass, onSettings, onBrowser, onSolo, mode="ZM", onMode }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(980px, 94vw)";
  panel.style.padding = "12px";

  const title = document.createElement("h1");
  title.className = "dz-title";
  title.textContent = "Dollar Zombies Engine";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Select MP or ZM, then queue. Solo launches a private lobby.";

  const modeRow = document.createElement("div");
  modeRow.className = "dz-row";
  modeRow.style.marginTop = "10px";
  const mpBtn = modeTab({ label: "MP", active: mode === "MP", onClick: ()=>setMode("MP") });
  const zmBtn = modeTab({ label: "ZM", active: mode === "ZM", onClick: ()=>setMode("ZM") });
  modeRow.appendChild(mpBtn);
  modeRow.appendChild(zmBtn);

  function setMode(next){
    onMode?.(next);
    mpBtn.style.opacity = next === "MP" ? "1" : "0.65";
    zmBtn.style.opacity = next === "ZM" ? "1" : "0.65";
    mpBtn.style.borderColor = next === "MP" ? "rgba(255,180,80,0.5)" : "rgba(255,255,255,0.18)";
    zmBtn.style.borderColor = next === "ZM" ? "rgba(255,180,80,0.5)" : "rgba(255,255,255,0.18)";
  }

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.marginTop="10px";
  row.appendChild(Button({ text: "Find Match", onClick: ()=>onPlay?.() }));
  row.appendChild(Button({ text:"Start Solo", variant:"secondary", onClick: ()=>onSolo?.() }));
  row.appendChild(Button({ text:"Server Browser", variant:"secondary", onClick: ()=>onBrowser?.() }));
  row.appendChild(Button({ text:"Loadout", variant:"secondary", onClick: ()=>onClass?.() }));
  row.appendChild(Button({ text:"Settings", variant:"secondary", onClick: ()=>onSettings?.() }));

  const hint = document.createElement("div");
  hint.className = "dz-help";
  hint.style.marginTop="8px";
  hint.textContent = "In-game: Mouse Wheel or 1-6 switch weapons, R reload, Esc pause.";

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(modeRow);
  panel.appendChild(row);
  panel.appendChild(hint);

  screen.appendChild(panel);
  return screen;
}
