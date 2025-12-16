export class MapLoader {
  constructor(engine){
    this.engine = engine;
  }

  async load({ mode, map }){
    const root = `/public/maps/${mode}/${map}`;
    const manifestUrl = `${root}/manifest.json`;
    const res = await fetch(manifestUrl);
    if(!res.ok) throw new Error(`Failed to load map manifest: ${manifestUrl}`);
    const manifest = await res.json();

    const scriptPath = manifest.script;
    const mod = await import(`${root}/${scriptPath}`);
    const build = mod.buildMap;
    if(typeof build !== "function") throw new Error(`Map script missing buildMap(): ${root}/${scriptPath}`);

    // Reset map ctx
    this.engine.ctx.map = {
      mode, map,
      root,
      playerSpawns: [],
      zombieSpawns: [],
      mpSpawnsTeam0: [],
      mpSpawnsTeam1: [],
      points: {},
    };

    await build(this.engine, this.engine.ctx.map, manifest);

    this.engine.events.emit(`${mode}:mapLoaded`, { map });
    return this.engine.ctx.map;
  }
}
