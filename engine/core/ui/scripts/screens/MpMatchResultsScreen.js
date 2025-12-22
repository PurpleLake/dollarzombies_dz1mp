import { Button } from "../widgets/Button.js";

function resultCard(label, value){
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

export function MpMatchResultsScreen({ state, reason, onContinue }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(640px, 94vw)";
  panel.style.padding = "16px";
  panel.style.display = "grid";
  panel.style.gap = "12px";

  const title = document.createElement("div");
  title.className = "dz-title";
  title.textContent = "Match Results";

  const tdm = state?.tdm || {};
  const teamAName = tdm.teamAName || "Alpha";
  const teamBName = tdm.teamBName || "Bravo";
  const scoreA = Number(tdm.scoreA ?? 0);
  const scoreB = Number(tdm.scoreB ?? 0);

  let winnerName = tdm.winnerName || null;
  if(!winnerName){
    if(scoreA > scoreB) winnerName = teamAName;
    else if(scoreB > scoreA) winnerName = teamBName;
    else winnerName = "Draw";
  }

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = reason ? `Reason: ${reason}` : "Final standings.";

  const winner = document.createElement("div");
  winner.style.fontWeight = "900";
  winner.style.fontSize = "18px";
  winner.textContent = `Winner: ${winnerName}`;

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  grid.style.gap = "8px";
  grid.appendChild(resultCard(teamAName, scoreA));
  grid.appendChild(resultCard(teamBName, scoreB));

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.justifyContent = "flex-end";
  row.appendChild(Button({ text: "Continue", onClick: ()=>onContinue?.() }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(winner);
  panel.appendChild(grid);
  panel.appendChild(row);
  screen.appendChild(panel);
  return screen;
}
