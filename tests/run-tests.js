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
  let pathKm = 0, steepest = 0;
  for (let k = 1; k < T.path.length; k++) {
    const d = Math.hypot(T.path[k].x - T.path[k - 1].x, T.path[k].y - T.path[k - 1].y);
    pathKm += d / 1000;
    steepest = Math.max(steepest, Math.atan2(Math.abs(Terrain.heightAt(T, T.path[k].x, T.path[k].y) - Terrain.heightAt(T, T.path[k - 1].x, T.path[k - 1].y)), d) * 180 / Math.PI);
  }
  console.log(`  ${c.name.padEnd(11)} ${T.trapReachable ? "REACHABLE  " : "UNREACHABLE"} path ${pathKm.toFixed(1)} km, steepest step ${steepest.toFixed(1)}°, trap ${(-T.sites[2].z).toFixed(0)} m down, shadow ${a.shadowH.toFixed(1)} h | MAX ${fmt(a)} fail:${fmt(af)} | SAFE ${fmt(b)} fail:${fmt(bf)}`);
  check(`${c.name}: cold trap is in permanent shadow`, floorLit === 0);
  const rimKm = Math.hypot(T.sites[0].x - T.start.x, T.sites[0].y - T.start.y) / 1000;
  check(`${c.name}: landing and rim site are sunlit with Earth in view; rim site within 4 km`,
    Terrain.litAt(T, T.start.x, T.start.y) >= 0.5 && Terrain.litAt(T, T.sites[0].x, T.sites[0].y) >= 0.5 && Terrain.signalAt(T, T.sites[0].x, T.sites[0].y) && rimKm > 0.5 && rimKm <= 4, `(${rimKm.toFixed(1)} km)`);
  check(`${c.name}: beacon path never exceeds the rover's slope limit`, steepest <= CONFIG.maxSlopeDeg + 0.01);
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
