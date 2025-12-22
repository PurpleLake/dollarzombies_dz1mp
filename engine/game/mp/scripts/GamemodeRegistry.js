export const mpGamemodes = [
  {
    id: "TDM",
    code: "MP_TDM",
    name: "Team Deathmatch",
    desc: "Two teams. First to the score limit wins.",
  },
];

export function getMpGamemode(id){
  const match = mpGamemodes.find(m=>String(m.id).toUpperCase() === String(id || "").toUpperCase());
  return match || mpGamemodes[0];
}
