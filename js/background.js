/* ── background.js — scene setup, input, DOM, and tick loop ──
 *
 *  This is the entry point. It owns:
 *    - Three.js renderer, scene, camera, lights
 *    - Canvas click + mousemove input (raycasting into cube.js hit planes)
 *    - Reset button handler
 *    - Score DOM animation (animateScore)
 *    - Status message updates (updateMessage)
 *    - The tick() loop — orchestrates cube, title, and render
 *
 *  Heavy lifting is delegated to:
 *    cube.js   — all 3-D cube geometry, marks, slabs, confetti, rotation
 *    title.js  — 3-D extruded title mesh
 *    audio.js  — Web Audio synthesis (imported transitively through cube.js)
 *    app.js    — pure game logic (no DOM, no Three.js)
 * ── */

import * as THREE from "three";
import {
  faceStates,
  score,
  matchOver,
  matchWinner,
  vsComputer,
  difficulty,
  makeMove,
  resetAll,
  resetRound,
  setVsComputer,
} from "./app.js";
import {
  hitPlaneMeshes,
  hoverMeshes,
  initCube,
  syncMarks,
  onFaceWon,
  onFaceDraw,
  triggerComputer,
  updateCube,
  getActiveFaceIdx,
  resetCubeVisuals,
  setInteractiveMode,
  applyDrag,
  setDarkMode as setCubeDark,
} from "./cube.js";
import {
  initTitle,
  updateTitle,
  resizeTitle,
  setDarkMode as setTitleDark,
  showGameOver,
  hideGameOver,
} from "./title.js";
import { primeAudio } from "./audio.js";
import {
  initModel,
  updateModel,
  showModel,
  hideModel,
  setDarkMode as setModelDark,
} from "./model.js";
import { initCeleb, showCeleb, hideCeleb, updateCeleb } from "./celeb.js";

/* ── Prime Web Audio on first gesture so iOS Safari unlocks the context ── */
function _primeOnce() {
  primeAudio();
  document.removeEventListener("touchstart", _primeOnce, true);
  document.removeEventListener("click", _primeOnce, true);
}
document.addEventListener("touchstart", _primeOnce, true);
document.addEventListener("click", _primeOnce, true);

/* ── Renderer ── */
const canvas = document.getElementById("bg-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

/* ── Scene ── */
const scene = new THREE.Scene();
const LIGHT_BG = 0xf2f2f8;
const DARK_BG = 0x0d0d18;
const _initialDark = localStorage.getItem("theme_v2") !== "light";
scene.background = new THREE.Color(_initialDark ? DARK_BG : LIGHT_BG);
const _bgTarget = new THREE.Color(_initialDark ? DARK_BG : LIGHT_BG);
let _wasMatchOver = false;

/* ── Camera ── */
const camera = new THREE.PerspectiveCamera(
  52,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.z = 28;

/* ── Lights ── */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(5, 10, 10);
scene.add(sun);
// Second light from above-front so the extruded title letters catch highlights
const titleLight = new THREE.DirectionalLight(0xffffff, 0.5);
titleLight.position.set(0, 20, 15);
scene.add(titleLight);
// Studio spotlight — extra punch on the cube in dark mode (toggled by applyTheme)
const studioLight = new THREE.PointLight(0xd0c0ff, 0, 60);
studioLight.position.set(0, 2, 18);
scene.add(studioLight);

/* ── Score DOM elements ── */
const scoreXEl = document.getElementById("score-x");
const scoreOEl = document.getElementById("score-o");

/* ── animateScore — scrambles the digit before landing on the new value ── */
function animateScore(winner, onDone) {
  const el = winner === "X" ? scoreXEl : scoreOEl;
  const target = score[winner];
  el.classList.remove("score-pop", "score-match-win");
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add("score-pop");
  let frame = 0;
  const iv = setInterval(() => {
    frame++;
    if (frame >= 14) {
      clearInterval(iv);
      el.textContent = target;
      if (onDone) onDone(el);
    } else {
      el.textContent = Math.floor(Math.random() * 10);
    }
  }, 38);
}

/* ── Init cube + title (pass animateScore callback so cube.js can trigger it) ── */
initCube(scene, (winner) => {
  animateScore(winner, (el) => {
    if (matchOver) {
      el.classList.remove("score-pop");
      el.classList.add("score-match-win");
    }
  });
});
initTitle(scene, camera);
initModel();
showModel();
initCeleb();

/* ── Input ── */
const raycaster = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const OFS = 2.5 + 0.12; // CELL + GAP — matches cube.js constants

// Free-rotate drag state — active only when matchOver is true
let isDragging = false;
let dragX = 0;
let dragY = 0;

function setPtr(e) {
  ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
  ptr.y = (e.clientY / window.innerHeight) * -2 + 1;
}

canvas.addEventListener("mousedown", (e) => {
  if (!matchOver) return;
  isDragging = true;
  dragX = e.clientX;
  dragY = e.clientY;
  setInteractiveMode(true);
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  canvas.style.cursor = matchOver ? "grab" : "default";
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

canvas.addEventListener("click", (e) => {
  if (matchOver) return; // no moves during free-rotate phase
  setPtr(e);
  raycaster.setFromCamera(ptr, camera);
  const hits = raycaster.intersectObjects(hitPlaneMeshes);
  if (!hits.length) return;
  const { fi, ci } = hits[0].object.userData;
  // Three.js backface culling handles "can't click through cube" — no dot-product guard needed
  if (vsComputer && faceStates[fi].turn !== "X") return; // computer's turn — wait
  const prevWinner = faceStates[fi].winner;
  if (makeMove(fi, ci)) {
    syncMarks();
    if (!prevWinner && faceStates[fi].winner) {
      if (faceStates[fi].winner === "draw") onFaceDraw(fi);
      else onFaceWon(fi, ci);
    }
    if (vsComputer && !faceStates[fi].winner && faceStates[fi].turn === "O") {
      triggerComputer(fi);
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  // Free-rotate drag — takes priority over hover when matchOver
  if (isDragging && matchOver) {
    const dx = e.clientX - dragX;
    const dy = e.clientY - dragY;
    dragX = e.clientX;
    dragY = e.clientY;
    applyDrag(dx, dy);
    return;
  }

  // Normal hover — show cell highlight when a playable cell is under cursor
  if (matchOver) {
    canvas.style.cursor = "grab";
    hoverMeshes.forEach((hv) => {
      hv.visible = false;
    });
    return;
  }

  setPtr(e);
  raycaster.setFromCamera(ptr, camera);
  const hits = raycaster.intersectObjects(hitPlaneMeshes);
  hoverMeshes.forEach((hv) => {
    hv.visible = false;
  });
  canvas.style.cursor = "default";
  if (!hits.length) return;
  const { fi, ci } = hits[0].object.userData;
  if (faceStates[fi].winner || faceStates[fi].board[ci]) return;
  const r = Math.floor(ci / 3),
    c = ci % 3;
  const hv = hoverMeshes[fi];
  hv.position.x = (c - 1) * OFS;
  hv.position.y = (1 - r) * OFS;
  hv.visible = true;
  canvas.style.cursor = "pointer";
});

/* ── Reset / Next Round ── */
const nextRoundBtn = document.getElementById("next-round-btn");
const roundLabelEl = document.getElementById("round-label");
let currentRound = 1;

function setRoundLabel() {
  if (currentRound <= 1) {
    roundLabelEl.style.display = "none";
  } else {
    roundLabelEl.textContent = `Round ${currentRound}`;
    roundLabelEl.style.display = "block";
  }
}

function exitInteractiveMode() {
  isDragging = false;
  setInteractiveMode(false);
  canvas.style.cursor = "default";
}

// Full reset — clears difficulty back to Rookie and back to round 1
function doReset() {
  exitInteractiveMode();
  resetAll();
  resetCubeVisuals();
  scoreXEl.classList.remove("score-match-win");
  scoreOEl.classList.remove("score-match-win");
  scoreXEl.textContent = "0";
  scoreOEl.textContent = "0";
  nextRoundBtn.style.display = "none";
  currentRound = 1;
  setRoundLabel();
  _wasMatchOver = false;
  _bgTarget.set(document.body.classList.contains("dark") ? DARK_BG : LIGHT_BG);
  hideGameOver();
  hideCeleb();
}

// Partial reset — keeps difficulty so the AI stays at the earned level
function doNextRound() {
  exitInteractiveMode();
  resetRound();
  resetCubeVisuals();
  scoreXEl.classList.remove("score-match-win");
  scoreOEl.classList.remove("score-match-win");
  nextRoundBtn.style.display = "none";
  currentRound++;
  setRoundLabel();
  _wasMatchOver = false;
  _bgTarget.set(document.body.classList.contains("dark") ? DARK_BG : LIGHT_BG);
  hideGameOver();
  hideCeleb();
}

document.getElementById("reset-btn").addEventListener("click", doReset);
nextRoundBtn.addEventListener("click", doNextRound);

// Toggling vs-computer mid-game resets so the AI state starts clean
document.getElementById("vs-computer").addEventListener("change", (e) => {
  setVsComputer(e.target.checked);
  doReset();
});

/* ── Resize ── */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeTitle();
});

/* ── Dark-mode toggle ── */
const themeBtn = document.getElementById("theme-toggle");

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  const newBg = dark ? DARK_BG : LIGHT_BG;
  scene.background.set(newBg);
  if (!_wasMatchOver) _bgTarget.set(newBg);
  themeBtn.textContent = dark ? "☀️" : "🌙";
  // Studio light — dramatic frontal + top in dark mode
  studioLight.intensity = dark ? 2.0 : 0;
  ambientLight.intensity = dark ? 0.2 : 0.6;
  sun.intensity = dark ? 1.4 : 0.9;
  sun.position.set(dark ? 0 : 5, dark ? 12 : 10, dark ? 20 : 10);
  // Invert 3-D materials
  setCubeDark(dark);
  setTitleDark(dark);
  setModelDark(dark);
  try {
    localStorage.setItem("theme_v2", dark ? "dark" : "light");
  } catch {}
}

// Restore saved preference — "theme_v2" key resets anyone who had the old
// "light" default stored before dark mode became the site default.
applyTheme(localStorage.getItem("theme_v2") !== "light");

themeBtn.addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
});

/* ── Landing overlay ── */
const landingOverlay = document.getElementById("landing-overlay");
document.getElementById("play-btn").addEventListener("click", () => {
  // Cancel animation fill (which locks opacity:1) so the fade-out can take effect
  landingOverlay.style.animation = "none";
  landingOverlay.style.opacity = "0";
  landingOverlay.style.pointerEvents = "none";
  hideModel();
  setTimeout(() => {
    landingOverlay.style.display = "none";
  }, 500);
});

/* ── About modal ── */
const aboutModal = document.getElementById("about-modal");
document.getElementById("about-btn").addEventListener("click", () => {
  aboutModal.classList.add("visible");
});
document.getElementById("about-close").addEventListener("click", () => {
  aboutModal.classList.remove("visible");
});
aboutModal.addEventListener("click", (e) => {
  if (e.target === aboutModal) aboutModal.classList.remove("visible");
});

/* ── Message ── */
const msgEl = document.getElementById("message");
const DIFFICULTY_NAMES = ["Rookie", "Casual", "Focused", "Sharp", "Unbeatable"];
let nextRoundShown = false; // guard so we only show the button once per match end

function updateMessage() {
  if (matchOver) {
    // Reveal the Next Round button exactly once when the match ends
    if (!nextRoundShown) {
      nextRoundBtn.style.display = "inline-block";
      nextRoundShown = true;
    }
    msgEl.textContent =
      matchWinner === "draw"
        ? `All faces done — it's a draw!`
        : `${matchWinner} wins the match!`;
    return;
  }
  nextRoundShown = false; // reset guard for next match
  const fi = getActiveFaceIdx();
  const diffName = DIFFICULTY_NAMES[difficulty] ?? "Unbeatable";
  if (fi < 0) {
    msgEl.textContent = `X: ${score.X}  ·  O: ${score.O}  ·  First to 3`;
    return;
  }
  const face = faceStates[fi];
  if (face.winner === "draw") {
    msgEl.textContent = `Draw on this face  ·  X: ${score.X}  O: ${score.O}`;
  } else if (face.winner) {
    msgEl.textContent = `${face.winner} won this face  ·  X: ${score.X}  O: ${score.O}`;
  } else if (vsComputer) {
    msgEl.textContent = `${face.turn}'s turn  ·  AI: ${diffName}  ·  X: ${score.X}  O: ${score.O}`;
  } else {
    msgEl.textContent = `${face.turn}'s turn  ·  X: ${score.X}  O: ${score.O}`;
  }
}

/* ── Tick loop ── */
const clock = new THREE.Clock();
let prevT = 0;

function tick() {
  requestAnimationFrame(tick);
  const t = clock.getElapsedTime();
  const dt = Math.min(t - prevT, 0.05);
  prevT = t;

  // Detect match-over transition — fire once when match ends
  if (matchOver && !_wasMatchOver) {
    _wasMatchOver = true;
    _bgTarget.set(0x141425); // deep purple-navy — noticeable but not pitch-black
    showGameOver(matchWinner === "draw" ? "DRAW!" : `${matchWinner} WINS!`);
    showCeleb(matchWinner);
  }
  scene.background.lerp(_bgTarget, Math.min(1, dt * 1.2));

  updateCube(dt, t);
  updateTitle(dt, t);
  updateModel(dt);
  updateCeleb(dt);
  updateMessage();
  renderer.render(scene, camera);
}

tick();
