// 3D world: terrain mesh from the heightmap, the rover, driving, and the camera.
// Rules live in sim.js; this file reports what the rover physically did each frame.
// Local map coords (x east, y north) map to Three.js as (x, height, -y).

import * as THREE from "three";

/* global CONFIG, Terrain, Sim */
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
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 bake;\nvarying vec3 vBake;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBake = bake;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vBake;")
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
  const earth = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 32), new THREE.MeshBasicMaterial({ color: 0x4a8be0 }));
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
}

function start(s, h) {
  sim = s; handlers = h;
  mode = "drive"; paused = false; camMode = "chase";
  rover.visible = true;
  state.lights = true; state.edgeArmed = true; state.lastWarn = 0; state.near = null;
  state.x = terrain.start.x; state.y = terrain.start.y; state.heading = terrain.start.heading;
  placeRover();
}

function stop() { mode = "idle"; sim = null; }
function setPaused(p) { paused = p; }
function emit(name, data) { handlers.onEvent && handlers.onEvent(name, data); }
function position() { return { x: state.x, y: state.y, heading: state.heading }; }

let hudTimer = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (mode === "preview") orbit(dt);
  if (mode === "drive" && !paused && sim && !sim.done && !sim.failurePending) drive(dt);
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
  const events = Sim.tick(sim, dtH, moved, climb, { lit, shadow, signal, lights: state.lights && shadow, slopeDeg: slope });
  events.forEach((ev) => emit(ev));

  const near = T.sites.find((s) => Math.hypot(s.x - state.x, s.y - state.y) < C.siteRadiusM) || null;
  if ((near && near.id) !== (state.near && state.near.id)) { state.near = near; emit("near", near); }

  headlight.visible = state.lights;
  placeRover();
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

window.World = { init, load, preview, start, stop, setPaused, position, setTouch, aim, terrain: () => terrain, toggleLights: () => { state.lights = !state.lights; emit("lights", state.lights); }, toggleCamera: () => { camMode = camMode === "chase" ? "first" : "chase"; }, nearSite: () => state.near };
