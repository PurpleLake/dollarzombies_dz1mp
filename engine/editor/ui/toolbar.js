export function createToolbar(el, actions){
  const buttons = [
    { id:"new", label:"New" },
    { id:"open", label:"Open" },
    { id:"save", label:"Save" },
    { id:"saveAs", label:"Save As" },
    { id:"compile", label:"Compile" },
  ];
  buttons.forEach(btn=>{
    const b = document.createElement("button");
    b.textContent = btn.label;
    b.addEventListener("click", ()=> actions[btn.id]?.());
    el.appendChild(b);
  });
  const spacer = document.createElement("div");
  spacer.className = "spacer";
  el.appendChild(spacer);

  const dropBtn = document.createElement("button");
  dropBtn.textContent = "Drop to Ground";
  dropBtn.title = "Snap selected to ground";
  dropBtn.addEventListener("click", ()=> actions.drop?.());
  el.appendChild(dropBtn);

  const modeLabel = document.createElement("span");
  modeLabel.textContent = " Gizmo: ";
  el.appendChild(modeLabel);

  const modeSelect = document.createElement("select");
  ["translate", "rotate", "scale"].forEach(m=>{
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modeSelect.appendChild(opt);
  });
  modeSelect.addEventListener("change", ()=> actions.setMode?.(modeSelect.value));
  el.appendChild(modeSelect);

  const snap = document.createElement("input");
  snap.type = "number"; snap.step = "0.1"; snap.min = "0"; snap.value = "0.5";
  snap.style.width = "72px";
  snap.title = "Grid snap size";
  snap.addEventListener("change", ()=> actions.setSnap?.(Number(snap.value)));
  el.appendChild(snap);

  return { setMode(mode){ modeSelect.value = mode; } };
}
