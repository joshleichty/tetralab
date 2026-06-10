// Exploration only — NOT production. Generates candidate "tetra-original"
// tactile SFX as WAV files, to demo the fully-owned, designed-in-house route
// (quality-bar.md §3.5: "DIY: fully-owned tactile identity").
// Run: node generate.mjs   (writes *.wav next to itself, zero deps)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const RATE = 44100;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, 44 + i * 2);
  return buf;
}

// tone with exponential decay envelope; optional pitch slide and noise mix
function blip({ freq, dur, decay = 18, slide = 0, noise = 0, gain = 0.6, square = false }) {
  const n = Math.floor(RATE * dur);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = freq + slide * t;
    phase += (2 * Math.PI * f) / RATE;
    let s = square ? Math.sign(Math.sin(phase)) * 0.5 : Math.sin(phase);
    if (noise) s = s * (1 - noise) + (Math.random() * 2 - 1) * noise;
    out[i] = s * Math.exp(-decay * t) * gain;
  }
  return out;
}

function mix(...parts) {
  const n = Math.max(...parts.map(p => p.length));
  const out = new Float64Array(n);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

function seq(gap, ...parts) {
  const step = Math.floor(RATE * gap);
  const n = step * (parts.length - 1) + parts[parts.length - 1].length;
  const out = new Float64Array(n);
  parts.forEach((p, k) => { for (let i = 0; i < p.length; i++) out[k * step + i] += p[i]; });
  return out;
}

const files = {
  // movement: near-inaudible dry tick — survives 10 presses/sec
  'move-tick.wav': blip({ freq: 1900, dur: 0.03, decay: 90, gain: 0.35 }),
  'rotate-click.wav': blip({ freq: 1300, dur: 0.04, decay: 70, gain: 0.4, square: true }),
  'softdrop-tick.wav': blip({ freq: 900, dur: 0.025, decay: 100, gain: 0.25 }),
  // hard drop: low thump + tiny noise transient
  'harddrop-thump.wav': mix(
    blip({ freq: 120, dur: 0.12, decay: 30, gain: 0.8, slide: -200 }),
    blip({ freq: 3000, dur: 0.02, decay: 150, noise: 0.8, gain: 0.25 })),
  'lock-snap.wav': mix(
    blip({ freq: 700, dur: 0.05, decay: 60, gain: 0.45 }),
    blip({ freq: 2600, dur: 0.015, decay: 200, noise: 0.5, gain: 0.2 })),
  'hold-swap.wav': seq(0.04, blip({ freq: 800, dur: 0.04, decay: 60, gain: 0.35 }),
    blip({ freq: 1100, dur: 0.05, decay: 50, gain: 0.35 })),
  // clears: glassy two-note rises, brighter per tier
  'clear-single.wav': seq(0.05, blip({ freq: 880, dur: 0.1, decay: 25 }), blip({ freq: 1108, dur: 0.14, decay: 20 })),
  'clear-quad.wav': seq(0.045,
    blip({ freq: 880, dur: 0.1, decay: 22 }), blip({ freq: 1108, dur: 0.1, decay: 22 }),
    blip({ freq: 1318, dur: 0.1, decay: 20 }), blip({ freq: 1760, dur: 0.22, decay: 14 })),
  'tspin.wav': mix(
    blip({ freq: 520, dur: 0.18, decay: 16, slide: 500, gain: 0.5 }),
    blip({ freq: 1560, dur: 0.12, decay: 22, gain: 0.3 })),
  'perfect-clear.wav': seq(0.07,
    blip({ freq: 1046, dur: 0.12, decay: 16 }), blip({ freq: 1318, dur: 0.12, decay: 16 }),
    blip({ freq: 1568, dur: 0.12, decay: 14 }), blip({ freq: 2093, dur: 0.3, decay: 8 })),
  // combo ladder: one blip, rising pitch per step (E5 pentatonic-ish walk)
  ...Object.fromEntries([659, 740, 880, 988, 1175, 1319].map((f, i) =>
    [`combo-${i + 1}.wav`, blip({ freq: f, dur: 0.09, decay: 28, gain: 0.5 })])),
  'b2b.wav': seq(0.05, blip({ freq: 1175, dur: 0.07, decay: 30 }), blip({ freq: 1760, dur: 0.12, decay: 20 })),
  'garbage-incoming.wav': blip({ freq: 240, dur: 0.16, decay: 14, square: true, gain: 0.4 }),
  'garbage-land.wav': mix(
    blip({ freq: 90, dur: 0.14, decay: 24, gain: 0.7 }),
    blip({ freq: 1500, dur: 0.04, decay: 80, noise: 0.9, gain: 0.3 })),
  'danger-pulse.wav': seq(0.18, blip({ freq: 196, dur: 0.15, decay: 18, square: true, gain: 0.45 }),
    blip({ freq: 196, dur: 0.15, decay: 18, square: true, gain: 0.45 })),
  'countdown-beep.wav': blip({ freq: 660, dur: 0.09, decay: 30, gain: 0.5 }),
  'go.wav': blip({ freq: 990, dur: 0.18, decay: 12, gain: 0.55 }),
  'topout.wav': blip({ freq: 440, dur: 0.5, decay: 5, slide: -300, gain: 0.5 }),
};

for (const [name, samples] of Object.entries(files)) writeFileSync(join(OUT, name), wav(samples));
console.log(`wrote ${Object.keys(files).length} wav files`);
