# Lunar Mission Designer

**NASA Space Apps Challenge 2026 · Challenge: Space Mission Design Game · Team: thegoatthox**

**▶ Play:** https://&lt;your-github-username&gt;.github.io/lunar-mission-designer/

You plan and run a robotic rover mission to a permanently shadowed crater near the lunar south pole, seeing everything through the rover's camera. You pack instruments and backup gear within a 35 kg mass limit and run the mission on a fixed energy budget. Partway through, a battery cell fails. The mission report then checks each science requirement and traces every result back to a decision you made.

The central trade-off: **pack a backup battery, or use that mass for another science instrument?**

## How to play
1. **Briefing.** Read the objective and the three requirements (R1–R3).
2. **Pack the rover.** Choose instruments and support gear. You can't exceed 35 kg. Orbital data only tells you the crater floor gets no sunlight, so you work out the energy you'll need.
3. **Run four shifts:** rim → rim → crater floor → rim. Each shift you choose which instruments to power. Solar panels recharge the battery only in sunlight.
4. **Handle the failure.** A battery cell shorts at the start of shift 2 or shift 4 (50/50). Your options depend on what you packed.
5. **Crater uplink.** Earth is hidden behind the crater wall, so the rover can't receive commands down there. You upload the crater plan before going in.
6. **Debrief.** See which requirements passed and why, then fly again.

## Physics and engineering behind each choice
| Concept | What the player does |
|---|---|
| Energy = power × time (Wh) | Each instrument switched on removes its Wh from the shift's budget |
| Storage vs. generation | Sunlight beyond battery capacity is wasted; a bigger battery, not more sun, is what enables crater work |
| Mass budget (every kg must be launched and landed) | 35 kg limit forces choosing between science and redundancy |
| Redundancy vs. repairability | Backup battery (10 kg, automatic) vs. repair kit (3 kg, costs a shift) |
| Thermal control in permanent shadow | Heaters cost energy; switching them off saves power but freezes the rover for a shift |
| Line-of-sight communications | No commands reach the rover on the crater floor |
| Requirements and verification | The debrief checks each requirement like a verification report |

## Real vs. fictional
- **Fictional (chosen for game balance):** all masses, energy values, scores, the 35 kg limit, and failure timing. They live in `config.js`.
- **Real concepts:** some polar crater floors never receive direct sunlight, and solar power there is zero. Water ice may be trapped in these cold traps. Neutron spectrometers detect hydrogen as a sign of water.
- **Structure:** follows NASA's mission process from *Design and Develop Science Missions*: need and goals → requirements → design → implement → verify.

## NASA resources used
- *Design and Develop Science Missions*, NASA: https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf
- Challenge brief, *Space Mission Design Game*: https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/

## Tools
Plain HTML, CSS and JavaScript (no frameworks, no build step), hosted on GitHub Pages. All visuals are drawn in code with SVG and CSS. There are no images, audio, or third-party assets.

## Use of AI
Game design discussion, code, and documentation were developed with help from **Claude (Anthropic)** in the Claude Code desktop app. Design decisions, testing, and story choices were made by the team. See [AI_LOG.md](AI_LOG.md) for details. No AI-generated images, video, or audio are used.

## Run locally
```
node tools/serve.js
```
Then open http://localhost:8080. You can also open `index.html` directly in a browser.

Rule tests (checks the designed playthroughs):
```
node tests/run-tests.js
```

## Files
| File | Purpose |
|---|---|
| `config.js` | Every number and line of dialogue (the balancing file) |
| `game.js` | Game rules only, no drawing |
| `scene2d.js` | First-person camera view drawn in SVG |
| `ui.js` | Screens, HUD, rover dialogue |
| `OUTLINE.md` | Design document and roadmap |

*Not affiliated with or endorsed by NASA. Game values are fictional.*
