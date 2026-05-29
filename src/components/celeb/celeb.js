/* ── celeb.js — celebration character for round winners ──
 *
 *  Loads bro-celeb.glb, renders it into a fixed canvas under the winner's score.
 *  Fades in, plays animation once, fades out 1 second before the clip ends.
 *
 *  Exports:
 *    initCeleb()         — call once at startup
 *    showCeleb(winner)   — call with "X" or "O" when a round ends
 *    hideCeleb()         — call on reset / next round
 *    updateCeleb(dt)     — call every frame in tick()
 *
 *  To resize: change W and H here — CSS is not needed.
 * ── */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader";

const W = 260;
const H = 520;

let _renderer = null;
let _scene = null;
let _camera = null;
let _mixer = null;
let _action = null;
let _clipDuration = 0;
let _canvas = null;
let _active = false;
let _loaded = false;
let _pendingWinner = null;
let _fadeTimer = null;

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

  _scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 5, 4);
  _scene.add(key);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
  fill.position.set(-2, 1, 3);
  _scene.add(fill);

  const loader = new GLTFLoader();
  loader.load(
    "/bro-celeb.glb",
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

      const charH = box1.max.y - box1.min.y;
      _camera.position.set(0, charH * 0.5, dist);
      _camera.lookAt(0, charH * 0.5, 0);
      _camera.updateProjectionMatrix();

      _scene.add(model);

      if (gltf.animations.length) {
        _clipDuration = gltf.animations[0].duration;
        _mixer = new THREE.AnimationMixer(model);
        _action = _mixer.clipAction(gltf.animations[0]);
        _action.setLoop(THREE.LoopOnce, 1);
        _action.clampWhenFinished = true;
      }

      _loaded = true;
      if (_pendingWinner) {
        _trigger(_pendingWinner);
        _pendingWinner = null;
      }
    },
    undefined,
    (err) => console.error("[celeb] failed to load:", err),
  );
}

function _trigger(winner) {
  const scoreEl =
    winner === "X"
      ? document.getElementById("score-x")
      : document.getElementById("score-o");
  if (!scoreEl) return;

  // Clear any previous fade timer
  if (_fadeTimer) {
    clearTimeout(_fadeTimer);
    _fadeTimer = null;
  }

  const rect = scoreEl.getBoundingClientRect();
  const isMobile = window.innerWidth < 600;
  const centerX = isMobile
    ? Math.round(window.innerWidth / 2 - W / 2)
    : Math.round(rect.left + rect.width / 2 - W / 2);
  _canvas.style.left = centerX + "px";
  _canvas.style.top = Math.round(rect.bottom + 8) + "px";
  if (isMobile) document.getElementById("bg-canvas").style.opacity = "0.15";
  _canvas.style.display = "block";
  _canvas.style.opacity = "0";
  _active = true;

  if (_action) {
    _action.reset();
    _action.play();
  }

  requestAnimationFrame(() => {
    _canvas.style.opacity = "1";
  });

  // Fade out 1 second before the clip ends
  const fadeAt = Math.max((_clipDuration - 1) * 1000, 500);
  _fadeTimer = setTimeout(() => _fadeOut(), fadeAt);
}

function _fadeOut() {
  _canvas.style.opacity = "0";
  document.getElementById("bg-canvas").style.opacity = "1";
  setTimeout(() => {
    _canvas.style.display = "none";
    _active = false;
  }, 900);
}

export function hideCeleb() {
  if (!_canvas) return;
  if (_fadeTimer) {
    clearTimeout(_fadeTimer);
    _fadeTimer = null;
  }
  _fadeOut();
}

export function showCeleb(winner) {
  if (winner === "draw") return;
  if (!_loaded) {
    _pendingWinner = winner;
    return;
  }
  _trigger(winner);
}

export function updateCeleb(dt) {
  if (!_active || !_renderer || !_scene || !_camera) return;
  if (_mixer) _mixer.update(dt);
  _renderer.render(_scene, _camera);
}
