import { Button } from "../widgets/Button.js";

function MapCard({ map, selected, onSelect }){
  const card = document.createElement("button");
  card.type = "button";
  card.style.all = "unset";
  card.style.cursor = map.disabled ? "not-allowed" : "pointer";
  card.style.display = "grid";
  card.style.gridTemplateRows = "120px 1fr";
  card.style.border = selected ? "1px solid var(--ui-accent)" : "1px solid rgba(255,255,255,0.14)";
  card.style.background = "rgba(0,0,0,0.35)";
  card.style.borderRadius = "6px";
  card.style.overflow = "hidden";
  card.style.opacity = map.disabled ? "0.6" : "1";
  card.style.transition = "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease";

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
  name.style.fontSize = "13px";
  name.style.letterSpacing = "0.16em";
  name.style.textTransform = "uppercase";
  name.textContent = map.name;

  const desc = document.createElement("div");
  desc.className = "dz-help";
  desc.style.fontSize = "11px";
  desc.style.letterSpacing = "0.04em";
  desc.textContent = map.desc || "";

  body.appendChild(name);
  body.appendChild(desc);

  card.appendChild(img);
  card.appendChild(body);

  if(!map.disabled){
    card.addEventListener("click", ()=>onSelect?.(map.id));
  }
  card.addEventListener("mouseenter", ()=>{
    name.style.animation = "dz-ui-text-fade 1.1s ease-in-out infinite";
    desc.style.animation = "dz-ui-text-fade 1.1s ease-in-out infinite";
    card.style.transform = "translateY(-2px)";
    card.style.boxShadow = "0 10px 24px rgba(0,0,0,0.45)";
    if(!selected){
      card.style.borderColor = "rgba(255,255,255,0.22)";
    }
  });
  card.addEventListener("mouseleave", ()=>{
    name.style.animation = "";
    desc.style.animation = "";
    card.style.transform = "";
    card.style.boxShadow = "";
    card.style.borderColor = selected ? "var(--ui-accent)" : "rgba(255,255,255,0.14)";
  });

  return card;
}

export function MapSelectScreen({ mode="zm", maps=[], selectedId=null, onSelect, onBack, onPlay }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";
  let current = selectedId;

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 94vw)";
  panel.style.padding = "12px";

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
  grid.style.gap = "10px";
  grid.style.marginTop = "10px";

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
  actions.style.marginTop = "10px";
  actions.appendChild(Button({ text: "Back", variant: "secondary", onClick: ()=>onBack?.() }));
  actions.appendChild(Button({ text: "Play", onClick: ()=>onPlay?.(current), variant: "primary" }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(actions);
  screen.appendChild(panel);
  return screen;
}
