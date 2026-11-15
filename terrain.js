// Terrain from real LOLA heightmaps (data/craters.js) or a custom crater the player
// describes. Local coordinates are meters from the crater center: x = east on the map,
// y = north on the map (toward longitude 0, where Earth sits for a south-pole observer).

const Terrain = (() => {
  const C = typeof CONFIG !== "undefined" ? CONFIG : require("./config.js");
  const deg = Math.PI / 180;

  function decode(b64) {
    const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  // Real crater from the LOLA crop.
  function fromCrater(c) {
    const n = c.grid.size, cell = c.grid.cellM;
    const h = Float32Array.from(decode(c.grid.heights));
    // Build script azimuths/offsets are in image (sample, line) space; line points south.
    const a = c.gentlestRoute.azimuthDeg * deg;
    const routeDir = { x: Math.cos(a), y: -Math.sin(a) };
    const floor = { x: c.floorOffsetKm.x * 1000, y: -c.floorOffsetKm.y * 1000 };
    return finish({ n, cell, h, half: ((n - 1) * cell) / 2, routeDir, floor, meta: c });
  }

  // Custom crater: a bowl with a flat floor, walls at the chosen slope and a raised rim.
  function custom(p) {
    const n = 129, D = p.diameterKm * 1000, R = D / 2, depth = p.depthKm * 1000;
    const half = D * 0.8, cell = (2 * half) / (n - 1);
    const wallRun = Math.min(R * 0.95, depth / Math.tan(p.wallSlopeDeg * deg));
    const rf = Math.max(R * 0.05, R - wallRun);
    const h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -half + i * cell, y = -half + j * cell, r = Math.hypot(x, y);
      const wobble = 0.03 * depth * Math.sin(x / 1700) * Math.cos(y / 2300);
      let z;
      if (r < rf) z = -depth;
      else if (r < R) z = -depth + (r - rf) * (depth / (R - rf));
      else z = depth * 0.04 * Math.exp(-(r - R) / (R * 0.3));
      h[j * n + i] = z + (r < rf ? wobble * 0.2 : wobble);
    }
    const meta = {
      id: "custom", name: p.name || "Custom crater", custom: true, diameterKm: p.diameterKm, depthKm: p.depthKm,
      wallSlopeMeanDeg: p.wallSlopeDeg, gentlestRoute: { maxSlopeDeg: p.wallSlopeDeg }, floorTempK: p.floorTempK, iceFactor: p.iceFactor,
    };
    return finish({ n, cell, h, half, routeDir: { x: 0, y: -1 }, floor: { x: 0, y: 0 }, meta });
  }

  function heightAt(T, x, y) {
    const fi = (x + T.half) / T.cell, fj = (y + T.half) / T.cell;
    const i = Math.max(0, Math.min(T.n - 2, Math.floor(fi))), j = Math.max(0, Math.min(T.n - 2, Math.floor(fj)));
    const u = Math.max(0, Math.min(1, fi - i)), v = Math.max(0, Math.min(1, fj - j));
    const k = j * T.n + i;
    return (T.h[k] * (1 - u) + T.h[k + 1] * u) * (1 - v) + (T.h[k + T.n] * (1 - u) + T.h[k + T.n + 1] * u) * v;
  }

  // Slope (degrees, + uphill) along a direction, over one grid cell.
  function slopeAlong(T, x, y, dx, dy) {
    const L = T.cell;
    const dh = heightAt(T, x + dx * L * 0.5, y + dy * L * 0.5) - heightAt(T, x - dx * L * 0.5, y - dy * L * 0.5);
    return Math.atan2(dh, L) / deg;
  }

  function maxSlope(T, x, y) {
    let m = 0;
    for (let a = 0; a < 8; a++) m = Math.max(m, Math.abs(slopeAlong(T, x, y, Math.cos(a * Math.PI / 4), Math.sin(a * Math.PI / 4))));
    return m;
  }

  // Can a ray from (x, y) at this azimuth and elevation clear the terrain?
  // Outside the map the land is assumed to sit at rim level.
  function sees(T, x, y, azRad, elevDeg) {
    const h0 = heightAt(T, x, y) + 2, t = Math.tan(elevDeg * deg), dx = Math.sin(azRad), dy = Math.cos(azRad);
    for (let d = T.cell; d < T.half * 2.2; d += T.cell) {
      const px = x + dx * d, py = y + dy * d;
      const ground = Math.abs(px) > T.half || Math.abs(py) > T.half ? 0 : heightAt(T, px, py);
      if (ground > h0 + d * t) return false;
    }
    return true;
  }

  // Per-vertex maps: lit = fraction of the day the Sun clears the horizon (0 = permanent shadow),
  // signal = Earth in view. Both come straight from the terrain shape.
  function finish(T) {
    const n = T.n, AZ = 16;
    T.lit = new Float32Array(n * n);
    T.signal = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -T.half + i * T.cell, y = -T.half + j * T.cell;
      let seen = 0;
      for (let a = 0; a < AZ; a++) if (sees(T, x, y, (a / AZ) * 2 * Math.PI, C.sunElevationDeg)) seen++;
      T.lit[j * n + i] = seen / AZ;
      T.signal[j * n + i] = sees(T, x, y, 0, C.earthElevationDeg) ? 1 : 0;
    }
    const R = T.meta.diameterKm * 500, depth = T.meta.depthKm * 1000;
    // Land just outside the rim near the gentlest route, on flat ground that can see Earth
    // (NASA weighs communications when choosing landing regions).
    let start = null;
    for (const rf of [1.12, 1.2, 1.3, 1.45]) {
      for (const da of [0, 10, -10, 20, -20, 30, -30, 45, -45]) {
        const a0 = Math.atan2(T.routeDir.y, T.routeDir.x) + da * deg;
        const p = { x: Math.cos(a0) * R * rf, y: Math.sin(a0) * R * rf };
        if (Math.abs(p.x) < T.half && Math.abs(p.y) < T.half && signalAt(T, p.x, p.y) && maxSlope(T, p.x, p.y) < 8) { start = p; break; }
      }
      if (start) break;
    }
    start = start || { x: T.routeDir.x * R * 1.12, y: T.routeDir.y * R * 1.12 };
    T.start = { ...start, heading: Math.atan2(-T.routeDir.x, -T.routeDir.y) };
    // Cold trap = first permanently shadowed ground well down the route toward the floor.
    let trap = { x: T.floor.x, y: T.floor.y };
    const L = Math.hypot(T.floor.x - start.x, T.floor.y - start.y);
    for (let d = 0; d < L; d += T.cell / 2) {
      const x = start.x + ((T.floor.x - start.x) * d) / L, y = start.y + ((T.floor.y - start.y) * d) / L;
      if (litAt(T, x, y) === 0 && heightAt(T, x, y) < -0.5 * depth) {
        const k = Math.min(L, d + 1500);
        trap = { x: start.x + ((T.floor.x - start.x) * k) / L, y: start.y + ((T.floor.y - start.y) * k) / L };
        break;
      }
    }
    const side = { x: -T.routeDir.y, y: T.routeDir.x };
    T.sites = [
      { id: "rim", label: "Rim survey site", kind: "rim", x: start.x + side.x * R * 0.25, y: start.y + side.y * R * 0.25 },
      { id: "wall", label: "Crater wall site", kind: "wall", x: (start.x + trap.x) / 2, y: (start.y + trap.y) / 2 },
      { id: "floor", label: "Cold trap", kind: "floor", x: trap.x, y: trap.y },
    ];
    T.sites.forEach((s) => { s.z = heightAt(T, s.x, s.y); });
    // Beacon line: start → wall site → cold trap.
    T.beacons = [];
    const legs = [[T.start, T.sites[1]], [T.sites[1], T.sites[2]]];
    for (const [a, b] of legs) for (let k = 0; k < 1; k += 0.05) T.beacons.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    return T;
  }

  function mapAt(T, arr, x, y) {
    const i = Math.round((x + T.half) / T.cell), j = Math.round((y + T.half) / T.cell);
    if (i < 0 || j < 0 || i >= T.n || j >= T.n) return arr === T.signal ? 1 : 1;
    return arr[j * T.n + i];
  }
  const litAt = (T, x, y) => mapAt(T, T.lit, x, y);
  const signalAt = (T, x, y) => mapAt(T, T.signal, x, y) === 1;

  return { fromCrater, custom, heightAt, slopeAlong, maxSlope, sees, litAt, signalAt };
})();

if (typeof module !== "undefined") module.exports = Terrain;
