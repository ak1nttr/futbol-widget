import type { AlertKind } from "./alerts";

// Short, quiet chimes generated with Web Audio (no sound files to ship or license).
// Each note: [frequency in Hz, start offset in seconds].
const NOTES: Record<AlertKind, [number, number][]> = {
  goal: [
    [659.25, 0],
    [880, 0.13],
  ],
  goalAgainst: [[392, 0]],
  red: [
    [587.33, 0],
    [440, 0.15],
  ],
  penalty: [
    [523.25, 0],
    [523.25, 0.12],
  ],
  penaltyMissed: [
    [523.25, 0],
    [392, 0.15],
  ],
  goalCancelled: [
    [440, 0],
    [349.23, 0.15],
  ],
  start: [[783.99, 0]],
  end: [
    [783.99, 0],
    [587.33, 0.16],
  ],
};

const VOLUME = 0.12;
let ctx: AudioContext | undefined;

export function playAlertSound(kind: AlertKind) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    return;
  }
  const t0 = ctx.currentTime + 0.03;
  const master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  for (const [freq, dt] of NOTES[kind]) {
    const start = t0 + dt;
    // A sine plus a faint octave above gives a soft, bell-like tone.
    for (const [mult, level] of [
      [1, 1],
      [2, 0.15],
    ]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(level, start + 0.015);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(start + 0.75);
    }
  }
}
