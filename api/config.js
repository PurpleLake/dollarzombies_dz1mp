export default function handler(req, res){
  const soloMenuOnly = String(process.env.DZ_SOLO_MENU_ONLY || "").toLowerCase();
  const enabled = soloMenuOnly === "1" || soloMenuOnly === "true" || soloMenuOnly === "yes";
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({ soloMenuOnly: enabled }));
}
