# Lunar Mission Designer: Project Outline

Team **thegoatthox** · NASA Space Apps 2026 · Challenge: *Space Mission Design Game*
Deadline: **Sun Nov 15, 2026, 11:59 p.m. Pacific**

---

## 1. One-sentence pitch
Players design and drive a robotic rover on a short lunar south-pole mission, seeing everything through its camera. They pack instruments and backup gear within a mass limit, handle a power failure on the surface, and get a debrief that shows exactly which earlier decisions led to the result.

## 2. Scope

**In v1**
- One mission scenario (polar water-ice search)
- Mass and energy are the only resources managed
- 6 equipment choices, 4 shifts, 1 failure (random timing), debrief, replay
- Single player, desktop and phone browser

**Out of v1 (mention as "future work")**
- Budget, data, comms, launch vehicle, orbit selection
- Multiplayer / team roles
- More scenarios, more failure types, difficulty levels

## 3. Design decisions (decided Nov 14)
| Decision | Choice | Why |
|---|---|---|
| Failure timing | Random: start of shift 2 or shift 4 (50/50) | Keeps the battery-vs-instrument choice a real gamble |
| Who the player is | **Robotic rover operator**, no crew on the surface | Real missions send robots where risk to humans isn't worth it |
| Point of view | **First person through the rover's camera** | More immersive; a camera feed with a HUD is a natural fit for a robot |
| Info before launch | **Hidden numbers, fair hint.** Packing shows only "Crater floor: no direct sunlight expected, exact conditions unknown." The player has to work out the energy need themselves. | More fun and more realistic; the hint keeps a first run from feeling like a trick |
| Graphics | **2D first** (layered SVG/CSS), **3D later** (Three.js) | Gets a playable game done first; renderer is a separate file so it can be swapped |
| Winning | Requirement tiers **and** a science score | Tiers teach "did the mission work"; score rewards replay |
| Team play | Not in v1 | Scope; listed as future work |

## 3a. First-person presentation
- The whole game is framed as the **rover's camera feed**: a full-screen view with a HUD overlaid (energy gauge, shift clock, instrument status).
- **Scene per shift** (layered SVG/CSS, light parallax when "driving" between shifts):
  - S1–S2 crater rim: low sun on the horizon, long shadows, grey regolith, Earth low in the sky
  - S3 crater floor: near-black, lit only by the rover's headlight cone; frost glints when the IR/Drill finds ice
  - S4 return: climbing back into low sunlight
- **Instrument use is shown in view**: Neutron = pulse ripple on the HUD, IR = scan line sweeping the ground, Drill = drill bit entering the frame bottom with depth readout, Camera = shutter flash.
- **Failure** = feed flickers and static, HUD battery icon cracks, alarm panel slides in.
- **Loadout screen** = looking down at the rover's own payload deck from the mast camera; each item clicks into a bay slot.
- **Debrief** = the camera "points back at Earth" with the mission report over it.
- Voice: see section 10 (rover as a character vs. machine-style system log).

## 3c. Realism fixes (added Nov 14)
- **Comms blackout in the crater.** In a deep polar crater, Earth sits behind the crater wall, so the rover can't talk to you. The crater shift's commands are uploaded at the end of shift 2 and run with no changes allowed. Same choices and test results; you just commit before you go in. (`CONFIG.commsBlackout`)
- **Energy scaled ×10** so a rover battery is a believable 1 kWh, not 100 Wh. All energy values ×10; points and test-case scores unchanged.
- **Rover voice = character** (Jarvis-style partner). It reacts to your choices, e.g. leaving the backup battery behind.

## 3b. Light and energy shape what you see
The view gets darker as the mission goes on, and the darkness tells the player how they're doing:
- **Sun sinks over the mission:** S1 bright low sun → S2 sun lower, shadows longer → S3 crater floor, no sun → S4 dim light on the climb out.
- **Battery level drives the view:** below 50% the headlight cone narrows; below 25% the HUD drops to power-save (non-essential readouts go dark, image gets grainy). You *feel* low energy before you read the number.
- **v1: visuals only.** Solar input stays 60/60/0/60, so the test cases in section 6 still hold.
- **Later option (needs rebalancing):** make solar input fall with the sun's angle (e.g. 60/50/0/40). Physics: panel power ∝ cos(angle between sunlight and the panel's facing direction), so a lower sun gives fewer Wh.

## 4. Screen flow

```
Title -> Briefing (objective + R1-R3) -> Loadout -> Mission (4 shifts, failure) -> Debrief -> Replay (back to Loadout)
```

### 4.1 Title
- Game name, one-line premise, **Start** button
- Footer: "Fictional game values. Not affiliated with or endorsed by NASA." (keeps within the branding rules)

### 4.2 Briefing (step: Need & Goals → Requirements)
- Story text (written by you): the rover's name, the mission team on Earth, why this crater
- Objective: *Find out whether water ice exists in a shadowed crater near the lunar south pole.*
- Requirements card:
  - **R1 Hydrogen survey**: Neutron Spectrometer runs on 2+ shifts
  - **R2 Ice detected**: IR Spectrometer or Drill runs on the crater floor (shift 3)
  - **R3 Ice confirmed at depth**: Drill runs on the crater floor
- Mission timeline strip: S1 rim (sun), S2 rim (sun), S3 crater floor (shadow), S4 rim (sun)

### 4.3 Loadout (step: Design)
- Equipment cards: name, plain-language purpose, mass, energy per shift, science value, "helps with R#" tag
- Live **mass bar** (0–35 kg) that blocks going over the limit
- Storage capacity shown (main + backup). Crater energy need is **not** shown; only the orbital hint "no direct sunlight expected, exact conditions unknown"
- Tooltip / "Why it matters" line per item (the physics explanation)
- **Launch** button (allowed whenever mass is within the limit)

### 4.4 Mission (step: Implement)
Per shift:
- Location and lighting, solar input this shift
- Energy gauge: stored, + solar, − housekeeping, = available
- Instrument toggles (packed items only); each toggle shows its Wh cost and points
- Toggles that would exceed available energy are disabled, with the reason shown
- "Wasted sunlight" readout when the battery would overflow
- **End shift** button → log line ("Shift 1: Neutron + IR ran, +25 pts, battery 1000/1000 Wh")

Failure event (start of shift 2 or 4):
- Alert panel: battery cell short, capacity 1000 → 400 Wh, charge above 400 lost
- Response buttons (only those the player packed for):
  - Ration power (always)
  - Switch to backup battery (needs backup)
  - Repair (needs repair kit: this shift is spent repairing, main capacity → 800 Wh; repair uses the current shift)
- Crater shift extra option: **Heaters off** (housekeeping 200 → 100 Wh, but the rover's electronics cold-soak and shift 4 is lost while they warm up)

### 4.5 Debrief (step: Build & Verify)
- Outcome tier: Full success / Partial / Minimum / Failure
- Science score
- **Verification table**: each requirement ✓/✗ plus the *cause*, e.g.
  - "R3 ✗: Drill was not packed (Loadout)"
  - "R2 ✗: only 200 Wh left on the crater floor; capacity was 400 Wh after the failure and no backup was packed"
- "What you gave up": items left behind and the points they could have added
- Decision timeline: loadout → failure response → per-shift choices
- **Replay** (same loadout or change loadout); best score saved in the browser

## 5. Rules and values (all in one `CONFIG` object)

| Constant | Value | Real or fictional |
|---|---|---|
| Payload mass limit | 35 kg | Fictional |
| Main battery | 1000 Wh | Fictional |
| Solar per sunlit shift | 600 Wh | Fictional |
| Housekeeping | 100 Wh sun / 200 Wh shadow | Fictional (heaters in the cold are real) |
| Failure | Capacity 1000 → 400 Wh at start of S2 or S4 | Fictional |
| Repair | Lose next shift's science, capacity → 800 Wh | Fictional |
| No solar power in shadow | — | Real |

| Item | Mass | Wh/shift | Points |
|---|---|---|---|
| Neutron Spectrometer | 8 | 200 | 10 any |
| IR Spectrometer | 10 | 300 | 15 sun / 30 crater |
| Drill | 15 | 500 | 10 sun / 60 crater |
| Camera | 4 | 100 | 5 any |
| Backup battery | 10 | — | +600 Wh storage |
| Repair kit | 3 | — | enables Repair |

Energy step per shift:
```
available = stored + solar
used      = housekeeping + sum(instrument Wh)   // must be <= available
stored    = min(capacity, available - used)
wasted    = max(0, available - used - capacity)
```

## 6. Test cases (must reproduce exactly)
| Loadout | Failure | Choices | Expected |
|---|---|---|---|
| A: Neutron+IR+Drill | S2 | heaters on | 85 pts, Minimum |
| A | S2 | heaters off in S3, IR | 80 pts, Partial |
| A | S4 | IR+Drill in crater | 165 pts, Full |
| B: Neutron+Drill+Backup | S2 | Neutron only in S2 | 110 pts, Full |
| B | S4 | Neutron+Drill every sunlit shift | 130 pts, Full |

Plus: mass limit blocks a 36 kg loadout; disabled toggles never let energy go negative; replay fully resets state.

## 7. Tech and files
Plain HTML/CSS/JS, no build step, hosted on GitHub Pages.

```
lunar-mission-designer/
  index.html      screens and layout
  style.css       look and feel
  config.js       every number and text string (the balancing file)
  game.js         state and rules only (no drawing)
  ui.js           HUD, buttons, screens
  scene2d.js      camera-feed scenes in SVG/CSS (v1)
  scene3d.js      Three.js version later; same interface as scene2d.js
  README.md       how to play, how it works, credits, AI use
  AI_LOG.md       running record of AI help
  CREDITS.md      NASA resources and any other assets
```

State model (sketch):
```js
state = {
  screen, loadout: [], shift: 1, stored, capacity, backupCapacity,
  failureShift, failureResponse, heatersOff, shiftsLost: [],
  log: [], score, requirements: { R1, R2, R3 }
}
```

## 8. Milestones (time boxes)
| # | Milestone | Done when |
|---|---|---|
| M1 | Skeleton + Briefing + Loadout | Can pick items, mass bar works, Launch moves on |
| M2 | Mission loop | 4 shifts with energy math and toggles, no failure yet |
| M3 | Failure + responses + heaters-off | All 5 test cases reproduce |
| M4 | Debrief with causes + replay | Every ✗ shows a cause; replay resets |
| M5 | First-person polish | Camera-feed scenes per shift, instrument animations, failure static, readable on phone, your story text in |
| M6 | Deploy | Public GitHub Pages URL opens in a private window |
| M7 | Demo | ≤30 s recording: loadout → failure → choice → debrief cause |
| M8 | Submission | Summary, details, data list, AI disclosure, Save Progress, Submit |

Target: M1–M4 by Sunday early afternoon, M5–M6 by late afternoon, M7–M8 Sunday evening with buffer before 11:59 p.m. PT.

## 9. Submission form mapping
| Form field | Comes from |
|---|---|
| Project Name & Summary (50–200 words) | Pitch + what was built |
| Project Details | Sections 4–5 + trade-off explanation + tools |
| Demonstration | M7 video (public link, ≤30 s) |
| Project | GitHub Pages URL (+ repo link) |
| NASA Data | "Design and Develop Science Missions": https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf, plus any fact sources you verify |
| Use of SI | AI_LOG.md |

## 10. Writing you own (the rover's story)
- Rover name and mission name
- Rover voice: **character** ("Cell 3 just shorted. I'm down to 400 Wh.") or **system log** ("ALERT: BATTERY CELL FAULT. CAPACITY 400 WH."). **Chosen: character**
- Briefing paragraph (why this crater matters)
- Failure alert wording
- Debrief closing line for each outcome tier

---

# v2 Plan: 3D driving on real NASA crater terrain (drafted Nov 14 evening)

## Goals (from play-testing v1)
- Drive the rover yourself with the keyboard, in 3D
- Warning at the crater edge, then descend along the gentlest slope
- Live HUD while moving: battery, requirements checklist, slope, signal
- **Real NASA crater data**, a **crater picker before launch**, and a **custom crater** mode where players type in their own values to predict how a mission would go

## NASA data sources (real)
| Source | What we take from it | URL |
|---|---|---|
| LRO LOLA polar elevation map `ldem_75s_240m.img` (29 MB, 240 m/pixel) | The actual 3D terrain of each crater; depth = rim − floor | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ |
| LRO LOLA polar slope map `ldsm_75s_240m.img` (29 MB) | Wall slopes; the gentlest route into each crater | same folder |
| USGS/IAU Gazetteer of Planetary Nomenclature (NASA-funded) | Official crater names, centers, diameters | https://planetarynames.wr.usgs.gov/ |
| Zuber et al. 2012, "Constraints on the volatile distribution within Shackleton crater" (NASA NTRS) | Shackleton: depth 4.1 ± 0.05 km, avg wall slope 30.5°, max 35°, floor ≈ 7 km | https://ntrs.nasa.gov/api/citations/20120013758/downloads/20120013758.pdf |
| LCROSS results (Colaprete et al. 2010, Science) | Cabeus: 5.6 ± 2.9 % water ice by mass in the impact plume | https://science.nasa.gov/mission/lcross/ |
| Diviner (Paige et al. 2010, Science) | Cabeus LCROSS site ≈ 37–38 K average | (paper) |

## Candidate craters (gazetteer values: real)
| Crater | Diameter (km) | Center lat, lon | Why it's interesting |
|---|---|---|---|
| Shackleton | 20.9 | −89.67, 129.78 | At the pole; rim gets near-constant sun; walls ~30° (too steep?) |
| de Gerlache | 32.7 | −88.48, −88.34 | Artemis III candidate region on its rim |
| Haworth | 51.4 | −87.45, −5.17 | Big shadowed floor (~1,019 km² PSR); Artemis III candidate region |
| Shoemaker | 51.8 | −88.14, 45.91 | Largest PSR of the group (~1,080 km²) |
| Faustini | 42.5 | −87.18, 84.31 | ~665 km² PSR |
| Cabeus | 100.6 | −85.33, −42.13 | LCROSS impact site: water confirmed (5.6 %) |
Depth and wall slope for each are measured from the LOLA map (to be filled in by `tools/build-craters.js`).

## How crater data becomes game rules
| Crater value | Physics | What the player feels |
|---|---|---|
| Wall slope (LOLA) | A rover can only climb/descend up to its max slope (game value, editable) | Edge warning shows the slope; too-steep walls are blocked; you must find the gentler route |
| Depth (LOLA) | Climbing out costs E = m·g·h / η (g = 1.62 m/s², real) | Going down is cheap; coming back up eats the battery. Run out in the crater → stuck |
| Diameter / PSR size | Distance to drive in total darkness | Longer drives in the dark drain more |
| Floor temperature (Diviner where available, else estimate) | Heater power rises as it gets colder | Bigger heater draw on the floor |
| Ice evidence (LCROSS for Cabeus; "unknown" elsewhere) | Science value of the crater | Higher-risk craters can pay off more |

## New screens
1. **Crater picker** (before loadout): map of the south pole with the six craters; each card shows real values with source tags (LOLA / Gazetteer / LCROSS)
2. **Custom crater**: sliders/inputs for diameter, depth, wall slope, floor temperature, ice %; game builds a procedural bowl crater with those numbers
3. **Predict**: runs the energy model for your loadout + crater without driving and shows a forecast (descent, science, climb-out, margin)
4. **Drive** (3D, Three.js): WASD/arrows drive, E = run instruments at a site, H = headlights, C = camera (first-person / chase)
5. Debrief: same verification table, now also: energy spent climbing, max slope reached, distance driven

## Build order (cut line marked)
1. Data pipeline: download LOLA files → `tools/build-craters.js` → `data/craters.json` (heightmap crops + measured depth/slope)
2. Crater picker + custom crater + predict
3. 3D terrain from heightmap, rover, WASD driving, slope + energy physics, edge warning
4. Science sites, failure event, comms loss below the rim, debrief
5. ——— cut line: everything above ships; below only if time ———
6. Lighting by real sun angle, rover model detail, touch controls, sound
