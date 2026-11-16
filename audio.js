// Sound, synthesized in code with the Web Audio API (no audio files).
// The Moon has no air, so nothing is heard "outside": the motor hum and wheel crunch are the
// rover's own vibrations, the hiss is the radio when Earth is out of view, and the rest are
// cockpit tones. Browsers only allow audio after the player's first click or key press.

const Sound = (() => {
  let ctx = null, master = null, motor = null, motorGain = null, crunchGain = null, hissGain = null;
  let enabled = true;
  try { enabled = localStorage.getItem("lmd-sound") !== "0"; } catch { /* storage blocked: default on */ }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function loopNoise(filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return g;
  }

  function ensure() {
    if (ctx || typeof AudioContext === "undefined") return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    // Motor: a low sawtooth through a low-pass filter.
    motor = ctx.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.value = 55;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 360;
    motorGain = ctx.createGain();
    motorGain.gain.value = 0;
    motor.connect(lp).connect(motorGain).connect(master);
    motor.start();
    crunchGain = loopNoise("bandpass", 900, 0.8);  // wheels on regolith
    hissGain = loopNoise("highpass", 3500, 0.5);   // radio static with no signal
  }

  // Call from the first click/key press so the browser lets audio play.
  function unlock() {
    if (!enabled) return;
    ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  // speedFrac 0..1, steep 0..1 (how hard the motors are working).
  function drive(speedFrac, steep = 0) {
    if (!ctx) return;
    const t = ctx.currentTime, moving = speedFrac > 0.01;
    motorGain.gain.setTargetAtTime(moving ? 0.07 + 0.06 * steep : 0, t, 0.08);
    motor.frequency.setTargetAtTime(50 + 40 * speedFrac + 35 * steep, t, 0.12);
    crunchGain.gain.setTargetAtTime(moving ? 0.035 * speedFrac : 0, t, 0.08);
  }

  function noSignal(on) {
    if (!ctx) return;
    hissGain.gain.setTargetAtTime(on ? 0.012 : 0, ctx.currentTime, 0.3);
  }

  const TONES = {
    science: { type: "sine", notes: [880, 1320], len: 0.09 },
    uplink: { type: "sine", notes: [660, 990, 1320], len: 0.08 },
    ice: { type: "sine", notes: [1046, 1318, 1568, 2093], len: 0.11 },
    alarm: { type: "square", notes: [520, 380, 520, 380, 520, 380], len: 0.16, vol: 0.06 },
    warn: { type: "triangle", notes: [300, 240], len: 0.1 },
    click: { type: "sine", notes: [1400], len: 0.03 },
    event: { type: "triangle", notes: [740, 554, 740], len: 0.1 },
  };

  function blip(kind) {
    if (!ctx || !enabled) return;
    const tone = TONES[kind];
    if (!tone) return;
    let t = ctx.currentTime + 0.01;
    for (const f of tone.notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tone.type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(tone.vol || 0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + tone.len);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + tone.len + 0.02);
      t += tone.len * 0.9;
    }
  }

  function quiet() { drive(0); noSignal(false); }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem("lmd-sound", on ? "1" : "0"); } catch { /* ignore */ }
    if (on) unlock();
    if (master) master.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05);
  }

  return { unlock, drive, noSignal, blip, quiet, setEnabled, isEnabled: () => enabled };
})();
