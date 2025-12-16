import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

// Random direction within a cone around forward (radians)
export function jitterDirection(forward, coneRad){
  if(coneRad <= 0) return forward.clone().normalize();
  // sample small random axis-angle perturbation
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  // bias toward center
  const r = coneRad * Math.sqrt(v);
  const x = Math.cos(theta) * r;
  const y = Math.sin(theta) * r;

  // build orthonormal basis
  const f = forward.clone().normalize();
  const up = Math.abs(f.y) > 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
  const right = new THREE.Vector3().crossVectors(up, f).normalize();
  const realUp = new THREE.Vector3().crossVectors(f, right).normalize();

  const dir = f.clone()
    .addScaledVector(right, x)
    .addScaledVector(realUp, y)
    .normalize();
  return dir;
}
