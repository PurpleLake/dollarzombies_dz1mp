import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://unpkg.com/three@0.161.0/examples/jsm/controls/TransformControls.js";

function makeMaterial(color){ return new THREE.MeshStandardMaterial({ color }); }

const PREFAB_GEOMETRIES = {
  wall: new THREE.BoxGeometry(2, 2, 0.25),
  floor: new THREE.BoxGeometry(2, 0.2, 2),
  prop_crate: new THREE.BoxGeometry(1, 1, 1),
  prop_tree: new THREE.ConeGeometry(0.6, 1.5, 6),
  light_point: new THREE.SphereGeometry(0.2, 12, 12),
  zombie_spawn: new THREE.CylinderGeometry(0.2,0.2,0.1,12),
  player_spawn: new THREE.CylinderGeometry(0.25,0.25,0.1,12),
};

export function createViewport(el, { onSelect, onTransform, onCreate, getState, getSnap }){
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(el.clientWidth, el.clientHeight);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f16);
  const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 500);
  camera.position.set(8, 8, 8);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const hemi = new THREE.HemisphereLight(0x8899aa, 0x111118, 0.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 3);
  scene.add(dir);

  const grid = new THREE.GridHelper(80, 80, 0x4cafef, 0x2e3442);
  scene.add(grid);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);

  const meshes = new Map();
  const transform = new TransformControls(camera, renderer.domElement);
  transform.addEventListener("dragging-changed", (ev)=>{ controls.enabled = !ev.value; });
  transform.addEventListener("objectChange", ()=>{
    const obj = transform.object?.userData?.ref;
    if(obj){
      obj.position = { ...obj.position, x: transform.object.position.x, y: transform.object.position.y, z: transform.object.position.z };
      const euler = transform.object.rotation;
      obj.rotation = { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) };
      obj.scale = { x: transform.object.scale.x, y: transform.object.scale.y, z: transform.object.scale.z };
      onTransform?.(obj);
    }
  });
  scene.add(transform);

  function upsertMesh(obj){
    let mesh = meshes.get(obj.id);
    if(!mesh){
      mesh = new THREE.Mesh(PREFAB_GEOMETRIES[obj.prefab] || new THREE.BoxGeometry(1,1,1), makeMaterial(0x4cafef));
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.ref = obj;
      meshes.set(obj.id, mesh);
      scene.add(mesh);
    }
    mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
    mesh.rotation.set(THREE.MathUtils.degToRad(obj.rotation.x||0), THREE.MathUtils.degToRad(obj.rotation.y||0), THREE.MathUtils.degToRad(obj.rotation.z||0));
    mesh.scale.set(obj.scale.x||1, obj.scale.y||1, obj.scale.z||1);
    return mesh;
  }

  function removeMesh(obj){
    const mesh = meshes.get(obj.id);
    if(mesh){ scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); meshes.delete(obj.id); }
  }

  function syncAll(){
    const state = getState();
    const seen = new Set();
    state.objects.forEach(o=>{ upsertMesh(o); seen.add(o.id); });
    for(const [id, mesh] of meshes){ if(!seen.has(id)) removeMesh({id}); }
  }

  function pick(event){
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(Array.from(meshes.values()));
    return hits[0]?.object || null;
  }

  function pickGround(event){
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, point);
    return point;
  }

  function attach(obj){
    const mesh = meshes.get(obj.id);
    if(mesh){
      transform.attach(mesh);
    }
  }

  renderer.domElement.addEventListener("mousedown", (e)=>{
    if(e.button !== 0) return;
    const hit = pick(e);
    if(hit){
      onSelect?.(hit.userData.ref);
    } else {
      onSelect?.(null);
    }
  });

  renderer.domElement.addEventListener("dblclick", (e)=>{
    const point = pickGround(e);
    if(point) camera.position.set(point.x+8, 8, point.z+8);
  });

  renderer.domElement.addEventListener("dragover", (e)=>{ e.preventDefault(); });
  renderer.domElement.addEventListener("drop", (e)=>{
    e.preventDefault();
    const data = e.dataTransfer?.getData("text/plain");
    if(!data) return;
    try {
      const prefab = JSON.parse(data);
      const p = pickGround(e);
      if(p){ onCreate?.(prefab, p); }
    } catch {}
  });

  window.addEventListener("resize", ()=>{
    renderer.setSize(el.clientWidth, el.clientHeight);
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
  });

  window.addEventListener("keydown", (e)=>{
    if(e.code === "KeyW") transform.setMode("translate");
    if(e.code === "KeyE") transform.setMode("rotate");
    if(e.code === "KeyR") transform.setMode("scale");
    if(e.code === "Delete"){ onSelect?.(null); }
  });

  function setMode(mode){ transform.setMode(mode); }
  function setSnap(size){ transform.setTranslationSnap(size||null); }
  function dropSelection(){
    const obj = transform.object?.userData?.ref;
    if(!obj) return;
    obj.position.y = 0;
    onTransform?.(obj);
    attach(obj);
  }

  function updateSelection(obj){
    if(!obj){ transform.detach(); return; }
    attach(obj);
  }

  function loop(){
    requestAnimationFrame(loop);
    const snap = getSnap?.();
    transform.setTranslationSnap(snap);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  return { syncAll, updateSelection, setMode, setSnap, dropSelection };
}
