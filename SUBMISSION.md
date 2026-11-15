# Space Apps Project Page: Draft (v1)

Review and edit this before anything is entered on the Space Apps site.
**Save Progress** makes it visible to visitors. **Submit for Judging** is yours to press, after you finish v2 and the demo video.

---

## Project Name
Lunar Mission Designer

## High-Level Summary (≈150 words; form asks 50–200)
Lunar Mission Designer is a browser game where players plan and run a robotic rover mission to a permanently shadowed crater near the lunar south pole, seeing everything through the rover's camera. Players pack scientific instruments and backup equipment within a 35 kg mass limit, then manage a fixed energy budget across four work shifts. The crater floor gets no sunlight, a battery cell fails at a random moment, and the rover loses contact with Earth once it drops below the crater rim. The central trade-off is whether to pack a backup battery or use that mass for another instrument. At the end, a mission report checks each science requirement and traces every success or failure back to the decision that caused it. The game turns abstract mission-design ideas (mass budgets, power, redundancy, communications, and requirements verification) into choices players feel. It encourages replaying with a different design to see how the outcome changes.

## Project Details
**How it works.** The game follows the stages of NASA's mission process: define the need and requirements, design, implement, then verify.
1. *Briefing:* the science goal (is there water ice in the crater?) is stated as three requirements the game can check.
2. *Loadout:* players choose from a neutron spectrometer, an IR spectrometer, a drill, a camera, a backup battery, and a repair kit, all within 35 kg. Orbital data only says the crater floor gets no direct sunlight, so players must reason about the energy they'll need there.
3. *Mission:* four shifts (rim, rim, crater floor, rim). Each shift, players choose which instruments to power. Solar panels recharge the battery only in sunlight, and energy beyond battery capacity is wasted. A battery cell shorts at the start of shift 2 or 4. Players respond with whatever they packed: reroute through the backup, spend a shift repairing, or ration. In the crater, they can switch heaters off to save energy at the cost of freezing the rover for the next shift.
4. *Debrief:* a verification table marks each requirement ✓ or ✗ and explains why, for example: *"On the crater floor you had 400 Wh: 200 went to heaters… the Drill needs 500 Wh. The battery failure cut storage to 400 Wh, and no backup battery was packed."*

**Educational goal.** Players learn why mission teams trade science capability against margin and redundancy, and why there is rarely one perfect design. The same payload can succeed or fail depending on when things go wrong.

**Design trade-offs.**
- Max-science loadouts score highest when the failure comes late, but can miss the main objective when it comes early.
- Backup-battery loadouts are reliable but carry less science.
- We focused on mass and energy, the two resources most critical to a short surface mission. Budget, launch vehicle, and orbit are planned for future versions.

**Physics in play.** Energy = power × time (Wh); storage limits vs. generation; zero solar power in permanent shadow; heater power for thermal control; line-of-sight communications.

**Real vs. fictional.** All numbers (masses, Wh, points) are fictional values chosen for game balance and are kept in one config file. The concepts are real.

**Tools.** HTML, CSS and JavaScript with no frameworks, hosted on GitHub Pages. All graphics are drawn in code (SVG/CSS). Automated tests replay the designed playthroughs.

**What's next (v2, in progress).** 3D keyboard driving, real NASA data for each crater, choosing which crater to explore, and entering your own crater data to predict outcomes.

## Project Demonstration
*(To add: public link to a ≤30-second video)*

## Project
- Play: https://xuwangzitai.github.io/lunar-mission-designer/
- Source: https://github.com/XuWangzitai/lunar-mission-designer

## NASA Data & Resources
- Design and Develop Science Missions (NASA): https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf. Used to structure the game around NASA's mission process and to frame objectives as verifiable requirements checked in the debrief.

## Space Agency Partner & Other Data
- None used in v1. No third-party code, images, audio, or fonts; all visuals are drawn in code.

## Use of Super Intelligence (SI)
We used Claude (Anthropic), through the Claude Code desktop app, to read the challenge brief and resources, discuss game design options, generate the game's code (HTML/CSS/JavaScript), write tests, and draft documentation, including this text. The team made all design decisions: robotic rover instead of crew, first-person camera view, hidden crater information, random failure timing, the rover's character voice, and what to publish. The team also play-tested the game. AI-generated code is acknowledged in the repository README and in AI_LOG.md. No AI-generated images, video, or audio are used, and no NASA logos or branding appear in the game.
