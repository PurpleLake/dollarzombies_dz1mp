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
    this.scene.fog = new THREE.Fog(0x0a0f16, 6, 90);
    this.scene.background = new THREE.Color(0x0b0f16);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.05, 200);
    this.camera.position.set(0, 1.65, 0);

    this._hemi = new THREE.HemisphereLight(0x9bb2ff, 0x1b1f2a, 1.05);
    this.scene.add(this._hemi);

    this._ambient = new THREE.AmbientLight(0x808b9d, 0.55);
    this.scene.add(this._ambient);

    this._dir = new THREE.DirectionalLight(0xffffff, 1.1);
    this._dir.position.set(8, 14, 6);
    this._dir.castShadow = true;
    this._dir.shadow.mapSize.set(2048,2048);
    this.scene.add(this._dir);

    this._fill = new THREE.PointLight(0xffd8a6, 0.6, 120, 1.6);
    this._fill.position.set(0, 6, 0);
    this._fill.castShadow = false;
    this.scene.add(this._fill);

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
