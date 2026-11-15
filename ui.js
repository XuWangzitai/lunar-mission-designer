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
      <button class="btn primary" data-act="pick">Choose a crater</button>
      <p class="fine">Physics and crater data are real where marked; power and science values are game values. Not affiliated with or endorsed by NASA. <a href="v1/">Play v1 (2D)</a></p>`, "center");
    say("Hi, I'm LUMI. Let's go find some ice.");
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
    say(C.say.start);
    lastLowWarn = false;
  }

  function onEvent(name, data) {
    const map = {
      edge: () => say(C.say.edge, { slope: data, max: C.maxSlopeDeg }),
      tooSteepUp: () => say(C.say.tooSteepUp, { slope: data }),
      tooSteepDown: () => say(C.say.tooSteepDown, { slope: data }),
      creep: () => say(C.say.creep, { slope: data }),
      shadow: () => say(C.say.shadow),
      signalLost: () => say(C.say.signalLost),
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

  function onHud(h) {
    const cap = Sim.capacity(sim), pct = sim.stored / cap;
    if (pct < 0.2 && !lastLowWarn) { lastLowWarn = true; say(C.say.lowPower); }
    $("#h-batt").textContent = `${fmt(sim.stored)} / ${fmt(cap)} Wh`;
    $("#h-batt-bar").style.width = `${pct * 100}%`;
    $("#h-batt-wrap").classList.toggle("warn", pct < 0.2);
    $("#h-sun").textContent = h.lit > 0 ? `+${Math.round(C.solarPanelW * h.lit)} W` : "none";
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
        return `<label class="card run ${done(id) ? "on" : ""}"><input type="checkbox" value="${id}" ${done(id) ? "disabled" : ""}>
          <b>${it.name}</b> <span class="card-stats">${it.energy} Wh · +${pts} pts${done(id) ? " · done" : ""}</span></label>`;
      }).join("")}</div>
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
      <h3>Trip</h3>
      <ul class="events">
        <li>Packed ${loadout.map((id) => item(id).short).join(", ")} (${Sim.massKg(loadout)} kg rover)</li>
        <li>${sim.distanceKm.toFixed(1)} km driven, ${fmt(sim.climbedM)} m climbed, steepest slope ${sim.maxSlopeSeen.toFixed(0)}°, ${sim.timeH.toFixed(1)} mission hours</li>
        <li>${sim.failed ? `Battery failed ${sim.failureTrigger === "shadow" ? "on entering the shadow" : "during the first science run"}; you ${sim.response === "repair" ? "repaired it" : sim.backupCap ? "switched to the backup" : "rationed"}.` : "The battery never failed this time."}</li>
      </ul>
      <div class="btn-row"><button class="btn primary" data-act="launch">Fly again</button><button class="btn" data-act="toLoadout">Change payload</button><button class="btn" data-act="pick">Another crater</button></div>`, "center wide");
  }

  // ---------- minimap ----------
  let mini = null;
  function drawMinimap() {
    const cv = $("#minimap"), g = cv.getContext("2d"), T = terrain, n = T.n, S = cv.width;
    const img = g.createImageData(S, S);
    let lo = Infinity, hi = -Infinity;
    for (const v of T.h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const i = Math.floor((px / S) * n), j = n - 1 - Math.floor((py / S) * n), k = j * n + i;
      const t = (T.h[k] - lo) / (hi - lo), lit = T.lit[k];
      const v = 30 + t * 150;
      const o = (py * S + px) * 4;
      img.data.set(lit === 0 ? [v * 0.35, v * 0.45, v * 0.8, 255] : [v, v, v * 0.95, 255], o);
    }
    g.putImageData(img, 0, 0);
    mini = g.getImageData(0, 0, S, S);
  }
  function drawRover(h) {
    const cv = $("#minimap"), g = cv.getContext("2d"), T = terrain, S = cv.width;
    if (!mini) return;
    g.putImageData(mini, 0, 0);
    const toPx = (x, y) => [((x + T.half) / (2 * T.half)) * S, (1 - (y + T.half) / (2 * T.half)) * S];
    g.fillStyle = "#6fe3ff";
    T.beacons.forEach((b) => { const [x, y] = toPx(b.x, b.y); g.fillRect(x - 1, y - 1, 2, 2); });
    T.sites.forEach((s) => { const [x, y] = toPx(s.x, s.y); g.strokeStyle = s.kind === "floor" ? "#6fe3ff" : "#ffb547"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); });
    const [rx, ry] = toPx(h.x, h.y);
    g.save(); g.translate(rx, ry); g.rotate(h.heading);
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill();
    g.restore();
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
