import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  players: [
    { x: -6, y: 1.7, z: 4 },
    { x: 6, y: 1.7, z: 4 },
    { x: -6, y: 1.7, z: -4 },
    { x: 6, y: 1.7, z: -4 },
  ],
  zombies: [
    { x: -18, y: 1.2, z: 0 },
    { x: 18, y: 1.2, z: 0 },
    { x: 0, y: 1.2, z: -18 },
    { x: 0, y: 1.2, z: 18 },
    { x: -14, y: 1.2, z: -12 },
    { x: 14, y: 1.2, z: 12 },
    { x: -12, y: 1.2, z: 14 },
    { x: 12, y: 1.2, z: -14 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 52, color: 0x0a1018 });
  world.addBoundaryWalls({ size: 52, height: 3.4, thickness: 0.6, color: 0x1b2330 });

  // Center stack
  world.addWallBox({ width: 6, height: 2.8, depth: 6, x: 0, y: 1.4, z: 0, color: 0x2a3446 });
  world.addWallBox({ width: 3, height: 2.0, depth: 12, x: -10, y: 1.0, z: 0, color: 0x283145 });
  world.addWallBox({ width: 3, height: 2.0, depth: 12, x: 10, y: 1.0, z: 0, color: 0x283145 });
  world.addCrate({ x: -6, y: 0.6, z: 10, size: 1.3, color: 0x5d4a34 });
  world.addCrate({ x: 6, y: 0.6, z: -10, size: 1.3, color: 0x5d4a34 });

  world.addLight({ type: "ambient", color: 0x3b516f, intensity: 0.35 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: -8, y: 12, z: 8 }, castShadow: true });
  world.addLight({ type: "point", color: 0x88aaff, intensity: 0.8, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
