/**
 * Chiptune sintetizado con WebAudio: un secuenciador mínimo con "lookahead scheduling"
 * (se programan las notas ~120 ms por adelantado para que el ritmo no dependa de setInterval).
 * Música original compuesta para NIMBUS.
 */
type Voice = { wave: OscillatorType; gain: number; notes: string; len?: number }
interface Track {
  bpm: number
  voices: Voice[]
}

const SEMI: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 }
function freq(n: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(n)
  if (!m) return 0
  return 440 * Math.pow(2, (SEMI[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}
const parse = (s: string) => s.trim().split(/\s+/)

const TRACKS: Record<string, Track> = {
  world: {
    bpm: 104,
    voices: [
      {
        wave: 'square',
        gain: 0.045,
        notes: `E5 . G5 . C6 . G5 . A5 . G5 . E5 . D5 .  C5 . D5 . E5 . G5 . A5 . . . G5 . . .
                F5 . A5 . C6 . A5 . G5 . E5 . C5 . D5 .  E5 . D5 . C5 . D5 . C5 . . . . . . .`,
      },
      {
        wave: 'triangle',
        gain: 0.09,
        len: 3,
        notes: `C3 . . . G3 . . . C3 . . . G3 . . .  A2 . . . E3 . . . A2 . . . E3 . . .
                F2 . . . C3 . . . F2 . . . C3 . . .  G2 . . . D3 . . . G2 . . . B2 . . .`,
      },
    ],
  },
  puzzle: {
    bpm: 124,
    voices: [
      {
        wave: 'square',
        gain: 0.03,
        notes: `A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4  G4 B4 D5 B4 G4 B4 D5 B4 E4 G#4 B4 G#4 E4 G#4 B4 G#4`,
      },
      { wave: 'triangle', gain: 0.1, len: 2, notes: `A2 . . . A2 . . . F2 . . . F2 . . .  G2 . . . G2 . . . E2 . . . E2 . . .` },
      { wave: 'square', gain: 0.025, len: 4, notes: `. . . . E5 . . . . . . . C5 . . .  . . . . D5 . . . . . . . B4 . . .` },
    ],
  },
  boss: {
    bpm: 150,
    voices: [
      { wave: 'triangle', gain: 0.12, notes: `D2 D2 D3 D2 D2 D3 D2 D3 A#1 A#1 A#2 A#1 A#1 A#2 C2 C3  D2 D2 D3 D2 D2 D3 D2 D3 F2 F2 F3 F2 E2 E3 C2 C3` },
      { wave: 'square', gain: 0.04, len: 2, notes: `D5 . . F5 . . A5 . G5 . F5 . E5 . C5 .  D5 . . F5 . . A5 . A#5 . A5 . G5 . E5 .` },
      { wave: 'sawtooth', gain: 0.018, len: 6, notes: `D4 . . . . . . . A#3 . . . . . . .  D4 . . . . . . . C4 . . . . . . .` },
    ],
  },
}

type Sfx = 'talk' | 'ok' | 'bad' | 'pickup' | 'door' | 'win' | 'lose' | 'coin' | 'build' | 'step' | 'fire'

class Chip {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicGain!: GainNode
  private sfxGain!: GainNode
  private timer: number | undefined
  private track: Track | null = null
  private trackName = ''
  private step = 0
  private nextTime = 0
  private parsed: string[][] = []
  muted = false

  /** Debe llamarse tras un gesto del usuario (política de autoplay). */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.8
      this.musicGain.connect(this.master)
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = 1
      this.sfxGain.connect(this.master)
      if (this.trackName) {
        const n = this.trackName
        this.trackName = ''
        this.play(n)
      }
    } catch {
      this.ctx = null
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05)
  }

  play(name: keyof typeof TRACKS | string) {
    if (this.trackName === name) return
    this.trackName = name
    this.track = TRACKS[name] ?? null
    if (!this.ctx || !this.track) return
    this.parsed = this.track.voices.map((v) => parse(v.notes))
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.08
    window.clearInterval(this.timer)
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stop() {
    window.clearInterval(this.timer)
    this.trackName = ''
    this.track = null
  }

  private schedule() {
    if (!this.ctx || !this.track) return
    const stepDur = 60 / this.track.bpm / 4
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.track.voices.forEach((v, i) => {
        const seq = this.parsed[i]
        const n = seq[this.step % seq.length]
        if (n && n !== '.') this.note(freq(n), this.nextTime, stepDur * (v.len ?? 1) * 0.9, v.wave, v.gain, this.musicGain)
      })
      this.step++
      this.nextTime += stepDur
    }
  }

  private note(f: number, t: number, dur: number, wave: OscillatorType, gain: number, out: GainNode) {
    if (!this.ctx || !f) return
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = wave
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.03, dur))
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  sfx(name: Sfx) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const seq: Record<Sfx, [string, number, OscillatorType][]> = {
      talk: [['A5', 0.03, 'square']],
      ok: [['C5', 0.06, 'square'], ['E5', 0.06, 'square'], ['G5', 0.1, 'square']],
      bad: [['E3', 0.12, 'sawtooth'], ['C3', 0.18, 'sawtooth']],
      pickup: [['E5', 0.05, 'square'], ['B5', 0.05, 'square'], ['E6', 0.12, 'triangle']],
      door: [['G3', 0.08, 'triangle'], ['C4', 0.12, 'triangle']],
      win: [['C5', 0.1, 'square'], ['E5', 0.1, 'square'], ['G5', 0.1, 'square'], ['C6', 0.3, 'square']],
      lose: [['G4', 0.15, 'triangle'], ['E4', 0.15, 'triangle'], ['C4', 0.35, 'triangle']],
      coin: [['B5', 0.04, 'square'], ['E6', 0.09, 'square']],
      build: [['C4', 0.05, 'square'], ['G4', 0.08, 'square']],
      step: [['C3', 0.02, 'triangle']],
      fire: [['D3', 0.1, 'sawtooth'], ['A2', 0.2, 'sawtooth']],
    }
    let at = t
    for (const [n, d, w] of seq[name]) {
      this.note(freq(n), at, d, w, name === 'talk' ? 0.03 : 0.07, this.sfxGain)
      at += d * 0.9
    }
  }

  dispose() {
    window.clearInterval(this.timer)
    void this.ctx?.close()
    this.ctx = null
    this.trackName = ''
  }
}

export const chip = new Chip()
