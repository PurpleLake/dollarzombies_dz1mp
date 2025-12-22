import { Button } from "../widgets/Button.js";

function ModeCard({ mode, selected, onSelect }){
  const card = document.createElement("button");
  card.type = "button";
  card.style.all = "unset";
  card.style.cursor = "pointer";
  card.style.display = "grid";
  card.style.gridTemplateRows = "1fr";
  card.style.border = selected ? "1px solid var(--ui-accent)" : "1px solid rgba(255,255,255,0.14)";
  card.style.background = "rgba(0,0,0,0.35)";
  card.style.borderRadius = "6px";
  card.style.padding = "14px";
  card.style.transition = "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease";

  const name = document.createElement("div");
  name.style.fontWeight = "900";
  name.style.fontSize = "14px";
  name.style.letterSpacing = "0.16em";
  name.style.textTransform = "uppercase";
  name.textContent = mode.name;

  const code = document.createElement("div");
  code.className = "dz-help";
  code.style.fontSize = "11px";
  code.style.letterSpacing = "0.08em";
  code.textContent = mode.code || mode.id || "";

  const desc = document.createElement("div");
  desc.className = "dz-help";
  desc.style.fontSize = "11px";
  desc.style.letterSpacing = "0.04em";
  desc.style.marginTop = "6px";
  desc.textContent = mode.desc || "";

  card.appendChild(name);
  card.appendChild(code);
  card.appendChild(desc);

  card.addEventListener("click", ()=>onSelect?.(mode.id));
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

export function MpModeSelectScreen({ modes = [], selectedId = null, onSelect, onBack, onContinue }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";
  let current = selectedId || (modes[0]?.id ?? null);

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(900px, 94vw)";
  panel.style.padding = "12px";

  const title = document.createElement("h1");
  title.className = "dz-title";
  title.textContent = "MULTIPLAYER MODES";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Choose a game type before entering the lobby.";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
  grid.style.gap = "10px";
  grid.style.marginTop = "10px";

  function renderCards(){
    grid.innerHTML = "";
    for(const m of modes){
      const card = ModeCard({
        mode: m,
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
  actions.appendChild(Button({ text: "Continue", onClick: ()=>onContinue?.(current), variant: "primary" }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(actions);
  screen.appendChild(panel);
  return screen;
}
