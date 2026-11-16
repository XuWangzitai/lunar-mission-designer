// THOX the advisor (no drawing). Looks at a rover design or a mission in progress and
// returns hints in steps: a nudge first, the specifics only if the player asks again.
// It never hands over a full plan; the forecast in sim.js does all the physics.

const Advisor = (() => {
  const C = typeof CONFIG !== "undefined" ? CONFIG : require("./config.js");
  const S = typeof Sim !== "undefined" ? Sim : require("./sim.js");
  const T_ = typeof Terrain !== "undefined" ? Terrain : require("./terrain.js");
  const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ""));
  const FAULTS = [["shadow", "deep in the shadow"], ["firstScience", "during the first science run"]];

  // Problems with a design, most important first. Each is a list of hint levels.
  function packingIssues(terrain, loadout, mission) {
    const H = C.thox.hints, has = (id) => loadout.includes(id), out = [];
    if (!has("neutron")) out.push(H.noNeutron);
    if (!has("ir") && !has("drill")) out.push(H.noIce);
    else if (!has("drill")) out.push(H.noDrill);

    const calm = S.predict(terrain, loadout);
    const cases = FAULTS.map(([f, when]) => {
      const p = S.predict(terrain, loadout, { failure: f });
      return { when, p, pct: Math.round((100 * p.state.stored) / S.capacity(p.state)) };
    });
    const stranded = cases.find((c) => c.p.stuck) || (calm.stuck ? { when: "at all", p: calm } : null);
    if (stranded) out.push(H.stranded.map((t) => fill(t, { when: stranded.when })));
    else if (mission && !out.length) {
      const worst = cases.reduce((a, b) => (b.pct < a.pct ? b : a));
      if (worst.pct < 25) out.push(H.margin.map((t) => fill(t, { when: worst.when, pct: worst.pct })));
    }
    if (mission && calm.score < mission.target) out.push(H.target.map((t) => fill(t, { target: mission.target, score: calm.score })));
    // A repair kit next to a backup battery is two answers to the same problem.
    if (has("kit") && has("backup")) {
      out.push(H.deadWeight.map((t) => fill(t, { item: "Repair Kit", kg: S.item("kit").mass, h: Math.round(calm.state.climbedM) })));
    }
    if (!out.length) out.push(H.good);
    return out;
  }

  // Energy to drive back along the beacon route until Earth is in view again,
  // simulated with the same physics as the mission (rolling, m·g·h ÷ η, heaters, solar).
  function returnCost(sim, terrain, x, y) {
    if (T_.signalAt(terrain, x, y)) return { wh: 0, climbM: 0, climbWh: 0, inView: true };
    const path = terrain.path.length ? terrain.path : [terrain.start];
    let i = 0, best = Infinity;
    path.forEach((p, k) => { const d = Math.hypot(p.x - x, p.y - y); if (d < best) { best = d; i = k; } });
    const pts = [{ x, y }, ...path.slice(0, i + 1).reverse()];
    const s = S.create(terrain, sim.loadout, { failureTrigger: "none" });
    s.massKg = sim.massKg; s.mainCap = 1e9; s.backupCap = 0; s.stored = 1e9;
    const stepM = 100;
    outer: for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(L / stepM));
      for (let q = 0; q < steps; q++) {
        const x0 = a.x + ((b.x - a.x) * q) / steps, y0 = a.y + ((b.y - a.y) * q) / steps;
        const x1 = a.x + ((b.x - a.x) * (q + 1)) / steps, y1 = a.y + ((b.y - a.y) * (q + 1)) / steps;
        const d = L / steps, dh = T_.heightAt(terrain, x1, y1) - T_.heightAt(terrain, x0, y0);
        const lit = T_.litAt(terrain, x1, y1), shadow = lit === 0;
        S.tick(s, d / 1000 / C.speedKmh, d, dh, { lit, shadow, deep: false, signal: true, lights: shadow, slopeDeg: 0 });
        if (T_.signalAt(terrain, x1, y1)) break outer;
      }
    }
    return { wh: Math.round(1e9 - s.stored), climbM: Math.round(s.climbedM), climbWh: Math.round(s.used.climb), inView: false };
  }

  // What to do next while driving, and why, in plain words.
  function driveHint(sim) {
    const r = S.evaluate(sim), has = (id) => sim.loadout.includes(id);
    if (!r.met.R1 && has("neutron")) return { next: "Survey hydrogen at the rim and the wall (R1).", why: "Hydrogen is the clue that ice might be nearby. Reading it in two places shows where it gets richer as we go down." };
    if ((!r.met.R2 || (!r.met.R3 && has("drill"))) && (has("ir") || has("drill"))) return { next: "Get to the cold trap (the blue pillar) and run the ice instruments there.", why: "That floor hasn't seen sunlight in billions of years. It's cold enough that water ice can't escape." };
    if (sim.pending.length) return { next: "Climb until EARTH LINK shows in the top bar.", why: "Radio needs a straight line to Earth. From inside the crater the wall is in the way, so the data waits on board." };
    if (r.tier === "full") return { next: "Everything's done. End the mission whenever you like.", why: "Every requirement is met and the data is home. The more battery left, the better the report." };
    return { next: "Do what the Next bar says.", why: "Some requirements can't be met with this payload, but every bit of science still counts." };
  }

  // The report line: by stars on a story mission, by result in Sandbox. Pick is 0..1.
  function verdict(sim, mission, pick = Math.random()) {
    const r = S.evaluate(sim), V = C.thox.verdict, W = C.thox.why;
    const choose = (list) => list[Math.floor(pick * list.length) % list.length];
    const st = mission ? S.stars(mission, sim) : null;
    const why = sim.stuck ? (sim.failed && !sim.loadout.includes("backup") ? W.stuckNoBackup : W.stuck)
      : !r.met.R2 ? W.R2 : !r.met.R3 ? W.R3 : !r.met.R1 ? W.R1 : !r.met.R4 ? W.R4
        : st && !st.target ? W.target : st && !st.margin ? W.margin : null;
    if (mission) return { stars: st.count, line: choose(V[st.count]), why: st.count < 3 ? why : null };
    return { stars: null, line: why || "Clean mission. Every requirement met and the data is home.", why: null };
  }

  return { packingIssues, returnCost, driveHint, verdict };
})();

if (typeof module !== "undefined") module.exports = Advisor;
