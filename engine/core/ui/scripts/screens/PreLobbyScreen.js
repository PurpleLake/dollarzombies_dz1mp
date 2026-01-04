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
  matchType = "public",
  maps = [],
  customMaps = [],
  selectedMapId = null,
  preferSolo = false,
  onSelectMap,
  onSelectMatchType,
  onEditClass,
  onBack,
  onFindPublicGame,
  onCreatePrivateMatch,
  onPlaySolo,
  onImportMap,
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

  const typeTitle = document.createElement("div");
  typeTitle.className = "dz-prelobby-section-title";
  typeTitle.textContent = "MATCH TYPE";

  const typeList = document.createElement("div");
  typeList.className = "dz-prelobby-list";

  const mapTitle = document.createElement("div");
  mapTitle.className = "dz-prelobby-section-title";
  mapTitle.textContent = "MAP SELECT";

  const mapList = document.createElement("div");
  mapList.className = "dz-prelobby-list";

  const mapActions = document.createElement("div");
  mapActions.className = "dz-prelobby-subactions";

  const right = document.createElement("div");
  right.className = "dz-prelobby-right";

  const preview = document.createElement("div");
  preview.className = "dz-prelobby-preview";

  const info = document.createElement("div");
  info.className = "dz-prelobby-info";

  const combinedMaps = [...maps, ...customMaps];
  let currentMap = selectedMapId || combinedMaps.find(m=>!m.disabled)?.id || combinedMaps[0]?.id || null;
  let currentMatchType = matchType || "public";

  function renderMatchTypes(){
    typeList.innerHTML = "";
    const typeDefs = [
      {
        id: "public",
        title: mode === "mp" ? "Public Match" : "Public Co-op",
        meta: "MATCHMAKING",
        desc: mode === "mp"
          ? "Search online and match by gametype."
          : "Search online for a co-op lobby."
      },
      {
        id: "private",
        title: "Private Match",
        meta: "HOST",
        desc: "Create a lobby and invite friends."
      }
    ];
    for(const t of typeDefs){
      const selected = String(t.id) === String(currentMatchType);
      typeList.appendChild(listItem({
        title: t.title,
        meta: t.meta,
        desc: t.desc,
        selected,
        disabled: false,
        onSelect: ()=>{
          currentMatchType = t.id;
          onSelectMatchType?.(t.id);
          renderMatchTypes();
          renderMaps();
          renderRight();
        }
      }));
    }
  }

  function renderMaps(){
    mapList.innerHTML = "";
    mapActions.innerHTML = "";
    const showMaps = currentMatchType === "private" || mode !== "mp";
    mapTitle.style.display = showMaps ? "" : "none";
    mapList.style.display = showMaps ? "" : "none";
    mapActions.style.display = currentMatchType === "private" ? "" : "none";
    if(!showMaps) return;
    if(!combinedMaps.length){
      const empty = document.createElement("div");
      empty.className = "dz-prelobby-info-card";
      empty.innerHTML = `
        <div class="dz-prelobby-info-title">NO MAPS</div>
        <div class="dz-prelobby-info-body">Add a custom map to get started.</div>
      `;
      mapList.appendChild(empty);
      return;
    }
    for(const m of combinedMaps){
      const selected = String(m.id) === String(currentMap);
      const meta = m.isCustom ? "CUSTOM MAP" : (m.id || "");
      mapList.appendChild(listItem({
        title: m.name || m.id,
        meta,
        desc: m.desc || "",
        selected,
        disabled: Boolean(m.disabled),
        onSelect: ()=>{
          if(m.disabled) return;
          currentMap = m.id;
          onSelectMap?.(m.id);
          renderMaps();
          renderRight();
        }
      }));
    }
    if(onImportMap){
      const importBtn = Button({ text: "Import Map", variant: "secondary", onClick: ()=>onImportMap?.() });
      importBtn.classList.add("dz-prelobby-btn", "is-secondary", "is-subaction");
      mapActions.appendChild(importBtn);
    }
  }

  function renderRight(){
    preview.innerHTML = "";
    info.innerHTML = "";
    if(currentMatchType === "public"){
      if(mode === "mp"){
        preview.classList.add("is-mode");
        preview.style.backgroundImage = "";
        const title = document.createElement("div");
        title.className = "dz-prelobby-preview-title";
        title.textContent = "Public Match";
        const meta = document.createElement("div");
        meta.className = "dz-prelobby-preview-meta";
        meta.textContent = "MATCHMAKING";
        const desc = document.createElement("div");
        desc.className = "dz-prelobby-preview-desc";
        desc.textContent = "Pick a gametype, then search for an online lobby.";
        preview.appendChild(title);
        preview.appendChild(meta);
        preview.appendChild(desc);

        const detail = document.createElement("div");
        detail.className = "dz-prelobby-info-card";
        detail.innerHTML = `
          <div class="dz-prelobby-info-title">MATCHMAKING</div>
          <div class="dz-prelobby-info-body">Gametype selection happens before search. Ready up in the lobby once found.</div>
        `;
        info.appendChild(detail);
        return;
      }
    }
    if(currentMatchType !== "public" || mode !== "mp"){
      const m = combinedMaps.find(mp=>String(mp.id) === String(currentMap)) || combinedMaps[0];
      preview.classList.remove("is-mode");
      if(m?.preview) preview.style.backgroundImage = `url(${m.preview})`;
      else preview.style.backgroundImage = "";
      const title = document.createElement("div");
      title.className = "dz-prelobby-preview-title";
      title.textContent = m?.name || "Map";
      const meta = document.createElement("div");
      meta.className = "dz-prelobby-preview-meta";
      meta.textContent = m?.isCustom ? "CUSTOM MAP" : (mode === "mp" ? "MULTIPLAYER" : "ZOMBIES");
      const desc = document.createElement("div");
      desc.className = "dz-prelobby-preview-desc";
      desc.textContent = m?.desc || (mode === "mp" ? "Team up and hold the lanes." : "Survive as long as you can.");
      preview.appendChild(title);
      preview.appendChild(meta);
      preview.appendChild(desc);

      const detail = document.createElement("div");
      detail.className = "dz-prelobby-info-card";
      if(currentMatchType === "private"){
        detail.innerHTML = `
          <div class="dz-prelobby-info-title">PRIVATE LOBBY</div>
          <div class="dz-prelobby-info-body">Host selects the map pool and starts when everyone is ready.</div>
        `;
      } else {
        detail.innerHTML = `
          <div class="dz-prelobby-info-title">PUBLIC MATCH</div>
          <div class="dz-prelobby-info-body">Search for a co-op lobby, then ready up once matched.</div>
        `;
      }
      info.appendChild(detail);

      const customCount = combinedMaps.filter(mp=>mp.isCustom).length;
      if(customCount){
        const customInfo = document.createElement("div");
        customInfo.className = "dz-prelobby-info-card";
        customInfo.innerHTML = `
          <div class="dz-prelobby-info-title">CUSTOM MAPS</div>
          <div class="dz-prelobby-info-body">${customCount} custom map${customCount === 1 ? "" : "s"} available for private play.</div>
        `;
        info.appendChild(customInfo);
      }
    }
  }

  renderMatchTypes();
  renderMaps();
  renderRight();

  left.appendChild(typeTitle);
  left.appendChild(typeList);
  left.appendChild(mapTitle);
  left.appendChild(mapList);
  left.appendChild(mapActions);

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
    if(currentMatchType === "public"){
      const findBtn = Button({ text: "Find Public Game", onClick: ()=>onFindPublicGame?.() });
      findBtn.classList.add("dz-prelobby-btn", "is-primary");
      actions.appendChild(findBtn);
    } else {
      const privateBtn = Button({ text: "Create Private Lobby", onClick: ()=>onCreatePrivateMatch?.() });
      privateBtn.classList.add("dz-prelobby-btn", "is-primary");
      actions.appendChild(privateBtn);
    }
  } else {
    const primaryLabel = currentMatchType === "public" ? "Find Match" : "Create Private Lobby";
    const primaryAction = currentMatchType === "public"
      ? ()=>onFindPublicGame?.()
      : ()=>onCreatePrivateMatch?.();
    const primaryBtn = Button({ text: primaryLabel, onClick: primaryAction });
    const soloBtn = Button({ text: "Play Solo", variant: "secondary", onClick: ()=>onPlaySolo?.() });
    primaryBtn.classList.add("dz-prelobby-btn", preferSolo ? "is-secondary" : "is-primary");
    soloBtn.classList.add("dz-prelobby-btn", preferSolo ? "is-primary" : "is-secondary");
    if(preferSolo){
      actions.appendChild(soloBtn);
      actions.appendChild(primaryBtn);
    } else {
      actions.appendChild(primaryBtn);
      actions.appendChild(soloBtn);
    }
  }

  shell.appendChild(header);
  shell.appendChild(grid);
  shell.appendChild(actions);
  screen.appendChild(shell);
  return screen;
}
