import { Button } from "../widgets/Button.js";

const PRIMARY_CATS = [
  { value:"assault", label:"Assault Rifles" },
  { value:"smg", label:"Sub Machine Guns" },
  { value:"lmg", label:"Light Machine Guns" },
  { value:"shotgun", label:"Shotguns" },
  { value:"sniper", label:"Snipers" },
  { value:"launcher", label:"Launchers" },
];

const SECONDARY_CATS = [
  { value:"pistol", label:"Pistols" },
];

const FRAG_OPTIONS = ["Frag", "Semtex", "C4", "Throwing Knife"];
const PERK_OPTIONS = ["Perk 1", "Perk 2", "Perk 3", "Perk 4", "Perk 5"];
const DEFAULT_PERKS = ["Perk 1", "Perk 2", "Perk 3"];

const SLOT_DEFS = [
  { id:"primary", label:"Primary Weapon" },
  { id:"secondary", label:"Secondary Weapon" },
  { id:"frag", label:"Lethal" },
  { id:"perk1", label:"Perk 1" },
  { id:"perk2", label:"Perk 2" },
  { id:"perk3", label:"Perk 3" },
];

function catForWeapon(w){
  const a = new Set(w.attributes || []);
  if(a.has("launcher")) return "launcher";
  if(a.has("sniper")) return "sniper";
  if(a.has("smg")) return "smg";
  if(a.has("lmg")) return "lmg";
  if(a.has("shotgun")) return "shotgun";
  if(a.has("pistol")) return "pistol";
  if(a.has("rifle")) return "assault";
  return "assault";
}

function pickDefaultPrimary(weapons){
  return weapons.find(w=>catForWeapon(w) !== "pistol")?.id || weapons[0]?.id || "ar_m4";
}

function pickDefaultSecondary(weapons){
  return weapons.find(w=>catForWeapon(w) === "pistol")?.id || weapons[0]?.id || "glock_19";
}

function normalizeClass(c, fallback){
  const perks = Array.isArray(c?.perks) ? c.perks.slice(0, 3) : [];
  while(perks.length < 3) perks.push(DEFAULT_PERKS[perks.length] || "Perk");
  return {
    name: c?.name ?? fallback.name,
    primary: c?.primary ?? fallback.primary,
    secondary: c?.secondary ?? fallback.secondary,
    frag: c?.frag ?? fallback.frag,
    perks,
  };
}

function buttonCard(){
  const b = document.createElement("button");
  b.type="button";
  b.style.all="unset";
  b.style.cursor="pointer";
  b.style.border="1px solid rgba(255,255,255,0.14)";
  b.style.borderRadius="8px";
  b.style.padding="10px";
  b.style.display="grid";
  b.style.gap="6px";
  b.style.background="rgba(0,0,0,0.28)";
  return b;
}

function setActiveStyle(el, on){
  el.style.border = on ? "1px solid color-mix(in srgb, var(--ui-accent) 70%, rgba(255,255,255,0.2))" : "1px solid rgba(255,255,255,0.14)";
  el.style.background = on ? "color-mix(in srgb, var(--ui-accent) 18%, rgba(0,0,0,0.3))" : "rgba(0,0,0,0.28)";
  el.style.boxShadow = on ? "0 12px 26px rgba(0,0,0,0.35)" : "none";
}

export function ClassEditorScreen({ engine, mode="zm", onBack, onConfirm }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1220px, 96vw)";
  panel.style.height = "min(86vh, 820px)";
  panel.style.display = "grid";
  panel.style.gridTemplateColumns = "240px minmax(280px, 1fr) minmax(280px, 1fr)";
  panel.style.gridTemplateRows = "auto 1fr";
  panel.style.gap = "12px";
  panel.style.padding = "16px";

  const header = document.createElement("div");
  header.style.gridColumn = "1 / -1";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "12px";

  const title = document.createElement("div");
  title.className = "dz-title";
  title.textContent = "Create a Class";

  const modeTag = document.createElement("div");
  modeTag.className = "dz-help";
  modeTag.style.marginLeft = "auto";
  modeTag.textContent = mode === "mp" ? "Multiplayer" : "Zombies";

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "8px";

  const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() });
  const doneBtn = Button({ text:"Done", onClick: ()=>onConfirm?.() });
  btnRow.appendChild(backBtn);
  btnRow.appendChild(doneBtn);

  header.appendChild(title);
  header.appendChild(modeTag);
  header.appendChild(btnRow);

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "10px";
  left.style.minWidth = "0";
  left.style.minHeight = "0";
  left.style.gridRow = "2";

  const leftTitle = document.createElement("div");
  leftTitle.className = "dz-label";
  leftTitle.textContent = "Custom Classes";

  const classList = document.createElement("div");
  classList.style.display = "grid";
  classList.style.gap = "8px";
  classList.style.flex = "1";
  classList.className = "dz-scroll";

  left.appendChild(leftTitle);
  left.appendChild(classList);

  const center = document.createElement("div");
  center.style.display = "flex";
  center.style.flexDirection = "column";
  center.style.gap = "10px";
  center.style.minWidth = "0";
  center.style.minHeight = "0";
  center.style.gridRow = "2";

  const nameRow = document.createElement("div");
  nameRow.style.display = "grid";
  nameRow.style.gridTemplateColumns = "120px 1fr";
  nameRow.style.gap = "10px";
  nameRow.style.alignItems = "center";

  const nameLabel = document.createElement("div");
  nameLabel.className = "dz-help";
  nameLabel.textContent = "Class Name";

  const nameInput = document.createElement("input");
  nameInput.className = "dz-input";
  nameInput.placeholder = "Custom Class";

  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);

  const slotList = document.createElement("div");
  slotList.style.display = "grid";
  slotList.style.gap = "8px";
  slotList.style.flex = "1";
  slotList.className = "dz-scroll";

  center.appendChild(nameRow);
  center.appendChild(slotList);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.gap = "10px";
  right.style.minWidth = "0";
  right.style.minHeight = "0";
  right.style.gridRow = "2";

  const optionsTitle = document.createElement("div");
  optionsTitle.className = "dz-label";
  optionsTitle.textContent = "Options";

  const optionsBody = document.createElement("div");
  optionsBody.style.display = "grid";
  optionsBody.style.gap = "10px";
  optionsBody.style.minHeight = "0";
  optionsBody.style.flex = "1";
  optionsBody.className = "dz-scroll";

  const detailWrap = document.createElement("div");
  detailWrap.style.border = "1px solid rgba(255,255,255,0.08)";
  detailWrap.style.borderRadius = "8px";
  detailWrap.style.background = "rgba(0,0,0,0.32)";
  detailWrap.style.padding = "10px";
  detailWrap.style.minHeight = "110px";
  detailWrap.style.maxHeight = "220px";
  detailWrap.className = "dz-scroll";

  right.appendChild(optionsTitle);
  right.appendChild(optionsBody);
  right.appendChild(detailWrap);

  panel.appendChild(header);
  panel.appendChild(left);
  panel.appendChild(center);
  panel.appendChild(right);
  screen.appendChild(panel);

  const options = engine.ctx.options;
  const weapons = engine.ctx.weapons?.list?.() || [];
  const storeKey = mode === "mp" ? "mpClasses" : "zmClasses";
  const activeKey = mode === "mp" ? "mpActiveClass" : "zmActiveClass";

  let classes = Array.isArray(options.get(storeKey)) ? options.get(storeKey) : [];
  let active = Number(options.get(activeKey) || 0);
  let activeSlot = "primary";
  let activeCat = "assault";

  function defaultClass(idx){
    const primary = pickDefaultPrimary(weapons);
    const secondary = pickDefaultSecondary(weapons);
    return {
      name: `Custom ${idx + 1}`,
      primary,
      secondary,
      frag: "Frag",
      perks: DEFAULT_PERKS.slice(),
    };
  }

  function ensureClasses(){
    if(!Array.isArray(classes)) classes = [];
    for(let i = 0; i < 5; i++){
      const fallback = defaultClass(i);
      const existing = classes[i];
      classes[i] = normalizeClass(existing, fallback);
    }
    classes.length = 5;
    if(active < 0 || active > 4) active = 0;
    options.set(storeKey, classes);
    options.set(activeKey, active);
  }

  function getClass(){
    return classes[active] || defaultClass(active);
  }

  function sync(){
    options.set(storeKey, classes);
  }

  function weaponLabel(id){
    const def = weapons.find(w=>w.id === id);
    return def ? def.name : (id || "None");
  }

  function perkLabel(slotIndex){
    const c = getClass();
    return c.perks?.[slotIndex] || DEFAULT_PERKS[slotIndex];
  }

  function renderClassList(){
    classList.innerHTML = "";
    classes.forEach((c, idx)=>{
      const card = buttonCard();
      const t = document.createElement("div");
      t.style.fontWeight = "900";
      t.textContent = `Custom ${idx + 1}`;
      const name = document.createElement("div");
      name.className = "dz-help";
      name.textContent = c.name || `Custom ${idx + 1}`;
      card.appendChild(t);
      card.appendChild(name);
      setActiveStyle(card, idx === active);
      card.addEventListener("click", ()=>{
        active = idx;
        options.set(activeKey, active);
        renderAll();
      });
      classList.appendChild(card);
    });
  }

  function renderSlots(){
    slotList.innerHTML = "";
    const c = getClass();
    nameInput.value = c.name || "";

    nameInput.oninput = ()=>{
      c.name = nameInput.value;
      sync();
      renderClassList();
    };

    SLOT_DEFS.forEach((slot)=>{
      const card = buttonCard();
      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      top.style.alignItems = "center";
      const label = document.createElement("div");
      label.style.fontWeight = "900";
      label.textContent = slot.label;
      const badge = document.createElement("div");
      badge.style.fontFamily = "var(--ui-mono)";
      badge.style.fontSize = "11px";
      badge.style.opacity = "0.8";
      badge.textContent = slot.id.toUpperCase();
      top.appendChild(label);
      top.appendChild(badge);

      const val = document.createElement("div");
      val.className = "dz-help";
      if(slot.id === "primary") val.textContent = weaponLabel(c.primary);
      else if(slot.id === "secondary") val.textContent = weaponLabel(c.secondary);
      else if(slot.id === "frag") val.textContent = c.frag || "Frag";
      else if(slot.id === "perk1") val.textContent = perkLabel(0);
      else if(slot.id === "perk2") val.textContent = perkLabel(1);
      else if(slot.id === "perk3") val.textContent = perkLabel(2);

      card.appendChild(top);
      card.appendChild(val);
      setActiveStyle(card, slot.id === activeSlot);

      card.addEventListener("click", ()=>{
        activeSlot = slot.id;
        renderSlots();
        renderOptions();
      });
      slotList.appendChild(card);
    });
  }

  function renderCategoryList(categories, onPick){
    const wrap = document.createElement("div");
    wrap.className = "dz-field";
    const label = document.createElement("div");
    label.className = "dz-label";
    label.textContent = "Category";
    const list = document.createElement("div");
    list.className = "dz-listbox";
    wrap.appendChild(label);
    wrap.appendChild(list);

    const allowed = new Set(categories.map(c=>c.value));
    if(!allowed.has(activeCat)) activeCat = categories[0]?.value || "assault";

    list.innerHTML = "";
    for(const cat of categories){
      const row = document.createElement("div");
      row.className = "dz-item" + (cat.value === activeCat ? " dz-active" : "");
      const left = document.createElement("div");
      left.textContent = cat.label;
      left.style.fontWeight = "700";
      row.appendChild(left);
      row.onclick = ()=>{
        activeCat = cat.value;
        onPick();
      };
      list.appendChild(row);
    }
    return wrap;
  }

  function renderWeaponOptions(slot){
    const catDefs = slot === "secondary" ? SECONDARY_CATS : PRIMARY_CATS;
    const catBox = renderCategoryList(catDefs, renderOptions);
    optionsBody.appendChild(catBox);

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "8px";

    const filtered = weapons.filter(w=>catForWeapon(w) === activeCat);
    if(filtered.length === 0){
      const none = document.createElement("div");
      none.className = "dz-help";
      none.textContent = "No weapons in this category.";
      list.appendChild(none);
    }

    const c = getClass();
    const selectedId = slot === "secondary" ? c.secondary : c.primary;
    for(const w of filtered){
      const row = buttonCard();
      const name = document.createElement("div");
      name.style.fontWeight = "900";
      name.textContent = w.name;
      const meta = document.createElement("div");
      meta.className = "dz-help";
      meta.textContent = `DMG ${w.damage} | RNG ${w.range} | CLIP ${w.ammoClip}/${w.ammoMag}`;
      row.appendChild(name);
      row.appendChild(meta);
      setActiveStyle(row, w.id === selectedId);
      row.addEventListener("click", ()=>{
        if(slot === "secondary") c.secondary = w.id;
        else c.primary = w.id;
        sync();
        renderSlots();
        renderOptions();
      });
      list.appendChild(row);
    }

    optionsBody.appendChild(list);

    const selected = weapons.find(w=>w.id === selectedId);
    detailWrap.innerHTML = "";
    if(selected){
      const h = document.createElement("div");
      h.style.display = "flex";
      h.style.justifyContent = "space-between";
      h.style.alignItems = "center";
      const nm = document.createElement("div");
      nm.style.fontWeight = "900";
      nm.textContent = selected.name;
      const id = document.createElement("div");
      id.style.fontFamily = "var(--ui-mono)";
      id.style.opacity = "0.8";
      id.textContent = selected.id;
      h.appendChild(nm);
      h.appendChild(id);
      const stats = document.createElement("div");
      stats.className = "dz-help";
      stats.textContent = `Damage ${selected.damage} | Range ${selected.range} | RPM ${selected.rpm}`;
      detailWrap.appendChild(h);
      detailWrap.appendChild(stats);
    } else {
      const none = document.createElement("div");
      none.className = "dz-help";
      none.textContent = "Pick a weapon.";
      detailWrap.appendChild(none);
    }
  }

  function renderSimpleOptions(optionsList, selectedValue, onPick, detailText){
    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gap = "8px";
    for(const opt of optionsList){
      const row = buttonCard();
      const name = document.createElement("div");
      name.style.fontWeight = "900";
      name.textContent = opt;
      row.appendChild(name);
      setActiveStyle(row, opt === selectedValue);
      row.addEventListener("click", ()=>onPick(opt));
      list.appendChild(row);
    }
    optionsBody.appendChild(list);
    detailWrap.innerHTML = "";
    const d = document.createElement("div");
    d.className = "dz-help";
    d.textContent = detailText;
    detailWrap.appendChild(d);
  }

  function renderOptions(){
    optionsBody.innerHTML = "";
    detailWrap.innerHTML = "";
    const c = getClass();

    if(activeSlot === "primary" || activeSlot === "secondary"){
      renderWeaponOptions(activeSlot);
      return;
    }

    if(activeSlot === "frag"){
      renderSimpleOptions(
        FRAG_OPTIONS,
        c.frag || "Frag",
        (v)=>{ c.frag = v; sync(); renderSlots(); renderOptions(); },
        "Lethal equipment placeholder."
      );
      return;
    }

    const perkIndex = activeSlot === "perk1" ? 0 : activeSlot === "perk2" ? 1 : 2;
    renderSimpleOptions(
      PERK_OPTIONS,
      c.perks?.[perkIndex] || DEFAULT_PERKS[perkIndex],
      (v)=>{
        c.perks = c.perks || DEFAULT_PERKS.slice();
        c.perks[perkIndex] = v;
        sync();
        renderSlots();
        renderOptions();
      },
      "Perks are placeholders for now."
    );
  }

  function renderAll(){
    ensureClasses();
    renderClassList();
    renderSlots();
    renderOptions();
  }

  renderAll();
  return screen;
}
