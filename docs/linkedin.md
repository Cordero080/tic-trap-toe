# LinkedIn Post — Tic-Trap-Toe

> This file is the source of truth for the current LinkedIn post.
> It is updated by Claude before every commit when features change.
> Copy the post below and paste directly into LinkedIn.

---

## Current Post

Just shipped a dark mode for Tic-Trap-Toe.

One toggle. Everything changes.

**Holographic black background.** Deep vignette with animated iridescent shimmer — purple, cyan, magenta gradients that drift across the screen. Studio spotlight keeps the cube lit center-stage while the edges fall off to black.

**Per-face cube colors.** Each of the six faces gets its own dark jewel tone — wine, navy, violet, emerald, amber, slate. High metalness, low roughness. The rainbow frame borders stay multicolor but slightly desaturated so they glow instead of burn.

**Per-letter title colors.** Every character in "TIC-TRAP-TOE" has its own color matching the cube palette — crimson, teal, plum, bronze, forest, midnight. Dramatic spotlight from above makes it look like it's floating in space.

**Dramatic lighting.** Frontal studio point light, repositioned directional sun, ambient dropped way down. Deep shadows on the back faces, strong highlights on the front. The cube has real depth now.

Light mode is untouched. Persists via localStorage. Toggle is bottom-left corner.

Built with Three.js and vanilla JavaScript. Zero build step, zero audio files, zero dependencies beyond the CDN importmap.

🎮 GitHub: https://lnkd.in/eBSCqf6G
🌐 Portfolio: https://pvblocordero.com

#threejs #javascript #webdev #gamedev #buildingpublic

---

## Changelog

| Date       | What changed                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-10 | Dark mode — holographic background, per-face cube colors, per-letter title colors, dramatic studio lighting, theme toggle with localStorage |
| 2026-03-16 | Draw shockwave rings + chirped jiggle + bass poof, between-rounds free-rotate drag, tiebreaker logic                                        |
| 2026-03-15 | Adaptive AI (5 levels + minimax), multi-round progression, adaptive cube steering, round label, score 3D shadow, Next Round button          |
| Prior      | Initial launch — 6-face rotating cube, 3D title, confetti, holographic won-face, synthesized audio                                          |
