import { Button } from "../widgets/Button.js";

function getModeLabel(mode){
  if(mode === "SOLO") return "Single Player";
  if(mode === "ZM") return "Zombies (Co-op)";
  if(mode === "MP") return "Multiplayer";
  return "Match";
}

export function QueueScreen({ mode="ZM", onCancel } = {}){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(640px, 92vw)";
  panel.style.textAlign = "center";

  const title = document.createElement("div");
  title.className = "dz-title";
  title.textContent = "Matchmaking";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = `Queueing for ${getModeLabel(mode)}...`;

  const hint = document.createElement("div");
  hint.className = "dz-help";
  hint.textContent = "You can cancel at any time and browse lobbies instead.";

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.justifyContent = "center";
  row.style.marginTop = "10px";
  row.appendChild(Button({ text:"Cancel Queue", variant:"secondary", onClick: ()=>onCancel?.() }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(hint);
  panel.appendChild(row);
  screen.appendChild(panel);
  return screen;
}
