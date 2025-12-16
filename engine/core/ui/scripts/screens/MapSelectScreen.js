import { Button } from "../widgets/Button.js";

function MapCard({ map, selected, onSelect }){
  const card = document.createElement("button");
  card.type = "button";
  card.style.all = "unset";
  card.style.cursor = map.disabled ? "not-allowed" : "pointer";
  card.style.display = "grid";
  card.style.gridTemplateRows = "140px 1fr";
  card.style.border = selected ? "2px solid var(--ui-accent)" : "1px solid rgba(255,255,255,0.12)";
  card.style.background = "rgba(0,0,0,0.2)";
  card.style.borderRadius = "14px";
  card.style.overflow = "hidden";
  card.style.opacity = map.disabled ? "0.6" : "1";

  const img = document.createElement("div");
  img.style.background = map.preview ? `center / cover url(${map.preview})` : "linear-gradient(145deg, #1f2642, #151a2b)";
  img.style.height = "100%";

  const body = document.createElement("div");
  body.style.padding = "10px 12px 12px 12px";
  body.style.display = "grid";
  body.style.alignContent = "start";
  body.style.gap = "6px";

  const name = document.createElement("div");
  name.style.fontWeight = "900";
  name.style.fontSize = "16px";
  name.textContent = map.name;

  const desc = document.createElement("div");
  desc.className = "dz-help";
  desc.textContent = map.desc || "";

  body.appendChild(name);
  body.appendChild(desc);

  card.appendChild(img);
  card.appendChild(body);

  if(!map.disabled){
    card.addEventListener("click", ()=>onSelect?.(map.id));
  }

  return card;
}

export function MapSelectScreen({ mode="zm", maps=[], selectedId=null, onSelect, onBack, onPlay }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";
  let current = selectedId;

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 94vw)";
  panel.style.padding = "16px";

  const title = document.createElement("h1");
  title.className = "dz-title";
  title.textContent = "SELECT MAP";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = mode === "mp"
    ? "Pick a Multiplayer battleground."
    : "Pick a Zombies survival arena.";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(240px, 1fr))";
  grid.style.gap = "12px";
  grid.style.marginTop = "12px";

  function renderCards(){
    grid.innerHTML = "";
    for(const m of maps){
      const card = MapCard({
        map: m,
        selected: String(m.id) === String(current),
        onSelect: (id)=>{
          current = id;
          onSelect?.(id);
          renderCards();
        }
      });
      grid.appendChild(card);
    }
  }
  renderCards();

  const actions = document.createElement("div");
  actions.className = "dz-row";
  actions.style.marginTop = "12px";
  actions.appendChild(Button({ text: "Back", variant: "secondary", onClick: ()=>onBack?.() }));
  actions.appendChild(Button({ text: "Play", onClick: ()=>onPlay?.(current), variant: "primary" }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(actions);
  screen.appendChild(panel);
  return screen;
}
