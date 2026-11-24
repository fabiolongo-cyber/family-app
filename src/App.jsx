const buildTime = new Date(__BUILD_TIME__).toLocaleString('it-IT')

export default function App() {
  return (
    <main className="screen">
      <div className="logo" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      </div>
      <h1>FamilyApp</h1>
      <p className="lead">
        L'app si installa e si avvia: la compilazione automatica su GitHub funziona.
      </p>
      <p className="meta">Versione 0.1.0 · compilata il {buildTime}</p>
    </main>
  )
}
