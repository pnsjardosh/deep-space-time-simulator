import { solarGeometrySnapshot } from "../solar-geometry/model.js";
import { initSolarGeometryTimeline, updateSolarGeometryPanel } from "../solar-geometry/view.js";

const STEP_YEARS = 100;
const GALAXY_VISUAL_ROTATION_MULTIPLIER = 720;
const MAX_ABS_YEAR = 1000000000;

const yearInput = document.querySelector("#galacticYearInput");
const playButton = document.querySelector("#galacticPlay");
const reverseButton = document.querySelector("#galacticReverse");
const forwardButton = document.querySelector("#galacticForward");
const resetButton = document.querySelector("#galacticReset");
const stepBackButton = document.querySelector("#galacticStepBack");
const stepForwardButton = document.querySelector("#galacticStepForward");
const speedButtons = document.querySelectorAll("[data-galactic-speed]");

let selectedYear = new Date().getFullYear();
let direction = 0;
let frameId = 0;
let lastFrameTime = 0;
let yearsPerSecond = 100;

const solarLocation = { name: "Ujjain, India", lat: 23.1765, lon: 75.7885 };

function formatSolarDateTime(date) {
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function initSolarGeometrySection() {
  initSolarGeometryTimeline();
  updateSolarGeometryPanel({
    date: new Date(),
    location: solarLocation,
    formatDateTime: formatSolarDateTime
  });
}

function clampYear(year) {
  return Math.max(-MAX_ABS_YEAR, Math.min(MAX_ABS_YEAR, year));
}

function signedOffset(year) {
  const offset = Math.round(year - new Date().getFullYear());
  if (Math.abs(offset) < 1) return "present";
  return `${offset > 0 ? "+" : ""}${offset.toLocaleString()} years`;
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function rotatePoint(point, center, degrees) {
  const radians = degrees * Math.PI / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians)
  };
}

function formatSpeed(value) {
  if (value >= 1000000) return `${value / 1000000}M years/sec`;
  if (value >= 1000) return `${value / 1000}k years/sec`;
  return `${value} years/sec`;
}

function renderCards(selector, stars, activeName) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = stars.map((star) => `
    <div class="${star.name === activeName ? "active" : ""}">
      <strong>${star.name}</strong>
      <span>${star.constellation} / near ${star.year}</span>
      <small>${star.note}; approx ${star.distanceDeg} deg from the pole.</small>
    </div>
  `).join("");
}

function drawGalacticOrbit(snapshot) {
  const svg = document.querySelector("#galacticOrbitSvg");
  if (!svg) return;
  const cx = 405;
  const cy = 315;
  const orbitAngle = snapshot.galactic.orbitAngle * Math.PI / 180;
  const realRotationDegrees = snapshot.galactic.orbitAngle;
  const visualRotationDegrees = realRotationDegrees * GALAXY_VISUAL_ROTATION_MULTIPLIER;
  const baseSunAngle = -35 * Math.PI / 180;
  const orbitalRadius = 205;
  const center = { x: cx, y: cy };
  const localSun = {
    x: cx + Math.cos(baseSunAngle + orbitAngle) * orbitalRadius,
    y: cy + Math.sin(baseSunAngle + orbitAngle) * orbitalRadius * 0.82
  };
  const sun = rotatePoint(localSun, center, visualRotationDegrees);
  const tangent = baseSunAngle + orbitAngle + Math.PI / 2 + visualRotationDegrees * Math.PI / 180;
  const arrow = {
    x: sun.x + Math.cos(tangent) * 48,
    y: sun.y + Math.sin(tangent) * 40
  };
  const spur = {
    x: localSun.x - 36,
    y: localSun.y + 8
  };
  const spurLabel = rotatePoint({ x: spur.x + 82, y: spur.y + 42 }, center, visualRotationDegrees);
  svg.innerHTML = `
    <defs>
      <filter id="galaxyGlow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="sunMarkerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.98)"/>
        <stop offset="38%" stop-color="rgba(159,242,255,0.94)"/>
        <stop offset="100%" stop-color="rgba(159,242,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="1100" height="620" rx="18" fill="rgba(1,4,10,0.86)"/>
    <g class="galaxy-rotating-layer" transform="rotate(${visualRotationDegrees.toFixed(4)} ${cx} ${cy})">
      <image href="./assets/milky-way-pia10748.jpg" x="55" y="35" width="700" height="700" opacity="0.88" preserveAspectRatio="xMidYMid slice"/>
      <path d="M ${spur.x - 112} ${spur.y - 34} C ${spur.x - 58} ${spur.y - 66}, ${spur.x + 72} ${spur.y + 46}, ${spur.x + 158} ${spur.y + 6}" fill="none" stroke="rgba(89,210,199,0.74)" stroke-width="16" stroke-linecap="round" opacity="0.9"/>
      <circle cx="${localSun.x}" cy="${localSun.y}" r="25" fill="url(#sunMarkerGlow)" filter="url(#galaxyGlow)"/>
      <circle cx="${localSun.x}" cy="${localSun.y}" r="7" fill="#ffffff"/>
    </g>
    <rect x="55" y="35" width="700" height="550" fill="rgba(1,4,10,0.12)" pointer-events="none"/>
    <ellipse cx="${cx}" cy="${cy}" rx="310" ry="254" fill="none" stroke="rgba(159,242,255,0.12)" stroke-width="32"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${orbitalRadius}" ry="${orbitalRadius * 0.82}" fill="none" stroke="rgba(246,200,76,0.72)" stroke-width="4" stroke-dasharray="14 12"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="rgba(255,245,204,0.92)" stroke="rgba(5,8,15,0.82)" stroke-width="3"/>
    <line x1="${cx - 18}" y1="${cy}" x2="${cx - 8}" y2="${cy}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx + 8}" y1="${cy}" x2="${cx + 18}" y2="${cy}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy - 18}" x2="${cx}" y2="${cy - 8}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy + 8}" x2="${cx}" y2="${cy + 18}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <text x="${cx}" y="${cy + 66}" class="solar-svg-label" text-anchor="middle">Galactic Center</text>
    <text x="${spurLabel.x}" y="${spurLabel.y}" class="solar-svg-label">Orion Spur / Local Arm</text>
    <text x="${spurLabel.x}" y="${spurLabel.y + 24}" class="solar-svg-mini">between Sagittarius and Perseus</text>
    <line x1="${sun.x}" y1="${sun.y}" x2="${arrow.x}" y2="${arrow.y}" stroke="#9ff2ff" stroke-width="6" stroke-linecap="round"/>
    <path d="M ${arrow.x - 13} ${arrow.y - 6} L ${arrow.x} ${arrow.y} L ${arrow.x - 5} ${arrow.y - 14}" fill="none" stroke="#9ff2ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${sun.x}" y="${sun.y - 32}" class="solar-svg-label" text-anchor="middle">Sun + Solar System</text>
    <text x="792" y="72" class="solar-svg-title">Approximate galactic location</text>
    <text x="792" y="108" class="solar-svg-label">Radius from center: ~26-27k light years</text>
    <text x="792" y="138" class="solar-svg-label">Local structure: ${snapshot.galactic.arm}</text>
    <text x="792" y="168" class="solar-svg-label">Orbit period: ~${(snapshot.galactic.galacticYearYears / 1000000).toFixed(0)}M years</text>
    <text x="792" y="198" class="solar-svg-label">Speed: ~${snapshot.galactic.speedKmS} km/s</text>
    <text x="792" y="246" class="solar-svg-mini">The yellow path shows the Sun's approximate orbit around the galactic center.</text>
    <text x="792" y="274" class="solar-svg-mini">The blue arrow shows rotation/motion direction in this chosen face-on view.</text>
    <text x="792" y="302" class="solar-svg-mini">The Sun marker is attached to the local arm for this simplified model.</text>
    <text x="792" y="354" class="solar-svg-label">Selected offset: ${signedOffset(selectedYear)}</text>
    <text x="792" y="384" class="solar-svg-mini">True orbital phase change: ${realRotationDegrees.toFixed(4)} deg.</text>
    <text x="792" y="412" class="solar-svg-mini">Playback speed: ${formatSpeed(yearsPerSecond)}.</text>
    <text x="792" y="440" class="solar-svg-mini">Background rotation is magnified ${GALAXY_VISUAL_ROTATION_MULTIPLIER}x so motion is visible.</text>
    <text x="70" y="574" class="solar-svg-mini">Background: NASA/JPL-Caltech Spitzer Milky Way artist concept PIA10748.</text>
  `;
}

function drawPoleCycle(snapshot) {
  const svg = document.querySelector("#poleCycleSvg");
  if (!svg) return;
  const cx = 210;
  const cy = 158;
  const radius = 98;
  const phase = snapshot.deepTime.precession * Math.PI / 180;
  const pointer = {
    x: cx + Math.cos(phase - Math.PI / 2) * radius,
    y: cy + Math.sin(phase - Math.PI / 2) * radius
  };
  const labels = [
    ["Polaris", -90],
    ["Vega", 70],
    ["Thuban", 198],
    ["Alderamin", 22]
  ];
  svg.innerHTML = `
    <rect width="420" height="320" rx="12" fill="rgba(0,0,0,0.18)"/>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(159,242,255,0.32)" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="rgba(255,255,255,0.75)"/>
    <line x1="${cx}" y1="${cy}" x2="${pointer.x}" y2="${pointer.y}" stroke="#f6c84c" stroke-width="5" stroke-linecap="round"/>
    <circle cx="${pointer.x}" cy="${pointer.y}" r="9" fill="#f6c84c"/>
    ${labels.map(([label, degrees]) => {
      const radians = degrees * Math.PI / 180;
      const x = cx + Math.cos(radians) * (radius + 30);
      const y = cy + Math.sin(radians) * (radius + 30);
      return `<text x="${x}" y="${y}" class="solar-svg-mini" text-anchor="middle">${label}</text>`;
    }).join("")}
    <text x="${cx}" y="292" class="solar-svg-label" text-anchor="middle">Precession phase ${snapshot.deepTime.precession.toFixed(1)} deg</text>
  `;
}

function render() {
  selectedYear = clampYear(Number.parseFloat(yearInput?.value) || new Date().getFullYear());
  if (yearInput && document.activeElement !== yearInput) yearInput.value = String(Math.round(selectedYear));
  const snapshot = solarGeometrySnapshot(new Date(), selectedYear, { name: "Earth", lat: 0, lon: 0 });
  drawGalacticOrbit(snapshot);
  drawPoleCycle(snapshot);
  setText("#galacticOrbitNote", snapshot.galactic.note);
  setText("#galacticOrbitPercent", `${snapshot.galactic.orbitPercent.toFixed(4)}%`);
  setText("#galacticSpeed", `${snapshot.galactic.speedKmS} km/s`);
  setText("#galacticArm", snapshot.galactic.arm);
  renderCards("#northPoleStars", snapshot.poleStars.northStars, snapshot.poleStars.currentNorth.name);
  renderCards("#southPoleStars", snapshot.poleStars.southStars, snapshot.poleStars.currentSouth.name);
  playButton.classList.toggle("playing", direction !== 0);
  playButton.classList.toggle("active", direction === 0);
  playButton.setAttribute("aria-label", direction ? "Pause" : "Play");
  playButton.setAttribute("title", direction ? "Pause" : "Play");
  playButton.setAttribute("aria-pressed", direction ? "true" : "false");
  reverseButton.classList.toggle("active", direction < 0);
  forwardButton.classList.toggle("active", direction > 0);
  speedButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.galacticSpeed) === yearsPerSecond);
  });
}

function stop() {
  direction = 0;
  lastFrameTime = 0;
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  render();
}

function tick(timestamp) {
  if (!direction) return;
  if (!lastFrameTime) lastFrameTime = timestamp;
  const delta = Math.min(0.12, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;
  selectedYear = clampYear(selectedYear + direction * yearsPerSecond * delta);
  if (yearInput) yearInput.value = String(Math.round(selectedYear));
  render();
  if (Math.abs(selectedYear) >= MAX_ABS_YEAR) {
    stop();
    return;
  }
  frameId = requestAnimationFrame(tick);
}

function play(nextDirection) {
  if (direction === nextDirection) {
    stop();
    return;
  }
  direction = nextDirection;
  lastFrameTime = 0;
  if (!frameId) frameId = requestAnimationFrame(tick);
  render();
}

yearInput?.addEventListener("input", render);
yearInput?.addEventListener("change", render);
stepBackButton?.addEventListener("click", () => {
  selectedYear = clampYear(selectedYear - STEP_YEARS);
  yearInput.value = String(Math.round(selectedYear));
  render();
});
stepForwardButton?.addEventListener("click", () => {
  selectedYear = clampYear(selectedYear + STEP_YEARS);
  yearInput.value = String(Math.round(selectedYear));
  render();
});
speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const speed = Number(button.dataset.galacticSpeed);
    if (Number.isFinite(speed) && speed > 0) {
      yearsPerSecond = speed;
      render();
    }
  });
});
reverseButton?.addEventListener("click", () => play(-1));
forwardButton?.addEventListener("click", () => play(1));
playButton?.addEventListener("click", () => direction ? stop() : play(1));
resetButton?.addEventListener("click", () => {
  selectedYear = new Date().getFullYear();
  yearInput.value = String(selectedYear);
  stop();
});

initSolarGeometrySection();
render();
