import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -24, y: 1.7, z: -8 },
    { x: -24, y: 1.7, z: 0 },
    { x: -24, y: 1.7, z: 8 },
    { x: -20, y: 1.7, z: -6 },
    { x: -20, y: 1.7, z: 6 },
    { x: -18, y: 1.7, z: 0 },
  ],
  teamB: [
    { x: 24, y: 1.7, z: 8 },
    { x: 24, y: 1.7, z: 0 },
    { x: 24, y: 1.7, z: -8 },
    { x: 20, y: 1.7, z: 6 },
    { x: 20, y: 1.7, z: -6 },
    { x: 18, y: 1.7, z: 0 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 64, color: 0x0c1119 });
  world.addBoundaryWalls({ size: 64, height: 3.2, thickness: 0.6, color: 0x232b3c });

  // Central pool + well
  world.addCylinder({ rTop: 3.2, rBottom: 3.2, height: 0.6, x: 0, y: 0.3, z: 0, color: 0x2a5b6e });
  world.addCylinder({ rTop: 1.2, rBottom: 1.2, height: 1.2, x: 0, y: 0.6, z: -6, color: 0x4a4a4a });

  // Cross lanes
  world.addWallBox({ width: 10, height: 2.6, depth: 0.6, x: 0, y: 1.3, z: 10, color: 0x3f4856 });
  world.addWallBox({ width: 10, height: 2.6, depth: 0.6, x: 0, y: 1.3, z: -10, color: 0x3f4856 });
  world.addWallBox({ width: 0.6, height: 2.6, depth: 10, x: 10, y: 1.3, z: 0, color: 0x3f4856 });
  world.addWallBox({ width: 0.6, height: 2.6, depth: 10, x: -10, y: 1.3, z: 0, color: 0x3f4856 });

  // Fences for flank paths
  world.addWallBox({ width: 14, height: 1.2, depth: 0.2, x: 0, y: 0.6, z: 18, color: 0x384353 });
  world.addWallBox({ width: 14, height: 1.2, depth: 0.2, x: 0, y: 0.6, z: -18, color: 0x384353 });
  world.addWallBox({ width: 0.2, height: 1.2, depth: 14, x: 18, y: 0.6, z: 0, color: 0x384353 });
  world.addWallBox({ width: 0.2, height: 1.2, depth: 14, x: -18, y: 0.6, z: 0, color: 0x384353 });

  world.addCrate({ x: -6, y: 0.6, z: 6, size: 1.2, color: 0x5b4a32 });
  world.addCrate({ x: 6, y: 0.6, z: -6, size: 1.2, color: 0x5b4a32 });

  world.addLight({ type: "ambient", color: 0x4f5d77, intensity: 0.35 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: 8, y: 14, z: -6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.7, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
