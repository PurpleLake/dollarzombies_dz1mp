import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";
import { createMysteryBox } from "/engine/game/zm/maps/_shared/MysteryBox.js";

export const spawnPoints = {
  players: [
    { x: 0, y: 1.7, z: 0 },
    { x: -3, y: 1.7, z: 2 },
    { x: 3, y: 1.7, z: -2 },
    { x: -3, y: 1.7, z: -2 },
  ],
  zombies: [
    { x: -30, y: 1.2, z: -30 },
    { x: 30, y: 1.2, z: -30 },
    { x: -30, y: 1.2, z: 30 },
    { x: 30, y: 1.2, z: 30 },
    { x: 0, y: 1.2, z: 34 },
    { x: 0, y: 1.2, z: -34 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 80, color: 0x0c1510 });
  world.addBoundaryWalls({ size: 80, height: 3.2, thickness: 0.6, color: 0x1a2a22 });

  // Central hut
  world.addWallBox({ width: 10, height: 2.6, depth: 0.8, x: 0, y: 1.3, z: 6, color: 0x324033 });
  world.addWallBox({ width: 10, height: 2.6, depth: 0.8, x: 0, y: 1.3, z: -6, color: 0x324033 });
  world.addWallBox({ width: 0.8, height: 2.6, depth: 12, x: -5.2, y: 1.3, z: 0, color: 0x324033 });
  world.addWallBox({ width: 0.8, height: 2.6, depth: 12, x: 5.2, y: 1.3, z: 0, color: 0x324033 });

  // Four outer huts (rough Shi No Numa layout)
  const hut = (x, z)=>{
    world.addWallBox({ width: 8, height: 2.4, depth: 0.8, x, y: 1.2, z: z + 4, color: 0x364638 });
    world.addWallBox({ width: 8, height: 2.4, depth: 0.8, x, y: 1.2, z: z - 4, color: 0x364638 });
    world.addWallBox({ width: 0.8, height: 2.4, depth: 8, x: x - 4, y: 1.2, z, color: 0x364638 });
    world.addWallBox({ width: 0.8, height: 2.4, depth: 8, x: x + 4, y: 1.2, z, color: 0x364638 });
  };
  hut(-24, -24);
  hut(24, -24);
  hut(-24, 24);
  hut(24, 24);

  // Cover
  world.addCrate({ x: -6, y: 0.6, z: 0, size: 1.1, color: 0x5a4a2d });
  world.addCrate({ x: 6, y: 0.6, z: 0, size: 1.1, color: 0x5a4a2d });

  // Lighting
  world.addLight({ type: "ambient", color: 0x405c4a, intensity: 0.45 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.85, position: { x: -8, y: 14, z: 8 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.6, position: { x: 0, y: 3.2, z: 0 } });

  createMysteryBox({ engine, position: { x: -24, y: 0.6, z: 24 }, cost: 950 });

  return spawnPoints;
}
