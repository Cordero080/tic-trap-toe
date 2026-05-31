/* ── celeb.js — celebration character for round winners ──
 *
 *  Loads bro-celeb.glb (dark) and white-celeb.glb (light), renders the active
 *  theme's character into a fixed canvas under the winner's score.
 *  Fades in, plays animation once, fades out 1 second before the clip ends.
 *
 *  Exports:
 *    initCeleb()           — call once at startup
 *    showCeleb(winner)     — call with "X" or "O" when a round ends
 *    hideCeleb()           — call on reset / next round
 *    updateCeleb(dt)       — call every frame in tick()
 *    setDarkMode(dark)     — call from applyTheme() to track active theme
 *
 *  To resize: change W and H here — CSS is not needed.
 * ── */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader";

const W = 260;
const H = 520;

let _renderer = null;
let _scene = null;
let _camera = null;
let _canvas = null;
let _active = false;
let _pendingWinner = null;
let _fadeTimer = null;
let _isDark = true;
let _lights = null;

function _applyLightMode(dark) {
  if (!_lights) return;
  if (dark) {
    _lights.ambient.color.set(0xffffff);
    _lights.ambient.intensity = 0.7;
    _lights.key.color.set(0xffffff);
    _lights.key.intensity = 1.4;
    _lights.fill.color.set(0x8888ff);
    _lights.fill.intensity = 0.4;
    _lights.rim.intensity = 0;
  } else {
    _lights.ambient.color.set(0xddeeff);
    _lights.ambient.intensity = 0.15;
    _lights.key.color.set(0xfff3d0);
    _lights.key.intensity = 2.2;
    _lights.fill.color.set(0x7799cc);
    _lights.fill.intensity = 0.6;
    _lights.rim.color.set(0xffffff);
    _lights.rim.intensity = 0.7;
  }
}

// Per-character state — { model, mixer, action, clipDuration, loaded, loading }
const _dark = {
  model: null,
  mixer: null,
  action: null,
  clipDuration: 0,
  loaded: false,
  loading: false,
};
const _light = {
  model: null,
  mixer: null,
  action: null,
  clipDuration: 0,
  loaded: false,
  loading: false,
};

function _char() {
  return _isDark ? _dark : _light;
}

function _placeModel(model, char) {
  model.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(model);
  const size0 = box0.getSize(new THREE.Vector3());

  const fovRad = (55 * Math.PI) / 180;
  const dist = 5;
  const visH = 2 * dist * Math.tan(fovRad / 2);
  const scale = (visH * 0.58) / Math.max(size0.y, 0.001);
  model.scale.setScalar(scale);

  model.updateMatrixWorld(true);
  const box1 = new THREE.Box3().setFromObject(model);
  const center1 = box1.getCenter(new THREE.Vector3());
  model.position.set(-center1.x, -box1.min.y, 0);

  const charH = box1.max.y - box1.min.y;
  if (!_camera._positionSet) {
    _camera.position.set(0, charH * 0.5, dist);
    _camera.lookAt(0, charH * 0.5, 0);
    _camera.updateProjectionMatrix();
    _camera._positionSet = true;
  }

  model.visible = false;
  _scene.add(model);

  if (char !== null && window.__gltfAnimations) {
    // animations attached externally (see loader callback)
  }
}

function _makeLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(
    "https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/",
  );
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

function _loadChar(charObj, path) {
  if (charObj.loading || charObj.loaded) return;
  charObj.loading = true;
  const loader = _makeLoader();
  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;

      model.updateMatrixWorld(true);
      const box0 = new THREE.Box3().setFromObject(model);
      const size0 = box0.getSize(new THREE.Vector3());

      const fovRad = (55 * Math.PI) / 180;
      const dist = 5;
      const visH = 2 * dist * Math.tan(fovRad / 2);
      const scale = (visH * 0.58) / Math.max(size0.y, 0.001);
      model.scale.setScalar(scale);

      model.updateMatrixWorld(true);
      const box1 = new THREE.Box3().setFromObject(model);
      const center1 = box1.getCenter(new THREE.Vector3());
      model.position.set(-center1.x, -box1.min.y, 0);

      // Set camera from whichever character finishes loading first
      if (!_camera._positionSet) {
        const charH = box1.max.y - box1.min.y;
        _camera.position.set(0, charH * 0.5, dist);
        _camera.lookAt(0, charH * 0.5, 0);
        _camera.updateProjectionMatrix();
        _camera._positionSet = true;
      }

      model.visible = false;
      _scene.add(model);
      charObj.model = model;

      if (gltf.animations.length) {
        charObj.clipDuration = gltf.animations[0].duration;
        charObj.mixer = new THREE.AnimationMixer(model);
        charObj.action = charObj.mixer.clipAction(gltf.animations[0]);
        charObj.action.setLoop(THREE.LoopOnce, 1);
        charObj.action.clampWhenFinished = true;
      }

      charObj.loaded = true;

      // If this is the active character and a winner is pending, trigger now
      if (_pendingWinner && charObj === _char()) {
        _trigger(_pendingWinner);
        _pendingWinner = null;
      }
    },
    undefined,
    (err) => console.error("[celeb] failed to load:", err),
  );
}

export function initCeleb() {
  _canvas = document.getElementById("celeb-canvas");
  if (!_canvas) return;

  _renderer = new THREE.WebGLRenderer({
    canvas: _canvas,
    antialias: true,
    alpha: true,
  });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(W, H);

  _scene = new THREE.Scene();
  _camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  _scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 5, 4);
  _scene.add(key);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
  fill.position.set(-2, 1, 3);
  _scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0);
  rim.position.set(-2, 6, -4);
  _scene.add(rim);
  _lights = { ambient, key, fill, rim };

  // Read initial theme from localStorage — body class is always "dark" at parse time
  // (hardcoded for FOUC prevention), so body class is not reliable here
  _isDark = localStorage.getItem("theme_v2") !== "light";
  _applyLightMode(_isDark);

  // Only load the active theme's character at startup; load the other on first toggle
  if (_isDark) {
    _loadChar(_dark, "/public/models/bro-celeb.glb");
  } else {
    _loadChar(_light, "/public/models/white-celeb.glb");
  }
}

export function setDarkMode(dark) {
  _isDark = dark;
  _applyLightMode(dark);
  // Lazy-load the other theme's character on first toggle; loading flag prevents duplicates
  if (dark) {
    _loadChar(_dark, "/public/models/bro-celeb.glb");
  } else {
    _loadChar(_light, "/public/models/white-celeb.glb");
  }
}

function _trigger(winner) {
  const scoreEl =
    winner === "X"
      ? document.getElementById("score-x")
      : document.getElementById("score-o");
  if (!scoreEl) return;

  const char = _char();
  if (!char.loaded) return;

  // Clear any previous fade timer
  if (_fadeTimer) {
    clearTimeout(_fadeTimer);
    _fadeTimer = null;
  }

  // Hide both models, show only the active one
  if (_dark.model) _dark.model.visible = false;
  if (_light.model) _light.model.visible = false;
  if (char.model) char.model.visible = true;

  const rect = scoreEl.getBoundingClientRect();
  const isMobile = window.innerWidth < 600;
  const centerX = isMobile
    ? Math.round(window.innerWidth / 2 - W / 2)
    : Math.round(rect.left + rect.width / 2 - W / 2);
  _canvas.style.left = centerX + "px";
  _canvas.style.top = Math.round(rect.bottom + 8) + "px";
  if (isMobile) {
    const dim = document.getElementById("celeb-dim");
    if (dim) dim.style.display = "block";
  }
  _canvas.style.display = "block";
  _canvas.style.opacity = "0";
  _active = true;

  if (char.action) {
    char.action.reset();
    char.action.play();
  }

  requestAnimationFrame(() => {
    _canvas.style.opacity = "1";
  });

  // Fade out when the clip finishes playing
  const fadeAt = Math.max(char.clipDuration * 1000, 1000);
  _fadeTimer = setTimeout(() => _fadeOut(), fadeAt);
}

function _fadeOut() {
  _canvas.style.opacity = "0";
  const dim = document.getElementById("celeb-dim");
  if (dim) dim.style.display = "none";
  setTimeout(() => {
    _canvas.style.display = "none";
    _active = false;
    // Hide all models on fade-out
    if (_dark.model) _dark.model.visible = false;
    if (_light.model) _light.model.visible = false;
  }, 900);
}

export function hideCeleb() {
  if (!_canvas) return;
  if (_fadeTimer) {
    clearTimeout(_fadeTimer);
    _fadeTimer = null;
  }
  _pendingWinner = null;
  _fadeOut();
}

export function showCeleb(winner) {
  if (winner === "draw") return;
  const char = _char();
  if (!char.loaded) {
    // Wait until the active character's model is loaded
    _pendingWinner = winner;
    return;
  }
  _trigger(winner);
}

export function updateCeleb(dt) {
  if (!_active || !_renderer || !_scene || !_camera) return;
  const char = _char();
  if (char.mixer) char.mixer.update(dt);
  _renderer.render(_scene, _camera);
}
