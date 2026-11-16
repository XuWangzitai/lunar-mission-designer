// v2 settings. REAL = measured or physical constant; everything else is a game value.
// Re-run `node tests/run-tests.js` after changing numbers.

const CONFIG = {
  roverName: "THOX",

  // Physics
  gMoon: 1.62,                 // m/s², REAL lunar surface gravity
  sunElevationDeg: 1.5,        // REAL: the Sun never rises more than ~1.5° above the horizon at the lunar poles
  earthElevationDeg: 4,        // Earth sits near the horizon from the south pole (game value within the real ±~7° libration)
  roverBaseMassKg: 250,        // rover without payload (recomputed from the engineering settings below)

  // Rover engineering the player can change. Limits keep the rover buildable:
  // energy storage and solar power both cost mass, and mass costs energy to climb.
  specificEnergyWhPerKg: 200,  // REAL-ish: lithium-ion packs store ~150–250 Wh per kg
  solarWPerKg: 75,             // REAL-ish: space solar arrays give ~50–150 W per kg
  engineering: {
    chassisKg:    { label: "Chassis and wheels", unit: "kg",   min: 150,  max: 400,  step: 5,    value: 226 },
    batteryWh:    { label: "Main battery",       unit: "Wh",   min: 1000, max: 8000, step: 250,  value: 4000 },
    solarW:       { label: "Solar array",        unit: "W",    min: 100,  max: 600,  step: 25,   value: 300 },
    efficiency:   { label: "Motor efficiency",   unit: "%",    min: 30,   max: 75,   step: 5,    value: 50 },
    speedKmh:     { label: "Cruise speed",       unit: "km/h", min: 1,    max: 6,    step: 0.5,  value: 4 },
  },
  presets: {
    standard: { label: "Standard", chassisKg: 226, batteryWh: 4000, solarW: 300, efficiency: 50, speedKmh: 4 },
    scout:    { label: "Light scout", chassisKg: 160, batteryWh: 2000, solarW: 200, efficiency: 55, speedKmh: 5 },
    hauler:   { label: "Heavy hauler", chassisKg: 360, batteryWh: 7500, solarW: 550, efficiency: 45, speedKmh: 2.5 },
  },
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

  // Difficulty changes how hard the battery fault hits, how strong the Sun is, and how often
  // random events happen. Normal is the balance all the tests and forecasts were built on.
  difficulties: {
    easy: { label: "Easy", note: "Milder battery fault, stronger panels, fewer surprises", failureMainFraction: 0.6, solarMul: 1.25, eventRate: 0.5 },
    normal: { label: "Normal", note: "The mission as designed", failureMainFraction: 0.4, solarMul: 1, eventRate: 1 },
    hard: { label: "Hard", note: "Severe battery fault, weaker panels, more surprises", failureMainFraction: 0.25, solarMul: 0.8, eventRate: 1.6 },
  },

  // Random events during a mission. Chances and costs are game values; the problems are real ones
  // (lunar dust clings to hardware, wheels sink in soft regolith, links drop packets).
  events: {
    perHour: 0.12,        // chance per mission hour at Normal, scaled by the difficulty's eventRate
    glitchChance: 0.3,    // chance a data upload fails the first time (also scaled)
    maxPerMission: 3,
    minGapH: 2,
    list: [
      { id: "dust", when: "sun", title: "Dust on the solar panels",
        text: "Fine dust thrown up by the wheels has stuck to the panels. Solar output is down 40 %.",
        choices: [
          { id: "shake", label: "Shake the panels clean", cost: 120, note: "−120 Wh now" },
          { id: "ignore", label: "Leave it", note: "panels at 60 % for 8 hours" },
        ] },
      { id: "slip", when: "slope", cost: 90, title: "Wheel slip",
        text: "A wheel sank into soft regolith on the slope. Rocking free cost 90 Wh." },
      { id: "cold", when: "shadow", title: "Cold snap",
        text: "The ground here is colder than the forecast. Heaters will draw 50 % more for the next 3 hours." },
      { id: "glitch", when: "uplink", title: "Upload failed",
        text: "Earth came back into view, but the first upload was garbled and didn't arrive.",
        choices: [
          { id: "resend", label: "Resend now", cost: 60, note: "−60 Wh, data goes home now" },
          { id: "later", label: "Let it retry by itself", note: "data waits 2 more hours" },
        ] },
    ],
  },

  // Story missions. Facts in `story` are real (sources in README); the scoring targets are game values.
  // Stars: 1 = all four requirements met; 2 = also return at least `target` science;
  // 3 = also finish with at least 25 % of the battery left.
  missions: [
    { id: "first-light", name: "First Light", crater: "faustini", level: "Start here",
      story: "Faustini has the shortest safe route of the six into permanent shadow, about 11 km. A good first mission: learn the controls, find the cold trap, and get the data home.",
      target: 80 },
    { id: "lcross", name: "Return to LCROSS", crater: "cabeus", level: "Long drive",
      story: "In 2009 NASA crashed the spent LCROSS rocket stage into Cabeus and measured about 5.6 % water ice in the debris. Drive in and confirm it from the ground. The route is the longest of the six, so energy is tight.",
      target: 140 },
    { id: "artemis-scout", name: "Artemis Scout", crater: "haworth", level: "Medium",
      story: "Haworth is one of NASA's candidate landing regions for Artemis III, the first crewed landing near the south pole. Scout its nearest cold trap so a future crew knows where the ice is.",
      target: 100 },
    { id: "biggest-shadow", name: "Biggest Shadow", crater: "shoemaker", level: "Medium",
      story: "Shoemaker's floor is the largest permanently shadowed area of the six craters here, about 1,080 km² that sunlight never touches. Plan your heaters: you'll spend a long time in the cold.",
      target: 100 },
    { id: "the-pole", name: "The Pole Itself", crater: "shackleton", level: "Hardest",
      story: "Shackleton sits almost exactly on the lunar south pole. Its walls average about 30°, close to the steepest that loose soil can hold. The only safe way into its shadow is a 25 km switchback.",
      target: 100 },
  ],

  requirements: [
    { id: "R1", title: "Hydrogen survey", text: "Run the Neutron Spectrometer at 2 different sites.", why: "Hydrogen is a clue to water. Measuring at two places shows how it changes toward the crater." },
    { id: "R2", title: "Ice detected", text: "Run the IR Spectrometer or Drill at the cold trap.", why: "The cold trap is where ice can survive, so that's where you look." },
    { id: "R3", title: "Ice confirmed at depth", text: "Run the Drill at the cold trap.", why: "Surface frost could be thin; only a drill sample proves ice is buried in the soil." },
    { id: "R4", title: "Data returned", text: "Get the cold-trap data back to Earth (climb until you have signal).", why: "Science that never reaches Earth doesn't count. The crater wall blocks the radio." },
  ],

  // Short "Why?" explainers. Facts here are real; sources in README.
  learn: {
    coldTrap: { title: "Why are polar craters so cold?", text: "The Moon's spin axis is tilted only about 1.5°, so at the poles the Sun always skims the horizon. The floors of deep craters never get direct sunlight. NASA's Diviner instrument measured spots near 38 K (−235 °C) in Cabeus, cold enough to trap water ice for a very long time." },
    lola: { title: "Where does this terrain come from?", text: "NASA's Lunar Reconnaissance Orbiter has circled the Moon since 2009. Its laser altimeter, LOLA, times laser echoes to measure surface height. Every crater here is built from LOLA's south-pole map, one height every 240 m." },
    lcross: { title: "What did LCROSS find?", text: "In 2009 NASA crashed a spent rocket stage into Cabeus and flew a probe through the debris plume. It measured about 5.6 % water ice by mass: the strongest evidence yet for ice in a polar cold trap." },
    shadow: { title: "Why does the shadow cost so much power?", text: "No sunlight means no solar power, and it is extremely cold, so heaters must run to keep the electronics alive. Every hour in the dark drains the battery, even when you're parked." },
    signal: { title: "Why did we lose contact?", text: "Radio needs a straight line to Earth. From the south pole, Earth hangs just above the horizon, so crater walls block it. Real missions plan for these blackouts or use relay satellites." },
    slope: { title: "Why can't the rover drive steeper?", text: "Loose lunar soil starts sliding at about 30–35° (its angle of repose; Shackleton's walls are close to that). Rovers are designed for much gentler slopes so they don't slip or tip over." },
    climb: { title: "Why is climbing out so expensive?", text: "Lifting the rover back up takes energy E = m·g·h. A 283 kg rover climbing 2.5 km in lunar gravity (1.62 m/s²) needs about 320 Wh at the wheels. With 50 % efficient motors, that's about 640 Wh from the battery." },
    sound: { title: "Why can you hear anything on the Moon?", text: "Outside, you couldn't: sound needs air, and the Moon has almost none. What you hear is the rover's own motors and wheels, the way they shake its frame, plus radio hiss when Earth is out of view. The same lack of air makes wheel dust fly in clean arcs and fall straight back down instead of hanging in a cloud." },
    full: { title: "Why isn't the battery charging?", text: "It's already full. Sunlight beyond what the battery can store is simply wasted. A bigger battery, not more sunlight, is what lets you work longer in the dark." },
  },

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

  // THOX the advisor. "Ask THOX" gives hints in steps (a nudge first, the specifics only if
  // asked again), never the whole answer. The report verdict depends on the stars earned.
  thox: {
    hints: {
      // {x} placeholders are filled in by advisor.js.
      noNeutron: ["R1 asks for a hydrogen survey at two sites. Which instrument measures hydrogen?", "Pack the Neutron Spectrometer: it reads hydrogen from the surface, and R1 needs it at the rim and the wall."],
      noIce: ["R2 asks us to detect ice in the cold trap. Is anything on board able to see ice?", "The IR Spectrometer or the Drill can detect ice. Without one of them, R2, R3 and R4 all fail."],
      noDrill: ["R3 wants ice confirmed below the surface. How would we reach under the dust?", "Only the Drill reaches buried ice. Without it, R3 fails and the mission can't be a full success."],
      stranded: ["Imagine my main battery fails {when}. Would this rover make it back into view of Earth?", "If the main pack fails {when}, I'd run out of power before getting back into view of Earth. A backup battery, or more battery in Rover engineering, would cover it."],
      margin: ["Three stars need a quarter of the battery left at the end. Check the forecast if the battery fails {when}.", "If the main pack fails {when}, we'd finish with only {pct} % left. More battery capacity, or less mass to haul up the wall, fixes that."],
      target: ["This mission's science target is {target}. How much does this payload bring home?", "At most {score} science with this payload. The IR Spectrometer earns double in the cold trap, and the Camera adds a few points at every site."],
      deadWeight: ["Is everything on board pulling its weight? Every kilogram has to climb back out.", "The {item} doesn't help any requirement or the score in this plan. That's {kg} kg climbing {h} m for nothing."],
      good: ["This design holds up even if my battery fails. I'd fly it. Want to push for more science, or keep the margin?"],
    },
    noMore: "That's all I've got. The rest is your call, Mission Designer.",
    // Report verdicts, chosen by stars (story missions) or tier (Sandbox).
    verdict: {
      3: ["Three stars. You planned it, you drove it, you brought it home. I'm honestly impressed.", "Perfect mission. If I had hands, I'd applaud. I have wheels, so imagine a little spin."],
      2: ["Two stars. Solid mission, and the third one is right there.", "Good work. One more star and they'll name a crater after you. Probably a small one."],
      1: ["One star: the science is home. Now let's make it look easy.", "We did the job. Not gracefully, but we did it."],
      0: ["Well, that happened. Every great mission team has a mission like this. Usually just one.", "Zero stars, but plenty of data about what not to do. Science!"],
    },
    why: {
      stuckNoBackup: "Leaving the backup battery on the launch pad was bold. The Moon was not impressed.",
      stuck: "We ran out of power in the dark. I'm not mad, just very, very cold.",
      R4: "We found ice and then kept it a secret. Climb until EARTH LINK shows before ending the mission.",
      R3: "The Drill came all this way and never touched the cold trap. It's taking it personally.",
      R2: "We never ran an ice instrument in the cold trap. The ice is still down there, waiting politely.",
      R1: "The Neutron Spectrometer needs two sites, the rim and the wall. One reading is a rumor, two is a map.",
      target: "Every requirement met, but short of the science target. Ask me while packing which instruments pay off.",
      margin: "Full success, running on fumes. Three stars needs a quarter of the battery left at the end.",
    },
  },
};

if (typeof module !== "undefined") module.exports = CONFIG;
