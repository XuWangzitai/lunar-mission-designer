// v2 checks: real crater data loads, physics behaves, and each crater's forecast is sane.
// Run: node tests/run-tests.js

global.CONFIG = require("../config.js");
global.Terrain = require("../terrain.js");
const Sim = require("../sim.js");
const CRATERS = require("../data/craters.js");

let fails = 0;
const check = (label, cond, detail = "") => { if (!cond) fails++; console.log(`${cond ? "PASS" : "FAIL"}  ${label} ${detail}`); };

const sh = CRATERS.find((c) => c.id === "shackleton");
check("Shackleton depth matches NASA (4.1 ± 0.2 km)", Math.abs(sh.depthKm - 4.1) < 0.2, `got ${sh.depthKm}`);
check("Shackleton walls ~30° (Zuber 2012: 30.5°)", Math.abs(sh.wallSlopeMeanDeg - 30.5) < 3, `got ${sh.wallSlopeMeanDeg}`);

const FULL = ["neutron", "ir", "drill"];
const SAFE = ["neutron", "drill", "backup"];
console.log("\nForecasts (energy to visit all 3 sites and return to the start):");
for (const c of CRATERS) {
  const T = Terrain.fromCrater(c);
  const floorLit = Terrain.litAt(T, T.sites[2].x, T.sites[2].y);
  const fmt = (p) => `${p.needed}/${p.capacity}Wh→${p.stuck ? "STUCK" : p.tier}`;
  const a = Sim.predict(T, FULL), af = Sim.predict(T, FULL, { failure: "shadow" });
  const b = Sim.predict(T, SAFE), bf = Sim.predict(T, SAFE, { failure: "shadow" });
  const trapKm = (Math.hypot(T.sites[2].x - T.start.x, T.sites[2].y - T.start.y) / 1000).toFixed(1);
  console.log(`  ${c.name.padEnd(11)} route ${String(c.gentlestRoute.maxSlopeDeg).padStart(4)}° trap ${trapKm} km, ${(-T.sites[2].z).toFixed(0)} m down, shadow ${a.shadowH.toFixed(1)} h | MAX ${fmt(a)} fail:${fmt(af)} | SAFE ${fmt(b)} fail:${fmt(bf)}`);
  check(`${c.name}: cold trap is in permanent shadow`, floorLit === 0);
}

// Physics sanity: climbing 1 km costs m·g·h/η.
const T = Terrain.fromCrater(CRATERS[3]);
const s = Sim.create(T, ["neutron"]);
const before = s.stored;
Sim.tick(s, 0, 0, 1000, { lit: 0, shadow: false, signal: true, lights: false });
const expected = (258 * 1.62 * 1000) / 0.5 / 3600;
check("climb energy = m·g·h/η", Math.abs(before - s.stored - expected) < 0.5, `${(before - s.stored).toFixed(1)} vs ${expected.toFixed(1)} Wh`);

// Data taken out of signal only counts once uplinked.
const s2 = Sim.create(T, ["neutron", "drill"], { failureTrigger: "none" });
Sim.tick(s2, 0.1, 0, 0, { lit: 0, shadow: true, signal: false, lights: true });
Sim.runScience(s2, T.sites[2], ["drill"]);
check("cold-trap data waits for signal", Sim.evaluate(s2).met.R4 === false && s2.pending.length === 1);
Sim.tick(s2, 0.1, 0, 0, { lit: 1, shadow: false, signal: true, lights: false });
check("data uplinks when Earth is in view", Sim.evaluate(s2).met.R4 === true);

console.log(fails ? `\n${fails} failure(s)` : "\nAll tests passed");
process.exit(fails ? 1 : 0);
