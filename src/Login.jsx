import { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from './firebase.js'
import { Icon } from './ui.jsx'

const buildTime = new Date(__BUILD_TIME__).toLocaleString('it-IT')

export function Logo() {
  return <div className="logo" aria-hidden="true"><Icon name="home" size={40} /></div>
}

export function errorMessage(err) {
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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    setError(''); setInfo('')
    if (!email.trim()) { setError('Scrivi la tua email, poi tocca "Password dimenticata?".'); return }
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
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Accesso in corso…' : 'Accedi'}</button>
        <button className="btn btn-quiet" type="button" onClick={handleReset}>Password dimenticata?</button>
      </form>
      <p className="meta">Versione 0.3.0 · compilata il {buildTime}</p>
    </main>
  )
}
