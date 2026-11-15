// Builds data/craters.js from NASA LRO LOLA polar maps (raw/, not committed).
//   ldem_75s_240m.img  elevation, int16 LSB, height = DN * 0.5 m
//   ldsm_75s_240m.img  slope,     int16 LSB, slope  = DN * 0.0015 + 45 deg
// Source: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
// Crater names, centers and diameters: USGS/IAU Gazetteer of Planetary Nomenclature.
// Run: node tools/build-craters.js

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const N = 3812, SCALE = 240, OFF = 1905.5, R = 1737400;
const dem = new Int16Array(fs.readFileSync(path.join(root, "raw/ldem_75s_240m.img")).buffer.slice(0));
const slp = new Int16Array(fs.readFileSync(path.join(root, "raw/ldsm_75s_240m.img")).buffer.slice(0));

// Gazetteer values (real). Extra facts are cited in `facts`.
const CRATERS = [
  { id: "shackleton", name: "Shackleton", lat: -89.67, lon: 129.78, diameterKm: 20.92 },
  { id: "degerlache", name: "de Gerlache", lat: -88.48, lon: -88.34, diameterKm: 32.71 },
  { id: "faustini", name: "Faustini", lat: -87.18, lon: 84.31, diameterKm: 42.48 },
  { id: "haworth", name: "Haworth", lat: -87.45, lon: -5.17, diameterKm: 51.42 },
  { id: "shoemaker", name: "Shoemaker", lat: -88.14, lon: 45.91, diameterKm: 51.82 },
  { id: "cabeus", name: "Cabeus", lat: -85.33, lon: -42.13, diameterKm: 100.58 },
];

const GRID = 129; // output heightmap samples per side

// Polar stereographic (south), from the PDS LOLA GDR documentation.
function toPixel(lat, lon) {
  const rad = Math.PI / 180;
  const rho = 2 * R * Math.tan(Math.PI / 4 + (lat * rad) / 2);
  const x = rho * Math.sin(lon * rad), y = rho * Math.cos(lon * rad);
  return { s: OFF + x / SCALE, l: OFF - y / SCALE }; // 0-based sample, line (checked against Shackleton's 4.1 km depth)
}

function sample(arr, s, l) {
  const s0 = Math.floor(s), l0 = Math.floor(l), fs_ = s - s0, fl = l - l0;
  const at = (ss, ll) => arr[Math.min(N - 1, Math.max(0, ll)) * N + Math.min(N - 1, Math.max(0, ss))];
  return (at(s0, l0) * (1 - fs_) + at(s0 + 1, l0) * fs_) * (1 - fl) + (at(s0, l0 + 1) * (1 - fs_) + at(s0 + 1, l0 + 1) * fs_) * fl;
}
const heightAt = (s, l) => sample(dem, s, l) * 0.5;
const slopeAt = (s, l) => sample(slp, s, l) * 0.0015 + 45;

function measure(c) {
  const p = toPixel(c.lat, c.lon);
  const rPx = (c.diameterKm * 1000) / 2 / SCALE;

  // Floor: lowest point within 35% of the radius of the center.
  let floor = Infinity, floorAt = null;
  for (let dl = -rPx * 0.35; dl <= rPx * 0.35; dl++) for (let ds = -rPx * 0.35; ds <= rPx * 0.35; ds++) {
    const h = heightAt(p.s + ds, p.l + dl);
    if (h < floor) { floor = h; floorAt = { ds, dl }; }
  }

  // Rim crest and gentlest route along 72 radial profiles.
  const routes = [];
  for (let a = 0; a < 72; a++) {
    const ang = (a * 5 * Math.PI) / 180, dx = Math.cos(ang), dy = Math.sin(ang);
    let crest = -Infinity, crestR = 0;
    for (let r = rPx * 0.7; r <= rPx * 1.3; r += 0.5) {
      const h = heightAt(p.s + dx * r, p.l + dy * r);
      if (h > crest) { crest = h; crestR = r; }
    }
    // Steepest 720 m stretch going down from the crest to 15% of the radius.
    let worst = 0, sum = 0, n = 0;
    for (let r = crestR; r > rPx * 0.15; r -= 1) {
      const h1 = heightAt(p.s + dx * r, p.l + dy * r), h2 = heightAt(p.s + dx * (r - 3), p.l + dy * (r - 3));
      const deg = (Math.atan2(Math.abs(h1 - h2), 3 * SCALE) * 180) / Math.PI;
      worst = Math.max(worst, deg); sum += deg; n++;
    }
    routes.push({ azimuthDeg: a * 5, crest, crestR, worst, avg: sum / n });
  }
  const rim = routes.reduce((m, r) => m + r.crest, 0) / routes.length;
  const best = routes.reduce((b, r) => (r.worst < b.worst ? r : b));

  // Mean slope (LOLA slope map) on the inner wall: 45%-85% of the radius.
  let ws = 0, wn = 0;
  for (let dl = -rPx; dl <= rPx; dl++) for (let ds = -rPx; ds <= rPx; ds++) {
    const r = Math.hypot(ds, dl) / rPx;
    if (r > 0.45 && r < 0.85) { ws += slopeAt(p.s + ds, p.l + dl); wn++; }
  }

  // Heightmap crop centered on the crater, out to 0.8 diameters.
  const halfKm = c.diameterKm * 0.8;
  const cellM = (halfKm * 2000) / (GRID - 1);
  const h = new Int16Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const xm = -halfKm * 1000 + i * cellM, ym = -halfKm * 1000 + j * cellM;
    h[j * GRID + i] = Math.round(heightAt(p.s + xm / SCALE, p.l - ym / SCALE) - rim);
  }

  return {
    ...c,
    depthKm: +((rim - floor) / 1000).toFixed(2),
    wallSlopeMeanDeg: +(ws / wn).toFixed(1),
    gentlestRoute: { azimuthDeg: best.azimuthDeg, maxSlopeDeg: +best.worst.toFixed(1), avgSlopeDeg: +best.avg.toFixed(1) },
    steepestRouteDeg: +Math.max(...routes.map((r) => r.worst)).toFixed(1),
    floorOffsetKm: { x: +((floorAt.ds * SCALE) / 1000).toFixed(2), y: +((floorAt.dl * SCALE) / 1000).toFixed(2) },
    grid: { size: GRID, cellM: +cellM.toFixed(1), heights: Buffer.from(h.buffer).toString("base64") },
  };
}

const out = CRATERS.map(measure);
for (const c of out) {
  console.log(`${c.name.padEnd(12)} D=${c.diameterKm} km  depth=${c.depthKm} km  wall mean=${c.wallSlopeMeanDeg}°  gentlest route max=${c.gentlestRoute.maxSlopeDeg}° @${c.gentlestRoute.azimuthDeg}°  steepest=${c.steepestRouteDeg}°`);
}
const js = `// Generated by tools/build-craters.js from NASA LRO LOLA data (ldem/ldsm_75s_240m)\n// and the USGS/IAU Gazetteer. Heights are meters relative to the mean rim crest.\nconst CRATER_DATA = ${JSON.stringify(out)};\nif (typeof module !== "undefined") module.exports = CRATER_DATA;\n`;
fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data/craters.js"), js);
console.log(`wrote data/craters.js (${(js.length / 1024).toFixed(0)} KB)`);
