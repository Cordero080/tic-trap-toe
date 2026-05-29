/* ── title.js — 3-D extruded title mesh ──
 *
 *  Uses Three.js FontLoader + TextGeometry to render "TIC-TRAP-TOE" as a real
 *  extruded 3-D mesh above the cube.
 *
 *  Two-material trick: TextGeometry assigns group 0 to front/back faces and
 *  group 1 to the extruded sides. Passing an array [frontMat, sideMat] gives
 *  the sides a visually distinct color so depth is obvious at a glance.
 *
 *  Slight X tilt (instead of pure lookAt) leans the top toward the camera so
 *  the top face of every letter stroke is visible — that's the foreshortening.
 *
 *  Usage:
 *    initTitle(scene, camera)   — call once at startup; loads font async
 *    updateTitle(t)             — call every frame inside tick()
 *
 *  To swap fonts later:
 *    1. Go to gero3.github.io/facetype.js, upload PressStart2P-Regular.ttf
 *    2. Download the JSON → save as css/fonts/PressStart2P.typeface.json
 *    3. Change the URL in initTitle() below to './css/fonts/PressStart2P.typeface.json'
 * ── */

import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader";
import { TextGeometry } from "three/addons/geometries/TextGeometry";

let titleMesh = null; // THREE.Group holding per-letter meshes
let _camera = null;
let _letterMats = []; // [ { front, side }, ... ] one per character
let _pendingDark = false;
let _titleSpot = null;
let _titleRim = null;
let _titleShaper = null;
let _titleNaturalWidth = 0; // bounding-box width at scale=1
let _scene = null;
let _font = null; // cached font for game-over text reuse

// Game-over text state
let _gameOverGroup = null;
let _gameOverMats = [];
let _gameOverOpacity = 0;
let _gameOverTarget = 0;
let _pendingGameOver = null;
let _gameOverNaturalWidth = 0;

// Dark-mode letter colors — matching the 6 cube face colors, brighter for title
const DARK_LETTER_COLORS = [
  // T   I   C   -   T   R   A   P   -   T   O   E
  { front: 0xe04848, side: 0xee6666, emissive: 0x882020 }, // crimson
  { front: 0x30b8cc, side: 0x50ccdd, emissive: 0x126070 }, // teal
  { front: 0xc048b8, side: 0xd060c8, emissive: 0x782060 }, // plum
  { front: 0xdd9e40, side: 0xeebb55, emissive: 0x8a6018 }, // bronze
  { front: 0x30cc5c, side: 0x50dd7c, emissive: 0x127830 }, // forest
  { front: 0xe04848, side: 0xee6666, emissive: 0x882020 }, // crimson
  { front: 0x4868d8, side: 0x6888ee, emissive: 0x1c3898 }, // midnight
  { front: 0xc048b8, side: 0xd060c8, emissive: 0x782060 }, // plum
  { front: 0xdd9e40, side: 0xeebb55, emissive: 0x8a6018 }, // bronze
  { front: 0x30b8cc, side: 0x50ccdd, emissive: 0x126070 }, // teal
  { front: 0x30cc5c, side: 0x50dd7c, emissive: 0x127830 }, // forest
  { front: 0x4868d8, side: 0x6888ee, emissive: 0x1c3898 }, // midnight
];

export function initTitle(scene, camera) {
  _scene = scene;
  _camera = camera;

  // Spotlight from above — hard cone creates strong shadow under each letter's
  // top overhang, defining the extrusion depth dramatically
  const spot = new THREE.SpotLight(0xffffff, 6.0);
  spot.position.set(0, 22, 18);
  spot.angle = Math.PI / 7;
  spot.penumbra = 0.25;
  spot.decay = 1.2;
  spot.target.position.set(0, 10, 2);
  scene.add(spot);
  scene.add(spot.target);
  _titleSpot = spot;

  // Rim light from the left — grazes the right-side bevel edges
  const rimLeft = new THREE.DirectionalLight(0xffffff, 1.8);
  rimLeft.position.set(-18, 4, 10);
  scene.add(rimLeft);
  _titleRim = rimLeft;

  // Directional from upper-right — creates bright top-right on each letter face
  // and darker bottom-left, giving the front face shape and volume
  const shaper = new THREE.DirectionalLight(0xddccff, 2.4);
  shaper.position.set(12, 18, 20);
  scene.add(shaper);
  _titleShaper = shaper;

  const fontLoader = new FontLoader();
  fontLoader.load(
    "https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json",
    (font) => {
      _font = font;
      const TITLE = "TIC-TRAP-TOE";
      const group = new THREE.Group();
      _letterMats = [];

      // Build each letter as its own mesh
      let xCursor = 0;
      const letterMeshes = [];
      for (let i = 0; i < TITLE.length; i++) {
        const ch = TITLE[i];
        const geo = new TextGeometry(ch, {
          font,
          size: 1.5,
          height: 0.7,
          bevelEnabled: true,
          bevelThickness: 0.08,
          bevelSize: 0.06,
          bevelSegments: 6,
        });
        geo.computeBoundingBox();
        const w = geo.boundingBox.max.x - geo.boundingBox.min.x;

        const dc = DARK_LETTER_COLORS[i % DARK_LETTER_COLORS.length];
        const frontMat = new THREE.MeshStandardMaterial({
          color: dc.front,
          metalness: 0.5,
          roughness: 0.3,
          emissive: new THREE.Color(dc.emissive),
          emissiveIntensity: 0.5,
        });
        const sideMat = new THREE.MeshStandardMaterial({
          color: dc.side,
          metalness: 0.55,
          roughness: 0.2,
          emissive: new THREE.Color(dc.emissive),
          emissiveIntensity: 0.4,
        });
        _letterMats.push({ front: frontMat, side: sideMat });

        const mesh = new THREE.Mesh(geo, [frontMat, sideMat]);
        mesh.position.x = xCursor;
        group.add(mesh);
        letterMeshes.push(mesh);

        xCursor += w + 0.12; // letter spacing
      }

      // Center the whole group
      const groupBox = new THREE.Box3().setFromObject(group);
      const cx = -(groupBox.max.x - groupBox.min.x) / 2 - groupBox.min.x;
      const cy = -(groupBox.max.y - groupBox.min.y) / 2 - groupBox.min.y;
      group.children.forEach((m) => {
        m.position.x += cx;
        m.position.y += cy;
      });

      group.position.set(0, 10, 2);
      scene.add(group);
      titleMesh = group;

      // Store natural (scale=1) width so resizeTitle() can compute the right factor
      const fullBox = new THREE.Box3().setFromObject(group);
      _titleNaturalWidth = fullBox.max.x - fullBox.min.x;
      resizeTitle();

      // Apply queued dark-mode state now that materials exist
      if (_pendingDark) setDarkMode(true);
      if (_pendingGameOver) buildGameOverMesh(_pendingGameOver);
    },
  );
}

/* ── buildGameOverMesh — creates the 3-D "X WINS!" / "DRAW!" overlay ── */
function buildGameOverMesh(text) {
  if (_gameOverGroup) {
    _scene.remove(_gameOverGroup);
    _gameOverGroup = null;
  }
  _gameOverMats = [];
  _gameOverOpacity = 0;
  _pendingGameOver = null;

  const group = new THREE.Group();
  let xCursor = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const geo = new TextGeometry(ch, {
      font: _font,
      size: 2.0,
      height: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 5,
    });
    geo.computeBoundingBox();
    const w = geo.boundingBox.max.x - geo.boundingBox.min.x;

    const dc = DARK_LETTER_COLORS[i % DARK_LETTER_COLORS.length];
    const frontMat = new THREE.MeshStandardMaterial({
      color: dc.front,
      emissive: new THREE.Color(dc.emissive),
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: dc.side,
      emissive: new THREE.Color(dc.emissive),
      emissiveIntensity: 0.4,
      metalness: 0.55,
      roughness: 0.2,
      transparent: true,
      opacity: 0,
    });
    _gameOverMats.push(frontMat, sideMat);

    const mesh = new THREE.Mesh(geo, [frontMat, sideMat]);
    mesh.position.x = xCursor;
    group.add(mesh);
    xCursor += w + 0.15;
  }

  // Center the group
  const box = new THREE.Box3().setFromObject(group);
  const cx = -(box.max.x - box.min.x) / 2 - box.min.x;
  const cy = -(box.max.y - box.min.y) / 2 - box.min.y;
  group.children.forEach((m) => {
    m.position.x += cx;
    m.position.y += cy;
  });

  group.position.set(0, 10, 2);
  group.rotation.x = 0.22; // match title tilt
  group.visible = false;
  _gameOverGroup = group;
  _scene.add(group);

  const goBox = new THREE.Box3().setFromObject(group);
  _gameOverNaturalWidth = goBox.max.x - goBox.min.x;
  resizeGameOver();

  // Hide the title so game-over text takes its place cleanly
  if (titleMesh) titleMesh.visible = false;
}

function resizeGameOver() {
  if (!_camera || !_gameOverGroup || _gameOverNaturalWidth === 0) return;
  const dist = _camera.position.z - _gameOverGroup.position.z;
  const halfW =
    dist * Math.tan((_camera.fov * Math.PI) / 180 / 2) * _camera.aspect;
  const visibleWidth = halfW * 2;
  // Same formula as resizeTitle so it occupies the same horizontal footprint
  const s = Math.min(1.0, (visibleWidth * 0.88) / _gameOverNaturalWidth);
  _gameOverGroup.scale.setScalar(s);
}

export function showGameOver(text) {
  _gameOverTarget = 1;
  if (titleMesh) titleMesh.visible = false;
  if (_font) buildGameOverMesh(text);
  else _pendingGameOver = text;
}

export function hideGameOver() {
  _gameOverTarget = 0;
  _pendingGameOver = null;
  _gameOverOpacity = 0;
  _gameOverMats.forEach((m) => {
    m.opacity = 0;
  });
  if (_gameOverGroup) _gameOverGroup.visible = false;
  if (titleMesh) titleMesh.visible = true;
}

export function updateTitle(dt, t) {
  if (!titleMesh) return;
  titleMesh.position.y = 10 + Math.sin(t * 1.1) * 0.18;
  titleMesh.rotation.x = 0.22;

  // Animate game-over text opacity
  if (_gameOverGroup) {
    const step = 1 - Math.exp(-dt * 2.0);
    _gameOverOpacity += (_gameOverTarget - _gameOverOpacity) * step;
    const visible = _gameOverOpacity > 0.005;
    _gameOverGroup.visible = visible;
    if (visible) {
      _gameOverMats.forEach((m) => {
        m.opacity = _gameOverOpacity;
      });
      _gameOverGroup.position.y = 10 + Math.sin(t * 1.1) * 0.18;
    }
  }
}

export function resizeTitle() {
  if (!_camera || !titleMesh || _titleNaturalWidth === 0) return;
  const dist = _camera.position.z - titleMesh.position.z;
  const halfW =
    dist * Math.tan((_camera.fov * Math.PI) / 180 / 2) * _camera.aspect;
  const visibleWidth = halfW * 2;
  const s = Math.min(1.0, (visibleWidth * 0.88) / _titleNaturalWidth);
  titleMesh.scale.setScalar(s);
  resizeGameOver();
}

/* ── setDarkMode — per-letter colors + dramatic spotlight in dark mode ── */
export function setDarkMode(dark) {
  _pendingDark = dark;
  // Spotlight: bright and focused in dark, normal in light
  if (_titleSpot) {
    _titleSpot.intensity = dark ? 12.0 : 6.0;
    _titleSpot.angle = dark ? Math.PI / 9 : Math.PI / 7;
    _titleSpot.penumbra = dark ? 0.6 : 0.25;
    _titleSpot.color.set(dark ? 0xccbbff : 0xffffff);
  }
  // Dim fill lights in dark mode so spotlight dominates
  if (_titleRim) _titleRim.intensity = dark ? 0.4 : 1.8;
  if (_titleShaper) _titleShaper.intensity = dark ? 0.6 : 2.4;

  for (let i = 0; i < _letterMats.length; i++) {
    const { front, side } = _letterMats[i];
    if (dark) {
      const dc = DARK_LETTER_COLORS[i % DARK_LETTER_COLORS.length];
      front.color.set(dc.front);
      front.emissive.set(dc.emissive);
      front.emissiveIntensity = 0.5;
      front.metalness = 0.5;
      front.roughness = 0.3;
      side.color.set(dc.side);
      side.emissive.set(dc.emissive);
      side.emissiveIntensity = 0.4;
      side.metalness = 0.55;
      side.roughness = 0.2;
    } else {
      const dc = DARK_LETTER_COLORS[i % DARK_LETTER_COLORS.length];
      front.color.set(dc.front);
      front.emissive.set(dc.emissive);
      front.emissiveIntensity = 0.5;
      front.metalness = 0.5;
      front.roughness = 0.3;
      side.color.set(dc.side);
      side.emissive.set(dc.emissive);
      side.emissiveIntensity = 0.4;
      side.metalness = 0.55;
      side.roughness = 0.2;
    }
  }
}
