export const LOBBY_THEMES = {
  mp: {
    "lobby-bg": "#0b0e10",
    "lobby-panel": "rgba(14,18,22,0.86)",
    "lobby-panel-border": "rgba(255,255,255,0.08)",
    "lobby-text": "#eef2f5",
    "lobby-text-dim": "rgba(238,242,245,0.65)",
    "lobby-accent": "#2ef2c6",
    "lobby-accent-soft": "rgba(46,242,198,0.18)",
    "lobby-glow": "0 0 12px rgba(46,242,198,0.25)",
    "lobby-motif": [
      "repeating-linear-gradient(0deg, rgba(46,242,198,0.08) 0 1px, transparent 1px 6px)",
      "repeating-linear-gradient(90deg, rgba(46,242,198,0.05) 0 1px, transparent 1px 26px)",
      "radial-gradient(circle at 18% 20%, rgba(46,242,198,0.12), transparent 42%)",
      "radial-gradient(circle at 78% 72%, rgba(46,242,198,0.08), transparent 45%)"
    ].join(", "),
    "lobby-motif-2": "linear-gradient(180deg, rgba(0,0,0,0.65), transparent 18%, transparent 82%, rgba(0,0,0,0.7))",
    "lobby-noise": "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 4px)"
  },
  zm: {
    "lobby-bg": "#0b0e10",
    "lobby-panel": "rgba(18,16,14,0.88)",
    "lobby-panel-border": "rgba(255,255,255,0.08)",
    "lobby-text": "#f2f2f2",
    "lobby-text-dim": "rgba(242,242,242,0.62)",
    "lobby-accent": "#ff5a2a",
    "lobby-accent-soft": "rgba(255,90,42,0.18)",
    "lobby-glow": "0 0 12px rgba(255,90,42,0.28)",
    "lobby-motif": [
      "repeating-linear-gradient(0deg, rgba(255,90,42,0.05) 0 1px, transparent 1px 7px)",
      "radial-gradient(circle at 20% 30%, rgba(255,110,60,0.16), transparent 44%)",
      "radial-gradient(circle at 75% 70%, rgba(255,80,40,0.12), transparent 48%)"
    ].join(", "),
    "lobby-motif-2": "linear-gradient(180deg, rgba(0,0,0,0.7), transparent 20%, transparent 80%, rgba(0,0,0,0.75))",
    "lobby-noise": "repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 5px)"
  }
};

export function applyLobbyTheme(el, mode){
  const theme = LOBBY_THEMES[mode] || LOBBY_THEMES.mp;
  if(!el || !theme) return;
  for(const [key, value] of Object.entries(theme)){
    el.style.setProperty(`--${key}`, value);
  }
  el.dataset.lobbyMode = mode || "mp";
}
