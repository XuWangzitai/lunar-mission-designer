// Demo mode (?demo=1): plays one scripted mission with captions so the 30-second
// video can be recorded in a single take. It drives the real game through its own
// buttons; only the battery-fault timing and a time-lapse speed are fixed.

/* global CONFIG, World */
const C = CONFIG;
C.demo = true;
C.forceFailure = "shadow";

const SPEED = 7;              // time-lapse while driving
const CRATER = "faustini";    // shortest route of the six
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = performance.now();
const marks = [];
const mark = (label) => marks.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${label}`);
window.__demo = { marks, done: false };

// Caption bar and end card, styled like the rest of the HUD.
const style = document.createElement("style");
style.textContent = `
  body.demo { cursor: none; }
  body.demo .explain, body.demo .keys, body.demo .touchpad { display: none !important; }
  #demo-cap { position: fixed; left: 50%; bottom: 7vh; transform: translateX(-50%); z-index: 20; max-width: 80vw;
    padding: 14px 28px; background: rgba(0,0,0,.85); border: 1px solid rgba(255,255,255,.55); color: #f4f4f2;
    font: 600 26px/1.3 Barlow, sans-serif; letter-spacing: .06em; text-transform: uppercase; text-align: center;
    transition: opacity .25s; }
  #demo-cap[hidden] { display: block; opacity: 0; }
  #demo-lapse { position: fixed; right: 24px; bottom: 24px; z-index: 20; padding: 4px 10px; border: 1px solid rgba(255,255,255,.5);
    color: #f4f4f2; font: 600 12px Barlow, sans-serif; letter-spacing: .2em; }
  #demo-end { position: fixed; inset: 0; z-index: 30; display: grid; place-content: center; text-align: center; background: #000;
    color: #f4f4f2; font-family: Barlow, sans-serif; opacity: 0; transition: opacity .6s; }
  #demo-end.on { opacity: 1; }
  #demo-end h1 { font-size: 64px; font-weight: 500; letter-spacing: .05em; margin: 0 0 18px; }
  #demo-end p { font-size: 22px; letter-spacing: .08em; margin: 6px 0; color: #a4a7ab; }
  #demo-end b { color: #f4f4f2; font-weight: 500; }`;
document.head.appendChild(style);
document.body.classList.add("demo");
const cap = Object.assign(document.createElement("div"), { id: "demo-cap", hidden: true });
const lapse = Object.assign(document.createElement("div"), { id: "demo-lapse", hidden: true,
  textContent: `TIME-LAPSE · 1 S = ${Math.round((C.timeScale * SPEED) / 60)} MIN` });
document.body.append(cap, lapse);

function caption(text) {
  if (!text) { cap.hidden = true; return; }
  cap.textContent = text;
  cap.hidden = false;
  mark(`caption: ${text}`);
}

async function until(test, timeoutMs = 20000) {
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) { if (test()) return true; await wait(50); }
  return false;
}
const click = async (sel) => { await until(() => $(sel), 8000); const e = $(sel); if (e) e.click(); return !!e; };

async function answerFault() {
  const b = $("#panel:not([hidden]) [data-act=respond]");
  if (!b) return false;
  caption("Then something breaks: the main battery fails");
  await wait(1800);
  b.click();
  await wait(400);
  return true;
}

async function driveTo(x, y, tolerance = 220) {
  World.setTouch("touchUp", true);
  const end = performance.now() + 40000;
  while (performance.now() < end) {
    if (await answerFault()) { World.setTouch("touchUp", true); caption("The backup battery keeps us going"); }
    const p = World.position();
    if (Math.hypot(p.x - x, p.y - y) < tolerance) break;
    World.aim(x, y);
    await wait(30);
  }
  World.setTouch("touchUp", false);
}

async function runAt(ids, hold = 1800) {
  await click("#btn-site");
  await wait(300);
  document.querySelectorAll("#panel input[type=checkbox]").forEach((c) => { c.checked = ids.includes(c.value); });
  await wait(250);
  await click("#panel [data-act=runSite]");
  await wait(hold);
  await click("#panel [data-act=siteDone]");
  await wait(300);
  await answerFault();
}

async function play() {
  await until(() => $("[data-act=briefing]"));
  await wait(400);
  mark("start");

  // 1. Title over the real Shackleton terrain.
  caption("Real lunar craters, built from NASA LRO laser-altimeter data");
  await wait(2600);

  // 2. Crater picker.
  await click("[data-act=briefing]");
  await click("[data-act=pick]");
  await until(() => $(`[data-act=crater][data-id=${CRATER}]`));
  caption("Six real south-pole craters, measured from LOLA");
  const panel = $("#panel");
  panel.scrollTo({ top: panel.scrollHeight * 0.35, behavior: "smooth" });
  await wait(1000);
  await click(`[data-act=crater][data-id=${CRATER}]`);
  await wait(1100);

  // 3. The decision: backup battery or one more instrument.
  await click("[data-act=toLoadout]");
  await wait(300);
  caption("The choice: one more instrument, or a backup battery?");
  const showForecast = () => $(".forecast") && $(".forecast").scrollIntoView({ block: "center", behavior: "smooth" });
  await click("[data-act=toggle][data-id=backup]");
  await wait(150);
  await click("[data-act=toggle][data-id=ir]");
  await wait(200);
  showForecast();
  await wait(1500);
  await click("[data-act=toggle][data-id=ir]");
  await wait(150);
  await click("[data-act=toggle][data-id=backup]");
  await wait(200);
  showForecast();
  await wait(1300);

  // 4. Drive down into permanent shadow (time-lapse).
  C.timeScale *= SPEED;
  await click("[data-act=launch]");
  await wait(600);
  caption("Into permanent shadow: no sunlight, no signal, heaters on");
  lapse.hidden = false;
  const T = World.terrain();
  const path = T.path, mid = Math.floor(path.length / 2);
  for (const q of path.slice(1, mid + 1)) await driveTo(q.x, q.y);
  lapse.hidden = true;
  await runAt(["neutron"], 700);

  lapse.hidden = false;
  caption("The backup battery keeps us going");
  for (const q of path.slice(mid + 1)) await driveTo(q.x, q.y);
  lapse.hidden = true;

  // 5. Drill the cold trap.
  caption("Drill the cold trap");
  await runAt(["neutron", "drill"], 1800);

  // 6. Climb back into view of Earth (climbing costs m·g·h).
  caption("Climb out until Earth is in view to send the data home");
  lapse.hidden = false;
  for (const q of path.slice(0, -1).reverse()) {
    await driveTo(q.x, q.y);
    if (!$("#h-next").textContent.startsWith("Climb")) break;
  }
  lapse.hidden = true;
  await wait(300);

  // 7. Mission report.
  await click("#btn-end");
  await until(() => $(".tier"), 6000);
  caption("Every result traced back to the decisions that caused it");
  await wait(2700);

  // 8. End card.
  caption("");
  const end = document.createElement("div");
  end.id = "demo-end";
  end.innerHTML = `<h1>LUNAR MISSION DESIGNER</h1>
    <p>Play free: <b>xuwangzitai.github.io/lunar-mission-designer</b></p>
    <p>Team thegoatthox · NASA Space Apps Challenge 2026</p>`;
  document.body.appendChild(end);
  requestAnimationFrame(() => end.classList.add("on"));
  mark("end card");
  await wait(2400);
  mark("done");
  window.__demo.done = true;
}

play().catch((e) => { mark("ERROR " + e.message); window.__demo.done = true; });
