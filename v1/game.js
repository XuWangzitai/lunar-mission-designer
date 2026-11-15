// Game rules only: no drawing, no DOM. The UI calls these functions and
// renders whatever state they produce. Runs in the browser and in Node.

const Game = (() => {
  const C = typeof CONFIG !== "undefined" ? CONFIG : require("./config.js");

  const item = (id) => C.items.find((i) => i.id === id);
  const shiftDef = (n) => C.shifts[n - 1];

  function loadoutMass(ids) {
    return ids.reduce((m, id) => m + item(id).mass, 0);
  }

  function create(loadout, opts = {}) {
    const rng = opts.rng || Math.random;
    const failureShift = opts.failureShift ||
      C.failure.shifts[Math.floor(rng() * C.failure.shifts.length)];
    const has = (id) => loadout.includes(id);
    const s = {
      loadout: [...loadout],
      shift: 1,
      mainCap: C.mainBattery,
      backupCap: has("backup") ? C.backupBattery : 0,
      stored: 0,
      failureShift,
      failed: false,
      failurePending: false,
      response: null,
      repairShift: null,
      lostShifts: [],
      heatersOffShift: null,
      runs: {},
      log: [],
      score: 0,
      wasted: 0,
      crater: null, // snapshot of the crater shift, used by the debrief
      done: false,
    };
    loadout.forEach((id) => { if (item(id).kind === "instrument") s.runs[id] = []; });
    s.stored = capacity(s);
    return s;
  }

  function capacity(s) {
    return s.mainCap + s.backupCap;
  }

  // Call when a shift begins. Returns true if the failure fires now.
  function startShift(s) {
    if (!s.failed && s.shift === s.failureShift) {
      s.failed = true;
      s.failurePending = true;
      s.mainCap = C.failure.newMainCapacity;
      const before = s.stored;
      s.stored = Math.min(s.stored, capacity(s));
      s.lostToFailure = before - s.stored;
      return true;
    }
    return false;
  }

  function responses(s) {
    const r = [{ id: "ration", label: s.backupCap ? "Route power through the backup battery" : "Ration power and carry on" }];
    if (s.loadout.includes("kit")) r.push({ id: "repair", label: "Spend this shift repairing (main pack → " + C.repairMainCapacity + " Wh)" });
    return r;
  }

  function respond(s, id) {
    s.response = id;
    s.failurePending = false;
    if (id === "repair") s.repairShift = s.shift;
  }

  function isLost(s, n = s.shift) { return s.lostShifts.includes(n); }
  function isRepairing(s, n = s.shift) { return s.repairShift === n; }
  function canWork(s) { return !isLost(s) && !isRepairing(s); }

  // Energy picture for the current shift, given a heaters-off choice.
  function budget(s, heatersOff = false) {
    const d = shiftDef(s.shift);
    const housekeeping = d.housekeeping - (heatersOff && d.place === "crater" ? C.heatersOffSaving : 0);
    const available = s.stored + d.solar;
    return { solar: d.solar, housekeeping, available, forInstruments: available - housekeeping };
  }

  function cost(ids) { return ids.reduce((e, id) => e + item(id).energy, 0); }
  function pointsFor(id, place) { return item(id).points[place]; }

  function canAfford(s, ids, heatersOff = false) {
    return cost(ids) <= budget(s, heatersOff).forInstruments;
  }

  function endShift(s, ids = [], heatersOff = false) {
    const d = shiftDef(s.shift);
    if (!canWork(s)) ids = [];
    if (d.place !== "crater") heatersOff = false;
    if (!canAfford(s, ids, heatersOff)) throw new Error("Not enough energy for that plan");

    const b = budget(s, heatersOff);
    const used = b.housekeeping + cost(ids);
    const cap = capacity(s);
    const left = b.available - used;
    const wasted = Math.max(0, left - cap);
    const pts = ids.reduce((p, id) => p + pointsFor(id, d.place), 0);

    if (d.place === "crater") s.crater = { available: b.available, housekeeping: b.housekeeping, ran: [...ids], cap };
    s.wasted += wasted;
    s.stored = Math.min(cap, left);
    s.score += pts;
    ids.forEach((id) => s.runs[id].push(s.shift));

    let note = null;
    if (isLost(s)) note = "lost";
    else if (isRepairing(s)) { note = "repair"; s.mainCap = C.repairMainCapacity; }
    if (heatersOff) { s.heatersOffShift = s.shift; if (s.shift < C.shifts.length) s.lostShifts.push(s.shift + 1); }

    s.log.push({ shift: s.shift, place: d.place, ran: [...ids], points: pts, stored: s.stored, cap: capacity(s), wasted, used, note, heatersOff });
    s.shift += 1;
    if (s.shift > C.shifts.length) s.done = true;
    return s.log[s.log.length - 1];
  }

  function evaluate(s) {
    const ran = (id) => (s.runs[id] || []);
    const craterRan = (id) => ran(id).includes(3);
    const packed = (id) => s.loadout.includes(id);
    const met = {
      R1: ran("neutron").length >= 2,
      R2: craterRan("ir") || craterRan("drill"),
      R3: craterRan("drill"),
    };
    const tier = met.R1 && met.R2 && met.R3 ? "full" : met.R2 ? "partial" : met.R1 ? "minimum" : "failure";

    // Why each requirement came out the way it did, traced to a decision.
    const cz = s.crater;
    const craterWhy = (id) => {
      const it = item(id);
      if (!cz) return "The crater shift never ran.";
      const room = cz.available - cz.housekeeping;
      let w = `On the crater floor you had ${cz.available} Wh: ${cz.housekeeping} went to heaters and systems, leaving ${room} Wh. The ${it.short} needs ${it.energy} Wh`;
      if (room >= it.energy) return w + ". There was enough, but the plan didn't include it (or other instruments used it first).";
      w += ".";
      if (s.failed && s.failureShift < 3) {
        w += ` The battery failure before the crater cut storage to ${cz.cap} Wh`;
        w += packed("backup") ? "." : packed("kit") && s.response !== "repair" ? ", and the repair kit wasn't used." : ", and no backup battery was packed.";
      } else {
        w += " Storage was the limit; sunny shifts couldn't bank more than the battery holds.";
      }
      return w;
    };

    const why = {};
    if (met.R1) why.R1 = `Neutron Spectrometer ran on shifts ${ran("neutron").join(", ")}.`;
    else if (!packed("neutron")) why.R1 = "The Neutron Spectrometer wasn't packed (Loadout).";
    else why.R1 = `The Neutron Spectrometer only ran ${ran("neutron").length} time(s); it needed 2.`;

    if (met.R2) why.R2 = craterRan("drill") ? "The Drill ran on the crater floor." : "The IR Spectrometer ran on the crater floor.";
    else if (!packed("ir") && !packed("drill")) why.R2 = "Neither the IR Spectrometer nor the Drill was packed (Loadout).";
    else why.R2 = craterWhy(packed("ir") ? "ir" : "drill");

    if (met.R3) why.R3 = "The Drill ran on the crater floor and found ice below the surface.";
    else if (!packed("drill")) why.R3 = "The Drill wasn't packed (Loadout).";
    else why.R3 = craterWhy("drill");

    const leftBehind = C.items.filter((i) => !packed(i.id));
    return { met, tier, why, score: s.score, leftBehind, wasted: s.wasted };
  }

  return { create, capacity, startShift, responses, respond, budget, cost, canAfford, endShift,
           evaluate, loadoutMass, item, shiftDef, canWork, isLost, isRepairing, pointsFor };
})();

if (typeof module !== "undefined") module.exports = Game;
