import { Button } from "../widgets/Button.js";

function modeCard({ title, desc, imgA, imgB, onPick }){
  const card = document.createElement("button");
  card.type="button";
  card.style.all="unset";
  card.style.cursor="pointer";
  card.style.display="grid";
  card.style.gridTemplateRows="auto 1fr";
  card.style.border="1px solid rgba(255,255,255,0.10)";
  card.style.background="rgba(0,0,0,0.20)";
  card.style.borderRadius="16px";
  card.style.overflow="hidden";
  card.style.minHeight="220px";

  const img = document.createElement("img");
  img.src = imgA;
  img.alt = title;
  img.style.width="100%";
  img.style.height="160px";
  img.style.objectFit="cover";
  img.style.display="block";

  card.addEventListener("mouseenter", ()=>{ img.src = imgB; });
  card.addEventListener("mouseleave", ()=>{ img.src = imgA; });
  card.addEventListener("click", ()=>onPick?.());

  const body = document.createElement("div");
  body.style.padding="12px";

  const h = document.createElement("div");
  h.style.fontWeight="950";
  h.style.fontSize="18px";
  h.textContent = title;

  const p = document.createElement("div");
  p.className="dz-help";
  p.style.marginTop="6px";
  p.textContent = desc;

  body.appendChild(h);
  body.appendChild(p);

  card.appendChild(img);
  card.appendChild(body);
  return card;
}

export function MainMenuScreen({ onPlay, onClass, onSettings, mode="zm", onMode }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(980px, 94vw)";
  panel.style.padding = "18px";

  const title = document.createElement("h1");
  title.className = "dz-title";
  title.textContent = "Dollar Zombies Engine";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Pick a mode. Hover the card to preview.";

  const grid = document.createElement("div");
  grid.style.display="grid";
  grid.style.gridTemplateColumns="1fr 1fr";
  grid.style.gap="14px";
  grid.style.marginTop="14px";

  const zm = modeCard({
    title:"Zombies (Co-op)",
    desc:"Up to 4 players. Survive waves, buy guns, script the map.",
    imgA:"/public/assets/modes/zm.png",
    imgB:"/public/assets/modes/zm_hover.png",
    onPick: ()=>onMode?.("zm"),
  });

  const mp = modeCard({
    title:"Multiplayer (6v6)",
    desc:"Prototype netcode + player sync. Team support scaffolding.",
    imgA:"/public/assets/modes/mp.png",
    imgB:"/public/assets/modes/mp_hover.png",
    onPick: ()=>onMode?.("mp"),
  });

  grid.appendChild(zm);
  grid.appendChild(mp);

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.marginTop="14px";
  row.appendChild(Button({ text: (mode==="mp" ? "Start Multiplayer" : "Start Zombies"), onClick: ()=>onPlay?.() }));
  row.appendChild(Button({ text:"Loadout", variant:"secondary", onClick: ()=>onClass?.() }));
  row.appendChild(Button({ text:"Settings", variant:"secondary", onClick: ()=>onSettings?.() }));

  const hint = document.createElement("div");
  hint.className = "dz-help";
  hint.style.marginTop="10px";
  hint.textContent = "In-game: Mouse Wheel or 1-6 switch weapons, R reload, Esc pause.";

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(row);
  panel.appendChild(hint);

  screen.appendChild(panel);
  return screen;
}
