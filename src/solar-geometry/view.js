import { solarGeometrySnapshot } from "./model.js";
import { projectLocationOnGlobe, renderSolarGlobe, resetSolarGlobeRenderCache } from "./globe.js";

const SCALE_RANGES = {
  year: 100,
  century: 1000,
  "10k": 10000,
  "50k": 50000
};

const SCALE_SPEEDS = {
  year: 100,
  century: 1000,
  "10k": 10000,
  "50k": 25000
};

let timelineScale = "year";
let selectedTimelineYear = new Date().getFullYear();
let currentDate = new Date();
let currentLocation = { name: "Selected location", lat: 0, lon: 0 };
let currentFormatter = (date) => date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
let playbackDirection = 0;
let playbackFrame = 0;
let lastFrameTime = 0;

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function clampTimelineYear(year) {
  return Math.max(-50000, Math.min(50000, year));
}

function formatSignedYearOffset(years) {
  if (Math.abs(years) < 1) return "Today";
  const prefix = years > 0 ? "+" : "";
  return `${prefix}${Math.round(years).toLocaleString()} years`;
}

function scaleLabel() {
  return {
    year: "100 years/sec",
    century: "1,000 years/sec",
    "10k": "10,000 years/sec",
    "50k": "25,000 years/sec"
  }[timelineScale] || "100 years/sec";
}

function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)} ${ns}, ${Math.abs(lon).toFixed(1)} ${ew}`;
}

function svgPoint(cx, cy, rx, ry, longitude) {
  const angle = (longitude - 90) * Math.PI / 180;
  return {
    x: cx + Math.cos(angle) * rx,
    y: cy + Math.sin(angle) * ry
  };
}

function timeOfDayRotation(date) {
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  return (hours / 24) * 360;
}

function renderCurrentSnapshot() {
  updateSolarGeometryPanel({ date: currentDate, location: currentLocation, formatDateTime: currentFormatter });
}

function stopPlayback() {
  playbackDirection = 0;
  lastFrameTime = 0;
  if (playbackFrame) cancelAnimationFrame(playbackFrame);
  playbackFrame = 0;
  syncPlaybackButtons();
}

function playbackTick(timestamp) {
  if (!playbackDirection) return;
  if (!lastFrameTime) lastFrameTime = timestamp;
  const deltaSeconds = Math.min(0.12, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;
  selectedTimelineYear = clampTimelineYear(selectedTimelineYear + playbackDirection * (SCALE_SPEEDS[timelineScale] || 100) * deltaSeconds);
  renderCurrentSnapshot();
  if (selectedTimelineYear <= -50000 || selectedTimelineYear >= 50000) {
    stopPlayback();
    return;
  }
  playbackFrame = requestAnimationFrame(playbackTick);
}

function startPlayback(direction) {
  playbackDirection = direction;
  lastFrameTime = 0;
  if (!playbackFrame) playbackFrame = requestAnimationFrame(playbackTick);
  syncPlaybackButtons();
}

function stepTimeline(direction) {
  selectedTimelineYear = clampTimelineYear(selectedTimelineYear + direction * (SCALE_SPEEDS[timelineScale] || 100));
  renderCurrentSnapshot();
}

function drawSolarTimeline(snapshot) {
  const svg = document.querySelector("#solarGeometrySvg");
  if (!svg) return;
  const width = 1200;
  const height = 440;
  const cx = 520;
  const cy = 190;
  const orbitRx = 315;
  const orbitRy = 122 * (1 - Math.min(0.42, snapshot.deepTime.eccentricity * 3.4));
  const sunX = cx - orbitRx * snapshot.deepTime.eccentricity * 2.3;
  const sunY = cy;
  const earth = svgPoint(cx, cy, orbitRx, orbitRy, snapshot.tropicalSunLongitude);
  const earthRadius = 30;
  const sunRadius = 58;
  const tilt = snapshot.deepTime.obliquity;
  const axisTilt = (tilt - 90) * Math.PI / 180;
  const axisDx = Math.cos(axisTilt) * 44;
  const axisDy = Math.sin(axisTilt) * 44;
  const earthSpin = timeOfDayRotation(currentDate);
  const precession = snapshot.deepTime.precession * Math.PI / 180;
  const range = SCALE_RANGES[timelineScale] || 100;
  const offsetRatio = Math.max(-1, Math.min(1, snapshot.deepTime.yearsFromPresent / range));
  const markerX = cx + offsetRatio * 420;
  const l1 = { x: earth.x + (sunX - earth.x) * 0.16, y: earth.y + (sunY - earth.y) * 0.16 };
  const l2 = { x: earth.x - (sunX - earth.x) * 0.10, y: earth.y - (sunY - earth.y) * 0.10 };
  const l3 = { x: sunX - (earth.x - sunX) * 1.02, y: sunY - (earth.y - sunY) * 1.02 };
  const l4 = svgPoint(sunX, sunY, Math.hypot(earth.x - sunX, earth.y - sunY), Math.hypot(earth.x - sunX, earth.y - sunY) * 0.38, snapshot.tropicalSunLongitude + 60);
  const l5 = svgPoint(sunX, sunY, Math.hypot(earth.x - sunX, earth.y - sunY), Math.hypot(earth.x - sunX, earth.y - sunY) * 0.38, snapshot.tropicalSunLongitude - 60);
  const seasonMarkers = [
    ["Vernal Eq", 0],
    ["June Sol", 90],
    ["Autumn Eq", 180],
    ["Dec Sol", 270]
  ];
  const meteorMarkers = snapshot.observation.activeMeteors.slice(0, 3);

  svg.innerHTML = `
    <defs>
      <radialGradient id="solarEarthShade" cx="33%" cy="24%" r="72%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
        <stop offset="42%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="72%" stop-color="rgba(0,0,0,0.38)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.82)"/>
      </radialGradient>
      <filter id="softGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="solarEarthClip"><circle cx="${earth.x}" cy="${earth.y}" r="${earthRadius}"/></clipPath>
      <clipPath id="solarSunClip"><circle cx="${sunX}" cy="${sunY}" r="${sunRadius * 0.64}"/></clipPath>
    </defs>
    <rect width="${width}" height="${height}" rx="18" fill="rgba(2,5,12,0.48)"/>
    <text x="52" y="55" class="solar-svg-title">Solar geometry layers</text>
    <text x="52" y="84" class="solar-svg-label">${formatSignedYearOffset(snapshot.deepTime.yearsFromPresent)} | e ${snapshot.deepTime.eccentricity.toFixed(4)} | obliquity ${snapshot.deepTime.obliquity.toFixed(2)} deg</text>
    <line x1="${cx - 420}" y1="382" x2="${cx + 420}" y2="382" stroke="rgba(255,255,255,0.24)" stroke-width="3"/>
    <line x1="${cx}" y1="369" x2="${cx}" y2="395" stroke="rgba(246,200,76,0.74)" stroke-width="3"/>
    <circle cx="${markerX}" cy="382" r="10" fill="#9ff2ff" filter="url(#softGlow)"/>
    <text x="${cx - 420}" y="414" class="solar-svg-label">-${range.toLocaleString()}y</text>
    <text x="${cx}" y="414" class="solar-svg-label" text-anchor="middle">Now</text>
    <text x="${cx + 420}" y="414" class="solar-svg-label" text-anchor="end">+${range.toLocaleString()}y</text>
    <ellipse cx="${cx}" cy="${cy}" rx="${orbitRx}" ry="${orbitRy}" fill="none" stroke="rgba(154,224,255,0.5)" stroke-width="4"/>
    ${seasonMarkers.map(([label, lon]) => {
      const point = svgPoint(cx, cy, orbitRx, orbitRy, lon);
      return `<circle cx="${point.x}" cy="${point.y}" r="7" fill="rgba(246,200,76,0.84)"/><text x="${point.x}" y="${point.y - 13}" class="solar-svg-mini" text-anchor="middle">${label}</text>`;
    }).join("")}
    <text x="${cx - orbitRx}" y="${cy + orbitRy + 28}" class="solar-svg-mini" text-anchor="middle">Perihelion</text>
    <text x="${cx + orbitRx}" y="${cy + orbitRy + 28}" class="solar-svg-mini" text-anchor="middle">Aphelion</text>
    <image class="solar-sun-image" href="./assets/sun-disk.jpg" x="${sunX - sunRadius * 0.64}" y="${sunY - sunRadius * 0.64}" width="${sunRadius * 1.28}" height="${sunRadius * 1.28}" clip-path="url(#solarSunClip)" preserveAspectRatio="xMidYMid slice"/>
    <text x="${sunX}" y="${sunY + 82}" class="solar-svg-label" text-anchor="middle">Sun</text>
    <g class="solar-lagrange-layer">
      ${[["L1", l1], ["L2", l2], ["L3", l3], ["L4", l4], ["L5", l5]].map(([label, p]) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="rgba(159,242,255,0.9)"/><text x="${p.x}" y="${p.y - 10}" class="solar-svg-mini" text-anchor="middle">${label}</text>`).join("")}
    </g>
    <g class="solar-earth-group" style="transform-origin: ${earth.x}px ${earth.y}px;">
      <circle cx="${earth.x}" cy="${earth.y}" r="${earthRadius + 3}" fill="rgba(89,210,199,0.18)" filter="url(#softGlow)"/>
      <image class="solar-earth-image" href="./assets/earth-blue-marble.jpg" x="${earth.x - earthRadius}" y="${earth.y - earthRadius}" width="${earthRadius * 2}" height="${earthRadius * 2}" clip-path="url(#solarEarthClip)" preserveAspectRatio="xMidYMid slice" transform="rotate(${earthSpin.toFixed(2)} ${earth.x} ${earth.y})"/>
      <circle class="solar-earth-terminator" cx="${earth.x}" cy="${earth.y}" r="${earthRadius}" fill="rgba(0,0,0,0)"/>
      <circle cx="${earth.x}" cy="${earth.y}" r="${earthRadius}" fill="none" stroke="rgba(255,255,255,0.78)" stroke-width="3"/>
    </g>
    <line x1="${earth.x - axisDx}" y1="${earth.y - axisDy}" x2="${earth.x + axisDx}" y2="${earth.y + axisDy}" stroke="#f6c84c" stroke-width="5" stroke-linecap="round"/>
    <text x="${earth.x}" y="${earth.y + 58}" class="solar-svg-label" text-anchor="middle">Earth</text>
    <circle cx="1018" cy="120" r="50" fill="none" stroke="rgba(246,200,76,0.32)" stroke-width="3"/>
    <line x1="1018" y1="120" x2="${1018 + Math.cos(precession) * 38}" y2="${120 + Math.sin(precession) * 38}" stroke="#f6c84c" stroke-width="4" stroke-linecap="round"/>
    <text x="1018" y="188" class="solar-svg-label" text-anchor="middle">Precession</text>
    <line x1="950" y1="250" x2="1086" y2="290" stroke="rgba(159,242,255,0.5)" stroke-width="3"/>
    <text x="1018" y="318" class="solar-svg-label" text-anchor="middle">Lunar node line</text>
    ${meteorMarkers.map((m, index) => `<circle cx="${940 + index * 92}" cy="352" r="7" fill="rgba(246,200,76,0.86)"/><text x="${940 + index * 92}" y="337" class="solar-svg-mini" text-anchor="middle">${m.radiant}</text>`).join("")}
  `;
}

function drawInsolation(snapshot) {
  const canvas = document.querySelector("#solarInsolationCanvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  snapshot.insolation.forEach((sample, index) => {
    const x = index / (snapshot.insolation.length - 1) * width;
    const barHeight = 18 + sample.value * (height - 42);
    context.fillStyle = `rgba(${Math.round(40 + sample.value * 215)}, ${Math.round(95 + sample.value * 125)}, ${Math.round(160 - sample.value * 80)}, 0.92)`;
    context.fillRect(x - 18, height - barHeight - 20, 36, barHeight);
    context.fillStyle = "rgba(238,245,252,0.78)";
    context.font = "18px Segoe UI, Arial";
    context.textAlign = "center";
    context.fillText(`${sample.lat}`, x, height - 4);
  });
}

function drawAnalemma(snapshot) {
  const svg = document.querySelector("#solarAnalemmaSvg");
  if (!svg) return;
  const points = snapshot.analemma.map((p) => {
    const x = 160 + p.eot * 6;
    const y = 110 - p.dec * 4;
    return { ...p, x, y };
  });
  svg.innerHTML = `
    <rect width="320" height="220" rx="10" fill="rgba(0,0,0,0.18)"/>
    <line x1="160" y1="18" x2="160" y2="202" stroke="rgba(255,255,255,0.16)"/>
    <line x1="28" y1="110" x2="292" y2="110" stroke="rgba(255,255,255,0.16)"/>
    <polyline points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="rgba(246,200,76,0.82)" stroke-width="3"/>
    ${points.filter((p) => p.selected).map((p) => `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#9ff2ff"/>`).join("")}
    <text x="160" y="210" text-anchor="middle" class="solar-svg-mini">Equation of time / declination</text>
  `;
}

function drawGalacticMotion(snapshot) {
  const svg = document.querySelector("#galacticMotionSvg");
  if (!svg) return;
  const cx = 310;
  const cy = 130;
  const armAngle = snapshot.galactic.orbitAngle * Math.PI / 180;
  const sunX = cx + Math.cos(armAngle) * 142;
  const sunY = cy + Math.sin(armAngle) * 66;
  const arrowX = sunX + Math.cos(armAngle + Math.PI / 2) * 34;
  const arrowY = sunY + Math.sin(armAngle + Math.PI / 2) * 18;
  svg.innerHTML = `
    <rect width="620" height="260" rx="12" fill="rgba(0,0,0,0.18)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="235" ry="88" fill="none" stroke="rgba(159,242,255,0.16)" stroke-width="18"/>
    <ellipse cx="${cx}" cy="${cy}" rx="162" ry="66" fill="none" stroke="rgba(246,200,76,0.28)" stroke-width="4" stroke-dasharray="10 12"/>
    <circle cx="${cx}" cy="${cy}" r="18" fill="rgba(246,200,76,0.86)" filter="url(#softGlow)"/>
    <text x="${cx}" y="${cy + 43}" class="solar-svg-mini" text-anchor="middle">Galactic center</text>
    <circle cx="${sunX}" cy="${sunY}" r="10" fill="#9ff2ff"/>
    <line x1="${sunX}" y1="${sunY}" x2="${arrowX}" y2="${arrowY}" stroke="#9ff2ff" stroke-width="4" stroke-linecap="round"/>
    <text x="${sunX}" y="${sunY - 16}" class="solar-svg-mini" text-anchor="middle">Sun</text>
    <text x="24" y="38" class="solar-svg-label">Milky Way orbit: ~${(snapshot.galactic.galacticYearYears / 1000000).toFixed(0)}M years</text>
    <text x="24" y="66" class="solar-svg-mini">Current local structure: ${snapshot.galactic.arm}</text>
    <text x="24" y="92" class="solar-svg-mini">Deep-time slider offset: ${formatSignedYearOffset(snapshot.galactic.yearsFromPresent)}</text>
    <text x="24" y="118" class="solar-svg-mini">Motion shown schematically, not to scale</text>
  `;
  setText("#galacticMotionNote", `${snapshot.galactic.note} At +/-50k years, the Sun moves only about ${snapshot.galactic.orbitPercent.toFixed(3)}% of one galactic orbit.`);
}

function renderSolarGlobePanel(snapshot) {
  const canvas = document.querySelector("#solarEarthCanvas");
  const shell = document.querySelector(".solar-earth-preview");
  if (!canvas || !shell) return;
  renderSolarGlobe(canvas, currentLocation, snapshot.season.subsolar);
  const view = { lat: Math.max(-75, Math.min(75, currentLocation.lat)), lon: currentLocation.lon };
  const marker = projectLocationOnGlobe(currentLocation, view);
  const subsolarMarker = projectLocationOnGlobe(snapshot.season.subsolar, view);
  shell.style.setProperty("--solar-marker-x", `${marker.x}%`);
  shell.style.setProperty("--solar-marker-y", `${marker.y}%`);
  shell.style.setProperty("--solar-marker-opacity", marker.visible ? "1" : "0.2");
  shell.style.setProperty("--solar-subsolar-x", `${subsolarMarker.x}%`);
  shell.style.setProperty("--solar-subsolar-y", `${subsolarMarker.y}%`);
  shell.style.setProperty("--solar-subsolar-opacity", subsolarMarker.visible ? "1" : "0.18");
  setText("#solarGlobeLocation", currentLocation.name || formatLatLon(currentLocation.lat, currentLocation.lon));
  setText("#solarGlobeNote", `Location-centered globe. Subsolar ${formatLatLon(snapshot.season.subsolar.lat, snapshot.season.subsolar.lon)} | daylight ${snapshot.season.selectedDayLength.toFixed(1)}h`);
}

function renderList(containerSelector, items, emptyText) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = items.length ? items.join("") : `<p class="solar-empty">${emptyText}</p>`;
}

function renderPhenomena(snapshot) {
  drawInsolation(snapshot);
  drawAnalemma(snapshot);
  drawGalacticMotion(snapshot);
  renderSolarGlobePanel(snapshot);
  renderList("#lagrangeStrip", ["L1 solar monitors", "L2 deep-space observatories", "L3 opposite Sun", "L4 stable leading point", "L5 stable trailing point"].map((text) => `<span>${text}</span>`), "");
  setText("#seasonHemisphereValue", snapshot.season.hemisphereTilt);
  setText("#seasonHemisphereNote", `${snapshot.deepTime.strongerSummerHemisphere} gets stronger summers in this precession phase.`);
  setText("#subsolarValue", formatLatLon(snapshot.season.subsolar.lat, snapshot.season.subsolar.lon));
  setText("#polarStateValue", `North: ${snapshot.season.northPolarState}. South: ${snapshot.season.southPolarState}.`);
  setText("#orbitShapeValue", `e ${snapshot.deepTime.eccentricity.toFixed(4)}`);
  setText("#orbitDistanceValue", `Perihelion ${snapshot.orbit.perihelionAu.toFixed(4)} AU | Aphelion ${snapshot.orbit.aphelionAu.toFixed(4)} AU.`);
  setText("#eclipseValue", snapshot.eclipse.eclipsePotential);
  setText("#eclipseNote", `${snapshot.eclipse.eclipseSeason}; node distance ${snapshot.eclipse.nodeDistance.toFixed(1)} deg.`);
  renderList("#meteorList", snapshot.observation.activeMeteors.slice(0, 4).map((m) => `
    <div class="meteor-row">
      <strong>${m.name}</strong>
      <span>${m.radiant} radiant | score ${m.visibilityScore}/100 | best ~${String(Math.round(m.bestLocalHour)).padStart(2, "0")}:00</span>
      <small>ZHR ${m.zhr}, ${m.velocityKmS} km/s, parent ${m.parent}, Moon ${(m.moonIllumination * 100).toFixed(0)}%</small>
    </div>
  `), "No major listed shower is active for this date.");
  renderList("#observationList", [
    `<div><strong>Moon</strong><span>${(snapshot.observation.moonIllumination * 100).toFixed(0)}% illuminated</span></div>`,
    `<div><strong>Darkness</strong><span>${snapshot.observation.twilightNote}; best ${snapshot.observation.bestHours}</span></div>`,
    `<div><strong>Planets</strong><span>${snapshot.observation.planetNote}</span></div>`
  ], "");
  renderList("#calendarCompareGrid", snapshot.calendars.map((item) => `<div><strong>${item.name}</strong><span>${item.value}</span><small>${item.meaning}</small></div>`), "");
  renderList("#poleStarGrid", [
    `<div><strong>North: ${snapshot.poleStars.currentNorth.name}</strong><span>${snapshot.poleStars.currentNorth.constellation} near ${snapshot.poleStars.currentNorth.year}</span><small>${snapshot.poleStars.currentNorth.note}; approx ${snapshot.poleStars.currentNorth.distanceDeg} deg from pole.</small></div>`,
    `<div><strong>South: ${snapshot.poleStars.currentSouth.name}</strong><span>${snapshot.poleStars.currentSouth.constellation} near ${snapshot.poleStars.currentSouth.year}</span><small>${snapshot.poleStars.currentSouth.note}; approx ${snapshot.poleStars.currentSouth.distanceDeg} deg from pole.</small></div>`,
    ...snapshot.poleStars.northStars.slice(0, 6).map((star) => `<div><strong>${star.name}</strong><span>${star.constellation} / ${star.year}</span><small>North pole guide, ${star.distanceDeg} deg approx.</small></div>`)
  ], "");
}

function syncControls(snapshot) {
  const yearInput = document.querySelector("#solarTimelineYear");
  if (yearInput && document.activeElement !== yearInput) yearInput.value = String(Math.round(selectedTimelineYear));
  document.querySelectorAll("[data-solar-scale]").forEach((button) => {
    button.classList.toggle("active", button.dataset.solarScale === timelineScale);
  });
  setText("#solarTimelineRange", `${formatSignedYearOffset(snapshot.deepTime.yearsFromPresent)} / ${scaleLabel()}`);
  syncPlaybackButtons();
}

function syncPlaybackButtons() {
  const playButton = document.querySelector("#solarTimelinePlay");
  const backButton = document.querySelector("#solarTimelineBack");
  const forwardButton = document.querySelector("#solarTimelineForward");
  if (playButton) {
    playButton.textContent = playbackDirection ? "Pause" : "Play";
    playButton.setAttribute("aria-pressed", playbackDirection ? "true" : "false");
  }
  backButton?.classList.toggle("active", playbackDirection < 0);
  forwardButton?.classList.toggle("active", playbackDirection > 0);
  const direction = playbackDirection < 0 ? "Reverse" : playbackDirection > 0 ? "Forward" : "Paused";
  setText("#solarPlaybackStatus", `${direction} / ${scaleLabel()}`);
}

export function updateSolarGeometryPanel({ date, location, formatDateTime }) {
  currentDate = date;
  if (location) currentLocation = location;
  if (formatDateTime) currentFormatter = formatDateTime;
  const snapshot = solarGeometrySnapshot(date, selectedTimelineYear, currentLocation);
  setText("#vernalEquinoxValue", currentFormatter(snapshot.vernalEquinox.date));
  setText("#nextSolarMarkerValue", `${snapshot.nextMarker.name} / ${currentFormatter(snapshot.nextMarker.date)}`);
  setText("#nextSolarMarkerNote", `${snapshot.nextMarker.sanskrit}; tropical Sun ${snapshot.nextMarker.longitude} deg.`);
  setText("#obliquityValue", `${snapshot.obliquity.toFixed(4)} deg`);
  setText("#eccentricityValue", snapshot.eccentricity.toFixed(6));
  setText("#earthSunDistanceValue", `${snapshot.distanceAu.toFixed(6)} AU / ${(snapshot.distanceKm / 1000000).toFixed(2)}M km`);
  setText("#ayanamshaValue", `${snapshot.ayanamsha.toFixed(3)} deg`);
  setText("#deepObliquityValue", `${snapshot.deepTime.obliquity.toFixed(2)} deg`);
  setText("#deepEccentricityValue", snapshot.deepTime.eccentricity.toFixed(4));
  setText("#deepPrecessionValue", `${snapshot.deepTime.precession.toFixed(1)} deg`);
  drawSolarTimeline(snapshot);
  renderPhenomena(snapshot);
  syncControls(snapshot);
}

export function initSolarGeometryTimeline() {
  const yearInput = document.querySelector("#solarTimelineYear");
  const resetButton = document.querySelector("#solarTimelineReset");
  const backButton = document.querySelector("#solarTimelineBack");
  const playButton = document.querySelector("#solarTimelinePlay");
  const forwardButton = document.querySelector("#solarTimelineForward");
  const stepBackButton = document.querySelector("#solarTimelineStepBack");
  const stepForwardButton = document.querySelector("#solarTimelineStepForward");
  const applyTimelineYear = () => {
    const value = Number.parseInt(yearInput.value, 10);
    if (Number.isFinite(value)) {
      selectedTimelineYear = clampTimelineYear(value);
      resetSolarGlobeRenderCache();
      renderCurrentSnapshot();
    }
  };
  if (yearInput) {
    selectedTimelineYear = Number.parseInt(yearInput.value, 10) || currentDate.getFullYear();
    yearInput.addEventListener("input", applyTimelineYear);
    yearInput.addEventListener("change", applyTimelineYear);
  }
  document.querySelectorAll("[data-solar-scale]").forEach((button) => {
    button.addEventListener("click", () => {
      timelineScale = button.dataset.solarScale || "year";
      renderCurrentSnapshot();
    });
  });
  stepBackButton?.addEventListener("click", () => stepTimeline(-1));
  stepForwardButton?.addEventListener("click", () => stepTimeline(1));
  backButton?.addEventListener("click", () => {
    if (playbackDirection < 0) stopPlayback();
    else startPlayback(-1);
  });
  forwardButton?.addEventListener("click", () => {
    if (playbackDirection > 0) stopPlayback();
    else startPlayback(1);
  });
  playButton?.addEventListener("click", () => {
    if (playbackDirection) stopPlayback();
    else startPlayback(1);
  });
  resetButton?.addEventListener("click", () => {
    stopPlayback();
    selectedTimelineYear = currentDate.getFullYear();
    resetSolarGlobeRenderCache();
    renderCurrentSnapshot();
  });
  window.addEventListener("solar-geometry:earth-texture-ready", renderCurrentSnapshot);
}
