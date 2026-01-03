import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";
import { createMysteryBox } from "/engine/game/zm/maps/_shared/MysteryBox.js";

export const spawnPoints = {
  players: [
    { x: -8, y: 1.7, z: 18 },
    { x: -4, y: 1.7, z: 18 },
    { x: -8, y: 1.7, z: 14 },
    { x: -4, y: 1.7, z: 14 },
  ],
  zombies: [
    { x: 30, y: 1.2, z: 0 },
    { x: -30, y: 1.2, z: 0 },
    { x: 0, y: 1.2, z: 30 },
    { x: 0, y: 1.2, z: -30 },
    { x: 22, y: 1.2, z: 22 },
    { x: -22, y: 1.2, z: -22 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 90, color: 0x0c1018 });
  world.addBoundaryWalls({ size: 90, height: 3.6, thickness: 0.6, color: 0x1b2331 });

  // Main hall + power room blocks (Der Riese-inspired)
  world.addWallBox({ width: 30, height: 2.8, depth: 0.8, x: 0, y: 1.4, z: 6, color: 0x2b3446 });
  world.addWallBox({ width: 30, height: 2.8, depth: 0.8, x: 0, y: 1.4, z: -14, color: 0x2b3446 });
  world.addWallBox({ width: 0.8, height: 2.8, depth: 20, x: -15, y: 1.4, z: -4, color: 0x2b3446 });
  world.addWallBox({ width: 0.8, height: 2.8, depth: 20, x: 15, y: 1.4, z: -4, color: 0x2b3446 });

  // Power room block
  world.addWallBox({ width: 14, height: 2.6, depth: 0.8, x: 20, y: 1.3, z: 18, color: 0x2f3b52 });
  world.addWallBox({ width: 0.8, height: 2.6, depth: 10, x: 26, y: 1.3, z: 18, color: 0x2f3b52 });
  world.addWallBox({ width: 0.8, height: 2.6, depth: 10, x: 14, y: 1.3, z: 18, color: 0x2f3b52 });

  // Cover and machinery
  world.addCrate({ x: -6, y: 0.6, z: 4, size: 1.2, color: 0x584a34 });
  world.addCrate({ x: 6, y: 0.6, z: -2, size: 1.2, color: 0x584a34 });
  world.addCrate({ x: 0, y: 0.6, z: -10, size: 1.2, color: 0x584a34 });

  // Lighting
  world.addLight({ type: "ambient", color: 0x4b5874, intensity: 0.4 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.9, position: { x: 12, y: 16, z: 4 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.6, position: { x: 0, y: 4, z: 0 } });
  world.addLight({ type: "point", color: 0xffbfa0, intensity: 0.5, position: { x: 20, y: 4, z: 18 } });

  createMysteryBox({ engine, position: { x: -12, y: 0.6, z: -8 }, cost: 950 });
  createMysteryBox({ engine, position: { x: 20, y: 0.6, z: 14 }, cost: 950 });

  return spawnPoints;
}
