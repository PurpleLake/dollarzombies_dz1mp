import { readDzmap } from "../compiler/dzmapReader.js";

export async function loadDzmap(url, handlers={}){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Failed to load ${url}`);
  const data = await res.json();
  if(data.v !== 1) throw new Error("Unsupported dzmap version");
  if(handlers.onLoaded){ handlers.onLoaded(data); }
  return data;
}

export async function loadMap(path){
  return loadDzmap(path);
}
