export const pad = (n) => String(n).padStart(2, '0')

export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const DAYS_SHORT = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
export const DAYS_LONG = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

export function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  return new Date(v)
}
export const time = (v) => { const d = toDate(v); return d ? d.getTime() : 0 }

export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function addMonths(d, n) {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1)
  x.setMonth(x.getMonth() + n)
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, last))
  return x
}
export const mondayOf = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7))
export const weekdayIndex = (d) => (d.getDay() + 6) % 7 // lunedi = 0

export const fmtDateLong = (d) => `${DAYS_LONG[weekdayIndex(d)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
export const fmtDateShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const inputDate = (d) => dayKey(d)
export function parseInputDate(s, t = '00:00') {
  const [y, m, dd] = s.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return new Date(y, m - 1, dd, h || 0, mi || 0)
}
export const daysFromToday = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000)

export function relativeDue(d) {
  const n = daysFromToday(d)
  if (n < 0) return n === -1 ? 'Scaduto ieri' : `Scaduto da ${-n} giorni`
  if (n === 0) return 'Oggi'
  if (n === 1) return 'Domani'
  if (n < 8) return `Tra ${n} giorni`
  return fmtDateShort(d)
}
// 'late' | 'soon' | 'ok' per scegliere il colore del badge
export function dueTone(d) {
  const n = daysFromToday(d)
  if (n < 0) return 'late'
  if (n <= 14) return 'soon'
  return 'ok'
}

// L'evento (eventualmente ricorrente) cade nel giorno indicato?
export function occursOn(ev, day) {
  const start = toDate(ev.start)
  if (!start) return false
  const d0 = startOfDay(start)
  const d = startOfDay(day)
  if (d < d0) return false
  const rec = ev.recurrence || 'none'
  if (rec === 'none') return d.getTime() === d0.getTime()
  const until = ev.until ? startOfDay(toDate(ev.until)) : null
  if (until && d > until) return false
  const diff = Math.round((d - d0) / 86400000)
  if (rec === 'daily') return true
  if (rec === 'weekly') return diff % 7 === 0
  if (rec === 'monthly') return d.getDate() === d0.getDate()
  if (rec === 'yearly') return d.getDate() === d0.getDate() && d.getMonth() === d0.getMonth()
  return false
}

export function nextOccurrence(date, rec) {
  if (rec === 'daily') return addDays(date, 1)
  if (rec === 'weekly') return addDays(date, 7)
  if (rec === 'monthly') return addMonths(date, 1)
  return date
}

// Prossimo avviso di un reminder
export function nextTrigger(r, now = new Date()) {
  const [h, m] = (r.time || '00:00').split(':').map(Number)
  const at = (d) => { const x = startOfDay(d); x.setHours(h, m, 0, 0); return x }
  const freq = r.frequency || 'daily'
  if (freq === 'once') {
    const d = toDate(r.date)
    if (!d) return null
    const t = at(d)
    return t >= now ? t : null
  }
  const anchor = toDate(r.date)
  for (let i = 0; i < 400; i++) {
    const d = addDays(startOfDay(now), i)
    const t = at(d)
    if (t < now) continue
    if (freq === 'daily') return t
    if (freq === 'weekly' && (r.days || []).includes(weekdayIndex(d))) return t
    if (freq === 'monthly' && anchor && d.getDate() === anchor.getDate()) return t
  }
  return null
}

export function describeTrigger(t) {
  if (!t) return 'Nessun prossimo avviso'
  const n = daysFromToday(t)
  const hh = fmtTime(t)
  if (n === 0) return `Oggi ${hh}`
  if (n === 1) return `Domani ${hh}`
  return `${fmtDateLong(t)} ${hh}`
}

export function describeFrequency(r) {
  switch (r.frequency) {
    case 'once': return 'Una volta'
    case 'daily': return 'Ogni giorno'
    case 'weekly': return (r.days || []).map((i) => DAYS_LONG[i].slice(0, 3)).join(', ') || 'Ogni settimana'
    case 'monthly': return 'Ogni mese'
    default: return ''
  }
}
