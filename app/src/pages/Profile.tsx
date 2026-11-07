import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { ACHIEVEMENTS } from '@/data/achievements'
import { LEVELS, levelInfo, streakOf, useGame } from '@/store/game'
import { Card, ProgressBar, SectionTitle, Segmented } from '@/components/ui'
import { Heatmap, SkillRadar } from '@/components/charts'

export default function Profile() {
  const state = useGame()
  const { xp, achievements, settings, setSettings, reset, importState } = state
  const lv = levelInfo(xp)
  const [confirmReset, setConfirmReset] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]).length

  const exportJson = () => {
    const data = Object.fromEntries(Object.entries(useGame.getState()).filter(([, v]) => typeof v !== 'function'))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sysdesign-quest-progreso-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const onFile = async (f: File) => {
    const ok = importState(await f.text())
    setMsg(ok ? '✅ Progreso importado' : '❌ Archivo no válido')
  }

  return (
    <div className="grid gap-6">
      <Card className="p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet/15 to-transparent pointer-events-none" />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-violet flex items-center justify-center text-3xl font-extrabold text-[#04131a]">{lv.level}</div>
          <div className="flex-1 min-w-[12rem]">
            <div className="text-2xl font-extrabold">{lv.title}</div>
            <div className="text-sm text-muted mb-2">
              {xp} XP · 🔥 {streakOf(state.activity)} días de racha · 🏅 {unlocked}/{ACHIEVEMENTS.length} logros
            </div>
            <ProgressBar value={lv.progress} />
            <div className="flex flex-wrap gap-1 mt-3">
              {LEVELS.map((l, i) => (
                <span key={l.title} className={`text-[10px] px-1.5 py-0.5 rounded ${i < lv.level ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted'}`}>
                  {l.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div>
        <SectionTitle sub={`${unlocked} de ${ACHIEVEMENTS.length} desbloqueados`}>🏅 Logros</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((a, i) => {
            const got = achievements[a.id]
            return (
              <motion.div key={a.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}>
                <Card className={`p-4 h-full text-center ${got ? (a.tier === 'gold' ? 'border-warn/60' : a.tier === 'silver' ? 'border-muted/60' : 'border-[#cd7f32]/60') : 'opacity-50'}`}>
                  <div className={`text-3xl mb-1 ${got ? '' : 'grayscale'}`}>{got ? a.icon : '🔒'}</div>
                  <div className="font-bold text-sm">{a.name}</div>
                  <div className="text-[11px] text-muted">{a.desc}</div>
                  {got && <div className="text-[10px] text-muted mt-1">{new Date(got).toLocaleDateString()}</div>}
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle>Radar de habilidades</SectionTitle>
          <SkillRadar />
        </Card>
        <Card className="p-5">
          <SectionTitle>Actividad</SectionTitle>
          <Heatmap weeks={20} />
        </Card>
      </div>

      <Card className="p-5 grid gap-4">
        <SectionTitle>⚙️ Preferencias</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Lenguaje por defecto</div>
            <Segmented value={settings.lang} onChange={(v) => setSettings({ lang: v })} options={[{ id: 'java', label: '☕ Java' }, { id: 'python', label: '🐍 Python' }]} />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Nube preferida</div>
            <Segmented value={settings.cloud} onChange={(v) => setSettings({ cloud: v })} options={[{ id: 'aws', label: 'AWS' }, { id: 'azure', label: 'Azure' }, { id: 'gcp', label: 'GCP' }]} />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Tema</div>
            <Segmented value={settings.theme} onChange={(v) => setSettings({ theme: v })} options={[{ id: 'dark', label: '🌙 Oscuro' }, { id: 'light', label: '☀️ Claro' }]} />
          </div>
          <div>
            <div className="text-xs font-semibold text-muted mb-1">Meta diaria</div>
            <Segmented value={String(settings.dailyGoal)} onChange={(v) => setSettings({ dailyGoal: Number(v) })} options={['30', '50', '100', '200'].map((v) => ({ id: v, label: `${v} XP` }))} />
          </div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ sound: e.target.checked })} /> Efectos de sonido
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={settings.autoTerms} onChange={(e) => setSettings({ autoTerms: e.target.checked })} /> Subrayar términos técnicos con explicación (tooltip)
          </label>
        </div>
      </Card>

      <Card className="p-5 grid gap-3">
        <SectionTitle sub="Tu progreso se guarda solo en este navegador. Expórtalo para llevarlo a otro dispositivo.">💾 Datos</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={exportJson}>
            <Download size={16} /> Exportar progreso
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Importar
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {!confirmReset ? (
            <button className="btn btn-ghost !border-bad/50 text-bad" onClick={() => setConfirmReset(true)}>
              Reiniciar progreso
            </button>
          ) : (
            <span className="flex gap-2 items-center text-sm">
              ¿Seguro? Se borra todo.
              <button className="btn btn-ghost !border-bad text-bad" onClick={() => { reset(); setConfirmReset(false); setMsg('Progreso reiniciado') }}>
                Sí, borrar
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
            </span>
          )}
        </div>
        {msg && <div className="text-sm">{msg}</div>}
      </Card>
    </div>
  )
}
