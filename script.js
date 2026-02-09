const puzzleScreen   = document.getElementById('puzzle-screen');
const questionScreen = document.getElementById('question-screen');
const puzzleBoard    = document.getElementById('puzzle-board');
const piecesTray     = document.getElementById('pieces-tray');
const yesBtn         = document.getElementById('yes-btn');
const noBtn          = document.getElementById('no-btn');
const successMsg     = document.getElementById('success-message');
const fxCanvas       = document.getElementById('fx-canvas');
const fxCtx          = fxCanvas.getContext('2d');

const moveCountEl  = document.getElementById('move-count');
const timerEl      = document.getElementById('timer');
const placedCountEl= document.getElementById('placed-count');
const totalCountEl = document.getElementById('total-count');
const progressBar  = document.getElementById('progress-bar');

const GRID      = 5;
const TOTAL     = GRID * GRID;
const IMG_SRC   = 'image.png';

let placed     = new Array(TOTAL).fill(null);
let draggedEl  = null;
let moveCount  = 0;
let timerStart = null;
let timerRAF   = null;

function buildBoard() {
  for (let i = 0; i < TOTAL; i++) {
    const cell = document.createElement('div');
    cell.className = 'board-cell';
    cell.dataset.index = i;

    cell.addEventListener('dragover', handleDragOver);
    cell.addEventListener('dragenter', handleDragEnter);
    cell.addEventListener('dragleave', handleDragLeave);
    cell.addEventListener('drop', handleDrop);

    puzzleBoard.appendChild(cell);
  }
}

function buildPieces() {
  const indices = Array.from({ length: TOTAL }, (_, i) => i);

  do { shuffle(indices); } while (isSorted(indices));

  indices.forEach(idx => {
    const piece = createPieceElement(idx);
    piecesTray.appendChild(piece);
  });

  totalCountEl.textContent = TOTAL;
}

function createPieceElement(idx) {
  const col = idx % GRID;
  const row = Math.floor(idx / GRID);

  const piece = document.createElement('div');
  piece.className = 'puzzle-piece';
  piece.draggable = true;
  piece.dataset.pieceIndex = idx;

  piece.style.backgroundImage = `url('${IMG_SRC}')`;
  piece.style.backgroundPosition =
    `${(col / (GRID - 1)) * 100}% ${(row / (GRID - 1)) * 100}%`;

  piece.addEventListener('dragstart', handleDragStart);
  piece.addEventListener('dragend', handleDragEnd);

  piece.addEventListener('touchstart', handleTouchStart, { passive: false });
  piece.addEventListener('touchmove', handleTouchMove, { passive: false });
  piece.addEventListener('touchend', handleTouchEnd);

  return piece;
}

function isSorted(arr) {
  return arr.every((v, i) => v === i);
}

function startTimer() {
  if (timerStart) return;
  timerStart = performance.now();
  tickTimer();
}

function tickTimer() {
  const elapsed = performance.now() - timerStart;
  const secs = Math.floor(elapsed / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
  timerRAF = requestAnimationFrame(tickTimer);
}

function stopTimer() {
  if (timerRAF) cancelAnimationFrame(timerRAF);
}

function handleDragStart(e) {
  draggedEl = e.target;
  draggedEl.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  startTimer();
}

function handleDragEnd() {
  if (draggedEl) draggedEl.classList.remove('dragging');
  draggedEl = null;
  clearHighlights();
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  cell.classList.remove('drag-over');
  if (!draggedEl) return;
  placePiece(draggedEl, cell);
}

let touchClone    = null;
let touchPiece    = null;
let touchOffsetX  = 0;
let touchOffsetY  = 0;
let touchRAF      = null;
let latestTouchX  = 0;
let latestTouchY  = 0;

function handleTouchStart(e) {
  e.preventDefault();
  e.stopPropagation();
  startTimer();
  const touch = e.touches[0];
  touchPiece  = e.currentTarget;
  touchPiece.classList.add('dragging');

  const rect = touchPiece.getBoundingClientRect();

  // Remember where inside the piece the finger landed
  touchOffsetX = touch.clientX - rect.left - rect.width / 2;
  touchOffsetY = touch.clientY - rect.top  - rect.height / 2;

  touchClone = touchPiece.cloneNode(true);
  touchClone.classList.remove('dragging');
  Object.assign(touchClone.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    zIndex: '10000',
    pointerEvents: 'none',
    opacity: '0.92',
    width: rect.width + 'px',
    height: rect.height + 'px',
    borderColor: 'var(--accent)',
    boxShadow: '0 8px 30px rgba(232, 67, 147, 0.5)',
    willChange: 'transform',
    transition: 'none'
  });
  latestTouchX = touch.clientX;
  latestTouchY = touch.clientY;
  positionClone(touch.clientX, touch.clientY, rect.width, rect.height);
  document.body.appendChild(touchClone);
}

function positionClone(cx, cy, w, h) {
  // Place clone so it's centered on the adjusted touch, shifted slightly up
  // so the user's finger doesn't fully cover it
  const x = cx - touchOffsetX - w / 2;
  const y = cy - touchOffsetY - h / 2 - 30;
  touchClone.style.transform = `translate(${x}px, ${y}px) scale(1.08)`;
}

// The point we use for hit-testing: center of where the clone appears
function getDropPoint(cx, cy) {
  return {
    x: cx - touchOffsetX,
    y: cy - touchOffsetY - 30   // same offset applied to clone
  };
}

function handleTouchMove(e) {
  e.preventDefault();
  e.stopPropagation();
  const touch = e.touches[0];
  latestTouchX = touch.clientX;
  latestTouchY = touch.clientY;

  // Use rAF to batch DOM updates for smoother dragging
  if (!touchRAF) {
    touchRAF = requestAnimationFrame(updateTouchPosition);
  }
}

function updateTouchPosition() {
  touchRAF = null;
  if (!touchClone) return;

  const w = touchClone.offsetWidth;
  const h = touchClone.offsetHeight;
  positionClone(latestTouchX, latestTouchY, w, h);

  clearHighlights();
  const drop = getDropPoint(latestTouchX, latestTouchY);
  touchClone.style.display = 'none';
  const el = document.elementFromPoint(drop.x, drop.y);
  touchClone.style.display = '';
  const cell = findBoardCell(el);
  if (cell) cell.classList.add('drag-over');
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (touchRAF) { cancelAnimationFrame(touchRAF); touchRAF = null; }
  const touch = e.changedTouches[0];

  const drop = getDropPoint(touch.clientX, touch.clientY);
  if (touchClone) touchClone.style.display = 'none';
  let el = document.elementFromPoint(drop.x, drop.y);
  if (touchClone) touchClone.style.display = '';

  let cell = findBoardCell(el);

  // If no cell found, try nearby points (helps on small cells)
  if (!cell) {
    const offsets = [[-12,0],[12,0],[0,-12],[0,12]];
    for (const [dx,dy] of offsets) {
      if (touchClone) touchClone.style.display = 'none';
      el = document.elementFromPoint(drop.x + dx, drop.y + dy);
      if (touchClone) touchClone.style.display = '';
      cell = findBoardCell(el);
      if (cell) break;
    }
  }

  if (cell && touchPiece) {
    placePiece(touchPiece, cell);
  }

  if (touchClone) { touchClone.remove(); touchClone = null; }
  if (touchPiece) { touchPiece.classList.remove('dragging'); touchPiece = null; }
  clearHighlights();
}

function findBoardCell(el) {
  if (!el) return null;
  if (el.classList.contains('board-cell')) return el;
  if (el.closest) return el.closest('.board-cell');
  return null;
}



function placePiece(pieceEl, cell) {
  const pieceIdx = parseInt(pieceEl.dataset.pieceIndex, 10);
  const cellIdx  = parseInt(cell.dataset.index, 10);

  const existingPiece = cell.querySelector('.puzzle-piece');
  if (existingPiece) {
    const existIdx = parseInt(existingPiece.dataset.pieceIndex, 10);
    placed[cellIdx] = null;

    const fromCell = pieceEl.parentElement;
    if (fromCell && fromCell.classList.contains('board-cell')) {
      const fromIdx = parseInt(fromCell.dataset.index, 10);
      fromCell.appendChild(existingPiece);
      placed[fromIdx] = existIdx;
      checkCellCorrect(fromCell, fromIdx);
    } else {
      piecesTray.appendChild(existingPiece);
    }
  } else {
    const fromCell = pieceEl.parentElement;
    if (fromCell && fromCell.classList.contains('board-cell')) {
      const fromIdx = parseInt(fromCell.dataset.index, 10);
      placed[fromIdx] = null;
      fromCell.classList.remove('correct');
    }
  }

  cell.appendChild(pieceEl);
  placed[cellIdx] = pieceIdx;

  moveCount++;
  moveCountEl.textContent = moveCount;

  checkCellCorrect(cell, cellIdx);
  updateProgress();
  checkWin();
}

function checkCellCorrect(cell, cellIdx) {
  if (placed[cellIdx] === cellIdx) {
    cell.classList.add('correct');
  } else {
    cell.classList.remove('correct');
  }
}

function clearHighlights() {
  document.querySelectorAll('.board-cell.drag-over')
    .forEach(c => c.classList.remove('drag-over'));
}

function updateProgress() {
  const correct = placed.filter((v, i) => v === i).length;
  placedCountEl.textContent = correct;
  progressBar.style.width = ((correct / TOTAL) * 100) + '%';
}

function checkWin() {
  if (!placed.every((val, idx) => val === idx)) return;

  stopTimer();

  setTimeout(() => {
    puzzleScreen.classList.remove('active');
    questionScreen.classList.add('active');
  }, 700);
}

yesBtn.addEventListener('click', () => {
  yesBtn.style.display = 'none';
  noBtn.style.display  = 'none';
  document.querySelector('.question-text').style.display = 'none';
  document.querySelector('.question-heart').style.display = 'none';
  successMsg.classList.remove('hidden');
  startConfetti();
  spawnFloatingHearts(35);
});

noBtn.addEventListener('mouseenter', runAwayNo);
noBtn.addEventListener('click', runAwayNo);
noBtn.addEventListener('touchstart', (e) => { e.preventDefault(); runAwayNo(); });

function runAwayNo() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = noBtn.offsetWidth;
  const bh = noBtn.offsetHeight;

  const x = Math.random() * (vw - bw - 40) + 20;
  const y = Math.random() * (vh - bh - 40) + 20;

  Object.assign(noBtn.style, {
    position: 'fixed',
    left: x + 'px',
    top:  y + 'px',
    transition: 'left 0.35s cubic-bezier(.22,1,.36,1), top 0.35s cubic-bezier(.22,1,.36,1)'
  });
}

let confettiParticles = [];
let confettiRunning   = false;

function resizeCanvas() {
  fxCanvas.width  = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
resizeCanvas();

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());

function startConfetti() {
  confettiParticles = [];
  const colors = [
    '#e84393','#fd79a8','#ff6b81','#ff4757','#ff6348',
    '#ffa502','#eccc68','#7bed9f','#70a1ff','#5352ed'
  ];

  for (let i = 0; i < 250; i++) {
    confettiParticles.push({
      x: Math.random() * fxCanvas.width,
      y: Math.random() * fxCanvas.height - fxCanvas.height,
      w: Math.random() * 10 + 4,
      h: Math.random() * 5 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * 4 + 2,
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  if (!confettiRunning) { confettiRunning = true; animateConfetti(); }
}

function animateConfetti() {
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

  confettiParticles.forEach(p => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.rot += p.rv;
    p.vy  += 0.04;

    if (p.y > fxCanvas.height - 120) p.opacity -= 0.018;
    if (p.opacity <= 0) return;

    fxCtx.save();
    fxCtx.translate(p.x, p.y);
    fxCtx.rotate((p.rot * Math.PI) / 180);
    fxCtx.globalAlpha = Math.max(p.opacity, 0);
    fxCtx.fillStyle = p.color;
    fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    fxCtx.restore();
  });

  confettiParticles = confettiParticles.filter(p => p.opacity > 0 && p.y < fxCanvas.height + 60);

  if (confettiParticles.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    confettiRunning = false;
  }
}

function spawnFloatingHearts(count) {
  const hearts = ['❤️','💕','💖','💗','💘','💝','🥰','✨'];

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const span = document.createElement('span');
      span.className = 'floating-heart';
      span.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      span.style.left = Math.random() * 100 + 'vw';
      span.style.bottom = '-40px';
      span.style.fontSize = (Math.random() * 1.6 + 1.2) + 'rem';
      span.style.animationDuration = (Math.random() * 2 + 3) + 's';
      document.body.appendChild(span);
      span.addEventListener('animationend', () => span.remove());
    }, i * 110);
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function init() {
  buildBoard();
  buildPieces();
  updateProgress();
}

init();
