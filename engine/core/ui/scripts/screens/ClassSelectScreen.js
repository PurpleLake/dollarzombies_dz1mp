import { Button } from "../widgets/Button.js";
import { ListBox } from "../widgets/ListBox.js";

const CATS = [
  { value:"assault", label:"Assault Rifles" },
  { value:"smg", label:"Sub Machine Guns" },
  { value:"lmg", label:"Light Machine Guns" },
  { value:"shotgun", label:"Shotguns" },
  { value:"sniper", label:"Snipers" },
  { value:"pistol", label:"Pistols" },
  { value:"launcher", label:"Launchers" },
];

function catForWeapon(w){
  const a = new Set(w.attributes || []);
  // Prefer explicit attributes if present
  if(a.has("launcher")) return "launcher";
  if(a.has("sniper")) return "sniper";
  if(a.has("smg")) return "smg";
  if(a.has("lmg")) return "lmg";
  if(a.has("shotgun")) return "shotgun";
  if(a.has("pistol")) return "pistol";
  if(a.has("rifle")) return "assault";
  return "assault";
}

export function ClassSelectScreen({ weapons=[], selectedId=null, onConfirm, onBack }){
  const screen = document.createElement("div");
  screen.className = "dz-screen";

  const panel = document.createElement("div");
  panel.className = "dz-panel";
  panel.style.width = "min(1100px, 95vw)";
  panel.style.height = "min(86vh, 780px)";
  panel.style.display = "grid";
  panel.style.gridTemplateColumns = "320px 1fr";
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
  title.textContent = "Class Select";

  const sub = document.createElement("div");
  sub.className = "dz-sub";
  sub.textContent = "Pick your primary weapon. The list is generated from WeaponDefs.";

  let activeCat = "assault";
  let activeWeaponId = selectedId;

  const catBox = ListBox({
    label: "Categories",
    items: CATS,
    value: activeCat,
    onChange: (v)=>{ activeCat=v; renderWeapons(); },
    help: "Add more weapons by editing engine/game/core/weapons/scripts/WeaponDefs.js",
  });

  left.appendChild(title);
  left.appendChild(sub);
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
  hint.textContent="Tip: this is just the class selector. Wallbuys and scripts can override later.";

  const btnRow = document.createElement("div");
  btnRow.style.marginLeft="auto";
  btnRow.style.display="flex";
  btnRow.style.gap="10px";
  const backBtn = Button({ text:"Back", variant:"secondary", onClick: ()=>onBack?.() });
  const okBtn = Button({ text:"Confirm Class", onClick: ()=>onConfirm?.(activeWeaponId) });
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

  const listCard = document.createElement("div");
  listCard.style.border="1px solid rgba(255,255,255,0.08)";
  listCard.style.borderRadius="14px";
  listCard.style.background="rgba(0,0,0,0.22)";
  listCard.style.padding="12px";
  listCard.style.minWidth="0";
  listCard.style.display="flex";
  listCard.style.flexDirection="column";
  listCard.style.gap="10px";

  const detailCard = document.createElement("div");
  detailCard.style.border="1px solid rgba(255,255,255,0.08)";
  detailCard.style.borderRadius="14px";
  detailCard.style.background="rgba(0,0,0,0.22)";
  detailCard.style.padding="12px";
  detailCard.style.minWidth="0";
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

  function renderWeapons(){
    weapListWrap.innerHTML = "";
    const filtered = weapons.filter(w=>catForWeapon(w) === activeCat);
    if(!activeWeaponId){
      activeWeaponId = filtered[0]?.id || weapons[0]?.id || null;
    }
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
      row.style.border = (w.id === activeWeaponId) ? "1px solid rgba(122,160,255,0.55)" : "1px solid rgba(255,255,255,0.08)";
      row.style.background = (w.id === activeWeaponId) ? "rgba(122,160,255,0.12)" : "rgba(0,0,0,0.18)";
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
        activeWeaponId = w.id;
        renderWeapons();
        renderDetails();
      });

      weapListWrap.appendChild(row);
    }
    renderDetails();
  }

  function renderDetails(){
    detailWrap.innerHTML = "";
    const wpn = weapons.find(w=>w.id === activeWeaponId) || weapons[0];
    if(!wpn){
      const none = document.createElement("div");
      none.className="dz-help";
      none.textContent="No weapon selected.";
      detailWrap.appendChild(none);
      return;
    }

    const h = document.createElement("div");
    h.style.display="flex";
    h.style.justifyContent="space-between";
    h.style.gap="12px";

    const nm = document.createElement("div");
    nm.style.fontWeight="950";
    nm.style.fontSize="18px";
    nm.textContent = wpn.name;

    const id = document.createElement("div");
    id.style.fontFamily="var(--ui-mono)";
    id.style.opacity="0.8";
    id.textContent = wpn.id;

    h.appendChild(nm);
    h.appendChild(id);

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

    detailWrap.appendChild(h);
    detailWrap.appendChild(stats);
    detailWrap.appendChild(ammo);
    detailWrap.appendChild(attrs);
  }

  right.appendChild(topRow);
  right.appendChild(body);
  body.appendChild(listCard);
  body.appendChild(detailCard);

  panel.appendChild(left);
  panel.appendChild(right);
  screen.appendChild(panel);

  renderWeapons();
  return screen;
}
