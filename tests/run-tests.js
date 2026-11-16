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
const TERR = {};
for (const c of CRATERS) {
  const T = (TERR[c.id] = Terrain.fromCrater(c));
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

// Science panel rules: each instrument counts once per site, only if packed, and every refusal says why.
{
  const T = TERR.haworth, [rim, wall, trap] = T.sites;
  const s = Sim.create(T, ["neutron", "camera"], { failureTrigger: "none" });
  check("first run at the rim works", Sim.runScience(s, rim, ["neutron", "camera"]).includes("ran") && Sim.evaluate(s).score === 15);
  check("R1 shows 1/2 sites after one Neutron run", Sim.evaluate(s).progress.R1 === "1/2 sites" && !Sim.evaluate(s).met.R1);
  const stored = s.stored;
  check("running the same instruments again is refused, costs nothing, adds nothing",
    Sim.runScience(s, rim, ["neutron", "camera"])[0] === "nothing" && s.stored === stored && Sim.evaluate(s).score === 15 && s.runs.length === 2);
  check("an instrument that wasn't packed can't run", Sim.runScience(s, rim, ["drill"])[0] === "nothing" && s.runs.length === 2);
  check("an empty selection is refused", Sim.runScience(s, rim, [])[0] === "nothing");
  check("a duplicated selection runs once", Sim.runScience(s, wall, ["neutron", "neutron"]).includes("ran") && s.runs.filter((r) => r.site === "wall").length === 1);
  check("R1 is met after the second site", Sim.evaluate(s).met.R1 === true);
  s.stored = 50;
  check("not enough power is refused without draining", Sim.runScience(s, trap, ["neutron"])[0] === "noPower" && s.stored === 50);
  const k = Sim.create(T, ["neutron", "drill", "kit"], { failureTrigger: "firstScience" });
  check("first science run can trigger the battery fault", Sim.runScience(k, rim, ["neutron"]).includes("failure") && k.failurePending);
  Sim.respond(k, "repair");
  check("instruments are offline during a repair", Sim.runScience(k, wall, ["neutron"])[0] === "repairing");
  Sim.tick(k, CONFIG.repair.hours + 0.1, 0, 0, { lit: 1, shadow: false, signal: true, lights: false });
  check("repair finishes and instruments work again", Sim.capacity(k) === CONFIG.mainBatteryWh * CONFIG.repair.mainFraction && Sim.runScience(k, wall, ["neutron"]).includes("ran"));
}

// Every payload that fits, with different ways of using it, failure timings and responses.
{
  const ids = CONFIG.items.map((i) => i.id), INSTR = CONFIG.items.filter((i) => i.kind === "instrument").map((i) => i.id);
  const loadouts = [];
  for (let m = 0; m < 1 << ids.length; m++) {
    const L = ids.filter((_, i) => m & (1 << i));
    if (L.reduce((kg, id) => kg + Sim.item(id).mass, 0) <= CONFIG.massLimit) loadouts.push(L);
  }
  const plans = {
    "requirement plan": null,
    "everything packed at every site": (L) => () => L.filter((id) => INSTR.includes(id)),
    "ask for all items twice (packed or not)": () => () => [...ids, ...ids],
    "cold trap only": (L) => (site) => (site === 2 ? L.filter((id) => INSTR.includes(id)) : []),
    "run nothing": () => () => [],
  };
  let runs = 0, bad = 0, firstBad = "";
  const tiers = { full: 0, partial: 0, minimum: 0, failure: 0 };
  let stuck = 0;
  for (const cid of ["haworth", "cabeus"]) for (const L of loadouts) for (const [pname, mk] of Object.entries(plans))
    for (const failure of ["none", "shadow", "firstScience"]) for (const response of ["ration", "repair"]) {
      runs++;
      const problems = [];
      try {
        const p = Sim.predict(TERR[cid], L, { failure, response, plan: mk ? mk(L) : undefined }), s = p.state, cap = Sim.capacity(s);
        const key = (r) => r.id + "@" + r.site;
        if (!(Number.isFinite(s.stored) && s.stored >= 0 && s.stored <= cap + 1e-6)) problems.push("battery out of range");
        if (new Set(s.runs.map(key)).size !== s.runs.length) problems.push("duplicate run");
        if (s.runs.some((r) => !L.includes(r.id) || !INSTR.includes(r.id))) problems.push("ran an unpacked item");
        if (s.uplinked.length + s.pending.length !== s.runs.length) problems.push("results lost or doubled");
        if (p.score !== s.uplinked.reduce((a, r) => a + r.points, 0)) problems.push("score mismatch");
        if (Object.values(s.used).some((v) => !Number.isFinite(v) || v < 0)) problems.push("bad energy bucket");
        if (p.met.R1 && !L.includes("neutron")) problems.push("R1 without neutron");
        if (p.met.R2 && !L.includes("ir") && !L.includes("drill")) problems.push("R2 without ice instrument");
        if (p.met.R3 && !L.includes("drill")) problems.push("R3 without drill");
        if (p.met.R4 && !p.met.R2) problems.push("R4 without R2");
        if ((p.tier === "full") !== (p.met.R1 && p.met.R2 && p.met.R3 && p.met.R4)) problems.push("tier mismatch");
        if (failure === "none" && s.failed) problems.push("failure fired when disabled");
        if (s.failurePending) problems.push("failure left unanswered");
        tiers[p.tier]++; if (p.stuck) stuck++;
      } catch (e) { problems.push("crash: " + e.message); }
      if (problems.length) { bad++; firstBad = firstBad || `${cid} [${L.join(",") || "empty"}] ${pname} / ${failure} / ${response}: ${problems.join("; ")}`; }
    }
  console.log(`\nCombination sweep: ${loadouts.length} payloads × 2 craters × 5 plans × 3 failure timings × 2 responses = ${runs} missions`);
  console.log(`  outcomes: full ${tiers.full}, partial ${tiers.partial}, minimum ${tiers.minimum}, failure ${tiers.failure}; stranded in ${stuck}`);
  check("every combination runs cleanly and keeps the rules", bad === 0, bad ? `${bad} bad, first: ${firstBad}` : "");
}

// The rim site's whole ring is sunlit, and the "shadow" battery fault waits for the crater interior.
for (const c of CRATERS) {
  const T = TERR[c.id], r = T.sites[0];
  let dark = 0;
  for (let dx = -600; dx <= 600; dx += 100) for (let dy = -600; dy <= 600; dy += 100) if (Math.hypot(dx, dy) <= 600 && Terrain.litAt(T, r.x + dx, r.y + dy) === 0) dark++;
  check(`${c.name}: no permanent shadow inside the rim site ring`, dark === 0, dark ? `(${dark} dark points)` : "");
}
{
  const s = Sim.create(TERR.haworth, ["neutron"], { failureTrigger: "shadow" });
  Sim.tick(s, 0.1, 0, 0, { lit: 0, shadow: true, deep: false, signal: true, lights: true });
  check("a shadowed patch near the rim does not trigger the battery fault", !s.failed && s.everShadow);
  Sim.tick(s, 0.1, 0, 0, { lit: 0, shadow: true, deep: true, signal: false, lights: true });
  check("the fault fires once the rover is deep in the crater's shadow", s.failed && s.failurePending);
}

// Difficulty and story missions.
{
  const d = Sim.applyDifficulty("normal");
  check("Normal difficulty keeps the designed balance", CONFIG.failure.mainFraction === 0.4 && (CONFIG.solarMul || 1) === 1 && d.label === "Normal");
  check("unknown difficulty falls back to Normal", Sim.applyDifficulty("nightmare") && CONFIG.difficulty === "normal");
  const T = TERR.haworth, worse = {};
  for (const id of ["easy", "normal", "hard"]) { Sim.applyDifficulty(id); worse[id] = Sim.predict(T, ["neutron", "drill", "backup"], { failure: "shadow" }).endStored; }
  check("battery left after a fault: Easy > Normal > Hard", worse.easy > worse.normal && worse.normal > worse.hard, JSON.stringify(worse));
  Sim.applyDifficulty("normal");
  const good = { chassisKg: 170, batteryWh: 8000, solarW: 300, efficiency: 60, speedKmh: 4 };
  for (const m of CONFIG.missions) {
    const MT = TERR[m.crater];
    check(`${m.name}: crater exists and the cold trap is reachable`, !!MT && MT.trapReachable);
    Sim.applyEngineering(CONFIG.presets.standard);
    const safe = Sim.stars(m, Sim.predict(MT, ["neutron", "drill", "backup"], { failure: "shadow" }).state).count;
    Sim.applyEngineering(good);
    const smart = Sim.stars(m, Sim.predict(MT, ["neutron", "ir", "drill"], { failure: "shadow" }).state).count;
    const smartOk = Sim.stars(m, Sim.predict(MT, ["neutron", "ir", "drill"], { failure: "none" }).state).count;
    check(`${m.name}: safe payload still earns a star after a fault (${safe}★)`, safe >= 1);
    check(`${m.name}: a well-engineered max-science rover earns 3★ without a fault and ≥2★ with one (${smartOk}★/${smart}★)`, smartOk === 3 && smart >= 2);
  }
  Sim.applyEngineering(CONFIG.presets.standard);
  const s0 = Sim.create(TERR.faustini, ["neutron"], { failureTrigger: "none" });
  check("no science means no stars", Sim.stars(CONFIG.missions[0], s0).count === 0);
}

// Rover engineering: defaults reproduce the standard rover; limits can't be broken.
const std = Sim.applyEngineering({});
check("standard rover is 250 kg", std.baseMassKg === 250, `got ${std.baseMassKg}`);
const silly = Sim.applyEngineering({ batteryWh: 1e9, solarW: -5, efficiency: 500, speedKmh: "fast", chassisKg: 1 });
check("absurd values are clamped to the limits", CONFIG.mainBatteryWh === 8000 && CONFIG.solarPanelW === 100 && CONFIG.drivetrainEfficiency === 0.75 && CONFIG.speedKmh === 4 && silly.chassisKg === 150);
check("a bigger battery adds mass (200 Wh/kg)", Math.abs(silly.batteryKg - 40) < 0.01);
{
  const T = Terrain.fromCrater(CRATERS[3]);
  Sim.applyEngineering({ batteryWh: 2000 });
  const small = Sim.predict(T, SAFE, { failure: "shadow" });
  Sim.applyEngineering({ batteryWh: 8000 });
  const big = Sim.predict(T, SAFE, { failure: "shadow" });
  check("a heavier, bigger-battery rover spends more on climbing", big.used.climb > small.used.climb, `${Math.round(big.used.climb)} vs ${Math.round(small.used.climb)} Wh`);
  Sim.applyEngineering(CONFIG.presets.standard);
}

console.log(fails ? `\n${fails} failure(s)` : "\nAll tests passed");
process.exit(fails ? 1 : 0);
