import type * as Phaser from 'phaser'
import { COLORS } from './BasePuzzle'
import { TreasuryBase } from './TreasuryBase'
import { chip } from '../audio'
import { ForgeSim, POLICY_LABEL, QUEUE_STEPS, WORKLOADS, queueLabel, suggestedThreads, type Policy, type PoolConfig } from '../models/forge'

const THREAD_STEPS = [1, 2, 4, 5, 6, 8, 10, 16, 20, 30, 40, 50, 64, 80, 100, 150, 200]
const POLICIES: Policy[] = ['abort', 'caller', 'discard']
const SPEED = 2.5

export class ForgeScene extends TreasuryBase {
  readonly puzzleId = 'forge' as const
  private level = 0
  private cfg: PoolConfig = { core: 4, max: 4, queue: Infinity, policy: 'abort' }
  private sim: ForgeSim | null = null
  private gfx?: Phaser.GameObjects.Graphics
  private vals: Record<string, Phaser.GameObjects.Text> = {}
  private live?: Phaser.GameObjects.Text
  private resultText?: Phaser.GameObjects.Text
  private flame: Phaser.GameObjects.Text[] = []

  constructor() {
    super('forge')
  }

  protected build() {
    this.startLevel(0)
  }

  private async startLevel(n: number) {
    this.clearLevel()
    this.level = n
    this.sim = null
    const w = WORKLOADS[n]
    this.cfg = n === 0 ? { core: 4, max: 4, queue: Infinity, policy: 'abort' } : { core: 50, max: 100, queue: 100, policy: 'abort' }
    // panel de configuración
    this.keep(this.panel(16, 56, 290, 430))
    this.keep(this.txt(30, 66, `⚙️ ThreadPoolExecutor`, 15, COLORS.accentHex, { bold: true }))
    this.keep(this.txt(30, 90, w.story, 12, COLORS.muted, { wrap: 262 }))
    const row = (y: number, key: string, label: string, dec: () => void, inc: () => void) => {
      this.keep(this.txt(30, y - 8, label, 13, COLORS.text, { bold: true }))
      this.vals[key] = this.keep(this.txt(236, y + 14, '', 15, COLORS.accentHex, { bold: true }).setOrigin(0.5))
      this.lvlButton(186, y + 14, 30, 26, '−', () => !this.sim && (dec(), this.refresh()), { color: COLORS.panel2 })
      this.lvlButton(286, y + 14, 30, 26, '+', () => !this.sim && (inc(), this.refresh()), { color: COLORS.panel2 })
    }
    const stepT = (v: number, d: number) => THREAD_STEPS[Math.max(0, Math.min(THREAD_STEPS.length - 1, THREAD_STEPS.indexOf(v) + d))]
    const stepQ = (v: number, d: number) => QUEUE_STEPS[Math.max(0, Math.min(QUEUE_STEPS.length - 1, QUEUE_STEPS.indexOf(v) + d))]
    const top = n === 0 ? 196 : 186
    row(top, 'core', 'corePoolSize', () => (this.cfg.core = stepT(this.cfg.core, -1)), () => {
      this.cfg.core = stepT(this.cfg.core, 1)
      this.cfg.max = Math.max(this.cfg.max, this.cfg.core)
    })
    row(top + 52, 'max', 'maximumPoolSize', () => {
      this.cfg.max = stepT(this.cfg.max, -1)
      this.cfg.core = Math.min(this.cfg.core, this.cfg.max)
    }, () => (this.cfg.max = stepT(this.cfg.max, 1)))
    row(top + 104, 'queue', 'Cola (capacidad)', () => (this.cfg.queue = stepQ(this.cfg.queue, -1)), () => (this.cfg.queue = stepQ(this.cfg.queue, 1)))
    row(top + 156, 'policy', 'Rechazo', () => (this.cfg.policy = POLICIES[(POLICIES.indexOf(this.cfg.policy) + 2) % 3]), () => (this.cfg.policy = POLICIES[(POLICIES.indexOf(this.cfg.policy) + 1) % 3]))
    this.lvlButton(161, 462, 250, 38, '🔥 Encender la forja', () => this.run())

    // visualización
    this.keep(this.panel(316, 56, 468, 430))
    this.keep(this.txt(332, 66, `Núcleos de CPU (${w.cores})`, 12, COLORS.muted))
    this.keep(this.txt(332, 122, 'Hilos:  🟧 calculando   🟦 esperando I/O   ⬜ ociosos', 12, COLORS.muted))
    this.keep(this.txt(332, 300, 'Cola de tareas', 12, COLORS.muted))
    this.keep(this.txt(332, 346, `Heap (${w.heapMb} MB)`, 12, COLORS.muted))
    this.gfx = this.keep(this.add.graphics())
    this.flame = []
    for (let i = 0; i < w.cores; i++) this.flame.push(this.keep(this.txt(360 + i * 60, 96, '🔥', 18, '#fff').setOrigin(0.5).setAlpha(0.15)))
    this.live = this.keep(this.txt(332, 388, '', 12, COLORS.text, { font: 'mono' }))
    this.resultText = this.keep(this.txt(332, 430, `Meta: p99 ≤ ${w.goal.p99} ms · rechazos ≤ ${w.goal.rejectPct}% · sin OutOfMemoryError`, 12, COLORS.warnHex, { wrap: 436 }))
    this.refresh()
    this.drawSim()
    await this.brief({
      title: `Nivel ${n + 1} · ${w.title}`,
      icon: n === 0 ? '⛓️' : '🧮',
      goal: `Configura el pool para que el pico pase con p99 ≤ ${w.goal.p99} ms, como mucho ${w.goal.rejectPct}% de rechazos y sin reventar el heap.`,
      how:
        n === 0
          ? [
              'Empiezas con lo que hace Executors.newFixedThreadPool(4): 4 hilos y una cola SIN límite.',
              'ThreadPoolExecutor crea hilos hasta core; luego ENCOLA; solo si la cola está llena crea hilos hasta max; después rechaza.',
              `Fórmula de Goetz: hilos ≈ núcleos × (1 + espera / cálculo) = ${w.cores} × (1 + ${w.waitMs}/${w.cpuMs}) ≈ ${suggestedThreads(w)}.`,
            ]
          : [
              'Ahora el trabajo es CPU pura: los hilos casi no esperan.',
              'Con más hilos que núcleos, los hilos se turnan la CPU y el sistema pierde tiempo cambiando de contexto.',
              'Una cola acotada absorbe el pico; la política de rechazo decide qué pasa cuando ni la cola alcanza.',
            ],
      concept: n === 0 ? 'Un [[thread-pool|thread pool]] para I/O necesita muchos hilos (la Ley de Little: concurrencia = tasa × latencia). Una cola sin límite convierte un pico en un OutOfMemoryError.' : 'Para trabajo de CPU, hilos ≈ núcleos (+1). La [[backpressure|backpressure]] (cola acotada + CallerRunsPolicy o rechazo) protege al servicio.',
      button: 'A la forja',
    })
  }

  private refresh() {
    const c = this.cfg
    this.vals.core?.setText(String(c.core))
    this.vals.max?.setText(String(c.max))
    this.vals.queue?.setText(queueLabel(c.queue)).setFontSize(c.queue === Infinity || c.queue === 0 ? 11 : 15)
    this.vals.policy?.setText(POLICY_LABEL[c.policy]).setFontSize(11)
  }

  private run() {
    if (this.sim) return
    chip.sfx('build')
    this.sim = new ForgeSim({ ...this.cfg }, WORKLOADS[this.level], 7)
    this.resultText?.setText('Forjando… mira cómo se llenan la cola y el heap durante el pico.').setColor(COLORS.muted)
  }

  private drawSim() {
    const g = this.gfx
    if (!g) return
    const w = WORKLOADS[this.level]
    const s = this.sim
    g.clear()
    // núcleos
    const computing = s ? s.workers.filter((x) => x.task && x.task.cpuLeft > 0).length + (s.caller && s.caller.cpuLeft > 0 ? 1 : 0) : 0
    for (let i = 0; i < w.cores; i++) {
      const on = i < computing
      g.fillStyle(on ? 0xf97316 : 0x334155, 1).fillRoundedRect(340 + i * 60, 84, 40, 24, 6)
      this.flame[i]?.setAlpha(on ? 1 : 0.15)
    }
    if (computing > w.cores) {
      g.fillStyle(0xf87171, 1).fillRoundedRect(340 + w.cores * 60, 84, 110, 24, 6)
    }
    // hilos
    const workers = s ? s.workers : []
    const shown = Math.max(this.cfg.core, workers.length)
    for (let i = 0; i < Math.min(200, Math.max(shown, 1)); i++) {
      const wk = workers[i]
      const col = !wk ? 0x1e293b : !wk.task ? 0x94a3b8 : wk.task.cpuLeft > 0 ? 0xf97316 : 0x3b82f6
      g.fillStyle(col, 1).fillRect(334 + (i % 25) * 17, 142 + Math.floor(i / 25) * 17, 13, 13)
    }
    // cola
    const q = s ? s.queue.length : 0
    const cap = this.cfg.queue === Infinity ? 1500 : Math.max(1, this.cfg.queue)
    g.fillStyle(0x1e293b, 1).fillRoundedRect(332, 318, 436, 18, 6)
    g.fillStyle(q >= cap ? 0xf87171 : 0xfbbf24, 1).fillRoundedRect(332, 318, Math.max(0, Math.min(1, q / cap)) * 436, 18, 6)
    // heap
    const mem = s ? s.memMb() : w.baseMb
    g.fillStyle(0x1e293b, 1).fillRoundedRect(332, 364, 436, 18, 6)
    g.fillStyle(mem / w.heapMb > 0.85 ? 0xf87171 : 0x34d399, 1).fillRoundedRect(332, 364, Math.min(1, mem / w.heapMb) * 436, 18, 6)
    const lat = s ? [...s.latencies].sort((a, b) => a - b) : []
    const p99 = lat.length ? Math.round(lat[Math.floor(lat.length * 0.99)] ?? 0) : 0
    this.live?.setText(
      s
        ? `t=${s.time.toFixed(1)}s  tasa=${Math.round(w.rate(Math.min(s.time, w.duration - 0.01)))}/s  cola=${q}  hilos=${workers.length}\nhechas=${s.latencies.length}  rechazadas=${s.rejected}  p99≈${p99} ms  heap=${Math.round(mem)} MB`
        : 'Configura y enciende la forja.',
    )
  }

  update(_t: number, delta: number) {
    if (!this.sim || this.paused) return
    const s = this.sim
    s.step((delta / 1000) * SPEED)
    if (s.events.length) {
      if (s.events.some((e) => e.type === 'reject')) chip.sfx('bad')
      s.events = []
    }
    this.drawSim()
    if (s.finished) {
      const r = s.result()
      this.sim = null
      this.resultText?.setText(r.msg).setColor(r.pass ? COLORS.goodHex : COLORS.badHex)
      if (r.oom) this.cameras.main.shake(300, 0.01)
      this.time.delayedCall(1400, () => {
        if (!r.pass) return this.levelFailed(r.msg, () => this.startLevel(this.level))
        this.levelDone(r.stars, 2, () => this.startLevel(1), r.msg)
      })
      this.paused = true
    }
  }
}
