import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -18, y: 1.7, z: -14 },
    { x: -14, y: 1.7, z: -18 },
    { x: -20, y: 1.7, z: -10 },
    { x: -16, y: 1.7, z: -6 },
    { x: -10, y: 1.7, z: -16 },
    { x: -22, y: 1.7, z: -14 },
  ],
  teamB: [
    { x: 18, y: 1.7, z: 14 },
    { x: 14, y: 1.7, z: 18 },
    { x: 20, y: 1.7, z: 10 },
    { x: 16, y: 1.7, z: 6 },
    { x: 10, y: 1.7, z: 16 },
    { x: 22, y: 1.7, z: 14 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 54, color: 0x0c101a });
  world.addBoundaryWalls({ size: 54, height: 3.2, thickness: 0.6, color: 0x222c3c });

  // Cover blocks
  world.addWallBox({ width: 8, height: 2.4, depth: 1.4, x: 0, y: 1.2, z: 0, color: 0x2e3b54 });
  world.addWallBox({ width: 4, height: 2.0, depth: 2.4, x: -10, y: 1.0, z: 10, color: 0x31405c });
  world.addWallBox({ width: 4, height: 2.0, depth: 2.4, x: 10, y: 1.0, z: -10, color: 0x31405c });
  world.addWallBox({ width: 6, height: 2.4, depth: 1.2, x: -14, y: 1.2, z: -6, color: 0x2c3a50 });
  world.addWallBox({ width: 6, height: 2.4, depth: 1.2, x: 14, y: 1.2, z: 6, color: 0x2c3a50 });

  // Lighting
  world.addLight({ type: "ambient", color: 0x5e6f8f, intensity: 0.32 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: -8, y: 14, z: 6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffb450, intensity: 0.8, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
