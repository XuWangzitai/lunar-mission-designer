// 3D world: terrain mesh from the heightmap, the rover, driving, and the camera.
// Rules live in sim.js; this file reports what the rover physically did each frame.
// Local map coords (x east, y north) map to Three.js as (x, height, -y).

import * as THREE from "three";

/* global CONFIG, Terrain, Sim, Sound */
const C = CONFIG;
const TR = Terrain;
const deg = Math.PI / 180;
const ROVER_SCALE = 8; // the rover is drawn 8× size so it reads at crater scale

let renderer, scene, camera, clock, root;
let terrain = null, terrainMesh = null, rover = null, headlight = null, decor = null;
let sim = null, handlers = {};
let mode = "idle"; // idle | preview | drive
let paused = false;
let camMode = "chase";
const keys = {};
const state = { x: 0, y: 0, heading: 0, lights: true, lastWarn: 0, edgeArmed: true, near: null, speed: 0 };

function init(container) {
  root = container;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(60, 1, 5, 600000);
  clock = new THREE.Clock();
  scene.add(stars());
  initDetail();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (mode !== "drive" || paused) return;
    if (e.code === "KeyH") { state.lights = !state.lights; emit("lights", state.lights); }
    if (e.code === "KeyC") camMode = camMode === "chase" ? "first" : "chase";
    if (e.code === "KeyE" && state.near) emit("site", state.near);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  resize();
  renderer.setAnimationLoop(frame);
}

function resize() {
  const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function stars() {
  const g = new THREE.BufferGeometry(), n = 3000, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = 400000, s = Math.sqrt(1 - u * u);
    p.set([r * s * Math.cos(t), r * Math.abs(u) * 0.9 + 2000, r * s * Math.sin(t)], i * 3);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false }));
}

function regolithTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#888";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.random() * 90, r = Math.random() * 2.2;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = "rgba(40,40,40,.35)"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 10, 0, 7); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Small craters (30–400 m) as a shading layer, too small for the 240 m LOLA grid to show.
// Mid-gray means "no change"; the shader multiplies the ground by twice this value.
function craterTexture() {
  const S = 512, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let k = 0; k < 70; k++) {
    const r = 4 + Math.pow(rnd(), 2.2) * 46, x = rnd() * S, y = rnd() * S;
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { // wrap at the edges so it tiles
      const bowl = g.createRadialGradient(x + dx - r * 0.15, y + dy - r * 0.15, r * 0.1, x + dx, y + dy, r);
      bowl.addColorStop(0, "rgba(70,70,70,.55)");
      bowl.addColorStop(0.75, "rgba(100,100,100,.35)");
      bowl.addColorStop(0.92, "rgba(175,175,175,.45)");
      bowl.addColorStop(1, "rgba(128,128,128,0)");
      g.fillStyle = bowl;
      g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// A stylized Earth map (equirectangular) for the globe in the sky.
function earthTexture() {
  const W = 512, H = 256, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#1c4c8f";
  g.fillRect(0, 0, W, H);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const blob = (x, y, rx, ry, color) => { g.fillStyle = color; g.beginPath(); g.ellipse(x, y, rx, ry, rnd() * 3, 0, 7); g.fill(); };
  for (let k = 0; k < 9; k++) {
    const x = rnd() * W, y = 40 + rnd() * (H - 80);
    for (let j = 0; j < 7; j++) blob(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 40, 10 + rnd() * 28, 8 + rnd() * 18, j % 3 ? "#5f7f45" : "#a08a5c");
  }
  g.fillStyle = "#e9eef2"; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 16, W, 16); // polar ice
  g.globalAlpha = 0.75;
  for (let k = 0; k < 40; k++) { g.strokeStyle = "#ffffff"; g.lineWidth = 3 + rnd() * 6; g.beginPath(); const x = rnd() * W, y = rnd() * H; g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 10, x + 60, y + 12, x + 90 + rnd() * 40, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Earth lit by the real Sun direction: day side, night side and the terminator between them.
// Its size is real too: ~2° across, about 3.7× the Moon's width as seen from Earth.
function buildEarth(sunDir) {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: earthTexture() }, sunDir: { value: sunDir.clone() } },
    vertexShader: `varying vec2 vUv; varying vec3 vN;
      void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN;
      void main() {
        float d = dot(normalize(vN), normalize(sunDir));
        vec3 day = texture2D(map, vUv).rgb;
        vec3 col = mix(day * 0.025, day * 1.1, smoothstep(-0.12, 0.2, d));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(5200, 48, 32), mat);
  globe.rotation.y = 1.2;
  const halo = document.createElement("canvas");
  halo.width = halo.height = 128;
  const hg = halo.getContext("2d"), grad = hg.createRadialGradient(64, 64, 30, 64, 64, 64);
  grad.addColorStop(0, "rgba(110,170,255,0.35)"); grad.addColorStop(1, "rgba(110,170,255,0)");
  hg.fillStyle = grad; hg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(halo), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.setScalar(5200 * 2.6);
  group.add(glow, globe);
  group.userData.globe = globe;
  return group;
}

// ---------- surface detail around the rover: boulders, wheel tracks, dust ----------
// Boulders are placed per 70 m cell from a hash of the cell, so the same rocks are always in
// the same places; only the cells within ~1.8 km of the rover are drawn.
const ROCK_CELL = 70, ROCK_RADIUS = 1800, ROCK_MAX = 2600, TRACK_MAX = 1800, DUST_MAX = 500;
let rocks = null, rockSun = null, rockCell = { i: 1e9, j: 1e9 }, tracks = null, trackHead = 0, trackLast = null;
let dust = null, dustVel = null, dustAge = null, dustLife = null, dustLit = null, dustHead = 0;

function hash2(i, j, s = 0) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function initDetail() {
  // Lumpy rock shape: displace an icosphere by a hash of each corner (same corner, same push).
  const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const f = 0.72 + 0.5 * hash2(Math.round(x * 97), Math.round(y * 89) + Math.round(z * 83) * 7);
    p.setXYZ(k, x * f, y * f * 0.62, z * f);
  }
  geo.computeVertexNormals();
  // Per-face shade toward one side, so each boulder reads as a solid lump with a lit and a dark side.
  const nrm = geo.attributes.normal, shade = new Float32Array(nrm.count), L = new THREE.Vector3(0.6, 0.55, 0.45).normalize();
  for (let k = 0; k < nrm.count; k++) shade[k] = 0.2 + 0.75 * Math.max(0, nrm.getX(k) * L.x + nrm.getY(k) * L.y + nrm.getZ(k) * L.z);
  geo.setAttribute("aShade", new THREE.BufferAttribute(shade, 1));
  rockSun = new THREE.InstancedBufferAttribute(new Float32Array(ROCK_MAX), 1);
  geo.setAttribute("aSun", rockSun);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true });
  // Same lighting rule as the ground: baked sunlight (none in permanent shadow) + headlights.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aSun;\nattribute float aShade;\nvarying float vSun;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSun = aSun * aShade;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vSun;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSun * diffuseColor.rgb;");
  };
  rocks = new THREE.InstancedMesh(geo, mat, ROCK_MAX);
  rocks.count = 0;
  rocks.frustumCulled = false;
  rocks.visible = false;
  scene.add(rocks);

  const trackMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  tracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), trackMat, TRACK_MAX);
  tracks.count = 0;
  tracks.frustumCulled = false;
  scene.add(tracks);

  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DUST_MAX * 3), 3));
  dg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(DUST_MAX * 3), 3));
  // Soft round grain instead of the default square point.
  const dc = document.createElement("canvas");
  dc.width = dc.height = 32;
  const dctx = dc.getContext("2d"), dgr = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  dgr.addColorStop(0, "rgba(255,255,255,1)"); dgr.addColorStop(0.4, "rgba(255,255,255,0.5)"); dgr.addColorStop(1, "rgba(255,255,255,0)");
  dctx.fillStyle = dgr; dctx.fillRect(0, 0, 32, 32);
  dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 2.6, map: new THREE.CanvasTexture(dc), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  dustVel = new Float32Array(DUST_MAX * 3);
  dustAge = new Float32Array(DUST_MAX).fill(99);
  dustLife = new Float32Array(DUST_MAX).fill(1);
  dustLit = new Float32Array(DUST_MAX);
  scene.add(dust);
}

function resetDetail() {
  rockCell = { i: 1e9, j: 1e9 };
  rocks.count = 0;
  tracks.count = 0; trackHead = 0; trackLast = null;
  dustAge.fill(99);
}

function updateRocks() {
  const T = terrain, ci = Math.floor(state.x / ROCK_CELL), cj = Math.floor(state.y / ROCK_CELL);
  if (Math.abs(ci - rockCell.i) < 3 && Math.abs(cj - rockCell.j) < 3) return;
  rockCell = { i: ci, j: cj };
  const span = Math.ceil(ROCK_RADIUS / ROCK_CELL), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  let n = 0;
  for (let j = cj - span; j <= cj + span && n < ROCK_MAX; j++) for (let i = ci - span; i <= ci + span && n < ROCK_MAX; i++) {
    const h = hash2(i, j);
    if (h > 0.55) continue; // ~55 % of cells hold a rock
    const x = (i + hash2(i, j, 1)) * ROCK_CELL, y = (j + hash2(i, j, 2)) * ROCK_CELL;
    if ((x - state.x) ** 2 + (y - state.y) ** 2 > ROCK_RADIUS * ROCK_RADIUS) continue;
    if (Math.abs(x) > T.half * 0.97 || Math.abs(y) > T.half * 0.97) continue;
    if (T.sites.some((s) => Math.hypot(s.x - x, s.y - y) < C.siteRadiusM * 0.8)) continue; // keep site rings clear
    const big = hash2(i, j, 3) > 0.97;
    const s = big ? 12 + hash2(i, j, 4) * 14 : 2 + Math.pow(hash2(i, j, 4), 2.2) * 8;
    e.set(hash2(i, j, 5) * 0.6, hash2(i, j, 6) * 6.3, hash2(i, j, 7) * 0.6);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, TR.heightAt(T, x, y) - s * 0.25, -y), q, new THREE.Vector3(s * (0.8 + hash2(i, j, 8) * 0.6), s, s * (0.8 + hash2(i, j, 9) * 0.6)));
    rocks.setMatrixAt(n, m);
    const v = 0.38 + hash2(i, j, 10) * 0.25;
    rocks.setColorAt(n, col.setRGB(v, v * 0.98, v * 0.95));
    const lit = TR.litAt(T, x, y);
    rockSun.setX(n, lit === 0 ? 0 : 0.25 + 0.4 * Math.sqrt(lit));
    n++;
  }
  rocks.count = n;
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  rockSun.needsUpdate = true;
}

// Two wheel-track marks every ~8 m, aligned with the rover body; the oldest are reused.
function addTracks() {
  const p = rover.position;
  if (trackLast && p.distanceTo(trackLast) < 8) return;
  trackLast = p.clone();
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(rover.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(rover.quaternion);
  const m = new THREE.Matrix4(), scale = new THREE.Vector3(0.3 * ROVER_SCALE, 1, 9);
  for (const sgn of [-1, 1]) {
    const at = p.clone().addScaledVector(side, sgn * 0.95 * ROVER_SCALE).addScaledVector(up, 1.2);
    m.compose(at, rover.quaternion, scale);
    tracks.setMatrixAt(trackHead, m);
    trackHead = (trackHead + 1) % TRACK_MAX;
    tracks.count = Math.min(TRACK_MAX, tracks.count + 1);
  }
  tracks.instanceMatrix.needsUpdate = true;
}

// Wheel dust. With no air on the Moon it flies in clean ballistic arcs and falls straight back
// down instead of hanging in a cloud. (Sped up to match the game's time-lapse.)
function updateDust(dt, moving, lit) {
  const pos = dust.geometry.attributes.position, colr = dust.geometry.attributes.color;
  if (moving) {
    const back = new THREE.Vector3(0, 0, -1).applyQuaternion(rover.quaternion), side = new THREE.Vector3(1, 0, 0).applyQuaternion(rover.quaternion);
    const bright = lit > 0 ? 0.3 : state.lights ? 0.14 : 0.02;
    for (let k = 0; k < 4; k++) {
      const i = dustHead; dustHead = (dustHead + 1) % DUST_MAX;
      const sgn = Math.random() < 0.5 ? -1 : 1;
      const at = rover.position.clone().addScaledVector(back, 0.9 * ROVER_SCALE).addScaledVector(side, sgn * 0.95 * ROVER_SCALE);
      pos.setXYZ(i, at.x + (Math.random() - 0.5) * 3, at.y + 1.5, at.z + (Math.random() - 0.5) * 3);
      dustVel[i * 3] = back.x * 14 + (Math.random() - 0.5) * 14;
      dustVel[i * 3 + 1] = 6 + Math.random() * 14;
      dustVel[i * 3 + 2] = back.z * 14 + (Math.random() - 0.5) * 14;
      dustAge[i] = 0; dustLife[i] = 0.8 + Math.random() * 0.7; dustLit[i] = bright;
    }
  }
  for (let i = 0; i < DUST_MAX; i++) {
    if (dustAge[i] >= dustLife[i]) { colr.setXYZ(i, 0, 0, 0); continue; }
    dustAge[i] += dt;
    dustVel[i * 3 + 1] -= 30 * dt; // gravity, sped up with the time-lapse
    pos.setXYZ(i, pos.getX(i) + dustVel[i * 3] * dt, pos.getY(i) + dustVel[i * 3 + 1] * dt, pos.getZ(i) + dustVel[i * 3 + 2] * dt);
    const f = dustLit[i] * (1 - dustAge[i] / dustLife[i]);
    colr.setXYZ(i, f, f * 0.97, f * 0.93);
  }
  pos.needsUpdate = true;
  colr.needsUpdate = true;
}

function buildTerrain(T) {
  if (terrainMesh) { scene.remove(terrainMesh); terrainMesh.geometry.dispose(); }
  if (decor) scene.remove(decor);
  const n = T.n, size = (n - 1) * T.cell;
  const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) pos.setY(r * n + c, T.h[(n - 1 - r) * n + c]); // rows run north→south
  geo.computeVertexNormals();

  // Sunlight is baked per vertex from the terrain's own shadow map, so permanently shadowed
  // ground gets none, while the headlights (a real light) still reveal it.
  // Low Sun (real: never more than ~1.5° up at the pole), shining from the route side.
  const sunAz = Math.atan2(T.routeDir.x, T.routeDir.y);
  const sunDir = new THREE.Vector3(Math.sin(sunAz), Math.tan(C.sunElevationDeg * deg), -Math.cos(sunAz)).normalize();
  const flat = new THREE.Vector3(sunDir.x, 0.35, sunDir.z).normalize();
  const nrm = geo.attributes.normal, bake = new Float32Array(pos.count * 3), nv = new THREE.Vector3();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = r * n + c, lit = T.lit[(n - 1 - r) * n + c];
    nv.fromBufferAttribute(nrm, v);
    const b = lit === 0 ? 0 : (0.25 + 0.75 * Math.sqrt(lit)) * (0.35 + 0.65 * Math.max(0, nv.dot(flat)));
    bake.set([b, b * 0.97, b * 0.92], v * 3);
  }
  geo.setAttribute("bake", new THREE.BufferAttribute(bake, 3));
  const tex = regolithTexture();
  tex.repeat.set(size / 900, size / 900);
  const mat = new THREE.MeshStandardMaterial({ color: 0xa8a8a8, map: tex, roughness: 1, metalness: 0 });
  const craters = craterTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.craterMap = { value: craters };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 bake;\nvarying vec3 vBake;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBake = bake;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vBake;\nuniform sampler2D craterMap;")
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= texture2D(craterMap, vMapUv * 0.23).rgb * 2.0;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vBake * diffuseColor.rgb;");
  };
  terrainMesh = new THREE.Mesh(geo, mat);
  scene.add(terrainMesh);

  decor = new THREE.Group();
  const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(2600, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
  sunDisk.position.copy(sunDir.clone().multiplyScalar(300000));
  decor.add(sunDisk);
  decor.add(new THREE.HemisphereLight(0x8899bb, 0x111111, 0.08)); // faint earthshine
  // Earth sits over longitude 0 (map north), a few degrees above the horizon.
  const earth = buildEarth(sunDir);
  earth.position.set(0, Math.tan(C.earthElevationDeg * deg) * 300000, -300000);
  decor.add(earth);

  // Beacons along the suggested route and pillars at the science sites.
  const beaconGeo = new THREE.ConeGeometry(14, 60, 6), beaconMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff });
  T.beacons.forEach((b) => {
    const m = new THREE.Mesh(beaconGeo, beaconMat);
    m.position.set(b.x, TR.heightAt(T, b.x, b.y) + 40, -b.y);
    decor.add(m);
  });
  T.sites.forEach((s) => {
    const color = s.kind === "floor" ? 0x6fe3ff : 0xffb547;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 1600, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.set(s.x, s.z + 800, -s.y);
    const ring = new THREE.Mesh(new THREE.RingGeometry(C.siteRadiusM * 0.9, C.siteRadiusM, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, s.z + 15, -s.y);
    decor.add(pillar, ring);
  });
  scene.add(decor);
}

function buildRover() {
  if (rover) scene.remove(rover);
  rover = new THREE.Group();
  const body = new THREE.Group();
  // Slight self-glow so the rover reads in the dark (the terrain has no general sun light).
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.5, metalness: 0.4, emissive: 0x3a3d42 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.8, emissive: 0x121418 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.4, metalness: 0.6, emissive: 0x4a3a18 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.4), gold);
  chassis.position.y = 0.9;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 2.5), metal);
  deck.position.y = 1.24;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.2), new THREE.MeshStandardMaterial({ color: 0x1b2f63, roughness: 0.3, metalness: 0.7 }));
  panel.position.set(0, 1.5, -0.5); panel.rotation.z = 0.5;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), metal);
  mast.position.set(0, 1.9, 0.9);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.25), dark);
  head.position.set(0, 2.5, 0.95);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0x6fe3ff }));
  eye.position.set(0, 2.5, 1.09);
  body.add(chassis, deck, panel, mast, head, eye);
  for (const x of [-0.95, 0.95]) for (const z of [-0.9, 0, 0.9]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), dark);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.35, z);
    body.add(w);
  }
  body.scale.setScalar(ROVER_SCALE);
  rover.add(body);
  headlight = new THREE.SpotLight(0xfff6e6, 9, 3500, 0.6, 0.5, 0);
  headlight.position.set(0, 2.4 * ROVER_SCALE, 1.2 * ROVER_SCALE);
  headlight.target.position.set(0, -60, 600);
  rover.add(headlight, headlight.target);
  scene.add(rover);
}

function placeRover() {
  const T = terrain, h = TR.heightAt(T, state.x, state.y);
  rover.position.set(state.x, h, -state.y);
  // Tilt to the ground: up = terrain normal, forward = heading.
  const e = 40;
  const nx = TR.heightAt(T, state.x - e, state.y) - TR.heightAt(T, state.x + e, state.y);
  const nz = TR.heightAt(T, state.x, state.y + e) - TR.heightAt(T, state.x, state.y - e);
  const up = new THREE.Vector3(nx, 2 * e, -nz).normalize();
  const fwd = new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const f2 = new THREE.Vector3().crossVectors(up, right).normalize();
  rover.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right.negate(), up, f2));
}

function load(T) {
  terrain = T;
  buildTerrain(T);
  buildRover();
  state.x = T.start.x; state.y = T.start.y; state.heading = T.start.heading;
  placeRover();
}

function preview(T) {
  load(T);
  mode = "preview";
  rover.visible = false;
  resetDetail();
  rocks.visible = false;
  if (typeof Sound !== "undefined") Sound.quiet();
}

function start(s, h) {
  sim = s; handlers = h;
  mode = "drive"; paused = false; camMode = "chase";
  rover.visible = true;
  state.lights = true; state.edgeArmed = true; state.lastWarn = 0; state.near = null;
  state.x = terrain.start.x; state.y = terrain.start.y; state.heading = terrain.start.heading;
  placeRover();
  resetDetail();
  rocks.visible = true;
  updateRocks();
}

function stop() { mode = "idle"; sim = null; if (typeof Sound !== "undefined") Sound.quiet(); }
function setPaused(p) { paused = p; if (p && typeof Sound !== "undefined") Sound.drive(0); }
function emit(name, data) { handlers.onEvent && handlers.onEvent(name, data); }
function position() { return { x: state.x, y: state.y, heading: state.heading }; }

let hudTimer = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === "preview") orbit(dt);
  if (mode === "drive" && !paused && sim && !sim.done && !sim.failurePending) drive(dt);
  else if (mode === "drive") updateDust(dt, false, 0); // let airborne dust settle while paused
  if (mode === "drive") followCamera(dt);
  renderer.render(scene, camera);
}

let orbitAngle = 0;
function orbit(dt) {
  orbitAngle += dt * 0.08;
  const R = terrain.meta.diameterKm * 1000;
  camera.position.set(Math.sin(orbitAngle) * R * 1.05, R * 0.8, Math.cos(orbitAngle) * R * 1.05);
  camera.lookAt(0, -terrain.meta.depthKm * 700, 0);
}

function drive(dt) {
  const T = terrain;
  const fwdKey = keys.KeyW || keys.ArrowUp || keys.touchUp, backKey = keys.KeyS || keys.ArrowDown || keys.touchDown;
  const left = keys.KeyA || keys.ArrowLeft || keys.touchLeft, right = keys.KeyD || keys.ArrowRight || keys.touchRight;
  const throttle = (fwdKey ? 1 : 0) - (backKey ? 0.5 : 0);
  state.heading += ((right ? 1 : 0) - (left ? 1 : 0)) * 1.4 * dt;

  const lit = TR.litAt(T, state.x, state.y), shadow = lit === 0;
  const signal = TR.signalAt(T, state.x, state.y);
  let speed = (C.speedKmh / 3.6) * C.timeScale; // m per real second
  if (shadow && !state.lights) speed *= C.blindSpeedFactor;
  if (Sim.repairing(sim)) speed = 0;

  const dx = Math.sin(state.heading), dy = Math.cos(state.heading);
  const dir = throttle >= 0 ? 1 : -1;
  const slope = TR.slopeAlong(T, state.x, state.y, dx * dir, dy * dir);
  let moved = 0, climb = 0;
  if (throttle !== 0) {
    const now = performance.now();
    const steep = Math.abs(slope);
    if (steep > C.maxSlopeDeg + 3) {
      if (now - state.lastWarn > 3500) { state.lastWarn = now; emit(slope > 0 ? "tooSteepUp" : "tooSteepDown", steep.toFixed(0)); }
    } else {
      // Between the safe limit and 3° past it, the rover creeps and complains.
      if (steep > C.maxSlopeDeg) { speed *= 0.4; if (now - state.lastWarn > 3500) { state.lastWarn = now; emit("creep", steep.toFixed(0)); } }
      const step = speed * Math.abs(throttle) * dt * dir;
      const nx = state.x + dx * step, ny = state.y + dy * step;
      if (Math.abs(nx) < T.half * 0.98 && Math.abs(ny) < T.half * 0.98) {
        climb = TR.heightAt(T, nx, ny) - TR.heightAt(T, state.x, state.y);
        moved = Math.abs(step);
        state.x = nx; state.y = ny;
      }
    }
  }
  state.speed = moved / dt;

  // Edge warning when approaching the rim from outside.
  const R = T.meta.diameterKm * 500, r = Math.hypot(state.x, state.y);
  if (r > R * 1.2) state.edgeArmed = true;
  if (state.edgeArmed && r < R * 1.08) {
    state.edgeArmed = false;
    const ahead = Math.abs(TR.slopeAlong(T, state.x + dx * 900, state.y + dy * 900, dx, dy));
    emit("edge", ahead.toFixed(0));
  }

  const dtH = (dt * C.timeScale) / 3600;
  const deep = TR.heightAt(T, state.x, state.y) < -200 * T.meta.depthKm; // more than 20 % of the way down
  const events = Sim.tick(sim, dtH, moved, climb, { lit, shadow, deep, signal, lights: state.lights && shadow, slopeDeg: slope });
  events.forEach((ev) => emit(ev));
  if (sim && sim.done) { emit("stuck"); return; } // battery ran out this frame: always tell the UI

  const near = T.sites.find((s) => Math.hypot(s.x - state.x, s.y - state.y) < C.siteRadiusM) || null;
  if ((near && near.id) !== (state.near && state.near.id)) { state.near = near; emit("near", near); }

  headlight.visible = state.lights;
  placeRover();
  updateRocks();
  if (moved > 0) addTracks();
  updateDust(dt, moved > 0, lit);
  if (typeof Sound !== "undefined") {
    const base = (C.speedKmh / 3.6) * C.timeScale;
    Sound.drive(moved > 0 ? Math.min(1, state.speed / base) : 0, Math.min(1, Math.max(0, slope) / C.maxSlopeDeg));
  }
  hudTimer += dt;
  if (hudTimer > 0.1) {
    hudTimer = 0;
    handlers.onHud && handlers.onHud({ lit, shadow, signal, slope, lights: state.lights, speedKmh: moved > 0 ? (shadow && !state.lights ? C.speedKmh * C.blindSpeedFactor : C.speedKmh) : 0, x: state.x, y: state.y, heading: state.heading });
  }
}

function followCamera(dt) {
  const fwd = new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
  const p = rover.position;
  let want, look;
  if (camMode === "first") {
    want = p.clone().add(new THREE.Vector3(0, 2.6 * ROVER_SCALE, 0)).add(fwd.clone().multiplyScalar(1.2 * ROVER_SCALE));
    look = want.clone().add(fwd.clone().multiplyScalar(400)).add(new THREE.Vector3(0, -40, 0));
    camera.position.copy(want);
  } else {
    want = p.clone().add(fwd.clone().multiplyScalar(-110)).add(new THREE.Vector3(0, 48, 0));
    const ground = TR.heightAt(terrain, want.x, -want.z) + 20;
    if (want.y < ground) want.y = ground;
    camera.position.lerp(want, Math.min(1, dt * 4));
    look = p.clone().add(fwd.clone().multiplyScalar(120)).add(new THREE.Vector3(0, 10, 0));
  }
  camera.lookAt(look);
}

// Touch / on-screen controls feed the same key table.
function setTouch(name, down) { keys[name] = down; }

// Test hook: point the rover (used by automated play-throughs).
function aim(x, y) { state.heading = Math.atan2(x - state.x, y - state.y); }

// Demo recording renders at a lower resolution so screen capture stays smooth.
function setPixelRatio(r) { renderer.setPixelRatio(r); resize(); }

window.World = { init, load, preview, start, stop, setPaused, position, setTouch, aim, setPixelRatio, terrain: () => terrain, toggleLights: () => { state.lights = !state.lights; emit("lights", state.lights); }, toggleCamera: () => { camMode = camMode === "chase" ? "first" : "chase"; }, nearSite: () => state.near };
