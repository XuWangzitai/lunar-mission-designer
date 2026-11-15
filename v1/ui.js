// Screens, HUD and the rover's voice. Reads rules from Game, draws through Scene.

const UI = (() => {
  const C = CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const item = Game.item;

  let loadout = [];
  let game = null;
  let selected = [];
  let heatersOff = false;
  let maxCap = C.mainBattery;

  // ---------- rover speech (typewriter, queued) ----------
  let sayToken = 0;
  function say(lines) {
    const queue = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    const token = ++sayToken;
    const el = $("#lumi-text");
    const next = () => {
      if (token !== sayToken || !queue.length) return;
      const line = queue.shift();
      let i = 0;
      el.textContent = "";
      const tick = setInterval(() => {
        if (token !== sayToken) return clearInterval(tick);
        el.textContent = line.slice(0, ++i);
        if (i >= line.length) { clearInterval(tick); setTimeout(next, 1600); }
      }, 16);
    };
    next();
  }

  // ---------- helpers ----------
  const power = () => (game ? game.stored / maxCap : 1);
  const has = (id) => loadout.includes(id);
  const instruments = () => loadout.filter((id) => item(id).kind === "instrument");

  function setPanel(html, mode = "side") {
    const p = $("#panel");
    p.className = "panel panel-" + mode;
    p.innerHTML = html;
    p.scrollTop = 0;
  }

  function loadBest() { try { return JSON.parse(localStorage.getItem("lmd-best")) || null; } catch { return null; } }
  function saveBest(b) { try { localStorage.setItem("lmd-best", JSON.stringify(b)); } catch { /* storage blocked: fine */ } }

  // shown: which shift the HUD describes (defaults to the current one).
  function hud(shown) {
    const top = $("#hud-top");
    if (!game) {
      top.innerHTML = `<span class="rec">● CAM-1</span><span class="hud-title">${C.missionName}</span>`;
      return;
    }
    const n = shown || Math.min(game.shift, C.shifts.length);
    const d = Game.shiftDef(n);
    const cap = Game.capacity(game);
    const pct = (v) => Math.round((v / maxCap) * 100);
    top.innerHTML = `
      <span class="rec">● CAM-1</span>
      <span class="hud-item">SHIFT <b>${n}/${C.shifts.length}</b> ${d.title.toUpperCase()}</span>
      <span class="hud-item">SUN <b>${d.solar ? "+" + d.solar + " Wh" : "NONE"}</b></span>
      <span class="hud-item battery ${power() < 0.25 ? "warn" : ""} ${game.failed ? "cracked" : ""}">
        BATTERY <b>${game.stored}/${cap} Wh</b>
        <span class="gauge"><span class="cap" style="width:${pct(cap)}%"></span><span class="fill" style="width:${pct(game.stored)}%"></span></span>
      </span>
      <span class="hud-item">SCIENCE <b>${game.score}</b></span>`;
  }

  // ---------- screens ----------
  function title() {
    game = null;
    Scene.show("rim", { sun: 0.55 });
    hud();
    setPanel(`
      <h1>Lunar Mission Designer</h1>
      <p class="lead">Design a robotic rover mission to the lunar south pole. Choose what to pack, survive what goes wrong, and find out whether there is ice in the dark.</p>
      <button class="btn primary" data-act="briefing">Start mission</button>
      <p class="fine">Game values are fictional and chosen for balance. Not affiliated with or endorsed by NASA.</p>`, "center");
    say(C.say.title);
  }

  function briefing() {
    Scene.show("rim", { sun: 0.3, edge: true });
    setPanel(`
      <div class="eyebrow">MISSION BRIEFING · ${C.missionName.toUpperCase()}</div>
      <h2>Is there water ice in the shadowed crater?</h2>
      <p>Craters near the lunar poles have floors that never see the Sun. They are some of the coldest places in the solar system, cold enough to trap water ice. You'll pack ${C.roverName}, drive along the rim, then descend into the dark.</p>
      <div class="reqs">
        ${C.requirements.map((r) => `<div class="req"><span class="req-id">${r.id}</span><div><b>${r.title}</b><br>${r.text}</div></div>`).join("")}
      </div>
      <div class="timeline">
        ${C.shifts.map((s) => `<div class="tl ${s.place}"><span>S${s.n}</span>${s.title}<em>${s.solar ? "sunlit" : "no sun"}</em></div>`).join("")}
      </div>
      <button class="btn primary" data-act="loadout">Pack the rover</button>`, "center");
    say(C.say.briefing);
  }

  function loadoutScreen() {
    game = null;
    hud();
    Scene.show("deck", { packed: loadout });
    const mass = Game.loadoutMass(loadout);
    const cap = C.mainBattery + (has("backup") ? C.backupBattery : 0);
    const craterInfo = C.revealCraterNeedsAtLoadout
      ? `Crater floor: no sun, systems and heaters need ${C.shifts[2].housekeeping} Wh.`
      : `Crater floor: no direct sunlight expected. Exact conditions unknown.`;
    setPanel(`
      <div class="eyebrow">PAYLOAD DECK</div>
      <div class="meter">
        <div class="meter-label"><span>MASS</span><b>${mass} / ${C.massLimit} kg</b></div>
        <div class="bar"><span style="width:${(mass / C.massLimit) * 100}%"></span></div>
      </div>
      <div class="stat-row"><span>Battery storage</span><b>${cap} Wh</b></div>
      <div class="stat-row"><span>Solar per sunlit shift</span><b>${C.shifts[0].solar} Wh</b></div>
      <div class="hint">🛰 Orbital data: ${craterInfo}</div>
      <div class="items">
        ${C.items.map((it) => {
          const on = has(it.id);
          const tooHeavy = !on && mass + it.mass > C.massLimit;
          const stats = it.kind === "instrument"
            ? `${it.mass} kg · ${it.energy} Wh/shift · ${it.points.rim} pts rim / ${it.points.crater} crater`
            : `${it.mass} kg · support`;
          return `<button class="card ${on ? "on" : ""} ${tooHeavy ? "heavy" : ""}" data-act="toggle" data-id="${it.id}">
            <div class="card-top"><b>${it.name}</b><span class="chk">${on ? "PACKED" : tooHeavy ? "TOO HEAVY" : "+"}</span></div>
            <div class="card-stats">${stats}${it.helps.length ? ` · <i>${it.helps.join(", ")}</i>` : ""}</div>
            <div class="card-what">${it.what}</div>
            <div class="card-why">${it.why}</div>
          </button>`;
        }).join("")}
      </div>
      <button class="btn primary" data-act="launch" ${loadout.length ? "" : "disabled"}>Launch</button>`);
  }

  function toggle(id) {
    if (has(id)) loadout = loadout.filter((x) => x !== id);
    else if (Game.loadoutMass(loadout) + item(id).mass > C.massLimit) { say(C.say.overMass); return; }
    else loadout = [...loadout, id];
    loadoutScreen();
  }

  function launch() {
    game = Game.create(loadout);
    maxCap = Game.capacity(game);
    say([has("backup") ? C.say.withBackup : C.say.noBackup, C.say.launch]);
    Scene.drive();
    setPanel(`<div class="eyebrow">DESCENT</div><h2>Landing…</h2>`, "center");
    setTimeout(enterShift, 1400);
  }

  function shiftScene(executing) {
    const d = Game.shiftDef(game.shift);
    if (d.place === "crater" && C.commsBlackout && !executing) Scene.show("rim", { sun: C.shifts[1].sun, edge: true, power: power() });
    else if (d.place === "crater") Scene.show("crater", { power: power() });
    else Scene.show("rim", { sun: d.sun, edge: d.n === 2, power: power() });
  }

  function shiftLine() {
    if (Game.isLost(game)) return C.say.lostShift;
    if (Game.isRepairing(game)) return C.say.repairing;
    const d = Game.shiftDef(game.shift);
    if (d.place === "crater") return C.commsBlackout ? C.say.uplink : C.say.crater;
    return [C.say.shift1, C.say.shift2, null, C.say.shift4][game.shift - 1];
  }

  function enterShift() {
    if (game.done) return debrief();
    selected = [];
    heatersOff = false;
    const fired = Game.startShift(game);
    shiftScene(false);
    hud();
    if (fired) {
      Scene.play("static");
      document.body.classList.add("alarm");
      setTimeout(() => document.body.classList.remove("alarm"), 1600);
      failurePanel();
      say([C.say.failure, game.backupCap ? C.say.failBackup : has("kit") ? C.say.failKit : C.say.failNone]);
      return;
    }
    planPanel();
    say(shiftLine());
    if (power() < 0.25) setTimeout(() => say(C.say.lowPower), 4000);
  }

  function failurePanel() {
    setPanel(`
      <div class="alert">
        <div class="eyebrow">⚠ BATTERY CELL FAULT · SHIFT ${game.shift}</div>
        <h2>Main battery: ${C.mainBattery} → ${C.failure.newMainCapacity} Wh</h2>
        <p>A cell shorted. The main pack now holds at most ${C.failure.newMainCapacity} Wh.
        ${game.lostToFailure ? `${game.lostToFailure} Wh of stored energy was lost.` : ""}
        ${game.backupCap ? `Your backup battery adds ${game.backupCap} Wh. Total storage: ${Game.capacity(game)} Wh.` : ""}</p>
        ${Game.responses(game).map((r) => `<button class="btn ${r.id === "repair" ? "" : "primary"}" data-act="respond" data-id="${r.id}">${r.label}</button>`).join("")}
      </div>`);
  }

  function planPanel() {
    const d = Game.shiftDef(game.shift);
    const crater = d.place === "crater";
    const uplink = crater && C.commsBlackout;
    const b = Game.budget(game, heatersOff);
    const spent = Game.cost(selected);
    const cap = Game.capacity(game);
    const leftover = b.available - b.housekeeping - spent;
    const after = Math.min(cap, leftover);
    const wasted = Math.max(0, leftover - cap);
    const work = Game.canWork(game);
    const pct = (v) => Math.max(0, (v / b.available) * 100);

    const rows = instruments().map((id) => {
      const it = item(id);
      const on = selected.includes(id);
      const fits = on || Game.cost([...selected, id]) <= b.forInstruments;
      const reason = !work ? "" : fits ? "" : `needs ${it.energy} Wh, ${b.forInstruments - spent} left`;
      return `<button class="card run ${on ? "on" : ""}" data-act="run" data-id="${id}" ${work && fits ? "" : "disabled"}>
        <div class="card-top"><b>${it.name}</b><span class="chk">${on ? "ON" : "OFF"}</span></div>
        <div class="card-stats">${it.energy} Wh · +${Game.pointsFor(id, d.place)} pts${reason ? ` · <span class="bad">${reason}</span>` : ""}</div>
      </button>`;
    }).join("") || `<p class="muted">No instruments packed.</p>`;

    const blocked = Game.isLost(game)
      ? `<div class="alert soft">${C.roverName} is thawing out after running without heaters. No work this shift.</div>`
      : Game.isRepairing(game)
        ? `<div class="alert soft">${C.roverName} is swapping battery cells this shift. Main pack returns at ${C.repairMainCapacity} Wh.</div>`
        : "";

    setPanel(`
      <div class="eyebrow">${uplink ? "📡 UPLINK WINDOW · LAST CONTACT BEFORE THE CRATER" : `SHIFT ${d.n} · ${d.title.toUpperCase()}`}</div>
      <h2>${uplink ? "Plan the crater run" : work ? "Choose instruments" : "Stand by"}</h2>
      ${uplink ? `<p class="muted">Once ${C.roverName} drops below the rim, Earth is hidden behind the crater wall. These orders can't be changed.</p>` : ""}
      ${blocked}
      <div class="budget">
        <div class="stack">
          <span class="seg house" style="width:${pct(b.housekeeping)}%"></span>
          <span class="seg inst" style="width:${pct(spent)}%"></span>
          <span class="seg left" style="width:${pct(Math.max(0, leftover))}%"></span>
        </div>
        <div class="stat-row"><span>Stored + sun</span><b>${game.stored} + ${b.solar} = ${b.available} Wh</b></div>
        <div class="stat-row"><span><i class="dot house"></i>Systems${crater ? " + heaters" : ""}</span><b>−${b.housekeeping} Wh</b></div>
        <div class="stat-row"><span><i class="dot inst"></i>Instruments</span><b>−${spent} Wh</b></div>
        <div class="stat-row"><span><i class="dot left"></i>Battery after shift</span><b>${after} / ${cap} Wh</b></div>
        ${wasted ? `<div class="stat-row warnline"><span>☀ Sunlight wasted (battery full)</span><b>${wasted} Wh</b></div>` : ""}
      </div>
      <div class="items">${work ? rows : ""}</div>
      ${crater && work ? `<label class="toggle"><input type="checkbox" data-act="heaters" ${heatersOff ? "checked" : ""}>
        <span><b>Turn heaters off</b> (saves ${C.heatersOffSaving} Wh, but ${C.roverName} freezes and loses shift 4)</span></label>` : ""}
      <button class="btn primary" data-act="end">${!work ? "Continue" : uplink ? "Upload commands" : "End shift"}</button>`);
  }

  function toggleRun(id) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    planPanel();
  }

  function toggleHeaters(off) {
    heatersOff = off;
    if (!Game.canAfford(game, selected, heatersOff)) selected = [];
    if (off) say(C.say.heatersOff);
    planPanel();
  }

  function endShift() {
    const d = Game.shiftDef(game.shift);
    const crater = d.place === "crater";
    const beam = power(); // headlights while working, before the shift drains the battery
    const log = Game.endShift(game, selected, heatersOff);
    const lines = [];
    if (crater) { lines.push(C.say.crater + (C.commsBlackout ? " " + C.say.craterNoComms : "")); }

    const ice = crater && (log.ran.includes("drill") || log.ran.includes("ir"));
    if (crater) Scene.show("crater", { power: beam });
    log.ran.forEach((id, i) => setTimeout(() => Scene.play(id), 400 + i * 900));
    if (ice) {
      setTimeout(() => Scene.show("crater", { power: beam, ice: true }), 500 + log.ran.length * 900);
      lines.push(log.ran.includes("drill") ? C.say.iceDrill : C.say.iceIR);
    }
    hud(log.shift);
    resultPanel(log);
    if (lines.length) say(lines);
  }

  function resultPanel(log) {
    const names = log.ran.map((id) => item(id).short).join(" + ") || "nothing";
    const note = log.note === "lost" ? "Shift lost while thawing." : log.note === "repair" ? `Repair complete: main pack now ${C.repairMainCapacity} Wh.` : "";
    setPanel(`
      <div class="eyebrow">SHIFT ${log.shift} REPORT</div>
      <h2>+${log.points} science</h2>
      <div class="stat-row"><span>Ran</span><b>${names}</b></div>
      <div class="stat-row"><span>Energy used</span><b>${log.used} Wh</b></div>
      <div class="stat-row"><span>Battery</span><b>${log.stored} / ${log.cap} Wh</b></div>
      ${log.wasted ? `<div class="stat-row warnline"><span>Sunlight wasted</span><b>${log.wasted} Wh</b></div>` : ""}
      ${log.heatersOff ? `<div class="alert soft">Heaters were off. ${C.roverName} will lose shift ${log.shift + 1} warming up.</div>` : ""}
      ${note ? `<p class="muted">${note}</p>` : ""}
      <button class="btn primary" data-act="next">${game.done ? "Mission report" : "Drive to next site"}</button>`);
  }

  function next() {
    if (!game.done) Scene.drive();
    setTimeout(enterShift, game.done ? 0 : 700);
  }

  function debrief() {
    const r = Game.evaluate(game);
    const tier = C.tiers[r.tier];
    const best = loadBest();
    const isBest = !best || r.score > best.score;
    if (isBest) saveBest({ score: r.score, loadout });
    Scene.show("earth");
    hud();
    const resp = { ration: game.backupCap ? "routed power through the backup" : "rationed power", repair: "repaired the main pack" };
    setPanel(`
      <div class="eyebrow">MISSION REPORT · ${C.missionName.toUpperCase()}</div>
      <h1 class="tier tier-${r.tier}">${tier.label}</h1>
      <p class="lead">${tier.line}</p>
      <div class="scoreline"><span>Science score <b>${r.score}</b></span><span>${isBest ? "★ New best" : `Best ${best.score}`}</span></div>

      <h3>Requirements check</h3>
      <div class="verify">
        ${C.requirements.map((q) => `<div class="v ${r.met[q.id] ? "ok" : "no"}"><span class="mark">${r.met[q.id] ? "✓" : "✗"}</span>
          <div><b>${q.id} ${q.title}</b><br><span class="muted">${r.why[q.id]}</span></div></div>`).join("")}
      </div>

      <h3>What happened</h3>
      <ul class="events">
        <li>Packed: ${loadout.map((id) => item(id).short).join(", ")} (${Game.loadoutMass(loadout)} kg)</li>
        <li>Battery failed at the start of shift ${game.failureShift}; you ${resp[game.response] || "carried on"}.</li>
        ${game.log.map((l) => `<li>S${l.shift}: ${l.ran.map((id) => item(id).short).join(" + ") || (l.note === "lost" ? "lost (thawing)" : l.note === "repair" ? "repairing" : "no instruments")} → +${l.points}, battery ${l.stored}/${l.cap} Wh</li>`).join("")}
        ${r.wasted ? `<li>${r.wasted} Wh of sunlight was wasted because the battery was already full.</li>` : ""}
      </ul>

      ${r.leftBehind.length ? `<h3>Left on Earth</h3><p class="muted">${r.leftBehind.map((i) => `${i.name} (${i.mass} kg)`).join(", ")}</p>` : ""}

      <div class="btn-row">
        <button class="btn primary" data-act="again">Fly again, same payload</button>
        <button class="btn" data-act="loadout">Change payload</button>
      </div>
      <p class="fine">The battery failure strikes at a random time each flight, so the same payload can play out differently.</p>`, "center wide");
    say(C.say.debrief);
  }

  // ---------- wiring ----------
  function start() {
    Scene.init($("#scene"));
    $("#lumi-name").textContent = C.roverName;
    const panel = $("#panel");
    panel.addEventListener("click", (e) => {
      const t = e.target.closest("[data-act]");
      if (!t || t.disabled || t.tagName === "INPUT") return;
      const id = t.dataset.id;
      ({
        briefing, loadout: loadoutScreen, launch, next, end: endShift,
        toggle: () => toggle(id), run: () => toggleRun(id),
        respond: () => { Game.respond(game, id); hud(); planPanel(); say(shiftLine()); },
        again: launch,
      })[t.dataset.act]?.();
    });
    panel.addEventListener("change", (e) => {
      if (e.target.dataset.act === "heaters") toggleHeaters(e.target.checked);
    });
    title();
  }

  return { start };
})();
