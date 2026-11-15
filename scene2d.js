// 2D first-person camera feed, drawn as SVG. A future scene3d.js only needs
// to provide the same four functions: init, show, play, drive.

const Scene = (() => {
  const W = 1600, H = 900, HZ = 560; // HZ = horizon line
  let root, host, fxLayer;

  function seeded(seed) {
    let x = seed;
    return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const grey = (v, tint = 4) => { const c = Math.round(v); return `rgb(${c},${c},${c + tint})`; };

  function stars(n, maxY, seed) {
    const r = seeded(seed);
    let s = "";
    for (let i = 0; i < n; i++) {
      s += `<circle cx="${(r() * W) | 0}" cy="${(r() * maxY) | 0}" r="${(r() * 1.4 + 0.4).toFixed(1)}" fill="#fff" opacity="${(r() * 0.6 + 0.3).toFixed(2)}"/>`;
    }
    return s;
  }

  function earth(cx, cy, r) {
    return `
      <defs>
        <radialGradient id="earthG" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#9ad6ff"/><stop offset=".55" stop-color="#2f74cf"/><stop offset="1" stop-color="#0e2f66"/>
        </radialGradient>
        <clipPath id="earthClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${r * 1.25}" fill="#4aa3ff" opacity=".08"/>
      <g clip-path="url(#earthClip)">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#earthG)"/>
        <path d="M${cx - r * 0.7} ${cy - r * 0.25} q${r * 0.5} ${-r * 0.35} ${r * 1.1} ${-r * 0.05}" stroke="#fff" stroke-width="${r * 0.13}" fill="none" opacity=".75" stroke-linecap="round"/>
        <path d="M${cx - r * 0.4} ${cy + r * 0.35} q${r * 0.4} ${r * 0.2} ${r * 0.9} ${-r * 0.1}" stroke="#fff" stroke-width="${r * 0.1}" fill="none" opacity=".6" stroke-linecap="round"/>
        <path d="M${cx - r * 0.1} ${cy - r * 0.05} q${r * 0.3} ${r * 0.1} ${r * 0.25} ${r * 0.35}" stroke="#6b9d4f" stroke-width="${r * 0.18}" fill="none" opacity=".7" stroke-linecap="round"/>
        <circle cx="${cx + r * 0.75}" cy="${cy}" r="${r}" fill="#000" opacity=".6"/>
      </g>`;
  }

  // Crater rim, lit by a low sun. sun: 0 (set) to ~0.55 (as high as it gets here).
  function rim({ sun = 0.5, edge = false }) {
    const t = Math.min(1, sun / 0.55);
    const skyHz = `rgb(${lerp(8, 58, t) | 0},${lerp(8, 50, t) | 0},${lerp(12, 46, t) | 0})`;
    const sunY = HZ - 10 - sun * 220;
    const shadowLen = 90 + (1 - t) * 520;
    const rocks = [[520, 700, 40], [1080, 770, 64], [260, 830, 90], [1380, 680, 30], [760, 640, 20], [1240, 860, 110]];
    const cr = edge ? { y: 690, rx: 760 } : { y: 615, rx: 440 };

    const rockSvg = rocks.map(([x, y, rr]) => `
      <ellipse cx="${x + shadowLen / 2 + rr * 0.3}" cy="${y + rr * 0.28}" rx="${shadowLen / 2 + rr * 0.4}" ry="${rr * 0.32}" fill="#000" opacity=".8"/>
      <ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rr * 0.62}" fill="url(#rockG)"/>`).join("");

    return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000"/><stop offset=".7" stop-color="#020203"/><stop offset="1" stop-color="${skyHz}"/>
        </linearGradient>
        <radialGradient id="sunGlow"><stop offset="0" stop-color="#fff6dc" stop-opacity=".9"/><stop offset=".15" stop-color="#ffe9b0" stop-opacity=".35"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient>
        <linearGradient id="ridge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${grey(lerp(40, 165, t))}"/><stop offset="1" stop-color="${grey(lerp(14, 52, t))}"/>
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${grey(lerp(30, 120, t))}"/><stop offset="1" stop-color="${grey(lerp(8, 44, t))}"/>
        </linearGradient>
        <linearGradient id="rockG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${grey(lerp(60, 190, t))}"/><stop offset="1" stop-color="${grey(lerp(10, 40, t))}"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${HZ + 2}" fill="url(#sky)"/>
      ${stars(110, HZ - 40, 7)}
      ${earth(1250, HZ - 175, 36)}
      ${sun > 0 ? `<circle cx="250" cy="${sunY}" r="240" fill="url(#sunGlow)"/><circle cx="250" cy="${sunY}" r="20" fill="#fffaf0"/>` : ""}
      <polygon points="0,${HZ} 110,522 250,540 420,478 590,528 760,502 980,544 1180,466 1400,520 1600,498 1600,${HZ}" fill="url(#ridge)"/>
      <rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#ground)"/>
      <ellipse cx="900" cy="${cr.y}" rx="${cr.rx}" ry="${cr.rx * 0.12}" fill="#020203"/>
      <path d="M${900 - cr.rx} ${cr.y} A ${cr.rx} ${cr.rx * 0.12} 0 0 1 ${900 + cr.rx} ${cr.y}" stroke="${grey(lerp(40, 170, t))}" stroke-width="3" fill="none" opacity=".7"/>
      ${rockSvg}
      ${bumper()}
    </svg>`;
  }

  // Permanently shadowed crater floor: only the headlights light anything.
  function crater({ power = 1, ice = false }) {
    const beamRx = 260 + power * 560, beamRy = 150 + power * 230;
    const r = seeded(11);
    let rocks = "";
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = 430 + r() * 470, rr = 8 + r() * 40 * ((y - 400) / 500);
      rocks += `<ellipse cx="${x | 0}" cy="${y | 0}" rx="${rr.toFixed(0)}" ry="${(rr * 0.55).toFixed(0)}" fill="#8d8d92"/>`;
    }
    let glints = "";
    if (ice) {
      const g = seeded(5);
      for (let i = 0; i < 26; i++) {
        const x = 800 + (g() - 0.5) * beamRx * 1.3, y = 900 - g() * beamRy * 0.9;
        glints += `<circle class="glint" style="animation-delay:${(g() * 2).toFixed(2)}s" cx="${x | 0}" cy="${y | 0}" r="${(1.5 + g() * 2.5).toFixed(1)}" fill="#e8fbff"/>`;
      }
    }
    return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="beam" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000"/><stop offset=".55" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#fff"/></radialGradient>
        <mask id="dark"><rect width="${W}" height="${H}" fill="#fff"/><ellipse cx="800" cy="${H + 40}" rx="${beamRx}" ry="${beamRy}" fill="url(#beam)"/></mask>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3e"/><stop offset="1" stop-color="#6c6c70"/></linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#000"/>
      ${stars(140, 300, 3)}
      <polygon points="0,330 180,300 360,318 560,272 760,300 980,262 1200,296 1420,276 1600,300 1600,420 0,420" fill="#060607"/>
      <polyline points="560,272 640,282 760,300" stroke="#cfc4a8" stroke-width="2" fill="none" opacity=".75"/>
      <polyline points="980,262 1060,272" stroke="#cfc4a8" stroke-width="2" fill="none" opacity=".6"/>
      <rect y="400" width="${W}" height="${H - 400}" fill="url(#floor)"/>
      ${rocks}
      <rect y="380" width="${W}" height="${H - 380}" fill="#000" mask="url(#dark)"/>
      ${glints}
      ${bumper()}
    </svg>`;
  }

  // Looking down at the payload deck from the mast camera.
  function deck({ packed = [] }) {
    const items = CONFIG.items;
    const bays = items.map((it, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 170 + col * 300, y = 230 + row * 230;
      const on = packed.includes(it.id);
      return `
        <rect x="${x}" y="${y}" width="280" height="200" rx="14" fill="${on ? "rgba(111,227,255,.16)" : "rgba(0,0,0,.25)"}"
          stroke="${on ? "#6fe3ff" : "#5c6470"}" stroke-width="${on ? 4 : 2}" ${on ? "" : 'stroke-dasharray="12 10"'}/>
        <text x="${x + 140}" y="${y + 92}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="26" fill="${on ? "#dff8ff" : "#6c7480"}">${on ? it.short.toUpperCase() : "EMPTY BAY"}</text>
        <text x="${x + 140}" y="${y + 132}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="20" fill="${on ? "#8fdcf0" : "#525963"}">${it.mass} kg</text>`;
    }).join("");
    return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b414a"/><stop offset="1" stop-color="#1c2026"/></linearGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".04"/></pattern>
      </defs>
      <rect width="${W}" height="${H}" fill="#0b0d10"/>
      <rect x="40" y="-20" width="70" height="230" rx="18" fill="#15181c"/><rect x="1130" y="-20" width="70" height="230" rx="18" fill="#15181c"/>
      <rect x="40" y="700" width="70" height="230" rx="18" fill="#15181c"/><rect x="1130" y="700" width="70" height="230" rx="18" fill="#15181c"/>
      <rect x="120" y="150" width="1000" height="640" rx="28" fill="url(#plate)" stroke="#4d5560" stroke-width="3"/>
      <rect x="120" y="150" width="1000" height="640" rx="28" fill="url(#grid)"/>
      ${[[150, 180], [1090, 180], [150, 760], [1090, 760]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#5e6772"/>`).join("")}
      ${bays}
    </svg>`;
  }

  function earthView() {
    return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#000"/>
      ${stars(220, H, 21)}
      ${earth(800, 360, 170)}
      <path d="M0 760 Q800 690 1600 760 V900 H0Z" fill="#2c2c30"/>
      <path d="M0 760 Q800 690 1600 760" stroke="#7a7a80" stroke-width="2" fill="none"/>
    </svg>`;
  }

  // The bottom edge of the rover's own body in frame sells "you are the rover".
  function bumper() {
    return `<path d="M0 ${H} V860 Q200 830 520 838 L640 812 H960 L1080 838 Q1400 830 1600 860 V${H}Z" fill="#101215"/>
      <path d="M520 838 L640 812 H960 L1080 838" stroke="#3a4048" stroke-width="3" fill="none"/>
      <circle cx="700" cy="850" r="7" fill="#6fe3ff" opacity=".6"/><circle cx="900" cy="850" r="7" fill="#ffb547" opacity=".6"/>`;
  }

  const views = { rim, crater, deck, earth: earthView };

  function init(el) {
    root = el;
    root.innerHTML = `<div class="scene-svg"></div><div class="scene-grain"></div><div class="scene-vignette"></div><div class="scene-fx"></div>`;
    host = root.querySelector(".scene-svg");
    fxLayer = root.querySelector(".scene-fx");
  }

  // power (0..1) drives grain and power-save look in every view.
  function show(view, opts = {}) {
    host.innerHTML = views[view](opts);
    root.dataset.view = view;
    const p = opts.power == null ? 1 : Math.max(0, Math.min(1, opts.power));
    root.style.setProperty("--grain", (0.05 + (1 - p) * 0.18).toFixed(2));
    root.classList.toggle("low-power", p < 0.25);
  }

  function play(effect) {
    const d = document.createElement("div");
    d.className = "fx fx-" + effect;
    fxLayer.appendChild(d);
    setTimeout(() => d.remove(), 2400);
  }

  function drive() {
    root.classList.remove("driving");
    void root.offsetWidth;
    root.classList.add("driving");
  }

  return { init, show, play, drive };
})();
