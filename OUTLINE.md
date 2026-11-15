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
