# Adaptive AI — How It Works

A plain-English breakdown of the AI system in `app.js`, written so you can explain it in an interview without sounding like you're reciting code.

---

## The Big Idea

The AI doesn't suddenly get smarter. It starts out mostly random and gets less random as you win. At the top level it stops being random at all and runs a provably optimal algorithm. The transition is driven by one thing: **how many faces you've won total**, across all rounds ever played.

---

## The Key Variables

### `difficulty` (0–4)
The AI's current level. Starts at 0. Goes up by 1 each time X wins a face. Capped at 4. Never resets between rounds — only the Reset Game button brings it back to 0.

### `totalXFaceWins`
A running count of every face X has ever won, across every round. This is what drives `difficulty`. It's intentionally separate from the match score so it survives round resets.

```js
// In makeMove() — runs every time a move is made
if (winner === "X") {
  totalXFaceWins++;
  difficulty = Math.min(4, totalXFaceWins);
}
```

**Why `Math.min(4, ...)`?** So `difficulty` never goes above 4, no matter how many faces you win.

---

## The Difficulty Levels

| Level | Name | Behavior |
|---|---|---|
| 0 | Rookie | Random 70% of the time |
| 1 | Casual | Random 40% of the time |
| 2 | Focused | Random 15% of the time |
| 3 | Sharp | Always plays smart (heuristic) |
| 4 | Unbeatable | Full minimax — optimal every move |

---

## The "Slop Roll" — How Randomness Is Controlled

Every time the AI needs to move, it does one check before any strategy runs:

```js
const slop = [0.7, 0.4, 0.15, 0, 0][difficulty];
if (Math.random() < slop) {
  return empty[Math.floor(Math.random() * empty.length)];
}
```

**What this does:** `slop` is looked up from a fixed array using `difficulty` as the index. Then `Math.random()` generates a number between 0 and 1. If that number is less than `slop`, the AI picks a random empty cell and ignores all strategy.

- At difficulty 0: `slop = 0.7` → 70% chance of playing randomly
- At difficulty 3: `slop = 0` → `Math.random()` can never be less than 0, so the random branch never runs
- At difficulty 4: the slop roll is skipped entirely — minimax runs unconditionally

**In an interview:** *"I used a lookup table indexed by difficulty level. Each entry is a probability threshold for random play. The AI rolls `Math.random()` against it — if it passes, the move is random. As difficulty increases, that threshold drops toward zero, so the AI plays randomly less and less often. At max difficulty the random branch is bypassed entirely."*

---

## The Smart Heuristic (Levels 1–3)

When the slop roll fails (the AI plays smart), it follows this priority order:

### 1. Win
Scan all 8 win combos. If O already has 2 in a row and the third cell is empty — take it.

```js
for (const [a, b2, c] of WIN_COMBOS) {
  const vals = [b[a], b[b2], b[c]];
  if (vals.filter((v) => v === "O").length === 2 && vals.includes("")) {
    return [a, b2, c].find((i) => b[i] === "");
  }
}
```

### 2. Block
Same scan, but looking for X having 2 in a row. If found, take the empty cell before X does.

### 3. Center
Cell index 4 (the middle of the 3×3 grid) is the strongest single cell — it participates in 4 of the 8 winning combinations. Take it if it's free.

### 4. Corner
Corners (indices 0, 2, 6, 8) are the next strongest — each participates in 3 win combos. Take the first available one.

### 5. Fallback
Pick any remaining empty cell at random.

**In an interview:** *"The heuristic follows a classic tic-tac-toe priority chain: take a win, block a loss, take center, take a corner, take anything. It's deterministic — no randomness at this stage. This beats most casual players but a skilled player can still find forced draws or wins against it."*

---

## Minimax — Difficulty 4 (Unbeatable)

At level 4, the heuristic is replaced entirely by minimax. This is the standard algorithm for solving perfect-information two-player games.

### How it works

The AI simulates every possible future game state. It plays both sides — imagining what O would do (maximize the score) and what X would do (minimize it). It scores terminal states:
- O wins → +10
- X wins → -10
- Draw → 0

```js
function minimaxScore(board, isMaximizing) {
  const winner = checkWin(board);
  if (winner === "O") return 10;
  if (winner === "X") return -10;
  if (board.every((v) => v !== "")) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = "O";
        best = Math.max(best, minimaxScore(board, false));
        board[i] = ""; // undo (backtrack)
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = "X";
        best = Math.min(best, minimaxScore(board, true));
        board[i] = ""; // undo (backtrack)
      }
    }
    return best;
  }
}
```

`minimaxMove` calls this for every empty cell, picks the one with the highest score, and returns that index.

### Why it's unbeatable

On a 3×3 tic-tac-toe board, minimax exhaustively evaluates every possible game tree (at most 9! = 362,880 states, far fewer in practice because branches prune early when a winner is found). The result: O always picks the move that leads to the best possible outcome assuming X also plays perfectly. This means the absolute best a human can do is draw.

**In an interview:** *"Minimax is a recursive algorithm that simulates both players making optimal decisions. Each call tries every legal move, recursively evaluates the resulting state, and returns the score that would result from perfect play. The AI picks the move with the highest score. On a 3×3 board the search space is small enough that this runs instantly."*

---

## How to Beat the Unbeatable AI (You Can't Win, But You Can Draw)

1. **Always take center first** (index 4) if it's available
2. If O takes center on move 1, respond with a corner
3. Never ignore a threat — always block when O has 2 in a row
4. With perfect play, every game ends in a draw. That's the ceiling. The board is mathematically a draw with optimal play from both sides.

---

## The Two Reset Functions

### `resetRound()`
Called when you hit "Next Round." Clears the boards and match score but **keeps `totalXFaceWins` and `difficulty`**. The AI remembers you.

### `resetAll()`
Called when you hit "Reset Game." Calls `resetRound()` first, then also sets `totalXFaceWins = 0` and `difficulty = 0`. Full wipe.

**In an interview:** *"I separated the reset into two functions — one that resets the game state for a new round, and one that resets everything including difficulty. This lets the progression system persist across rounds without any additional complexity."*

---

## One-Line Summaries for Each Function

| Function | What it does |
|---|---|
| `makeMove(faceIdx, cellIdx)` | Places a mark, checks for win/draw, increments difficulty if X wins |
| `getComputerMove(faceIdx)` | Returns the best cell index for O using slop roll → heuristic → minimax |
| `minimaxScore(board, isMaximizing)` | Recursively scores a board state assuming both sides play optimally |
| `minimaxMove(board)` | Tries every empty cell, returns the index with the highest minimax score |
| `resetRound()` | Clears boards and match state, keeps difficulty |
| `resetAll()` | Full reset including difficulty back to 0 |
| `checkWin(board)` | Scans 8 win combos, returns "X", "O", or null |
