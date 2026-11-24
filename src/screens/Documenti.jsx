import { useState } from 'react'
import { addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useFamilyCol } from '../lib/data.js'
import { dueTone, fmtDateShort, inputDate, parseInputDate, relativeDue, time, toDate } from '../lib/dates.js'
import { Badge, Chips, Empty, ErrorNote, Fab, Field, FormActions, Icon, ScreenHeader, Sheet, useToast } from '../ui.jsx'

const CATEGORIES = ['Assicurazioni', 'Certificati', 'Polizze', 'Proprietà', 'Medico']

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(ta)
    return ok
  }
}

export default function Documenti({ onBack }) {
  const { isParent } = useFamily()
  const { docs, error } = useFamilyCol('documents')
  const [cat, setCat] = useState('Tutti')
  const [edit, setEdit] = useState(null)
  const [toast, showToast] = useToast()

  const items = docs.filter((d) => cat === 'Tutti' || d.category === cat)
    .sort((a, b) => (a.expiryDate ? time(a.expiryDate) : Infinity) - (b.expiryDate ? time(b.expiryDate) : Infinity))

  async function copy(number) {
    showToast((await copyText(number)) ? 'Numero copiato negli appunti' : 'Copia non riuscita')
  }

  return (
    <>
      <ScreenHeader title="Documenti" onBack={onBack} />
      <div className="content">
        <Chips options={['Tutti', ...CATEGORIES]} value={cat} onChange={setCat} />
        <ErrorNote error={error} />
        {items.length === 0 && <Empty>Nessun documento{cat !== 'Tutti' ? ' in questa categoria' : ''}.</Empty>}
        {items.map((d) => {
          const exp = d.expiryDate ? toDate(d.expiryDate) : null
          return (
            <div key={d.id} className="card doc">
              <div className="card-head">
                <div>
                  <div className="small muted strong">{d.category}</div>
                  <div className="card-title">{d.title}</div>
                </div>
                {exp && <Badge tone={dueTone(exp)}>{relativeDue(exp)}</Badge>}
              </div>
              {d.number && (
                <div className="docnum">
                  <div><span className="small muted strong">N. documento</span><span className="num">{d.number}</span></div>
                  <button type="button" className="icon-btn" aria-label={`Copia il numero di ${d.title}`} onClick={() => copy(d.number)}><Icon name="copy" /></button>
                </div>
              )}
              {d.description && <p className="small">{d.description}</p>}
              <div className="btn-row">
                {d.link && <a className="btn btn-outline" href={d.link} target="_blank" rel="noopener noreferrer"><Icon name="link" size={16} /> Apri allegato</a>}
                {exp && <span className="muted small">Scade il {fmtDateShort(exp)}</span>}
                {isParent && <button type="button" className="btn btn-quiet" onClick={() => setEdit(d.id)}>Modifica</button>}
              </div>
            </div>
          )
        })}
      </div>
      {toast}
      {isParent && <Fab label="Nuovo documento" onClick={() => setEdit('new')} />}
      {edit && <DocSheet item={docs.find((d) => d.id === edit)} onClose={() => setEdit(null)} />}
    </>
  )
}

function DocSheet({ item, onClose }) {
  const { me } = useFamily()
  const isNew = !item
  const [title, setTitle] = useState(item ? item.title : '')
  const [category, setCategory] = useState(item ? item.category : CATEGORIES[0])
  const [number, setNumber] = useState(item ? item.number || '' : '')
  const [expiry, setExpiry] = useState(item && item.expiryDate ? inputDate(toDate(item.expiryDate)) : '')
  const [description, setDescription] = useState(item ? item.description || '' : '')
  const [link, setLink] = useState(item ? item.link || '' : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Scrivi un titolo.'); return }
    setBusy(true); setErr('')
    try {
      const data = {
        title: title.trim(), category, number: number.trim(), description: description.trim(), link: link.trim(),
        expiryDate: expiry ? Timestamp.fromDate(parseInputDate(expiry)) : null, updatedAt: serverTimestamp(),
      }
      if (isNew) await addDoc(famCol('documents'), { ...data, createdBy: me.uid, createdAt: serverTimestamp() })
      else await updateDoc(famDoc('documents', item.id), data)
      onClose()
    } catch { setErr('Salvataggio non riuscito. Riprova.'); setBusy(false) }
  }
  async function remove() {
    if (!window.confirm('Eliminare questo documento?')) return
    setBusy(true)
    try { await deleteDoc(famDoc('documents', item.id)); onClose() } catch { setErr('Eliminazione non riuscita.'); setBusy(false) }
  }

  return (
    <Sheet title={isNew ? 'Nuovo documento' : 'Modifica documento'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Titolo" htmlFor="d-title"><input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Categoria" htmlFor="d-cat">
          <select id="d-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Numero del documento" htmlFor="d-num"><input id="d-num" value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" /></Field>
        <Field label="Scadenza (facoltativa)" htmlFor="d-exp"><input id="d-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
        <Field label="Note" htmlFor="d-desc"><textarea id="d-desc" rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Link al file (facoltativo)" htmlFor="d-link" hint="Per ora gli allegati sono link, per esempio a un file su Google Drive.">
          <input id="d-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
        {err && <p className="error" role="alert">{err}</p>}
        <FormActions busy={busy} onDelete={isNew ? null : remove} />
      </form>
    </Sheet>
  )
}
