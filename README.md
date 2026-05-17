# Tic-Trap-Toe

![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![No Build Step](https://img.shields.io/badge/build-none-brightgreen?style=flat)

**Tic-tac-toe is a solved game. This isn't.**

Six boards. One rotating cube. The cube never stops — faces drift toward you, become playable, then spin away. You don't get to pick which game you're in. First to win 3 faces wins the match.

![Title and cube overview](assets/screenshots/title-cube-overview.png)

---

## Why it works

Normal tic-tac-toe ends in a draw every time against anyone paying attention. The rotation kills that. You can't stall, you can't force a draw — the board you were about to win might rotate away before your turn comes back. You'll be mid-game on two or three faces at once, each at a different stage, and you have to decide which one is worth committing to.

There's no timer. No forced turn order between faces. **If you can see the cells, you can play them.** The physics enforce the rules.

---

## How to Play

1. Open `index.html` — no build step, just open it
2. Click any empty cell on a face that's rotating toward you
3. Each face has its own independent X/O game
4. Get **3 in a row** on a face to claim it
5. Claim **3 faces** to win the match
6. Hit **Next Round** to keep playing — or **Reset Game** to start fresh

**vs Computer** — toggle the checkbox; the AI plays O on whatever face you just moved on. Switching modes resets the game.

---

## When a Face Is Won

- A golden bar strikes through the three winning cells
- Confetti bursts from the winning cell in 3D world space
- The face turns metallic white — winning marks glow red, losers go black
- The score scrambles before landing on the new number
- On match win: score burns yellow-red, cube decelerates and pulses twice

## When a Face Ties

- Three shockwave rings burst outward from the tied face surface with additive glow
- The cube rattles with 5 fast chirped X-axis shakes (gaps between each shake shorten)
- A soft bass-drum poof fires with short reverb

![Golden win bar](assets/screenshots/gold-win-bar.png)
![Confetti burst](assets/screenshots/confetti-face-win.png)
![Match win score](assets/screenshots/match-win-score.jpg)

---

## Adaptive AI

When playing vs Computer, the AI gets harder every time you win a face — and that difficulty **carries across rounds**. Win a match, hit Next Round, and the AI picks up where it left off.

| Faces won (total) | AI level   | Behavior                         |
| ----------------- | ---------- | -------------------------------- |
| 0                 | Rookie     | Plays randomly 70% of the time   |
| 1                 | Casual     | Plays randomly 40% of the time   |
| 2                 | Focused    | Plays randomly 15% of the time   |
| 3                 | Sharp      | Always plays the smart heuristic |
| 4+                | Unbeatable | Full minimax — provably optimal  |

**How to beat Unbeatable:** You can't win, but you can draw. Take center immediately if it's free. If the AI takes center, go to a corner. Always block the most dangerous threat. With perfect play every game ends in a draw — that's the ceiling.

---

## Adaptive Cube Steering

As faces get claimed, the cube stops giving equal time to all six sides. When 3 or fewer faces remain in play, the rotation biases toward showing the unfinished faces — arriving at their angles faster and lingering longer. The fewer faces left, the stronger the pull. The cube never stops spinning; it just stops being equally fair to faces that are already done.

---

## Stack

- **Three.js** via importmap CDN — raycasting, `TextGeometry`, per-frame animation
- Vanilla JS ES modules, no build step:
  - `app.js` — pure game logic, adaptive AI (minimax + slop-rate difficulty ladder)
  - `cube.js` — all 3-D geometry, marks, slabs, confetti, win visuals, adaptive steering
  - `title.js` — extruded 3-D title with foreshortening tilt
  - `audio.js` — fully synthesized Web Audio (zero audio files)
  - `background.js` — scene, camera, input, DOM, round/difficulty state, tick loop
- CSS — conic-gradient button glow, glitch score animation, diagonal-stripe match-win, rainbow round label, dark mode with holographic shimmer

---

## Dark Mode

Toggle the 🌙 button (bottom-left corner). Persists via `localStorage`.

- **Background** — holographic black with animated iridescent shimmer and deep vignette
- **Cube** — each face becomes a unique dark jewel tone (wine, navy, violet, emerald, amber, slate) with high metalness
- **Title** — each letter gets its own color matching the cube palette, lit by a dramatic focused spotlight
- **Borders** — rainbow cycling preserved, slightly desaturated for elegance
- **Lighting** — frontal studio spotlight, dimmed ambient, repositioned sun for dramatic depth

![Dark mode gameplay — face won](assets/screenshots/Screenshot%202026-05-16%20at%2011.36.11%20PM.png)
![Dark mode mobile — multi-face progress](assets/screenshots/Screenshot%202026-05-16%20at%2011.37.04%20PM.png)

---

## Run Locally

```bash
open index.html
# or if your browser blocks ES modules from file://
npx serve .
```

---

## Stretch Goals

- **Two-player multiplayer** — invite a friend via a shareable link. No accounts needed: Player 1 gets a room code, Player 2 joins via URL (`?room=abc123`). A thin real-time layer (Partykit or Supabase Realtime) syncs moves between browsers. Room state is ephemeral — no database required.

---

© 2025 Pablo Cordero. All rights reserved.
