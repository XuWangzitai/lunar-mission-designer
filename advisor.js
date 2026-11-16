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

  // ---------- questions the player can ask ----------
  // Each question is offered only when it fits the moment; answers use the player's own rover.
  const n = (v) => Math.round(v).toLocaleString("en-US");
  const ROLE = {
    neutron: "maps hydrogen, the clue that ice may be near. R1 needs it at two sites, the rim and the wall.",
    ir: "spots ice on the surface. It counts for R2 and earns double in the cold trap.",
    drill: "digs under the dust to confirm buried ice. The only way to meet R3, and it counts for R2 too.",
    camera: "earns a few points at every site. No requirement needs it.",
    backup: "a second battery. If the main pack fails, it's the reserve for the climb out.",
    kit: "if the main pack fails, three hours of swapping cells brings it back to 80 %.",
  };

  function packingQuestions(loadout, mission) {
    const q = ["packed"];
    if (!loadout.includes("backup")) q.push("backup");
    q.push("instruments");
    if (mission) q.push("stars");
    return q;
  }

  // Returns HTML for the answer box. "packed" is handled by the stepped hints (packingIssues).
  function packingAnswer(id, terrain, loadout, mission) {
    if (id === "backup") {
      const calm = S.predict(terrain, loadout), after = C.mainBatteryWh * C.failure.mainFraction;
      return `If a cell shorts, my main pack drops to ${Math.round(C.failure.mainFraction * 100)} % of ${n(C.mainBatteryWh)} Wh, which is ${n(after)} Wh. Climbing back out of this crater costs about ${n(calm.used.climb)} Wh on its own (m·g·h ÷ η). A backup adds ${n(C.backupBatteryWh)} Wh for ${S.item("backup").mass} kg. Whether that's worth an instrument's mass is your call.`;
    }
    if (id === "instruments") {
      return C.items.map((it) => `<b>${it.name}</b> · ${it.mass} kg${it.energy ? ` · ${it.energy} Wh per run` : ""}: ${ROLE[it.id]}`).join("<br>");
    }
    if (id === "stars" && mission) {
      const worst = FAULTS.map(([f, when]) => ({ when, st: S.stars(mission, S.predict(terrain, loadout, { failure: f }).state) }))
        .reduce((a, b) => (b.st.count < a.st.count ? b : a));
      const atRisk = !worst.st.full ? "the first one: all four requirements" : !worst.st.target ? `the second one: ${mission.target} science` : !worst.st.margin ? "the third one: 25 % battery left" : null;
      return `★ all four requirements met. ★★ also at least ${mission.target} science returned. ★★★ also at least 25 % of the battery left at the end. `
        + (atRisk ? `With this design, if my battery fails ${worst.when}, the star at risk is ${atRisk}.` : "With this design, all three hold up even if my battery fails.");
    }
    return "";
  }

  function driveQuestions(sim) {
    const q = ["next"];
    if (!sim.signal) q.push("back");
    if (sim.inShadow) q.push("drain");
    if (!sim.signal && sim.pending.length) q.push("noData");
    if (sim.failed) q.push("fault");
    return q;
  }

  function driveAnswer(id, sim, terrain, pos) {
    if (id === "next") { const h = driveHint(sim); return `<b>${h.next}</b> ${h.why}`; }
    if (id === "back") {
      const back = returnCost(sim, terrain, pos.x, pos.y), cap = S.capacity(sim);
      if (back.inView) return "Earth is in view right here, so we can already send data home.";
      const pct = Math.max(0, Math.round((100 * (sim.stored - back.wh)) / cap));
      const mj = (sim.massKg * C.gMoon * back.climbM) / C.drivetrainEfficiency / 1e6;
      return `Getting back into view of Earth from here costs about <b>${n(back.wh)} Wh</b>. Climbing ${n(back.climbM)} m is ${n(back.climbWh)} Wh of that: m·g·h ÷ η = ${Math.round(sim.massKg)} kg × ${C.gMoon} m/s² × ${n(back.climbM)} m ÷ ${C.drivetrainEfficiency} = ${mj.toFixed(2)} MJ, and 1 Wh is 3,600 J. `
        + `We have ${n(sim.stored)} Wh, so about <b>${pct} %</b> would be left when we get there${pct < 25 ? ". That's tight." : "."}`;
    }
    if (id === "drain") {
      const K = sim.facts.floorTempK, heat = C.heaterW(K), out = Math.max(1, (sim.flow && sim.flow.outW) || heat + C.systemsW);
      return `We're in permanent shadow, so the solar panels give 0 W. At ${K} K (${K - 273} °C) the heaters need ${heat} W to keep my electronics alive, the computers ${C.systemsW} W, and the headlights ${C.headlightsW} W when they're on. `
        + `Right now about ${n(out)} W is going out, so ${n(sim.stored)} Wh lasts roughly ${(sim.stored / out).toFixed(1)} hours like this, less while driving.`;
    }
    if (id === "noData") {
      return `${sim.pending.length} result${sim.pending.length > 1 ? "s are" : " is"} stored on board. Radio needs a straight line to Earth, and from down here the crater wall is in the way. As soon as EARTH LINK shows in the top bar, everything uploads by itself.`;
    }
    if (id === "fault") {
      const after = C.mainBatteryWh * C.failure.mainFraction;
      const now = sim.response === "repair" ? (S.repairing(sim) ? ` The repair is under way: ${C.repair.hours} hours, then the main pack is back to ${Math.round(C.repair.mainFraction * 100)} %.` : " The repair is done.")
        : sim.backupCap ? ` The backup still adds ${n(sim.backupCap)} Wh, so we have ${n(S.capacity(sim))} Wh of capacity in total.` : " No backup, so every watt-hour counts now.";
      return `A cell in my main pack shorted, so it went from ${n(C.mainBatteryWh)} Wh to ${n(after)} Wh of capacity.${now}`;
    }
    return "";
  }

  return { packingIssues, returnCost, driveHint, verdict, packingQuestions, packingAnswer, driveQuestions, driveAnswer };
})();

if (typeof module !== "undefined") module.exports = Advisor;
