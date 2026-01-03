export const DEFAULT_PREFABS = [
  { key:"wall", name:"Wall", type:"static" },
  { key:"floor", name:"Floor", type:"static" },
  { key:"prop_crate", name:"Crate", type:"prop" },
  { key:"prop_tree", name:"Tree", type:"prop" },
  { key:"light_point", name:"Point Light", type:"light" },
  { key:"zombie_spawn", name:"Zombie Spawn", type:"spawn" },
  { key:"player_spawn", name:"Player Spawn", type:"spawn" },
];

export function createEmptyScene(name="untitled"){
  return {
    editorVersion: "1.0",
    name,
    lastOpened: Date.now(),
    objects: [],
    meta: { selection: [] },
  };
}
