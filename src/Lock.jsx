import { useEffect, useState } from 'react'
import { biometricUnlock } from './lib/native.js'
import { Icon } from './ui.jsx'

// Schermata di blocco: si sblocca con impronta o riconoscimento del volto
export default function Lock({ onUnlock, onPassword }) {
  const [failed, setFailed] = useState(false)

  async function tryUnlock() {
    setFailed(false)
    if (await biometricUnlock()) onUnlock()
    else setFailed(true)
  }
  useEffect(() => { tryUnlock() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="screen">
      <div className="logo" aria-hidden="true"><Icon name="lock" size={40} /></div>
      <h1>FamilyApp è bloccata</h1>
      <p className="lead">Usa l&apos;impronta o il riconoscimento del volto per continuare.</p>
      {failed && <p className="error" role="alert">Verifica non riuscita. Riprova.</p>}
      <button type="button" className="btn btn-primary" onClick={tryUnlock}><Icon name="fingerprint" /> Sblocca</button>
      <button type="button" className="btn btn-quiet" onClick={onPassword}>Accedi con la password</button>
    </main>
  )
}
