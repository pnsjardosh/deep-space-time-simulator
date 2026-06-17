import { METEOR_SHOWERS } from "./meteor-showers.js";

const AU_KM = 149597870.7;
const GALACTIC_YEAR_YEARS = 230000000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const DRACONIC_MONTH_DAYS = 27.212220817;
const SIDEREAL_MONTH_DAYS = 27.321661;
const J2000 = 2451545;

function wrap(value, max = 360) {
  return ((value % max) + max) % max;
}

function sinDeg(value) {
  return Math.sin(value * Math.PI / 180);
}

function cosDeg(value) {
  return Math.cos(value * Math.PI / 180);
}

function asinDeg(value) {
  return Math.asin(Math.max(-1, Math.min(1, value))) * 180 / Math.PI;
}

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000) + 1;
}

function monthDayToDay(value, year) {
  const [month, day] = value.split("-").map(Number);
  return dayOfYear(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function julianCentury(date) {
  return (julianDay(date) - 2451545) / 36525;
}

export function tropicalSunLongitude(date) {
  const d = julianDay(date) - 2451545;
  const meanLongitude = wrap(280.46646 + 0.98564736 * d);
  const meanAnomaly = wrap(357.52911 + 0.98560028 * d);
  const center = 1.914602 * sinDeg(meanAnomaly) + 0.019993 * sinDeg(2 * meanAnomaly) + 0.000289 * sinDeg(3 * meanAnomaly);
  return wrap(meanLongitude + center);
}

export function equationOfTime(date) {
  const n = dayOfYear(date);
  const b = (2 * Math.PI * (n - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export function solarDeclination(date, obliquity = meanObliquity(date)) {
  return asinDeg(sinDeg(obliquity) * sinDeg(tropicalSunLongitude(date)));
}

export function subsolarPoint(date, obliquity = meanObliquity(date)) {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  return {
    lat: solarDeclination(date, obliquity),
    lon: wrap(180 - utcHours * 15 - equationOfTime(date) / 4 + 180) - 180
  };
}

export function lahiriAyanamsha(date) {
  const yearsSinceJ2000 = (julianDay(date) - 2451545) / 365.2425;
  return 23.85675 + yearsSinceJ2000 * 0.013968;
}

export function meanObliquity(date) {
  const t = julianCentury(date);
  const seconds = 21.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t;
  return 23 + 26 / 60 + seconds / 3600;
}

export function orbitalEccentricity(date) {
  const t = julianCentury(date);
  return 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
}

export function earthSunDistanceAu(date) {
  const d = julianDay(date) - 2451545;
  const meanAnomaly = wrap(357.52911 + 0.98560028 * d);
  return 1.00014 - 0.01671 * cosDeg(meanAnomaly) - 0.00014 * cosDeg(2 * meanAnomaly);
}

function localSiderealDegrees(date, lon) {
  const jd = julianDay(date);
  const t = (jd - J2000) / 36525;
  return wrap(280.46061837 + 360.98564736629 * (jd - J2000) + 0.000387933 * t * t - t * t * t / 38710000 + lon);
}

function equatorialToAltAz(raHours, decDeg, date, location) {
  const lst = localSiderealDegrees(date, location.lon);
  const ha = wrap(lst - raHours * 15 + 180) - 180;
  const alt = asinDeg(
    sinDeg(location.lat) * sinDeg(decDeg) +
    cosDeg(location.lat) * cosDeg(decDeg) * cosDeg(ha)
  );
  const az = wrap(Math.atan2(
    -sinDeg(ha),
    Math.tan(decDeg * Math.PI / 180) * cosDeg(location.lat) - sinDeg(location.lat) * cosDeg(ha)
  ) * 180 / Math.PI);
  return { alt, az };
}

function approximateMoonLongitude(date) {
  const d = julianDay(date) - J2000;
  return wrap(218.316 + 13.176396 * d);
}

function moonIllumination(date) {
  const phase = wrap(approximateMoonLongitude(date) - tropicalSunLongitude(date));
  return (1 - cosDeg(phase)) / 2;
}

function dayLengthHours(date, lat, obliquity = meanObliquity(date)) {
  const dec = solarDeclination(date, obliquity);
  const h0 = -0.833;
  const cosH = (sinDeg(h0) - sinDeg(lat) * sinDeg(dec)) / (cosDeg(lat) * cosDeg(dec));
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return (2 * Math.acos(cosH) * 180 / Math.PI) / 15;
}

function isDateRangeActive(date, start, end) {
  const year = date.getUTCFullYear();
  const current = dayOfYear(date);
  const startDay = monthDayToDay(start, year);
  const endDay = monthDayToDay(end, year);
  if (startDay <= endDay) return current >= startDay && current <= endDay;
  return current >= startDay || current <= endDay;
}

function bestRadiantWindow(date, location, shower) {
  const lonOffset = location.lon / 15;
  let best = { alt: -90, localHour: 0, az: 0 };
  [20, 21, 22, 23, 24, 25, 26, 27, 28, 29].forEach((localHour) => {
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), localHour - lonOffset));
    const altAz = equatorialToAltAz(shower.raHours, shower.dec, utc, location);
    if (altAz.alt > best.alt) best = { ...altAz, localHour: localHour % 24 };
  });
  return best;
}

function meteorActivity(date, location) {
  const illum = moonIllumination(date);
  return METEOR_SHOWERS
    .filter((shower) => isDateRangeActive(date, shower.activeStart, shower.activeEnd))
    .map((shower) => {
      const best = bestRadiantWindow(date, location, shower);
      const altitudeFactor = Math.max(0, Math.sin(Math.max(0, best.alt) * Math.PI / 180));
      const moonFactor = Math.max(0.18, 1 - illum * 0.72);
      const score = Math.round(Math.min(100, shower.zhr * altitudeFactor * moonFactor));
      return { ...shower, bestAltitude: best.alt, bestAzimuth: best.az, bestLocalHour: best.localHour, moonIllumination: illum, visibilityScore: score };
    })
    .sort((a, b) => b.visibilityScore - a.visibilityScore);
}

function signedSolarLongitudeOffset(date, targetLongitude) {
  return wrap(tropicalSunLongitude(date) - targetLongitude + 180) - 180;
}

export function findSolarLongitudeCrossing(year, targetLongitude, month, day) {
  const center = Date.UTC(year, month, day, 12, 0, 0);
  let previousTime = center - 6 * 86400000;
  let previousValue = signedSolarLongitudeOffset(new Date(previousTime), targetLongitude);

  for (let step = 1; step <= 24; step += 1) {
    const currentTime = center - 6 * 86400000 + step * 12 * 3600000;
    const currentValue = signedSolarLongitudeOffset(new Date(currentTime), targetLongitude);
    if (previousValue === 0 || previousValue * currentValue <= 0) {
      let low = previousTime;
      let high = currentTime;
      for (let i = 0; i < 42; i += 1) {
        const mid = (low + high) / 2;
        const midValue = signedSolarLongitudeOffset(new Date(mid), targetLongitude);
        if (previousValue * midValue <= 0) high = mid;
        else low = mid;
      }
      return new Date((low + high) / 2);
    }
    previousTime = currentTime;
    previousValue = currentValue;
  }

  return new Date(center);
}

export function solarMarkersForYear(year) {
  return [
    { name: "Vernal Equinox", sanskrit: "Vasanta Vishuva", longitude: 0, date: findSolarLongitudeCrossing(year, 0, 2, 20) },
    { name: "June Solstice", sanskrit: "Uttarayana peak", longitude: 90, date: findSolarLongitudeCrossing(year, 90, 5, 21) },
    { name: "Autumn Equinox", sanskrit: "Sharad Vishuva", longitude: 180, date: findSolarLongitudeCrossing(year, 180, 8, 22) },
    { name: "December Solstice", sanskrit: "Dakshinayana peak", longitude: 270, date: findSolarLongitudeCrossing(year, 270, 11, 21) }
  ];
}

export function approximateMilankovitchForYear(year) {
  const yearsFromPresent = year - new Date().getFullYear();
  const obliquity = 23.3 + 1.2 * Math.cos((2 * Math.PI * (yearsFromPresent + 9490)) / 41000);
  const eccentricityWave = (offset) =>
    0.028 +
    0.012 * Math.cos((2 * Math.PI * (offset + 50000)) / 95000) +
    0.010 * Math.cos((2 * Math.PI * (offset - 12000)) / 125000) +
    0.006 * Math.cos((2 * Math.PI * (offset + 30000)) / 405000);
  const eccentricity = 0.0167 + eccentricityWave(yearsFromPresent) - eccentricityWave(0);
  const precession = wrap((yearsFromPresent / 25700) * 360);
  return {
    obliquity: Math.max(22.1, Math.min(24.5, obliquity)),
    eccentricity: Math.max(0.001, Math.min(0.067, eccentricity)),
    precession,
    yearsFromPresent,
    perihelionSeasonLongitude: wrap(282.9 + precession),
    strongerSummerHemisphere: Math.cos(precession * Math.PI / 180) >= 0 ? "Southern Hemisphere" : "Northern Hemisphere"
  };
}

function seasonContext(date, location, deepTime) {
  const subsolar = subsolarPoint(date, deepTime.obliquity);
  const selectedDayLength = dayLengthHours(date, location.lat, deepTime.obliquity);
  const northPolar = dayLengthHours(date, 80, deepTime.obliquity);
  const southPolar = dayLengthHours(date, -80, deepTime.obliquity);
  const hemisphereTilt = subsolar.lat >= 0 ? "Northern Hemisphere" : "Southern Hemisphere";
  return {
    subsolar,
    selectedDayLength,
    hemisphereTilt,
    northPolarState: northPolar > 23.5 ? "polar day" : northPolar < 0.5 ? "polar night" : "normal day/night",
    southPolarState: southPolar > 23.5 ? "polar day" : southPolar < 0.5 ? "polar night" : "normal day/night"
  };
}

function insolationSamples(date, deepTime) {
  return [-90, -66.5, -45, -23.5, 0, 23.5, 45, 66.5, 90].map((lat) => {
    const noonSun = Math.max(0, sinDeg(lat) * sinDeg(solarDeclination(date, deepTime.obliquity)) + cosDeg(lat) * cosDeg(solarDeclination(date, deepTime.obliquity)));
    return { lat, value: noonSun };
  });
}

function analemmaSamples(year, selectedDate) {
  const selectedDay = dayOfYear(selectedDate);
  return Array.from({ length: 53 }, (_, index) => {
    const date = new Date(Date.UTC(year, 0, 1 + index * 7, 12));
    return { day: dayOfYear(date), eot: equationOfTime(date), dec: solarDeclination(date), selected: Math.abs(dayOfYear(date) - selectedDay) <= 3 };
  });
}

function eclipseContext(date) {
  const days = julianDay(date) - J2000;
  const moonPhase = wrap(approximateMoonLongitude(date) - tropicalSunLongitude(date));
  const nodePhase = wrap((days / DRACONIC_MONTH_DAYS) * 360);
  const nodeDistance = Math.min(nodePhase, 360 - nodePhase);
  const nearNode = nodeDistance < 17;
  const nearNew = moonPhase < 18 || moonPhase > 342;
  const nearFull = Math.abs(moonPhase - 180) < 18;
  return {
    nodeDistance,
    phaseAngle: moonPhase,
    nearNode,
    eclipseSeason: nearNode ? "near lunar node" : "away from lunar nodes",
    eclipsePotential: nearNode && nearNew ? "solar eclipse geometry possible" : nearNode && nearFull ? "lunar eclipse geometry possible" : "no eclipse geometry"
  };
}

function calendarComparisons() {
  return [
    { name: "Tropical year", value: "365.2422 d", meaning: "season-to-season year" },
    { name: "Sidereal year", value: "365.2564 d", meaning: "Sun returns to same stars" },
    { name: "Anomalistic year", value: "365.2596 d", meaning: "perihelion-to-perihelion" },
    { name: "Synodic month", value: `${SYNODIC_MONTH_DAYS.toFixed(5)} d`, meaning: "new moon to new moon" },
    { name: "Sidereal month", value: `${SIDEREAL_MONTH_DAYS.toFixed(5)} d`, meaning: "Moon returns to same stars" },
    { name: "Draconic month", value: `${DRACONIC_MONTH_DAYS.toFixed(5)} d`, meaning: "node-to-node eclipse rhythm" }
  ];
}

function poleStarContext(year) {
  const northStars = [
    { year: -2700, name: "Thuban", constellation: "Draco", distanceDeg: 0.1, note: "ancient close north pole star" },
    { year: -500, name: "Kochab / Pherkad", constellation: "Ursa Minor", distanceDeg: 7, note: "twin guard stars near the pole" },
    { year: 2100, name: "Polaris", constellation: "Ursa Minor", distanceDeg: 0.45, note: "current/near-future closest bright guide" },
    { year: 4200, name: "Errai", constellation: "Cepheus", distanceDeg: 3, note: "next useful northern guide" },
    { year: 7500, name: "Alderamin", constellation: "Cepheus", distanceDeg: 3, note: "bright future pole guide" },
    { year: 9800, name: "Deneb", constellation: "Cygnus", distanceDeg: 7, note: "bright but not very close" },
    { year: 11250, name: "Delta Cygni", constellation: "Cygnus", distanceDeg: 3, note: "closer Cygnus guide" },
    { year: 14500, name: "Vega", constellation: "Lyra", distanceDeg: 5, note: "bright future north guide" },
    { year: 18400, name: "Tau Herculis", constellation: "Hercules", distanceDeg: 4, note: "future Hercules guide" }
  ];
  const southStars = [
    { year: 2000, name: "Sigma Octantis", constellation: "Octans", distanceDeg: 1, note: "current faint south pole star" },
    { year: 7000, name: "Southern Cross region", constellation: "Crux", distanceDeg: 6, note: "approximate southern guide region" },
    { year: 14000, name: "Canopus region", constellation: "Carina", distanceDeg: 8, note: "bright southern sky reference, not close" },
    { year: 20000, name: "Achernar region", constellation: "Eridanus", distanceDeg: 7, note: "future southern guide region" }
  ];
  const nearest = (items) => items.reduce((best, item) => Math.abs(item.year - year) < Math.abs(best.year - year) ? item : best, items[0]);
  return {
    northStars,
    southStars,
    currentNorth: nearest(northStars),
    currentSouth: nearest(southStars)
  };
}

function galacticContext(year) {
  const yearsFromPresent = year - new Date().getFullYear();
  const orbitFraction = yearsFromPresent / GALACTIC_YEAR_YEARS;
  return {
    galacticYearYears: GALACTIC_YEAR_YEARS,
    yearsFromPresent,
    orbitAngle: wrap(orbitFraction * 360),
    orbitPercent: Math.abs(orbitFraction * 100),
    speedKmS: 230,
    arm: "Orion-Cygnus Spur",
    note: "Schematic: the Sun orbits the Milky Way on a roughly 225-230 million year timescale."
  };
}

function observationSummary(date, location) {
  const illum = moonIllumination(date);
  const activeMeteors = meteorActivity(date, location);
  const daylight = dayLengthHours(date, location.lat);
  const bestShower = activeMeteors[0];
  return {
    moonIllumination: illum,
    twilightNote: daylight > 18 ? "short night / twilight-heavy" : daylight < 8 ? "long night" : "normal night",
    bestHours: daylight > 18 ? "brief dark window near local midnight" : "late night to pre-dawn",
    activeMeteors,
    bestShower,
    planetNote: "Planet alt/az can be added with the Astronomy Engine browser bundle in the standalone app."
  };
}

export function solarGeometrySnapshot(date, timelineYear = date.getFullYear(), location = { lat: 0, lon: 0, name: "Selected location" }) {
  const markers = solarMarkersForYear(date.getFullYear());
  const nextMarker = markers.find((marker) => marker.date.getTime() >= date.getTime()) || solarMarkersForYear(date.getFullYear() + 1)[0];
  const distanceAu = earthSunDistanceAu(date);
  const deepTime = approximateMilankovitchForYear(timelineYear);
  const perihelionAu = 1 - deepTime.eccentricity;
  const aphelionAu = 1 + deepTime.eccentricity;
  return {
    markers,
    nextMarker,
    vernalEquinox: markers[0],
    obliquity: meanObliquity(date),
    eccentricity: orbitalEccentricity(date),
    distanceAu,
    distanceKm: distanceAu * AU_KM,
    ayanamsha: lahiriAyanamsha(date),
    tropicalSunLongitude: tropicalSunLongitude(date),
    equationOfTime: equationOfTime(date),
    timelineYear,
    deepTime,
    orbit: {
      perihelionAu,
      aphelionAu,
      perihelionKm: perihelionAu * AU_KM,
      aphelionKm: aphelionAu * AU_KM
    },
    season: seasonContext(date, location, deepTime),
    insolation: insolationSamples(date, deepTime),
    analemma: analemmaSamples(date.getUTCFullYear(), date),
    eclipse: eclipseContext(date),
    observation: observationSummary(date, location),
    calendars: calendarComparisons(),
    poleStars: poleStarContext(timelineYear),
    galactic: galacticContext(timelineYear)
  };
}
