import { Button } from "../widgets/Button.js";

function row(label, el){
  const r = document.createElement("div");
  r.style.display="grid";
  r.style.gridTemplateColumns="160px 1fr";
  r.style.gap="10px";
  r.style.alignItems="center";
  const l = document.createElement("div");
  l.className="dz-help";
  l.textContent=label;
  r.appendChild(l);
  r.appendChild(el);
  return r;
}

export function MpClassScreen({ engine, onBack }){
  const screen = document.createElement("div");
  screen.className="dz-screen";

  const panel = document.createElement("div");
  panel.className="dz-panel";
  panel.style.width="min(980px, 94vw)";
  panel.style.padding="18px";

  const title = document.createElement("h1");
  title.className="dz-title";
  title.textContent="Multiplayer Classes";

  const sub = document.createElement("div");
  sub.className="dz-sub";
  sub.textContent="Create up to 5 classes. Pick one, then start Multiplayer.";

  const options = engine.ctx.options;
  const db = engine.ctx.weapons;
  const weapons = db.list();

  const classes = options.get("mpClasses") || [];
  let active = options.get("mpActiveClass") || 0;

  const list = document.createElement("div");
  list.style.display="grid";
  list.style.gridTemplateColumns="1fr 1fr";
  list.style.gap="12px";
  list.style.marginTop="12px";

  const editor = document.createElement("div");
  editor.style.marginTop="14px";
  editor.style.display="grid";
  editor.style.gap="10px";

  const activeLabel = document.createElement("div");
  activeLabel.className="dz-help";
  activeLabel.style.marginTop="10px";

  function weaponSelect(current, onChange){
    const sel = document.createElement("select");
    sel.className="dz-input";
    for(const w of weapons){
      const o = document.createElement("option");
      o.value = w.id;
      o.textContent = `${w.name} (${w.id})`;
      if(w.id === current) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", ()=>onChange(sel.value));
    return sel;
  }

  const nameInput = document.createElement("input");
  nameInput.className="dz-input";
  nameInput.placeholder="Class name";

  let primarySel = weaponSelect("ar_m4", ()=>{});
  let secondarySel = weaponSelect("glock_19", ()=>{});

  function renderList(){
    list.innerHTML="";
    classes.forEach((c, idx)=>{
      const card = document.createElement("button");
      card.type="button";
      card.style.all="unset";
      card.style.cursor="pointer";
      card.style.border="1px solid rgba(255,255,255,0.12)";
      card.style.background = (idx===active) ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.18)";
      card.style.borderRadius="14px";
      card.style.padding="12px";
      card.style.display="grid";
      card.style.gap="6px";

      const h = document.createElement("div");
      h.style.fontWeight="950";
      h.textContent = `${idx+1}. ${c.name || "Class"}`;

      const p = document.createElement("div");
      p.className="dz-help";
      p.textContent = `Primary: ${c.primary} | Secondary: ${c.secondary}`;

      card.appendChild(h);
      card.appendChild(p);

      card.addEventListener("click", ()=>{
        active = idx;
        options.set("mpActiveClass", active);
        renderEditor();
        renderList();
      });

      list.appendChild(card);
    });
  }

  function renderEditor(){
    const c = classes[active] || { name:"Class", primary:"ar_m4", secondary:"glock_19" };
    nameInput.value = c.name || "";
    // rebuild selects with current values
    primarySel = weaponSelect(c.primary, (v)=>{ c.primary=v; options.set("mpClasses", classes); });
    secondarySel = weaponSelect(c.secondary, (v)=>{ c.secondary=v; options.set("mpClasses", classes); });

    nameInput.oninput = ()=>{
      c.name = nameInput.value;
      options.set("mpClasses", classes);
      renderList();
    };

    editor.innerHTML="";
    editor.appendChild(row("Class name", nameInput));
    editor.appendChild(row("Primary", primarySel));
    editor.appendChild(row("Secondary", secondarySel));

    activeLabel.textContent = `Active class: ${active+1} (will be used when you spawn)`;
  }

  renderList();
  renderEditor();

  const rowBtns = document.createElement("div");
  rowBtns.className="dz-row";
  rowBtns.style.marginTop="14px";
  rowBtns.appendChild(Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() }));

  panel.appendChild(title);
  panel.appendChild(sub);
  panel.appendChild(list);
  panel.appendChild(activeLabel);
  panel.appendChild(editor);
  panel.appendChild(rowBtns);

  screen.appendChild(panel);
  return screen;
}
