import { Button } from "../widgets/Button.js";

export function PauseMenuOverlay({ onResume, onSettings, onQuit }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";
  screen.style.background = "rgba(0,0,0,0.55)";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(560px, 92vw)";

  const title = document.createElement("h2");
  title.className = "dz-title";
  title.textContent = "Paused";

  const row = document.createElement("div");
  row.className = "dz-row";
  row.appendChild(Button({ text:"Resume", onClick: ()=>onResume?.() }));
  row.appendChild(Button({ text:"Settings", variant:"secondary", onClick: ()=>onSettings?.() }));
  row.appendChild(Button({ text:"Quit to Menu", variant:"secondary", onClick: ()=>onQuit?.() }));

  const hint = document.createElement("div");
  hint.className = "dz-help";
  hint.style.marginTop="10px";
  hint.textContent = "Tip: Esc also resumes.";

  panel.appendChild(title);
  panel.appendChild(row);
  panel.appendChild(hint);

  screen.appendChild(panel);
  return screen;
}
