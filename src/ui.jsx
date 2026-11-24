import { useEffect, useState } from 'react'

const ICONS = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  task: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12l3 3 5-6" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11L21 7H6" /></>,
  more: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  back: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  repeat: <><path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2" /><path d="M20 4v5h-5M4 20v-5h5" /></>,
  note: <path d="M4 5h16v11H9l-5 4z" />,
  check: <path d="M5 12l5 5 9-10" />,
}

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export function initials(name = '') {
  const p = name.trim().split(/\s+/)
  return ((p[0] && p[0][0]) || '?').toUpperCase() + ((p[1] && p[1][0]) || '').toUpperCase()
}

export function Avatar({ member, size = 28 }) {
  const name = (member && member.displayName) || '?'
  return (
    <span className="avatar" title={name}
          style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: (member && member.color) || '#5C6470' }}>
      {initials(name)}
    </span>
  )
}

export function Dots({ colors }) {
  return (
    <span className="dots">
      {colors.slice(0, 3).map((c, i) => <span key={i} className="dot" style={{ background: c }} />)}
    </span>
  )
}

export function ScreenHeader({ title, subtitle, onBack, right }) {
  return (
    <header className="topbar">
      {onBack && (
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Indietro"><Icon name="back" size={24} /></button>
      )}
      <div className="topbar-title">
        {subtitle && <div className="subtitle">{subtitle}</div>}
        <h1>{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
                className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o}
                className={'chip' + (value === o ? ' on' : '')} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={'badge ' + tone}>{children}</span>
}

export function Fab({ label, onClick }) {
  return (
    <button type="button" className="fab" aria-label={label} onClick={onClick}><Icon name="plus" size={26} /></button>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function ErrorNote({ error }) {
  if (!error) return null
  return (
    <p className="error" role="alert">
      {error.code === 'permission-denied'
        ? 'Non hai il permesso di vedere questi dati (controlla le regole di sicurezza).'
        : `Errore: ${error.code || error.message}`}
    </p>
  )
}

export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function PersonPicker({ members, value, onChange, single = false }) {
  const toggle = (uid) => {
    if (single) { onChange([uid]); return }
    onChange(value.includes(uid) ? value.filter((x) => x !== uid) : [...value, uid])
  }
  return (
    <div className="chips">
      {members.map((m) => (
        <button key={m.uid} type="button" aria-pressed={value.includes(m.uid)}
                className={'chip person' + (value.includes(m.uid) ? ' on' : '')} onClick={() => toggle(m.uid)}>
          <span className="dot" style={{ background: m.color }} />{m.displayName}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Chiudi"><Icon name="close" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function useToast() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!msg) return undefined
    const t = setTimeout(() => setMsg(''), 2200)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="toast" role="status"><Icon name="check" size={18} />{msg}</div> : null
  return [node, setMsg]
}

export function FormActions({ onDelete, busy, saveLabel = 'Salva' }) {
  return (
    <div className="form-actions">
      {onDelete && <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>Elimina</button>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Salvataggio…' : saveLabel}</button>
    </div>
  )
}
