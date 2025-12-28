import { Button } from "../widgets/Button.js";

function listItem({ title, meta, desc, selected, disabled, onSelect }){
  const item = document.createElement("button");
  item.type = "button";
  item.className = "dz-prelobby-item" + (selected ? " is-active" : "");
  if(disabled) item.classList.add("is-disabled");
  item.disabled = Boolean(disabled);
  item.innerHTML = `
    <div class="dz-prelobby-item-bar"></div>
    <div class="dz-prelobby-item-body">
      <div class="dz-prelobby-item-title">${title}</div>
      <div class="dz-prelobby-item-meta">${meta || ""}</div>
      <div class="dz-prelobby-item-desc">${desc || ""}</div>
    </div>
  `;
  item.addEventListener("click", ()=>onSelect?.());
  return item;
}

export function PreLobbyScreen({
  mode = "zm",
  maps = [],
  selectedMapId = null,
  gamemodes = [],
  selectedGamemode = null,
  preferSolo = false,
  onSelectMap,
  onSelectGamemode,
  onEditClass,
  onBack,
  onFindMatch,
  onPlaySolo,
}){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const shell = document.createElement("div");
  shell.className = "dz-prelobby";

  const header = document.createElement("div");
  header.className = "dz-prelobby-header";

  const heading = document.createElement("div");
  heading.className = "dz-prelobby-heading";
  heading.textContent = mode === "mp" ? "MULTIPLAYER" : "ZOMBIES";

  const headerRight = document.createElement("div");
  headerRight.className = "dz-prelobby-header-right";
  headerRight.textContent = mode === "mp" ? "PREGAME LOBBY" : "MATCH SETUP";

  header.appendChild(heading);
  header.appendChild(headerRight);

  const grid = document.createElement("div");
  grid.className = "dz-prelobby-grid";

  const left = document.createElement("div");
  left.className = "dz-prelobby-left";

  const leftTitle = document.createElement("div");
  leftTitle.className = "dz-prelobby-section-title";
  leftTitle.textContent = mode === "mp" ? "GAME MODES" : "MAP SELECT";

  const leftList = document.createElement("div");
  leftList.className = "dz-prelobby-list";

  const right = document.createElement("div");
  right.className = "dz-prelobby-right";

  const preview = document.createElement("div");
  preview.className = "dz-prelobby-preview";

  const info = document.createElement("div");
  info.className = "dz-prelobby-info";

  let currentMap = selectedMapId || maps.find(m=>!m.disabled)?.id || maps[0]?.id || null;
  let currentMode = selectedGamemode || gamemodes[0]?.id || null;

  function renderLeft(){
    leftList.innerHTML = "";
    if(mode === "mp"){
      for(const gm of gamemodes){
        const selected = String(gm.id) === String(currentMode);
        leftList.appendChild(listItem({
          title: gm.name || gm.id,
          meta: gm.code || gm.id,
          desc: gm.desc || "",
          selected,
          disabled: false,
          onSelect: ()=>{
            currentMode = gm.id;
            onSelectGamemode?.(gm.id);
            renderLeft();
            renderRight();
          }
        }));
      }
    } else {
      for(const m of maps){
        const selected = String(m.id) === String(currentMap);
        leftList.appendChild(listItem({
          title: m.name || m.id,
          meta: m.id || "",
          desc: m.desc || "",
          selected,
          disabled: Boolean(m.disabled),
          onSelect: ()=>{
            if(m.disabled) return;
            currentMap = m.id;
            onSelectMap?.(m.id);
            renderLeft();
            renderRight();
          }
        }));
      }
    }
  }

  function renderRight(){
    preview.innerHTML = "";
    info.innerHTML = "";
    if(mode === "mp"){
      const gm = gamemodes.find(g=>String(g.id) === String(currentMode)) || gamemodes[0];
      preview.classList.add("is-mode");
      preview.style.backgroundImage = "";
      const title = document.createElement("div");
      title.className = "dz-prelobby-preview-title";
      title.textContent = gm?.name || "Game Mode";
      const meta = document.createElement("div");
      meta.className = "dz-prelobby-preview-meta";
      meta.textContent = gm?.code || gm?.id || "";
      const desc = document.createElement("div");
      desc.className = "dz-prelobby-preview-desc";
      desc.textContent = gm?.desc || "Eliminate the enemy team.";
      preview.appendChild(title);
      preview.appendChild(meta);
      preview.appendChild(desc);

      const detail = document.createElement("div");
      detail.className = "dz-prelobby-info-card";
      detail.innerHTML = `
        <div class="dz-prelobby-info-title">RULES</div>
        <div class="dz-prelobby-info-body">Score limit and time settings are applied in the lobby.</div>
      `;
      info.appendChild(detail);
    } else {
      const m = maps.find(mp=>String(mp.id) === String(currentMap)) || maps[0];
      preview.classList.remove("is-mode");
      if(m?.preview) preview.style.backgroundImage = `url(${m.preview})`;
      else preview.style.backgroundImage = "";
      const title = document.createElement("div");
      title.className = "dz-prelobby-preview-title";
      title.textContent = m?.name || "Map";
      const meta = document.createElement("div");
      meta.className = "dz-prelobby-preview-meta";
      meta.textContent = "ZOMBIES";
      const desc = document.createElement("div");
      desc.className = "dz-prelobby-preview-desc";
      desc.textContent = m?.desc || "Survive as long as you can.";
      preview.appendChild(title);
      preview.appendChild(meta);
      preview.appendChild(desc);

      const detail = document.createElement("div");
      detail.className = "dz-prelobby-info-card";
      detail.innerHTML = `
        <div class="dz-prelobby-info-title">MATCH NOTES</div>
        <div class="dz-prelobby-info-body">Co-op survival. Loadouts are pulled from your Zombies classes.</div>
      `;
      info.appendChild(detail);
    }
  }

  renderLeft();
  renderRight();

  left.appendChild(leftTitle);
  left.appendChild(leftList);

  right.appendChild(preview);

  const classCard = document.createElement("button");
  classCard.type = "button";
  classCard.className = "dz-prelobby-class";
  classCard.innerHTML = `
    <div class="dz-prelobby-class-title">EDIT CLASSES</div>
    <div class="dz-prelobby-class-sub">Customize your loadout before you enter the lobby.</div>
  `;
  classCard.addEventListener("click", ()=>onEditClass?.());

  right.appendChild(classCard);
  right.appendChild(info);

  grid.appendChild(left);
  grid.appendChild(right);

  const actions = document.createElement("div");
  actions.className = "dz-prelobby-actions";

  const backBtn = Button({ text: "Back", variant: "secondary", onClick: ()=>onBack?.() });
  backBtn.classList.add("dz-prelobby-btn", "is-secondary");
  actions.appendChild(backBtn);

  if(mode === "mp"){
    const findBtn = Button({ text: "Find Game", onClick: ()=>onFindMatch?.() });
    findBtn.classList.add("dz-prelobby-btn", "is-primary");
    actions.appendChild(findBtn);
  } else {
    const findBtn = Button({ text: "Find Match", onClick: ()=>onFindMatch?.() });
    const soloBtn = Button({ text: "Play Solo", variant: "secondary", onClick: ()=>onPlaySolo?.() });
    findBtn.classList.add("dz-prelobby-btn", preferSolo ? "is-secondary" : "is-primary");
    soloBtn.classList.add("dz-prelobby-btn", preferSolo ? "is-primary" : "is-secondary");
    if(preferSolo){
      actions.appendChild(soloBtn);
      actions.appendChild(findBtn);
    } else {
      actions.appendChild(findBtn);
      actions.appendChild(soloBtn);
    }
  }

  shell.appendChild(header);
  shell.appendChild(grid);
  shell.appendChild(actions);
  screen.appendChild(shell);
  return screen;
}
