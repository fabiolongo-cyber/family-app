import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, lines, useMyEvents } from '../lib/data.js'
import {
  MONTHS, DAYS_SHORT, addDays, addMonths, fmtDateLong, fmtTime, inputDate, mondayOf, occursOn,
  parseInputDate, startOfDay, toDate, dayKey,
} from '../lib/dates.js'
import { Dots, Empty, ErrorNote, Fab, Field, FormActions, Icon, PersonPicker, ScreenHeader, Segmented, Sheet } from '../ui.jsx'

const REC = [
  ['none', 'Non si ripete'], ['daily', 'Ogni giorno'], ['weekly', 'Ogni settimana'],
  ['monthly', 'Ogni mese'], ['yearly', 'Ogni anno'],
]

const HOUR_H = 44
const START_H = 6
const END_H = 23

// Dispone gli eventi sovrapposti uno accanto all'altro
function layoutDay(evs) {
  const out = []
  let cluster = []
  let clusterEnd = -1
  const flush = () => {
    const cols = []
    cluster.forEach((e) => {
      let c = cols.findIndex((end) => end <= e.startMin)
      if (c === -1) { c = cols.length; cols.push(e.endMin) } else cols[c] = e.endMin
      e.col = c
    })
    cluster.forEach((e) => { e.cols = cols.length; out.push(e) })
    cluster = []
  }
  evs.forEach((e) => {
    if (cluster.length && e.startMin >= clusterEnd) { flush(); clusterEnd = -1 }
    cluster.push(e)
    clusterEnd = Math.max(clusterEnd, e.endMin)
  })
  if (cluster.length) flush()
  return out
}

function WeekGrid({ days, eventsOn, colorsOf, onOpen }) {
  const scroller = useRef(null)
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = (7 - START_H) * HOUR_H - 10 }, [])
  const todayKey = dayKey(new Date())
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  const perDay = days.map((day) => {
    const all = eventsOn(day)
    const allDay = all.filter((e) => e.allDay)
    const timed = all.filter((e) => !e.allDay).map((e) => {
      const s = toDate(e.start)
      const en = toDate(e.end)
      const startMin = Math.min(Math.max(s.getHours() * 60 + s.getMinutes(), START_H * 60), END_H * 60 - 20)
      const rawEnd = en ? en.getHours() * 60 + en.getMinutes() : startMin + 60
      const endMin = Math.min(Math.max(rawEnd, startMin + 20), END_H * 60)
      return { ev: e, startMin, endMin }
    }).sort((a, b) => a.startMin - b.startMin)
    return { day, allDay, timed: layoutDay(timed) }
  })

  return (
    <div className="card weekgrid">
      <div className="wg-row wg-head">
        <div />
        {perDay.map(({ day }) => (
          <div key={dayKey(day)} className="wg-dayhead">
            <span className="tiny muted">{DAYS_SHORT[(day.getDay() + 6) % 7]}</span>
            <span className={'day-num' + (dayKey(day) === todayKey ? ' today' : '')}>{day.getDate()}</span>
          </div>
        ))}
      </div>
      {perDay.some((d) => d.allDay.length > 0) && (
        <div className="wg-row wg-allday">
          <div className="tiny muted wg-label">Giorno</div>
          {perDay.map(({ day, allDay }) => (
            <div key={dayKey(day)} className="wg-allcell">
              {allDay.map((e) => (
                <button key={e.id} type="button" className="wg-chip" style={{ background: colorsOf(e)[0] || '#0F766E' }}
                        onClick={() => onOpen(e.id)} title={e.title}>{e.title}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="wg-body" ref={scroller}>
        <div className="wg-row wg-grid" style={{ height: hours.length * HOUR_H }}>
          <div className="wg-hours">
            {hours.map((h) => <div key={h} className="wg-hour tiny muted" style={{ height: HOUR_H }}>{String(h).padStart(2, '0')}:00</div>)}
          </div>
          {perDay.map(({ day, timed }) => (
            <div key={dayKey(day)} className={'wg-col' + (dayKey(day) === todayKey ? ' today' : '')}>
              {dayKey(day) === todayKey && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
                <div className="wg-now" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_H }} />
              )}
              {timed.map(({ ev, startMin, endMin, col, cols }) => (
                <button key={ev.id} type="button" className="wg-event" onClick={() => onOpen(ev.id)}
                        aria-label={`${ev.title}, ${fmtTime(toDate(ev.start))}`}
                        style={{
                          top: ((startMin - START_H * 60) / 60) * HOUR_H,
                          height: Math.max(20, ((endMin - startMin) / 60) * HOUR_H - 2),
                          left: `${(col / cols) * 100}%`, width: `calc(${100 / cols}% - 2px)`,
                          background: colorsOf(ev)[0] || '#0F766E',
                        }}>
                  <span className="wg-title">{ev.title}</span>
                  <span className="wg-time">{fmtTime(toDate(ev.start))}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Calendario() {
  const { members, isParent } = useFamily()
  const { events, error } = useMyEvents()
  const [view, setView] = useState('settimana')
  const [cursor, setCursor] = useState(startOfDay(new Date()))
  const [selected, setSelected] = useState(startOfDay(new Date()))
  const [editing, setEditing] = useState(null) // null | 'new' | id evento

  const colorsOf = (ev) => (ev.assignedTo || []).map((u) => (members.find((m) => m.uid === u) || {}).color).filter(Boolean)
  const eventsOn = (day) => events.filter((e) => occursOn(e, day))
    .sort((a, b) => (toDate(a.start) || 0) - (toDate(b.start) || 0))

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const gridStart = mondayOf(first)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [cursor])

  const weekDays = useMemo(() => {
    const start = mondayOf(cursor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [cursor])

  const title = view === 'mese'
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()].slice(0, 3)} – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()].slice(0, 3)}`
  const step = (n) => setCursor(view === 'mese' ? addMonths(cursor, n) : addDays(cursor, 7 * n))
  const today = dayKey(new Date())

  const renderEvent = (ev) => {
    const start = toDate(ev.start)
    const end = toDate(ev.end)
    return (
      <button key={ev.id} type="button" className="card event-row" onClick={() => setEditing(ev.id)}>
        <span className="event-time">
          {ev.allDay ? 'Tutto il giorno' : <>{fmtTime(start)}{end && <span className="muted"><br />{fmtTime(end)}</span>}</>}
        </span>
        <span className="event-main">
          <span className="event-title"><Dots colors={colorsOf(ev)} />{ev.title}</span>
          {ev.recurrence && ev.recurrence !== 'none' && <span className="muted small"><Icon name="repeat" size={13} /> {REC.find((r) => r[0] === ev.recurrence)[1]}</span>}
          {(ev.links || []).length > 0 && <span className="muted small"><Icon name="link" size={13} /> {(ev.links || []).length} allegat{(ev.links || []).length === 1 ? 'o' : 'i'}</span>}
        </span>
      </button>
    )
  }

  return (
    <>
      <ScreenHeader title={title.charAt(0).toUpperCase() + title.slice(1)} subtitle="Calendario"
        right={<div className="header-actions">
          <button type="button" className="icon-btn" onClick={() => setCursor(startOfDay(new Date()))} aria-label="Oggi"><Icon name="calendar" size={22} /></button>
          <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Precedente"><Icon name="back" size={24} /></button>
          <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Successivo"><Icon name="next" size={24} /></button>
        </div>} />
      <div className="content">
        <Segmented value={view} onChange={setView} options={[{ value: 'settimana', label: 'Settimana' }, { value: 'mese', label: 'Mese' }]} />
        <div className="legend">
          {members.map((m) => <span key={m.uid}><span className="dot" style={{ background: m.color }} />{m.displayName}</span>)}
        </div>
        <ErrorNote error={error} />

        {view === 'mese' && (
          <>
            <div className="card month">
              <div className="month-grid weekdays">{DAYS_SHORT.map((d, i) => <div key={i}>{d}</div>)}</div>
              <div className="month-grid">
                {monthCells.map((day) => {
                  const out = day.getMonth() !== cursor.getMonth()
                  const sel = dayKey(day) === dayKey(selected)
                  const isToday = dayKey(day) === today
                  const colors = [...new Set(eventsOn(day).flatMap(colorsOf))]
                  return (
                    <button key={dayKey(day)} type="button" className="day" onClick={() => setSelected(day)}
                            aria-label={fmtDateLong(day)} aria-pressed={sel}>
                      <span className={'day-num' + (out ? ' out' : '') + (isToday ? ' today' : '') + (sel && !isToday ? ' sel' : '')}>{day.getDate()}</span>
                      <Dots colors={colors} />
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="section-head"><h2>{fmtDateLong(selected)}</h2><span className="muted small">{eventsOn(selected).length === 1 ? '1 evento' : `${eventsOn(selected).length} eventi`}</span></div>
            {eventsOn(selected).length === 0 && <Empty>Nessun evento in questo giorno.</Empty>}
            {eventsOn(selected).map(renderEvent)}
          </>
        )}

        {view === 'settimana' && (
          <WeekGrid days={weekDays} eventsOn={eventsOn} colorsOf={colorsOf} onOpen={setEditing} />
        )}
      </div>
      {isParent && <Fab label="Nuovo evento" onClick={() => setEditing('new')} />}
      {editing && <EventSheet event={events.find((e) => e.id === editing)} day={selected} onClose={() => setEditing(null)} />}
    </>
  )
}

function EventSheet({ event, day, onClose }) {
  const { me, members, isParent } = useFamily()
  const isNew = !event
  const start = event ? toDate(event.start) : null
  const end = event ? toDate(event.end) : null
  const [title, setTitle] = useState(event ? event.title : '')
  const [date, setDate] = useState(inputDate(start || day))
  const [from, setFrom] = useState(event && !event.allDay && start ? fmtTime(start) : '')
  const [to, setTo] = useState(end ? fmtTime(end) : '')
  const [assigned, setAssigned] = useState(event ? event.assignedTo || [] : members.map((m) => m.uid))
  const [recurrence, setRecurrence] = useState(event ? event.recurrence || 'none' : 'none')
  const [until, setUntil] = useState(event && event.until ? inputDate(toDate(event.until)) : '')
  const [description, setDescription] = useState(event ? event.description || '' : '')
  const [links, setLinks] = useState(event ? (event.links || []).join('\n') : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Scrivi un titolo.'); return }
    if (assigned.length === 0) { setErr('Scegli almeno una persona.'); return }
    setBusy(true); setErr('')
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        start: Timestamp.fromDate(parseInputDate(date, from || '00:00')),
        allDay: !from,
        end: to ? Timestamp.fromDate(parseInputDate(date, to)) : null,
        assignedTo: assigned,
        recurrence,
        until: recurrence !== 'none' && until ? Timestamp.fromDate(parseInputDate(until)) : null,
        links: lines(links),
        updatedAt: serverTimestamp(),
      }
      if (isNew) await addDoc(famCol('events'), { ...data, createdBy: me.uid, createdAt: serverTimestamp() })
      else await updateDoc(famDoc('events', event.id), data)
      onClose()
    } catch (error) {
      setErr(error.code === 'permission-denied' ? 'Non hai il permesso di salvare.' : 'Salvataggio non riuscito. Riprova.')
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Eliminare questo evento?')) return
    setBusy(true)
    try { await deleteDoc(famDoc('events', event.id)); onClose() } catch { setErr('Eliminazione non riuscita.'); setBusy(false) }
  }

  if (!isParent) {
    return (
      <Sheet title={event.title} onClose={onClose}>
        <p>{fmtDateLong(start)} · {event.allDay ? 'tutto il giorno' : fmtTime(start)}</p>
        {event.description && <p>{event.description}</p>}
        {(event.links || []).map((l) => <a key={l} className="link-row" href={l} target="_blank" rel="noopener noreferrer"><Icon name="link" size={16} /> {l}</a>)}
      </Sheet>
    )
  }

  return (
    <Sheet title={isNew ? 'Nuovo evento' : 'Modifica evento'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Titolo" htmlFor="ev-title"><input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Data" htmlFor="ev-date"><input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <div className="two">
          <Field label="Dalle" htmlFor="ev-from"><input id="ev-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Alle" htmlFor="ev-to"><input id="ev-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <span className="hint">Lascia vuoto l&apos;orario per un evento di tutto il giorno.</span>
        <Field label="Per chi"><PersonPicker members={members} value={assigned} onChange={setAssigned} /></Field>
        <Field label="Ripetizione" htmlFor="ev-rec">
          <select id="ev-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {REC.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {recurrence !== 'none' && (
          <Field label="Ripeti fino al (facoltativo)" htmlFor="ev-until"><input id="ev-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
        )}
        <Field label="Note" htmlFor="ev-desc"><textarea id="ev-desc" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Allegati (link, uno per riga)" htmlFor="ev-links" hint="Per ora gli allegati sono link, per esempio a un file su Google Drive.">
          <textarea id="ev-links" rows="2" value={links} onChange={(e) => setLinks(e.target.value)} />
        </Field>
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} onDelete={isNew ? null : remove} />
      </form>
    </Sheet>
  )
}
