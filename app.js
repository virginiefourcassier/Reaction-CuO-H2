// v2 – corrections visuelles solides + fond
// 1) tous les atomes du tas solide visibles (pas masqués)
// 2) tas posé sur le bas de la fenêtre (contact visuel)
// 3) fond gris clair pour mieux voir H2 blanc

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
  H: { r: 6, color: "#ffffff", label: "H" },
  O: { r: 8, color: "#e53935", label: "O" },
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

function drawCu(cx, cy) {
  drawAtom(cx, cy, AT.Cu);
}

class SolidParticle {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vib = rand(0, Math.PI*2);
  }
  draw() {
    const Tc = parseFloat(tempSlider.value);
    const vibAmp = 0.2 + (Tc/120)*0.4;
    const ox = Math.cos(this.vib) * vibAmp;
    const oy = Math.sin(this.vib) * vibAmp;
    this.vib += 0.03;
    if (this.kind === "CuO") drawCuO(this.x + ox, this.y + oy);
    if (this.kind === "Cu") drawCu(this.x + ox, this.y + oy);
  }
}

// Tas solide posé au sol
let solid = [];

function buildSolidPile(nCuO) {
  solid = [];
  const groundY = canvas.height - 20; // contact bas visible
  const spacing = 20;
  const baseX = canvas.width / 2;

  let placed = 0;
  let row = 0;
  while (placed < nCuO) {
    const inRow = Math.min(nCuO - placed, 6);
    const y = groundY - row * spacing;
    const xStart = baseX - (inRow - 1) * (spacing * 0.5);
    for (let k = 0; k < inRow && placed < nCuO; k++) {
      const x = xStart + k * spacing + rand(-2,2);
      solid.push(new SolidParticle("CuO", x, y));
      placed++;
    }
    row++;
  }
}

// Gaz minimal (H2 seulement pour contexte visuel)
class GasMol {
  constructor() {
    this.x = rand(50, canvas.width - 50);
    this.y = rand(50, canvas.height - 200);
  }
  draw() {
    drawAtom(this.x - AT.H.r, this.y, AT.H);
    drawAtom(this.x + AT.H.r, this.y, AT.H);
  }
}

let gas = [];

function drawScene() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (const s of solid) s.draw();
  for (const g of gas) g.draw();
}

function step() {
  drawScene();
  animId = requestAnimationFrame(step);
}

function init() {
  cancelAnimationFrame(animId);
  paused = false;
  gas = [];
  const nH2 = parseInt(h2Slider.value,10);
  const nCuO = parseInt(cuoSlider.value,10);
  for (let i=0;i<nH2;i++) gas.push(new GasMol());
  buildSolidPile(nCuO);
  step();
}

toggleAtomsBtn.onclick = ()=>{
  showAtoms = !showAtoms;
  toggleAtomsBtn.textContent = `Atomes : ${showAtoms?"ON":"OFF"}`;
};
pauseBtn.onclick = ()=>{
  paused = !paused;
  pauseBtn.textContent = paused?"Lecture":"Pause";
};
restartBtn.onclick = init;

tempVal.textContent = tempSlider.value;
h2Val.textContent = h2Slider.value;
cuoVal.textContent = cuoSlider.value;

init();
