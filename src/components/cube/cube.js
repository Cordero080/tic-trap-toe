/* ── cube.js — all 3-D cube construction and per-frame updates ──
 *
 *  Owns everything visual about the cube: geometry, marks, slabs, confetti,
 *  won-face overlays, frame/corner color cycling, rotation, and the AI trigger.
 *
 *  Call order:
 *    initCube(scene, animateScoreCb)   — once at startup, builds all geometry
 *    updateCube(dt, t)                 — every frame inside tick()
 *    syncMarks()                       — after any makeMove() call
 *    onFaceWon(fi, ci)                 — when faceStates[fi].winner just became truthy
 *    triggerComputer(fi)               — schedules a 500ms-delayed AI move
 *    getActiveFaceIdx()                — returns index of face most facing camera (or -1)
 *    resetCubeVisuals()                — clears all marks, slabs, overlays
 *
 *  Exported refs (populated during initCube, read by background.js input handlers):
 *    hitPlaneMeshes   — raycaster targets (one invisible plane per cell × 6 faces)
 *    hoverMeshes      — one highlight quad per face, repositioned on hover
 * ── */

import * as THREE from "three";
import {
  WIN_COMBOS,
  faceStates,
  matchOver,
  makeMove,
  getComputerMove,
} from "./app.js";
import {
  playClick,
  playThud,
  playRobotVoice,
  playMatchWin,
  playPoof,
} from "./audio.js";

/* ── Board constants ── */
const S = 9;
const CELL = 2.5;
const GAP = 0.12;
const HALF = (3 * CELL + 2 * GAP) / 2; // ≈ 3.87
const OFS = CELL + GAP; // ≈ 2.62 — cell centre spacing
const LPOS = HALF - CELL - GAP / 2; // ≈ 1.31 — grid divider positions
const SLAB_DEPTH = 1.4; // full extrusion depth of cell slabs

/* ── Face normals in local space (index matches FACES array) ── */
const NORMALS = [
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
];

/* ── Face configs: euler rotation so local +Z faces outward ── */
const FACES = [
  { euler: [0, 0, 0], pos: [0, 0, S / 2] }, // front  +Z
  { euler: [0, Math.PI, 0], pos: [0, 0, -S / 2] }, // back   -Z
  { euler: [-Math.PI / 2, 0, 0], pos: [0, S / 2, 0] }, // top    +Y
  { euler: [Math.PI / 2, 0, 0], pos: [0, -S / 2, 0] }, // bottom -Y
  { euler: [0, Math.PI / 2, 0], pos: [S / 2, 0, 0] }, // right  +X
  { euler: [0, -Math.PI / 2, 0], pos: [-S / 2, 0, 0] }, // left   -X
];

/* ── Neon colors used for confetti particles ── */
const NEON = [
  0xff00ff, 0x00ffff, 0xffff00, 0xff4400, 0x44ff00, 0x0088ff, 0xff0088,
];

/* ── Module-level state — populated by initCube() ── */
let _scene = null;
let _animateScoreCb = null;
let cube = null;

// Exported: read by background.js input handlers
export const hitPlaneMeshes = [];
export const hoverMeshes = [];

// Internal per-face arrays
const frameMats = []; // rainbow frame segment materials (color-cycled per frame)
const cornerMats = []; // corner node materials (color-cycled per frame)
const faceGroups = []; // THREE.Group for each face
const faceMarks = Array.from({ length: 6 }, () => new Array(9).fill(null));
const cellSlabs = Array.from({ length: 6 }, () => new Array(9).fill(null));
const wonOverlays = []; // { mesh, mat, fg, t } — holographic won-face planes
const wonLines = []; // { mesh, mat, fg } — golden 3-D win bars
const confetti = []; // { mesh, mat, vel, rx, ry, rz, life, maxLife }
const shockwaves = []; // { mesh, mat, life, maxLife } — expanding draw rings

// Draw jiggle — 5 fast chirped X-axis shakes, gaps incrementally shorten
// jiggleT counts DOWN from JIGGLE_DUR to 0; active when > 0
const JIGGLE_DUR = 0.52;
let jiggleT = 0;

// Between-rounds free rotation — set true when matchOver, false on reset/next-round
let interactiveMode = false;

// Match-over rotation capture (reset each new game)
let matchOverT = -1;
let frozenRotY = 0;
let frozenRotX = 0;

// Accumulated Y rotation with direction flips
let rotY = 0;
let rotVelY = 0.22;
let _lockBlend = 0; // 0 = free spin, 1 = fully locked onto last face

// X-axis bias — shifts the center of the sine oscillation toward the top or
// bottom face when one of them is the last remaining active face.
// Positive = tilt toward bottom face, negative = tilt toward top face.
let xOffset = 0;

/* ── Dark-mode material refs — set by initCube, toggled by setDarkMode ── */
let _cubeFaceMats = null; // array of 6 MeshStandardMaterials (one per box face)
let _lineMat = null;

/* ── Cylinder helper — builds a capped cylinder between two points ── */
function cyl(a, b, mat, r = 0.06) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/* ── Mark builders ── */
function buildX() {
  const g = new THREE.Group();
  const len = CELL * 0.55;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.1,
    emissive: new THREE.Color(_isDark ? 0xcccccc : 0x000000),
    emissiveIntensity: _isDark ? 0.65 : 0,
  });
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 9), mat);
    m.rotation.z = angle;
    g.add(m);
  }
  return g;
}

function buildO() {
  const mat = new THREE.MeshStandardMaterial({
    color: _isDark ? 0xffffff : 0xddd0ff,
    roughness: 0.35,
    metalness: 0.1,
    emissive: new THREE.Color(_isDark ? 0xaaaaff : 0x000000),
    emissiveIntensity: _isDark ? 0.55 : 0,
  });
  return new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.28, 0.1, 14, 44), mat);
}

/* ── initCube — builds the entire cube scene graph ── */
export function initCube(scene, animateScoreCb) {
  _scene = scene;
  _animateScoreCb = animateScoreCb;

  /* Core cube box */
  cube = new THREE.Group();
  cube.position.y = -0.8; // nudge down so it sits centered between title and controls
  scene.add(cube);
  // 6 materials — one per BoxGeometry face (+X, -X, +Y, -Y, +Z, -Z)
  _cubeFaceMats = Array.from(
    { length: 6 },
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x020406,
        roughness: 0.65,
        metalness: 0.12,
      }),
  );
  cube.add(new THREE.Mesh(new THREE.BoxGeometry(S, S, S), _cubeFaceMats));

  /* Shared geometry / materials */
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ff });
  _lineMat = lineMat;
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hoverMat = new THREE.MeshBasicMaterial({
    color: 0x3513e1,
    transparent: true,
    opacity: 0.18,
  });
  const nodeGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const hitGeo = new THREE.PlaneGeometry(CELL - 0.08, CELL - 0.08);
  const hoverGeo = new THREE.PlaneGeometry(CELL - 0.14, CELL - 0.14);
  const slabGeo = new THREE.BoxGeometry(CELL - 0.18, CELL - 0.18, SLAB_DEPTH);

  /* Build all 6 faces */
  for (let fi = 0; fi < 6; fi++) {
    const cfg = FACES[fi];
    const fg = new THREE.Group();
    fg.position.set(...cfg.pos);
    fg.rotation.set(...cfg.euler);
    cube.add(fg);
    faceGroups.push(fg);

    const LZ = 0.02; // grid lines above face surface
    const FZ = 0.04; // frame bars
    const MZ = 0.08; // marks
    fg.userData.mz = MZ;

    /* Grid dividers */
    fg.add(
      cyl(
        new THREE.Vector3(-LPOS, -HALF, LZ),
        new THREE.Vector3(-LPOS, HALF, LZ),
        lineMat,
        0.05,
      ),
    );
    fg.add(
      cyl(
        new THREE.Vector3(LPOS, -HALF, LZ),
        new THREE.Vector3(LPOS, HALF, LZ),
        lineMat,
        0.05,
      ),
    );
    fg.add(
      cyl(
        new THREE.Vector3(-HALF, -LPOS, LZ),
        new THREE.Vector3(HALF, -LPOS, LZ),
        lineMat,
        0.05,
      ),
    );
    fg.add(
      cyl(
        new THREE.Vector3(-HALF, LPOS, LZ),
        new THREE.Vector3(HALF, LPOS, LZ),
        lineMat,
        0.05,
      ),
    );

    /* Rainbow frame bars + soft halo cylinders */
    const fc = [
      new THREE.Vector3(-HALF, -HALF, FZ),
      new THREE.Vector3(HALF, -HALF, FZ),
      new THREE.Vector3(HALF, HALF, FZ),
      new THREE.Vector3(-HALF, HALF, FZ),
    ];
    for (let i = 0; i < 4; i++) {
      const fm = new THREE.MeshBasicMaterial({ color: 0x5500ff });
      frameMats.push(fm);
      fg.add(cyl(fc[i], fc[(i + 1) % 4], fm, 0.09));

      const hm = new THREE.MeshBasicMaterial({
        color: 0x5500ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      frameMats.push(hm);
      fg.add(cyl(fc[i], fc[(i + 1) % 4], hm, 0.165));
    }

    /* Corner nodes */
    for (let i = 0; i < 4; i++) {
      const nm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      cornerMats.push(nm);
      const m = new THREE.Mesh(nodeGeo, nm);
      m.position.copy(fc[i]);
      fg.add(m);
    }

    /* Hit planes — invisible raycaster targets, one per cell */
    for (let ci = 0; ci < 9; ci++) {
      const r = Math.floor(ci / 3),
        c = ci % 3;
      const hp = new THREE.Mesh(hitGeo, hitMat);
      hp.position.set((c - 1) * OFS, (1 - r) * OFS, LZ + 0.01);
      hp.userData = { fi, ci };
      fg.add(hp);
      hitPlaneMeshes.push(hp);
    }

    /* Cell slabs — extrude outward when a mark is placed */
    for (let ci = 0; ci < 9; ci++) {
      const r = Math.floor(ci / 3),
        c = ci % 3;
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd0cfe8,
        metalness: 0.92,
        roughness: 0.08,
        transparent: true,
        opacity: 0,
      });
      const slab = new THREE.Mesh(slabGeo, mat);
      slab.position.set((c - 1) * OFS, (1 - r) * OFS, SLAB_DEPTH / 2);
      slab.scale.z = 0.001;
      fg.add(slab);
      cellSlabs[fi][ci] = { mesh: slab, mat, t: 0, target: 0 };
    }

    /* Hover highlight — one per face, repositioned on mousemove */
    const hv = new THREE.Mesh(hoverGeo, hoverMat);
    hv.position.z = 0.06;
    hv.visible = false;
    fg.add(hv);
    hoverMeshes.push(hv);
  }
}

/* ── syncMarks — mirrors app.js faceStates into 3-D mark meshes ── */
export function syncMarks() {
  for (let fi = 0; fi < 6; fi++) {
    const state = faceStates[fi];
    const fg = faceGroups[fi];
    for (let ci = 0; ci < 9; ci++) {
      const val = state.board[ci];
      const existing = faceMarks[fi][ci];
      if (val && !existing) {
        const mesh = val === "X" ? buildX() : buildO();
        const r = Math.floor(ci / 3),
          c = ci % 3;
        mesh.position.set((c - 1) * OFS, (1 - r) * OFS, 0.04);
        mesh.scale.setScalar(0.01);
        fg.add(mesh);
        faceMarks[fi][ci] = { mesh, s: 0.01 };
        // Activate slab extrusion + click sound
        const slab = cellSlabs[fi][ci];
        if (slab) {
          if (_isDark) {
            slab.mat.color.set(val === "X" ? 0xfaf8ff : 0xeaf4ff);
            slab.mat.emissive = new THREE.Color(
              val === "X" ? 0x666666 : 0x224466,
            );
            slab.mat.emissiveIntensity = 0.45;
          } else {
            slab.mat.color.set(val === "X" ? 0xe8e4ff : 0xd4eeff);
          }
          slab.target = 0.45;
        }
        playClick();
      } else if (!val && existing) {
        fg.remove(existing.mesh);
        faceMarks[fi][ci] = null;
      }
    }
  }
}

/* ── Face visibility helper ── */
const CLICK_THRESHOLD = 0.08;
const _wn = new THREE.Vector3();

function getFaceDot(fi) {
  return _wn.copy(NORMALS[fi]).applyQuaternion(cube.quaternion).z;
}

export function getActiveFaceIdx() {
  let best = -1,
    bestDot = CLICK_THRESHOLD;
  for (let fi = 0; fi < 6; fi++) {
    const d = getFaceDot(fi);
    if (d > bestDot) {
      bestDot = d;
      best = fi;
    }
  }
  return best;
}

/* ── spawnConfetti — 44 neon particles burst from the winning cell in world space ── */
function spawnConfetti(fi, ci) {
  cube.updateWorldMatrix(true, true);
  const r = Math.floor(ci / 3),
    c = ci % 3;
  const cellPos = new THREE.Vector3((c - 1) * OFS, (1 - r) * OFS, 0.08);
  faceGroups[fi].localToWorld(cellPos);
  const faceNormal = NORMALS[fi].clone().applyQuaternion(cube.quaternion);

  for (let i = 0; i < 44; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: NEON[Math.floor(Math.random() * NEON.length)],
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(
        0.12 + Math.random() * 0.42,
        0.07 + Math.random() * 0.26,
      ),
      mat,
    );
    mesh.position.copy(cellPos);
    mesh.position.x += (Math.random() - 0.5) * 0.6;
    mesh.position.y += (Math.random() - 0.5) * 0.6;
    mesh.rotation.set(
      Math.random() * 6.28,
      Math.random() * 6.28,
      Math.random() * 6.28,
    );
    _scene.add(mesh);

    const speed = 5 + Math.random() * 10;
    const vel = faceNormal.clone().multiplyScalar(speed);
    vel.x += (Math.random() - 0.5) * 6;
    vel.y += (Math.random() - 0.5) * 6 + 1.5;
    vel.z += (Math.random() - 0.5) * 6;

    confetti.push({
      mesh,
      mat,
      vel,
      rx: (Math.random() - 0.5) * 13,
      ry: (Math.random() - 0.5) * 13,
      rz: (Math.random() - 0.5) * 13,
      life: 0,
      maxLife: 1.0 + Math.random() * 0.9,
    });
  }
}

/* ── buildWinLine — 3-D golden bar spanning the three winning cells ──
 *  Starts at face surface; updateCube() lifts it each frame to ride on top of
 *  the winning mark meshes as the slabs animate outward.
 * ── */
function buildWinLine(combo, fg, fi) {
  const [a, , c] = combo;
  const ra = Math.floor(a / 3),
    ca = a % 3;
  const rc = Math.floor(c / 3),
    cc = c % 3;

  const ax = (ca - 1) * OFS,
    ay = (1 - ra) * OFS;
  const cx = (cc - 1) * OFS,
    cy = (1 - rc) * OFS;

  const mx = (ax + cx) / 2,
    my = (ay + cy) / 2;
  const ext = 1.22;
  const p1 = new THREE.Vector3(
    mx + (ax - mx) * ext,
    my + (ay - my) * ext,
    0.12,
  );
  const p2 = new THREE.Vector3(
    mx + (cx - mx) * ext,
    my + (cy - my) * ext,
    0.12,
  );

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.85,
    roughness: 0.08,
    emissive: new THREE.Color(0xff8800),
    emissiveIntensity: 0.7,
  });

  const bar = cyl(p1, p2, mat, 0.13);
  fg.add(bar);
  // fi + cellA let updateCube() read that slab's scale each frame to lift the bar
  wonLines.push({ mesh: bar, mat, fg, fi, cellA: a });
}

/* ── applyWonFaceVisuals — holographic overlay + red/black mark styling ── */
function applyWonFaceVisuals(fi) {
  const fg = faceGroups[fi];
  const board = faceStates[fi].board;

  // Find winning cell indices
  const winSet = new Set();
  for (const [a, b, c] of WIN_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      winSet.add(a);
      winSet.add(b);
      winSet.add(c);
      buildWinLine([a, b, c], fg, fi);
      break;
    }
  }

  // Holographic metallic white plane — fades in over time, HSL-cycles in updateCube()
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf8f6ff,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(S - 0.08, S - 0.08), mat);
  mesh.position.z = 0.018;
  fg.add(mesh);
  wonOverlays.push({ mesh, mat, fg, t: 0 });

  // Style marks: winners → vivid red + emissive; losers → black
  for (let ci = 0; ci < 9; ci++) {
    const mark = faceMarks[fi][ci];
    const slab = cellSlabs[fi][ci];
    const isWinner = winSet.has(ci);
    if (mark) {
      mark.mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          if (isWinner) {
            child.material.color.set(0xff1a00);
            child.material.emissive = new THREE.Color(0x991000);
            child.material.emissiveIntensity = 0.55;
          } else {
            child.material.color.set(0x111111);
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      });
    }
    if (slab && isWinner) {
      // Winning slabs punch to full depth in jet black metallic
      slab.mat.color.set(0x080808);
      slab.mat.metalness = 0.98;
      slab.mat.roughness = 0.02;
      slab.target = 1.0;
    }
  }
}

/* ── onFaceWon — called by background.js after makeMove() reveals a winner ── */
export function onFaceWon(fi, ci) {
  const winner = faceStates[fi].winner;
  if (!winner || winner === "draw") return;
  spawnConfetti(fi, ci);
  applyWonFaceVisuals(fi);
  // Fire audio immediately — no waiting for score scramble
  if (matchOver) {
    playMatchWin();
    playRobotVoice(true);
  } else {
    playThud();
    playRobotVoice(false);
  }
  _animateScoreCb(winner);
}

/* ── onFaceDraw — shockwave + gravitational bounce when a face ties ── */
export function onFaceDraw(fi) {
  cube.updateWorldMatrix(true, true);
  const faceNormal = NORMALS[fi].clone().applyQuaternion(cube.quaternion);
  const faceCenter = new THREE.Vector3();
  faceGroups[fi].getWorldPosition(faceCenter);

  // Three rings burst outward from the face surface, staggered in time.
  // Each ring starts at ~face size (scale 1 = S/2 radius) and expands to 3×.
  // Offset slightly along face normal so they sit just above the face surface.
  const surfaceOffset = faceNormal.clone().multiplyScalar(0.25);
  for (let i = 0; i < 3; i++) {
    const colors = [0xffffff, 0xaaaaff, 0x6655ff];
    const mat = new THREE.MeshBasicMaterial({
      color: colors[i],
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    // Ring sized to roughly match the face — inner/outer give it visible thickness
    const geo = new THREE.RingGeometry(S * 0.28, S * 0.42, 48);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(faceCenter).add(surfaceOffset);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceNormal);
    _scene.add(mesh);
    shockwaves.push({ mesh, mat, life: -i * 0.1, maxLife: 0.55 });
  }

  // Trigger 5-jiggle chirp shake
  jiggleT = JIGGLE_DUR;
  playPoof();
}

/* ── triggerComputer — schedules AI move 500 ms after the player's move ── */
export function triggerComputer(fi) {
  setTimeout(() => {
    const prevWinner = faceStates[fi].winner;
    const move = getComputerMove(fi);
    if (move >= 0) {
      makeMove(fi, move);
      syncMarks();
      if (!prevWinner && faceStates[fi].winner) {
        if (faceStates[fi].winner === "draw") onFaceDraw(fi);
        else onFaceWon(fi, move);
      }
    }
  }, 500);
}

/* ── resetCubeVisuals — clears all 3-D state, called from reset button handler ── */
export function resetCubeVisuals() {
  // Remove all mark meshes
  for (let fi = 0; fi < 6; fi++) {
    for (let ci = 0; ci < 9; ci++) {
      const m = faceMarks[fi][ci];
      if (m) {
        faceGroups[fi].remove(m.mesh);
        faceMarks[fi][ci] = null;
      }
    }
  }

  // Reset cell slabs to invisible collapsed state
  for (const row of cellSlabs) {
    for (const slab of row) {
      if (!slab) continue;
      slab.t = 0;
      slab.target = 0;
      slab.mesh.scale.z = 0.001;
      slab.mesh.position.z = SLAB_DEPTH / 2;
      slab.mat.opacity = 0;
      slab.mat.color.set(0xd0cfe8);
      slab.mat.metalness = 0.92;
      slab.mat.roughness = 0.08;
    }
  }

  // Remove holographic won-face overlays and dispose GPU resources
  for (const o of wonOverlays) {
    o.fg.remove(o.mesh);
    o.mat.dispose();
    o.mesh.geometry.dispose();
  }
  wonOverlays.length = 0;

  // Remove golden win-line bars
  for (const l of wonLines) {
    l.fg.remove(l.mesh);
    l.mat.dispose();
    l.mesh.geometry.dispose();
  }
  wonLines.length = 0;

  // Clean up draw shockwaves
  for (const sw of shockwaves) {
    _scene.remove(sw.mesh);
    sw.mat.dispose();
    sw.mesh.geometry.dispose();
  }
  shockwaves.length = 0;

  // Reset jiggle
  jiggleT = 0;
  cube.position.x = 0;

  // Reset match-over rotation capture and accumulated spin state
  matchOverT = -1;
  rotY = 0;
  rotVelY = 0.22;
  xOffset = 0;
  _lockBlend = 0;

  hoverMeshes.forEach((hv) => {
    hv.visible = false;
  });

  // Exit interactive mode so auto-rotation resumes on the new round
  interactiveMode = false;
}

/* ── setInteractiveMode / applyDrag — free-rotation between rounds ── */
export function setInteractiveMode(on) {
  interactiveMode = on;
}

// dx/dy in pixels; sensitivity converts to radians. Rotates around world axes
// (horizontal drag = Y axis, vertical drag = X axis) for a natural trackball feel.
export function applyDrag(dx, dy) {
  const s = 0.006; // rad per pixel — tweak for feel
  const qY = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    dx * s,
  );
  const qX = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    dy * s,
  );
  cube.quaternion.premultiply(qY).premultiply(qX);
}

/* ── setDarkMode — each face gets a unique color in dark mode ── */
const DARK_FACE_COLORS = [
  0x2a0a1a, // +X right  — deep wine
  0x0a1a2a, // -X left   — deep navy
  0x1a0a2a, // +Y top    — deep violet
  0x0a2a1a, // -Y bottom — deep emerald
  0x2a1a0a, // +Z front  — deep amber
  0x0a1020, // -Z back   — deep slate
];
let _isDark = false;
export function setDarkMode(dark) {
  _isDark = dark;
  if (_cubeFaceMats) {
    for (let i = 0; i < 6; i++) {
      _cubeFaceMats[i].color.set(dark ? DARK_FACE_COLORS[i] : 0x020406);
      _cubeFaceMats[i].metalness = dark ? 0.7 : 0.12;
      _cubeFaceMats[i].roughness = dark ? 0.25 : 0.65;
    }
  }
  if (_lineMat) _lineMat.color.set(dark ? 0xeeeadf : 0xf2f2ff);
}

/* ── updateCube — called every frame from tick() ──
 *
 *  Handles:
 *  - Cube rotation (normal spin vs. match-over deceleration + pulse)
 *  - Frame and corner rainbow color cycling
 *  - Mark pop-in scale animation
 *  - Cell slab extrusion animation (cubic ease-out)
 *  - Won-face holographic overlay fade-in + HSL cycle
 *  - Confetti particle physics (velocity, gravity, fade-out)
 * ── */
export function updateCube(dt, t) {
  /* Cube rotation — skipped entirely when user is in free-rotate mode */
  if (interactiveMode) {
    // quaternion is driven by applyDrag(); just ensure scale is neutral
    cube.scale.setScalar(1);
  } else if (matchOver) {
    if (matchOverT < 0) {
      // Capture rotation at the exact moment of match win
      matchOverT = t;
      frozenRotY = rotY;
      frozenRotX = cube.rotation.x;
      // Snap jiggle back to rest immediately
      jiggleT = 0;
      cube.position.x = 0;
    }
    const age = t - matchOverT;
    const slow = Math.exp(-age * 2.0); // exponential deceleration
    cube.rotation.y = frozenRotY + age * 0.22 * slow;
    cube.rotation.x = frozenRotX * Math.exp(-age * 2.5); // eases back to level
    // Damped scale pulse — two quick thumps then settles
    const pulse = 1 + 0.11 * Math.sin(age * 16) * Math.exp(-age * 4.5);
    cube.scale.setScalar(pulse);
  } else {
    matchOverT = -1;

    // Collect indices of faces still in play (no winner, no draw)
    const activeIdxs = faceStates.reduce((acc, f, i) => {
      if (!f.winner) acc.push(i);
      return acc;
    }, []);
    const activeCount = activeIdxs.length; // used for X tilt and xBias below

    // ── Tiered rotation ───────────────────────────────────────────────────────
    // Tier 3 (1 face left)  : spring-lock onto the face + gentle breath idle
    // Tier 2 (2 faces left) : 2× speed, strong steer between the remaining two
    // Tier 1 (3+ faces left): natural spin with mild bias toward unfinished faces
    const tier = activeCount <= 1 ? 3 : activeCount === 2 ? 2 : 1;
    _lockBlend += ((tier === 3 ? 1 : 0) - _lockBlend) * Math.min(1, 1.5 * dt);

    if (tier === 3) {
      const fi = activeIdxs[0];
      const isTopBottom = fi === 2 || fi === 3;

      // Side faces: swing Y to point the face at the camera.
      // Top/bottom: Y is irrelevant — round to nearest π/2 so it stops cleanly.
      const idealY = isTopBottom
        ? Math.round(rotY / (Math.PI / 2)) * (Math.PI / 2)
        : -Math.atan2(NORMALS[fi].x, NORMALS[fi].z);
      const idealX = fi === 2 ? -Math.PI / 2 : fi === 3 ? Math.PI / 2 : 0;

      // Overdamped angular spring on Y — settles without bouncing
      const errY =
        ((((idealY - rotY) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) -
        Math.PI;
      rotVelY += (errY * 3.0 - rotVelY * 4.5) * dt;
      rotY += rotVelY * dt;

      // Gentle breath once locked — ±5° slow rock so the cube stays alive
      const breathY = Math.sin(t * 0.31) * 0.06 * _lockBlend;
      const breathX = Math.sin(t * 0.19) * 0.04 * _lockBlend;
      cube.rotation.y = rotY + breathY;

      // X: big sine fades out, angle springs toward ideal + breath
      xOffset += (idealX - xOffset) * Math.min(1, 2.5 * dt);
      cube.rotation.x =
        Math.sin(t * 0.13) * 1.1 * (1 - _lockBlend) + xOffset + breathX;

      // Z: fade to zero as lock engages
      cube.rotation.z =
        (Math.sin(t * 0.07) * 0.22 + Math.sin(t * 0.19) * 0.1) *
        (1 - _lockBlend);
    } else {
      // ── Tier 1 / 2 ────────────────────────────────────────────────────────
      const speed = tier === 2 ? 0.44 : 0.22;
      const baseVel = speed * (Math.sign(Math.sin(t * 0.09)) || 1);
      let effectiveVel = baseVel;

      if (tier === 2) {
        // Steer toward whichever of the 2 remaining faces is angularly nearest
        let minErr = Infinity;
        for (const fi of activeIdxs) {
          const ideal = -Math.atan2(NORMALS[fi].x, NORMALS[fi].z);
          const err =
            ((((ideal - rotY) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) -
            Math.PI;
          if (Math.abs(err) < Math.abs(minErr)) minErr = err;
        }
        if (Math.abs(minErr) > 0.3) {
          effectiveVel = baseVel * 0.15 + Math.sign(minErr) * speed * 0.85;
        }
      } else {
        // Tier 1: mild side-face bias when ≤2 side faces remain
        const sideActive = activeIdxs.filter((i) => i !== 2 && i !== 3);
        if (sideActive.length >= 1 && sideActive.length <= 2) {
          let minErr = Infinity;
          for (const fi of sideActive) {
            const ideal = -Math.atan2(NORMALS[fi].x, NORMALS[fi].z);
            const err =
              ((((ideal - rotY) % (2 * Math.PI)) + 3 * Math.PI) %
                (2 * Math.PI)) -
              Math.PI;
            if (Math.abs(err) < Math.abs(minErr)) minErr = err;
          }
          const steerW = sideActive.length === 1 ? 0.88 : 0.55;
          if (Math.abs(minErr) > 0.35) {
            effectiveVel =
              baseVel * (1 - steerW) + Math.sign(minErr) * 0.22 * steerW;
          }
        }
      }

      rotVelY += (effectiveVel - rotVelY) * Math.min(1, 8.0 * dt);
      rotY += rotVelY * dt;
      cube.rotation.y = rotY;

      // X bias toward whichever top/bottom face is still active
      const bottomActive = activeIdxs.includes(3);
      const topActive = activeIdxs.includes(2);
      const xBias = [0, 0.8, 0.55, 0.3][activeCount] ?? 0;
      const targetXOffset =
        bottomActive && !topActive
          ? xBias
          : topActive && !bottomActive
            ? -xBias
            : 0;
      xOffset += (targetXOffset - xOffset) * Math.min(1, 3.0 * dt);
      cube.rotation.x = Math.sin(t * 0.13) * 1.1 + xOffset;
      cube.rotation.z = Math.sin(t * 0.07) * 0.22 + Math.sin(t * 0.19) * 0.1;
    }
  }

  /* Rainbow frame + corner color cycling */
  const col = new THREE.Color();
  const h = (t * 0.08) % 1;
  if (_isDark) {
    // Dark mode: keep rainbow cycling but slightly desaturated for elegance
    frameMats.forEach((fm, i) => {
      col.setHSL((h + i * 0.04) % 1, 0.85, 0.5);
      fm.color.copy(col);
    });
    cornerMats.forEach((cm, i) => {
      col.setHSL((h + i * 0.12) % 1, 0.85, 0.6);
      cm.color.copy(col);
    });
  } else {
    frameMats.forEach((fm, i) => {
      col.setHSL((h + i * 0.04) % 1, 1.0, 0.5);
      fm.color.copy(col);
    });
    cornerMats.forEach((cm, i) => {
      col.setHSL((h + i * 0.12) % 1, 1.0, 0.6);
      cm.color.copy(col);
    });
  }

  /* Mark pop-in + ride on slab front face */
  for (let fi = 0; fi < 6; fi++) {
    for (let ci = 0; ci < 9; ci++) {
      const mark = faceMarks[fi][ci];
      if (!mark) continue;
      if (mark.s < 1) {
        mark.s = Math.min(1, mark.s + 0.065);
        mark.mesh.scale.setScalar(mark.s);
      }
      const slab = cellSlabs[fi][ci];
      if (slab) {
        mark.mesh.position.z = SLAB_DEPTH * slab.mesh.scale.z + 0.04;
      }
    }
  }

  /* Cell slab extrusion — cubic ease-out toward target scale */
  for (const row of cellSlabs) {
    for (const slab of row) {
      if (!slab || slab.target === 0) continue;
      slab.t = Math.min(1, slab.t + dt * 4);
      const ease = 1 - Math.pow(1 - slab.t, 3);
      const ext = ease * slab.target;
      slab.mesh.scale.z = Math.max(0.001, ext);
      slab.mesh.position.z = (SLAB_DEPTH / 2) * Math.max(0.001, ext);
      slab.mat.opacity = ease * 0.9;
    }
  }

  /* Win line — tracks the winning slab's z so the bar rides on top of the marks */
  for (const l of wonLines) {
    const slab = cellSlabs[l.fi][l.cellA];
    if (slab) {
      // Mark z = SLAB_DEPTH * slab scale + 0.04 (mark offset) + 0.1 (bar sits just above)
      l.mesh.position.z = SLAB_DEPTH * slab.mesh.scale.z + 0.14;
    }
  }

  /* Won-face holographic overlay — fade in + HSL color cycle */
  for (const o of wonOverlays) {
    o.t += dt;
    o.mat.opacity = Math.min(0.72, o.t * 0.9);
    col.setHSL((t * 0.12 + o.t * 0.3) % 1, 0.9, 0.82);
    o.mat.color.copy(col);
  }

  /* Draw jiggle — chirped sine on X axis: 5 quick shakes, gaps shorten over time */
  if (jiggleT > 0 && !matchOver) {
    jiggleT = Math.max(0, jiggleT - dt);
    const el = JIGGLE_DUR - jiggleT; // elapsed 0 → JIGGLE_DUR
    // Chirp: phase = 20t + 28t² → frequency rises so peaks bunch up toward the end
    // envelope: exp(-7t) so amplitude drops to ~2% by t=0.52
    cube.position.x =
      0.6 * Math.sin(20 * el + 28 * el * el) * Math.exp(-7 * el);
  } else if (!matchOver) {
    jiggleT = 0;
    cube.position.x = 0;
  }

  /* Shockwave rings — expand outward and fade on draw */
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life += dt;
    if (sw.life < 0) continue; // staggered delay not yet reached
    const p = sw.life / sw.maxLife;
    // Start at face size (scale 1) and expand to 3× — clearly coming off the surface
    sw.mesh.scale.setScalar(1 + p * 2.2);
    // Fade out — bright at start, gone by end
    sw.mat.opacity = Math.max(0, (1 - p) * 0.85);
    if (sw.life >= sw.maxLife) {
      _scene.remove(sw.mesh);
      sw.mat.dispose();
      sw.mesh.geometry.dispose();
      shockwaves.splice(i, 1);
    }
  }

  /* Confetti particle simulation — velocity integration + gravity + fade */
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.life += dt;
    p.vel.y -= 11 * dt; // gravity
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += p.rx * dt;
    p.mesh.rotation.y += p.ry * dt;
    p.mesh.rotation.z += p.rz * dt;
    p.mat.opacity = Math.max(0, 1 - p.life / p.maxLife);
    if (p.life >= p.maxLife) {
      _scene.remove(p.mesh);
      p.mat.dispose();
      p.mesh.geometry.dispose();
      confetti.splice(i, 1);
    }
  }
}
