// World builder: floor, boundary walls, crates
export class ZmWorld {
  constructor({ engine, renderer }){
    this.engine = engine;
    this.r = renderer;
    this.THREE = renderer.THREE;
    this.objects = []; // collision/static
    this.floor = null;
  }

  clear(){
    for(const o of this.objects){
      this.r.scene.remove(o);
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    }
    this.objects.length = 0;
    if(this.floor){
      this.r.scene.remove(this.floor);
      this.floor.geometry?.dispose?.();
      this.floor.material?.dispose?.();
      this.floor = null;
    }
  }

  addFloor(size=50){
    const THREE = this.THREE;
    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c1222, roughness: 0.95, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.receiveShadow = true;
    this.r.scene.add(mesh);
    this.floor = mesh;
  }

  addBoundaryWalls(size=50, height=3){
    const THREE = this.THREE;
    const half = size/2;
    const thick = 0.5;

    const mat = new THREE.MeshStandardMaterial({ color: 0x182040, roughness: 0.9 });
    const mk = (w,h,d,x,z)=>{
      const geo = new THREE.BoxGeometry(w,h,d);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, h/2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.r.scene.add(m);
      this.objects.push(m);
    };

    mk(size, height, thick, 0, -half);
    mk(size, height, thick, 0, half);
    mk(thick, height, size, -half, 0);
    mk(thick, height, size, half, 0);
  }

  addCrate(x=0, y=0.5, z=0){
    const THREE = this.THREE;
    const geo = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 1.0 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x,y,z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.r.scene.add(m);
    this.objects.push(m);
  }

  tick(){ /* later: broadphase, nav, etc */ }
}
