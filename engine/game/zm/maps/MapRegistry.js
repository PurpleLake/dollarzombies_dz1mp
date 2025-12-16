export const zmMaps = [
  {
    id: "zm_facility",
    name: "Facility",
    desc: "Close-quarters survival arena.",
    preview: "/assets/ui/maps/zm_facility.png",
    root: "/engine/game/zm/maps/zm_facility",
    entryScript: "/engine/game/zm/maps/zm_facility/scripts/map.js",
  },
  {
    id: "zm_comingsoon",
    name: "Coming Soon",
    desc: "Additional co-op battlegrounds are being built.",
    preview: "/public/assets/modes/zm_hover.png",
    root: "",
    entryScript: "",
    disabled: true,
  },
];

export function getZmMap(id){
  const match = zmMaps.find(m=>m.id === id && !m.disabled);
  return match || zmMaps.find(m=>!m.disabled) || zmMaps[0];
}
