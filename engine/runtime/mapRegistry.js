export const compiledMaps = [
  { id:"sample", name:"Sample Map", path:"/public/maps/sample.dzmap" },
];

export function getMap(id){
  return compiledMaps.find(m=>m.id===id) || null;
}
