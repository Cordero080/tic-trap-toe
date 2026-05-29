/* ── model.js — GLB animation for landing overlay ──
 *
 *  Renders a greeting character into #model-canvas (inside #landing-overlay).
 *  Dark mode → greeting.glb (bro).  Light mode → greeting-light.glb (cat).
 *  Both are loaded at startup with Draco compression; theme switches swap
 *  visibility instantly with no reload.
 *
 *  Exports:
 *    initModel()          — call once at startup
 *    updateModel(dt)      — call every frame in tick()
 *    showModel()          — call when landing overlay appears
 *    hideModel()          — call when Play is clicked
 *    setDarkMode(dark)    — call from applyTheme() to swap characters
 * ── */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader";

let _renderer = null;
let _scene = null;
let _camera = null;
let _canvas = null;
let _isDark = true;
let _shouldBeVisible = false;

// One entry per character: { model, mixer, loaded }
const _chars = { dark: null, light: null };

function _makeLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(
    "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/",
  );
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

function _placeModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 0.95 / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale - 0.25, -box.min.y * scale - 2.95, 0);
}

function _loadChar(key, path) {
  const loader = _makeLoader();
  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;
      _placeModel(model);
      model.visible = false;
      _scene.add(model);

      let mixer = null;
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
      }

      _chars[key] = { model, mixer };

      // If this is the active theme's character and we're supposed to be visible, show it
      const activeKey = _isDark ? "dark" : "light";
      if (key === activeKey && _shouldBeVisible) model.visible = true;
    },
    undefined,
    (err) => console.error(`[model] failed to load ${path}:`, err),
  );
}

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

  _scene.add(new THREE.AmbientLight(0xffffff, 0.7));
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

  // Read initial theme from body class (set before JS runs)
  _isDark = document.body.classList.contains("dark");

  // Only load the active theme's character at startup; load the other on first toggle
  const activeKey = _isDark ? "dark" : "light";
  const activePath = _isDark
    ? "/public/models/greeting.glb"
    : "/public/models/greeting-light.glb";
  _loadChar(activeKey, activePath);
}

export function setDarkMode(dark) {
  if (_isDark === dark) return;
  _isDark = dark;

  const newKey = dark ? "dark" : "light";
  const newPath = dark
    ? "/public/models/greeting.glb"
    : "/public/models/greeting-light.glb";

  // Lazy-load the other theme's character on first toggle
  if (!_chars[newKey]) {
    _loadChar(newKey, newPath);
  }

  if (!_shouldBeVisible) return;
  const showKey = newKey;
  const hideKey = dark ? "light" : "dark";
  if (_chars[showKey]) _chars[showKey].model.visible = true;
  if (_chars[hideKey]) _chars[hideKey].model.visible = false;
}

export function showModel() {
  _shouldBeVisible = true;
  if (_canvas) _canvas.style.display = "block";
  const activeKey = _isDark ? "dark" : "light";
  if (_chars[activeKey]) _chars[activeKey].model.visible = true;
}

export function hideModel() {
  _shouldBeVisible = false;
  if (_canvas) _canvas.style.display = "none";
  // Hide both so there's no stale visible model if theme swaps while hidden
  for (const k of ["dark", "light"]) {
    if (_chars[k]) _chars[k].model.visible = false;
  }
}

export function updateModel(dt) {
  if (!_renderer || !_scene || !_camera) return;
  const activeKey = _isDark ? "dark" : "light";
  const active = _chars[activeKey];
  if (active?.mixer) active.mixer.update(dt);
  _renderer.render(_scene, _camera);
}
