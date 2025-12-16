import { Button } from "/engine/core/ui/scripts/widgets/Button.js";

function injectStyles(){
  if(document.getElementById("dz-lobby-styles")) return;
  const style = document.createElement("style");
  style.id = "dz-lobby-styles";
  style.textContent = `
    .dz-lobby-screen{
      background:
        radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--ui-accent) 14%, transparent), transparent 45%),
        radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--ui-accent2) 16%, transparent), transparent 50%),
        rgba(0,0,0,0.70);
      color: var(--ui-text);
      font-family: var(--ui-font);
      padding: 18px;
      box-sizing: border-box;
    }
    .dz-lobby-layout{
      width: min(1280px, 96vw);
      height: min(90vh, 880px);
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 16px;
      background: color-mix(in srgb, var(--ui-panel) 70%, rgba(0,0,0,0.45));
      border: 1px solid var(--ui-panel-border);
      border-radius: 18px;
      box-shadow: 0 18px 50px var(--ui-shadow);
      padding: 14px;
      position: relative;
      overflow: hidden;
    }
    .dz-lobby-panel{
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
    .dz-lobby-title{
      font-size: 22px;
      font-weight: 950;
      margin: 0;
      letter-spacing: 0.06em;
    }
    .dz-lobby-sub{
      color: var(--ui-text-dim);
      margin: 0;
      font-size: 13px;
    }
    .dz-lobby-map-row{
      position: absolute;
      left: 50%;
      bottom: 60px;
      transform: translateX(-50%);
      display: grid;
      grid-template-columns: repeat(2, minmax(260px, 320px));
      gap: 12px;
      justify-content: center;
      width: 100%;
      pointer-events: auto;
    }
    .dz-lobby-map-card{
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.30);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
      display: grid;
      grid-template-rows: 180px auto;
    }
    .dz-lobby-map-card:hover{
      transform: translateY(-3px);
      box-shadow: 0 14px 32px rgba(0,0,0,0.45);
    }
    .dz-lobby-map-card.disabled{
      cursor: not-allowed;
      opacity: 0.65;
      filter: grayscale(0.35);
    }
    .dz-lobby-map-img{
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: linear-gradient(135deg, rgba(31,38,66,0.9), rgba(18,22,40,0.9));
    }
    .dz-lobby-map-body{
      padding: 10px 12px 12px 12px;
      display: grid;
      gap: 4px;
    }
    .dz-lobby-map-name{
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .dz-lobby-map-votes{
      position: absolute;
      right: 10px;
      top: 10px;
      padding: 6px 10px;
      border-radius: 12px;
      background: color-mix(in srgb, var(--ui-panel) 60%, rgba(0,0,0,0.65));
      border: 1px solid color-mix(in srgb, var(--ui-accent) 35%, transparent);
      font-weight: 800;
      font-size: 12px;
    }
    .dz-lobby-players{
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }
    .dz-lobby-slot{
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 10px 12px;
      background: rgba(0,0,0,0.25);
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      min-height: 46px;
    }
    .dz-lobby-slot-empty{
      color: var(--ui-text-dim);
      font-style: italic;
    }
    .dz-lobby-dot{
      width: 12px;
      height: 12px;
      border-radius: 999px;
      margin-right: 8px;
      background: gray;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.1);
    }
    .dz-lobby-row{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .dz-lobby-motd{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 10px 14px;
      background: rgba(5,6,10,0.70);
      border-top: 1px solid var(--ui-panel-border);
      font-weight: 700;
      letter-spacing: 0.01em;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

export class LobbyUI {
  constructor({ state, onBack, onReadyToggle, onVote, onStart, onCreateClass, getLocalPlayerId }){
    this.state = state;
    this.onBack = onBack;
    this.onReadyToggle = onReadyToggle;
    this.onVote = onVote;
    this.onStart = onStart;
    this.onCreateClass = onCreateClass;
    this.getLocalPlayerId = getLocalPlayerId || (()=>null);

    injectStyles();
    this.screen = document.createElement("div");
    this.screen.className = "dz-screen dz-lobby-screen";

    this.layout = document.createElement("div");
    this.layout.className = "dz-lobby-layout";
    this.screen.appendChild(this.layout);

    this.left = document.createElement("div");
    this.left.className = "dz-lobby-panel";
    this.left.style.position = "relative";
    this.left.style.minHeight = "0";

    this.right = document.createElement("div");
    this.right.className = "dz-lobby-panel";
    this.right.style.minHeight = "0";

    this.layout.appendChild(this.left);
    this.layout.appendChild(this.right);

    // Left content
    const title = document.createElement("h1");
    title.className = "dz-lobby-title";
    title.textContent = "LOBBY";

    this.modeSub = document.createElement("div");
    this.modeSub.className = "dz-lobby-sub";
    this.modeSub.textContent = "";

    const actionRow = document.createElement("div");
    actionRow.className = "dz-lobby-row";
    const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>this.onBack?.() });
    this.classBtn = Button({ text:"Create a Class", onClick: ()=>this.onCreateClass?.() });
    actionRow.appendChild(backBtn);
    actionRow.appendChild(this.classBtn);

    const voteLabel = document.createElement("div");
    voteLabel.className = "dz-lobby-sub";
    voteLabel.textContent = "Map Vote";

    this.readyBtn = Button({ text:"Ready Up", onClick: ()=>this.onReadyToggle?.() });
    this.readyStatus = document.createElement("div");
    this.readyStatus.className = "dz-lobby-sub";
    this.readyStatus.style.fontWeight = "700";
    this.readyStatus.style.fontSize = "14px";

    this.startRow = document.createElement("div");
    this.startRow.className = "dz-lobby-row";
    this.startBtn = Button({ text:"Start (Host)", onClick: ()=>this.onStart?.() });
    this.waitingLabel = document.createElement("div");
    this.waitingLabel.className = "dz-lobby-sub";
    this.waitingLabel.textContent = "Waiting for host...";
    this.startRow.appendChild(this.startBtn);
    this.startRow.appendChild(this.waitingLabel);

    this.left.appendChild(title);
    this.left.appendChild(this.modeSub);
    this.left.appendChild(actionRow);
    this.left.appendChild(voteLabel);
    this.left.appendChild(this.readyBtn);
    this.left.appendChild(this.readyStatus);
    this.left.appendChild(this.startRow);

    // Map cards (bottom center)
    this.mapRow = document.createElement("div");
    this.mapRow.className = "dz-lobby-map-row";
    this.layout.appendChild(this.mapRow);

    // Right content (players)
    const pTitle = document.createElement("div");
    pTitle.className = "dz-lobby-title";
    pTitle.textContent = "PLAYERS";

    this.playerList = document.createElement("div");
    this.playerList.className = "dz-lobby-players";

    this.right.appendChild(pTitle);
    this.right.appendChild(this.playerList);

    // MOTD
    this.motdBar = document.createElement("div");
    this.motdBar.className = "dz-lobby-motd";
    this.motdBar.textContent = "";
    this.layout.appendChild(this.motdBar);
  }

  mount(layer){
    if(layer && this.screen.parentElement !== layer){
      layer.innerHTML = "";
      layer.appendChild(this.screen);
    }
  }

  update(){
    const s = this.state;
    const localId = this.getLocalPlayerId();
    const readyCount = s.getReadyCount();
    const total = s.getConnectedCount();
    const needed = s.getRequiredReady();
    const canStart = s.isReadyToStart();
    const hostId = s.getHostId();
    const isHost = hostId && localId && hostId === String(localId);

    this.modeSub.textContent = (s.mode === "mp") ? "Multiplayer Lobby" : "Zombies Lobby";
    this.readyStatus.textContent = `Ready: ${readyCount}/${total} (Need >= ${needed || 0})`;

    const localReady = localId ? Boolean(s.readyByPlayerId.get(String(localId))) : false;
    this.readyBtn.textContent = localReady ? "Unready" : "Ready Up";

    // Start controls
    this.startBtn.style.display = isHost ? "" : "none";
    this.startBtn.disabled = !canStart;
    this.waitingLabel.style.display = isHost ? "none" : "";
    this.waitingLabel.textContent = canStart ? "Waiting for host..." : "Waiting for players...";

    // Map cards
    this.renderMaps(localId);
    this.renderPlayers(localId);

    this.motdBar.textContent = s.motd || "";
  }

  renderMaps(localId){
    this.mapRow.innerHTML = "";
    const counts = this.state.getVoteCounts();
    const localVote = localId ? this.state.getPlayerVote(localId) : null;

    for(const map of this.state.maps){
      const card = document.createElement("div");
      card.className = "dz-lobby-map-card";
      if(map.disabled || !map.entryScript) card.classList.add("disabled");
      if(localVote && String(localVote) === String(map.id)){
        card.style.outline = "2px solid var(--ui-accent)";
        card.style.outlineOffset = "-2px";
      }
      const img = document.createElement("div");
      img.className = "dz-lobby-map-img";
      img.style.backgroundImage = map.preview ? `url(${map.preview})` : "linear-gradient(135deg,#1f2642,#0e1322)";
      card.appendChild(img);

      const body = document.createElement("div");
      body.className = "dz-lobby-map-body";
      const name = document.createElement("div");
      name.className = "dz-lobby-map-name";
      name.textContent = map.name || map.id;
      const desc = document.createElement("div");
      desc.className = "dz-lobby-sub";
      desc.textContent = map.desc || (map.disabled ? "Coming soon." : "");
      body.appendChild(name);
      body.appendChild(desc);
      card.appendChild(body);

      const badge = document.createElement("div");
      badge.className = "dz-lobby-map-votes";
      const votes = counts.get(String(map.id)) || 0;
      badge.textContent = `Votes: ${votes}`;
      card.appendChild(badge);

      if(map.disabled || !map.entryScript){
        card.addEventListener("click", ()=>{
          this.waitingLabel.textContent = "Coming soon";
        });
      } else {
        card.addEventListener("click", ()=>{
          this.onVote?.(map.id);
        });
      }

      this.mapRow.appendChild(card);
    }
  }

  renderPlayers(localId){
    this.playerList.innerHTML = "";
    const maxSlots = this.state.mode === "mp" ? 12 : 4;
    const players = this.state.players.slice(0, maxSlots);
    const voteLookup = this.state.voteByPlayerId;
    const mapsById = new Map(this.state.maps.map(m => [String(m.id), m]));

    for(let i=0;i<maxSlots;i++){
      const slot = document.createElement("div");
      slot.className = "dz-lobby-slot";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "8px";

      const dot = document.createElement("div");
      dot.className = "dz-lobby-dot";
      const p = players[i];
      if(p){
        const ready = this.state.readyByPlayerId.get(String(p.id)) || false;
        dot.style.background = ready ? "#45d483" : "gray";
        const name = document.createElement("div");
        name.textContent = p.name || `Player ${p.id}`;
        if(localId && String(p.id) === String(localId)){
          name.textContent += " (You)";
        }
        left.appendChild(dot);
        left.appendChild(name);

        const vote = voteLookup.get(String(p.id));
        const voteText = document.createElement("div");
        voteText.className = "dz-lobby-sub";
        voteText.style.fontSize = "12px";
        voteText.textContent = vote ? `Vote: ${mapsById.get(String(vote))?.name || vote}` : "No vote";

        slot.appendChild(left);
        slot.appendChild(voteText);
      } else {
        dot.style.background = "rgba(255,255,255,0.15)";
        const empty = document.createElement("div");
        empty.className = "dz-lobby-slot-empty";
        empty.textContent = "pending player...";
        left.appendChild(dot);
        left.appendChild(empty);
        slot.appendChild(left);
      }

      this.playerList.appendChild(slot);
    }
  }
}
