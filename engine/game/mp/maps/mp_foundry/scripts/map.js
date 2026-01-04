import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -20, y: 1.7, z: -20 },
    { x: -16, y: 1.7, z: -24 },
    { x: -24, y: 1.7, z: -16 },
    { x: -12, y: 1.7, z: -18 },
    { x: -18, y: 1.7, z: -10 },
    { x: -26, y: 1.7, z: -12 },
  ],
  teamB: [
    { x: 20, y: 1.7, z: 20 },
    { x: 16, y: 1.7, z: 24 },
    { x: 24, y: 1.7, z: 16 },
    { x: 12, y: 1.7, z: 18 },
    { x: 18, y: 1.7, z: 10 },
    { x: 26, y: 1.7, z: 12 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 58, color: 0x0b101c });
  world.addBoundaryWalls({ size: 58, height: 3.2, thickness: 0.6, color: 0x232c3f });

  // Cross-shaped mid structure
  world.addWallBox({ width: 16, height: 2.6, depth: 2.2, x: 0, y: 1.3, z: 0, color: 0x2b364c });
  world.addWallBox({ width: 2.2, height: 2.6, depth: 16, x: 0, y: 1.3, z: 0, color: 0x2b364c });

  // Outer cover
  world.addWallBox({ width: 6, height: 2.2, depth: 1.6, x: -12, y: 1.1, z: 12, color: 0x2f3d54 });
  world.addWallBox({ width: 6, height: 2.2, depth: 1.6, x: 12, y: 1.1, z: -12, color: 0x2f3d54 });
  world.addWallBox({ width: 4, height: 2.0, depth: 6, x: -16, y: 1.0, z: -4, color: 0x2e3a50 });
  world.addWallBox({ width: 4, height: 2.0, depth: 6, x: 16, y: 1.0, z: 4, color: 0x2e3a50 });

  // Props
  world.addCylinder({ rTop: 1.4, rBottom: 1.4, height: 2.6, x: -6, y: 1.3, z: -10, color: 0x3a455b });
  world.addCylinder({ rTop: 1.4, rBottom: 1.4, height: 2.6, x: 6, y: 1.3, z: 10, color: 0x3a455b });
  world.addCrate({ x: -8, y: 0.7, z: 16, size: 1.4, color: 0x6a5137 });
  world.addCrate({ x: 8, y: 0.7, z: -16, size: 1.4, color: 0x6a5137 });

  world.addLight({ type: "ambient", color: 0x51607e, intensity: 0.32 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: 8, y: 15, z: -6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffb450, intensity: 0.8, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
