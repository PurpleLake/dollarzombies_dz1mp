import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";

export const spawnPoints = {
  teamA: [
    { x: -20, y: 1.7, z: -12 },
    { x: -16, y: 1.7, z: -18 },
    { x: -22, y: 1.7, z: -8 },
    { x: -12, y: 1.7, z: -16 },
    { x: -18, y: 1.7, z: -4 },
    { x: -24, y: 1.7, z: -12 },
  ],
  teamB: [
    { x: 20, y: 1.7, z: 12 },
    { x: 16, y: 1.7, z: 18 },
    { x: 22, y: 1.7, z: 8 },
    { x: 12, y: 1.7, z: 16 },
    { x: 18, y: 1.7, z: 4 },
    { x: 24, y: 1.7, z: 12 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 56, color: 0x0c111c });
  world.addBoundaryWalls({ size: 56, height: 3.2, thickness: 0.6, color: 0x232b3c });

  // Mid cover lanes
  world.addWallBox({ width: 8, height: 2.4, depth: 1.4, x: 0, y: 1.2, z: 8, color: 0x2b364a });
  world.addWallBox({ width: 8, height: 2.4, depth: 1.4, x: 0, y: 1.2, z: -8, color: 0x2b364a });
  world.addWallBox({ width: 4, height: 2.2, depth: 6, x: -12, y: 1.1, z: 4, color: 0x2f3d54 });
  world.addWallBox({ width: 4, height: 2.2, depth: 6, x: 12, y: 1.1, z: -4, color: 0x2f3d54 });
  world.addCrate({ x: -6, y: 0.6, z: -12, size: 1.3, color: 0x5d4a34 });
  world.addCrate({ x: 6, y: 0.6, z: 12, size: 1.3, color: 0x5d4a34 });

  world.addLight({ type: "ambient", color: 0x51607e, intensity: 0.32 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.95, position: { x: 6, y: 14, z: -6 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffb450, intensity: 0.8, position: { x: 0, y: 3, z: 0 } });

  return spawnPoints;
}
