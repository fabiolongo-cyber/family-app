import { useState } from 'react'
import { addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useDocTypes, useFamilyCol } from '../lib/data.js'
import { dueTone, fmtDateShort, inputDate, parseInputDate, relativeDue, time, toDate } from '../lib/dates.js'
import { Avatar, Badge, Chips, ErrorNote, Fab, Field, FormActions, Icon, ScreenHeader, Sheet, useToast } from '../ui.jsx'

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
  const { isParent, members } = useFamily()
  const loadedTypes = useDocTypes()
  const types = loadedTypes || []
  const { docs, error } = useFamilyCol('documents')
  const [filter, setFilter] = useState('Tutti')
  const [edit, setEdit] = useState(null) // null | { id } | { id: null, typeId }
  const [toast, showToast] = useToast()

  async function copy(number) {
    showToast((await copyText(number)) ? 'Numero copiato negli appunti' : 'Copia non riuscita')
  }

  const typeIds = new Set(types.map((t) => t.id))
  const typeOf = (d) => d.typeId || (types.find((t) => t.name === d.category) || {}).id
  const sorted = (arr) => [...arr].sort((a, b) => (a.expiryDate ? time(a.expiryDate) : Infinity) - (b.expiryDate ? time(b.expiryDate) : Infinity))
  const groups = types.map((t) => ({ id: t.id, name: t.name, docs: sorted(docs.filter((d) => typeOf(d) === t.id)) }))
  const others = sorted(docs.filter((d) => !typeIds.has(typeOf(d))))
  const visible = groups.filter((g) => filter === 'Tutti' || g.name === filter)

  const card = (d) => {
    const exp = d.expiryDate ? toDate(d.expiryDate) : null
    const owner = members.find((m) => m.uid === d.ownerId)
    return (
      <div key={d.id} className="card doc">
        <div className="card-head">
          <div className="owner">
            {owner ? <Avatar member={owner} size={28} /> : null}
            <div className="card-title">{owner ? owner.displayName : (d.title || 'Tutta la famiglia')}</div>
          </div>
          {exp && <Badge tone={dueTone(exp)}>{relativeDue(exp)}</Badge>}
        </div>
        {d.number ? (
          <div className="docnum">
            <div><span className="small muted strong">N. documento</span><span className="num">{d.number}</span></div>
            <button type="button" className="icon-btn" aria-label={`Copia il numero: ${d.typeName || d.title || 'documento'}`} onClick={() => copy(d.number)}><Icon name="copy" /></button>
          </div>
        ) : <p className="muted small">Numero non inserito.</p>}
        {d.description && <p className="small">{d.description}</p>}
        <div className="btn-row">
          {d.link && <a className="btn btn-outline" href={d.link} target="_blank" rel="noopener noreferrer"><Icon name="link" size={16} /> Apri allegato</a>}
          {exp && <span className="muted small">Scade il {fmtDateShort(exp)}</span>}
          {isParent && <button type="button" className="btn btn-quiet" onClick={() => setEdit({ id: d.id })}>Modifica</button>}
        </div>
      </div>
    )
  }

  return (
    <>
      <ScreenHeader title="Documenti" onBack={onBack} />
      <div className="content">
        <Chips options={['Tutti', ...types.map((t) => t.name)]} value={filter} onChange={setFilter} />
        <ErrorNote error={error} />
        {loadedTypes === null && <p className="muted small">Caricamento…</p>}
        {visible.map((g) => (
          <section key={g.id} className="doc-group">
            <div className="section-head">
              <h2>{g.name}</h2>
              {isParent && <button type="button" className="link-btn" onClick={() => setEdit({ id: null, typeId: g.id })} aria-label={`Aggiungi un documento: ${g.name}`}>+ Aggiungi</button>}
            </div>
            {g.docs.length === 0 && <p className="muted small">Nessun documento inserito.</p>}
            {g.docs.map(card)}
          </section>
        ))}
        {filter === 'Tutti' && others.length > 0 && (
          <section className="doc-group">
            <div className="section-head"><h2>Altri documenti</h2></div>
            {others.map(card)}
          </section>
        )}
        {isParent && <p className="hint">Puoi aggiungere o togliere le voci da Altro → Impostazioni.</p>}
      </div>
      {toast}
      {isParent && <Fab label="Nuovo documento" onClick={() => setEdit({ id: null, typeId: types[0] ? types[0].id : '' })} />}
      {edit && <DocSheet item={edit.id ? docs.find((d) => d.id === edit.id) : null} typeId={edit.typeId} types={types} onClose={() => setEdit(null)} />}
    </>
  )
}

function DocSheet({ item, typeId, types, onClose }) {
  const { me, members } = useFamily()
  const isNew = !item
  const [type, setType] = useState(item ? (item.typeId || (types.find((t) => t.name === item.category) || {}).id || '') : typeId)
  const [owner, setOwner] = useState(item ? item.ownerId || '' : '')
  const [number, setNumber] = useState(item ? item.number || '' : '')
  const [expiry, setExpiry] = useState(item && item.expiryDate ? inputDate(toDate(item.expiryDate)) : '')
  const [description, setDescription] = useState(item ? item.description || '' : '')
  const [link, setLink] = useState(item ? item.link || '' : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!type) { setErr('Scegli la voce del documento.'); return }
    setBusy(true); setErr('')
    try {
      const t = types.find((x) => x.id === type)
      const data = {
        typeId: type, typeName: t ? t.name : '', ownerId: owner || null, number: number.trim(),
        description: description.trim(), link: link.trim(),
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
        <Field label="Voce" htmlFor="d-type">
          <select id="d-type" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Intestatario" htmlFor="d-owner">
          <select id="d-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Tutta la famiglia</option>
            {members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
          </select>
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
