import { useState } from 'react'
import { addDoc, arrayUnion, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useVisibleObjectives } from '../lib/data.js'
import { daysFromToday, dueTone, fmtDateShort, inputDate, parseInputDate, relativeDue, toDate, time } from '../lib/dates.js'
import { Badge, ErrorNote, Fab, Field, FormActions, Icon, ScreenHeader, Sheet } from '../ui.jsx'

const STEPS = [0, 10, 25, 50, 75, 100]
const COLUMNS = [
  ['todo', 'Da iniziare', (p) => p === 0],
  ['doing', 'In corso', (p) => p > 0 && p < 100],
  ['done', 'Completati', (p) => p === 100],
]

export default function Obiettivi({ onBack }) {
  const { objectives, error } = useVisibleObjectives()
  const [open, setOpen] = useState(null)
  const sorted = [...objectives].sort((a, b) => time(a.targetDate) - time(b.targetDate))

  return (
    <>
      <ScreenHeader title="Obiettivi" onBack={onBack} />
      <div className="content">
        <ErrorNote error={error} />
        <p className="muted small">Scorri di lato per cambiare colonna. Tocca una scheda per note e dettagli.</p>
        <div className="board">
          {COLUMNS.map(([key, label, test]) => {
            const col = sorted.filter((o) => test(o.progress || 0))
            return (
              <section key={key} className="board-col" aria-label={label}>
                <div className="section-head"><h2>{label}</h2><span className="count">{col.length}</span></div>
                {col.length === 0 && <p className="muted small">Nessun obiettivo</p>}
                {col.map((o) => {
                  const target = toDate(o.targetDate)
                  return (
                    <button key={o.id} type="button" className="card goal" onClick={() => setOpen(o.id)}>
                      <span className="card-title">{o.title}{o.visibility === 'parents_only' && <Badge>Solo genitori</Badge>}</span>
                      <span className="muted small">{target ? `Entro ${fmtDateShort(target)}` : ''}{o.budget ? ` · Budget € ${o.budget}` : ''}</span>
                      <span className="bar" aria-hidden="true"><span style={{ width: `${o.progress || 0}%` }} /></span>
                      <span className="small strong">{o.progress || 0}%{target && daysFromToday(target) <= 30 && <span className="muted"> · <Badge tone={dueTone(target)}>{relativeDue(target)}</Badge></span>}</span>
                      {(o.notes || []).length > 0 && <span className="muted small"><Icon name="note" size={14} /> {o.notes.length} note</span>}
                    </button>
                  )
                })}
              </section>
            )
          })}
        </div>
      </div>
      <Fab label="Nuovo obiettivo" onClick={() => setOpen('new')} />
      {open && <GoalSheet goal={objectives.find((o) => o.id === open)} onClose={() => setOpen(null)} />}
    </>
  )
}

function GoalSheet({ goal, onClose }) {
  const { me, isParent } = useFamily()
  const isNew = !goal
  const [title, setTitle] = useState(goal ? goal.title : '')
  const [description, setDescription] = useState(goal ? goal.description || '' : '')
  const [target, setTarget] = useState(goal && goal.targetDate ? inputDate(toDate(goal.targetDate)) : '')
  const [budget, setBudget] = useState(goal && goal.budget ? String(goal.budget) : '')
  const [visibility, setVisibility] = useState(goal ? goal.visibility || 'all' : 'all')
  const [progress, setProgress] = useState(goal ? goal.progress || 0 : 0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Scrivi un titolo.'); return }
    if (!target) { setErr('Scegli una data obiettivo.'); return }
    setBusy(true); setErr('')
    try {
      const data = {
        title: title.trim(), description: description.trim(), targetDate: Timestamp.fromDate(parseInputDate(target)),
        budget: budget ? Number(budget) : null, visibility, progress, updatedBy: me.uid, updatedAt: serverTimestamp(),
      }
      if (isNew) await addDoc(famCol('objectives'), { ...data, notes: [], createdBy: me.uid, createdAt: serverTimestamp() })
      else await updateDoc(famDoc('objectives', goal.id), data)
      onClose()
    } catch { setErr('Salvataggio non riuscito. Riprova.'); setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Eliminare questo obiettivo?')) return
    setBusy(true)
    try { await deleteDoc(famDoc('objectives', goal.id)); onClose() } catch { setErr('Eliminazione non riuscita.'); setBusy(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    try {
      await updateDoc(famDoc('objectives', goal.id), {
        notes: arrayUnion({ by: me.uid, name: me.displayName, text: note.trim(), at: Timestamp.now() }),
        updatedAt: serverTimestamp(),
      })
      setNote('')
    } catch { setErr('Non sono riuscito ad aggiungere la nota.') }
  }

  return (
    <Sheet title={isNew ? 'Nuovo obiettivo' : goal.title} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Titolo" htmlFor="g-title"><input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Descrizione (facoltativa)" htmlFor="g-desc"><textarea id="g-desc" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="two">
          <Field label="Entro il" htmlFor="g-target"><input id="g-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="Budget € (facolt.)" htmlFor="g-budget"><input id="g-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
        </div>
        <Field label="Avanzamento">
          <div className="steps">
            {STEPS.map((s) => (
              <button key={s} type="button" aria-pressed={progress === s} className={'chip' + (progress === s ? ' on' : '')} onClick={() => setProgress(s)}>{s}%</button>
            ))}
          </div>
        </Field>
        {isParent && (
          <Field label="Chi lo vede" htmlFor="g-vis">
            <select id="g-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="all">Tutta la famiglia</option>
              <option value="parents_only">Solo i genitori</option>
            </select>
          </Field>
        )}
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} onDelete={isNew || !(isParent || goal.createdBy === me.uid) ? null : remove} />
      </form>

      {!isNew && (
        <div className="notes">
          <h3>Note della famiglia</h3>
          {(goal.notes || []).length === 0 && <p className="muted small">Nessuna nota.</p>}
          {(goal.notes || []).map((n, i) => <p key={i} className="note"><strong>{n.name}</strong> {n.text}</p>)}
          <form className="note-form" onSubmit={addNote}>
            <label className="sr" htmlFor="g-note">Nuova nota</label>
            <input id="g-note" value={note} placeholder="Scrivi una nota" onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary" type="submit">Aggiungi</button>
          </form>
        </div>
      )}
    </Sheet>
  )
}
