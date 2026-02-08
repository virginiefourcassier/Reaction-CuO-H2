// v3 – corrections demandées
// 1) Tas solide : toutes les unités Cu–O entièrement visibles (pas de chevauchement)
// 2) H2 en mouvement (agitation dépendante de T)
// 3) Par défaut : proportions stœchiométriques au départ (H2 = CuO)

const canvas = document.getElementById("simu");
const ctx = canvas.getContext("2d");

const tempSlider = document.getElementById("temp");
const tempVal = document.getElementById("tempVal");
const h2Slider = document.getElementById("h2");
const h2Val = document.getElementById("h2Val");
const cuoSlider = document.getElementById("cuo");
const cuoVal = document.getElementById("cuoVal");
const restartBtn = document.getElementById("restart");
const toggleAtomsBtn = document.getElementById("toggleAtoms");
const pauseBtn = document.getElementById("pauseBtn");

let paused = false;
let animId;

let showAtoms = false;

const AT = {
  H:  { r: 6,  color: "#ffffff", label: "H" },
  O:  { r: 8,  color: "#e53935", label: "O" },
  Cu: { r: 10, color: "#b87333", label: "Cu" }
};

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function drawAtom(x, y, atom) {
  ctx.beginPath();
  ctx.fillStyle = atom.color;
  ctx.arc(x, y, atom.r, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.stroke();

  if (showAtoms) {
    ctx.fillStyle = "#000";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(atom.label, x, y);
  }
}

function drawCuO(cx, cy) {
  // Cu - O horizontal (compact) : entièrement visible par construction (pas de chevauchement dans le tas)
  ctx.beginPath();
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 2;
  ctx.moveTo(cx - AT.Cu.r + 1, cy);
  ctx.lineTo(cx + AT.O.r - 1, cy);
  ctx.stroke();
  ctx.lineWidth = 1;

  drawAtom(cx - AT.Cu.r, cy, AT.Cu);
  drawAtom(cx + AT.O.r, cy, AT.O);
}

class SolidUnit {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.phase = rand(0, Math.PI*2);
  }
  draw() {
    // solide : vibration très faible
    const Tc = parseFloat(tempSlider.value);
    const vib = 0.15 + (Tc/120)*0.35;
    const ox = Math.cos(this.phase) * vib;
    const oy = Math.sin(this.phase) * vib;
    this.phase += 0.03;
    drawCuO(this.x + ox, this.y + oy);
  }
}

// --- Tas solide (posé au sol, sans chevauchement) ---
let solid = [];

function buildSolidPile(n) {
  solid = [];
  const groundY = canvas.height - 18; // contact bas
  const colsMax = 7;                  // largeur max du tas
  const dx = 34;                      // espacement horizontal (>> diamètre max)
  const dy = 28;                      // espacement vertical

  // tas en "briques" : chaque unité a sa place, aucune superposition
  // on construit de bas en haut, en réduisant légèrement la largeur
  let remaining = n;
  let row = 0;
  while (remaining > 0) {
    const cols = Math.min(remaining, Math.max(3, colsMax - Math.floor(row/2)));
    const y = groundY - row * dy;
    const x0 = (canvas.width / 2) - ((cols - 1) * dx / 2);

    for (let c = 0; c < cols; c++) {
      const x = x0 + c * dx;
      solid.push(new SolidUnit(x, y));
      remaining--;
      if (remaining === 0) break;
    }
    row++;
    if (row > 10) break; // sécurité
  }
}

// --- Gaz H2 (mobile) ---
class H2Mol {
  constructor() {
    this.x = rand(50, canvas.width - 50);
    this.y = rand(50, canvas.height - 220);
    this.vx = rand(-1, 1);
    this.vy = rand(-1, 1);
  }
  move(speed) {
    this.x += this.vx * speed;
    this.y += this.vy * speed;

    const r = AT.H.r * 2 + 6;
    if (this.x < r) { this.x = r; this.vx *= -1; }
    if (this.x > canvas.width - r) { this.x = canvas.width - r; this.vx *= -1; }
    if (this.y < r) { this.y = r; this.vy *= -1; }
    if (this.y > canvas.height - r) { this.y = canvas.height - r; this.vy *= -1; }
  }
  draw() {
    // liaison implicite
    ctx.beginPath();
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 2;
    ctx.moveTo(this.x - AT.H.r + 1, this.y);
    ctx.lineTo(this.x + AT.H.r - 1, this.y);
    ctx.stroke();
    ctx.lineWidth = 1;

    drawAtom(this.x - AT.H.r, this.y, AT.H);
    drawAtom(this.x + AT.H.r, this.y, AT.H);
  }
}

let gas = [];

function kineticSpeed() {
  // effet T visible : [0.5 ; 3.6]
  const Tc = parseFloat(tempSlider.value);
  let speed = 0.5 + ((Tc - 10) / (120 - 10)) * 3.1;
  return clamp(speed, 0.45, 3.6);
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of solid) s.draw();
  for (const g of gas) g.draw();
}

function step() {
  if (!paused) {
    const speed = kineticSpeed();
    for (const g of gas) g.move(speed);
  }
  drawScene();
  animId = requestAnimationFrame(step);
}

// --- Init ---
function init() {
  cancelAnimationFrame(animId);
  paused = false;
  pauseBtn.textContent = "Pause";

  // Par défaut demandé : stœchiométrique => H2 = CuO
  // (on conserve la liberté ensuite : curseurs indépendants)
  // Ici, on ne ré-écrit pas les sliders : ils sont déjà à 10/10 par défaut dans index.html.

  gas = [];
  const nH2 = parseInt(h2Slider.value, 10);
  const nCuO = parseInt(cuoSlider.value, 10);

  for (let i = 0; i < nH2; i++) gas.push(new H2Mol());
  buildSolidPile(nCuO);

  step();
}

// --- UI ---
tempSlider.oninput = () => tempVal.textContent = tempSlider.value;
h2Slider.oninput = () => h2Val.textContent = h2Slider.value;
cuoSlider.oninput = () => cuoVal.textContent = cuoSlider.value;

toggleAtomsBtn.onclick = () => {
  showAtoms = !showAtoms;
  toggleAtomsBtn.textContent = `Atomes : ${showAtoms ? "ON" : "OFF"}`;
};

pauseBtn.onclick = () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Lecture" : "Pause";
};

restartBtn.onclick = init;

// init affichage
tempVal.textContent = tempSlider.value;
h2Val.textContent = h2Slider.value;
cuoVal.textContent = cuoSlider.value;

init();
