# LinkedIn Post — Tic-Trap-Toe

> This file is the source of truth for the current LinkedIn post.
> It is updated by Claude before every commit when features change.
> Copy the post below and paste directly into LinkedIn.

---

## Current Post

Just shipped another update to Tic-Trap-Toe.

Three new things:

**Draw effect.** When a face ties, three shockwave rings burst outward from the surface with additive glow, the cube rattles with 5 fast chirped X-axis shakes (gaps between each shake shorten), and a soft bass-drum poof fires with short reverb. All synthesized — no audio files.

**Between-rounds free rotation.** After a match ends, you can click and drag the cube to spin it freely in any direction — rotate it, flip it, look at every face. It deactivates the moment you hit Next Round or Reset Game.

**Tiebreaker.** If all six faces resolve without anyone reaching 3 wins, the player with the most faces takes the match. If it's equal, it's a draw.

Built with Three.js and vanilla JavaScript. Zero build step, zero audio files, zero dependencies beyond the CDN importmap.

🎮 GitHub: https://lnkd.in/eBSCqf6G
🌐 Portfolio: https://pvblocordero.com

#threejs #javascript #webdev #gamedev #buildingpublic

---

## Changelog

| Date | What changed |
|---|---|
| 2026-03-16 | Draw shockwave rings + chirped jiggle + bass poof, between-rounds free-rotate drag, tiebreaker logic |
| 2026-03-15 | Adaptive AI (5 levels + minimax), multi-round progression, adaptive cube steering, round label, score 3D shadow, Next Round button |
| Prior | Initial launch — 6-face rotating cube, 3D title, confetti, holographic won-face, synthesized audio |
