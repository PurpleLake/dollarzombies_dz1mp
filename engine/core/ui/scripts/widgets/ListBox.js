export function ListBox({ label, items=[], value=null, onChange, help="" }){
  const root = document.createElement("div");
  root.className = "dz-field";
  const lab = document.createElement("div");
  lab.className = "dz-label";
  lab.textContent = label;

  const box = document.createElement("div");
  box.className = "dz-listbox";

  function render(){
    box.innerHTML = "";
    for(const it of items){
      const row = document.createElement("div");
      row.className = "dz-item" + (String(it.value) === String(value) ? " dz-active" : "");
      const left = document.createElement("div");
      left.textContent = it.label;
      left.style.fontWeight="700";
      const right = document.createElement("div");
      right.style.opacity="0.7";
      right.textContent = it.meta ?? "";
      row.appendChild(left);
      row.appendChild(right);
      row.onclick = ()=>{
        value = it.value;
        onChange?.(value);
        render();
      };
      box.appendChild(row);
    }
  }
  render();

  const helpEl = document.createElement("div");
  helpEl.className="dz-help";
  helpEl.textContent=help;

  root.appendChild(lab);
  root.appendChild(box);
  if(help) root.appendChild(helpEl);
  return root;
}
