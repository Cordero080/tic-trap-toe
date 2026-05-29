# LinkedIn Post — Tic-Trap-Toe

> This file is the source of truth for the current LinkedIn post.
> It is updated by Claude before every commit when features change.
> Copy the post below and paste directly into LinkedIn.

---

## Current Post

Just pushed a new update to Tic-Trap-Toe.

Six boards. One rotating cube. The cube never stops.

This isn't normal tic-tac-toe — you can't stall, you can't force a draw. The board you were about to win might spin away before your next move.

The cube now actively steers toward remaining unfinished faces. One face left? The rotation locks onto it and holds there with a slow idle drift — no more waiting. Two faces? It cycles between them at double speed.

Light and dark mode now have their own characters. A cat greets you on the landing page in light mode. Switch to dark and the bro takes over. Both loaded with Draco compression, both rendered in a separate canvas so they're never blurred by the overlay.

The AI starts casual and becomes unbeatable as you rack up face wins. Zero build step, zero audio files.

Play it: [link]

Built with Three.js and vanilla JavaScript.

🎮 GitHub: https://github.com/Cordero080/tic-trap-toe
🌐 Portfolio: https://pvblocordero.com

#threejs #javascript #webdev #gamedev #buildingpublic

---

## Changelog

| Date       | What changed                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-29 | Full architecture refactor — src/ for JS, public/ for fonts/icons/models/screenshots, CSS split into per-component files; white-celeb.glb for light mode match win; theme toggle on landing page; old flat structure removed |
| 2026-05-29 | Light mode cat on landing page (greeting-light.glb, Draco-compressed); dark/light characters swap instantly on theme toggle; tiered cube rotation — tier 3 spring-locks onto last face with breath idle, tier 2 2× speed between two remaining; game-over text moves to title position, title hides on match end |
| 2026-05-29 | Y-axis cube steering toward remaining unfinished side faces (1–2 left → rotation hunts for them); SW bumped to v5 to fix stale-cache bug preventing celeb animation from showing on match win                |
| 2026-05-29 | GLB animated characters — greeting character on landing page, celebration character under winner's score (fades in, plays full animation, fades out); cube dims on mobile during celeb; service worker updated |
| 2026-05-28 | Fix sound effects on iOS/mobile — prime AudioContext on first touchstart so Web Audio unlocks before any sound fires                                                                                         |
| 2026-05-28 | Dark mode is now the default for new visitors                                                                                                                                                                |
| 2026-05-28 | Game-over 3D text ("X WINS!"/"O WINS!"/"DRAW!") with rainbow palette + background fade to deep navy on match end; unified title colors between light/dark mode; mobile-responsive scaling for game-over text |
| 2026-05-28 | Holographic black background on Reset and Play buttons, cache bust for service worker                                                                                                                        |
| 2026-05-27 | Code audit cleanup — removed dead CSS (unused fonts, unreachable rules), deduplicated button glow styles, moved DOM listener to correct module, cleared root clutter                                         |
| 2026-05-17 | Deployed to Vercel, moved repo to tic-trap-toe, darkened landing overlay, fixed desc text visibility, added dark mode screenshots to README                                                                  |
| 2026-04-10 | Dark mode — holographic background, per-face cube colors, per-letter title colors, dramatic studio lighting, theme toggle with localStorage                                                                  |
| 2026-03-16 | Draw shockwave rings + chirped jiggle + bass poof, between-rounds free-rotate drag, tiebreaker logic                                                                                                         |
| 2026-03-15 | Adaptive AI (5 levels + minimax), multi-round progression, adaptive cube steering, round label, score 3D shadow, Next Round button                                                                           |
| Prior      | Initial launch — 6-face rotating cube, 3D title, confetti, holographic won-face, synthesized audio                                                                                                           |
