import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -22, y: 1.7, z: -18 },
    { x: -18, y: 1.7, z: -22 },
    { x: -26, y: 1.7, z: -14 },
    { x: -16, y: 1.7, z: -12 },
    { x: -24, y: 1.7, z: -8 },
    { x: -20, y: 1.7, z: -6 },
  ],
  teamB: [
    { x: 22, y: 1.7, z: 18 },
    { x: 18, y: 1.7, z: 22 },
    { x: 26, y: 1.7, z: 14 },
    { x: 16, y: 1.7, z: 12 },
    { x: 24, y: 1.7, z: 8 },
    { x: 20, y: 1.7, z: 6 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 60, color: 0x0b0f18 });
  world.addBoundaryWalls({ size: 60, height: 3.2, thickness: 0.6, color: 0x212b3c });

  // Central lane cover
  world.addWallBox({ width: 14, height: 2.6, depth: 2.2, x: 0, y: 1.3, z: 0, color: 0x2b374c });
  world.addWallBox({ width: 6, height: 2.2, depth: 1.6, x: -10, y: 1.1, z: 10, color: 0x2f3d54 });
  world.addWallBox({ width: 6, height: 2.2, depth: 1.6, x: 10, y: 1.1, z: -10, color: 0x2f3d54 });

  // Corner stacks
  world.addCylinder({ rTop: 1.2, rBottom: 1.2, height: 2.4, x: -18, y: 1.2, z: 18, color: 0x3a465b });
  world.addCylinder({ rTop: 1.2, rBottom: 1.2, height: 2.4, x: 18, y: 1.2, z: -18, color: 0x3a465b });
  world.addCrate({ x: -8, y: 0.7, z: -16, size: 1.4, color: 0x6a5137 });
  world.addCrate({ x: 8, y: 0.7, z: 16, size: 1.4, color: 0x6a5137 });

  world.addLight({ type: "ambient", color: 0x5b6c88, intensity: 0.32 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: -6, y: 15, z: 8 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffb450, intensity: 0.85, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
