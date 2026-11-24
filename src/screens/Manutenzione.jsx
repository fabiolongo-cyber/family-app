import { useState } from 'react'
import { addDoc, arrayUnion, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useFamilyCol } from '../lib/data.js'
import { addMonths, dueTone, fmtDateShort, inputDate, parseInputDate, relativeDue, time, toDate } from '../lib/dates.js'
import { Badge, Chips, Empty, ErrorNote, Fab, Field, FormActions, Icon, ScreenHeader, Sheet } from '../ui.jsx'

const CATEGORIES = ['Casa', 'Auto', 'Giardino', 'Impianti']
const FREQ = [['', 'Nessuna (una tantum)'], ['1', 'Ogni mese'], ['3', 'Ogni 3 mesi'], ['6', 'Ogni 6 mesi'], ['12', 'Ogni 12 mesi'], ['24', 'Ogni 2 anni']]
const freqLabel = (m) => (FREQ.find(([v]) => v === String(m || '')) || [])[1]

export default function Manutenzione({ onBack }) {
  const { isParent } = useFamily()
  const { docs, error } = useFamilyCol('maintenance')
  const [cat, setCat] = useState('Tutte')
  const [edit, setEdit] = useState(null)
  const [done, setDone] = useState(null)
  const [report, setReport] = useState(null)
  const [openHist, setOpenHist] = useState(null)

  const items = docs.filter((m) => cat === 'Tutte' || m.category === cat)
    .sort((a, b) => (a.nextDate ? time(a.nextDate) : Infinity) - (b.nextDate ? time(b.nextDate) : Infinity))

  return (
    <>
      <ScreenHeader title="Manutenzione" onBack={onBack} />
      <div className="content">
        <Chips options={['Tutte', ...CATEGORIES]} value={cat} onChange={setCat} />
        <ErrorNote error={error} />
        {items.length === 0 && <Empty>Nessuna manutenzione in questa categoria.</Empty>}
        <div className="timeline">
          {items.map((m) => {
            const next = m.nextDate ? toDate(m.nextDate) : null
            const tone = next ? dueTone(next) : 'neutral'
            return (
              <div key={m.id} className="tl-item">
                <span className={'tl-dot ' + tone} />
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="small muted strong">{m.category}</div>
                      <div className="card-title">{m.title}</div>
                    </div>
                    {next ? <Badge tone={tone}>{relativeDue(next)}</Badge> : <Badge>Nessuna scadenza</Badge>}
                  </div>
                  <p className="muted small">
                    {freqLabel(m.frequencyMonths) || 'Una tantum'}{m.budget ? ` · Budget € ${m.budget}` : ''}{next ? ` · ${fmtDateShort(next)}` : ''}
                  </p>
                  <div className="btn-row">
                    {isParent && <button type="button" className="btn btn-primary" onClick={() => setDone(m.id)}>Segna eseguita</button>}
                    <button type="button" className="btn btn-outline" onClick={() => setReport(m.id)}>Segnala problema</button>
                    {isParent && <button type="button" className="btn btn-quiet" onClick={() => setEdit(m.id)}>Modifica</button>}
                  </div>
                  <button type="button" className="toggle-row" aria-expanded={openHist === m.id} onClick={() => setOpenHist(openHist === m.id ? null : m.id)}>
                    Storico <Icon name={openHist === m.id ? 'back' : 'next'} size={16} />
                  </button>
                  {openHist === m.id && <History item={m} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {isParent && <Fab label="Nuova manutenzione" onClick={() => setEdit('new')} />}
      {edit && <EditSheet item={docs.find((m) => m.id === edit)} onClose={() => setEdit(null)} />}
      {done && <DoneSheet item={docs.find((m) => m.id === done)} onClose={() => setDone(null)} />}
      {report && <ReportSheet item={docs.find((m) => m.id === report)} onClose={() => setReport(null)} />}
    </>
  )
}

function History({ item }) {
  const { members } = useFamily()
  const { docs: reports } = useFamilyCol('maintenance/' + item.id + '/reports')
  const nameOf = (uid) => (members.find((m) => m.uid === uid) || {}).displayName || '—'
  const hist = [...(item.history || [])].sort((a, b) => time(b.date) - time(a.date))
  const reps = [...reports].sort((a, b) => time(b.at) - time(a.at))
  return (
    <div className="history">
      {hist.length === 0 && reps.length === 0 && <p className="muted small">Ancora nessun intervento o segnalazione.</p>}
      {hist.map((h, i) => (
        <p key={'h' + i} className="small"><strong>{fmtDateShort(toDate(h.date))}</strong> · {h.notes || 'Intervento eseguito'}
          <span className="muted"> · {h.cost ? `€ ${h.cost} · ` : ''}{nameOf(h.by)}</span></p>
      ))}
      {reps.map((r) => (
        <p key={r.id} className="small"><Badge tone="soon">Segnalazione</Badge> {r.text}
          <span className="muted"> · {nameOf(r.by)}{r.at ? ` · ${fmtDateShort(toDate(r.at))}` : ''}</span></p>
      ))}
    </div>
  )
}

function EditSheet({ item, onClose }) {
  const { me } = useFamily()
  const isNew = !item
  const [title, setTitle] = useState(item ? item.title : '')
  const [category, setCategory] = useState(item ? item.category : 'Casa')
  const [freq, setFreq] = useState(item && item.frequencyMonths ? String(item.frequencyMonths) : '')
  const [next, setNext] = useState(item && item.nextDate ? inputDate(toDate(item.nextDate)) : inputDate(new Date()))
  const [budget, setBudget] = useState(item && item.budget ? String(item.budget) : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Scrivi un titolo.'); return }
    setBusy(true); setErr('')
    try {
      const data = {
        title: title.trim(), category, frequencyMonths: freq ? Number(freq) : null,
        nextDate: next ? Timestamp.fromDate(parseInputDate(next)) : null,
        budget: budget ? Number(budget) : null, notes: notes.trim(), updatedAt: serverTimestamp(),
      }
      if (isNew) await addDoc(famCol('maintenance'), { ...data, history: [], createdBy: me.uid, createdAt: serverTimestamp() })
      else await updateDoc(famDoc('maintenance', item.id), data)
      onClose()
    } catch { setErr('Salvataggio non riuscito. Riprova.'); setBusy(false) }
  }
  async function remove() {
    if (!window.confirm('Eliminare questa manutenzione?')) return
    setBusy(true)
    try { await deleteDoc(famDoc('maintenance', item.id)); onClose() } catch { setErr('Eliminazione non riuscita.'); setBusy(false) }
  }

  return (
    <Sheet title={isNew ? 'Nuova manutenzione' : 'Modifica manutenzione'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Titolo" htmlFor="m-title"><input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="two">
          <Field label="Categoria" htmlFor="m-cat">
            <select id="m-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Frequenza" htmlFor="m-freq">
            <select id="m-freq" value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
        </div>
        <Field label="Prossima scadenza" htmlFor="m-next"><input id="m-next" type="date" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <Field label="Budget in euro (facoltativo)" htmlFor="m-budget"><input id="m-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
        <Field label="Note" htmlFor="m-notes"><textarea id="m-notes" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} onDelete={isNew ? null : remove} />
      </form>
    </Sheet>
  )
}

function DoneSheet({ item, onClose }) {
  const { me } = useFamily()
  const [date, setDate] = useState(inputDate(new Date()))
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const when = parseInputDate(date)
      const months = item.frequencyMonths
      await updateDoc(famDoc('maintenance', item.id), {
        history: arrayUnion({ date: Timestamp.fromDate(when), cost: cost ? Number(cost) : null, notes: notes.trim(), by: me.uid }),
        lastDate: Timestamp.fromDate(when),
        nextDate: months ? Timestamp.fromDate(addMonths(when, months)) : null,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch { setErr('Salvataggio non riuscito. Riprova.'); setBusy(false) }
  }

  return (
    <Sheet title={`Eseguita: ${item.title}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Data intervento" htmlFor="d-date"><input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Spesa in euro (facoltativa)" htmlFor="d-cost"><input id="d-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Note" htmlFor="d-notes"><textarea id="d-notes" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <p className="hint">{item.frequencyMonths ? 'La prossima scadenza verrà calcolata in automatico.' : 'Questa manutenzione non si ripete: resterà senza scadenza.'}</p>
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} saveLabel="Registra" />
      </form>
    </Sheet>
  )
}

function ReportSheet({ item, onClose }) {
  const { me } = useFamily()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!text.trim()) { setErr('Descrivi il problema.'); return }
    setBusy(true); setErr('')
    try {
      await addDoc(famCol('maintenance/' + item.id + '/reports'), { text: text.trim(), by: me.uid, at: serverTimestamp() })
      onClose()
    } catch { setErr('Segnalazione non riuscita. Riprova.'); setBusy(false) }
  }

  return (
    <Sheet title={`Segnala un problema: ${item.title}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Che cosa non va?" htmlFor="r-text"><textarea id="r-text" rows="3" value={text} onChange={(e) => setText(e.target.value)} /></Field>
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} saveLabel="Invia segnalazione" />
      </form>
    </Sheet>
  )
}
