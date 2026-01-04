import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -28, y: 1.7, z: -12 },
    { x: -28, y: 1.7, z: 0 },
    { x: -28, y: 1.7, z: 12 },
    { x: -24, y: 1.7, z: -8 },
    { x: -24, y: 1.7, z: 8 },
    { x: -20, y: 1.7, z: 0 },
  ],
  teamB: [
    { x: 28, y: 1.7, z: 12 },
    { x: 28, y: 1.7, z: 0 },
    { x: 28, y: 1.7, z: -12 },
    { x: 24, y: 1.7, z: 8 },
    { x: 24, y: 1.7, z: -8 },
    { x: 20, y: 1.7, z: 0 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 72, color: 0x0c1218 });
  world.addBoundaryWalls({ size: 72, height: 3.2, thickness: 0.6, color: 0x222a3a });

  // Central tunnel lane (boxy segments)
  world.addWallBox({ width: 18, height: 3, depth: 3, x: 0, y: 1.5, z: 0, color: 0x2e3440 });
  world.addWallBox({ width: 18, height: 3, depth: 3, x: 0, y: 1.5, z: 10, color: 0x2e3440 });
  world.addWallBox({ width: 18, height: 3, depth: 3, x: 0, y: 1.5, z: -10, color: 0x2e3440 });

  // Side tunnel walls
  world.addWallBox({ width: 12, height: 3, depth: 3, x: -18, y: 1.5, z: -6, color: 0x2e3440 });
  world.addWallBox({ width: 12, height: 3, depth: 3, x: -18, y: 1.5, z: 6, color: 0x2e3440 });
  world.addWallBox({ width: 12, height: 3, depth: 3, x: 18, y: 1.5, z: -6, color: 0x2e3440 });
  world.addWallBox({ width: 12, height: 3, depth: 3, x: 18, y: 1.5, z: 6, color: 0x2e3440 });

  // Cover boxes
  world.addWallBox({ width: 6, height: 1.2, depth: 2.4, x: -8, y: 0.6, z: -16, color: 0x3f4856 });
  world.addWallBox({ width: 6, height: 1.2, depth: 2.4, x: 8, y: 0.6, z: 16, color: 0x3f4856 });
  world.addCrate({ x: -6, y: 0.6, z: 16, size: 1.1, color: 0x5a4a32 });
  world.addCrate({ x: 6, y: 0.6, z: -16, size: 1.1, color: 0x5a4a32 });

  world.addLight({ type: "ambient", color: 0x4e5b75, intensity: 0.35 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: 10, y: 14, z: 0 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.6, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
