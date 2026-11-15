// v2 settings. REAL = measured or physical constant; everything else is a game value.
// Re-run `node tests/run-tests.js` after changing numbers.

const CONFIG = {
  roverName: "LUMI",

  // Physics
  gMoon: 1.62,                 // m/s², REAL lunar surface gravity
  sunElevationDeg: 1.5,        // REAL: the Sun never rises more than ~1.5° above the horizon at the lunar poles
  earthElevationDeg: 4,        // Earth sits near the horizon from the south pole (game value within the real ±~7° libration)
  roverBaseMassKg: 250,        // rover without payload
  rollingResistance: 0.08,     // fraction of weight needed to keep rolling on regolith
  drivetrainEfficiency: 0.5,   // wheel energy / battery energy
  maxSlopeDeg: 15,             // steepest slope the rover can safely drive (editable on the crater screen)
  speedKmh: 4,                 // rover cruising speed (mission time)
  timeScale: 360,              // 1 real second = 6 mission minutes

  // Power
  mainBatteryWh: 4000,
  backupBatteryWh: 2000,
  solarPanelW: 300,            // in full sunlight
  systemsW: 25,                // computers, radio
  headlightsW: 40,
  heaterW: (floorTempK) => Math.round(10 + 0.25 * (273 - floorTempK)), // heaters work harder the colder it is
  failure: { mainFraction: 0.4 },          // main pack drops to 40 %
  repair: { mainFraction: 0.8, hours: 3 },  // repair kit: 3 mission hours, pack back to 80 %
  blindSpeedFactor: 0.3,       // driving in the dark without headlights

  // Science
  scienceNeedsUplink: true,    // data only counts once it reaches Earth (needs line of sight)
  siteRadiusM: 600,

  items: [
    { id: "neutron", kind: "instrument", name: "Neutron Spectrometer", short: "Neutron", mass: 8, energy: 200, points: { rim: 10, wall: 10, floor: 10 },
      what: "Counts neutrons leaking up from the ground. Fewer fast neutrons means more hydrogen, a hint of water.", why: "Light and cheap. Finds where to look." },
    { id: "ir", kind: "instrument", name: "IR Spectrometer", short: "IR", mass: 10, energy: 300, points: { rim: 15, wall: 15, floor: 30 },
      what: "Reads which colors of infrared light the ground absorbs. Water ice has its own fingerprint.", why: "Detects surface ice. Worth double in the cold trap." },
    { id: "drill", kind: "instrument", name: "Drill + Sample Analyzer", short: "Drill", mass: 15, energy: 500, points: { rim: 10, wall: 10, floor: 60 },
      what: "Drills about a meter down and heats the cuttings to see what gases come off.", why: "The only way to confirm buried ice. Heavy and hungry." },
    { id: "camera", kind: "instrument", name: "Science Camera", short: "Camera", mass: 4, energy: 100, points: { rim: 5, wall: 5, floor: 5 },
      what: "High-resolution images for context.", why: "Cheap points; answers no requirement." },
    { id: "backup", kind: "support", name: "Backup Battery", short: "Backup", mass: 10,
      what: "A separate 2,000 Wh pack.", why: "Redundancy, and a reserve for the climb out. Costs an instrument's mass." },
    { id: "kit", kind: "support", name: "Repair Kit", short: "Repair kit", mass: 3,
      what: "Spare cells and tools.", why: "If the main pack fails, spend 3 hours swapping cells to restore it to 80 %." },
  ],
  massLimit: 35,

  requirements: [
    { id: "R1", title: "Hydrogen survey", text: "Run the Neutron Spectrometer at 2 different sites." },
    { id: "R2", title: "Ice detected", text: "Run the IR Spectrometer or Drill at the cold trap." },
    { id: "R3", title: "Ice confirmed at depth", text: "Run the Drill at the cold trap." },
    { id: "R4", title: "Data returned", text: "Get the cold-trap data back to Earth (climb until you have signal)." },
  ],

  tiers: {
    full: { label: "FULL SUCCESS", line: "Ice confirmed and the data is home. The next mission will know exactly where to dig." },
    partial: { label: "PARTIAL SUCCESS", line: "We found signs of ice, but not everything we wanted made it home." },
    minimum: { label: "MINIMUM SUCCESS", line: "We mapped the hydrogen. The answer is down there; we just couldn't bring it back." },
    failure: { label: "MISSION FAILURE", line: "No requirement met. Let's find out why and try again." },
  },

  say: {
    pick: "Where are we going? Every one of these craters is real. The terrain comes from NASA's laser altimeter.",
    loadout: "Pack me carefully. 35 kilograms, and remember: what goes down has to climb back up.",
    overMass: "That's more than I can carry.",
    start: "Wheels down on the rim. The Sun is a sliver on the horizon. It never gets higher than about a degree and a half here.",
    edge: "Crater edge ahead. Slope here is {slope}°. I can handle {max}°. The beacons mark the gentlest way down.",
    tooSteepUp: "Too steep to climb: {slope}°. Find a gentler line.",
    tooSteepDown: "I'm not going down {slope}°. I'd tumble. Try along the beacons.",
    creep: "{slope}° here. That's past my comfort zone. Creeping.",
    shadow: "We just crossed into permanent shadow. No sunlight has touched this ground in a very long time.",
    signalLost: "Earth just dropped behind the crater wall. I'm on my own until we climb back up.",
    signalBack: "Earth is back in view. Uploading everything we've got.",
    noLights: "Driving blind. I'll go slowly.",
    site: "Science site in range. Press E to set up.",
    ice: "Frost on the drill bit. That's ice. That's actually ice!",
    iceIR: "The IR spectrum dips right where water ice absorbs. I think we're looking at frost.",
    lowPower: "Battery under 20 %. Think about the climb back.",
    failure: "Cell short in my main pack! It only holds {cap} Wh now.",
    failBackup: "My backup pack is fine. Rerouting power.",
    failKit: "I can swap cells with the repair kit. It'll cost us three hours.",
    failNone: "No backup, no repair kit. Every watt-hour counts now.",
    stuck: "That's it. I'm out of power. I'll sleep here and dream about sunlight.",
    home: "Data's home. That's a mission.",
  },
};

if (typeof module !== "undefined") module.exports = CONFIG;
