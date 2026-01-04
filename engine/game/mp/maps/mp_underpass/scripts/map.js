import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -24, y: 1.7, z: -16 },
    { x: -20, y: 1.7, z: -20 },
    { x: -26, y: 1.7, z: -10 },
    { x: -18, y: 1.7, z: -12 },
    { x: -22, y: 1.7, z: -6 },
    { x: -16, y: 1.7, z: -8 },
  ],
  teamB: [
    { x: 24, y: 1.7, z: 16 },
    { x: 20, y: 1.7, z: 20 },
    { x: 26, y: 1.7, z: 10 },
    { x: 18, y: 1.7, z: 12 },
    { x: 22, y: 1.7, z: 6 },
    { x: 16, y: 1.7, z: 8 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 62, color: 0x0a0f1a });
  world.addBoundaryWalls({ size: 62, height: 3.2, thickness: 0.6, color: 0x212a3c });

  // Twin lane dividers
  world.addWallBox({ width: 24, height: 2.4, depth: 1.8, x: 0, y: 1.2, z: -8, color: 0x2a354a });
  world.addWallBox({ width: 24, height: 2.4, depth: 1.8, x: 0, y: 1.2, z: 8, color: 0x2a354a });

  // Mid underpass blocks
  world.addWallBox({ width: 6, height: 2.2, depth: 6, x: -10, y: 1.1, z: 0, color: 0x2e3a50 });
  world.addWallBox({ width: 6, height: 2.2, depth: 6, x: 10, y: 1.1, z: 0, color: 0x2e3a50 });

  // Side cover
  world.addCrate({ x: -14, y: 0.7, z: 18, size: 1.4, color: 0x6a5137 });
  world.addCrate({ x: 14, y: 0.7, z: -18, size: 1.4, color: 0x6a5137 });
  world.addWallBox({ width: 4, height: 2.0, depth: 5, x: -18, y: 1.0, z: 6, color: 0x2f3d54 });
  world.addWallBox({ width: 4, height: 2.0, depth: 5, x: 18, y: 1.0, z: -6, color: 0x2f3d54 });

  world.addLight({ type: "ambient", color: 0x566781, intensity: 0.32 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: -6, y: 15, z: -6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffb450, intensity: 0.8, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
