import { Button } from "../widgets/Button.js";
import { ListBox } from "../widgets/ListBox.js";

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

function cardShell(){
  const c = document.createElement("div");
  c.style.border = "1px solid rgba(255,255,255,0.08)";
  c.style.borderRadius = "14px";
  c.style.background = "rgba(0,0,0,0.22)";
  c.style.padding = "12px";
  c.style.minWidth = "0";
  return c;
}

export function LoadoutSelectScreen({
  weapons = [],
  selectedPrimaryId = null,
  selectedSecondaryId = null,
  onConfirm,
  onBack
}){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 95vw)";
  panel.style.height = "min(86vh, 780px)";
  panel.style.display = "grid";
  panel.style.gridTemplateColumns = "340px 1fr";
  panel.style.gap = "12px";
  panel.style.padding = "14px";

  const left = document.createElement("div");
  left.style.display="flex";
  left.style.flexDirection="column";
  left.style.gap="10px";
  left.style.minWidth="0";

  const title = document.createElement("h2");
  title.className = "dz-title";
  title.style.margin="0";
  title.textContent = "Loadout Select";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Choose Primary + Secondary. Engine-owned UI; feed it any weapon defs.";

  let activeSlot = "primary";
  let primaryId = selectedPrimaryId;
  let secondaryId = selectedSecondaryId;

  const slotWrap = cardShell();
  slotWrap.style.display="flex";
  slotWrap.style.flexDirection="column";
  slotWrap.style.gap="10px";

  const slotTitle = document.createElement("div");
  slotTitle.style.fontWeight="950";
  slotTitle.textContent = "Slots";

  const slotButtons = document.createElement("div");
  slotButtons.style.display="grid";
  slotButtons.style.gridTemplateColumns="1fr 1fr";
  slotButtons.style.gap="10px";

  function slotBtn(label, slot){
    const b = document.createElement("button");
    b.type="button";
    b.style.all="unset";
    b.style.cursor="pointer";
    b.style.padding="10px";
    b.style.borderRadius="12px";
    b.style.border="1px solid rgba(255,255,255,0.10)";
    b.style.background="rgba(0,0,0,0.18)";
    b.style.display="flex";
    b.style.flexDirection="column";
    b.style.gap="6px";

    const top = document.createElement("div");
    top.style.display="flex";
    top.style.justifyContent="space-between";
    top.style.alignItems="center";

    const t = document.createElement("div");
    t.style.fontWeight="950";
    t.textContent = label;

    const badge = document.createElement("div");
    badge.style.fontFamily="var(--ui-mono)";
    badge.style.fontSize="11px";
    badge.style.opacity="0.85";
    badge.textContent = (slot === "primary" ? "P1" : "P2");

    top.appendChild(t);
    top.appendChild(badge);

    const val = document.createElement("div");
    val.className="dz-help";
    val.textContent = "None";

    b.appendChild(top);
    b.appendChild(val);

    b.addEventListener("click", ()=>{
      activeSlot = slot;
      render();
    });

    return { el:b, val };
  }

  const btnPrimary = slotBtn("Primary", "primary");
  const btnSecondary = slotBtn("Secondary", "secondary");
  slotButtons.appendChild(btnPrimary.el);
  slotButtons.appendChild(btnSecondary.el);

  slotWrap.appendChild(slotTitle);
  slotWrap.appendChild(slotButtons);

  let activeCat = "assault";
  const catBox = ListBox({
    label: "Categories",
    items: PRIMARY_CATS,
    value: activeCat,
    onChange: (v)=>{ activeCat=v; renderWeaponList(); },
    help: "Categories adapt to active slot.",
  });

  left.appendChild(title);
  left.appendChild(sub);
  left.appendChild(slotWrap);
  left.appendChild(catBox);

  const right = document.createElement("div");
  right.style.display="flex";
  right.style.flexDirection="column";
  right.style.gap="10px";
  right.style.minWidth="0";

  const topRow = document.createElement("div");
  topRow.className="dz-row";
  topRow.style.alignItems="center";

  const hint = document.createElement("div");
  hint.className="dz-help";
  hint.textContent="Confirm saves the loadout and starts the match.";

  const btnRow = document.createElement("div");
  btnRow.style.marginLeft="auto";
  btnRow.style.display="flex";
  btnRow.style.gap="10px";
  const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() });
  const okBtn = Button({ text:"Confirm Loadout", onClick: ()=>onConfirm?.({ primaryId, secondaryId }) });
  btnRow.appendChild(backBtn);
  btnRow.appendChild(okBtn);

  topRow.appendChild(hint);
  topRow.appendChild(btnRow);

  const body = document.createElement("div");
  body.style.flex="1";
  body.style.minHeight="0";
  body.style.display="grid";
  body.style.gridTemplateColumns="1fr 1fr";
  body.style.gap="12px";

  const listCard = cardShell();
  listCard.style.display="flex";
  listCard.style.flexDirection="column";
  listCard.style.gap="10px";

  const detailCard = cardShell();
  detailCard.style.display="flex";
  detailCard.style.flexDirection="column";
  detailCard.style.gap="10px";

  const weapListWrap = document.createElement("div");
  weapListWrap.style.flex="1";
  weapListWrap.style.minHeight="0";
  weapListWrap.style.overflow="auto";
  weapListWrap.style.paddingRight="6px";
  listCard.appendChild(weapListWrap);

  const detailWrap = document.createElement("div");
  detailWrap.style.flex="1";
  detailWrap.style.minHeight="0";
  detailWrap.style.overflow="auto";
  detailWrap.style.paddingRight="6px";
  detailCard.appendChild(detailWrap);

  function slotCats(){
    return activeSlot === "secondary" ? SECONDARY_CATS : PRIMARY_CATS;
  }

  function ensureDefaults(){
    if(!primaryId){
      const p = weapons.find(w=>catForWeapon(w) !== "pistol") || weapons[0];
      primaryId = p?.id || null;
    }
    if(!secondaryId){
      const s = weapons.find(w=>catForWeapon(w) === "pistol") || weapons[0];
      secondaryId = s?.id || null;
    }
  }

  function activeSelectedId(){
    return activeSlot === "secondary" ? secondaryId : primaryId;
  }

  function setActiveSelectedId(id){
    if(activeSlot === "secondary") secondaryId = id;
    else primaryId = id;
  }

  function renderWeaponList(){
    weapListWrap.innerHTML = "";
    const allowed = new Set(slotCats().map(c=>c.value));

    // If current category is not allowed, jump to first allowed category
    if(!allowed.has(activeCat)){
      activeCat = slotCats()[0].value;
      catBox.setValue?.(activeCat);
    }

    // If active category has nothing, jump to the first category that has weapons
    if(!weapons.some(w=>allowed.has(catForWeapon(w)) && catForWeapon(w) === activeCat)){
      for(const c of slotCats().map(c=>c.value)){
        if(weapons.some(w=>allowed.has(catForWeapon(w)) && catForWeapon(w) === c)){
          activeCat = c;
          catBox.setValue?.(activeCat);
          break;
        }
      }
    }

    const filtered = weapons.filter(w=>allowed.has(catForWeapon(w)) && catForWeapon(w) === activeCat);
    if(!activeSelectedId()){
      setActiveSelectedId(filtered[0]?.id || null);
    }

    const selectedId = activeSelectedId();

    if(filtered.length === 0){
      const none = document.createElement("div");
      none.className="dz-help";
      none.textContent="No weapons in this category yet.";
      weapListWrap.appendChild(none);
      renderDetails();
      return;
    }

    for(const w of filtered){
      const row = document.createElement("button");
      row.type="button";
      row.style.all="unset";
      row.style.display="block";
      row.style.cursor="pointer";
      row.style.padding="10px";
      row.style.borderRadius="12px";
      row.style.border = (w.id === selectedId) ? "1px solid rgba(122,160,255,0.55)" : "1px solid rgba(255,255,255,0.08)";
      row.style.background = (w.id === selectedId) ? "rgba(122,160,255,0.12)" : "rgba(0,0,0,0.18)";
      row.style.marginBottom="10px";

      const name = document.createElement("div");
      name.style.fontWeight="950";
      name.textContent = w.name;

      const meta = document.createElement("div");
      meta.className="dz-help";
      meta.textContent = `DMG ${w.damage} | RNG ${w.range} | CLIP ${w.ammoClip}/${w.ammoMag}`;

      row.appendChild(name);
      row.appendChild(meta);

      row.addEventListener("click", ()=>{
        setActiveSelectedId(w.id);
        render();
      });

      weapListWrap.appendChild(row);
    }

    renderDetails();
  }

  function renderDetails(){
    detailWrap.innerHTML = "";
    const id = activeSelectedId();
    const wpn = weapons.find(w=>w.id === id) || weapons[0];

    if(!wpn){
      const none = document.createElement("div");
      none.className="dz-help";
      none.textContent="No weapon selected.";
      detailWrap.appendChild(none);
      return;
    }

    const slotNote = document.createElement("div");
    slotNote.className="dz-help";
    slotNote.textContent = activeSlot === "secondary" ? "Assigning SECONDARY" : "Assigning PRIMARY";

    const h = document.createElement("div");
    h.style.display="flex";
    h.style.justifyContent="space-between";
    h.style.gap="12px";

    const nm = document.createElement("div");
    nm.style.fontWeight="950";
    nm.style.fontSize="18px";
    nm.textContent = wpn.name;

    const wid = document.createElement("div");
    wid.style.fontFamily="var(--ui-mono)";
    wid.style.opacity="0.8";
    wid.textContent = wpn.id;

    h.appendChild(nm);
    h.appendChild(wid);

    const stats = document.createElement("div");
    stats.className="dz-help";
    stats.textContent = `Damage ${wpn.damage} | Range ${wpn.range} | Dropoff ${wpn.dropoff} | RPM ${wpn.rpm}`;

    const ammo = document.createElement("div");
    ammo.className="dz-help";
    ammo.textContent = `Ammo: clip ${wpn.ammoClip}, reserve ${wpn.ammoMag}`;

    const attrs = document.createElement("pre");
    attrs.style.margin="8px 0 0 0";
    attrs.style.padding="10px";
    attrs.style.borderRadius="12px";
    attrs.style.background="rgba(0,0,0,0.35)";
    attrs.style.border="1px solid rgba(255,255,255,0.08)";
    attrs.style.overflow="auto";
    attrs.style.fontFamily="var(--ui-mono)";
    attrs.style.fontSize="12px";
    attrs.textContent = `attributes: ${(wpn.attributes||[]).join(", ")}\nmodel: ${wpn.model}`;

    detailWrap.appendChild(slotNote);
    detailWrap.appendChild(h);
    detailWrap.appendChild(stats);
    detailWrap.appendChild(ammo);
    detailWrap.appendChild(attrs);
  }

  function render(){
    ensureDefaults();

    const pName = weapons.find(w=>w.id===primaryId)?.name || (primaryId||"None");
    const sName = weapons.find(w=>w.id===secondaryId)?.name || (secondaryId||"None");
    btnPrimary.val.textContent = pName;
    btnSecondary.val.textContent = sName;

    const activeStyle = (el, on)=>{
      el.style.border = on ? "1px solid rgba(122,160,255,0.60)" : "1px solid rgba(255,255,255,0.10)";
      el.style.background = on ? "rgba(122,160,255,0.12)" : "rgba(0,0,0,0.18)";
      el.style.boxShadow = on ? "0 10px 26px rgba(0,0,0,0.35)" : "none";
    };
    activeStyle(btnPrimary.el, activeSlot==="primary");
    activeStyle(btnSecondary.el, activeSlot==="secondary");

    const cats = slotCats();
    catBox.setItems?.(cats);

    // Keep category allowed
    const allowed = new Set(cats.map(c=>c.value));
    if(!allowed.has(activeCat)){
      activeCat = cats[0].value;
      catBox.setValue?.(activeCat);
    }

    renderWeaponList();
  }

  right.appendChild(topRow);
  right.appendChild(body);
  body.appendChild(listCard);
  body.appendChild(detailCard);

  panel.appendChild(left);
  panel.appendChild(right);
  screen.appendChild(panel);

  render();
  return screen;
}
