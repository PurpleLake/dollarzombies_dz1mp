// Three.js renderer wrapper (ESM via CDN) for a no-build setup.
import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export class Renderer3D {
  constructor(){
    this.THREE = THREE;
    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05060a, 6, 70);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.05, 200);
    this.camera.position.set(0, 1.65, 0);

    const hemi = new THREE.HemisphereLight(0x88aaff, 0x111122, 0.8);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(8, 14, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048,2048);
    this.scene.add(dir);

    window.addEventListener("resize", ()=>{
      this.camera.aspect = window.innerWidth/window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  mount(){
    document.body.appendChild(this.renderer.domElement);
    return this.renderer.domElement;
  }

  render(){
    this.renderer.render(this.scene, this.camera);
  }
}
