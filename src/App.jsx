import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, FAMILY_ID } from './firebase.js'
import { FamilyContext, PALETTE } from './context.jsx'
import { useFamilyCol } from './lib/data.js'
import { Icon } from './ui.jsx'
import Login, { Logo } from './Login.jsx'
import Home from './screens/Home.jsx'
import Calendario from './screens/Calendario.jsx'
import Task from './screens/Task.jsx'
import Spesa from './screens/Spesa.jsx'
import Altro from './screens/Altro.jsx'
import Manutenzione from './screens/Manutenzione.jsx'
import Obiettivi from './screens/Obiettivi.jsx'
import Documenti from './screens/Documenti.jsx'
import Reminder from './screens/Reminder.jsx'
import Impostazioni from './screens/Impostazioni.jsx'

const INACTIVITY_MS = 15 * 60 * 1000

const TABS = [
  ['home', 'home', 'Home'],
  ['calendario', 'calendar', 'Calendario'],
  ['task', 'task', 'Task'],
  ['spesa', 'cart', 'Spesa'],
  ['altro', 'more', 'Altro'],
]

function Centered({ children }) {
  return <main className="screen"><Logo />{children}</main>
}

function Shell() {
  const [nav, setNav] = useState({ tab: 'home', sub: null })

  const go = (tab, sub = null) => {
    setNav({ tab, sub })
    window.history.pushState({ tab, sub }, '')
  }

  // Il tasto "indietro" di Android torna alla schermata precedente
  useEffect(() => {
    window.history.replaceState({ tab: 'home', sub: null }, '')
    const onPop = (e) => setNav(e.state || { tab: 'home', sub: null })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const back = () => window.history.back()

  let screen
  if (nav.tab === 'home') screen = <Home go={go} />
  else if (nav.tab === 'calendario') screen = <Calendario />
  else if (nav.tab === 'task') screen = <Task />
  else if (nav.tab === 'spesa') screen = <Spesa />
  else if (nav.sub === 'manutenzione') screen = <Manutenzione onBack={back} />
  else if (nav.sub === 'obiettivi') screen = <Obiettivi onBack={back} />
  else if (nav.sub === 'documenti') screen = <Documenti onBack={back} />
  else if (nav.sub === 'reminder') screen = <Reminder onBack={back} />
  else if (nav.sub === 'impostazioni') screen = <Impostazioni onBack={back} />
  else screen = <Altro go={go} />

  return (
    <div className="app">
      <div className="screen-area">{screen}</div>
      <nav className="tabbar" aria-label="Navigazione principale">
        {TABS.map(([key, icon, label]) => (
          <button key={key} type="button" className={'tab' + (nav.tab === key ? ' on' : '')}
                  aria-current={nav.tab === key ? 'page' : undefined} onClick={() => go(key)}>
            <span className="tab-icon"><Icon name={icon} /></span>{label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function FamilyApp({ user }) {
  const [family, setFamily] = useState(undefined)
  const [famError, setFamError] = useState(null)
  const { docs: memberDocs, loading, error } = useFamilyCol('members')

  useEffect(() => {
    let cancelled = false
    getDoc(doc(db, 'families', FAMILY_ID))
      .then((d) => { if (!cancelled) setFamily(d.exists() ? d.data() : null) })
      .catch((e) => { if (!cancelled) setFamError(e) })
    return () => { cancelled = true }
  }, [])

  const members = useMemo(() => {
    const sorted = [...memberDocs].sort((a, b) => (a.id < b.id ? -1 : 1))
    return sorted.map((m, i) => ({ uid: m.id, displayName: m.displayName || 'Senza nome', role: m.role || 'child', color: m.color || PALETTE[i % PALETTE.length] }))
  }, [memberDocs])
  const me = members.find((m) => m.uid === user.uid)

  const ctx = useMemo(() => ({ user, me, members, family, isParent: !!me && me.role === 'parent' }), [user, me, members, family])

  useEffect(() => {
    let timer
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => signOut(auth), INACTIVITY_MS) }
    const events = ['click', 'touchstart', 'keydown']
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); events.forEach((ev) => window.removeEventListener(ev, reset)) }
  }, [])

  if (loading) return <Centered><p className="lead">Caricamento…</p></Centered>

  if (error || famError || !me) {
    const code = (error && error.code) || (famError && famError.code)
    return (
      <Centered>
        <h1>Quasi pronto</h1>
        <div className="card warn" role="alert">
          <strong>{code === 'permission-denied' || !me ? 'Account non collegato alla famiglia' : `Errore: ${code}`}</strong>
          <span>Il tuo account ({user.email}) non risulta tra i membri della famiglia, oppure le regole di sicurezza non sono state pubblicate. Chiedi a un genitore di collegarlo da Firebase.</span>
        </div>
        <button className="btn btn-quiet" type="button" onClick={() => signOut(auth)}>Esci</button>
      </Centered>
    )
  }

  return <FamilyContext.Provider value={ctx}><Shell /></FamilyContext.Provider>
}

export default function App() {
  const [user, setUser] = useState(undefined)
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])
  if (user === undefined) return <Centered><p className="lead">Caricamento…</p></Centered>
  return user ? <FamilyApp user={user} /> : <Login />
}
