export function Button({ text, variant="primary", onClick }){
  const b = document.createElement("button");
  b.className = "dz-btn" + (variant==="secondary" ? " dz-secondary" : "");
  b.textContent = text;
  b.onclick = ()=>onClick?.();
  return b;
}
