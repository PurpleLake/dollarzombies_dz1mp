import { Button } from "../widgets/Button.js";

export function QueueScreen({ modeLabel = "Match", onCancel } = {}){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(560px, 92vw)";
  panel.style.padding = "16px";

  const title = document.createElement("h1");
  title.className = "dz-title";
  title.textContent = "FINDING MATCH";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = `Searching for ${modeLabel} lobby...`;

  const status = document.createElement("div");
  status.className = "dz-help";
  status.style.marginTop = "10px";
  status.textContent = "In queue...";

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.marginTop = "12px";
  row.appendChild(Button({ text: "Cancel", variant: "secondary", onClick: ()=>onCancel?.() }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(status);
  panel.appendChild(row);
  screen.appendChild(panel);

  return {
    screen,
    setStatus: (text)=>{ status.textContent = text || ""; },
  };
}
