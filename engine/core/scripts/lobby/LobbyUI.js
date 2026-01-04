import { Button } from "/engine/core/ui/scripts/widgets/Button.js";
import { applyLobbyTheme } from "/engine/core/scripts/lobby/LobbyTheme.js";

const MOTD_ROTATE_MS = 8000;
const MOTD_DEFAULTS = [
  "Tip: Stay in cover and keep lanes locked.",
  "Tip: Stick together to keep revive windows open.",
  "Intel: Vote early to avoid last second swaps.",
  "Intel: Ready up when you are set.",
  "Tip: Operators and loadouts can be changed any time."
];

const SAMPLE_MAPS = {
  mp: [
    {
      id: "mp_quarry",
      name: "Quarry",
      desc: "Industrial yard with tight sightlines.",
      meta: "6v6 - Medium",
      preview: "",
      entryScript: "sample"
    },
    {
      id: "mp_crosscut",
      name: "Crosscut",
      desc: "Fast rotations and short lanes.",
      meta: "6v6 - Small",
      preview: "",
      entryScript: "sample"
    }
  ],
  zm: [
    {
      id: "zm_outpost",
      name: "Outpost",
      desc: "Hold the line in a frozen facility.",
      meta: "Co-op - Survival",
      preview: "",
      entryScript: "sample"
    },
    {
      id: "zm_emberline",
      name: "Emberline",
      desc: "Smoke and sparks with tight loops.",
      meta: "Co-op - Medium",
      preview: "",
      entryScript: "sample"
    }
  ]
};

const SAMPLE_VOTES = {
  mp: {
    mp_quarry: 3,
    mp_crosscut: 1
  },
  zm: {
    zm_outpost: 2,
    zm_emberline: 0
  }
};

const SAMPLE_PLAYERS = {
  mp: [
    { id: "1", name: "Ranger", ping: 38 },
    { id: "2", name: "Viper", ping: 64 },
    { id: "3", name: "Kestrel", ping: 91 },
    { id: "4", name: "Nomad", ping: 52 },
    { id: "5", name: "Vector", ping: 74 },
    { id: "6", name: "Ghost", ping: 48 },
    { id: "7", name: "Reaper", ping: 110 },
    { id: "8", name: "Atlas", ping: 82 },
    { id: "9", name: "Hawk", ping: 44 },
    { id: "10", name: "Blaze", ping: 69 },
    { id: "11", name: "Sable", ping: 125 },
    { id: "12", name: "Striker", ping: 57 }
  ],
  zm: [
    { id: "1", name: "Echo", ping: 46 },
    { id: "2", name: "Nova", ping: 72 },
    { id: "3", name: "Shade", ping: 88 },
    { id: "4", name: "Cipher", ping: 54 }
  ]
};

const SAMPLE_READY = {
  mp: new Map([
    ["1", true],
    ["2", true],
    ["3", false],
    ["4", true],
    ["5", false],
    ["6", true],
    ["7", false],
    ["8", true],
    ["9", false],
    ["10", true],
    ["11", false],
    ["12", true]
  ]),
  zm: new Map([
    ["1", true],
    ["2", true],
    ["3", false],
    ["4", false]
  ])
};

const SAMPLE_HOST = {
  mp: "1",
  zm: "1"
};

function injectStyles(){
  if(document.getElementById("dz-lobby-styles")) return;
  const style = document.createElement("style");
  style.id = "dz-lobby-styles";
  style.textContent = `
    .dz-lobby-screen{
      position:absolute;
      inset:0;
      display:flex;
      align-items:stretch;
      justify-content:center;
      background: var(--lobby-bg, #0b0e10);
      color: var(--lobby-text, #eef2f5);
      font-family: "Rajdhani", "Inter", system-ui, sans-serif;
      pointer-events:auto;
      overflow:hidden;
    }
    .dz-lobby-screen::before{
      content:"";
      position:absolute;
      inset:0;
      background: var(--lobby-motif);
      opacity:0.6;
      pointer-events:none;
      animation: dz-lobby-drift 14s linear infinite;
    }
    .dz-lobby-screen::after{
      content:"";
      position:absolute;
      inset:0;
      background: var(--lobby-noise), var(--lobby-motif-2);
      opacity:0.7;
      pointer-events:none;
    }
    .dz-lobby-shell{
      width:min(1280px, 96vw);
      height:min(88vh, 860px);
      display:grid;
      grid-template-rows: 1fr auto;
      gap: 16px;
      padding: 18px;
      box-sizing: border-box;
      position:relative;
      z-index:1;
    }
    .dz-lobby-main{
      display:grid;
      grid-template-columns: 260px 1fr 320px;
      gap: 16px;
      min-height:0;
    }
    .dz-lobby-panel{
      background: var(--lobby-panel, rgba(14,18,22,0.86));
      border: 1px solid var(--lobby-panel-border, rgba(255,255,255,0.08));
      border-radius: 10px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.5);
      padding: 16px;
      display:flex;
      flex-direction:column;
      gap: 12px;
      min-height:0;
      animation: dz-lobby-panel-in 240ms ease-out both;
    }
    .dz-lobby-sidebar{
      gap: 14px;
    }
    .dz-lobby-mode{
      display:flex;
      align-items:center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .dz-lobby-mode-icon{
      width: 26px;
      height: 26px;
      border: 1px solid var(--lobby-accent, #2ef2c6);
      border-radius: 6px;
      position:relative;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.6) inset;
    }
    .dz-lobby-mode-icon::after{
      content:"";
      position:absolute;
      inset:4px;
      border-radius: 4px;
      background: var(--lobby-accent, #2ef2c6);
      opacity:0.25;
    }
    .dz-lobby-mode-label{
      font-size: 13px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .dz-lobby-mode-sub{
      font-size: 11px;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      letter-spacing: 0.06em;
    }
    .dz-lobby-nav{
      display:flex;
      flex-direction:column;
      gap: 6px;
    }
    .dz-lobby-nav-btn{
      all: unset;
      cursor: pointer;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid transparent;
      color: var(--lobby-text, #eef2f5);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 700;
      position:relative;
      transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
    }
    .dz-lobby-nav-btn::after{
      content:"";
      position:absolute;
      left:12px;
      right:12px;
      bottom:6px;
      height:2px;
      background: var(--lobby-accent, #2ef2c6);
      opacity:0;
      transform: scaleX(0.4);
      transform-origin:left;
      transition: opacity 140ms ease, transform 140ms ease;
    }
    .dz-lobby-nav-btn:hover::after{
      opacity:0.7;
      transform: scaleX(1);
    }
    .dz-lobby-nav-btn.is-active{
      border-color: rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.35);
      box-shadow: var(--lobby-glow, 0 0 12px rgba(46,242,198,0.25));
    }
    .dz-lobby-hover-fade:hover{
      animation: dz-lobby-text-fade 1.2s ease-in-out infinite;
    }
    .dz-lobby-preview-toggle{
      margin-top:auto;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.06);
      display:flex;
      flex-direction:column;
      gap: 8px;
    }
    .dz-lobby-preview-btn{
      all: unset;
      cursor: pointer;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      border: 1px solid rgba(255,255,255,0.08);
      text-align:center;
      transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
    }
    .dz-lobby-preview-btn:hover{
      color: var(--lobby-text, #eef2f5);
      border-color: rgba(255,255,255,0.18);
    }
    .dz-lobby-center{
      display:flex;
      flex-direction:column;
      gap: 16px;
    }
    .dz-lobby-header{
      display:flex;
      flex-direction:column;
      gap: 6px;
    }
    .dz-lobby-title{
      font-size: 20px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-weight: 800;
    }
    .dz-lobby-statusline{
      font-size: 12px;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      letter-spacing: 0.08em;
    }
    .dz-lobby-header-row{
      display:flex;
      align-items:center;
      gap: 12px;
      flex-wrap:wrap;
    }
    .dz-lobby-pill{
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
    }
    .dz-lobby-lock{
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.12);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      transition: color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
    }
    .dz-lobby-lock.is-ready{
      color: var(--lobby-accent, #2ef2c6);
      border-color: var(--lobby-accent, #2ef2c6);
      box-shadow: var(--lobby-glow, 0 0 12px rgba(46,242,198,0.25));
    }
    .dz-lobby-action-row{
      display:flex;
      align-items:center;
      gap: 10px;
      flex-wrap:wrap;
    }
    .dz-lobby-btn{
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.18);
      color: #f2f2f2;
      transition: border-color 140ms ease, background 140ms ease;
    }
    .dz-lobby-map-section{
      display:flex;
      flex-direction:column;
      gap: 10px;
      margin-top:auto;
    }
    .dz-lobby-section-title{
      font-size: 12px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
    }
    .dz-lobby-map-grid{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .dz-lobby-map-card{
      position:relative;
      border-radius: 10px;
      overflow:hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.35);
      cursor:pointer;
      display:flex;
      flex-direction:column;
      min-height: 180px;
      transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
    }
    .dz-lobby-map-card:hover{
      transform: translateY(-2px);
      border-color: rgba(255,255,255,0.2);
      box-shadow: 0 12px 26px rgba(0,0,0,0.4);
    }
    .dz-lobby-map-card.is-selected{
      border-color: var(--lobby-accent, #2ef2c6);
      box-shadow: var(--lobby-glow, 0 0 12px rgba(46,242,198,0.25));
    }
    .dz-lobby-map-card.is-active:not(.is-selected){
      border-color: rgba(255,255,255,0.28);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.12);
    }
    .dz-lobby-map-card.is-disabled{
      cursor: not-allowed;
      opacity: 0.6;
      filter: grayscale(0.4);
    }
    .dz-lobby-map-thumb{
      flex: 1;
      min-height: 110px;
      background: linear-gradient(135deg, rgba(20,28,36,0.9), rgba(10,14,20,0.95));
      position:relative;
    }
    .dz-lobby-map-thumb::after{
      content:"";
      position:absolute;
      inset:0;
      background: linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.6));
      pointer-events:none;
    }
    .dz-lobby-map-body{
      padding: 10px 12px 12px 12px;
      display:flex;
      flex-direction:column;
      gap: 4px;
    }
    .dz-lobby-map-name{
      font-size: 14px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 800;
      color: var(--lobby-text, #eef2f5);
    }
    .dz-lobby-map-meta{
      font-size: 11px;
      letter-spacing: 0.08em;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
    }
    .dz-lobby-vote-badge{
      position:absolute;
      top: 10px;
      right: 10px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: rgba(0,0,0,0.75);
      border: 1px solid rgba(255,255,255,0.16);
    }
    .dz-lobby-right{
      gap: 10px;
    }
    .dz-lobby-player-header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
    }
    .dz-lobby-player-title{
      font-size: 13px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-weight: 800;
    }
    .dz-lobby-ready-count{
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
    }
    .dz-lobby-player-list{
      display:flex;
      flex-direction:column;
      gap: 6px;
      overflow:auto;
      min-height:0;
      padding-right: 2px;
    }
    .dz-lobby-player-slot{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.35);
      font-size: 12px;
    }
    .dz-lobby-player-info{
      display:flex;
      flex-direction:column;
      gap: 2px;
    }
    .dz-lobby-player-name{
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .dz-lobby-player-status{
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
    }
    .dz-lobby-player-status.is-ready{
      color: var(--lobby-accent, #2ef2c6);
    }
    .dz-lobby-player-status.is-host{
      color: var(--lobby-text, #eef2f5);
    }
    .dz-lobby-player-pending{
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      font-style: italic;
      letter-spacing: 0.08em;
    }
    .dz-lobby-ping{
      display:flex;
      align-items:flex-end;
      gap: 3px;
      height: 16px;
      min-width: 34px;
      justify-content:flex-end;
    }
    .dz-lobby-ping span{
      width: 4px;
      border-radius: 2px;
      background: rgba(255,255,255,0.18);
      height: 6px;
    }
    .dz-lobby-ping span.is-on{
      background: var(--lobby-accent, #2ef2c6);
      box-shadow: var(--lobby-glow, 0 0 10px rgba(46,242,198,0.2));
    }
    .dz-lobby-motd{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 10px 14px;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .dz-lobby-motd-label{
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      white-space:nowrap;
    }
    .dz-lobby-motd-text{
      flex:1;
      text-align:right;
      transition: opacity 240ms ease;
    }
    .dz-lobby-motd-text.is-fading{
      opacity:0;
    }
    .dz-lobby-modal{
      position:absolute;
      inset:0;
      display:none;
      align-items:center;
      justify-content:center;
      background: rgba(0,0,0,0.6);
      z-index: 5;
    }
    .dz-lobby-modal.is-open{
      display:flex;
    }
    .dz-lobby-modal-card{
      width:min(520px, 90vw);
      padding: 16px;
      border-radius: 12px;
      background: var(--lobby-panel, rgba(14,18,22,0.86));
      border: 1px solid var(--lobby-panel-border, rgba(255,255,255,0.08));
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      display:flex;
      flex-direction:column;
      gap: 12px;
    }
    .dz-lobby-modal-title{
      font-size: 16px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-weight: 800;
    }
    .dz-lobby-modal-text{
      font-size: 12px;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      letter-spacing: 0.06em;
      line-height: 1.4;
    }
    .dz-lobby-script-list{
      display:flex;
      flex-direction:column;
      gap: 10px;
      max-height: 360px;
      overflow:auto;
      padding-right: 2px;
    }
    .dz-lobby-script-item{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.35);
      padding: 10px 12px;
    }
    .dz-lobby-script-info{
      display:flex;
      flex-direction:column;
      gap: 4px;
      min-width: 0;
    }
    .dz-lobby-script-name{
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .dz-lobby-script-meta{
      font-size: 11px;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .dz-lobby-script-desc{
      font-size: 12px;
      color: var(--lobby-text-dim, rgba(238,242,245,0.6));
    }
    .dz-lobby-script-actions{
      display:flex;
      align-items:center;
    }
    @keyframes dz-lobby-panel-in{
      from{opacity:0; transform:translateY(8px);}
      to{opacity:1; transform:translateY(0);}
    }
    @keyframes dz-lobby-text-fade{
      0%{color:#ffffff;}
      50%{color:#0a0a0a;}
      100%{color:#ffffff;}
    }
    @keyframes dz-lobby-drift{
      0%{transform:translateY(0);}
      50%{transform:translateY(8px);}
      100%{transform:translateY(0);}
    }
    @media (max-width: 1100px){
      .dz-lobby-main{
        grid-template-columns: 220px 1fr 280px;
      }
    }
    @media (max-width: 900px){
      .dz-lobby-main{
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto;
      }
      .dz-lobby-map-grid{
        grid-template-columns: 1fr;
      }
      .dz-lobby-shell{
        height:auto;
        min-height: 100vh;
      }
    }
  `;
  document.head.appendChild(style);
}

function clampIndex(value, max){
  if(max <= 0) return 0;
  return Math.max(0, Math.min(max - 1, value));
}

export class LobbyUI {
  constructor({ state, onBack, onReadyToggle, onVote, onStart, onCreateClass, onScriptToggle, getLocalPlayerId }){
    this.state = state;
    this.onBack = onBack;
    this.onReadyToggle = onReadyToggle;
    this.onVote = onVote;
    this.onStart = onStart;
    this.onCreateClass = onCreateClass;
    this.onScriptToggle = onScriptToggle;
    this.getLocalPlayerId = getLocalPlayerId || (()=>null);

    this.mapCards = new Map();
    this.mapOrder = [];
    this.mapButtons = [];
    this.navButtons = [];
    this.activeNavIndex = 0;
    this.activeMapIndex = 0;
    this.kbRegion = "nav";
    this.previewMode = null;
    this.settingsOpen = false;
    this.scriptsOpen = false;

    this.motdMessages = [];
    this.motdIndex = 0;
    this.motdSeed = "";
    this.motdTimer = null;

    injectStyles();
    this.screen = document.createElement("div");
    this.screen.className = "dz-screen dz-lobby-screen";
    this.screen.tabIndex = -1;

    this.shell = document.createElement("div");
    this.shell.className = "dz-lobby-shell";
    this.screen.appendChild(this.shell);

    this.main = document.createElement("div");
    this.main.className = "dz-lobby-main";
    this.shell.appendChild(this.main);

    const sidebar = this.buildSidebar();
    this.sidebar = sidebar.el;
    this.navButtons = sidebar.navButtons;
    this.modeLabel = sidebar.modeLabel;
    this.modeSub = sidebar.modeSub;
    this.previewToggle = sidebar.previewToggle;

    const center = this.buildCenter();
    this.center = center.el;
    this.lobbyTitle = center.lobbyTitle;
    this.statusLine = center.statusLine;
    this.gameModePill = center.gameModePill;
    this.lockIndicator = center.lockIndicator;
    this.readyBtn = center.readyBtn;
    this.startBtn = center.startBtn;
    this.mapRow = center.mapRow;

    const right = this.buildPlayerPanel();
    this.right = right.el;
    this.readyCountEl = right.readyCountEl;
    this.playerList = right.playerList;

    this.motdBar = this.buildMotdBanner();
    this.shell.appendChild(this.motdBar);

    this.settingsModal = this.buildSettingsModal();
    this.screen.appendChild(this.settingsModal);

    this.scriptsModal = this.buildScriptsModal();
    this.screen.appendChild(this.scriptsModal);

    this.main.appendChild(this.sidebar);
    this.main.appendChild(this.center);
    this.main.appendChild(this.right);

    this.bindKeyboard();
    this.refreshMotdMessages();
    this.startMotdRotation();
  }

  mount(layer){
    if(layer && this.screen.parentElement !== layer){
      layer.innerHTML = "";
      layer.appendChild(this.screen);
      this.screen.focus({ preventScroll: true });
    }
  }

  buildSidebar(){
    const el = document.createElement("aside");
    el.className = "dz-lobby-panel dz-lobby-sidebar";

    const modeWrap = document.createElement("div");
    modeWrap.className = "dz-lobby-mode";
    const modeIcon = document.createElement("div");
    modeIcon.className = "dz-lobby-mode-icon";
    const modeText = document.createElement("div");
    const modeLabel = document.createElement("div");
    modeLabel.className = "dz-lobby-mode-label";
    const modeSub = document.createElement("div");
    modeSub.className = "dz-lobby-mode-sub";
    modeText.appendChild(modeLabel);
    modeText.appendChild(modeSub);
    modeWrap.appendChild(modeIcon);
    modeWrap.appendChild(modeText);

    const nav = document.createElement("div");
    nav.className = "dz-lobby-nav";
    const navButtons = [];
    const items = [
      { id: "play", label: "Play" },
      { id: "create", label: "Create a Class" },
      { id: "weapons", label: "Weapons" },
      { id: "operators", label: "Operators" },
      { id: "challenges", label: "Challenges" },
      { id: "scripts", label: "Scripts" },
      { id: "settings", label: "Settings" }
    ];
    for(const item of items){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dz-lobby-nav-btn dz-lobby-hover-fade";
      btn.textContent = item.label;
      btn.dataset.nav = item.id;
      btn.addEventListener("click", ()=>{
        this.setActiveNav(navButtons.indexOf(btn), true);
        this.handleNav(item.id);
      });
      nav.appendChild(btn);
      navButtons.push(btn);
    }

    const preview = document.createElement("div");
    preview.className = "dz-lobby-preview-toggle";
    const previewToggle = document.createElement("button");
    previewToggle.type = "button";
    previewToggle.className = "dz-lobby-preview-btn";
    previewToggle.addEventListener("click", ()=>this.togglePreviewMode());
    preview.appendChild(previewToggle);

    el.appendChild(modeWrap);
    el.appendChild(nav);
    el.appendChild(preview);

    return { el, navButtons, modeLabel, modeSub, previewToggle };
  }

  buildCenter(){
    const el = document.createElement("section");
    el.className = "dz-lobby-panel dz-lobby-center";

    const header = document.createElement("div");
    header.className = "dz-lobby-header";

    const lobbyTitle = document.createElement("div");
    lobbyTitle.className = "dz-lobby-title";
    lobbyTitle.textContent = "LOBBY";

    const statusLine = document.createElement("div");
    statusLine.className = "dz-lobby-statusline";
    statusLine.textContent = "";

    const headerRow = document.createElement("div");
    headerRow.className = "dz-lobby-header-row";
    const gameModePill = document.createElement("div");
    gameModePill.className = "dz-lobby-pill";
    const lockIndicator = document.createElement("div");
    lockIndicator.className = "dz-lobby-lock";
    lockIndicator.textContent = "LOCKED";
    headerRow.appendChild(gameModePill);
    headerRow.appendChild(lockIndicator);

    const actionRow = document.createElement("div");
    actionRow.className = "dz-lobby-action-row";
    this.readyBtn = Button({ text: "Ready Up", onClick: ()=>this.onReadyToggle?.() });
    this.readyBtn.classList.add("dz-lobby-btn", "dz-lobby-hover-fade");
    this.startBtn = Button({ text: "Start Match", onClick: ()=>this.onStart?.() });
    this.startBtn.classList.add("dz-lobby-btn", "dz-lobby-hover-fade");
    actionRow.appendChild(this.readyBtn);
    actionRow.appendChild(this.startBtn);

    header.appendChild(lobbyTitle);
    header.appendChild(statusLine);
    header.appendChild(headerRow);
    header.appendChild(actionRow);

    const mapSection = document.createElement("div");
    mapSection.className = "dz-lobby-map-section";
    const mapTitle = document.createElement("div");
    mapTitle.className = "dz-lobby-section-title";
    mapTitle.textContent = "Map Vote";
    const mapRow = document.createElement("div");
    mapRow.className = "dz-lobby-map-grid";
    mapSection.appendChild(mapTitle);
    mapSection.appendChild(mapRow);

    el.appendChild(header);
    el.appendChild(mapSection);

    return { el, lobbyTitle, statusLine, gameModePill, lockIndicator, readyBtn: this.readyBtn, startBtn: this.startBtn, mapRow };
  }

  buildPlayerPanel(){
    const el = document.createElement("aside");
    el.className = "dz-lobby-panel dz-lobby-right";

    const header = document.createElement("div");
    header.className = "dz-lobby-player-header";
    const title = document.createElement("div");
    title.className = "dz-lobby-player-title";
    title.textContent = "Players";
    const readyCountEl = document.createElement("div");
    readyCountEl.className = "dz-lobby-ready-count";
    header.appendChild(title);
    header.appendChild(readyCountEl);

    const playerList = document.createElement("div");
    playerList.className = "dz-lobby-player-list";

    el.appendChild(header);
    el.appendChild(playerList);

    return { el, playerList, readyCountEl };
  }

  buildMotdBanner(){
    const bar = document.createElement("div");
    bar.className = "dz-lobby-motd";
    const label = document.createElement("div");
    label.className = "dz-lobby-motd-label";
    label.textContent = "Intel";
    this.motdText = document.createElement("div");
    this.motdText.className = "dz-lobby-motd-text";
    bar.appendChild(label);
    bar.appendChild(this.motdText);
    return bar;
  }

  buildSettingsModal(){
    const modal = document.createElement("div");
    modal.className = "dz-lobby-modal";
    const card = document.createElement("div");
    card.className = "dz-lobby-modal-card";
    const title = document.createElement("div");
    title.className = "dz-lobby-modal-title";
    title.textContent = "Settings";
    const text = document.createElement("div");
    text.className = "dz-lobby-modal-text";
    text.textContent = "Settings are handled in the main menu. Press ESC to close this panel.";
    const actions = document.createElement("div");
    actions.className = "dz-lobby-action-row";
    const closeBtn = Button({ text: "Close", variant: "secondary", onClick: ()=>this.toggleSettings(false) });
    closeBtn.classList.add("dz-lobby-btn", "dz-lobby-hover-fade");
    actions.appendChild(closeBtn);
    if(this.onBack){
      const backBtn = Button({ text: "Back to Menu", variant: "secondary", onClick: ()=>this.onBack?.() });
      backBtn.classList.add("dz-lobby-btn", "dz-lobby-hover-fade");
      actions.appendChild(backBtn);
    }
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);
    modal.appendChild(card);
    modal.addEventListener("click", (e)=>{
      if(e.target === modal) this.toggleSettings(false);
    });
    return modal;
  }

  buildScriptsModal(){
    const modal = document.createElement("div");
    modal.className = "dz-lobby-modal";
    const card = document.createElement("div");
    card.className = "dz-lobby-modal-card";
    const title = document.createElement("div");
    title.className = "dz-lobby-modal-title";
    title.textContent = "Scripts";
    const text = document.createElement("div");
    text.className = "dz-lobby-modal-text";
    text.textContent = "Host can preload scripts that will run at match start.";
    const status = document.createElement("div");
    status.className = "dz-lobby-modal-text";
    this.scriptsStatus = status;
    const list = document.createElement("div");
    list.className = "dz-lobby-script-list";
    this.scriptsList = list;
    const actions = document.createElement("div");
    actions.className = "dz-lobby-action-row";
    const closeBtn = Button({ text: "Close", variant: "secondary", onClick: ()=>this.toggleScripts(false) });
    closeBtn.classList.add("dz-lobby-btn", "dz-lobby-hover-fade");
    actions.appendChild(closeBtn);

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(status);
    card.appendChild(list);
    card.appendChild(actions);
    modal.appendChild(card);
    modal.addEventListener("click", (e)=>{
      if(e.target === modal) this.toggleScripts(false);
    });
    return modal;
  }

  toggleSettings(open){
    const next = typeof open === "boolean" ? open : !this.settingsOpen;
    this.settingsOpen = next;
    this.settingsModal.classList.toggle("is-open", next);
  }

  toggleScripts(open){
    const next = typeof open === "boolean" ? open : !this.scriptsOpen;
    this.scriptsOpen = next;
    this.scriptsModal.classList.toggle("is-open", next);
  }

  togglePreviewMode(){
    const order = ["live", "mp", "zm"];
    const current = this.previewMode || "live";
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.previewMode = next === "live" ? null : next;
    this.update();
  }

  bindKeyboard(){
    if(this._keyboardBound) return;
    this._keyboardBound = true;
    this.screen.addEventListener("keydown", (e)=>{
      const key = e.key;
      if(key === "Escape"){
        if(this.scriptsOpen){
          this.toggleScripts(false);
        } else {
          this.toggleSettings();
        }
        e.preventDefault();
        return;
      }
      if(this.settingsOpen || this.scriptsOpen) return;
      if(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(key)){
        e.preventDefault();
      } else {
        return;
      }
      if(key === "Enter"){
        if(this.kbRegion === "nav"){
          this.navButtons[this.activeNavIndex]?.click();
        } else {
          this.mapButtons[this.activeMapIndex]?.click();
        }
        return;
      }
      if(this.kbRegion === "nav"){
        if(key === "ArrowUp") this.setActiveNav(this.activeNavIndex - 1, true);
        if(key === "ArrowDown") this.setActiveNav(this.activeNavIndex + 1, true);
        if(key === "ArrowRight"){
          this.kbRegion = "maps";
          this.setActiveMap(this.activeMapIndex, true);
        }
      } else {
        if(key === "ArrowLeft") this.setActiveMap(this.activeMapIndex - 1, true);
        if(key === "ArrowRight") this.setActiveMap(this.activeMapIndex + 1, true);
        if(key === "ArrowUp"){
          this.kbRegion = "nav";
          this.setActiveNav(this.activeNavIndex, true);
        }
      }
    });
  }

  setActiveNav(index, focus){
    if(!this.navButtons.length) return;
    this.activeNavIndex = clampIndex(index, this.navButtons.length);
    this.navButtons.forEach((btn, i)=>{
      const active = i === this.activeNavIndex;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
      btn.tabIndex = active ? 0 : -1;
      if(active && focus) btn.focus({ preventScroll: true });
    });
  }

  setActiveMap(index, focus){
    if(!this.mapButtons.length) return;
    this.activeMapIndex = clampIndex(index, this.mapButtons.length);
    this.mapButtons.forEach((btn, i)=>{
      const active = i === this.activeMapIndex;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
      if(active && focus) btn.focus({ preventScroll: true });
    });
  }

  handleNav(id){
    if(id === "play"){
      this.onStart?.();
      return;
    }
    if(id === "create"){
      this.onCreateClass?.();
      return;
    }
    if(id === "scripts"){
      this.toggleScripts(true);
      return;
    }
    if(id === "settings"){
      this.toggleSettings(true);
      return;
    }
    this.statusLine.textContent = "Feature coming soon.";
  }

  refreshMotdMessages(){
    const base = [];
    const motd = this.state?.motd || "";
    if(motd && motd !== this.motdSeed){
      this.motdSeed = motd;
    }
    if(this.motdSeed) base.push(this.motdSeed);
    this.motdMessages = [...base, ...MOTD_DEFAULTS];
    this.motdIndex = 0;
    if(this.motdText) this.motdText.textContent = this.motdMessages[0] || "";
  }

  startMotdRotation(){
    if(this.motdTimer) clearInterval(this.motdTimer);
    this.motdTimer = setInterval(()=>this.rotateMotd(), MOTD_ROTATE_MS);
  }

  rotateMotd(){
    if(!this.motdMessages.length) return;
    this.motdIndex = (this.motdIndex + 1) % this.motdMessages.length;
    if(!this.motdText) return;
    this.motdText.classList.add("is-fading");
    const next = this.motdMessages[this.motdIndex];
    setTimeout(()=>{
      this.motdText.textContent = next;
      this.motdText.classList.remove("is-fading");
    }, 180);
  }

  getDisplayMode(){
    return this.previewMode || this.state.mode || "zm";
  }

  getDisplayMaps(mode){
    const maps = this.state.maps && this.state.maps.length ? this.state.maps : SAMPLE_MAPS[mode];
    return maps || [];
  }

  getDisplayPlayers(mode){
    const players = this.state.players && this.state.players.length ? this.state.players : SAMPLE_PLAYERS[mode];
    return players || [];
  }

  getReadyLookup(mode){
    return this.state.players && this.state.players.length ? this.state.readyByPlayerId : SAMPLE_READY[mode];
  }

  getHostId(mode){
    return this.state.players && this.state.players.length ? this.state.getHostId() : SAMPLE_HOST[mode];
  }

  getVoteCounts(mode){
    if(this.state.maps && this.state.maps.length){
      return this.state.getVoteCounts();
    }
    const counts = new Map();
    const sample = SAMPLE_VOTES[mode] || {};
    for(const [key, val] of Object.entries(sample)){
      counts.set(String(key), val);
    }
    return counts;
  }

  update(){
    const mode = this.getDisplayMode();
    applyLobbyTheme(this.screen, mode);

    this.modeLabel.textContent = mode === "mp" ? "MULTIPLAYER" : "ZOMBIES";
    this.modeSub.textContent = mode === "mp" ? "Matchmaking lobby" : "Co-op lobby";
    if(this.previewToggle){
      const label = this.previewMode ? `Theme: ${mode === "mp" ? "Multiplayer" : "Zombies"}` : "Theme: Live";
      this.previewToggle.textContent = label;
    }

    const localId = this.getLocalPlayerId();
    const players = this.getDisplayPlayers(mode);
    const readyLookup = this.getReadyLookup(mode);
    const hostId = this.getHostId(mode);
    const total = players.length;
    let readyCount = 0;
    for(const p of players){
      if(readyLookup?.get?.(String(p.id))) readyCount++;
    }
    const needed = total > 0 ? Math.ceil(total / 2) : 0;
    const canStart = needed > 0 && readyCount >= needed;
    const isHost = hostId && localId && hostId === String(localId);
    const status = canStart
      ? (isHost ? "Ready to start." : "Waiting for host.")
      : "Waiting for players.";

    this.statusLine.textContent = status;
    this.gameModePill.textContent = mode === "mp" ? "Team Deathmatch" : "Zombies Survival";
    this.lockIndicator.textContent = canStart ? "Ready" : `Locked - Need ${needed}`;
    this.lockIndicator.classList.toggle("is-ready", canStart);

    const localReady = localId ? Boolean(readyLookup?.get?.(String(localId))) : false;
    this.readyBtn.textContent = localReady ? "Unready" : "Ready Up";
    this.startBtn.style.display = isHost ? "" : "none";
    this.startBtn.disabled = !canStart;
    this.readyCountEl.textContent = `${readyCount}/${total} Ready`;

    this.renderMaps(localId, mode);
    this.renderPlayers(localId, hostId, mode);
    this.renderScripts(localId, hostId);

    if((this.state?.motd || "") !== this.motdSeed){
      this.refreshMotdMessages();
    }

    this.setActiveNav(this.activeNavIndex);
    this.setActiveMap(this.activeMapIndex);
  }

  renderScripts(localId, hostId){
    if(!this.scriptsList || !this.scriptsStatus) return;
    const isHost = hostId && localId && String(hostId) === String(localId);
    const library = this.state?.getDzsLibrary?.() || [];
    const selected = this.state?.getAllDzsSelections?.() || [];
    this.scriptsStatus.textContent = isHost
      ? `Preloaded: ${selected.length}`
      : `Host-only. Preloaded: ${selected.length}`;
    this.scriptsList.innerHTML = "";
    if(!library.length){
      const empty = document.createElement("div");
      empty.className = "dz-lobby-modal-text";
      empty.textContent = "No scripts found in library.";
      this.scriptsList.appendChild(empty);
      return;
    }
    for(const s of library){
      const row = document.createElement("div");
      row.className = "dz-lobby-script-item";
      const info = document.createElement("div");
      info.className = "dz-lobby-script-info";
      const name = document.createElement("div");
      name.className = "dz-lobby-script-name";
      name.textContent = s.name || s.filename;
      const meta = document.createElement("div");
      meta.className = "dz-lobby-script-meta";
      const tags = Array.isArray(s.tags) && s.tags.length ? ` | ${s.tags.join(", ")}` : "";
      const version = s.version ? `v${s.version}` : "v?";
      meta.textContent = `${version}${tags}`;
      const desc = document.createElement("div");
      desc.className = "dz-lobby-script-desc";
      desc.textContent = s.desc || s.filename;
      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(desc);

      const actions = document.createElement("div");
      actions.className = "dz-lobby-script-actions";
      const isSelected = this.state?.isDzsSelected?.(s.filename);
      const btn = Button({ text: isSelected ? "Remove" : "Preload", variant: "secondary", onClick: ()=>{
        this.onScriptToggle?.(s, isSelected);
      }});
      btn.classList.add("dz-lobby-btn");
      btn.disabled = !isHost;
      actions.appendChild(btn);

      row.appendChild(info);
      row.appendChild(actions);
      this.scriptsList.appendChild(row);
    }
  }

  renderMaps(localId, mode){
    const maps = this.getDisplayMaps(mode);
    const counts = this.getVoteCounts(mode);
    const localVote = localId ? this.state.getPlayerVote(localId) : null;
    const mapIds = maps.map(map => String(map.id));
    const sameOrder = mapIds.length === this.mapOrder.length
      && mapIds.every((id, i) => id === this.mapOrder[i]);

    if(!sameOrder){
      this.mapOrder = mapIds;
      this.mapCards.clear();
      this.mapRow.innerHTML = "";
      this.mapButtons = [];
      for(const map of maps){
        const card = document.createElement("div");
        card.className = "dz-lobby-map-card";
        card.setAttribute("role", "button");
        card.tabIndex = -1;
        const thumb = document.createElement("div");
        thumb.className = "dz-lobby-map-thumb";
        card.appendChild(thumb);

        const body = document.createElement("div");
        body.className = "dz-lobby-map-body";
        const name = document.createElement("div");
        name.className = "dz-lobby-map-name dz-lobby-hover-fade";
        const meta = document.createElement("div");
        meta.className = "dz-lobby-map-meta dz-lobby-hover-fade";
        body.appendChild(name);
        body.appendChild(meta);
        card.appendChild(body);

        const badge = document.createElement("div");
        badge.className = "dz-lobby-vote-badge";
        card.appendChild(badge);

        card.addEventListener("mouseenter", ()=>{
          this.kbRegion = "maps";
          this.setActiveMap(this.mapButtons.indexOf(card), false);
        });

        this.mapRow.appendChild(card);
        this.mapCards.set(String(map.id), { card, thumb, name, meta, badge });
        this.mapButtons.push(card);
      }
    }

    for(const map of maps){
      const entry = this.mapCards.get(String(map.id));
      if(!entry) continue;
      const { card, thumb, name, meta, badge } = entry;
      const hasEntry = Boolean(map.entryScript || map.entryDzmap || map.entryDzmapData);
      const isDisabled = Boolean(map.disabled || !hasEntry);
      card.classList.toggle("is-disabled", isDisabled);
      const selected = localVote && String(localVote) === String(map.id);
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-selected", selected ? "true" : "false");
      const bg = map.preview ? `url(${map.preview})` : "linear-gradient(135deg,#1a232e,#0e131a)";
      thumb.style.backgroundImage = bg;
      name.textContent = map.name || map.id;
      meta.textContent = map.meta || (mode === "mp" ? "6v6 - Core" : "Co-op - Survival");
      const votes = counts.get(String(map.id)) || 0;
      badge.textContent = `Votes: ${votes}`;
      if(isDisabled){
        card.onclick = ()=>{
          this.statusLine.textContent = "Map coming soon.";
        };
      } else {
        card.onclick = ()=>{
          const nextVote = selected ? null : map.id;
          this.onVote?.(nextVote);
        };
      }
    }

    this.setActiveMap(this.activeMapIndex);
  }

  renderPlayers(localId, hostId, mode){
    this.playerList.innerHTML = "";
    const maxSlots = mode === "mp" ? 12 : 4;
    const players = this.getDisplayPlayers(mode).slice(0, maxSlots);
    const readyLookup = this.getReadyLookup(mode);

    for(let i=0;i<maxSlots;i++){
      const slot = document.createElement("div");
      slot.className = "dz-lobby-player-slot";
      const p = players[i];
      if(p){
        const left = document.createElement("div");
        left.className = "dz-lobby-player-info";
        const name = document.createElement("div");
        name.className = "dz-lobby-player-name";
        name.textContent = p.name || `Player ${p.id}`;
        if(localId && String(p.id) === String(localId)){
          name.textContent += " (You)";
        }
        const status = document.createElement("div");
        status.className = "dz-lobby-player-status";
        const isHost = hostId && String(p.id) === String(hostId);
        const ready = readyLookup?.get?.(String(p.id)) || false;
        status.textContent = isHost
          ? (ready ? "Host - Ready" : "Host - Not Ready")
          : (ready ? "Ready" : "Not Ready");
        if(ready) status.classList.add("is-ready");
        if(isHost) status.classList.add("is-host");

        left.appendChild(name);
        left.appendChild(status);

        const ping = this.buildPingBars(p.ping);
        slot.appendChild(left);
        slot.appendChild(ping);
      } else {
        const pending = document.createElement("div");
        pending.className = "dz-lobby-player-pending";
        pending.textContent = "Pending player...";
        slot.appendChild(pending);
      }
      this.playerList.appendChild(slot);
    }
  }

  buildPingBars(ping){
    const bars = document.createElement("div");
    bars.className = "dz-lobby-ping";
    const strength = this.getPingStrength(ping);
    for(let i=0;i<4;i++){
      const bar = document.createElement("span");
      if(i < strength) bar.classList.add("is-on");
      bar.style.height = `${6 + i * 2}px`;
      bars.appendChild(bar);
    }
    return bars;
  }

  getPingStrength(ping){
    const value = Number.isFinite(ping) ? ping : 70;
    if(value <= 50) return 4;
    if(value <= 80) return 3;
    if(value <= 120) return 2;
    if(value <= 160) return 1;
    return 0;
  }
}
