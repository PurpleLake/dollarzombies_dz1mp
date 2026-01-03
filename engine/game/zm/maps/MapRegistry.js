export const zmMaps = [
  {
    id: "zm_facility",
    name: "Facility",
    desc: "Close-quarters survival arena.",
    preview: "/public/assets/ui/maps/zm_facility.png",
    root: "/engine/game/zm/maps/zm_facility",
    entryScript: "/engine/game/zm/maps/zm_facility/scripts/map.js",
  },
  {
    id: "zm_silo",
    name: "Silo",
    desc: "Central tower with tight outer lanes.",
    preview: "/public/assets/modes/zm_hover.png",
    root: "/engine/game/zm/maps/zm_silo",
    entryScript: "/engine/game/zm/maps/zm_silo/scripts/map.js",
  },
  {
    id: "zm_derelict",
    name: "Derelict",
    desc: "Cramped bunker with tight sightlines.",
    preview: "/public/assets/modes/zm_hover.png",
    root: "/engine/game/zm/maps/zm_derelict",
    entryScript: "/engine/game/zm/maps/zm_derelict/scripts/map.js",
  },
  {
    id: "zm_asylum",
    name: "Asylum",
    desc: "Long hallways with branching wings.",
    preview: "/public/assets/modes/zm_hover.png",
    root: "/engine/game/zm/maps/zm_asylum",
    entryScript: "/engine/game/zm/maps/zm_asylum/scripts/map.js",
  },
  {
    id: "zm_swamp",
    name: "Swamp",
    desc: "Central hub connected to distant huts.",
    preview: "/public/assets/modes/zm_hover.png",
    root: "/engine/game/zm/maps/zm_swamp",
    entryScript: "/engine/game/zm/maps/zm_swamp/scripts/map.js",
  },
  {
    id: "zm_factory",
    name: "Factory",
    desc: "Industrial complex with big loops.",
    preview: "/public/assets/modes/zm_hover.png",
    root: "/engine/game/zm/maps/zm_factory",
    entryScript: "/engine/game/zm/maps/zm_factory/scripts/map.js",
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
