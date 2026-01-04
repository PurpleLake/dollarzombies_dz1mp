import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -26, y: 1.7, z: -6 },
    { x: -26, y: 1.7, z: 6 },
    { x: -22, y: 1.7, z: -10 },
    { x: -22, y: 1.7, z: 10 },
    { x: -18, y: 1.7, z: 0 },
    { x: -20, y: 1.7, z: 0 },
  ],
  teamB: [
    { x: 26, y: 1.7, z: 6 },
    { x: 26, y: 1.7, z: -6 },
    { x: 22, y: 1.7, z: 10 },
    { x: 22, y: 1.7, z: -10 },
    { x: 18, y: 1.7, z: 0 },
    { x: 20, y: 1.7, z: 0 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 68, color: 0x0c1119 });
  world.addBoundaryWalls({ size: 68, height: 3.2, thickness: 0.6, color: 0x222a3a });

  // House blocks (simple village)
  world.addWallBox({ width: 8, height: 3.2, depth: 6, x: -12, y: 1.6, z: -12, color: 0x4a3d2c });
  world.addWallBox({ width: 8, height: 3.2, depth: 6, x: -12, y: 1.6, z: 12, color: 0x4a3d2c });
  world.addWallBox({ width: 8, height: 3.2, depth: 6, x: 12, y: 1.6, z: -12, color: 0x4a3d2c });
  world.addWallBox({ width: 8, height: 3.2, depth: 6, x: 12, y: 1.6, z: 12, color: 0x4a3d2c });

  // Mid walls and fences
  world.addWallBox({ width: 12, height: 2.6, depth: 0.6, x: 0, y: 1.3, z: -6, color: 0x3f4856 });
  world.addWallBox({ width: 12, height: 2.6, depth: 0.6, x: 0, y: 1.3, z: 6, color: 0x3f4856 });
  world.addWallBox({ width: 0.2, height: 1.2, depth: 12, x: -6, y: 0.6, z: 0, color: 0x384353 });
  world.addWallBox({ width: 0.2, height: 1.2, depth: 12, x: 6, y: 0.6, z: 0, color: 0x384353 });

  // Well in center
  world.addCylinder({ rTop: 1.2, rBottom: 1.2, height: 1.2, x: 0, y: 0.6, z: 0, color: 0x4a4a4a });

  world.addCrate({ x: -4, y: 0.6, z: 8, size: 1.1, color: 0x5b4a32 });
  world.addCrate({ x: 4, y: 0.6, z: -8, size: 1.1, color: 0x5b4a32 });

  world.addLight({ type: "ambient", color: 0x4f5d77, intensity: 0.35 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: -8, y: 14, z: 6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.6, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
