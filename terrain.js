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

  // Slope (degrees, + uphill) of the ground ahead, over one grid cell — the same baseline the
  // route planner uses, so a beacon route is always drivable.
  function slopeAlong(T, x, y, dx, dy) {
    const L = T.cell;
    const dh = heightAt(T, x + dx * L, y + dy * L) - heightAt(T, x, y);
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
        if (Math.abs(p.x) < T.half && Math.abs(p.y) < T.half && signalAt(T, p.x, p.y) && litAt(T, p.x, p.y) >= 0.5 && maxSlope(T, p.x, p.y) < 8) { start = p; break; }
      }
      if (start) break;
    }
    start = start || { x: T.routeDir.x * R * 1.12, y: T.routeDir.y * R * 1.12 };
    T.start = { ...start, heading: Math.atan2(-T.routeDir.x, -T.routeDir.y) };
    // Safest drivable path from the landing site toward the floor (A* on the real grid).
    const route = findPath(T, start, T.floor, C.maxSlopeDeg);
    T.routeReachesFloor = route.reached;
    let path = route.path;
    // Cold trap = first permanently shadowed ground well down that path (+~1.5 km inside).
    let trapIdx = path.length - 1, walked = 0;
    for (let k = 1; k < path.length; k++) {
      walked += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y);
      if (litAt(T, path[k].x, path[k].y) === 0 && heightAt(T, path[k].x, path[k].y) < -0.5 * depth) {
        trapIdx = Math.min(path.length - 1, k + Math.ceil(1500 / T.cell));
        break;
      }
    }
    path = path.slice(0, trapIdx + 1);
    const trapOk = route.reached || litAt(T, path[trapIdx].x, path[trapIdx].y) === 0;
    // If the rover can't get into the shadow, the cold trap still exists; it's just out of reach.
    const trap = trapOk ? path[trapIdx] : { x: T.floor.x, y: T.floor.y };
    T.trapReachable = trapOk;
    T.path = path;
    const wall = path[Math.floor(path.length / 2)] || start;
    // Rim site: sunlit, in view of Earth, flat, a few km from the landing spot, drivable.
    let rimSite = null;
    const a0 = Math.atan2(start.y, start.x), r0 = Math.hypot(start.x, start.y);
    for (const da of [12, -12, 20, -20, 30, -30, 45, -45]) {
      for (const rr of [1, 1.08, 0.95]) {
        const p = { x: Math.cos(a0 + da * deg) * r0 * rr, y: Math.sin(a0 + da * deg) * r0 * rr };
        if (Math.abs(p.x) > T.half * 0.95 || Math.abs(p.y) > T.half * 0.95) continue;
        if (litAt(T, p.x, p.y) >= 0.5 && signalAt(T, p.x, p.y) && maxSlope(T, p.x, p.y) < 10 && findPath(T, start, p, C.maxSlopeDeg).reached) { rimSite = p; break; }
      }
      if (rimSite) break;
    }
    rimSite = rimSite || { x: start.x, y: start.y };
    T.sites = [
      { id: "rim", label: "Rim survey site", kind: "rim", x: rimSite.x, y: rimSite.y },
      { id: "wall", label: "Crater wall site", kind: "wall", x: wall.x, y: wall.y },
      { id: "floor", label: "Cold trap", kind: "floor", x: trap.x, y: trap.y },
    ];
    T.sites.forEach((s) => { s.z = heightAt(T, s.x, s.y); });
    // Beacons every ~2 grid cells along the drivable path.
    T.beacons = path.filter((_, k) => k % 2 === 0);
    return T;
  }

  // A* over the height grid, only along steps the rover can drive (with a 20 % safety margin,
  // since the ground between grid points can be a little steeper).
  // Returns {path: [{x,y}], reached: bool}; if the target can't be reached, the path ends at
  // the closest reachable point.
  function findPath(T, from, to, maxDeg) {
    const n = T.n, tanMax = Math.tan(maxDeg * 0.8 * deg);
    const ix = (x, y) => [Math.max(0, Math.min(n - 1, Math.round((x + T.half) / T.cell))), Math.max(0, Math.min(n - 1, Math.round((y + T.half) / T.cell)))];
    const [si, sj] = ix(from.x, from.y), [ti, tj] = ix(to.x, to.y);
    const start = sj * n + si, goal = tj * n + ti;
    const g = new Float64Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1), closed = new Uint8Array(n * n);
    const est = (k) => Math.hypot((k % n) - ti, Math.floor(k / n) - tj) * T.cell;
    const heap = [];
    const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top[1]; };
    g[start] = 0; push(start, est(start));
    let best = start;
    while (heap.length) {
      const k = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (est(k) < est(best)) best = k;
      if (k === goal) break;
      const i = k % n, j = Math.floor(k / n);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i2 = i + di, j2 = j + dj;
        if (i2 < 1 || j2 < 1 || i2 >= n - 1 || j2 >= n - 1) continue;
        const k2 = j2 * n + i2, d = T.cell * (di && dj ? Math.SQRT2 : 1);
        if (Math.abs(T.h[k2] - T.h[k]) / d > tanMax) continue;
        const ng = g[k] + d;
        if (ng < g[k2]) { g[k2] = ng; came[k2] = k; push(k2, ng + est(k2)); }
      }
    }
    const end = closed[goal] ? goal : best, path = [];
    for (let k = end; k !== -1; k = came[k]) path.push({ x: -T.half + (k % n) * T.cell, y: -T.half + Math.floor(k / n) * T.cell });
    path.reverse();
    return { path, reached: end === goal };
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
