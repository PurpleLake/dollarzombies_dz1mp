#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeDzmap } from "./dzmapWriter.js";
import { validateScene } from "../editor/io/dzsValidator.js";

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = {};
  for(let i=0;i<args.length;i++){
    const a = args[i];
    if(a === "--in") opts.in = args[++i];
    else if(a === "--out") opts.out = args[++i];
  }
  return opts;
}

function main(){
  const opts = parseArgs();
  if(!opts.in || !opts.out){
    console.error("Usage: node compileMap.js --in maps/foo.dzs --out public/maps/foo.dzmap");
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), opts.in);
  const outputPath = path.resolve(process.cwd(), opts.out);
  if(!fs.existsSync(inputPath)) throw new Error("Input file not found: "+inputPath);
  const scene = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const validation = validateScene(scene);
  if(!validation.ok){
    console.error("Validation failed:", validation.errors);
    process.exit(1);
  }
  const out = writeDzmap(scene, outputPath);
  console.log(`Compiled ${opts.in} -> ${opts.out}`);
  return out;
}

main();
