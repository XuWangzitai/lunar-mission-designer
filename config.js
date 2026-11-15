// Every number and every line of text lives here. Change values to rebalance;
// re-run `node tests/run-tests.js` afterwards to see how the test cases move.
// All values are FICTIONAL game-balance numbers unless marked REAL.

const CONFIG = {
  roverName: "LUMI",
  missionName: "Shackleton Shadow Survey",

  massLimit: 35,            // kg of payload the rover can carry
  mainBattery: 1000,        // Wh
  backupBattery: 600,       // Wh added by the backup battery item
  failure: {
    shifts: [2, 4],         // failure hits at the START of one of these, 50/50
    newMainCapacity: 400,   // Wh after the cell short
  },
  repairMainCapacity: 800,  // Wh after using the repair kit (costs that shift)
  heatersOffSaving: 100,    // Wh saved in the crater by switching heaters off
  commsBlackout: true,      // crater commands must be uploaded before going in
  revealCraterNeedsAtLoadout: false, // false = hidden numbers, only a hint

  // REAL: there is no direct sunlight on a permanently shadowed crater floor,
  // so solar input there is zero. The other numbers are fictional.
  shifts: [
    { n: 1, place: "rim",    title: "Crater rim",        solar: 600, housekeeping: 100, sun: 0.55 },
    { n: 2, place: "rim",    title: "Crater rim, edge",  solar: 600, housekeeping: 100, sun: 0.30 },
    { n: 3, place: "crater", title: "Crater floor",      solar: 0,   housekeeping: 200, sun: 0 },
    { n: 4, place: "rim",    title: "Climb back to rim", solar: 600, housekeeping: 100, sun: 0.15 },
  ],

  items: [
    {
      id: "neutron", kind: "instrument", name: "Neutron Spectrometer", short: "Neutron",
      mass: 8, energy: 200, points: { rim: 10, crater: 10 }, helps: ["R1"],
      what: "Counts neutrons leaking up from the ground. Fewer fast neutrons means more hydrogen nearby, a hint of water.",
      why: "Light, cheap to run, works anywhere. It finds where to look, not what is there.",
    },
    {
      id: "ir", kind: "instrument", name: "IR Spectrometer", short: "IR",
      mass: 10, energy: 300, points: { rim: 15, crater: 30 }, helps: ["R2"],
      what: "Reads which colors of infrared light the surface absorbs. Water ice has its own fingerprint.",
      why: "Can detect ice at the surface. Worth twice as much on the crater floor.",
    },
    {
      id: "drill", kind: "instrument", name: "Drill + Sample Analyzer", short: "Drill",
      mass: 15, energy: 500, points: { rim: 10, crater: 60 }, helps: ["R2", "R3"],
      what: "Drills about a meter down and heats the cuttings to see what gases come off.",
      why: "The only way to confirm ice below the surface. Heavy and power-hungry.",
    },
    {
      id: "camera", kind: "instrument", name: "Science Camera", short: "Camera",
      mass: 4, energy: 100, points: { rim: 5, crater: 5 }, helps: [],
      what: "High-resolution images for context and for the public.",
      why: "Cheap points, but it answers no requirement on its own.",
    },
    {
      id: "backup", kind: "support", name: "Backup Battery", short: "Backup",
      mass: 10, helps: [],
      what: "A second battery pack, wired separately from the main one. Adds 600 Wh of storage.",
      why: "Redundancy: if the main pack fails, this one keeps going. Costs the mass of an instrument.",
    },
    {
      id: "kit", kind: "support", name: "Repair Kit", short: "Repair kit",
      mass: 3, helps: [],
      what: "Spare cells and tools. If the main battery fails, LUMI can spend a shift swapping cells.",
      why: "Light, but fixing things takes time. Restores the main pack to 800 Wh.",
    },
  ],

  requirements: [
    { id: "R1", title: "Hydrogen survey",       text: "Run the Neutron Spectrometer on at least 2 shifts." },
    { id: "R2", title: "Ice detected",          text: "Run the IR Spectrometer or the Drill on the crater floor." },
    { id: "R3", title: "Ice confirmed at depth", text: "Run the Drill on the crater floor." },
  ],

  tiers: {
    full:    { label: "FULL SUCCESS",    line: "Ice confirmed at depth. The next team that comes here will know exactly where to dig." },
    partial: { label: "PARTIAL SUCCESS", line: "We saw ice, but we couldn't prove how deep it goes. That's still a first." },
    minimum: { label: "MINIMUM SUCCESS", line: "We mapped the hydrogen. The answer is down there; we just couldn't reach it this time." },
    failure: { label: "MISSION FAILURE", line: "We didn't meet a single requirement. Let's figure out why and go again." },
  },

  // Rover lines. LUMI is a partner, not a system log. Rewrite these in your own voice.
  say: {
    title:        "Systems online. I'm LUMI. I'll be your eyes at the lunar south pole.",
    briefing:     "Mission control picked a crater that hasn't seen sunlight in a very long time. If there's ice anywhere on the Moon, it's in places like this.",
    loadout:      "Pack me carefully. I can carry 35 kilograms, and I'm the one who'll be out in the cold.",
    overMass:     "That's more than I can carry. Something has to stay home.",
    noBackup:     "No backup battery? Bold. I just hope you like rationing.",
    withBackup:   "A spare battery. Less science, more sleep at night. I approve.",
    launch:       "Touchdown confirmed. Opening my eyes.",
    shift1:       "The sun barely clears the horizon here, so my panels catch what they can. Shadows are kilometers long.",
    shift2:       "Shadows are getting longer. The crater is right below us.",
    uplink:       "Once I drop below the rim, Earth goes behind the crater wall and I lose you. Give me my crater orders now. I'll follow them exactly.",
    crater:       "It's dark. Properly dark. Headlights on.",
    craterNoComms:"(No signal from Earth. Running the uploaded plan.)",
    iceIR:        "The IR spectrum has a dip right where water ice absorbs. I think we're looking at frost.",
    iceDrill:     "There's frost on the drill bit. That's ice. That's actually ice!",
    shift4:       "Climbing out. Earth is back over the rim. Sending you everything.",
    lostShift:    "Still thawing out. My electronics got cold-soaked down there. I'm sitting this one out.",
    repairing:    "Swapping cells. Don't watch, it's a little embarrassing.",
    failure:      "Cell short in my main battery! It can only hold 400 Wh now, and whatever was stored above that is gone.",
    failBackup:   "Good thing you packed my backup. I'm routing power through it.",
    failKit:      "I've got the repair kit. Give me this shift and I'll get the main pack back to 800 Wh.",
    failNone:     "No backup, no repair kit. We make every watt-hour count from here.",
    lowPower:     "Running low. I'm dimming everything I can.",
    heatersOff:   "Heaters off? I'll do it. But I'll be frozen stiff afterwards. I won't be able to work next shift.",
    debrief:      "Mission complete. Pointing my camera home.",
  },
};

if (typeof module !== "undefined") module.exports = CONFIG;
