export async function loadDzsFile(file){
  const text = await file.text();
  return JSON.parse(text);
}

export function saveDzs(scene, filename="map.dzs"){
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 500);
}
