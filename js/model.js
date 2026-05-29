/* ── model.js — GLB animation for landing overlay ──
 *
 *  Renders greeting.glb into its own canvas (#model-canvas) that sits
 *  inside #landing-overlay, so it appears on top of the overlay background
 *  without being blurred by backdrop-filter.
 *
 *  Exports:
 *    initModel()    — call once at startup (no scene arg needed)
 *    updateModel(dt) — call every frame in tick()
 *    showModel()    — call when landing overlay appears
 *    hideModel()    — call when Play is clicked
 * ── */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";

let _renderer = null;
let _scene = null;
let _camera = null;
let _mixer = null;
let _canvas = null;

export function initModel() {
  _canvas = document.getElementById("model-canvas");
  if (!_canvas) return;

  _renderer = new THREE.WebGLRenderer({
    canvas: _canvas,
    antialias: true,
    alpha: true,
  });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight);

  _scene = new THREE.Scene();

  _camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  _camera.position.set(0, -0.5, 6);
  _camera.lookAt(0, -0.5, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  _scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 8, 5);
  _scene.add(key);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.5);
  fill.position.set(-3, 2, 3);
  _scene.add(fill);

  window.addEventListener("resize", () => {
    if (!_renderer) return;
    _camera.aspect = window.innerWidth / window.innerHeight;
    _camera.updateProjectionMatrix();
    _renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const loader = new GLTFLoader();
  loader.load(
    "/greeting.glb",
    (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 0.95 / Math.max(size.y, 0.001);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale - 0.4, -box.min.y * scale - 2.95, 0);

      _scene.add(model);

      if (gltf.animations.length) {
        _mixer = new THREE.AnimationMixer(model);
        _mixer.clipAction(gltf.animations[0]).play();
      }

      console.log("[model] loaded — scale:", scale.toFixed(2), "size:", size);
    },
    undefined,
    (err) => console.error("[model] failed to load:", err),
  );
}

export function showModel() {
  if (_canvas) _canvas.style.display = "block";
}

export function hideModel() {
  if (_canvas) _canvas.style.display = "none";
}

export function updateModel(dt) {
  if (!_renderer || !_scene || !_camera) return;
  if (_mixer) _mixer.update(dt);
  _renderer.render(_scene, _camera);
}
