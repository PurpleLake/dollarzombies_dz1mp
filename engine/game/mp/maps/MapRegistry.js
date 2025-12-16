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
