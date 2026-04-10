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

// Dark-mode letter colors — matching the 6 cube face colors, brighter for title
const DARK_LETTER_COLORS = [
  // T   I   C   -   T   R   A   P   -   T   O   E
  { front: 0xb83030, side: 0xd04848, emissive: 0x601010 }, // crimson
  { front: 0x2898a8, side: 0x40b0c0, emissive: 0x104850 }, // teal
  { front: 0xa03898, side: 0xb850b0, emissive: 0x501840 }, // plum
  { front: 0xb88030, side: 0xd09840, emissive: 0x584010 }, // bronze
  { front: 0x28a048, side: 0x40b860, emissive: 0x105018 }, // forest
  { front: 0xb83030, side: 0xd04848, emissive: 0x601010 }, // crimson
  { front: 0x3050b0, side: 0x4868c8, emissive: 0x102058 }, // midnight
  { front: 0xa03898, side: 0xb850b0, emissive: 0x501840 }, // plum
  { front: 0xb88030, side: 0xd09840, emissive: 0x584010 }, // bronze
  { front: 0x2898a8, side: 0x40b0c0, emissive: 0x104850 }, // teal
  { front: 0x28a048, side: 0x40b860, emissive: 0x105018 }, // forest
  { front: 0x3050b0, side: 0x4868c8, emissive: 0x102058 }, // midnight
];

export function initTitle(scene, camera) {
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

        const frontMat = new THREE.MeshStandardMaterial({
          color: 0x2d0060,
          metalness: 0.35,
          roughness: 0.25,
          emissive: new THREE.Color(0x2d0060),
          emissiveIntensity: 0.3,
        });
        const sideMat = new THREE.MeshStandardMaterial({
          color: 0x8833ff,
          metalness: 0.5,
          roughness: 0.15,
          emissive: new THREE.Color(0x440088),
          emissiveIntensity: 0.2,
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

      // Apply queued dark-mode state now that materials exist
      if (_pendingDark) setDarkMode(true);
    },
  );
}

export function updateTitle(t) {
  if (!titleMesh) return;
  titleMesh.position.y = 10 + Math.sin(t * 1.1) * 0.18;
  titleMesh.rotation.x = 0.22;
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
      front.color.set(0x2d0060);
      front.emissive.set(0x2d0060);
      front.emissiveIntensity = 0.3;
      front.metalness = 0.35;
      front.roughness = 0.25;
      side.color.set(0x8833ff);
      side.emissive.set(0x440088);
      side.emissiveIntensity = 0.2;
      side.metalness = 0.5;
      side.roughness = 0.15;
    }
  }
}
