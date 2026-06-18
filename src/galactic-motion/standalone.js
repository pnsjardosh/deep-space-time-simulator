import { solarGeometrySnapshot } from "../solar-geometry/model.js";
import { initSolarGeometryTimeline, updateSolarGeometryPanel } from "../solar-geometry/view.js";

const STEP_YEARS = 100;
const GALAXY_VISUAL_ROTATION_MULTIPLIER = 720;
const MAX_ABS_YEAR = 1000000000;
const PLAYBACK_RENDER_INTERVAL_MS = 34;
const SOLAR_PANEL_RENDER_INTERVAL_MS = 120;
const GALACTIC_DETAIL_RENDER_INTERVAL_MS = 180;
const LOCATION_PRESETS = {
  ujjain: { name: "Ujjain, India", lat: 23.1765, lon: 75.7885 },
  ahmedabad: { name: "Ahmedabad, India", lat: 23.0225, lon: 72.5714 },
  "new-york": { name: "New York, USA", lat: 40.7128, lon: -74.006 },
  london: { name: "London, UK", lat: 51.5074, lon: -0.1278 },
  sydney: { name: "Sydney, Australia", lat: -33.8688, lon: 151.2093 },
  equator: { name: "Equator / Greenwich", lat: 0, lon: 0 },
  "north-polar": { name: "High North", lat: 78.2232, lon: 15.6469 },
  "south-polar": { name: "High South", lat: -77.8419, lon: 166.6863 }
};

const yearInput = document.querySelector("#galacticYearInput");
const locationPreset = document.querySelector("#galacticLocationPreset");
const latInput = document.querySelector("#galacticLatInput");
const lonInput = document.querySelector("#galacticLonInput");
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
let lastRenderTime = 0;
let lastSolarPanelRenderTime = 0;
let lastGalacticDetailRenderTime = 0;
let lastGalacticCardsKey = "";
let yearsPerSecond = 100;
const sectionVisibility = new Map();

let solarLocation = getInitialLocation();

function clampNumber(value, min, max, fallback) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function getInitialLocation() {
  const params = new URLSearchParams(window.location.search);
  const lat = Number.parseFloat(params.get("lat"));
  const lon = Number.parseFloat(params.get("lon"));
  const loc = params.get("loc");
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      name: loc || "Custom location",
      lat: Math.max(-90, Math.min(90, lat)),
      lon: Math.max(-180, Math.min(180, lon))
    };
  }
  return { ...LOCATION_PRESETS.ujjain };
}

function locationMatchesPreset(location) {
  return Object.entries(LOCATION_PRESETS).find(([, preset]) => {
    return Math.abs(preset.lat - location.lat) < 0.0001 && Math.abs(preset.lon - location.lon) < 0.0001;
  })?.[0] || "custom";
}

function syncLocationControls() {
  if (locationPreset) locationPreset.value = locationMatchesPreset(solarLocation);
  if (latInput && document.activeElement !== latInput) latInput.value = solarLocation.lat.toFixed(4);
  if (lonInput && document.activeElement !== lonInput) lonInput.value = solarLocation.lon.toFixed(4);
}

function setSolarLocation(nextLocation, shouldUpdateUrl = true) {
  solarLocation = {
    name: nextLocation.name || "Custom location",
    lat: clampNumber(nextLocation.lat, -90, 90, solarLocation.lat),
    lon: clampNumber(nextLocation.lon, -180, 180, solarLocation.lon)
  };
  syncLocationControls();
  if (shouldUpdateUrl) updateLocationUrl();
  render(true);
}

function readManualLocation() {
  const lat = clampNumber(latInput?.value, -90, 90, solarLocation.lat);
  const lon = clampNumber(lonInput?.value, -180, 180, solarLocation.lon);
  const presetName = locationPreset?.value === "custom"
    ? "Custom location"
    : LOCATION_PRESETS[locationPreset?.value]?.name || solarLocation.name;
  setSolarLocation({ name: presetName, lat, lon });
}

function updateLocationUrl() {
  const params = new URLSearchParams(window.location.search);
  params.set("loc", solarLocation.name);
  params.set("lat", solarLocation.lat.toFixed(4));
  params.set("lon", solarLocation.lon.toFixed(4));
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

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

function setupSectionVisibility() {
  const selectors = [".solar-geometry-panel", ".galactic-panel"];
  selectors.forEach((selector) => sectionVisibility.set(selector, true));
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const selector = entry.target.matches(".solar-geometry-panel") ? ".solar-geometry-panel" : ".galactic-panel";
      sectionVisibility.set(selector, entry.isIntersecting);
      if (entry.isIntersecting) render(true);
    });
  }, { rootMargin: "240px 0px" });
  selectors.forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) observer.observe(element);
  });
}

function isSectionVisible(selector) {
  return sectionVisibility.get(selector) !== false;
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

function renderGalacticCards(snapshot) {
  const key = [
    Math.round(selectedYear),
    snapshot.poleStars.currentNorth.name,
    snapshot.poleStars.currentSouth.name
  ].join(":");
  if (key === lastGalacticCardsKey) return;
  renderCards("#northPoleStars", snapshot.poleStars.northStars, snapshot.poleStars.currentNorth.name);
  renderCards("#southPoleStars", snapshot.poleStars.southStars, snapshot.poleStars.currentSouth.name);
  lastGalacticCardsKey = key;
}

function formatHistoricalYear(year) {
  if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`;
  return `${Math.round(year).toLocaleString()} CE`;
}

function renderPoleStarSummary(snapshot) {
  const selected = formatHistoricalYear(selectedYear);
  const north = snapshot.poleStars.currentNorth;
  const south = snapshot.poleStars.currentSouth;
  setText("#currentNorthPoleStar", `${north.name} / ${north.constellation}`);
  setText("#currentSouthPoleStar", `${south.name} / ${south.constellation}`);
  setText("#currentNorthPoleMeta", `North guide for ${selected}; closest listed near ${formatHistoricalYear(north.year)}, ~${north.distanceDeg} deg from pole.`);
  setText("#currentSouthPoleMeta", `South guide for ${selected}; closest listed near ${formatHistoricalYear(south.year)}, ~${south.distanceDeg} deg from pole.`);
}

function renderGalacticContext(snapshot, realRotationDegrees) {
  const container = document.querySelector("#galacticContextList");
  const orbitNotes = document.querySelector("#galacticOrbitNotes");
  const html = `
    <div><strong>~26-27k light years</strong><small>Approximate radius from galactic center</small></div>
    <div><strong>~${(snapshot.galactic.galacticYearYears / 1000000).toFixed(0)}M years</strong><small>Approximate galactic orbit period</small></div>
    <div><strong>${signedOffset(selectedYear)}</strong><small>Selected deep-time offset</small></div>
    <div><strong>${realRotationDegrees.toFixed(4)} deg</strong><small>True galactic orbital phase change</small></div>
    <div><strong>${formatSpeed(yearsPerSecond)}</strong><small>Playback speed</small></div>
  `;
  if (container && container.dataset.renderKey !== html) {
    container.innerHTML = html;
    container.dataset.renderKey = html;
  }
  const notesHtml = `
    <div><strong>Motion guide</strong><small>Yellow path = approximate orbit; blue arrow = motion direction.</small></div>
    <div><strong>Visual scale</strong><small>Galaxy rotation is magnified ${GALAXY_VISUAL_ROTATION_MULTIPLIER}x so motion is visible.</small></div>
  `;
  if (orbitNotes && orbitNotes.dataset.renderKey !== notesHtml) {
    orbitNotes.innerHTML = notesHtml;
    orbitNotes.dataset.renderKey = notesHtml;
  }
}

function drawGalacticOrbit(snapshot) {
  const svg = document.querySelector("#galacticOrbitSvg");
  if (!svg) return;
  const cx = 380;
  const cy = 310;
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
  svg.innerHTML = `
    <defs>
      <filter id="galaxyGlow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="sunMarkerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.98)"/>
        <stop offset="38%" stop-color="rgba(159,242,255,0.94)"/>
        <stop offset="100%" stop-color="rgba(159,242,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="760" height="620" rx="18" fill="rgba(1,4,10,0.86)"/>
    <g class="galaxy-rotating-layer" transform="rotate(${visualRotationDegrees.toFixed(4)} ${cx} ${cy})">
      <image href="./assets/milky-way-pia10748.jpg" x="30" y="-40" width="700" height="700" opacity="0.88" preserveAspectRatio="xMidYMid slice"/>
      <circle cx="${localSun.x}" cy="${localSun.y}" r="25" fill="url(#sunMarkerGlow)" filter="url(#galaxyGlow)"/>
      <circle cx="${localSun.x}" cy="${localSun.y}" r="7" fill="#ffffff"/>
    </g>
    <rect x="30" y="0" width="700" height="620" fill="rgba(1,4,10,0.12)" pointer-events="none"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${orbitalRadius}" ry="${orbitalRadius * 0.82}" fill="none" stroke="rgba(246,200,76,0.72)" stroke-width="4" stroke-dasharray="14 12"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="rgba(255,245,204,0.92)" stroke="rgba(5,8,15,0.82)" stroke-width="3"/>
    <line x1="${cx - 18}" y1="${cy}" x2="${cx - 8}" y2="${cy}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx + 8}" y1="${cy}" x2="${cx + 18}" y2="${cy}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy - 18}" x2="${cx}" y2="${cy - 8}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy + 8}" x2="${cx}" y2="${cy + 18}" stroke="rgba(255,245,204,0.82)" stroke-width="2" stroke-linecap="round"/>
    <text x="${cx}" y="${cy + 66}" class="solar-svg-label" text-anchor="middle">Galactic Center</text>
    <line x1="${sun.x}" y1="${sun.y}" x2="${arrow.x}" y2="${arrow.y}" stroke="#9ff2ff" stroke-width="6" stroke-linecap="round"/>
    <path d="M ${arrow.x - 13} ${arrow.y - 6} L ${arrow.x} ${arrow.y} L ${arrow.x - 5} ${arrow.y - 14}" fill="none" stroke="#9ff2ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${sun.x}" y="${sun.y - 32}" class="solar-svg-label" text-anchor="middle">Sun + Solar System</text>
    <text x="70" y="574" class="solar-svg-mini">Background: NASA/JPL-Caltech Spitzer Milky Way artist concept PIA10748.</text>
  `;
  renderGalacticContext(snapshot, realRotationDegrees);
}

function drawPoleCycle(snapshot) {
  const svg = document.querySelector("#poleCycleSvg");
  if (!svg) return;
  const cx = 210;
  const cy = 154;
  const earthRadius = 42;
  const pathRx = 122;
  const pathRy = 66;
  const phase = snapshot.deepTime.precession * Math.PI / 180;
  const axisAngleDegrees = snapshot.deepTime.precession;
  const northPointer = {
    x: cx + Math.cos(phase - Math.PI / 2) * pathRx,
    y: cy + Math.sin(phase - Math.PI / 2) * pathRy
  };
  const southPointer = {
    x: cx - Math.cos(phase - Math.PI / 2) * pathRx,
    y: cy - Math.sin(phase - Math.PI / 2) * pathRy
  };
  const axisNorth = {
    x: cx + Math.cos(phase - Math.PI / 2) * 78,
    y: cy + Math.sin(phase - Math.PI / 2) * 78
  };
  const axisSouth = {
    x: cx - Math.cos(phase - Math.PI / 2) * 78,
    y: cy - Math.sin(phase - Math.PI / 2) * 78
  };
  const northLabels = [
    ["Polaris", -90],
    ["Vega", 70],
    ["Thuban", 198],
    ["Alderamin", 22]
  ];
  const southLabels = [
    ["Sigma Oct", 90],
    ["Crux region", -18],
    ["Canopus", -120],
    ["Achernar", 180]
  ];
  svg.innerHTML = `
    <defs>
      <filter id="precessionGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="poleEarthClip"><circle cx="${cx}" cy="${cy}" r="${earthRadius}"/></clipPath>
    </defs>
    <rect width="420" height="320" rx="12" fill="rgba(0,0,0,0.18)"/>
    <text x="20" y="34" class="solar-svg-label">North and south pole-star drift</text>
    <text x="20" y="56" class="solar-svg-mini">Stable tilted Earth; both axis ends drift across the sky.</text>
    <ellipse cx="${cx}" cy="${cy}" rx="${pathRx}" ry="${pathRy}" fill="rgba(159,242,255,0.03)" stroke="rgba(159,242,255,0.28)" stroke-width="3" stroke-dasharray="9 9"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${pathRx * 0.72}" ry="${pathRy * 0.72}" fill="none" stroke="rgba(246,200,76,0.18)" stroke-width="2" stroke-dasharray="7 8"/>
    <line x1="${axisSouth.x}" y1="${axisSouth.y}" x2="${axisNorth.x}" y2="${axisNorth.y}" stroke="#f6c84c" stroke-width="6" stroke-linecap="round"/>
    <image href="./assets/earth-blue-marble.jpg" x="${cx - earthRadius}" y="${cy - earthRadius}" width="${earthRadius * 2}" height="${earthRadius * 2}" clip-path="url(#poleEarthClip)" preserveAspectRatio="xMidYMid slice" transform="rotate(${axisAngleDegrees.toFixed(2)} ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="${earthRadius}" fill="none" stroke="rgba(255,255,255,0.68)" stroke-width="2"/>
    <line x1="${axisNorth.x}" y1="${axisNorth.y}" x2="${northPointer.x}" y2="${northPointer.y}" stroke="rgba(246,200,76,0.5)" stroke-width="3" stroke-linecap="round"/>
    <line x1="${axisSouth.x}" y1="${axisSouth.y}" x2="${southPointer.x}" y2="${southPointer.y}" stroke="rgba(159,242,255,0.42)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${northPointer.x}" cy="${northPointer.y}" r="8" fill="#f6c84c" stroke="rgba(255,255,255,0.84)" stroke-width="2"/>
    <circle cx="${southPointer.x}" cy="${southPointer.y}" r="7" fill="#9ff2ff" stroke="rgba(255,255,255,0.76)" stroke-width="2"/>
    <text x="${northPointer.x}" y="${northPointer.y - 14}" class="solar-svg-mini" text-anchor="middle">North</text>
    <text x="${southPointer.x}" y="${southPointer.y + 24}" class="solar-svg-mini" text-anchor="middle">South</text>
    ${northLabels.map(([label, degrees]) => {
      const radians = degrees * Math.PI / 180;
      const x = cx + Math.cos(radians) * (pathRx + 28);
      const y = cy + Math.sin(radians) * (pathRy + 22);
      return `<text x="${x}" y="${y}" class="solar-svg-mini" text-anchor="middle">${label}</text>`;
    }).join("")}
    ${southLabels.map(([label, degrees]) => {
      const radians = degrees * Math.PI / 180;
      const x = cx + Math.cos(radians) * (pathRx * 0.72 + 30);
      const y = cy + Math.sin(radians) * (pathRy * 0.72 + 18);
      return `<text x="${x}" y="${y}" class="solar-svg-mini" text-anchor="middle">${label}</text>`;
    }).join("")}
    <text x="${cx}" y="282" class="solar-svg-label" text-anchor="middle">North: ${snapshot.poleStars.currentNorth.name} / South: ${snapshot.poleStars.currentSouth.name}</text>
    <text x="${cx}" y="304" class="solar-svg-mini" text-anchor="middle">Precession phase ${snapshot.deepTime.precession.toFixed(1)} deg</text>
  `;
}

function render(force = false) {
  const now = performance.now();
  if (!force && direction && now - lastRenderTime < PLAYBACK_RENDER_INTERVAL_MS) return;
  lastRenderTime = now;
  selectedYear = clampYear(Number.parseFloat(yearInput?.value) || new Date().getFullYear());
  if (yearInput && document.activeElement !== yearInput) yearInput.value = String(Math.round(selectedYear));
  const currentDate = new Date();
  const snapshot = solarGeometrySnapshot(currentDate, selectedYear, { name: "Earth", lat: 0, lon: 0 });
  if (isSectionVisible(".solar-geometry-panel") && (force || now - lastSolarPanelRenderTime >= SOLAR_PANEL_RENDER_INTERVAL_MS)) {
    updateSolarGeometryPanel({
      date: currentDate,
      location: solarLocation,
      formatDateTime: formatSolarDateTime,
      timelineYear: selectedYear,
      speedYearsPerSecond: yearsPerSecond
    });
    lastSolarPanelRenderTime = now;
  }
  if (isSectionVisible(".galactic-panel")) {
    drawGalacticOrbit(snapshot);
    if (force || now - lastGalacticDetailRenderTime >= GALACTIC_DETAIL_RENDER_INTERVAL_MS) {
      drawPoleCycle(snapshot);
      renderPoleStarSummary(snapshot);
      setText("#galacticOrbitNote", snapshot.galactic.note);
      setText("#galacticOrbitPercent", `${snapshot.galactic.orbitPercent.toFixed(4)}%`);
      setText("#galacticSpeed", `${snapshot.galactic.speedKmS} km/s`);
      setText("#galacticArm", snapshot.galactic.arm);
      renderGalacticCards(snapshot);
      lastGalacticDetailRenderTime = now;
    }
  }
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
  render(true);
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
  render(true);
}

locationPreset?.addEventListener("change", () => {
  const preset = LOCATION_PRESETS[locationPreset.value];
  if (preset) {
    setSolarLocation({ ...preset });
    return;
  }
  setSolarLocation({
    name: "Custom location",
    lat: clampNumber(latInput?.value, -90, 90, solarLocation.lat),
    lon: clampNumber(lonInput?.value, -180, 180, solarLocation.lon)
  });
});
latInput?.addEventListener("input", () => {
  if (locationPreset) locationPreset.value = "custom";
  readManualLocation();
});
lonInput?.addEventListener("input", () => {
  if (locationPreset) locationPreset.value = "custom";
  readManualLocation();
});
yearInput?.addEventListener("input", () => render(true));
yearInput?.addEventListener("change", () => render(true));
stepBackButton?.addEventListener("click", () => {
  selectedYear = clampYear(selectedYear - STEP_YEARS);
  yearInput.value = String(Math.round(selectedYear));
  render(true);
});
stepForwardButton?.addEventListener("click", () => {
  selectedYear = clampYear(selectedYear + STEP_YEARS);
  yearInput.value = String(Math.round(selectedYear));
  render(true);
});
speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const speed = Number(button.dataset.galacticSpeed);
    if (Number.isFinite(speed) && speed > 0) {
      yearsPerSecond = speed;
      render(true);
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

setupSectionVisibility();
initSolarGeometrySection();
syncLocationControls();
render(true);
