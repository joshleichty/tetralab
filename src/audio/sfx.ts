/**
 * Tiny synthesized sound effects via WebAudio — no assets, no dependencies.
 * Everything is quiet, short and percussive to match the minimal aesthetic.
 */

type SfxName =
  | 'move'
  | 'rotate'
  | 'spin'
  | 'softdrop'
  | 'harddrop'
  | 'lock'
  | 'clear'
  | 'quad'
  | 'hold'
  | 'levelup'
  | 'gameover'
  | 'win'
  | 'go'
  | 'ready'
  | 'garbage'
  | 'combo'
  | 'b2b'
  | 'allclear'
  | 'warning'

const BASE_GAIN = 0.5

export class Sfx {
  enabled = true
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private vol = 1

  /** SFX volume, 0–1 (multiplies the base output level) */
  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v))
    if (this.master) this.master.gain.value = BASE_GAIN * this.vol
  }

  /** must be called from a user gesture at least once */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = BASE_GAIN * this.vol
    this.master.connect(this.ctx.destination)
  }

  /** `level` scales escalating sounds (combo count) */
  play(name: SfxName, level = 0) {
    if (!this.enabled || !this.ctx || !this.master) return
    const t = this.ctx.currentTime
    switch (name) {
      case 'move':
        this.blip(2200, t, 0.018, 0.06, 'square')
        break
      case 'rotate':
        this.blip(1400, t, 0.025, 0.08, 'triangle')
        break
      case 'spin':
        this.blip(880, t, 0.05, 0.14, 'sawtooth')
        this.blip(1320, t + 0.04, 0.05, 0.1, 'sawtooth')
        break
      case 'softdrop':
        this.blip(300, t, 0.012, 0.03, 'sine')
        break
      case 'harddrop':
        this.thump(t)
        break
      case 'lock':
        this.blip(520, t, 0.03, 0.09, 'triangle')
        break
      case 'hold':
        this.blip(980, t, 0.03, 0.08, 'sine')
        this.blip(740, t + 0.03, 0.03, 0.06, 'sine')
        break
      case 'clear':
        this.sweep(660, 1320, t, 0.12, 0.12)
        break
      case 'quad':
        this.chord([523.25, 659.25, 783.99, 1046.5], t, 0.3, 0.1)
        break
      case 'levelup':
        this.chord([392, 523.25, 659.25], t, 0.25, 0.08)
        break
      case 'gameover':
        this.sweep(440, 110, t, 0.6, 0.14)
        break
      case 'win':
        this.chord([523.25, 659.25, 783.99], t, 0.2, 0.1)
        this.chord([659.25, 783.99, 1046.5], t + 0.16, 0.35, 0.1)
        break
      case 'ready':
        this.blip(660, t, 0.08, 0.1, 'sine')
        break
      case 'go':
        this.blip(990, t, 0.14, 0.12, 'sine')
        break
      case 'garbage':
        this.sweep(90, 180, t, 0.12, 0.16)
        break
      case 'combo': {
        // pitch ladder: two semitones per combo, capped — chains literally rise
        const step = Math.min(level, 10)
        const freq = 660 * Math.pow(2, (step * 2) / 12)
        this.blip(freq, t, 0.06, 0.1, 'triangle')
        break
      }
      case 'b2b':
        // bright paired accent layered over the clear sound
        this.blip(1174.66, t, 0.05, 0.08, 'square')
        this.blip(1567.98, t + 0.045, 0.07, 0.08, 'square')
        break
      case 'allclear':
        // the biggest positive stinger: rising arpeggio + held chord
        this.blip(523.25, t, 0.1, 0.12, 'sine')
        this.blip(659.25, t + 0.07, 0.1, 0.12, 'sine')
        this.blip(783.99, t + 0.14, 0.1, 0.12, 'sine')
        this.chord([1046.5, 1318.5, 1568], t + 0.21, 0.5, 0.1)
        break
      case 'warning':
        // low double pulse on entering danger
        this.sweep(220, 130, t, 0.18, 0.14)
        this.sweep(220, 130, t + 0.22, 0.18, 0.12)
        break
    }
  }

  private blip(freq: number, t: number, dur: number, vol: number, type: OscillatorType) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private sweep(from: number, to: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private chord(freqs: number[], t: number, dur: number, vol: number) {
    for (const f of freqs) this.blip(f, t, dur, vol, 'sine')
  }

  private thump(t: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.09)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    osc.stop(t + 0.12)

    // a little noise transient for the impact
    const len = Math.floor(ctx.sampleRate * 0.04)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const ngain = ctx.createGain()
    ngain.gain.value = 0.12
    src.connect(ngain)
    ngain.connect(this.master!)
    src.start(t)
  }
}

export const sfx = new Sfx()
