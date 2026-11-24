import { useMemo } from 'react'
import { useFamily } from '../context.jsx'
import { useFamilyCol, useMyEvents, useVisibleObjectives } from '../lib/data.js'
import {
  DAYS_SHORT, addDays, dayKey, daysFromToday, describeTrigger, dueTone, fmtDateLong, fmtTime, mondayOf,
  nextTrigger, occursOn, relativeDue, startOfDay, time, toDate,
} from '../lib/dates.js'
import { Badge, Dots, ErrorNote, Icon, ScreenHeader, Avatar } from '../ui.jsx'
import { recipientsLabel } from './Reminder.jsx'

export default function Home({ go }) {
  const { me, members } = useFamily()
  const { events, error } = useMyEvents()
  const { docs: tasks } = useFamilyCol('tasks')
  const { docs: reminders } = useFamilyCol('reminders')
  const { docs: maintenance } = useFamilyCol('maintenance')
  const { objectives } = useVisibleObjectives()

  const today = startOfDay(new Date())
  const colorsOf = (ev) => (ev.assignedTo || []).map((u) => (members.find((m) => m.uid === u) || {}).color).filter(Boolean)
  const eventsOn = (day) => events.filter((e) => occursOn(e, day)).sort((a, b) => time(a.start) - time(b.start))
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(today), i)), [dayKey(today)])

  const urgent = tasks.filter((t) => t.status !== 'completed' && t.dueDate && daysFromToday(toDate(t.dueDate)) <= 3)
    .sort((a, b) => time(a.dueDate) - time(b.dueDate)).slice(0, 3)

  const mine = reminders.filter((r) => r.isActive !== false && (r.everyone || (r.targetUsers || []).includes(me.uid)))
    .map((r) => ({ r, next: nextTrigger(r) })).filter((x) => x.next).sort((a, b) => a.next - b.next)[0]

  const maint = maintenance.filter((m) => m.nextDate).sort((a, b) => time(a.nextDate) - time(b.nextDate))[0]
  const goals = [...objectives].filter((o) => (o.progress || 0) < 100).sort((a, b) => time(a.targetDate) - time(b.targetDate)).slice(0, 2)

  return (
    <>
      <ScreenHeader subtitle={fmtDateLong(today)} title={`Ciao, ${me.displayName}`}
        right={<button type="button" className="icon-btn" aria-label="Impostazioni" onClick={() => go('altro', 'impostazioni')}><Avatar member={me} size={40} /></button>} />
      <div className="content">
        <ErrorNote error={error} />

        <section className="card">
          <div className="section-head"><h2>Questa settimana</h2><button type="button" className="link-btn" onClick={() => go('calendario')}>Calendario</button></div>
          <div className="week">
            {week.map((d, i) => (
              <button key={dayKey(d)} type="button" className="week-day" onClick={() => go('calendario')} aria-label={fmtDateLong(d)}>
                <span className="muted tiny">{DAYS_SHORT[i]}</span>
                <span className={'day-num' + (dayKey(d) === dayKey(today) ? ' today' : '')}>{d.getDate()}</span>
                <Dots colors={[...new Set(eventsOn(d).flatMap(colorsOf))]} />
              </button>
            ))}
          </div>
          <div className="divider" />
          {eventsOn(today).length === 0 && <p className="muted small">Oggi nessun evento.</p>}
          {eventsOn(today).slice(0, 3).map((ev) => (
            <div key={ev.id} className="line">
              <span className="line-time">{ev.allDay ? 'Tutto il giorno' : fmtTime(toDate(ev.start))}</span>
              <Dots colors={colorsOf(ev)} /><span>{ev.title}</span>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="section-head"><h2>Task in scadenza</h2><button type="button" className="link-btn" onClick={() => go('task')}>Tutti</button></div>
          {urgent.length === 0 && <p className="muted small">Nessun task in scadenza nei prossimi giorni.</p>}
          {urgent.map((t) => (
            <div key={t.id} className="line spread">
              <span><span className="strong">{t.title}</span><br /><span className="muted small">{(members.find((m) => m.uid === t.assignedTo) || {}).displayName}</span></span>
              <Badge tone={dueTone(toDate(t.dueDate))}>{relativeDue(toDate(t.dueDate))}</Badge>
            </div>
          ))}
        </section>

        <div className="two-cards">
          <button type="button" className="card tile" onClick={() => go('altro', 'reminder')}>
            <span className="tile-head"><Icon name="bell" size={16} /> Prossimo reminder</span>
            {mine ? (<>
              <span className="tile-big">{mine.r.time}</span>
              <span className="strong">{mine.r.title}</span>
              <span className="muted small">{describeTrigger(mine.next)} · {recipientsLabel(mine.r, members)}</span>
            </>) : <span className="muted small">Nessun reminder attivo.</span>}
          </button>
          <button type="button" className="card tile" onClick={() => go('altro', 'scadenze')}>
            <span className="tile-head"><Icon name="wrench" size={16} /> Scadenze</span>
            {maint ? (<>
              <Badge tone={dueTone(toDate(maint.nextDate))}>{relativeDue(toDate(maint.nextDate))}</Badge>
              <span className="strong">{maint.title}</span>
              <span className="muted small">{maint.category}</span>
            </>) : <span className="muted small">Nessuna scadenza.</span>}
          </button>
        </div>

        <section className="card">
          <div className="section-head"><h2>Obiettivi</h2><button type="button" className="link-btn" onClick={() => go('altro', 'obiettivi')}>Tutti</button></div>
          {goals.length === 0 && <p className="muted small">Nessun obiettivo in corso.</p>}
          {goals.map((o) => (
            <div key={o.id} className="goal-line">
              <div className="spread small"><span className="strong">{o.title}</span><span className="strong">{o.progress || 0}%</span></div>
              <span className="bar" aria-hidden="true"><span style={{ width: `${o.progress || 0}%` }} /></span>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
