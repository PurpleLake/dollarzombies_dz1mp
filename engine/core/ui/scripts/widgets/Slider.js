export function Slider({ label, min=0, max=1, step=0.01, value=0.5, onChange, fmt=(v)=>String(v), help="" }){
  const wrap = document.createElement("div");
  wrap.className = "dz-slider";
  const lab = document.createElement("div");
  lab.className = "dz-label";
  lab.textContent = label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const val = document.createElement("div");
  val.className = "dz-value";
  val.textContent = fmt(Number(input.value));
  input.oninput = ()=>{
    const v = Number(input.value);
    val.textContent = fmt(v);
    onChange?.(v);
  };
  const helpEl = document.createElement("div");
  helpEl.className="dz-help";
  helpEl.textContent=help;

  wrap.appendChild(lab);
  wrap.appendChild(input);
  wrap.appendChild(val);
  if(help) wrap.appendChild(helpEl);
  return wrap;
}
