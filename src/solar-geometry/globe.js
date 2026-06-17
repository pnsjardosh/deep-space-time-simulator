const earthTexture = new Image();
earthTexture.src = "./assets/earth-blue-marble.jpg";
earthTexture.addEventListener("load", () => {
  renderKey = "";
  window.dispatchEvent(new CustomEvent("solar-geometry:earth-texture-ready"));
});

let textureData = null;
let renderKey = "";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureTexture() {
  if (textureData || !earthTexture.complete || earthTexture.naturalWidth === 0) return textureData;
  const offscreen = document.createElement("canvas");
  offscreen.width = earthTexture.naturalWidth;
  offscreen.height = earthTexture.naturalHeight;
  const context = offscreen.getContext("2d", { willReadFrequently: true });
  context.drawImage(earthTexture, 0, 0);
  textureData = {
    width: offscreen.width,
    height: offscreen.height,
    pixels: context.getImageData(0, 0, offscreen.width, offscreen.height).data
  };
  return textureData;
}

export function projectLocationOnGlobe(location, view) {
  const lat = location.lat * Math.PI / 180;
  const lon = location.lon * Math.PI / 180;
  const lat0 = view.lat * Math.PI / 180;
  const lon0 = view.lon * Math.PI / 180;
  const dLon = lon - lon0;
  const x = Math.cos(lat) * Math.sin(dLon);
  const y = Math.sin(lat) * Math.cos(lat0) - Math.cos(lat) * Math.sin(lat0) * Math.cos(dLon);
  const z = Math.sin(lat) * Math.sin(lat0) + Math.cos(lat) * Math.cos(lat0) * Math.cos(dLon);
  return {
    x: 50 + x * 48,
    y: 50 - y * 48,
    visible: z > 0
  };
}

export function renderSolarGlobe(canvas, location, subsolar) {
  const texture = ensureTexture();
  if (!canvas || !texture || !location || !subsolar) return;

  const view = {
    lat: clamp(location.lat, -75, 75),
    lon: location.lon
  };
  const key = `${view.lat.toFixed(2)}:${view.lon.toFixed(2)}:${subsolar.lat.toFixed(2)}:${subsolar.lon.toFixed(2)}:${canvas.width}`;
  if (key === renderKey) return;
  renderKey = key;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  const size = canvas.width;
  const radius = size * 0.48;
  const center = size / 2;
  const output = context.createImageData(size, size);
  const lat0 = view.lat * Math.PI / 180;
  const lon0 = view.lon * Math.PI / 180;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  const sunLat = subsolar.lat * Math.PI / 180;
  const sunLon = subsolar.lon * Math.PI / 180;
  const sunVector = [
    Math.cos(sunLat) * Math.cos(sunLon),
    Math.cos(sunLat) * Math.sin(sunLon),
    Math.sin(sunLat)
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - center) / radius;
      const dy = (y + 0.5 - center) / radius;
      const rho2 = dx * dx + dy * dy;
      const out = (y * size + x) * 4;
      if (rho2 > 1) {
        output.data[out + 3] = 0;
        continue;
      }

      const z = Math.sqrt(1 - rho2);
      const lat = Math.asin(z * sinLat0 - dy * cosLat0);
      const lon = lon0 + Math.atan2(dx, z * cosLat0 + dy * sinLat0);
      const lonWrapped = ((lon + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const u = Math.floor((lonWrapped + Math.PI) / (Math.PI * 2) * (texture.width - 1));
      const v = Math.floor((Math.PI / 2 - lat) / Math.PI * (texture.height - 1));
      const source = (v * texture.width + u) * 4;

      const surfaceVector = [
        Math.cos(lat) * Math.cos(lonWrapped),
        Math.cos(lat) * Math.sin(lonWrapped),
        Math.sin(lat)
      ];
      const sunDot = surfaceVector[0] * sunVector[0] + surfaceVector[1] * sunVector[1] + surfaceVector[2] * sunVector[2];
      const day = clamp((sunDot + 0.08) / 0.24, 0, 1);
      const limb = clamp(z, 0, 1);
      const shade = (0.16 + day * 0.9) * (0.58 + limb * 0.48);

      output.data[out] = Math.min(255, texture.pixels[source] * shade + 20 * (1 - day));
      output.data[out + 1] = Math.min(255, texture.pixels[source + 1] * shade + 28 * (1 - day));
      output.data[out + 2] = Math.min(255, texture.pixels[source + 2] * shade + 54 * (1 - day));
      output.data[out + 3] = 255;
    }
  }

  context.clearRect(0, 0, size, size);
  context.putImageData(output, 0, 0);
}

export function resetSolarGlobeRenderCache() {
  renderKey = "";
}
