import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";
import { createMysteryBox } from "/engine/game/zm/maps/_shared/MysteryBox.js";

export const spawnPoints = {
  players: [
    { x: -3, y: 1.7, z: 10 },
    { x: 3, y: 1.7, z: 10 },
    { x: -3, y: 1.7, z: 6 },
    { x: 3, y: 1.7, z: 6 },
  ],
  zombies: [
    { x: -14, y: 1.2, z: -14 },
    { x: 14, y: 1.2, z: -14 },
    { x: -14, y: 1.2, z: 14 },
    { x: 14, y: 1.2, z: 14 },
    { x: 0, y: 1.2, z: -16 },
    { x: 0, y: 1.2, z: 16 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 36, color: 0x0b111a });
  world.addBoundaryWalls({ size: 36, height: 3.2, thickness: 0.6, color: 0x1d2738 });

  // Bunker shell (rough Nacht-inspired blockout)
  world.addWallBox({ width: 14, height: 2.6, depth: 0.8, x: 0, y: 1.3, z: 6, color: 0x2a3446 });
  world.addWallBox({ width: 14, height: 2.6, depth: 0.8, x: 0, y: 1.3, z: -4, color: 0x2a3446 });
  world.addWallBox({ width: 0.8, height: 2.6, depth: 10, x: -6.6, y: 1.3, z: 1, color: 0x2a3446 });
  world.addWallBox({ width: 0.8, height: 2.6, depth: 10, x: 6.6, y: 1.3, z: 1, color: 0x2a3446 });

  // Interior divider + cover
  world.addWallBox({ width: 6, height: 2.2, depth: 0.8, x: 0, y: 1.1, z: 1, color: 0x303c52 });
  world.addCrate({ x: -2.5, y: 0.6, z: 3, size: 1.1, color: 0x5f4f3a });
  world.addCrate({ x: 2.5, y: 0.6, z: -1, size: 1.1, color: 0x5f4f3a });

  // Lighting
  world.addLight({ type: "ambient", color: 0x4b5e79, intensity: 0.45 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: 8, y: 12, z: 4 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.7, position: { x: 0, y: 3, z: 4 } });

  createMysteryBox({ engine, position: { x: 4, y: 0.6, z: -3 }, cost: 950 });

  return spawnPoints;
}
