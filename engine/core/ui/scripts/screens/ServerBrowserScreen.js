import { Button } from "../widgets/Button.js";

function modeLabel(mode){
  if(mode === "zombies") return "Zombies";
  if(mode === "mp") return "MP";
  if(mode === "solo") return "Solo";
  return mode || "Unknown";
}

function gamemodeLabel(gamemode){
  if(!gamemode) return "-";
  return String(gamemode).toUpperCase();
}

export function ServerBrowserScreen({ servers = [], showAll = false, onRefresh, onJoin, onBack } = {}){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 94vw)";
  panel.style.padding = "14px";

  const title = document.createElement("h1");
  title.className = "dz-title";
  title.textContent = "SERVER BROWSER";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Browse active lobbies and join an open match.";

  const controls = document.createElement("div");
  controls.className = "dz-row";
  controls.style.marginTop = "10px";

  const toggleWrap = document.createElement("label");
  toggleWrap.className = "dz-help";
  toggleWrap.style.display = "flex";
  toggleWrap.style.alignItems = "center";
  toggleWrap.style.gap = "8px";

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = Boolean(showAll);
  toggleWrap.appendChild(toggle);
  toggleWrap.appendChild(document.createTextNode("Show all matches"));

  const refreshBtn = Button({ text:"Refresh", onClick: ()=>onRefresh?.(toggle.checked) });
  const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() });

  controls.appendChild(toggleWrap);
  controls.appendChild(document.createElement("div")).className = "dz-spacer";
  controls.appendChild(refreshBtn);
  controls.appendChild(backBtn);

  const list = document.createElement("div");
  list.style.marginTop = "12px";
  list.style.display = "grid";
  list.style.gap = "8px";

  function renderRows(items){
    list.innerHTML = "";
    if(!items.length){
      const empty = document.createElement("div");
      empty.className = "dz-help";
      empty.textContent = "No lobbies found.";
      list.appendChild(empty);
      return;
    }
    for(const srv of items){
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "90px 110px 110px 110px 1fr 90px 120px";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "10px 12px";
      row.style.border = "1px solid rgba(255,255,255,0.14)";
      row.style.borderRadius = "10px";
      row.style.background = "rgba(0,0,0,0.35)";

      const id = document.createElement("div");
      id.style.fontFamily = "var(--ui-mono)";
      id.style.fontSize = "12px";
      id.textContent = `#${srv.matchId}`;

      const mode = document.createElement("div");
      mode.textContent = modeLabel(srv.mode);

      const gamemode = document.createElement("div");
      gamemode.textContent = gamemodeLabel(srv.gamemode);

      const status = document.createElement("div");
      status.textContent = srv.status || "lobby";

      const host = document.createElement("div");
      host.style.display = "grid";
      host.style.gap = "2px";
      const hostLine = document.createElement("div");
      hostLine.textContent = srv.hostName ? `Host: ${srv.hostName}` : "Host: n/a";
      const meta = document.createElement("div");
      meta.className = "dz-help";
      const mapName = srv.mapName || "n/a";
      const age = srv.ageSeconds ?? 0;
      meta.textContent = `Map: ${mapName} | Age: ${age}s`;
      host.appendChild(hostLine);
      host.appendChild(meta);

      const players = document.createElement("div");
      const max = srv.maxPlayers ?? "?";
      players.textContent = `${srv.playerCount ?? 0}/${max}`;

      const joinBtn = Button({ text:"Join", onClick: ()=>onJoin?.(srv.matchId) });
      joinBtn.disabled = srv.status !== "lobby";

      row.appendChild(id);
      row.appendChild(mode);
      row.appendChild(gamemode);
      row.appendChild(status);
      row.appendChild(host);
      row.appendChild(players);
      row.appendChild(joinBtn);
      list.appendChild(row);
    }
  }

  toggle.addEventListener("change", ()=>onRefresh?.(toggle.checked));
  renderRows(Array.isArray(servers) ? servers : []);

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(controls);
  panel.appendChild(list);
  screen.appendChild(panel);

  return {
    screen,
    setServers: (items)=>renderRows(Array.isArray(items) ? items : []),
  };
}
