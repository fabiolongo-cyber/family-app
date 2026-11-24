import { useEffect, useState } from 'react'
import { sendPasswordResetEmail, signOut } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, FAMILY_ID } from '../firebase.js'
import { useFamily } from '../context.jsx'
import { slug, useDocTypes } from '../lib/data.js'
import { biometricAvailable, biometricUnlock } from '../lib/native.js'
import { Avatar, Icon, ScreenHeader } from '../ui.jsx'

const buildTime = new Date(__BUILD_TIME__).toLocaleString('it-IT')
const ROLES = { parent: 'Genitore', child: 'Figlio' }

export default function Impostazioni({ onBack }) {
  const { user, me, members, family, isParent, bio, setBio } = useFamily()
  const loadedTypes = useDocTypes()
  const types = loadedTypes || []
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [bioOk, setBioOk] = useState(false)
  const [newType, setNewType] = useState('')
  const [typeErr, setTypeErr] = useState('')

  useEffect(() => { biometricAvailable().then(setBioOk) }, [])

  async function resetPassword() {
    setMsg(''); setErr('')
    try {
      await sendPasswordResetEmail(auth, user.email)
      setMsg(`Ti abbiamo inviato un'email a ${user.email} con il link per cambiare la password.`)
    } catch { setErr("Non sono riuscito a inviare l'email. Riprova.") }
  }

  async function toggleBio() {
    setErr('')
    if (bio) { setBio(false); return }
    if (await biometricUnlock()) setBio(true)
    else setErr('Verifica non riuscita: lo sblocco non è stato attivato.')
  }

  async function saveTypes(items) {
    setTypeErr('')
    try {
      await setDoc(doc(db, 'families', FAMILY_ID, 'settings', 'documentTypes'), { items, updatedAt: serverTimestamp() })
    } catch { setTypeErr('Non sono riuscito a salvare le voci.') }
  }
  async function addType(e) {
    e.preventDefault()
    const name = newType.trim()
    if (!name || loadedTypes === null) return
    if (types.some((t) => slug(t.name) === slug(name))) { setTypeErr('Questa voce esiste già.'); return }
    await saveTypes([...types, { id: slug(name), name }])
    setNewType('')
  }
  const removeType = (t) => {
    if (window.confirm(`Togliere la voce "${t.name}"? I documenti già inseriti restano in "Altri documenti".`)) saveTypes(types.filter((x) => x.id !== t.id))
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

        {isParent && (
          <section className="card">
            <h2>Voci dei documenti</h2>
            {types.map((t) => (
              <div key={t.id} className="line spread">
                <span className="strong">{t.name}</span>
                <button type="button" className="icon-btn" aria-label={`Togli la voce ${t.name}`} onClick={() => removeType(t)}><Icon name="trash" size={20} /></button>
              </div>
            ))}
            <form className="note-form" onSubmit={addType}>
              <label className="sr" htmlFor="new-type">Nuova voce</label>
              <input id="new-type" placeholder="Nuova voce, per esempio Passaporto" value={newType} onChange={(e) => setNewType(e.target.value)} />
              <button className="btn btn-primary" type="submit">Aggiungi</button>
            </form>
            {typeErr && <p className="error" role="alert">{typeErr}</p>}
          </section>
        )}

        <section className="card">
          <h2>Sicurezza</h2>
          {bioOk ? (
            <button type="button" role="switch" aria-checked={bio} className="switch-row" onClick={toggleBio}>
              <span><span className="strong">Sblocca con impronta o Face ID</span><br /><span className="muted small">Al posto della password dopo un periodo di inattività.</span></span>
              <span className={'switch static' + (bio ? ' on' : '')}><span /></span>
            </button>
          ) : (
            <p className="muted small">Lo sblocco con impronta o riconoscimento del volto è disponibile nell&apos;app Android. Su iPhone puoi usare Face ID per compilare la password salvata.</p>
          )}
          <button type="button" className="btn btn-outline" onClick={resetPassword}>Cambia la password via email</button>
          {msg && <p className="info" role="status">{msg}</p>}
          {err && <p className="error" role="alert">{err}</p>}
          <button type="button" className="btn btn-danger-outline" onClick={() => signOut(auth)}>Esci</button>
        </section>

        <p className="meta">Versione 0.4.0 · compilata il {buildTime}</p>
      </div>
    </>
  )
}
