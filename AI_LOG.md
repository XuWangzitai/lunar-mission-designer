# Use of Super Intelligence (AI) Log

Running record for the "Use of Super Intelligence (SI)" field of the Space Apps submission.
Tool: **Claude (Anthropic), Claude Code desktop app**. All generated code is acknowledged here and in the README.

| Date | What the AI did | What I (thegoatthox) decided / did |
|---|---|---|
| 2026-11-14 | Read the official challenge brief and Resources tab; proposed the science objective, equipment list, failure event, and scoring; hand-simulated two example playthroughs | Chose the lunar ice objective and the battery-vs-instrument trade-off |
| 2026-11-14 | Drafted OUTLINE.md (screens, rules, milestones, submission mapping) | Made the design decisions: random 50/50 failure timing, robotic rover (not crew), first-person camera view, hidden crater info with a hint, tiers + score, no team play in v1, rover as a character (Jarvis-style) |
| 2026-11-14 | Suggested two realism fixes (comms blackout in the crater, energy ×10 to believable rover scale) | Approved |
| 2026-11-14 | Generated the game code: config.js, game.js, scene2d.js, ui.js, index.html, style.css, tests/run-tests.js, tools/serve.js | Reviewed and play-tested |
| 2026-11-14 | Wrote README.md and set up the GitHub repository and GitHub Pages | Played v1, approved it for publishing, planned v2 (3D driving, real NASA crater data, custom crater input) |

| 2026-11-14 | Found NASA data sources (LRO LOLA polar maps on PDS, USGS/IAU Gazetteer, Zuber 2012 on NTRS, LCROSS, Diviner); wrote tools/build-craters.js to turn LOLA maps into crater terrain and validated it against NASA's published Shackleton depth and slope | Asked for real NASA crater data, a crater picker and custom-crater predictions; approved downloading the LOLA files |
| 2026-11-14 | Generated v2 code: terrain.js (shadow, Earth line-of-sight, A* safe route), sim.js (energy physics), world3d.js (Three.js driving), ui.js, tests | Requested 3D, keyboard driving, edge warning, live HUD; chose character voice; play-tested |
| 2026-11-14 | Added the full-screen map, live power-flow readout, mission briefing, next-step guide, requirement tags and "Why?" science explainers; tested with automated play-throughs | Reported that players get lost without guidance and that the battery looked stuck at the start; asked for these fixes |
| 2026-11-14 | Built the rover-engineering panel (mass-coupled battery/solar limits, presets) and restyled the interface in a minimal aerospace look | Proposed custom rover values with realistic limits; asked for a non-generic, aerospace-style design |
| 2026-11-14 | Renamed the rover to THOX; fixed the science panel overlap, added run results and R1 progress, blocked duplicate runs, fixed a freeze when the battery ran out; added a 3,060-mission combination test | Chose the name THOX; reported the overlap and the confusing science panel from a full-screen play-test; asked for wider testing |
| 2026-11-15 | Built the self-playing `?demo=1` mode with captions, recorded it with ffmpeg (screen recording of the real game), trimmed it to 28.6 s and published it on GitHub Pages | Approved the plan and each recording, asked for a longer driving section, approved publishing |

The demo video is a plain screen recording of the game with on-screen captions; it contains no AI-generated imagery, voice or music.
No AI-generated images, video, or audio are used. All visuals are drawn in code (SVG/CSS).
