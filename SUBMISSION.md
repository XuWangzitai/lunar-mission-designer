# Space Apps Project Page: Draft (v2)

Review and edit this before anything is entered on the Space Apps site.
**Save Progress** makes it visible to visitors. **Submit for Judging** is yours to press, after the demo video.

---

## Project Name
Lunar Mission Designer

## Summary (≈190 words; form suggests 50–200, max 1,500 characters)
Lunar Mission Designer is a 3D browser game where players plan and drive a robotic rover mission into a real crater at the Moon's south pole to search for water ice. The terrain is built from NASA Lunar Reconnaissance Orbiter laser-altimeter (LOLA) data. Sunlight, permanent shadow and Earth radio contact are computed from the real shape of each crater. Players take on five story missions on Easy, Normal or Hard (up to three stars each), explore six real craters in Sandbox, or enter their own crater data. They pack instruments and backup equipment within a 35 kg mass limit and read an energy forecast. Then they drive with the keyboard: down a slope-safe route into permanent shadow, running science at each site, and back up into view of Earth so the data can be sent home. A battery failure strikes at a random moment, and random events (dust on the panels, wheel slip, cold snaps, garbled uploads) force quick choices. The central trade-off is whether to carry a backup battery or one more instrument. The backup is also the energy reserve for the climb out, which costs m·g·h. A mission report checks each requirement and shows where every watt-hour went, and a link shares the rover design and score so friends can try to beat it. THOX, the rover, gives hints on request without giving away the answer. Players learn mission design by feeling the consequences of their own decisions.

## Project Details
**How it works**
1. *Choose a mission or a crater.* Five story missions (first light at Faustini, return to the LCROSS impact site at Cabeus, an Artemis scouting run at Haworth, the biggest shadow at Shoemaker, and Shackleton at the pole) on Easy, Normal or Hard. Stars reward meeting all requirements, reaching the mission's science target, and finishing with 25 % of the battery left. Sandbox offers six real south-pole craters. Each shows its diameter (USGS/IAU Gazetteer) and its depth, wall slope and drivable route (measured by our pipeline from NASA LOLA maps), plus floor temperature and ice evidence where NASA has data. A **custom crater** mode lets players type in diameter, depth, slope, temperature and ice to predict how a mission would go. Players also set the rover's maximum safe slope.
2. *Pack the rover.* Neutron spectrometer, IR spectrometer, drill, camera, backup battery and repair kit, within 35 kg. A live **mission forecast** breaks down rolling, climbing (m·g·h ÷ η), heater and science energy along the route. It predicts the outcome with and without a battery failure.
3. *Drive in 3D.* W/A/S/D or arrow keys (on-screen arrows on phones), headlights, and first-person or chase camera. THOX, the rover, warns at the crater edge. Beacons follow a route found by A* pathfinding over the real terrain under the slope limit. Too-steep ground stops the rover. In permanent shadow there is no solar power and the heaters run. Below the rim, Earth is out of sight, so data waits until the rover climbs back into view. Boulders, small craters, wheel tracks, kicked-up dust, a lit Earth and synthesized sound make the world feel alive. Random events grounded in real lunar problems (abrasive dust on the panels, wheel slip, cold snaps, garbled uploads) ask the player to spend energy now or accept a consequence.
4. *Debrief.* A verification table marks each requirement ✓ or ✗ and explains why (for example, running out of power before the cold-trap data reached Earth). It also shows an energy breakdown, the events and the player's choices, stars, and the best score so far.
5. *Share.* Any rover design, and the score it earned, fits in a link, so players can challenge friends to beat it. No server or account is needed.
6. *Ask THOX.* Players unsure what to pack can ask the rover for hints: a nudge first, the specifics on the next ask, never the full answer. Each hint is checked against the mission forecast (missing instruments, stranding if the battery fails, battery margin, science target, dead weight). While driving, Ask THOX explains what to do next and why, and works out the energy needed to climb back into view of Earth (m·g·h ÷ η). The report ends with THOX's praise or a gentle joke, depending on the stars earned.

**Real NASA data, validated.** Our build script crops each crater from LOLA's south-polar elevation and slope maps. For Shackleton it measures a depth of 4.09 km and mean walls of 31.2°, matching NASA's published 4.1 km and ~30.5° (Zuber et al. 2012). Running the Sun's ~1.5° maximum elevation over the real terrain puts every crater's floor in permanent shadow.

**Educational goal and trade-offs.** Players learn that mission design means trading science against margin. In the forecast for all six craters, a max-science rover gets stranded if its battery fails in the shadow, while a rover with a backup battery makes it home. Shackleton's walls average 31°, but the pathfinder finds a 25 km switchback route, making it the hardest crater. Cabeus, the LCROSS impact site, is the only crater with confirmed water ice, which earns a science bonus.

**Physics in play.** Work against gravity (E = m·g·h ÷ η with lunar g = 1.62 m/s²), rolling resistance, slope limits, the low polar Sun and permanent shadow, heater power versus temperature, and radio line-of-sight.

**Real vs. fictional.** Terrain, depths, slopes, shadow, crater sizes, Cabeus ice and temperature are real data. Battery sizes, instrument energy, points, rover mass, speed and the other floor temperatures are game values, all kept in one config file.

**Tools.** HTML, CSS and JavaScript with Three.js for 3D, hosted on GitHub Pages. Node.js scripts process the NASA data and run automated tests that replay missions on every crater. A simpler 2D version (v1) is still playable at /v1/. Source: https://github.com/XuWangzitai/lunar-mission-designer

**Use of AI.** We used Claude (Anthropic), through the Claude Code desktop app, to read the challenge brief and resources, find NASA data sources, discuss game design, generate the game and data-processing code (HTML/CSS/JavaScript, Three.js, Node.js), write tests, and draft documentation, including this text. The team made the design decisions (robotic rover, first-person view, real crater data, crater picker and custom-crater prediction, keyboard driving, the rover's character voice), play-tested the game, and approved what was published. AI-generated code is acknowledged in the repository README and AI_LOG.md. No AI-generated images, video or audio are used, and no NASA logos or branding appear in the game.

## Project Demonstration
https://xuwangzitai.github.io/lunar-mission-designer/demo/lunar-mission-designer-demo.mp4 (29.8 s screen recording of the `?demo=1` run, no audio)

## Project
https://xuwangzitai.github.io/lunar-mission-designer/

## NASA Data (Link Text → URL)
- LRO LOLA South-Polar Elevation and Slope Maps (ldem/ldsm_75s_240m), NASA PDS → https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
- Zuber et al. 2012, Constraints on the volatile distribution within Shackleton crater (NASA NTRS) → https://ntrs.nasa.gov/api/citations/20120013758/downloads/20120013758.pdf
- LCROSS mission (water ice at Cabeus) → https://science.nasa.gov/mission/lcross/
- Design and Develop Science Missions (NASA) → https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf

## Space Agency Partner & Other Data (Link Text → URL)
- USGS/IAU Gazetteer of Planetary Nomenclature (crater names, centers, diameters) → https://planetarynames.wr.usgs.gov/
- Paige et al. 2010, Diviner Lunar Radiometer Observations of Cold Traps (Cabeus temperature) → https://doi.org/10.1126/science.1187726
- Three.js r160 (MIT license, 3D rendering) → https://threejs.org/
- Claude (Anthropic), AI assistant used for code and text → https://www.anthropic.com/claude

## AI-use checkboxes
Ideation/Brainstorming · Research/Information Gathering · **Data Analysis and Interpretation** (new: the LOLA data pipeline) · Coding/Debugging · Writing/Editing
