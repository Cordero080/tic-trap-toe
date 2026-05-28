# LinkedIn Post — Tic-Trap-Toe

> This file is the source of truth for the current LinkedIn post.
> It is updated by Claude before every commit when features change.
> Copy the post below and paste directly into LinkedIn.

---

## Current Post

Just pushed Tic-Trap-Toe to GitHub and deployed it on Vercel.

Six boards. One rotating cube. The cube never stops.

This isn't normal tic-tac-toe — you can't stall, you can't force a draw. The board you were about to win might spin away before your next move. You're mid-game on two or three faces at once and have to decide which one is worth committing to.

Latest update: when someone wins the match, the background fades to deep navy and "X WINS!" / "O WINS!" / "DRAW!" appears in extruded 3D text — same rainbow palette as the title, floating between the logo and the cube, scaling correctly on mobile too.

The AI starts casual and becomes unbeatable as you rack up face wins. Dark mode included. Zero build step, zero audio files.

Play it: [link]

Built with Three.js and vanilla JavaScript.

🎮 GitHub: https://github.com/Cordero080/tic-trap-toe
🌐 Portfolio: https://pvblocordero.com

#threejs #javascript #webdev #gamedev #buildingpublic

---

## Changelog

| Date       | What changed                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-28 | Fix sound effects on iOS/mobile — prime AudioContext on first touchstart so Web Audio unlocks before any sound fires |
| 2026-05-28 | Dark mode is now the default for new visitors |
| 2026-05-28 | Game-over 3D text ("X WINS!"/"O WINS!"/"DRAW!") with rainbow palette + background fade to deep navy on match end; unified title colors between light/dark mode; mobile-responsive scaling for game-over text |
| 2026-05-28 | Holographic black background on Reset and Play buttons, cache bust for service worker |
| 2026-05-27 | Code audit cleanup — removed dead CSS (unused fonts, unreachable rules), deduplicated button glow styles, moved DOM listener to correct module, cleared root clutter |
| 2026-05-17 | Deployed to Vercel, moved repo to tic-trap-toe, darkened landing overlay, fixed desc text visibility, added dark mode screenshots to README |
| 2026-04-10 | Dark mode — holographic background, per-face cube colors, per-letter title colors, dramatic studio lighting, theme toggle with localStorage |
| 2026-03-16 | Draw shockwave rings + chirped jiggle + bass poof, between-rounds free-rotate drag, tiebreaker logic |
| 2026-03-15 | Adaptive AI (5 levels + minimax), multi-round progression, adaptive cube steering, round label, score 3D shadow, Next Round button |
| Prior | Initial launch — 6-face rotating cube, 3D title, confetti, holographic won-face, synthesized audio |
