/** @typedef {'beginner' | 'intermediate' | 'expert'} Difficulty */

/** @type {Record<Difficulty, { rows: number; cols: number; mines: number }>} */
const PRESETS = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const NUMBER_CLASS = ["n0", "n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"];

const el = {
  board: document.getElementById("board"),
  difficulty: document.getElementById("difficulty"),
  mineCount: document.getElementById("mine-count"),
  timer: document.getElementById("timer"),
  faceBtn: document.getElementById("face-btn"),
  face: document.getElementById("face"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayMsg: document.getElementById("overlay-msg"),
  overlayBtn: document.getElementById("overlay-btn"),
};

/** @type {Difficulty} */
let difficulty = "beginner";
let rows = 9;
let cols = 9;
let mineTotal = 10;

/** -1 mine, 0-8 count */
let grid = [];
/** hidden | open */
let revealed = [];
/** boolean */
let flagged = [];

let started = false;
let gameOver = false;
let win = false;
let firstClickDone = false;
let timerId = null;
let seconds = 0;
let flagsPlaced = 0;
/** @type {number} */
let blastIndex = -1;

function pad3(n) {
  const s = String(Math.max(0, Math.min(999, n)));
  return s.padStart(3, "0");
}

function setFace(emoji) {
  el.face.textContent = emoji;
}

function stopTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function tickTimer() {
  seconds += 1;
  el.timer.textContent = pad3(seconds);
}

function updateMineDisplay() {
  el.mineCount.textContent = pad3(mineTotal - flagsPlaced);
}

function index(r, c) {
  return r * cols + c;
}

function inBounds(r, c) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

function neighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc)) out.push([nr, nc]);
    }
  }
  return out;
}

function emptyState() {
  grid = new Array(rows * cols).fill(0);
  revealed = new Array(rows * cols).fill(false);
  flagged = new Array(rows * cols).fill(false);
}

function placeMines(safeR, safeC) {
  const safe = new Set();
  safe.add(index(safeR, safeC));
  for (const [nr, nc] of neighbors(safeR, safeC)) {
    safe.add(index(nr, nc));
  }

  const candidates = [];
  for (let i = 0; i < rows * cols; i++) {
    if (!safe.has(i)) candidates.push(i);
  }

  for (let m = 0; m < mineTotal; m++) {
    const j = m + Math.floor(Math.random() * (candidates.length - m));
    const tmp = candidates[m];
    candidates[m] = candidates[j];
    candidates[j] = tmp;
  }
  for (let m = 0; m < mineTotal; m++) {
    grid[candidates[m]] = -1;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = index(r, c);
      if (grid[i] === -1) continue;
      let n = 0;
      for (const [nr, nc] of neighbors(r, c)) {
        if (grid[index(nr, nc)] === -1) n++;
      }
      grid[i] = n;
    }
  }
}

function floodReveal(r, c) {
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const i = index(cr, cc);
    if (revealed[i] || flagged[i]) continue;
    revealed[i] = true;
    if (grid[i] !== 0) continue;
    for (const [nr, nc] of neighbors(cr, cc)) {
      const j = index(nr, nc);
      if (!revealed[j] && !flagged[j]) stack.push([nr, nc]);
    }
  }
}

function countAdjacentFlags(r, c) {
  let n = 0;
  for (const [nr, nc] of neighbors(r, c)) {
    if (flagged[index(nr, nc)]) n++;
  }
  return n;
}

function chord(r, c) {
  const i = index(r, c);
  if (!revealed[i] || grid[i] <= 0) return;
  if (countAdjacentFlags(r, c) !== grid[i]) return;

  for (const [nr, nc] of neighbors(r, c)) {
    const j = index(nr, nc);
    if (revealed[j] || flagged[j]) continue;
    revealCell(nr, nc);
    if (gameOver) return;
  }
}

function checkWin() {
  let hiddenSafe = 0;
  for (let i = 0; i < rows * cols; i++) {
    if (grid[i] !== -1 && !revealed[i]) hiddenSafe++;
  }
  if (hiddenSafe === 0) {
    win = true;
    gameOver = true;
    stopTimer();
    setFace("😎");
    for (let i = 0; i < rows * cols; i++) {
      if (grid[i] === -1 && !flagged[i]) {
        flagged[i] = true;
        flagsPlaced++;
      }
    }
    updateMineDisplay();
    showOverlay(true);
  }
}

/**
 * @param {number} r
 * @param {number} c
 */
function revealCell(r, c) {
  if (gameOver) return;
  const i = index(r, c);
  if (flagged[i] || revealed[i]) return;

  if (!firstClickDone) {
    firstClickDone = true;
    placeMines(r, c);
  }

  if (grid[i] === -1) {
    blastIndex = i;
    revealed[i] = true;
    gameOver = true;
    win = false;
    stopTimer();
    setFace("😵");
    revealAllMines();
    showOverlay(false);
    return;
  }

  if (grid[i] === 0) {
    floodReveal(r, c);
  } else {
    revealed[i] = true;
  }

  if (!started) {
    started = true;
    seconds = 0;
    el.timer.textContent = pad3(0);
    stopTimer();
    timerId = setInterval(tickTimer, 1000);
  }

  checkWin();
}

function revealAllMines() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = index(r, c);
      if (grid[i] === -1) {
        revealed[i] = true;
      }
    }
  }
}

function toggleFlag(r, c) {
  if (gameOver) return;
  const i = index(r, c);
  if (revealed[i]) return;
  if (flagged[i]) {
    flagged[i] = false;
    flagsPlaced--;
  } else {
    if (flagsPlaced >= mineTotal) return;
    flagged[i] = true;
    flagsPlaced++;
  }
  updateMineDisplay();
  setFace("🙂");
}

function cellLabel(r, c) {
  const i = index(r, c);
  if (revealed[i] && grid[i] === -1) return "💣";
  if (flagged[i] && grid[i] !== -1 && gameOver && !win) return "✕";
  if (flagged[i] && !revealed[i]) return "🚩";
  if (!revealed[i]) return "";
  if (grid[i] === 0) return "";
  return String(grid[i]);
}

function renderCell(button, r, c) {
  const i = index(r, c);
  button.className = "cell";
  button.textContent = cellLabel(r, c);
  button.disabled = false;

  const wrongFlag = flagged[i] && grid[i] !== -1 && gameOver && !win;
  if (revealed[i] || wrongFlag) {
    button.classList.add("open");
    if (grid[i] === -1) {
      button.classList.add(gameOver && !win && i === blastIndex ? "mine-hit" : "mine-reveal");
    } else if (grid[i] >= 0 && !wrongFlag) {
      button.classList.add(NUMBER_CLASS[grid[i]]);
    }
    if (wrongFlag) {
      button.classList.add("wrong-flag");
    }
  }
  if (flagged[i] && !revealed[i] && !wrongFlag) button.classList.add("flagged");

  if (gameOver || (revealed[i] && grid[i] !== -1 && !wrongFlag)) {
    button.disabled = true;
  }
}

function buildBoard() {
  el.board.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size, 28px))`;
  el.board.innerHTML = "";
  el.board.setAttribute("aria-rowcount", String(rows));
  el.board.setAttribute("aria-colcount", String(cols));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);
      btn.setAttribute("role", "gridcell");
      btn.setAttribute("aria-rowindex", String(r + 1));
      btn.setAttribute("aria-colindex", String(c + 1));
      attachCellHandlers(btn, r, c);
      renderCell(btn, r, c);
      el.board.appendChild(btn);
    }
  }
}

/**
 * @param {HTMLButtonElement} button
 * @param {number} r
 * @param {number} c
 */
function attachCellHandlers(button, r, c) {
  button.addEventListener("click", (e) => {
    e.preventDefault();
    if (e.button === 2) return;
    revealCell(r, c);
    refreshAllCells();
  });

  button.addEventListener("auxclick", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      chord(r, c);
      refreshAllCells();
    }
  });

  button.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    toggleFlag(r, c);
    refreshAllCells();
  });

  button.addEventListener("mousedown", (e) => {
    if (e.buttons === 3) {
      chord(r, c);
      refreshAllCells();
      return;
    }
    if (e.button === 0 && !gameOver) setFace("😮");
  });

  button.addEventListener("mouseup", () => {
    if (!gameOver) setFace("🙂");
  });

  button.addEventListener("mouseleave", () => {
    if (!gameOver) setFace("🙂");
  });
}

function refreshAllCells() {
  const buttons = el.board.querySelectorAll("button.cell");
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const btn = buttons[k++];
      renderCell(btn, r, c);
    }
  }
}

function showOverlay(didWin) {
  el.overlay.classList.remove("hidden");
  if (didWin) {
    el.overlayTitle.textContent = "승리!";
    el.overlayMsg.textContent = `시간: ${seconds}초. 잘 하셨어요!`;
  } else {
    el.overlayTitle.textContent = "게임 오버";
    el.overlayMsg.textContent = "지뢰를 밟았습니다. 다음엔 더 조심해요.";
  }
}

function hideOverlay() {
  el.overlay.classList.add("hidden");
}

function newGame() {
  stopTimer();
  difficulty = /** @type {Difficulty} */ (el.difficulty.value);
  const p = PRESETS[difficulty];
  rows = p.rows;
  cols = p.cols;
  mineTotal = p.mines;

  started = false;
  gameOver = false;
  win = false;
  firstClickDone = false;
  seconds = 0;
  flagsPlaced = 0;
  blastIndex = -1;

  el.timer.textContent = pad3(0);
  updateMineDisplay();
  setFace("🙂");
  hideOverlay();

  emptyState();
  buildBoard();
}

el.faceBtn.addEventListener("click", () => {
  newGame();
});

el.difficulty.addEventListener("change", () => {
  newGame();
});

el.overlayBtn.addEventListener("click", () => {
  hideOverlay();
  newGame();
});

newGame();
