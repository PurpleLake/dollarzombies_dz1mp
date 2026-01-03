import fs from "fs";

export function readDzmap(file){
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if(data.v !== 1) throw new Error("Unsupported dzmap version");
  return data;
}
