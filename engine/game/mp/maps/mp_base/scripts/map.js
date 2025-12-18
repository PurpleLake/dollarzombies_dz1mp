import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -16, y: 1.7, z: -18 },
    { x: -20, y: 1.7, z: -14 },
    { x: -12, y: 1.7, z: -12 },
    { x: -18, y: 1.7, z: -8 },
  ],
  teamB: [
    { x: 16, y: 1.7, z: 18 },
    { x: 20, y: 1.7, z: 14 },
    { x: 12, y: 1.7, z: 12 },
    { x: 18, y: 1.7, z: 8 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 64, color: 0x0c111a });
  world.addBoundaryWalls({ size: 64, height: 3.4, thickness: 0.6, color: 0x202a3a });

  world.addWallBox({ width: 10, height: 2.8, depth: 1.6, x: 0, y: 1.4, z: 0, color: 0x2c3a50 });
  world.addWallBox({ width: 6, height: 2.2, depth: 2.4, x: -12, y: 1.1, z: 10, color: 0x33435e });
  world.addWallBox({ width: 6, height: 2.2, depth: 2.4, x: 12, y: 1.1, z: -10, color: 0x33435e });
  world.addWallBox({ width: 8, height: 2.6, depth: 1.4, x: -20, y: 1.3, z: 0, color: 0x2f3e55 });
  world.addWallBox({ width: 8, height: 2.6, depth: 1.4, x: 20, y: 1.3, z: 0, color: 0x2f3e55 });

  world.addLight({ type: "ambient", color: 0x5a6b88, intensity: 0.32 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: -10, y: 16, z: 8 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffb450, intensity: 0.85, position: { x: 0, y: 3.2, z: 0 } });

  return spawnPoints;
}
