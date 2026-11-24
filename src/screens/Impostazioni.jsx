import { useState } from 'react'
import { sendPasswordResetEmail, signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useFamily } from '../context.jsx'
import { Avatar, ScreenHeader } from '../ui.jsx'

const buildTime = new Date(__BUILD_TIME__).toLocaleString('it-IT')
const ROLES = { parent: 'Genitore', child: 'Figlio' }

export default function Impostazioni({ onBack }) {
  const { user, me, members, family } = useFamily()
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function resetPassword() {
    setMsg(''); setErr('')
    try {
      await sendPasswordResetEmail(auth, user.email)
      setMsg(`Ti abbiamo inviato un'email a ${user.email} con il link per cambiare la password.`)
    } catch { setErr('Non sono riuscito a inviare l\'email. Riprova.') }
  }

  return (
    <>
      <ScreenHeader title="Impostazioni" onBack={onBack} />
      <div className="content">
        <section className="card profile">
          <Avatar member={me} size={56} />
          <div>
            <div className="card-title">{me.displayName}</div>
            <div className="muted small">{ROLES[me.role] || me.role} · {user.email}</div>
          </div>
        </section>

        <section className="card">
          <h2>Famiglia {family && family.name ? `· ${family.name}` : ''}</h2>
          {members.map((m) => (
            <div key={m.uid} className="line">
              <Avatar member={m} size={28} /><span className="strong">{m.displayName}</span>
              <span className="muted small">{ROLES[m.role] || m.role}</span>
            </div>
          ))}
          <p className="hint">Per aggiungere o cambiare un membro serve la console di Firebase.</p>
        </section>

        <section className="card">
          <h2>Account</h2>
          <button type="button" className="btn btn-outline" onClick={resetPassword}>Cambia la password via email</button>
          {msg && <p className="info" role="status">{msg}</p>}
          {err && <p className="error" role="alert">{err}</p>}
          <button type="button" className="btn btn-danger-outline" onClick={() => signOut(auth)}>Esci</button>
        </section>

        <p className="meta">Versione 0.3.0 · compilata il {buildTime}</p>
      </div>
    </>
  )
}
