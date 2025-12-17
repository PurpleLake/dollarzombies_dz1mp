import { Button } from "/engine/core/ui/scripts/widgets/Button.js";

function injectStyles(){
  if(document.getElementById("dz-lobby-styles")) return;
  const style = document.createElement("style");
  style.id = "dz-lobby-styles";
  style.textContent = `
    .dz-lobby-screen{
      background:
        repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 6px),
        radial-gradient(circle at 18% 20%, rgba(110,140,110,0.18), transparent 40%),
        radial-gradient(circle at 82% 70%, rgba(200,140,60,0.14), transparent 45%),
        rgba(4,6,8,0.92);
      color: var(--ui-text);
      font-family: "Bahnschrift", "Agency FB", "Arial Narrow", var(--ui-font);
      padding: 12px;
      box-sizing: border-box;
    }
    .dz-lobby-screen.dz-lobby-mp{
      background:
        repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 6px),
        radial-gradient(circle at 12% 18%, rgba(90,110,90,0.34), transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(70,90,70,0.30), transparent 45%),
        #0a0f0a;
    }
    .dz-lobby-layout{
      width: min(1200px, 95vw);
      height: min(84vh, 760px);
      display: grid;
      grid-template-columns: minmax(300px, 36%) 1fr;
      gap: 10px;
      background: rgba(6,8,12,0.55);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      box-shadow: 0 18px 50px rgba(0,0,0,0.6);
      padding: 10px;
      position: relative;
      overflow: hidden;
    }
    .dz-lobby-layout::after{
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.55), transparent 16%, transparent 84%, rgba(0,0,0,0.6));
      pointer-events: none;
      z-index: 0;
    }
    .dz-lobby-layout > *{
      position: relative;
      z-index: 1;
    }
    .dz-lobby-panel{
      background: linear-gradient(180deg, rgba(16,20,28,0.7), rgba(8,10,14,0.85));
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      position: relative;
      overflow: hidden;
      animation: dz-lobby-panel-in 220ms ease-out both;
    }
    .dz-lobby-panel:nth-child(2){
      animation-delay: 60ms;
    }
    .dz-lobby-panel::before{
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.06), transparent 35%, rgba(0,0,0,0.35)),
        linear-gradient(90deg, rgba(255,255,255,0.05), transparent 45%);
      opacity: 0.65;
      pointer-events: none;
    }
    .dz-lobby-panel > *{
      position: relative;
      z-index: 1;
    }
    .dz-lobby-title{
      font-size: 16px;
      font-weight: 900;
      margin: 0;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .dz-lobby-sub{
      color: var(--ui-text-dim);
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    .dz-lobby-label{
      color: var(--ui-text-dim);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .dz-lobby-screen .dz-btn{
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.18);
      color: #f2f2f2;
    }
    .dz-lobby-screen .dz-btn.dz-secondary{
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.12);
    }
    .dz-lobby-screen .dz-btn:hover{
      animation: dz-lobby-text-fade 1.1s ease-in-out infinite;
      filter: none;
    }
    .dz-lobby-map-row{
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      pointer-events: auto;
      margin-top: 4px;
    }
    .dz-lobby-map-card{
      width: 100%;
      position: relative;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.35);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      display: grid;
      grid-template-rows: 96px auto;
    }
    .dz-lobby-map-card:hover{
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(0,0,0,0.45);
      border-color: rgba(255,255,255,0.22);
    }
    .dz-lobby-map-card.disabled{
      cursor: not-allowed;
      opacity: 0.6;
      filter: grayscale(0.45) contrast(0.9);
    }
    .dz-lobby-map-img{
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: linear-gradient(135deg, rgba(30,35,55,0.9), rgba(14,16,28,0.95));
      position: relative;
    }
    .dz-lobby-map-img::after{
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55));
      pointer-events: none;
    }
    .dz-lobby-map-body{
      padding: 8px 10px 10px 10px;
      display: grid;
      gap: 2px;
    }
    .dz-lobby-map-name{
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 13px;
      color: var(--ui-text);
    }
    .dz-lobby-map-card:hover .dz-lobby-map-name{
      animation: dz-lobby-text-fade 1.1s ease-in-out infinite;
    }
    .dz-lobby-map-card:hover .dz-lobby-map-body .dz-lobby-sub{
      animation: dz-lobby-text-fade 1.1s ease-in-out infinite;
    }
    .dz-lobby-map-votes{
      position: absolute;
      right: 6px;
      top: 6px;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255,255,255,0.18);
      font-weight: 800;
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .dz-lobby-players{
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-right: 2px;
    }
    .dz-lobby-slot{
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 6px 8px;
      background: rgba(0,0,0,0.32);
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      min-height: 34px;
      font-size: 12px;
    }
    .dz-lobby-slot-empty{
      color: var(--ui-text-dim);
      font-style: italic;
    }
    .dz-lobby-dot{
      width: 8px;
      height: 8px;
      border-radius: 999px;
      margin-right: 6px;
      background: gray;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.1);
    }
    .dz-lobby-row{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .dz-lobby-motd{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 12px;
      background: rgba(4,6,8,0.82);
      border-top: 1px solid rgba(255,255,255,0.08);
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-size: 11px;
      pointer-events: none;
    }
    .dz-lobby-pending{
      opacity: 0.7;
    }
    .dz-lobby-pending-dot{
      animation: dz-lobby-pulse 1.6s ease-in-out infinite;
    }
    .dz-lobby-pending-text{
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .dz-lobby-pending-text::after{
      content: "...";
      display: inline-block;
      width: 0;
      overflow: hidden;
      vertical-align: bottom;
      animation: dz-lobby-ellipsis 1.3s steps(4, end) infinite;
    }
    @keyframes dz-lobby-panel-in{
      from{opacity:0; transform:translateY(6px);}
      to{opacity:1; transform:translateY(0);}
    }
    @keyframes dz-lobby-card-in{
      from{opacity:0; transform:translateY(6px);}
      to{opacity:1; transform:translateY(0);}
    }
    @keyframes dz-lobby-text-fade{
      0%{color:#ffffff;}
      50%{color:#0a0a0a;}
      100%{color:#ffffff;}
    }
    @keyframes dz-lobby-pulse{
      0%, 100%{opacity:0.35;}
      50%{opacity:1;}
    }
    @keyframes dz-lobby-ellipsis{
      to{width:3ch;}
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
    this.mapCards = new Map();
    this.mapOrder = [];

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
    this.modeSub.classList.add("dz-lobby-label");

    const actionRow = document.createElement("div");
    actionRow.className = "dz-lobby-row";
    const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>this.onBack?.() });
    this.classBtn = Button({ text:"Create a Class", onClick: ()=>this.onCreateClass?.() });
    actionRow.appendChild(backBtn);
    actionRow.appendChild(this.classBtn);

    const voteLabel = document.createElement("div");
    voteLabel.className = "dz-lobby-sub dz-lobby-label";
    voteLabel.textContent = "Map Vote";

    this.readyBtn = Button({ text:"Ready Up", onClick: ()=>this.onReadyToggle?.() });
    this.readyStatus = document.createElement("div");
    this.readyStatus.className = "dz-lobby-sub dz-lobby-label";
    this.readyStatus.style.fontWeight = "700";
    this.readyStatus.style.fontSize = "11px";

    this.startRow = document.createElement("div");
    this.startRow.className = "dz-lobby-row";
    this.startBtn = Button({ text:"Start (Host)", onClick: ()=>this.onStart?.() });
    this.waitingLabel = document.createElement("div");
    this.waitingLabel.className = "dz-lobby-sub dz-lobby-label";
    this.waitingLabel.textContent = "Waiting for host...";
    this.startRow.appendChild(this.startBtn);
    this.startRow.appendChild(this.waitingLabel);

    this.left.appendChild(title);
    this.left.appendChild(this.modeSub);
    this.left.appendChild(actionRow);
    this.left.appendChild(voteLabel);
    // Map cards (stacked)
    this.mapRow = document.createElement("div");
    this.mapRow.className = "dz-lobby-map-row";
    this.left.appendChild(this.mapRow);
    this.left.appendChild(this.readyBtn);
    this.left.appendChild(this.readyStatus);
    this.left.appendChild(this.startRow);

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

    this.screen.classList.toggle("dz-lobby-mp", s.mode === "mp");
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
    this.renderPlayers(localId, hostId);

    this.motdBar.textContent = s.motd || "";
  }

  renderMaps(localId){
    const maps = this.state.maps;
    const counts = this.state.getVoteCounts();
    const localVote = localId ? this.state.getPlayerVote(localId) : null;
    const mapIds = maps.map(map => String(map.id));
    const sameOrder = mapIds.length === this.mapOrder.length
      && mapIds.every((id, i) => id === this.mapOrder[i]);

    if(!sameOrder){
      this.mapOrder = mapIds;
      this.mapCards.clear();
      this.mapRow.innerHTML = "";
      for(const map of maps){
        const card = document.createElement("div");
        card.className = "dz-lobby-map-card";
        const img = document.createElement("div");
        img.className = "dz-lobby-map-img";
        card.appendChild(img);

        const body = document.createElement("div");
        body.className = "dz-lobby-map-body";
        const name = document.createElement("div");
        name.className = "dz-lobby-map-name";
        const desc = document.createElement("div");
        desc.className = "dz-lobby-sub";
        body.appendChild(name);
        body.appendChild(desc);
        card.appendChild(body);

        const badge = document.createElement("div");
        badge.className = "dz-lobby-map-votes";
        card.appendChild(badge);

        this.mapRow.appendChild(card);
        this.mapCards.set(String(map.id), { card, img, name, desc, badge });
      }
    }

    for(const map of maps){
      const entry = this.mapCards.get(String(map.id));
      if(!entry) continue;
      const { card, img, name, desc, badge } = entry;
      const isDisabled = Boolean(map.disabled || !map.entryScript);
      card.classList.toggle("disabled", isDisabled);
      if(localVote && String(localVote) === String(map.id)){
        card.style.outline = "1px solid var(--ui-accent)";
        card.style.outlineOffset = "-1px";
      } else {
        card.style.outline = "";
        card.style.outlineOffset = "";
      }
      img.style.backgroundImage = map.preview ? `url(${map.preview})` : "linear-gradient(135deg,#1f2642,#0e1322)";
      name.textContent = map.name || map.id;
      desc.textContent = map.desc || (isDisabled ? "Coming soon." : "");
      const votes = counts.get(String(map.id)) || 0;
      badge.textContent = `Votes: ${votes}`;
      if(isDisabled){
        card.onclick = ()=>{
          this.waitingLabel.textContent = "Coming soon";
        };
      } else {
        card.onclick = ()=>{
          this.onVote?.(map.id);
        };
      }
    }
  }

  renderPlayers(localId, hostId){
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
        const isHost = hostId && String(p.id) === String(hostId);
        const name = document.createElement("div");
        name.textContent = p.name || `Player ${p.id}`;
        if(localId && String(p.id) === String(localId)){
          name.textContent += " (You)";
        }
        left.appendChild(dot);
        left.appendChild(name);
        if(isHost){
          const crown = document.createElement("div");
          crown.textContent = "👑";
          crown.style.fontSize = "14px";
          crown.style.lineHeight = "1";
          crown.title = "Host";
          left.appendChild(crown);
        }

        const vote = voteLookup.get(String(p.id));
        const voteText = document.createElement("div");
        voteText.className = "dz-lobby-sub";
        voteText.style.fontSize = "10px";
        voteText.textContent = vote ? `Vote: ${mapsById.get(String(vote))?.name || vote}` : "No vote";

        slot.appendChild(left);
        slot.appendChild(voteText);
      } else {
        slot.classList.add("dz-lobby-pending");
        dot.style.background = "rgba(255,255,255,0.15)";
        dot.classList.add("dz-lobby-pending-dot");
        const empty = document.createElement("div");
        empty.className = "dz-lobby-slot-empty";
        empty.classList.add("dz-lobby-pending-text");
        empty.textContent = "pending player...";
        left.appendChild(dot);
        left.appendChild(empty);
        slot.appendChild(left);
      }

      this.playerList.appendChild(slot);
    }
  }
}
