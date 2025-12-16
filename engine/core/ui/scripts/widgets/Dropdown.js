export function Dropdown({ label, options=[], value=null, onChange, help="" }){
  const wrap = document.createElement("div");
  wrap.className = "dz-field";
  const lab = document.createElement("div");
  lab.className = "dz-label";
  lab.textContent = label;
  const sel = document.createElement("select");
  sel.className = "dz-select";
  for(const opt of options){
    const o = document.createElement("option");
    o.value = String(opt.value);
    o.textContent = opt.label;
    sel.appendChild(o);
  }
  if(value != null) sel.value = String(value);
  sel.onchange = ()=> onChange?.(sel.value);
  const helpEl = document.createElement("div");
  helpEl.className="dz-help";
  helpEl.textContent=help;

  wrap.appendChild(lab);
  wrap.appendChild(sel);
  if(help) wrap.appendChild(helpEl);
  return wrap;
}
