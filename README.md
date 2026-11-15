# Lunar Mission Designer

**NASA Space Apps Challenge 2026 · Challenge: Space Mission Design Game · Team: thegoatthox**

**▶ Play v2 (3D):** https://xuwangzitai.github.io/lunar-mission-designer/
**▶ Play v1 (2D):** https://xuwangzitai.github.io/lunar-mission-designer/v1/

Pick a **real crater** at the Moon's south pole, pack a robotic rover within a 35 kg mass limit, and drive it with your keyboard into permanent shadow to look for water ice. The terrain is the real Moon: it is built from NASA Lunar Reconnaissance Orbiter laser-altimeter (LOLA) elevation data. Sunlight, permanent shadow and Earth visibility are computed from the real terrain shape. Then you have to climb back out before the battery runs dry.

The central trade-off: **pack a backup battery, or use that mass for another science instrument?** In v2 the backup is also your energy reserve for the climb out, and the climb costs E = m·g·h ÷ η.

## How to play
1. **Choose a crater**: Shackleton, de Gerlache, Faustini, Haworth, Shoemaker or Cabeus, each with real measurements. Or build a **custom crater** from your own numbers. You can also set the rover's maximum safe slope.
2. **Pack the rover** and read the **mission forecast**: rolling, climbing, heater and science energy along the drivable route, with and without a battery failure. Open **Rover engineering** to change the chassis mass, battery, solar array, motor efficiency and speed. The limits keep it buildable: batteries cost ~1 kg per 200 Wh and solar arrays ~1 kg per 75 W, so more energy always means more mass to haul up the crater wall.
3. **Drive**: W/S or ↑/↓ to drive, A/D or ←/→ to steer, **E** to run science at a site, **H** for headlights, **C** to switch camera. On touch screens, use the on-screen arrows.
4. Follow the beacons (a slope-safe path found over the real terrain). LUMI warns you at the crater edge. Too-steep ground stops the rover.
5. The battery fails at a random moment: entering the shadow or during the first science run.
6. Data taken in the crater waits until Earth is back in view, so you have to climb out.
7. **Debrief** checks each requirement and shows where every watt-hour went.

## Real NASA data and how it's used
| Data | Source | Used for |
|---|---|---|
| LOLA south-polar elevation map `ldem_75s_240m` | NASA PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ | 3D terrain of every crater; depth; drivable route (A* pathfinding under the slope limit); permanent shadow and Earth line-of-sight by ray-casting |
| LOLA south-polar slope map `ldsm_75s_240m` | same | Mean wall slope shown on each crater card |
| Crater names, centers, diameters | USGS/IAU Gazetteer of Planetary Nomenclature: https://planetarynames.wr.usgs.gov/ | Where to cut each crater out of the map |
| Shackleton depth 4.1 km, wall slope ~30.5° | Zuber et al. 2012, NASA NTRS: https://ntrs.nasa.gov/api/citations/20120013758/downloads/20120013758.pdf | **Validation**: our pipeline measures 4.09 km and 31.2° (`node tests/run-tests.js`) |
| Cabeus water ice 5.6 ± 2.9 % | NASA LCROSS: https://science.nasa.gov/mission/lcross/ | Cabeus science bonus |
| Cabeus ~38 K at the LCROSS site | LRO Diviner (Paige et al. 2010, Science) | Heater power at Cabeus |
| Sun ≤ ~1.5° above the polar horizon; lunar gravity 1.62 m/s² | physical constants | Shadow computation; climb energy |
| Mission process (needs → requirements → design → verify) | *Design and Develop Science Missions*, NASA: https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf | Game structure and the requirements check in the debrief |

**Fictional (game balance):** battery sizes, instrument energy and points, rover mass, speed, heater formula, solar panel power, and floor temperatures marked "estimate". All are in `config.js`.

## Physics → what the player does
| Concept | In the game |
|---|---|
| Work against gravity, E = m·g·h ÷ η | Climbing out of a 3 km deep crater costs hundreds of Wh; descending is cheap |
| Rolling resistance | Every km driven costs energy, so shorter routes save power |
| Slope limit | Too-steep ground stops the rover; the route has to switch back |
| Low polar Sun | Crater floors never see sunlight: no solar power, heaters on |
| Line-of-sight radio | No signal below the rim; data waits until you climb back into view of Earth |
| Redundancy | Backup battery vs. another instrument |

## Tools and credits
- HTML, CSS and JavaScript; 3D with **Three.js r160** (MIT license, https://threejs.org) loaded from jsDelivr
- Node.js scripts: `tools/build-craters.js` (LOLA → `data/craters.js`), `tools/serve.js`, `tests/run-tests.js`
- Hosted on GitHub Pages. No images, audio or fonts from third parties; all visuals are generated in code.

## Use of AI
Game design discussion, code, data-processing scripts and documentation were developed with help from **Claude (Anthropic)** in the Claude Code desktop app. Design decisions, testing and story choices were made by the team. See [AI_LOG.md](AI_LOG.md). No AI-generated images, video or audio are used.

## Run locally
```
node tools/serve.js
```
Then open http://localhost:8080 (v2 needs a local server because it uses JavaScript modules).

Rebuild the crater data (downloads not included in the repo, about 58 MB):
```
# put ldem_75s_240m.img and ldsm_75s_240m.img from the PDS link above into raw/
node tools/build-craters.js
```

*Not affiliated with or endorsed by NASA.*
