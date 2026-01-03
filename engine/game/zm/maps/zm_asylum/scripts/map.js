import { WorldBuilder } from "/engine/core/scripts/world/WorldBuilder.js";
import { createMysteryBox } from "/engine/game/zm/maps/_shared/MysteryBox.js";

export const spawnPoints = {
  players: [
    { x: -20, y: 1.7, z: 6 },
    { x: -20, y: 1.7, z: -6 },
    { x: -16, y: 1.7, z: 6 },
    { x: -16, y: 1.7, z: -6 },
  ],
  zombies: [
    { x: 26, y: 1.2, z: 14 },
    { x: 26, y: 1.2, z: -14 },
    { x: 0, y: 1.2, z: 16 },
    { x: 0, y: 1.2, z: -16 },
    { x: -26, y: 1.2, z: 14 },
    { x: -26, y: 1.2, z: -14 },
  ],
};

export async function buildMap(engine, builder=null){
  const r = engine.ctx.renderer;
  const world = builder || engine.ctx.world || engine.ctx.worldBuilder || new WorldBuilder({ engine, renderer: r });
  world.clearWorld?.();

  world.addFloor({ size: 70, color: 0x0c121a });
  world.addBoundaryWalls({ size: 70, height: 3.4, thickness: 0.6, color: 0x1b2433 });

  // Long central hall and side wings (Verruckt-inspired flow)
  world.addWallBox({ width: 54, height: 2.8, depth: 0.8, x: 0, y: 1.4, z: 0, color: 0x2a3445 });
  world.addWallBox({ width: 0.8, height: 2.8, depth: 18, x: -8, y: 1.4, z: -16, color: 0x2a3445 });
  world.addWallBox({ width: 0.8, height: 2.8, depth: 18, x: -8, y: 1.4, z: 16, color: 0x2a3445 });
  world.addWallBox({ width: 0.8, height: 2.8, depth: 18, x: 8, y: 1.4, z: -16, color: 0x2a3445 });
  world.addWallBox({ width: 0.8, height: 2.8, depth: 18, x: 8, y: 1.4, z: 16, color: 0x2a3445 });

  // Courtyard blockers and cover
  world.addWallBox({ width: 6, height: 2.0, depth: 2.4, x: 0, y: 1.0, z: -8, color: 0x334058 });
  world.addWallBox({ width: 6, height: 2.0, depth: 2.4, x: 0, y: 1.0, z: 8, color: 0x334058 });
  world.addCrate({ x: 6, y: 0.6, z: -6, size: 1.1, color: 0x5b4a32 });
  world.addCrate({ x: 6, y: 0.6, z: 6, size: 1.1, color: 0x5b4a32 });
  world.addCrate({ x: -6, y: 0.6, z: -6, size: 1.1, color: 0x5b4a32 });
  world.addCrate({ x: -6, y: 0.6, z: 6, size: 1.1, color: 0x5b4a32 });

  // Lighting
  world.addLight({ type: "ambient", color: 0x4a5a74, intensity: 0.4 });
  world.addLight({ type: "directional", color: 0xffffff, intensity: 0.85, position: { x: 10, y: 14, z: 0 }, castShadow: true });
  world.addLight({ type: "point", color: 0xffd199, intensity: 0.6, position: { x: 0, y: 3, z: 0 } });

  createMysteryBox({ engine, position: { x: 18, y: 0.6, z: -10 }, cost: 950 });

  return spawnPoints;
}
