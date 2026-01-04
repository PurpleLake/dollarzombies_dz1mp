export const mpMaps = [
  {
    id: "mp_arena",
    name: "Arena",
    desc: "Symmetrical close-range scrim box.",
    preview: "/public/assets/ui/maps/mp_arena.png",
    root: "/engine/game/mp/maps/mp_arena",
    entryScript: "/engine/game/mp/maps/mp_arena/scripts/map.js",
  },
  {
    id: "mp_outpost",
    name: "Outpost",
    desc: "Mid-lane control with side cover.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_outpost",
    entryScript: "/engine/game/mp/maps/mp_outpost/scripts/map.js",
  },
  {
    id: "mp_crossroads",
    name: "Crossroads",
    desc: "Central pool with tight cross-lanes.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_crossroads",
    entryScript: "/engine/game/mp/maps/mp_crossroads/scripts/map.js",
  },
  {
    id: "mp_tunnels",
    name: "Tunnels",
    desc: "Boxy tunnels and close mid fights.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_tunnels",
    entryScript: "/engine/game/mp/maps/mp_tunnels/scripts/map.js",
  },
  {
    id: "mp_sunset",
    name: "Sunset Yard",
    desc: "Open yard with central cover and flanks.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_sunset",
    entryScript: "/engine/game/mp/maps/mp_sunset/scripts/map.js",
  },
  {
    id: "mp_foundry",
    name: "Foundry",
    desc: "Crossed mid with tight side routes.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_foundry",
    entryScript: "/engine/game/mp/maps/mp_foundry/scripts/map.js",
  },
  {
    id: "mp_underpass",
    name: "Underpass",
    desc: "Twin lanes split by mid blocks.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_underpass",
    entryScript: "/engine/game/mp/maps/mp_underpass/scripts/map.js",
  },
  {
    id: "mp_hamlet",
    name: "Hamlet",
    desc: "Village blocks with open lanes.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_hamlet",
    entryScript: "/engine/game/mp/maps/mp_hamlet/scripts/map.js",
  },
  {
    id: "mp_ridge",
    name: "Ridge",
    desc: "Stepped ridge with fence flanks.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "/engine/game/mp/maps/mp_ridge",
    entryScript: "/engine/game/mp/maps/mp_ridge/scripts/map.js",
  },
  {
    id: "mp_comingsoon",
    name: "Coming Soon",
    desc: "Prototype battlegrounds in progress.",
    preview: "/public/assets/modes/mp_hover.png",
    root: "",
    entryScript: "",
    disabled: true,
  },
];

export function getMpMap(id){
  const match = mpMaps.find(m=>m.id === id && !m.disabled);
  return match || mpMaps.find(m=>!m.disabled) || mpMaps[0];
}
