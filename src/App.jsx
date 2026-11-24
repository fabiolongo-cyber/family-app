import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, FAMILY_ID } from './firebase.js'

const INACTIVITY_MS = 15 * 60 * 1000
const buildTime = new Date(__BUILD_TIME__).toLocaleString('it-IT')

function errorMessage(err) {
  switch (err && err.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email o password non corretti.'
    case 'auth/too-many-requests':
      return 'Troppi tentativi. Riprova tra qualche minuto.'
    case 'auth/network-request-failed':
      return 'Nessuna connessione. Controlla internet e riprova.'
    default:
      return 'Qualcosa è andato storto. Riprova.'
  }
}

function Logo() {
  return (
    <div className="logo" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    </div>
  )
}

function Footer() {
  return <p className="meta">Versione 0.2.0 · compilata il {buildTime}</p>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Scrivi la tua email, poi tocca "Password dimenticata?".')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo("Se l'email è registrata, riceverai un link per scegliere una nuova password.")
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <main className="screen">
      <Logo />
      <h1>FamilyApp</h1>
      <p className="lead">Calendario, task, spesa e documenti: tutta la famiglia allineata.</p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" inputMode="email"
                 value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password"
                 value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {info && <p className="info" role="status">{info}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Accesso in corso…' : 'Accedi'}
        </button>
        <button className="btn btn-quiet" type="button" onClick={handleReset}>
          Password dimenticata?
        </button>
      </form>
      <Footer />
    </main>
  )
}

const ROLES = { parent: 'Genitore', child: 'Figlio' }

function Home({ user }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [fam, mem] = await Promise.all([
          getDoc(doc(db, 'families', FAMILY_ID)),
          getDoc(doc(db, 'families', FAMILY_ID, 'members', user.uid)),
        ])
        if (cancelled) return
        if (!fam.exists() || !mem.exists()) {
          setState({ status: 'missing' })
        } else {
          setState({ status: 'ok', family: fam.data(), member: mem.data() })
        }
      } catch (err) {
        if (!cancelled) setState({ status: 'error', code: err.code || 'unknown' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [user.uid])

  return (
    <main className="screen">
      <Logo />
      {state.status === 'loading' && <p className="lead">Caricamento…</p>}

      {state.status === 'ok' && (
        <>
          <h1>Ciao, {state.member.displayName}</h1>
          <p className="lead">{ROLES[state.member.role] || state.member.role}</p>
          <div className="card ok" role="status">
            <strong>Database collegato</strong>
            <span>Famiglia: {state.family.name}</span>
          </div>
        </>
      )}

      {state.status === 'missing' && (
        <>
          <h1>Quasi pronto</h1>
          <div className="card warn" role="alert">
            <strong>Account non collegato alla famiglia</strong>
            <span>Mancano i dati della famiglia nel database. Controlla il passaggio 3 delle istruzioni.</span>
          </div>
        </>
      )}

      {state.status === 'error' && (
        <>
          <h1>Database non raggiungibile</h1>
          <div className="card warn" role="alert">
            <strong>Errore: {state.code}</strong>
            <span>
              {state.code === 'permission-denied'
                ? "Accesso negato: le regole di sicurezza non sono state pubblicate oppure il tuo account non è tra i membri della famiglia."
                : 'Controlla la connessione e riprova.'}
            </span>
          </div>
        </>
      )}

      <button className="btn btn-quiet" type="button" onClick={() => signOut(auth)}>
        Esci
      </button>
      <p className="meta">{user.email}</p>
      <Footer />
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = sto controllando, null = non loggato

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])

  // Uscita automatica dopo 15 minuti di inattivita'
  useEffect(() => {
    if (!user) return undefined
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => signOut(auth), INACTIVITY_MS)
    }
    const events = ['click', 'touchstart', 'keydown']
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((ev) => window.removeEventListener(ev, reset))
    }
  }, [user])

  if (user === undefined) {
    return (
      <main className="screen">
        <Logo />
        <p className="lead">Caricamento…</p>
      </main>
    )
  }
  return user ? <Home user={user} /> : <Login />
}
