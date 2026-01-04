import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -24, y: 1.7, z: -14 },
    { x: -24, y: 1.7, z: -6 },
    { x: -24, y: 1.7, z: 6 },
    { x: -20, y: 1.7, z: -10 },
    { x: -20, y: 1.7, z: 10 },
    { x: -18, y: 1.7, z: 0 },
  ],
  teamB: [
    { x: 24, y: 1.7, z: 14 },
    { x: 24, y: 1.7, z: 6 },
    { x: 24, y: 1.7, z: -6 },
    { x: 20, y: 1.7, z: 10 },
    { x: 20, y: 1.7, z: -10 },
    { x: 18, y: 1.7, z: 0 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 70, color: 0x0c1119 });
  world.addBoundaryWalls({ size: 70, height: 3.4, thickness: 0.6, color: 0x222a3a });

  // Ridge ramps (stepped)
  world.addWallBox({ width: 10, height: 0.6, depth: 6, x: -6, y: 0.3, z: 0, color: 0x5a4f3b });
  world.addWallBox({ width: 10, height: 1.2, depth: 6, x: 0, y: 0.6, z: 0, color: 0x5a4f3b });
  world.addWallBox({ width: 10, height: 1.8, depth: 6, x: 6, y: 0.9, z: 0, color: 0x5a4f3b });

  // Arch frames (blockouts)
  world.addWallBox({ width: 4, height: 3, depth: 0.6, x: -10, y: 1.5, z: -8, color: 0x525a66 });
  world.addWallBox({ width: 4, height: 3, depth: 0.6, x: 10, y: 1.5, z: 8, color: 0x525a66 });

  // Fence lines
  world.addWallBox({ width: 12, height: 1.2, depth: 0.2, x: 0, y: 0.6, z: -18, color: 0x384353 });
  world.addWallBox({ width: 12, height: 1.2, depth: 0.2, x: 0, y: 0.6, z: 18, color: 0x384353 });

  // Cover
  world.addCrate({ x: -8, y: 0.6, z: 10, size: 1.1, color: 0x5b4a32 });
  world.addCrate({ x: 8, y: 0.6, z: -10, size: 1.1, color: 0x5b4a32 });

  world.addLight({ type: "ambient", color: 0x4f5d77, intensity: 0.35 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: 8, y: 14, z: -6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.6, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
