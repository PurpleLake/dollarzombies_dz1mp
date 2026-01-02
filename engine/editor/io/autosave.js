const KEY = "dz-editor-autosave";

export function loadAutosave(){
  const raw = localStorage.getItem(KEY);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveAutosave(scene){
  try { localStorage.setItem(KEY, JSON.stringify(scene)); } catch {}
}
