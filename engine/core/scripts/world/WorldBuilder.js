import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

/**
 * Lightweight helper for building and clearing simple block-out maps.
 * Keeps track of spawned meshes/lights so we can cleanly reset the scene.
 */
export class WorldBuilder {
  constructor({ engine, renderer }){
    this.engine = engine;
    this.renderer = renderer;
    this.scene = renderer?.scene;
    this.THREE = renderer?.THREE || THREE;
    this.objects = [];
    this.lights = [];
    this.floor = null;
    this.colliders = [];
  }

  clearWorld(){
    for(const obj of this.objects){
      try { this.scene?.remove(obj); } catch {}
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    }
    this.objects.length = 0;
    this.colliders.length = 0;

    for(const l of this.lights){
      try { this.scene?.remove(l); } catch {}
    }
    this.lights.length = 0;

    if(this.floor){
      try { this.scene?.remove(this.floor); } catch {}
      this.floor.geometry?.dispose?.();
      this.floor.material?.dispose?.();
      this.floor = null;
    }
  }

  addFloor({ size=50, color=0x0c1222, metalness=0.0, roughness=0.95 } = {}){
    const geo = new this.THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new this.THREE.MeshStandardMaterial({ color, roughness, metalness });
    const mesh = new this.THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.receiveShadow = true;
    this.scene?.add(mesh);
    this.floor = mesh;
    return mesh;
  }

  addBoundaryWalls({ size=50, height=3, thickness=0.6, color=0x182040 } = {}){
    const half = size/2;
    const mat = new this.THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const mk = (w,h,d,x,z)=>{
      const geo = new this.THREE.BoxGeometry(w,h,d);
      const m = new this.THREE.Mesh(geo, mat);
      m.position.set(x, h/2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene?.add(m);
      this.objects.push(m);
      this.colliders.push({ type:"box", x, y:0, z, sx:w, sy:h, sz:d, rot:0 });
      return m;
    };
    mk(size, height, thickness, 0, -half);
    mk(size, height, thickness, 0, half);
    mk(thickness, height, size, -half, 0);
    mk(thickness, height, size, half, 0);
  }

  addWallBox({ width=2, height=2, depth=1, x=0, y=null, z=0, color=0x283248, rot=0 } = {}){
    const mat = new this.THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const geo = new this.THREE.BoxGeometry(width, height, depth);
    const mesh = new this.THREE.Mesh(geo, mat);
    mesh.position.set(x, y ?? (height/2), z);
    mesh.rotation.y = Number(rot || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene?.add(mesh);
    this.objects.push(mesh);
    this.colliders.push({
      type:"box",
      x,
      y:0,
      z,
      sx: width,
      sy: height,
      sz: depth,
      rot: Number(rot || 0),
    });
    return mesh;
  }

  addCrate({ x=0, y=0.5, z=0, size=1, color=0x2a8a3a } = {}){
    return this.addWallBox({ width:size, height:size, depth:size, x, y: y ?? size/2, z, color });
  }

  addCylinder({ rTop=1, rBottom=1, height=1, x=0, y=null, z=0, color=0x3a4455 } = {}){
    const mat = new this.THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const geo = new this.THREE.CylinderGeometry(rTop, rBottom, height, 16);
    const mesh = new this.THREE.Mesh(geo, mat);
    mesh.position.set(x, y ?? (height/2), z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene?.add(mesh);
    this.objects.push(mesh);
    this.colliders.push({
      type: "cylinder",
      x,
      y: 0,
      z,
      rTop: Number(rTop || 1),
      rBottom: Number(rBottom || 1),
      h: Number(height || 1),
    });
    return mesh;
  }

  addLight({ type="ambient", color=0xffffff, intensity=0.8, position=null, castShadow=true, distance=120 } = {}){
    let light;
    if(type === "directional"){
      light = new this.THREE.DirectionalLight(color, intensity);
      light.castShadow = castShadow;
      if(position) light.position.set(position.x||0, position.y||0, position.z||0);
    } else if(type === "point"){
      light = new this.THREE.PointLight(color, intensity, Number(distance||120), 1.4);
      if(position) light.position.set(position.x||0, position.y||0, position.z||0);
      light.castShadow = castShadow;
    } else {
      light = new this.THREE.AmbientLight(color, intensity);
    }
    this.scene?.add(light);
    this.lights.push(light);
    return light;
  }

  tick(){ /* hook for future nav/physics */ }
}
