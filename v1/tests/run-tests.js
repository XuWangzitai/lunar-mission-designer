// Replays the design playthroughs (OUTLINE.md section 6) against the real rules.
// Run: node tests/run-tests.js

const Game = require("../game.js");

const A = ["neutron", "ir", "drill"];
const B = ["neutron", "drill", "backup"];

// plan[i] = { run: [...ids], heatersOff, response } for shift i+1
const cases = [
  { name: "A, early failure, heaters on", loadout: A, failureShift: 2,
    plan: [{ run: ["neutron", "ir"] }, { run: ["neutron", "ir"], response: "ration" }, { run: ["neutron"] }, { run: ["neutron", "ir"] }],
    score: 85, tier: "minimum" },
  { name: "A, early failure, heaters off", loadout: A, failureShift: 2,
    plan: [{ run: ["neutron", "ir"] }, { run: ["neutron", "ir"], response: "ration" }, { run: ["ir"], heatersOff: true }, { run: [] }],
    score: 80, tier: "partial" },
  { name: "A, late failure", loadout: A, failureShift: 4,
    plan: [{ run: ["neutron", "ir"] }, { run: ["neutron", "ir"] }, { run: ["ir", "drill"] }, { run: ["neutron", "ir"], response: "ration" }],
    score: 165, tier: "full" },
  { name: "B, early failure", loadout: B, failureShift: 2,
    plan: [{ run: ["neutron", "drill"] }, { run: ["neutron"], response: "ration" }, { run: ["drill", "neutron"] }, { run: ["neutron"] }],
    score: 110, tier: "full" },
  { name: "B, late failure", loadout: B, failureShift: 4,
    plan: [{ run: ["neutron", "drill"] }, { run: ["neutron", "drill"] }, { run: ["drill", "neutron"] }, { run: ["neutron", "drill"], response: "ration" }],
    score: 130, tier: "full" },
];

let failures = 0;
function check(label, cond, detail = "") {
  if (!cond) { failures++; console.log(`  FAIL ${label} ${detail}`); }
}

for (const c of cases) {
  const s = Game.create(c.loadout, { failureShift: c.failureShift });
  c.plan.forEach((p) => {
    if (Game.startShift(s)) Game.respond(s, p.response || "ration");
    Game.endShift(s, p.run, !!p.heatersOff);
  });
  const r = Game.evaluate(s);
  const ok = r.score === c.score && r.tier === c.tier;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}: ${r.score} pts, ${r.tier} (expected ${c.score}, ${c.tier})`);
  if (!ok) failures++;
  if (!r.met.R3) console.log(`        R3: ${r.why.R3}`);
}

// Edge checks
check("mass limit blocks 36 kg", Game.loadoutMass(["neutron", "ir", "drill", "kit"]) > 35);
{
  const s = Game.create(A, { failureShift: 2 });
  Game.startShift(s); Game.endShift(s, ["neutron", "ir"]);
  Game.startShift(s); Game.respond(s, "ration"); Game.endShift(s, ["neutron", "ir"]);
  Game.startShift(s);
  let threw = false;
  try { Game.endShift(s, ["drill"]); } catch { threw = true; }
  check("overspending is rejected", threw);
  check("stored never negative", s.stored >= 0);
}
{
  const s = Game.create(["neutron", "drill", "kit"], { failureShift: 2 });
  Game.startShift(s); Game.endShift(s, ["neutron"]);
  Game.startShift(s); Game.respond(s, "repair");
  const log = Game.endShift(s, ["neutron"]);
  check("repair shift runs no instruments", log.ran.length === 0);
  check("repair restores 800 Wh", Game.capacity(s) === 800, `got ${Game.capacity(s)}`);
}

console.log(failures ? `\n${failures} failure(s)` : "\nAll tests passed");
process.exit(failures ? 1 : 0);
