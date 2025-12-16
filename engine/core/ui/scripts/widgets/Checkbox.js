export function Checkbox({ label, value=false, onChange, help="" }){
  const wrap = document.createElement("label");
  wrap.className = "dz-checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!value;
  input.onchange = ()=> onChange?.(input.checked);
  const col = document.createElement("div");
  col.style.display="flex";
  col.style.flexDirection="column";
  col.style.gap="2px";
  const title = document.createElement("div");
  title.textContent = label;
  title.style.fontWeight="700";
  const h = document.createElement("div");
  h.className = "dz-help";
  h.textContent = help;
  col.appendChild(title);
  if(help) col.appendChild(h);
  wrap.appendChild(input);
  wrap.appendChild(col);
  return wrap;
}
