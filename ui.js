// v2 screens: crater picker → loadout + forecast → 3D drive → debrief.

const UI = (() => {
  const C = CONFIG;
  const $ = (s) => document.querySelector(s);
  const item = Sim.item;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  let craterChoice = null, terrain = null, loadout = ["neutron", "drill", "backup"], sim = null;
  const terrainCache = {};
  let customParams = { name: "My crater", diameterKm: 30, depthKm: 2.5, wallSlopeDeg: 12, floorTempK: 50, icePct: 3 };

  // ---------- LUMI ----------
  let sayToken = 0;
  function say(text, vars = {}) {
    const line = text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
    const token = ++sayToken, el = $("#lumi-text");
    let i = 0;
    el.textContent = "";
    const tick = setInterval(() => {
      if (token !== sayToken) return clearInterval(tick);
      el.textContent = line.slice(0, ++i);
      if (i >= line.length) clearInterval(tick);
    }, 14);
  }

  function setPanel(html, mode = "side") {
    const p = $("#panel");
    p.className = "panel panel-" + mode;
    p.innerHTML = html;
    p.hidden = false;
    p.scrollTop = 0;
  }
  const hidePanel = () => { $("#panel").hidden = true; };

  function getTerrain(c) {
    if (c === "custom") {
      const p = customParams;
      return Terrain.custom({ ...p, iceFactor: 0.5 + Math.min(1.5, p.icePct / 5) });
    }
    if (!terrainCache[c.id]) terrainCache[c.id] = Terrain.fromCrater(c);
    return terrainCache[c.id];
  }

  function pathKm(T) {
    let d = 0;
    for (let k = 1; k < T.path.length; k++) d += Math.hypot(T.path[k].x - T.path[k - 1].x, T.path[k].y - T.path[k - 1].y);
    return d / 1000;
  }

  // Reachability comes from an actual drivable path over the terrain (A*, ≤ max slope).
  function reach(T) {
    return T.trapReachable
      ? { ok: true, text: `Safe route into the shadow: ${pathKm(T).toFixed(1)} km of driving` }
      : { ok: false, text: `No route under ${C.maxSlopeDeg}° reaches the permanent shadow` };
  }

  // ---------- screens ----------
  function title() {
    $("#hud").hidden = true;
    setPanel(`
      <div class="eyebrow">NASA SPACE APPS 2026 · TEAM THEGOATTHOX</div>
      <h1>Lunar Mission Designer</h1>
      <p class="lead">Pick a real crater at the Moon's south pole, pack your rover, and drive it into permanent shadow to look for ice. The terrain is real: it comes from NASA's Lunar Reconnaissance Orbiter laser altimeter.</p>
      <button class="btn primary" data-act="briefing">Start mission briefing</button>
      <p class="fine">Physics and crater data are real where marked; power and science values are game values. Not affiliated with or endorsed by NASA. <a href="v1/">Play v1 (2D)</a></p>`, "center");
    say("Hi, I'm LUMI. Let's go find some ice.");
  }

  const why = (k) => `<details class="why"><summary>Why? ${C.learn[k].title}</summary><p>${C.learn[k].text}</p></details>`;

  function briefing() {
    $("#hud").hidden = true;
    setPanel(`
      <div class="eyebrow">MISSION BRIEFING</div>
      <h2>Find out whether there is water ice in a permanently shadowed crater, and get the proof home.</h2>
      ${why("coldTrap")}
      <h3>Your requirements</h3>
      <div class="reqs">${C.requirements.map((r) => `<div class="req"><span class="req-id">${r.id}</span><div><b>${r.title}</b>: ${r.text}<br><span class="muted small">${r.why}</span></div></div>`).join("")}</div>
      <h3>How a mission goes</h3>
      <ol class="steps">
        <li><b>Choose a crater</b>, a real one measured by NASA, or build your own.</li>
        <li><b>Pack the rover</b> within 35 kg and check the energy forecast.</li>
        <li><b>Survey the rim</b> (amber pillar near the landing site): drive into the ring and press <kbd>E</kbd>.</li>
        <li><b>Follow the blue beacons</b> down the safe route to the wall site and the <b>cold trap</b> (blue pillar).</li>
        <li><b>Climb back out</b> until Earth is in view, so your data uploads. Then press <b>End mission</b>.</li>
      </ol>
      <h3>Controls</h3>
      <div class="controls">
        <span><kbd>W</kbd><kbd>S</kbd> or <kbd>↑</kbd><kbd>↓</kbd> drive</span><span><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> steer</span>
        <span><kbd>E</kbd> science at a site</span><span><kbd>M</kbd> map</span><span><kbd>H</kbd> headlights</span><span><kbd>C</kbd> camera</span>
      </div>
      <p class="muted small">Watch the battery: the Sun barely rises here, the shadow has no solar power, and something will go wrong.</p>
      <button class="btn primary" data-act="pick">Choose a crater</button>`, "center wide");
    say("Read this first. Then pick where we're going.");
  }

  function pick(selectedId) {
    $("#hud").hidden = true;
    const cards = CRATER_DATA.map((c) => {
      const f = Sim.facts(c), T = getTerrain(c), r = reach(T);
      return `<button class="card crater ${selectedId === c.id ? "on" : ""}" data-act="crater" data-id="${c.id}">
        <div class="card-top"><b>${c.name}</b><span class="chk ${r.ok ? "good" : "bad"}">${r.ok ? `ROUTE ${pathKm(T).toFixed(0)} KM` : "NO SAFE ROUTE"}</span></div>
        <div class="facts">
          <span>Diameter <b>${c.diameterKm} km</b><i>Gazetteer</i></span>
          <span>Depth <b>${c.depthKm} km</b><i>LOLA</i></span>
          <span>Wall slope <b>${c.wallSlopeMeanDeg}°</b><i>LOLA</i></span>
          <span>Gentlest route <b>${c.gentlestRoute.maxSlopeDeg}°</b><i>LOLA</i></span>
          <span>Floor <b>${f.floorTempK} K</b><i>${f.tempSource.startsWith("game") ? "estimate" : "Diviner"}</i></span>
        </div>
        <div class="card-why">${f.iceNote}</div>
      </button>`;
    }).join("");
    setPanel(`
      <div class="eyebrow">STEP 1 · CHOOSE A CRATER</div>
      <h2>Lunar south pole</h2>
      <p class="muted small">Values tagged <i>LOLA</i> were measured by this game from NASA LRO laser-altimeter maps. Our Shackleton numbers match NASA's published 4.1 km depth and ~30° walls.</p>
      ${why("lola")}${why("lcross")}${why("slope")}
      <label class="slider">Rover max safe slope <b id="maxslope-v">${C.maxSlopeDeg}°</b>
        <input type="range" min="8" max="30" value="${C.maxSlopeDeg}" data-act="maxslope"></label>
      <div class="items">${cards}
        <button class="card crater ${selectedId === "custom" ? "on" : ""}" data-act="crater" data-id="custom">
          <div class="card-top"><b>Custom crater</b><span class="chk">YOUR DATA</span></div>
          <div class="card-why">Type in your own diameter, depth, slope, temperature and ice to predict how a mission would go.</div>
        </button>
      </div>
      ${selectedId === "custom" ? customForm() : ""}
      <button class="btn primary" data-act="toLoadout" ${selectedId ? "" : "disabled"}>Pack the rover</button>`);
    say(C.say.pick);
  }

  function customForm() {
    const p = customParams;
    const row = (k, label, min, max, step, unit) => `<label class="slider">${label} <b>${p[k]} ${unit}</b>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${p[k]}" data-act="custom" data-id="${k}"></label>`;
    return `<div class="custom">
      ${row("diameterKm", "Diameter", 5, 100, 1, "km")}
      ${row("depthKm", "Depth", 0.3, 6, 0.1, "km")}
      ${row("wallSlopeDeg", "Wall slope", 4, 35, 1, "°")}
      ${row("floorTempK", "Floor temperature", 25, 150, 1, "K")}
      ${row("icePct", "Ice in the soil", 0, 10, 0.5, "%")}
      ${(() => {
        const minDeg = Math.atan(p.depthKm / (p.diameterKm / 2 * 0.95)) * 180 / Math.PI;
        return minDeg > p.wallSlopeDeg
          ? `<div class="alert soft">A ${p.depthKm} km drop inside a ${p.diameterKm} km crater needs walls of at least ${minDeg.toFixed(0)}°, so the walls will be steeper than you asked.</div>`
          : "";
      })()}
      <p class="fine">Tip: try Shackleton's real numbers (21 km, 4.1 km, 30°) and see what the rover can do.</p>
    </div>`;
  }

  function selectCrater(id) {
    craterChoice = id === "custom" ? "custom" : CRATER_DATA.find((c) => c.id === id);
    $("#loading").hidden = false;
    setTimeout(() => {
      terrain = getTerrain(craterChoice);
      World.preview(terrain);
      $("#loading").hidden = true;
      pick(id);
      const m = terrain.meta, r = reach(terrain);
      say(`${m.name}: ${m.diameterKm} km wide, ${m.depthKm} km deep, walls averaging ${m.wallSlopeMeanDeg}°. ${r.ok ? `I found a way into the shadow: ${pathKm(terrain).toFixed(1)} km of driving.` : `I can't find a way in under ${C.maxSlopeDeg}°.`}`);
    }, 30);
  }

  function loadoutScreen() {
    if (craterChoice === "custom") terrain = getTerrain("custom");
    World.preview(terrain);
    const mass = loadout.reduce((m, id) => m + item(id).mass, 0);
    const p = Sim.predict(terrain, loadout), pf = Sim.predict(terrain, loadout, { failure: "shadow" });
    const r = reach(terrain);
    const u = p.used;
    const bar = (v, cls) => `<span class="seg ${cls}" style="width:${Math.min(100, (v / p.capacity) * 100)}%"></span>`;
    const outcome = (q) => q.stuck ? `<b class="bad">Stranded</b>` : `<b class="tier-${q.tier}">${C.tiers[q.tier].label}</b>`;
    setPanel(`
      <div class="eyebrow">STEP 2 · PACK THE ROVER · ${terrain.meta.name.toUpperCase()}</div>
      <div class="meter"><div class="meter-label"><span>MASS</span><b>${mass} / ${C.massLimit} kg</b></div>
        <div class="bar"><span style="width:${(mass / C.massLimit) * 100}%"></span></div></div>
      <div class="items">
        ${C.items.map((it) => {
          const on = loadout.includes(it.id), heavy = !on && mass + it.mass > C.massLimit;
          const stats = it.kind === "instrument" ? `${it.mass} kg · ${it.energy} Wh per run` : `${it.mass} kg · support`;
          return `<button class="card ${on ? "on" : ""} ${heavy ? "heavy" : ""}" data-act="toggle" data-id="${it.id}">
            <div class="card-top"><b>${it.name}</b><span class="chk">${on ? "PACKED" : heavy ? "TOO HEAVY" : "+"}</span></div>
            <div class="card-stats">${stats}</div><div class="card-why">${it.why}</div></button>`;
        }).join("")}
      </div>
      <h3>Mission forecast</h3>
      <p class="muted small">Drive the beacon route, run each requirement's instruments, and come back to the landing site.</p>
      <div class="${r.ok ? "hint" : "alert soft"}">${r.text}.${r.ok ? "" : " The forecast skips the cold trap."}</div>
      <div class="stack big">${bar(u.drive, "drive")}${bar(u.climb, "climb")}${bar(u.heaters + u.lights + u.systems, "house")}${bar(u.science, "inst")}</div>
      <div class="stat-row"><span><i class="dot drive"></i>Rolling</span><b>${fmt(u.drive)} Wh</b></div>
      <div class="stat-row"><span><i class="dot climb"></i>Climbing (m·g·h ÷ η)</span><b>${fmt(u.climb)} Wh</b></div>
      <div class="stat-row"><span><i class="dot house"></i>Heaters, lights, systems (${p.shadowH.toFixed(1)} h in shadow)</span><b>${fmt(u.heaters + u.lights + u.systems)} Wh</b></div>
      <div class="stat-row"><span><i class="dot inst"></i>Science</span><b>${fmt(u.science)} Wh</b></div>
      <div class="stat-row"><span>☀ Solar gained on the way</span><b>+${fmt(p.solar)} Wh</b></div>
      <div class="stat-row"><span>Battery</span><b>${fmt(p.capacity)} Wh</b></div>
      ${why("climb")}
      <div class="forecast">
        <div><span>No failure</span>${outcome(p)}</div>
        <div><span>Battery fails in the shadow</span>${outcome(pf)}</div>
      </div>
      <div class="btn-row"><button class="btn" data-act="pick">Back</button><button class="btn primary" data-act="launch" ${loadout.length ? "" : "disabled"}>Land and drive</button></div>`);
    say(C.say.loadout);
  }

  function toggle(id) {
    const mass = loadout.reduce((m, i) => m + item(i).mass, 0);
    if (loadout.includes(id)) loadout = loadout.filter((x) => x !== id);
    else if (mass + item(id).mass > C.massLimit) return say(C.say.overMass);
    else loadout = [...loadout, id];
    loadoutScreen();
  }

  // ---------- driving ----------
  let siteOpen = null, lastLowWarn = false;
  function launch() {
    sim = Sim.create(terrain, loadout);
    hidePanel();
    $("#hud").hidden = false;
    drawMinimap();
    World.start(sim, { onEvent, onHud });
    shown.clear();
    $("#explain").hidden = true;
    say(C.say.start);
    toast("Hold W or ↑ to drive · A/D to steer · M for the map");
    lastLowWarn = false;
  }

  function onEvent(name, data) {
    const map = {
      edge: () => say(C.say.edge, { slope: data, max: C.maxSlopeDeg }),
      tooSteepUp: () => { say(C.say.tooSteepUp, { slope: data }); explain("slope"); },
      tooSteepDown: () => { say(C.say.tooSteepDown, { slope: data }); explain("slope"); },
      creep: () => { say(C.say.creep, { slope: data }); explain("slope"); },
      shadow: () => { say(C.say.shadow); explain("shadow"); },
      signalLost: () => { say(C.say.signalLost); explain("signal"); },
      signalBack: () => say(C.say.signalBack),
      uplink: () => toast("📡 Data uplinked to Earth"),
      near: () => { if (data) { say(C.say.site); toast(`${data.label}: press E`); } },
      site: () => openSite(data),
      failure: () => openFailure(),
      repaired: () => toast(`Repair done: main pack ${Math.round(C.mainBatteryWh * C.repair.mainFraction)} Wh`),
      lights: () => toast(data ? "Headlights on" : "Headlights off"),
      stuck: () => {},
    };
    (map[name] || (() => {}))();
    if (sim.done) finish();
  }

  // What should the player do next? Derived from what's packed and what's done.
  function nextStep(h) {
    const T = terrain, [rim, wall, trap] = T.sites, has = (id) => loadout.includes(id);
    const ran = (id, site) => sim.runs.some((r) => r.id === id && r.site === site);
    const met = Sim.evaluate(sim).met, near = World.nearSite();
    let target = null;
    if (has("neutron") && !met.R1 && !ran("neutron", "rim")) target = rim;
    else if (has("neutron") && !met.R1 && !ran("neutron", "wall")) target = wall;
    else if (["ir", "drill"].some((id) => has(id) && !ran(id, "floor")) && T.trapReachable) target = trap;
    if (target) {
      if (near && near.id === target.id) return `You're at the <b>${target.label}</b>. Press <kbd>E</kbd> to run instruments.`;
      const dx = target.x - h.x, dy = target.y - h.y;
      let rel = Math.atan2(dx, dy) - h.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const arrow = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][(Math.round(rel / (Math.PI / 4)) + 8) % 8];
      return `Next: <b>${target.label}</b> · ${(Math.hypot(dx, dy) / 1000).toFixed(1)} km <span class="arrow">${arrow}</span>${target.id === "rim" ? " · amber pillar" : " · follow the blue beacons"}`;
    }
    if (sim.pending.length) {
      const d = Math.hypot(T.start.x - h.x, T.start.y - h.y) / 1000;
      return `Climb back toward the landing site (${d.toFixed(1)} km) until Earth is in view to upload ${sim.pending.length} result(s).`;
    }
    if (!T.trapReachable && !met.R2) return `No safe route reaches the cold trap at ${C.maxSlopeDeg}°. Finish what you can, then press <b>End mission</b>.`;
    return `Everything you can do is done. Press <b>End mission</b> for your report.`;
  }

  // One-time "Why?" cards during the drive.
  const shown = new Set();
  let explainTimer;
  function explain(k) {
    if (shown.has(k)) return;
    shown.add(k);
    $("#explain-t").textContent = C.learn[k].title;
    $("#explain-p").textContent = C.learn[k].text;
    $("#explain").hidden = false;
    clearTimeout(explainTimer);
    explainTimer = setTimeout(() => { $("#explain").hidden = true; }, 16000);
  }

  function onHud(h) {
    $("#h-next").innerHTML = nextStep(h);
    if (sim.flow && sim.flow.full && sim.flow.inW > sim.flow.outW && h.speedKmh > 0) explain("full");
    const cap = Sim.capacity(sim), pct = sim.stored / cap;
    if (pct < 0.2 && !lastLowWarn) { lastLowWarn = true; say(C.say.lowPower); }
    $("#h-batt").textContent = `${fmt(sim.stored)} / ${fmt(cap)} Wh`;
    $("#h-batt-bar").style.width = `${pct * 100}%`;
    $("#h-batt-wrap").classList.toggle("warn", pct < 0.2);
    const fl = sim.flow || { inW: 0, outW: 0 };
    $("#h-power").textContent = `+${Math.round(fl.inW)} W in · −${Math.round(fl.outW)} W out`;
    const net = fl.inW - fl.outW, tag = $("#h-flow");
    if (fl.full && net > 0) { tag.textContent = `FULL · wasting ${Math.round(net)} W`; tag.className = "flow full"; }
    else if (net >= 0) { tag.textContent = "CHARGING"; tag.className = "flow charge"; }
    else { tag.textContent = "DRAINING"; tag.className = "flow drain"; }
    $("#h-slope").textContent = `${Math.abs(h.slope).toFixed(0)}°`;
    $("#h-slope").className = Math.abs(h.slope) > C.maxSlopeDeg * 0.8 ? "bad" : "";
    $("#h-signal").textContent = h.signal ? "EARTH ▮▮▮" : "NO SIGNAL";
    $("#h-signal").className = h.signal ? "" : "bad";
    $("#h-shadow").hidden = !h.shadow;
    $("#h-lights").textContent = h.lights ? "ON" : "OFF";
    $("#h-time").textContent = `${sim.timeH.toFixed(1)} h · ${sim.distanceKm.toFixed(1)} km`;
    const ev = Sim.evaluate(sim);
    $("#h-reqs").innerHTML = C.requirements.map((r) => `<li class="${ev.met[r.id] ? "ok" : ""}">${ev.met[r.id] ? "✓" : "○"} ${r.id} ${r.title}</li>`).join("")
      + (sim.pending.length ? `<li class="bad">⏳ ${sim.pending.length} result(s) waiting for signal</li>` : "");
    $("#h-score").textContent = ev.score;
    drawRover(h);
  }

  function openSite(site) {
    World.setPaused(true);
    siteOpen = site;
    const done = (id) => sim.runs.some((r) => r.id === id && r.site === site.id);
    const ids = loadout.filter((id) => item(id).kind === "instrument");
    setPanel(`
      <div class="eyebrow">${site.label.toUpperCase()}</div>
      <h2>Run instruments</h2>
      <p class="muted small">Battery ${fmt(sim.stored)} Wh. ${sim.signal ? "Earth in view: results upload immediately." : "No signal: results are stored until you climb back into view of Earth."}</p>
      <div class="items">${ids.map((id) => {
        const it = item(id), pts = Math.round(it.points[site.kind] * (site.kind === "floor" && (id === "ir" || id === "drill") ? sim.facts.iceFactor : 1));
        const floor = site.kind === "floor", r1Done = Sim.evaluate(sim).met.R1;
        const tag = id === "neutron" ? (r1Done ? "R1 already done; bonus points only" : "counts toward R1 (needs 2 sites)")
          : id === "ir" ? (floor ? "meets R2" : "no requirement here; R2 needs the cold trap")
          : id === "drill" ? (floor ? "meets R2 and R3" : "no requirement here; R3 needs the cold trap")
          : "bonus points only";
        const useful = !done(id) && ((id === "neutron" && !r1Done) || (floor && (id === "ir" || id === "drill")));
        return `<label class="card run ${done(id) ? "on" : ""}"><input type="checkbox" value="${id}" ${done(id) ? "disabled" : useful ? "checked" : ""}>
          <div><b>${it.name}</b> <span class="card-stats">${it.energy} Wh · +${pts} pts${done(id) ? " · done" : ""}</span>
          <div class="tag ${useful ? "good" : "muted"}">${tag}</div></div></label>`;
      }).join("")}</div>
      <p class="muted small">Pre-checked: the instruments that move a requirement forward here.</p>
      <div class="btn-row"><button class="btn" data-act="closeSite">Leave</button><button class="btn primary" data-act="runSite">Run selected</button></div>`);
  }

  function runSite() {
    if (!siteOpen) return;
    const ids = [...document.querySelectorAll("#panel input[type=checkbox]:checked")].map((c) => c.value);
    const events = Sim.runScience(sim, siteOpen, ids);
    if (events.includes("noPower")) return say("Not enough power for all of that.");
    if (events.includes("ice")) say(C.say.ice); else if (events.includes("iceIR")) say(C.say.iceIR);
    if (ids.length) toast(`Ran ${ids.map((id) => item(id).short).join(" + ")}`);
    closeSite();
    if (events.includes("failure")) openFailure();
    if (sim.done) finish();
  }

  function closeSite() { siteOpen = null; hidePanel(); World.setPaused(false); }

  function openFailure() {
    World.setPaused(true);
    document.body.classList.add("alarm");
    setTimeout(() => document.body.classList.remove("alarm"), 1600);
    const opts = [`<button class="btn primary" data-act="respond" data-id="ration">${sim.backupCap ? "Route power through the backup" : "Ration power and carry on"}</button>`];
    if (loadout.includes("kit")) opts.push(`<button class="btn" data-act="respond" data-id="repair">Repair: ${C.repair.hours} hours, main pack back to ${fmt(C.mainBatteryWh * C.repair.mainFraction)} Wh</button>`);
    setPanel(`<div class="alert"><div class="eyebrow">⚠ BATTERY CELL FAULT</div>
      <h2>Main pack: ${fmt(C.mainBatteryWh)} → ${fmt(sim.mainCap)} Wh</h2>
      <p>Battery now ${fmt(sim.stored)} / ${fmt(Sim.capacity(sim))} Wh. Remember the climb back out.</p>${opts.join("")}</div>`);
    say(C.say.failure, { cap: fmt(sim.mainCap) });
    setTimeout(() => say(sim.backupCap ? C.say.failBackup : loadout.includes("kit") ? C.say.failKit : C.say.failNone), 2500);
  }

  function endMission() {
    if (!sim.done) Sim.end(sim, "ended");
    finish();
  }

  function finish() {
    if (finish.lock) return;
    finish.lock = true;
    World.setPaused(true);
    if (sim.stuck) say(C.say.stuck);
    setTimeout(() => { finish.lock = false; debrief(); }, sim.stuck ? 2200 : 300);
  }

  function debrief() {
    World.stop();
    World.preview(terrain);
    $("#hud").hidden = true;
    const r = Sim.evaluate(sim), t = C.tiers[r.tier], u = sim.used;
    const total = Object.values(u).reduce((a, b) => a + b, 0);
    const row = (label, v, cls) => `<div class="stat-row"><span><i class="dot ${cls}"></i>${label}</span><b>${fmt(v)} Wh (${Math.round((v / total) * 100)}%)</b></div>`;
    setPanel(`
      <div class="eyebrow">MISSION REPORT · ${terrain.meta.name.toUpperCase()}</div>
      <h1 class="tier tier-${r.tier}">${t.label}</h1>
      <p class="lead">${sim.stuck ? "LUMI ran out of power in the crater. " : ""}${t.line}</p>
      <div class="scoreline"><span>Science returned <b>${r.score}</b></span>${r.lostPoints ? `<span class="bad">Never reached Earth: ${r.lostPoints}</span>` : ""}</div>
      <h3>Requirements check</h3>
      <div class="verify">${C.requirements.map((q) => `<div class="v ${r.met[q.id] ? "ok" : "no"}"><span class="mark">${r.met[q.id] ? "✓" : "✗"}</span>
        <div><b>${q.id} ${q.title}</b><br><span class="muted">${r.why[q.id]}</span></div></div>`).join("")}</div>
      <h3>Where the energy went</h3>
      ${row("Rolling", u.drive, "drive")}${row("Climbing", u.climb, "climb")}${row("Heaters", u.heaters, "heat")}${row("Headlights", u.lights, "house")}${row("Systems", u.systems, "house")}${row("Science", u.science, "inst")}
      <div class="stat-row"><span>☀ Solar collected</span><b>+${fmt(sim.solarWh)} Wh</b></div>
      ${sim.wastedWh > 1 ? `<div class="stat-row warnline"><span>☀ Sunlight wasted (battery already full)</span><b>${fmt(sim.wastedWh)} Wh</b></div>` : ""}
      <h3>Trip</h3>
      <ul class="events">
        <li>Packed ${loadout.map((id) => item(id).short).join(", ")} (${Sim.massKg(loadout)} kg rover)</li>
        <li>${sim.distanceKm.toFixed(1)} km driven, ${fmt(sim.climbedM)} m climbed, steepest slope ${sim.maxSlopeSeen.toFixed(0)}°, ${sim.timeH.toFixed(1)} mission hours</li>
        <li>${sim.failed ? `Battery failed ${sim.failureTrigger === "shadow" ? "on entering the shadow" : "during the first science run"}; you ${sim.response === "repair" ? "repaired it" : sim.backupCap ? "switched to the backup" : "rationed"}.` : "The battery never failed this time."}</li>
      </ul>
      <div class="btn-row"><button class="btn primary" data-act="launch">Fly again</button><button class="btn" data-act="toLoadout">Change payload</button><button class="btn" data-act="pick">Another crater</button></div>`, "center wide");
  }

  // ---------- maps (minimap + full map share one renderer) ----------
  const mapBase = {};
  function baseImage(S, withSignal) {
    const key = `${S}-${withSignal}`;
    if (mapBase[key]) return mapBase[key];
    const T = terrain, n = T.n, g = document.createElement("canvas").getContext("2d");
    const img = g.createImageData(S, S);
    let lo = Infinity, hi = -Infinity;
    for (const v of T.h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = -T.half + (px / S) * 2 * T.half, y = T.half - (py / S) * 2 * T.half;
      const z = Terrain.heightAt(T, x, y), t = (z - lo) / (hi - lo);
      // Hillshade from the north-west so slopes read as relief.
      const e = T.cell, shade = Math.max(0.55, Math.min(1.35, 1 + (Terrain.heightAt(T, x - e, y + e) - Terrain.heightAt(T, x + e, y - e)) / (e * 0.9)));
      const v = (40 + t * 150) * shade;
      let c = Terrain.litAt(T, x, y) === 0 ? [v * 0.35, v * 0.45, v * 0.85] : [v, v, v * 0.95];
      if (withSignal && !Terrain.signalAt(T, x, y) && (px + py) % 6 < 2) c = [255, 110, 110];
      img.data.set([...c, 255], (py * S + px) * 4);
    }
    return (mapBase[key] = img);
  }

  function drawMap(cv, h, big) {
    const g = cv.getContext("2d"), T = terrain, S = cv.width;
    g.putImageData(baseImage(S, big && $("#bigmap-signal").checked), 0, 0);
    const toPx = (x, y) => [((x + T.half) / (2 * T.half)) * S, (1 - (y + T.half) / (2 * T.half)) * S];
    const k = S / 180; // scale marks with the canvas size
    g.strokeStyle = "#6fe3ff"; g.lineWidth = 1.5 * k; g.setLineDash([4 * k, 3 * k]);
    g.beginPath(); T.path.forEach((p, i) => { const [x, y] = toPx(p.x, p.y); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.setLineDash([]);
    T.sites.forEach((s) => {
      const [x, y] = toPx(s.x, s.y);
      g.strokeStyle = s.kind === "floor" ? "#6fe3ff" : "#ffb547"; g.lineWidth = 2 * k;
      g.beginPath(); g.arc(x, y, 5 * k, 0, 7); g.stroke();
      if (big) { g.fillStyle = "#fff"; g.font = `${5 * k}px system-ui`; g.fillText(s.label, x + 7 * k, y - 4 * k); }
    });
    const [sx, sy] = toPx(T.start.x, T.start.y);
    g.fillStyle = "#ffb547"; g.fillRect(sx - 3 * k, sy - 3 * k, 6 * k, 6 * k);
    if (big) {
      g.fillStyle = "#fff"; g.font = `${5 * k}px system-ui`; g.fillText("Landing site", sx + 6 * k, sy + 10 * k);
      // Scale bar and Earth direction.
      const km = T.half * 2 / 1000, barKm = km > 60 ? 20 : km > 25 ? 10 : 5, barPx = (barKm / km) * S;
      g.fillStyle = "#fff"; g.fillRect(14 * k, S - 14 * k, barPx, 2 * k);
      g.font = `${5 * k}px ui-monospace, monospace`; g.fillText(`${barKm} km`, 14 * k, S - 18 * k);
      g.fillText("↑ toward Earth (longitude 0°)", S / 2 - 40 * k, 10 * k);
    }
    const [rx, ry] = toPx(h.x, h.y);
    g.save(); g.translate(rx, ry); g.rotate(h.heading);
    g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -7 * k); g.lineTo(5 * k, 5 * k); g.lineTo(-5 * k, 5 * k); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  let lastHud = null;
  function drawMinimap() { Object.keys(mapBase).forEach((key) => delete mapBase[key]); }
  function drawRover(h) { lastHud = h; drawMap($("#minimap"), h, false); }

  function openMap() {
    if ($("#hud").hidden || !lastHud) return;
    World.setPaused(true);
    $("#bigmap").hidden = false;
    $("#bigmap-name").textContent = terrain.meta.name.toUpperCase();
    redrawBigMap();
  }
  function redrawBigMap() {
    drawMap($("#bigmap-canvas"), lastHud, true);
    const p = lastHud;
    $("#bigmap-dist").innerHTML = [{ label: "Landing site", x: terrain.start.x, y: terrain.start.y }, ...terrain.sites]
      .map((s) => `<div><span>${s.label}</span><b>${(Math.hypot(s.x - p.x, s.y - p.y) / 1000).toFixed(1)} km</b></div>`).join("");
  }
  function closeMap() {
    if ($("#bigmap").hidden) return;
    $("#bigmap").hidden = true;
    if ($("#panel").hidden && !sim.failurePending) World.setPaused(false);
  }

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- wiring ----------
  function start() {
    World.init($("#world"));
    $("#lumi-name").textContent = C.roverName;
    // Start with a slow orbit over Shackleton behind the title.
    terrain = getTerrain(CRATER_DATA[0]);
    World.preview(terrain);
    const panel = $("#panel");
    panel.addEventListener("click", (e) => {
      const t = e.target.closest("[data-act]");
      if (!t || t.disabled || t.tagName === "INPUT") return;
      const id = t.dataset.id;
      ({
        briefing,
        pick: () => { $("#loading").hidden = false; setTimeout(() => { pick(craterChoice === "custom" ? "custom" : craterChoice && craterChoice.id); $("#loading").hidden = true; }, 30); },
        crater: () => selectCrater(id),
        toLoadout: loadoutScreen, toggle: () => toggle(id), launch,
        closeSite, runSite,
        respond: () => { Sim.respond(sim, id); hidePanel(); World.setPaused(false); if (id === "repair") say("Swapping cells. Three hours."); },
      })[t.dataset.act]?.();
    });
    panel.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.act === "maxslope") { C.maxSlopeDeg = +t.value; $("#maxslope-v").textContent = `${t.value}°`; }
      if (t.dataset.act === "custom") { customParams[t.dataset.id] = +t.value; t.previousElementSibling.textContent = `${t.value} ${{ diameterKm: "km", depthKm: "km", wallSlopeDeg: "°", floorTempK: "K", icePct: "%" }[t.dataset.id]}`; }
    });
    panel.addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.act === "maxslope") {
        Object.keys(terrainCache).forEach((k) => delete terrainCache[k]);
        $("#loading").hidden = false;
        setTimeout(() => {
          const id = craterChoice === "custom" ? "custom" : craterChoice && craterChoice.id;
          if (id) { terrain = getTerrain(craterChoice); World.preview(terrain); }
          pick(id);
          $("#loading").hidden = true;
        }, 30);
      }
      if (t.dataset.act === "custom") selectCrater("custom");
    });
    $("#btn-end").addEventListener("click", endMission);
    $("#btn-map").addEventListener("click", openMap);
    $("#minimap").addEventListener("click", openMap);
    $("#bigmap-close").addEventListener("click", closeMap);
    $("#explain-x").addEventListener("click", () => { $("#explain").hidden = true; });
    $("#bigmap-signal").addEventListener("change", redrawBigMap);
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM" && !$("#hud").hidden) $("#bigmap").hidden ? openMap() : closeMap();
      if (e.code === "Escape") closeMap();
    });
    $("#btn-lights").addEventListener("click", () => World.toggleLights());
    $("#btn-cam").addEventListener("click", () => World.toggleCamera());
    $("#btn-site").addEventListener("click", () => { const s = World.nearSite(); if (s) openSite(s); });
    document.querySelectorAll("[data-touch]").forEach((b) => {
      const k = b.dataset.touch;
      const on = (e) => { e.preventDefault(); World.setTouch(k, true); }, off = () => World.setTouch(k, false);
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off);
    });
    title();
  }

  return { start };
})();
