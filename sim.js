// Mission rules and energy accounting (no drawing). The 3D world reports what the
// rover did each frame; Sim turns it into watt-hours, science and requirements.

const Sim = (() => {
  const C = typeof CONFIG !== "undefined" ? CONFIG : require("./config.js");
  const T_ = typeof Terrain !== "undefined" ? Terrain : require("./terrain.js");
  const item = (id) => C.items.find((i) => i.id === id);

  // Per-crater facts beyond the LOLA measurements. Sources are shown to the player.
  const EXTRA = {
    shackleton: { floorTempK: 90, tempSource: "LRO Diviner, reported ~90 K", iceFactor: 1.0, iceNote: "Unconfirmed; floor slightly brighter in LOLA laser data (Zuber 2012)" },
    degerlache: { floorTempK: 60, tempSource: "game estimate", iceFactor: 1.0, iceNote: "Unknown; rim is an Artemis III candidate region" },
    faustini: { floorTempK: 60, tempSource: "game estimate", iceFactor: 1.0, iceNote: "Unknown; ~665 km² permanently shadowed" },
    haworth: { floorTempK: 60, tempSource: "game estimate", iceFactor: 1.0, iceNote: "Unknown; ~1,019 km² permanently shadowed" },
    shoemaker: { floorTempK: 60, tempSource: "game estimate", iceFactor: 1.0, iceNote: "Unknown; ~1,080 km² permanently shadowed" },
    cabeus: { floorTempK: 38, tempSource: "LRO Diviner at the LCROSS site, ~38 K", iceFactor: 1.5, iceNote: "Confirmed: LCROSS found 5.6 ± 2.9 % water ice (2009)" },
  };

  function facts(meta) {
    return meta.custom ? { floorTempK: meta.floorTempK, tempSource: "your input", iceFactor: meta.iceFactor, iceNote: "your input" } : EXTRA[meta.id];
  }

  // Apply the player's rover design to the live settings, clamped to the allowed range.
  // Battery and solar mass come from real-world specific energy / specific power.
  function applyEngineering(values) {
    const E = C.engineering, v = {};
    for (const k of Object.keys(E)) {
      const raw = Number(values[k] ?? E[k].value);
      v[k] = Math.min(E[k].max, Math.max(E[k].min, Number.isFinite(raw) ? raw : E[k].value));
      E[k].value = v[k];
    }
    const batteryKg = v.batteryWh / C.specificEnergyWhPerKg, solarKg = v.solarW / C.solarWPerKg;
    C.mainBatteryWh = v.batteryWh;
    C.solarPanelW = v.solarW;
    C.drivetrainEfficiency = v.efficiency / 100;
    C.speedKmh = v.speedKmh;
    C.roverBaseMassKg = Math.round(v.chassisKg + batteryKg + solarKg);
    return { ...v, batteryKg, solarKg, baseMassKg: C.roverBaseMassKg };
  }

  // Difficulty: how hard the battery fault hits, panel strength, and the random-event rate.
  function applyDifficulty(id) {
    const d = C.difficulties[id] || C.difficulties.normal;
    C.difficulty = C.difficulties[id] ? id : "normal";
    C.failure.mainFraction = d.failureMainFraction;
    C.solarMul = d.solarMul;
    C.eventRate = d.eventRate;
    return d;
  }

  // Stars for a story mission: 1 = all four requirements, 2 = also the science target,
  // 3 = also at least 25 % of the battery left at the end.
  function stars(mission, s) {
    const r = evaluate(s);
    const full = r.tier === "full" && !s.stuck;
    const target = full && r.score >= mission.target;
    const margin = target && s.stored >= 0.25 * capacity(s);
    return { count: full ? (target ? (margin ? 3 : 2) : 1) : 0, full, target, margin, score: r.score, batteryPct: Math.round((100 * s.stored) / capacity(s)) };
  }

  function massKg(loadout) {
    return C.roverBaseMassKg + loadout.reduce((m, id) => m + item(id).mass, 0);
  }

  function create(terrain, loadout, opts = {}) {
    const rng = opts.rng || Math.random;
    const f = facts(terrain.meta);
    const s = {
      terrain, loadout: [...loadout], facts: f, massKg: massKg(loadout),
      mainCap: C.mainBatteryWh, backupCap: loadout.includes("backup") ? C.backupBatteryWh : 0,
      stored: 0, timeH: 0, distanceKm: 0, climbedM: 0, maxSlopeSeen: 0,
      used: { drive: 0, climb: 0, systems: 0, heaters: 0, lights: 0, science: 0 }, solarWh: 0,
      failureTrigger: opts.failureTrigger || (rng() < 0.5 ? "firstScience" : "shadow"),
      failed: false, failurePending: false, response: null, repairUntilH: null,
      runs: [], pending: [], uplinked: [], inShadow: false, everShadow: false, signal: true,
      stuck: false, done: false, endReason: null,
    };
    s.stored = capacity(s);
    return s;
  }

  const capacity = (s) => s.mainCap + s.backupCap;

  function drain(s, wh, bucket) {
    s.used[bucket] += wh;
    s.stored = Math.max(0, s.stored - wh);
    if (s.stored <= 0 && !s.done) { s.stuck = true; end(s, "stuck"); }
  }

  function fail(s) {
    if (s.failed) return;
    s.failed = true;
    s.failurePending = true;
    s.mainCap = Math.round(C.mainBatteryWh * C.failure.mainFraction);
    s.stored = Math.min(s.stored, capacity(s));
  }

  function respond(s, id) {
    s.response = id;
    s.failurePending = false;
    if (id === "repair") s.repairUntilH = s.timeH + C.repair.hours;
  }

  const repairing = (s) => s.repairUntilH != null && s.timeH < s.repairUntilH;

  // One frame of movement. dist and climb in meters, dtH in mission hours.
  // env: { lit (0..1), shadow (bool), signal (bool), lights (bool), slopeDeg }
  function tick(s, dtH, dist, climb, env) {
    if (s.done || s.failurePending) return [];
    const events = [];
    const usedBefore = Object.values(s.used).reduce((a, b) => a + b, 0);
    s.timeH += dtH;
    s.distanceKm += dist / 1000;
    s.maxSlopeSeen = Math.max(s.maxSlopeSeen, Math.abs(env.slopeDeg || 0));

    // E = (rolling + lifting) work / efficiency, converted J → Wh.
    const m = s.massKg, g = C.gMoon, eta = C.drivetrainEfficiency;
    drain(s, (m * g * C.rollingResistance * dist) / eta / 3600, "drive");
    if (climb > 0) { s.climbedM += climb; drain(s, (m * g * climb) / eta / 3600, "climb"); }

    drain(s, C.systemsW * dtH, "systems");
    if (env.shadow) drain(s, C.heaterW(s.facts.floorTempK) * dtH, "heaters");
    if (env.lights) drain(s, C.headlightsW * dtH, "lights");

    const solar = C.solarPanelW * (C.solarMul || 1) * env.lit * dtH;
    const room = capacity(s) - s.stored;
    s.solarWh += Math.min(room, solar);
    s.wastedWh = (s.wastedWh || 0) + Math.max(0, solar - room);
    s.stored = Math.min(capacity(s), s.stored + solar);

    // Live power flow for the HUD (watts = watt-hours per hour).
    if (dtH > 0) {
      const outW = (Object.values(s.used).reduce((a, b) => a + b, 0) - usedBefore) / dtH;
      const inW = C.solarPanelW * (C.solarMul || 1) * env.lit;
      const smooth = (old, v) => (old == null ? v : old + (v - old) * 0.15);
      s.flow = { inW, outW: smooth(s.flow && s.flow.outW, outW), full: s.stored >= capacity(s) - 0.5 };
    }

    if (env.shadow && !s.everShadow) { s.everShadow = true; events.push("shadow"); }
    // The "shadow" fault waits until the rover is well inside the crater (env.deep), not on a
    // small shadowed patch near the rim.
    if (env.shadow && env.deep !== false && s.failureTrigger === "shadow" && !s.failed) { fail(s); events.push("failure"); }
    if (env.shadow !== s.inShadow) s.inShadow = env.shadow;
    if (env.signal !== s.signal) { s.signal = env.signal; events.push(env.signal ? "signalBack" : "signalLost"); }
    if (s.signal && s.pending.length) { s.uplinked.push(...s.pending); s.pending = []; events.push("uplink"); }
    if (repairing(s) === false && s.repairUntilH != null && s.response === "repair") {
      s.mainCap = Math.round(C.mainBatteryWh * C.repair.mainFraction); s.repairUntilH = null; events.push("repaired");
    }
    return events;
  }

  // Run instruments at a site. Returns events; every early exit says why.
  // Each instrument counts once per site, and only if it was packed.
  function runScience(s, site, requested) {
    const events = [];
    if (s.done) return ["over"];
    if (repairing(s)) return ["repairing"];
    const ids = [...new Set(requested)].filter((id) => s.loadout.includes(id) && item(id).kind === "instrument"
      && !s.runs.some((r) => r.id === id && r.site === site.id));
    if (!ids.length) return ["nothing"];
    const cost = ids.reduce((e, id) => e + item(id).energy, 0);
    if (cost > s.stored) return ["noPower"];
    ids.forEach((id) => {
      const it = item(id);
      const mult = site.kind === "floor" && (id === "ir" || id === "drill") ? s.facts.iceFactor : 1;
      const rec = { id, site: site.id, kind: site.kind, points: Math.round(it.points[site.kind] * mult), timeH: s.timeH };
      s.runs.push(rec);
      (s.signal || !C.scienceNeedsUplink ? s.uplinked : s.pending).push(rec);
      if (site.kind === "floor" && id === "drill") events.push("ice");
      else if (site.kind === "floor" && id === "ir") events.push("iceIR");
    });
    drain(s, cost, "science");
    events.push("ran");
    if (s.failureTrigger === "firstScience" && !s.failed) { fail(s); events.push("failure"); }
    return events;
  }

  function end(s, reason) { s.done = true; s.endReason = s.endReason || reason; }

  function score(list) { return list.reduce((p, r) => p + r.points, 0); }

  function evaluate(s) {
    const ran = (id, kind) => s.runs.some((r) => r.id === id && (!kind || r.kind === kind));
    const home = (id, kind) => s.uplinked.some((r) => r.id === id && r.kind === kind);
    const neutronSites = new Set(s.runs.filter((r) => r.id === "neutron").map((r) => r.site));
    const progress = { R1: `${Math.min(2, neutronSites.size)}/2 sites` };
    const met = {
      R1: neutronSites.size >= 2,
      R2: ran("ir", "floor") || ran("drill", "floor"),
      R3: ran("drill", "floor"),
      R4: home("ir", "floor") || home("drill", "floor"),
    };
    const tier = met.R2 && met.R3 && met.R4 && met.R1 ? "full" : met.R2 ? "partial" : met.R1 ? "minimum" : "failure";
    const has = (id) => s.loadout.includes(id);
    const why = {
      R1: met.R1 ? `Neutron Spectrometer ran at: ${[...neutronSites].join(", ")}.`
        : !has("neutron") ? "The Neutron Spectrometer wasn't packed." : `It ran at ${neutronSites.size} site(s); 2 were needed.`,
      R2: met.R2 ? "Ice instruments ran at the cold trap."
        : !has("ir") && !has("drill") ? "Neither the IR Spectrometer nor the Drill was packed." : `${C.roverName} never ran an ice instrument at the cold trap.`,
      R3: met.R3 ? "The Drill reached buried ice in the cold trap." : !has("drill") ? "The Drill wasn't packed." : "The Drill never ran at the cold trap.",
      R4: met.R4 ? "The cold-trap data reached Earth." : !met.R2 ? "There was no cold-trap data to send."
        : s.stuck ? `${C.roverName} ran out of power before climbing back into view of Earth. Climbing used ${Math.round(s.used.climb)} Wh.` : "The mission ended before the data was sent.",
    };
    return { met, tier, why, progress, score: score(s.uplinked), lostPoints: score(s.pending), used: s.used };
  }

  // Forecast along the beacon route and back, without driving.
  function predict(terrain, loadout, opts = {}) {
    const s = create(terrain, loadout, { failureTrigger: opts.failure || "none" });
    // opts.response and opts.plan let the tests try other choices than the default ones.
    let env = { lit: 1, shadow: false, signal: true, lights: false, slopeDeg: 0 };
    const respondIfNeeded = () => {
      if (!s.failurePending) return;
      const repair = opts.response === "repair" && loadout.includes("kit");
      respond(s, repair ? "repair" : "ration");
      if (repair) tick(s, C.repair.hours + 0.01, 0, 0, env); // parked while swapping cells
    };
    // Waypoints: rim site and back, then down the drivable path and back up it.
    const [rim, wall, trap] = terrain.sites;
    const path = terrain.path.length ? terrain.path : [terrain.start];
    const mid = Math.floor(path.length / 2);
    const pts = [terrain.start, rim, terrain.start, ...path.slice(1), ...path.slice(0, -1).reverse()];
    const scienceAt = { 1: 0, [2 + mid]: 1 };
    if (terrain.trapReachable) scienceAt[1 + path.length] = 2;
    const stepM = 100;
    let shadowH = 0;
    const kmh = C.speedKmh;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], L = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(L / stepM));
      for (let q = 0; q < steps; q++) {
        const x0 = a.x + ((b.x - a.x) * q) / steps, y0 = a.y + ((b.y - a.y) * q) / steps;
        const x1 = a.x + ((b.x - a.x) * (q + 1)) / steps, y1 = a.y + ((b.y - a.y) * (q + 1)) / steps;
        const d = L / steps, dh = T_.heightAt(terrain, x1, y1) - T_.heightAt(terrain, x0, y0);
        const lit = T_.litAt(terrain, x1, y1), shadow = lit === 0;
        const dtH = d / 1000 / kmh;
        if (shadow) shadowH += dtH;
        const deep = T_.heightAt(terrain, x1, y1) < -200 * terrain.meta.depthKm; // more than 20 % of the way down
        env = { lit, shadow, deep, signal: T_.signalAt(terrain, x1, y1), lights: shadow, slopeDeg: 0 };
        tick(s, dtH, d, dh, env);
        respondIfNeeded();
      }
      // The plan that meets every requirement: Neutron on the rim and wall, ice instruments in the trap.
      const siteIdx = scienceAt[k + 1];
      const plan = siteIdx == null ? null : opts.plan ? opts.plan(siteIdx) : [["neutron", "camera"], ["neutron"], ["ir", "drill"]][siteIdx];
      if (plan && !s.done) {
        const site = [rim, wall, trap][siteIdx];
        const ids = opts.plan ? plan : plan.filter((id) => loadout.includes(id));
        if (ids.length) runScience(s, site, ids);
        respondIfNeeded();
      }
    }
    const needed = Object.values(s.used).reduce((a, b) => a + b, 0);
    return { state: s, needed: Math.round(needed), solar: Math.round(s.solarWh), capacity: capacity(create(terrain, loadout)), used: s.used, shadowH, endStored: Math.round(s.stored), stuck: s.stuck, reachable: terrain.trapReachable, routeMaxSlope: terrain.meta.gentlestRoute.maxSlopeDeg, ...evaluate(s) };
  }

  return { create, capacity, tick, runScience, respond, repairing, end, evaluate, predict, facts, massKg, item, applyEngineering, applyDifficulty, stars };
})();

if (typeof module !== "undefined") module.exports = Sim;
