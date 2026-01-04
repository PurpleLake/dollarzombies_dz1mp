import { Button } from "../widgets/Button.js";

function modeCard({ title, desc, imgA, imgB, onPick }){
  const card = document.createElement("button");
  card.type="button";
  card.style.all="unset";
  card.style.cursor="pointer";
  card.style.display="grid";
  card.style.gridTemplateRows="auto 1fr";
  card.style.border="1px solid rgba(255,255,255,0.14)";
  card.style.background="rgba(0,0,0,0.35)";
  card.style.borderRadius="6px";
  card.style.overflow="hidden";
  card.style.minHeight="200px";
  card.style.transition="transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease";

  const img = document.createElement("img");
  img.src = imgA;
  img.alt = title;
  img.style.width="100%";
  img.style.height="140px";
  img.style.objectFit="cover";
  img.style.display="block";

  function setHover(active){
    const anim = active ? "dz-ui-text-fade 1.1s ease-in-out infinite" : "";
    h.style.animation = anim;
    p.style.animation = anim;
  }
  card.addEventListener("mouseenter", ()=>{
    img.src = imgB;
    card.style.transform = "translateY(-2px)";
    card.style.boxShadow = "0 10px 24px rgba(0,0,0,0.45)";
    card.style.borderColor = "rgba(255,255,255,0.22)";
    setHover(true);
  });
  card.addEventListener("mouseleave", ()=>{
    img.src = imgA;
    card.style.transform = "";
    card.style.boxShadow = "";
    card.style.borderColor = "";
    setHover(false);
  });
  card.addEventListener("click", ()=>onPick?.());

  const body = document.createElement("div");
  body.style.padding="10px";

  const h = document.createElement("div");
  h.style.fontWeight="900";
  h.style.fontSize="14px";
  h.style.letterSpacing="0.16em";
  h.style.textTransform="uppercase";
  h.textContent = title;

  const p = document.createElement("div");
  p.className="dz-help";
  p.style.marginTop="6px";
  p.style.fontSize="11px";
  p.style.letterSpacing="0.04em";
  p.textContent = desc;

  body.appendChild(h);
  body.appendChild(p);

  card.appendChild(img);
  card.appendChild(body);
  return card;
}

export function MainMenuScreen({ onPlay, onClass, onSettings, mode="zm", onMode, onBrowser, playerName="", onName, soloOnly=false, onProfile, onCustomGames }){
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
  sub.textContent = soloOnly
    ? "Solo zombies only for this host."
    : "Pick a mode. Hover the card to preview.";

  const grid = document.createElement("div");
  grid.style.display="grid";
  grid.style.gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))";
  grid.style.gap="10px";
  grid.style.marginTop="10px";

  const nameRow = document.createElement("div");
  nameRow.className = "dz-row";
  nameRow.style.marginTop = "10px";
  const nameLabel = document.createElement("div");
  nameLabel.className = "dz-help";
  nameLabel.textContent = "Username";
  const nameInput = document.createElement("input");
  nameInput.className = "dz-input";
  nameInput.placeholder = "Player";
  nameInput.maxLength = 20;
  nameInput.value = String(playerName || "");
  nameInput.addEventListener("input", ()=> onName?.(nameInput.value));
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);

  function focusNameInput(){
    try{
      nameRow.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
    nameInput.focus();
    nameInput.select();
  }

  const zm = modeCard({
    title:"Zombies (Co-op)",
    desc:"Up to 4 players. Survive waves, buy guns, script the map.",
    imgA:"/public/assets/modes/zm.png",
    imgB:"/public/assets/modes/zm_hover.png",
    onPick: ()=>onMode?.("zm"),
  });

  const zmSolo = modeCard({
    title:"Zombies (Solo)",
    desc:"Single player. Same waves and weapons, no matchmaking.",
    imgA:"/public/assets/modes/zm.png",
    imgB:"/public/assets/modes/zm_hover.png",
    onPick: ()=>onMode?.("zm_solo"),
  });

  const mp = modeCard({
    title:"Multiplayer (6v6)",
    desc:"Prototype netcode + player sync. Team support scaffolding.",
    imgA:"/public/assets/modes/mp.png",
    imgB:"/public/assets/modes/mp_hover.png",
    onPick: ()=>onMode?.("mp"),
  });

  const profile = modeCard({
    title:"Create Profile",
    desc:"Set your username and get ready to drop in.",
    imgA:"/public/assets/ui/maps/zm_facility.png",
    imgB:"/public/assets/ui/maps/mp_arena.png",
    onPick: ()=> onProfile ? onProfile() : focusNameInput(),
  });

  const custom = modeCard({
    title:"Custom Games",
    desc:"Host private matches and load your custom maps.",
    imgA:"/public/assets/ui/maps/mp_arena.png",
    imgB:"/public/assets/ui/maps/zm_facility.png",
    onPick: ()=> onCustomGames?.(),
  });

  if(soloOnly){
    grid.appendChild(zmSolo);
  } else {
    grid.appendChild(zm);
    grid.appendChild(zmSolo);
    grid.appendChild(mp);
  }
  grid.appendChild(profile);
  grid.appendChild(custom);

  const row = document.createElement("div");
  row.className = "dz-row";
  row.style.marginTop="10px";
  const startLabel = mode === "mp"
    ? "Start Multiplayer"
    : (mode === "zm_solo" ? "Start Solo Zombies" : "Start Zombies");
  row.appendChild(Button({ text: startLabel, onClick: ()=>onPlay?.() }));
  row.appendChild(Button({ text:"Loadout", variant:"secondary", onClick: ()=>onClass?.() }));
  row.appendChild(Button({ text:"Settings", variant:"secondary", onClick: ()=>onSettings?.() }));
  if(onBrowser){
    row.appendChild(Button({ text:"Server Browser", variant:"secondary", onClick: ()=>onBrowser?.() }));
  }

  const hint = document.createElement("div");
  hint.className = "dz-help";
  hint.style.marginTop="8px";
  hint.textContent = "In-game: Mouse Wheel or 1-6 switch weapons, R reload, Esc pause.";

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(row);
  panel.appendChild(nameRow);
  panel.appendChild(hint);

  screen.appendChild(panel);
  return screen;
}
