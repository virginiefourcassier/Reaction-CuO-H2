// v4 – réaction rapide (chocs efficaces + état final plus rapide)
// Réaction implicite : CuO(s) + H2(g) -> Cu(s) + H2O(g) (sans écrire l'équation)
// Corrections conservées :
// - Tas solide posé au sol, unités Cu–O toutes visibles (pas de chevauchement)
// - Fond gris clair
// - H2 mobile
// - Proportions stœchiométriques par défaut (H2 = CuO = 10)
// + Accélération :
//   * température max étendue (jusqu'à 200°C) + défaut 80°C
//   * probabilité de réaction fortement augmentée au début
//   * "zone de contact" interface élargie
//   * boost surface sur les CuO de la couche supérieure

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
let showDiag = false;
let trapMode = false;

// vitesse réaction prof (R pour cycler) – masqué
const rLevels = [0.7, 1.0, 1.7, 2.7, 4.0];
let rIdx = 2; // par défaut un peu plus rapide

// accélération initiale (sans UI) : fort boost les premières secondes
let t0 = performance.now();
function earlyBoostFactor() {
  const dt = (performance.now() - t0) / 1000; // s
  // boost fort pendant 0–12 s, puis retour à 1
  if (dt < 6) return 3.2;
  if (dt < 12) return 2.0;
  return 1.0;
}

const AT = {
  H:  { r: 6,  color: "#ffffff", label: "H" },
  O:  { r: 8,  color: "#e53935", label: "O" },
  Cu: { r: 10, color: "#b87333", label: "Cu" }
};

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function dist(ax, ay, bx, by) { const dx=ax-bx, dy=ay-by; return Math.sqrt(dx*dx+dy*dy); }
function normalize(dx, dy) {
  const d = Math.sqrt(dx*dx + dy*dy) || 1;
  return { x: dx/d, y: dy/d };
}

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

function drawH2O(cx, cy) {
  // compact H-O-H (angle simplifié)
  drawAtom(cx, cy, AT.O);
  drawAtom(cx - (AT.O.r + AT.H.r - 2), cy + (AT.O.r - 2), AT.H);
  drawAtom(cx + (AT.O.r + AT.H.r - 2), cy + (AT.O.r - 2), AT.H);
}

// --- Solide ---
class SolidUnit {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.phase = rand(0, Math.PI*2);
    this.kind = "CuO"; // devient "Cu"
  }
  isSurface() {
    // approximation : les unités avec petit y (plus haut) sont "surface"
    return this.y < canvas.height - 70;
  }
  draw() {
    const Tc = parseFloat(tempSlider.value);
    const vib = 0.12 + (Tc/200)*0.35; // très faible
    const ox = Math.cos(this.phase) * vib;
    const oy = Math.sin(this.phase) * vib;
    this.phase += 0.03;

    if (this.kind === "CuO") drawCuO(this.x + ox, this.y + oy);
    else drawCu(this.x + ox, this.y + oy);
  }
}

let solid = [];

function buildSolidPile(n) {
  solid = [];
  const groundY = canvas.height - 18;
  const colsMax = 7;
  const dx = 34;
  const dy = 28;

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
    if (row > 10) break;
  }
}

// --- Gaz ---
class H2Mol {
  constructor() {
    this.x = rand(60, canvas.width - 60);
    this.y = rand(60, canvas.height - 220);
    this.vx = rand(-1, 1);
    this.vy = rand(-1, 1);
    this.used = false;
  }
  envelopeRadius() { return AT.H.r + AT.H.r + 6; }
  move(speed) {
    this.x += this.vx * speed;
    this.y += this.vy * speed;
    const r = this.envelopeRadius();
    if (this.x < r) { this.x = r; this.vx *= -1; }
    if (this.x > canvas.width - r) { this.x = canvas.width - r; this.vx *= -1; }
    if (this.y < r) { this.y = r; this.vy *= -1; }
    if (this.y > canvas.height - r) { this.y = canvas.height - r; this.vy *= -1; }
  }
  draw() {
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

class H2OMol {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = rand(-1, 1);
    this.vy = rand(-1, 1);
  }
  envelopeRadius() { return AT.O.r + AT.H.r + AT.H.r + 8; }
  move(speed) {
    this.x += this.vx * speed;
    this.y += this.vy * speed;
    const r = this.envelopeRadius();
    if (this.x < r) { this.x = r; this.vx *= -1; }
    if (this.x > canvas.width - r) { this.x = canvas.width - r; this.vx *= -1; }
    if (this.y < r) { this.y = r; this.vy *= -1; }
    if (this.y > canvas.height - r) { this.y = canvas.height - r; this.vy *= -1; }
  }
  draw() { drawH2O(this.x, this.y); }
}

let gasH2 = [];
let gasH2O = [];
let reactionsDone = 0;
let initial = { H2: 0, CuO: 0 };

// --- Anti-chevauchement gaz (H2 seulement) ---
function resolveOverlapsH2(list) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.used) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.used) continue;

      const ra = a.envelopeRadius();
      const rb = b.envelopeRadius();
      const d = dist(a.x, a.y, b.x, b.y);
      const minD = ra + rb;

      if (d < minD && d > 0.001) {
        const overlap = (minD - d);
        const n = normalize(a.x - b.x, a.y - b.y);
        a.x += n.x * (overlap * 0.55);
        a.y += n.y * (overlap * 0.55);
        b.x -= n.x * (overlap * 0.55);
        b.y -= n.y * (overlap * 0.55);
      }
    }
  }
}

// --- Cinétique (plus réactive) ---
function kinetic() {
  const Tc = parseFloat(tempSlider.value);
  const Tk = Tc + 273.15;

  // agitation : [0.7 ; 5.0]
  let speed = 0.7 + ((Tc - 10) / (200 - 10)) * 4.3;
  speed = clamp(speed, 0.6, 5.0);

  // probabilité de réaction (base) : Arrhenius + cap haut
  const Rg = 8.314;
  const Ea = 8000;   // plus faible => plus réactif
  const A = 1.1;     // plus fort
  let p = A * Math.exp(-Ea / (Rg * Tk));

  // boost prof + boost initial
  p *= rLevels[rIdx] * earlyBoostFactor();

  // mode piège basse T
  if (Tc < 30) {
    const factor = trapMode ? 0.01 : 0.10;
    p *= factor;
    speed *= trapMode ? 0.55 : 0.82;
  }

  p = clamp(p, 0, 0.85);
  return { speed, p };
}

// --- Réaction interface gaz/solide ---
function interfaceReactions(pReact) {
  // réaction au voisinage d'un CuO (surface). On élargit le contact pour plus d'efficacité.
  const contactFactor = 1.55;

  for (const h2 of gasH2) {
    if (h2.used) continue;

    // on cherche un CuO proche ; pour accélérer, on autorise plus de proximité
    for (const s of solid) {
      if (s.kind !== "CuO") continue;

      const rGas = h2.envelopeRadius();
      const rSol = 18;
      const threshold = (rGas + rSol) * contactFactor;

      const d = dist(h2.x, h2.y, s.x, s.y);
      if (d <= threshold) {
        // rebond (évite qu'ils restent "collés")
        h2.vx *= -1; h2.vy *= -1;

        // boost surface : unités plus hautes plus réactives
        const surfaceBoost = s.isSurface() ? 1.25 : 1.0;

        if (Math.random() < pReact * surfaceBoost) {
          h2.used = true;
          s.kind = "Cu"; // CuO -> Cu
          // produire 1 H2O (gaz)
          const w = new H2OMol(s.x + rand(-18,18), s.y - rand(12,32));
          gasH2O.push(w);
          reactionsDone += 1;
          break;
        }
      }
    }
  }

  // enlever les H2 consommés
  gasH2 = gasH2.filter(m => !m.used);
}

function counts() {
  const h2 = gasH2.length;
  const h2o = gasH2O.length;
  const cuo = solid.filter(s => s.kind === "CuO").length;
  const cu = solid.filter(s => s.kind === "Cu").length;
  return { h2, h2o, cuo, cu };
}

function diagOverlay() {
  const Tc = parseFloat(tempSlider.value);
  const c = counts();

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#111";
  ctx.fillRect(12, 12, 360, 154);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";

  ctx.font = "14px Arial";
  ctx.fillText("Diagnostic prof (P)", 22, 34);

  ctx.font = "13px Arial";
  ctx.fillText(`T = ${Tc.toFixed(0)} °C   |   Mode piège (T) : ${trapMode ? "ON" : "OFF"}`, 22, 56);
  ctx.fillText(`Vitesse réaction (R) : ×${rLevels[rIdx].toFixed(1)}   |   Boost début : ×${earlyBoostFactor().toFixed(1)}`, 22, 76);

  ctx.fillText(`Initial : H2=${initial.H2}   CuO=${initial.CuO}`, 22, 98);
  ctx.fillText(`Restant : H2=${c.h2}   CuO=${c.cuo}`, 22, 118);
  ctx.fillText(`Produits : H2O=${c.h2o}   Cu=${c.cu}`, 22, 138);
  ctx.fillText(`Événements réaction : ${reactionsDone}`, 22, 158);

  ctx.restore();
}

// --- Boucle ---
function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // solide d'abord
  for (const s of solid) s.draw();
  // gaz
  for (const h2 of gasH2) h2.draw();
  for (const w of gasH2O) w.draw();

  if (showDiag) diagOverlay();
}

function step() {
  if (!paused) {
    const { speed, p } = kinetic();

    for (const h2 of gasH2) h2.move(speed);
    for (const w of gasH2O) w.move(speed);

    resolveOverlapsH2(gasH2);

    interfaceReactions(p);
  }

  drawScene();
  animId = requestAnimationFrame(step);
}

// --- Init ---
function init() {
  cancelAnimationFrame(animId);
  paused = false;
  pauseBtn.textContent = "Pause";

  t0 = performance.now();

  reactionsDone = 0;
  gasH2 = [];
  gasH2O = [];

  const nH2 = parseInt(h2Slider.value, 10);
  const nCuO = parseInt(cuoSlider.value, 10);

  for (let i = 0; i < nH2; i++) gasH2.push(new H2Mol());
  buildSolidPile(nCuO);

  initial = { H2: nH2, CuO: nCuO };

  // nettoyage initial
  for (let k = 0; k < 160; k++) resolveOverlapsH2(gasH2);

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

// touches masquées
window.addEventListener("keydown", (e) => {
  const k = (e.key || "").toLowerCase();
  if (k === "p") showDiag = !showDiag;
  if (k === "t") trapMode = !trapMode;
  if (k === "r") rIdx = (rIdx + 1) % rLevels.length;
});

// init affichage
tempVal.textContent = tempSlider.value;
h2Val.textContent = h2Slider.value;
cuoVal.textContent = cuoSlider.value;

init();
