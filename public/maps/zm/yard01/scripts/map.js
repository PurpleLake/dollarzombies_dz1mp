import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export async function buildMap(engine, mapCtx, manifest){
  const r = engine.ctx.renderer;
  const scene = r.scene;

  // lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x221b1b, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 1.15);
  dir.position.set(-10, 14, 8);
  scene.add(dir);

  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(55, 55),
    new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  // boundary
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2f25, roughness: 0.9 });
  const wallGeo = new THREE.BoxGeometry(55, 4, 1.4);
  const w1 = new THREE.Mesh(wallGeo, wallMat); w1.position.set(0,2,-27.5); scene.add(w1);
  const w2 = new THREE.Mesh(wallGeo, wallMat); w2.position.set(0,2, 27.5); scene.add(w2);
  const wallGeo2 = new THREE.BoxGeometry(1.4, 4, 55);
  const w3 = new THREE.Mesh(wallGeo2, wallMat); w3.position.set(-27.5,2,0); scene.add(w3);
  const w4 = new THREE.Mesh(wallGeo2, wallMat); w4.position.set( 27.5,2,0); scene.add(w4);

  // props
  const propMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
  for(const [x,z] of [[-12,-8],[10,6],[-6,14],[14,-10],[0,0]]){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 10), propMat);
    m.position.set(x,0.8,z);
    scene.add(m);
  }

  // spawns
  mapCtx.playerSpawns = [{ x: 0, y: 1.7, z: 0 }];
  mapCtx.zombieSpawns = [
    { x: -22, y: 1.7, z: -22 },
    { x: 22, y: 1.7, z: -22 },
    { x: -22, y: 1.7, z: 22 },
    { x: 22, y: 1.7, z: 22 },
    { x: 0, y: 1.7, z: -24 },
    { x: 0, y: 1.7, z: 24 },
  ];

  engine.events.emit("log", { msg: `[map] ZM Yard01 loaded pspawns=${mapCtx.playerSpawns.length} zspawns=${mapCtx.zombieSpawns.length}` });
}
