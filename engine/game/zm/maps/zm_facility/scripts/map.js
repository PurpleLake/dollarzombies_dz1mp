import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  players: [
    { x: -4, y: 1.7, z: 6 },
    { x: 4, y: 1.7, z: 6 },
    { x: -4, y: 1.7, z: -6 },
    { x: 4, y: 1.7, z: -6 },
  ],
  zombies: [
    { x: -16, y: 1.2, z: 0 },
    { x: 16, y: 1.2, z: 0 },
    { x: 0, y: 1.2, z: -16 },
    { x: 0, y: 1.2, z: 16 },
    { x: -12, y: 1.2, z: -12 },
    { x: 12, y: 1.2, z: 12 },
    { x: -12, y: 1.2, z: 12 },
    { x: 12, y: 1.2, z: -12 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 48, color: 0x0c121c });
  world.addBoundaryWalls({ size: 48, height: 3.4, thickness: 0.6, color: 0x1d2738 });

  // Interior cover/walls
  world.addWallBox({ width: 6, height: 2.6, depth: 1.2, x: 0, y: 1.3, z: 0, color: 0x2b354a });
  world.addWallBox({ width: 10, height: 2.4, depth: 1.2, x: -10, y: 1.2, z: 8, color: 0x2f3b52 });
  world.addWallBox({ width: 10, height: 2.4, depth: 1.2, x: 10, y: 1.2, z: -8, color: 0x2f3b52 });
  world.addCrate({ x: -6, y: 0.6, z: -4, size: 1.2, color: 0x5f4f3a });
  world.addCrate({ x: 6, y: 0.6, z: 4, size: 1.2, color: 0x5f4f3a });

  // Lighting
  world.addLight({ type: "ambient", color: 0x4d698f, intensity: 0.35 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: 10, y: 12, z: 6 }, castShadow: true });
  world.addLight({ type: "point", color: 0x88aaff, intensity: 0.8, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
