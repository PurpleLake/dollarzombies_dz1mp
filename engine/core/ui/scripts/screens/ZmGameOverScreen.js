import { Button } from "../widgets/Button.js";

export function ZmGameOverScreen({ stats, onRestart, onEnd }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(520px, 92vw)";
  panel.style.padding = "16px";
  panel.style.display = "grid";
  panel.style.gap = "12px";

  const title = document.createElement("div");
  title.className = "dz-title";
  title.textContent = "Game Over";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "All players are down.";

  const statWrap = document.createElement("div");
  statWrap.style.display = "grid";
  statWrap.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
  statWrap.style.gap = "8px";

  function statCard(label, value){
    const c = document.createElement("div");
    c.style.border = "1px solid rgba(255,255,255,0.12)";
    c.style.borderRadius = "8px";
    c.style.padding = "10px";
    c.style.background = "rgba(0,0,0,0.28)";
    const l = document.createElement("div");
    l.className = "dz-help";
    l.textContent = label;
    const v = document.createElement("div");
    v.style.fontWeight = "900";
    v.style.fontSize = "18px";
    v.textContent = String(value ?? 0);
    c.appendChild(l);
    c.appendChild(v);
    return c;
  }

  statWrap.appendChild(statCard("Money", stats?.money ?? 0));
  statWrap.appendChild(statCard("Kills", stats?.kills ?? 0));
  statWrap.appendChild(statCard("Downs", stats?.downs ?? 0));

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.justifyContent = "flex-end";
  row.appendChild(Button({ text:"Restart", onClick: ()=>onRestart?.() }));
  row.appendChild(Button({ text:"End Game", variant:"secondary", onClick: ()=>onEnd?.() }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(statWrap);
  panel.appendChild(row);
  screen.appendChild(panel);
  return screen;
}
