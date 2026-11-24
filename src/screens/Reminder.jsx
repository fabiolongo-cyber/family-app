import { useState } from 'react'
import { addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useFamilyCol } from '../lib/data.js'
import { DAYS_LONG, describeFrequency, describeTrigger, inputDate, nextTrigger, parseInputDate, toDate } from '../lib/dates.js'
import { Empty, ErrorNote, Fab, Field, FormActions, ScreenHeader, Sheet, SwipeRow, useSnack } from '../ui.jsx'

const FREQ = [['daily', 'Ogni giorno'], ['weekly', 'Giorni della settimana'], ['monthly', 'Ogni mese'], ['once', 'Una volta']]

export const recipientsLabel = (r, members) => (r.everyone ? '@tutti'
  : (r.targetUsers || []).map((u) => (members.find((m) => m.uid === u) || {}).displayName).filter(Boolean).map((n) => '@' + n).join(' '))

export default function Reminder({ onBack }) {
  const { me, members, isParent } = useFamily()
  const { docs, error } = useFamilyCol('reminders')
  const [edit, setEdit] = useState(null)
  const [err, setErr] = useState('')
  const [snack, showSnack] = useSnack()

  const rows = docs.map((r) => ({ r, next: r.isActive === false ? null : nextTrigger(r) }))
    .sort((a, b) => (a.next ? a.next.getTime() : Infinity) - (b.next ? b.next.getTime() : Infinity))
  const canEdit = (r) => isParent || r.createdBy === me.uid

  async function removeReminder(r) {
    const { id, ...data } = r
    try {
      await deleteDoc(famDoc('reminders', id))
      showSnack(`"${r.title}" eliminato`, 'Annulla', async () => {
        try { await addDoc(famCol('reminders'), { ...data, updatedAt: serverTimestamp() }) } catch { setErr('Non sono riuscito a ripristinare il reminder.') }
      })
    } catch { setErr('Eliminazione non riuscita.') }
  }

  async function toggle(r) {
    setErr('')
    try { await updateDoc(famDoc('reminders', r.id), { isActive: r.isActive === false, updatedAt: serverTimestamp() }) }
    catch { setErr('Non sono riuscito a cambiare lo stato del reminder.') }
  }

  return (
    <>
      <ScreenHeader title="Reminder" onBack={onBack} />
      <div className="content">
        <p className="muted small">Per ora i reminder si vedono qui e nella Home. Le notifiche sul telefono arriveranno in una versione successiva.</p>
        <ErrorNote error={error} />
        {err && <p className="error" role="alert">{err}</p>}
        {rows.length === 0 && <Empty>Nessun reminder. Creane uno con il pulsante +.</Empty>}
        <p className="hint">Scorri un reminder di lato per eliminarlo, oppure aprilo e tocca Elimina.</p>
        {rows.map(({ r, next }) => (
          <SwipeRow key={r.id} disabled={!canEdit(r)} onDelete={() => removeReminder(r)}>
          <div className={'card reminder' + (r.isActive === false ? ' off' : '')}>
            <button type="button" className="reminder-main" onClick={() => canEdit(r) && setEdit(r.id)} disabled={!canEdit(r)}>
              <span className="reminder-time">{r.time}</span>
              <span className="reminder-body">
                <span className="card-title">{r.title}</span>
                <span className="muted small">{describeFrequency(r)} · {recipientsLabel(r, members)}</span>
                <span className="small">{r.isActive === false ? 'Disattivato' : `Prossimo: ${describeTrigger(next)}`}</span>
              </span>
            </button>
            <button type="button" role="switch" aria-checked={r.isActive !== false} disabled={!canEdit(r)}
                    aria-label={`Attiva il reminder ${r.title}`} className={'switch' + (r.isActive !== false ? ' on' : '')}
                    onClick={() => toggle(r)}><span /></button>
          </div>
          </SwipeRow>
        ))}
      </div>
      {snack}
      <Fab label="Nuovo reminder" onClick={() => setEdit('new')} />
      {edit && <ReminderSheet item={docs.find((r) => r.id === edit)} onClose={() => setEdit(null)} />}
    </>
  )
}

function ReminderSheet({ item, onClose }) {
  const { me, members, isParent } = useFamily()
  const isNew = !item
  const [title, setTitle] = useState(item ? item.title : '')
  const [message, setMessage] = useState(item ? item.message || '' : '')
  const [timeStr, setTimeStr] = useState(item ? item.time : '19:00')
  const [frequency, setFrequency] = useState(item ? item.frequency : 'daily')
  const [days, setDays] = useState(item ? item.days || [] : [])
  const [date, setDate] = useState(item && item.date ? inputDate(toDate(item.date)) : inputDate(new Date()))
  const [everyone, setEveryone] = useState(item ? !!item.everyone : isParent)
  const [targets, setTargets] = useState(item ? item.targetUsers || [] : [me.uid])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const toggleDay = (i) => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())
  const toggleTarget = (u) => setTargets(targets.includes(u) ? targets.filter((x) => x !== u) : [...targets, u])

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Scrivi un titolo.'); return }
    if (frequency === 'weekly' && days.length === 0) { setErr('Scegli almeno un giorno.'); return }
    const targetUsers = isParent ? (everyone ? members.map((m) => m.uid) : targets) : [me.uid]
    if (targetUsers.length === 0) { setErr('Scegli per chi è il reminder.'); return }
    setBusy(true); setErr('')
    try {
      const data = {
        title: title.trim(), message: message.trim(), time: timeStr, frequency,
        days: frequency === 'weekly' ? days : [],
        date: (frequency === 'once' || frequency === 'monthly') ? Timestamp.fromDate(parseInputDate(date)) : null,
        everyone: isParent ? everyone : false, targetUsers, updatedAt: serverTimestamp(),
      }
      if (isNew) await addDoc(famCol('reminders'), { ...data, isActive: true, createdBy: me.uid, createdAt: serverTimestamp() })
      else await updateDoc(famDoc('reminders', item.id), data)
      onClose()
    } catch { setErr('Salvataggio non riuscito. Riprova.'); setBusy(false) }
  }
  async function remove() {
    if (!window.confirm('Eliminare questo reminder?')) return
    setBusy(true)
    try { await deleteDoc(famDoc('reminders', item.id)); onClose() } catch { setErr('Eliminazione non riuscita.'); setBusy(false) }
  }

  return (
    <Sheet title={isNew ? 'Nuovo reminder' : 'Modifica reminder'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Titolo" htmlFor="r-title"><input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Messaggio (facoltativo)" htmlFor="r-msg"><input id="r-msg" value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <div className="two">
          <Field label="Ora" htmlFor="r-time"><input id="r-time" type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} required /></Field>
          <Field label="Ripeti" htmlFor="r-freq">
            <select id="r-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
        </div>
        {frequency === 'weekly' && (
          <Field label="Giorni">
            <div className="chips">
              {DAYS_LONG.map((d, i) => (
                <button key={d} type="button" aria-pressed={days.includes(i)} className={'chip' + (days.includes(i) ? ' on' : '')} onClick={() => toggleDay(i)}>{d.slice(0, 3)}</button>
              ))}
            </div>
          </Field>
        )}
        {(frequency === 'once' || frequency === 'monthly') && (
          <Field label={frequency === 'once' ? 'Data' : 'Giorno del mese (si usa il giorno di questa data)'} htmlFor="r-date">
            <input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        )}
        {isParent ? (
          <Field label="Per chi">
            <div className="chips">
              <button type="button" aria-pressed={everyone} className={'chip' + (everyone ? ' on' : '')} onClick={() => setEveryone(!everyone)}>@tutti</button>
              {!everyone && members.map((m) => (
                <button key={m.uid} type="button" aria-pressed={targets.includes(m.uid)} className={'chip person' + (targets.includes(m.uid) ? ' on' : '')} onClick={() => toggleTarget(m.uid)}>
                  <span className="dot" style={{ background: m.color }} />{m.displayName}
                </button>
              ))}
            </div>
          </Field>
        ) : <p className="hint">Questo reminder è solo per te.</p>}
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} onDelete={isNew ? null : remove} />
      </form>
    </Sheet>
  )
}
