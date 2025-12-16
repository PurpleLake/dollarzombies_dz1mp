import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export async function buildMap(engine, mapCtx, manifest){
  const r = engine.ctx.renderer;
  const scene = r.scene;

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 1.0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(8, 12, 6);
  scene.add(dir);

  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI/2;
  scene.add(floor);

  // boundary walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x303244, roughness: 0.8 });
  const wallGeo = new THREE.BoxGeometry(60, 4, 1.2);
  const w1 = new THREE.Mesh(wallGeo, wallMat); w1.position.set(0,2,-30); scene.add(w1);
  const w2 = new THREE.Mesh(wallGeo, wallMat); w2.position.set(0,2, 30); scene.add(w2);
  const wallGeo2 = new THREE.BoxGeometry(1.2, 4, 60);
  const w3 = new THREE.Mesh(wallGeo2, wallMat); w3.position.set(-30,2,0); scene.add(w3);
  const w4 = new THREE.Mesh(wallGeo2, wallMat); w4.position.set( 30,2,0); scene.add(w4);

  // cover blocks
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x3b3e57, roughness: 0.7 });
  const blocks = [
    [0, 1, 0, 6, 2, 2],
    [-12, 1, -8, 4, 2, 2],
    [12, 1, 8, 4, 2, 2],
    [-10, 1, 12, 6, 2, 2],
    [10, 1, -12, 6, 2, 2],
  ];
  for(const [x,y,z,sx,sy,sz] of blocks){
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), coverMat);
    m.position.set(x,y,z);
    scene.add(m);
  }

  // team spawns (6 each for 6v6)
  const t0 = [
    [-22,1.7,-22],[-18,1.7,-24],[-24,1.7,-18],[-20,1.7,-20],[-16,1.7,-22],[-22,1.7,-16]
  ];
  const t1 = [
    [22,1.7,22],[18,1.7,24],[24,1.7,18],[20,1.7,20],[16,1.7,22],[22,1.7,16]
  ];
  mapCtx.mpSpawnsTeam0 = t0.map(([x,y,z])=>({x,y,z}));
  mapCtx.mpSpawnsTeam1 = t1.map(([x,y,z])=>({x,y,z}));

  engine.events.emit("log", { msg: `[map] MP Arena01 loaded spawns t0=${t0.length} t1=${t1.length}` });
}
