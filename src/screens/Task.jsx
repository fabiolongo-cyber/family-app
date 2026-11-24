import { useState } from 'react'
import { addDoc, arrayUnion, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useFamilyCol } from '../lib/data.js'
import { fmtDateShort, fmtTime, inputDate, nextOccurrence, parseInputDate, relativeDue, startOfDay, time, toDate, dueTone } from '../lib/dates.js'
import { Avatar, Badge, Chips, Empty, ErrorNote, Fab, Field, FormActions, Icon, PersonPicker, ScreenHeader, Segmented, Sheet } from '../ui.jsx'

const CATEGORIES = ['Casa', 'Spesa', 'Lavoro', 'Altro']
const PRIORITY = [['', 'Nessuna'], ['low', 'Bassa'], ['medium', 'Media'], ['high', 'Alta']]
const REC = [['none', 'Non si ripete'], ['daily', 'Ogni giorno'], ['weekly', 'Ogni settimana'], ['monthly', 'Ogni mese']]
const byDue = (a, b) => time(a.dueDate) - time(b.dueDate)

export default function Task() {
  const { me, members, isParent } = useFamily()
  const { docs: tasks, error } = useFamilyCol('tasks')
  const [tab, setTab] = useState('active')
  const [cat, setCat] = useState('Tutti')
  const [pending, setPending] = useState([])
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const person = (uid) => members.find((m) => m.uid === uid)
  const canComplete = (t) => isParent || t.assignedTo === me.uid
  const active = tasks.filter((t) => t.status !== 'completed').sort(byDue)
  const archived = tasks.filter((t) => t.status === 'completed').sort((a, b) => time(b.completedAt) - time(a.completedAt))
  const categories = ['Tutti', ...new Set([...CATEGORIES, ...tasks.map((t) => t.category).filter(Boolean)])]
  const list = (tab === 'active' ? active : archived).filter((t) => cat === 'Tutti' || t.category === cat)

  const toggle = (id) => setPending((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function saveCompleted() {
    setBusy(true); setErr('')
    try {
      for (const id of pending) {
        const t = tasks.find((x) => x.id === id)
        if (!t) continue
        const entry = { by: me.uid, at: Timestamp.now() }
        if (t.recurrence && t.recurrence !== 'none') {
          let next = nextOccurrence(toDate(t.dueDate), t.recurrence)
          for (let i = 0; i < 1000 && next < startOfDay(new Date()); i++) next = nextOccurrence(next, t.recurrence)
          await updateDoc(famDoc('tasks', id), {
            dueDate: Timestamp.fromDate(next), lastCompletedAt: Timestamp.now(), lastCompletedBy: me.uid,
            history: arrayUnion(entry), updatedAt: serverTimestamp(),
          })
        } else {
          await updateDoc(famDoc('tasks', id), {
            status: 'completed', completedBy: me.uid, completedAt: Timestamp.now(),
            history: arrayUnion(entry), updatedAt: serverTimestamp(),
          })
        }
      }
      setPending([])
    } catch (e) {
      setErr('Non sono riuscito a salvare. Riprova.')
    }
    setBusy(false)
  }

  return (
    <>
      <ScreenHeader title="Task" subtitle="Famiglia" />
      <div className="content">
        <Segmented value={tab} onChange={setTab}
          options={[{ value: 'active', label: `Attivi · ${active.length}` }, { value: 'archived', label: 'Archiviati' }]} />
        <Chips options={categories} value={cat} onChange={setCat} />
        <ErrorNote error={error} />
        {list.length === 0 && <Empty>{tab === 'active' ? 'Nessun task attivo.' : 'Nessun task archiviato.'}</Empty>}
        {list.map((t) => {
          const who = person(t.assignedTo)
          const due = toDate(t.dueDate)
          const done = pending.includes(t.id)
          return (
            <div key={t.id} className={'card task' + (done ? ' selected' : '')}>
              {tab === 'active' ? (
                <input type="checkbox" className="check" checked={done} disabled={!canComplete(t)}
                       aria-label={`Completa: ${t.title}`} onChange={() => toggle(t.id)} />
              ) : <span className="check-done"><Icon name="check" size={16} /></span>}
              <button type="button" className="task-body" onClick={() => setOpen(t.id)}>
                <span className="task-title">
                  {t.title}
                  {t.priority === 'high' && <Badge tone="late">Alta</Badge>}
                </span>
                <span className="meta-row">
                  {who && <><Avatar member={who} size={20} /><span>{who.displayName}</span></>}
                  {tab === 'active' && due && <Badge tone={dueTone(due)}>{relativeDue(due)}</Badge>}
                  {tab === 'archived' && t.completedAt && (
                    <span>{fmtDateShort(toDate(t.completedAt))} {fmtTime(toDate(t.completedAt))}
                      {person(t.completedBy) ? ` · ${person(t.completedBy).displayName}` : ''}</span>
                  )}
                  {t.category && <span className="muted">{t.category}</span>}
                  {t.recurrence && t.recurrence !== 'none' && <Icon name="repeat" size={14} />}
                  {(t.notes || []).length > 0 && <span className="muted"><Icon name="note" size={14} /> {t.notes.length}</span>}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {pending.length > 0 && (
        <div className="savebar">
          <span>{pending.length} {pending.length === 1 ? 'task da completare' : 'task da completare'}</span>
          <button type="button" className="btn btn-light" onClick={saveCompleted} disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
        </div>
      )}
      {err && <p className="error floating" role="alert">{err}</p>}
      {isParent && pending.length === 0 && <Fab label="Nuovo task" onClick={() => setOpen('new')} />}
      {open && <TaskSheet task={tasks.find((t) => t.id === open)} onClose={() => setOpen(null)} />}
    </>
  )
}

function TaskSheet({ task, onClose }) {
  const { me, members, isParent } = useFamily()
  const isNew = !task
  const [title, setTitle] = useState(task ? task.title : '')
  const [assignedTo, setAssignedTo] = useState(task ? [task.assignedTo] : [me.uid])
  const [due, setDue] = useState(inputDate(task && task.dueDate ? toDate(task.dueDate) : new Date()))
  const [priority, setPriority] = useState(task ? task.priority || '' : '')
  const [category, setCategory] = useState(task ? task.category || 'Casa' : 'Casa')
  const [recurrence, setRecurrence] = useState(task ? task.recurrence || 'none' : 'none')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Scrivi un titolo.'); return }
    if (!assignedTo[0]) { setErr('Scegli una persona.'); return }
    setBusy(true); setErr('')
    try {
      const data = {
        title: title.trim(), assignedTo: assignedTo[0], dueDate: Timestamp.fromDate(parseInputDate(due)),
        priority, category, recurrence, updatedAt: serverTimestamp(),
      }
      if (isNew) await addDoc(famCol('tasks'), { ...data, status: 'active', notes: [], history: [], createdBy: me.uid, createdAt: serverTimestamp() })
      else await updateDoc(famDoc('tasks', task.id), data)
      onClose()
    } catch { setErr('Salvataggio non riuscito. Riprova.'); setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Eliminare questo task?')) return
    setBusy(true)
    try { await deleteDoc(famDoc('tasks', task.id)); onClose() } catch { setErr('Eliminazione non riuscita.'); setBusy(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    try {
      await updateDoc(famDoc('tasks', task.id), {
        notes: arrayUnion({ by: me.uid, name: me.displayName, text: note.trim(), at: Timestamp.now() }),
        updatedAt: serverTimestamp(),
      })
      setNote('')
    } catch { setErr('Non sono riuscito ad aggiungere la nota.') }
  }

  return (
    <Sheet title={isNew ? 'Nuovo task' : task.title} onClose={onClose}>
      {isParent ? (
        <form className="form" onSubmit={save}>
          <Field label="Titolo" htmlFor="t-title"><input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Assegnato a"><PersonPicker single members={members} value={assignedTo} onChange={setAssignedTo} /></Field>
          <Field label="Scadenza" htmlFor="t-due"><input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></Field>
          <div className="two">
            <Field label="Categoria" htmlFor="t-cat">
              <select id="t-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Priorità" htmlFor="t-pri">
              <select id="t-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Ripetizione" htmlFor="t-rec">
            <select id="t-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {REC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {err && <p className="error" role="alert">{err}</p>}
          <FormActions busy={busy} onDelete={isNew ? null : remove} />
        </form>
      ) : (
        <p className="muted">Assegnato a {(members.find((m) => m.uid === task.assignedTo) || {}).displayName} · {relativeDue(toDate(task.dueDate))}</p>
      )}

      {!isNew && (
        <div className="notes">
          <h3>Note</h3>
          {(task.notes || []).length === 0 && <p className="muted small">Nessuna nota.</p>}
          {(task.notes || []).map((n, i) => (
            <p key={i} className="note"><strong>{n.name}</strong> {n.text}</p>
          ))}
          <form className="note-form" onSubmit={addNote}>
            <label className="sr" htmlFor="t-note">Nuova nota</label>
            <input id="t-note" value={note} placeholder="Scrivi una nota" onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary" type="submit">Aggiungi</button>
          </form>
          {!isParent && err && <p className="error" role="alert">{err}</p>}
        </div>
      )}
    </Sheet>
  )
}
