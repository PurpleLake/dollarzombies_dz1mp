import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

// Zombies world builder now reuses shared WorldBuilder utilities.
export class ZmWorld extends WorldBuilder {
  constructor({ engine, renderer }){
    super({ engine, renderer });
  }

  clear(){
    this.clearWorld();
  }

  addFloor(size=50){
    return super.addFloor({ size });
  }

  addBoundaryWalls(size=50, height=3){
    return super.addBoundaryWalls({ size, height });
  }

  addCrate(x=0, y=0.5, z=0){
    return super.addCrate({ x, y, z });
  }

  tick(){ /* later: broadphase, nav, etc */ }
}
