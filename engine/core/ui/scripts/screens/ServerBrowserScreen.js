import { Button } from "../widgets/Button.js";

function modeLabel(mode){
  if(mode === "SOLO") return "Solo";
  if(mode === "ZM") return "Zombies";
  if(mode === "MP") return "Multiplayer";
  return String(mode || "Unknown");
}

function formatAge(seconds){
  const s = Math.max(0, Number(seconds || 0));
  if(s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export function ServerBrowserScreen({ onBack, onRefresh, onJoin } = {}){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(980px, 94vw)";
  panel.style.height = "min(86vh, 760px)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "10px";

  const header = document.createElement("div");
  header.className = "dz-row";

  const title = document.createElement("div");
  title.className = "dz-title";
  title.textContent = "Server Browser";

  const spacer = document.createElement("div");
  spacer.className = "dz-spacer";

  const refreshBtn = Button({ text:"Refresh", onClick: ()=>onRefresh?.() });
  const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() });
  header.appendChild(title);
  header.appendChild(spacer);
  header.appendChild(refreshBtn);
  header.appendChild(backBtn);

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Browse joinable lobbies running on this server.";

  const table = document.createElement("div");
  table.style.display = "grid";
  table.style.gridTemplateColumns = "1.2fr 0.8fr 0.8fr 1fr 0.8fr 0.9fr 0.6fr 0.7fr";
  table.style.gap = "8px";
  table.style.padding = "8px 4px";
  table.style.fontSize = "12px";
  table.style.letterSpacing = "0.06em";
  table.style.textTransform = "uppercase";
  table.style.color = "var(--ui-text-dim)";

  const columns = ["Match", "Mode", "Status", "Map", "Players", "Host", "Age", "Join"];
  for(const col of columns){
    const cell = document.createElement("div");
    cell.textContent = col;
    table.appendChild(cell);
  }

  const listWrap = document.createElement("div");
  listWrap.style.flex = "1";
  listWrap.style.overflow = "auto";
  listWrap.style.display = "flex";
  listWrap.style.flexDirection = "column";
  listWrap.style.gap = "8px";

  const empty = document.createElement("div");
  empty.className = "dz-help";
  empty.textContent = "No lobby matches found.";

  function setServers(servers){
    listWrap.innerHTML = "";
    const list = Array.isArray(servers) ? servers : [];
    if(list.length === 0){
      listWrap.appendChild(empty);
      return;
    }
    for(const server of list){
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1.2fr 0.8fr 0.8fr 1fr 0.8fr 0.9fr 0.6fr 0.7fr";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.padding = "10px 8px";
      row.style.borderRadius = "10px";
      row.style.border = "1px solid rgba(255,255,255,0.08)";
      row.style.background = "rgba(0,0,0,0.28)";

      const matchId = document.createElement("div");
      matchId.textContent = server.matchId || "Unknown";

      const mode = document.createElement("div");
      mode.textContent = modeLabel(server.mode);

      const status = document.createElement("div");
      status.textContent = server.status || "lobby";

      const players = document.createElement("div");
      players.textContent = `${server.playerCount || 0}/${server.maxPlayers || 0}`;

      const map = document.createElement("div");
      const mapOptions = Array.isArray(server.mapOptions) ? server.mapOptions.map(m=>m.name || m.id) : [];
      map.textContent = mapOptions.length ? mapOptions.join(" / ") : "Voting";

      const host = document.createElement("div");
      host.textContent = server.hostName || "Unknown";

      const age = document.createElement("div");
      age.textContent = formatAge(server.ageSeconds);

      const joinCell = document.createElement("div");
      const joinBtn = Button({ text:"Join", variant:"secondary", onClick: ()=>onJoin?.(server.matchId) });
      joinCell.appendChild(joinBtn);

      row.appendChild(matchId);
      row.appendChild(mode);
      row.appendChild(status);
      row.appendChild(map);
      row.appendChild(players);
      row.appendChild(host);
      row.appendChild(age);
      row.appendChild(joinCell);
      listWrap.appendChild(row);
    }
  }

  panel.appendChild(header);
  panel.appendChild(sub);
  panel.appendChild(table);
  panel.appendChild(listWrap);
  screen.appendChild(panel);

  return { screen, setServers };
}
