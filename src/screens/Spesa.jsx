import { useEffect, useMemo, useState } from 'react'
import { addDoc, deleteDoc, increment, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, slug, useFamilyCol } from '../lib/data.js'
import { fmtDateShort, time, toDate } from '../lib/dates.js'
import { listen, parseItems, voiceAvailable } from '../lib/native.js'
import { Empty, ErrorNote, Icon, ScreenHeader, Sheet, SwipeRow, useSnack } from '../ui.jsx'

export default function Spesa() {
  const { me, members } = useFamily()
  const { docs: items, error } = useFamilyCol('shopping')
  const { docs: history } = useFamilyCol('shoppingHistory')
  const { docs: lists } = useFamilyCol('shoppingLists')
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [showBought, setShowBought] = useState(false)
  const [err, setErr] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState([])
  const [sheet, setSheet] = useState(null) // null | 'clear' | 'history' | 'voice'
  const [voiceText, setVoiceText] = useState('')
  const [canVoice, setCanVoice] = useState(false)
  const [listening, setListening] = useState(false)
  const [snack, showSnack] = useSnack()

  useEffect(() => { voiceAvailable().then(setCanVoice) }, [])

  const pending = items.filter((i) => i.status !== 'purchased').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
  const bought = items.filter((i) => i.status === 'purchased').sort((a, b) => time(b.purchasedAt) - time(a.purchasedAt))
  const nameOf = (uid) => (members.find((m) => m.uid === uid) || {}).displayName
  const pendingKeys = useMemo(() => new Set(pending.map((i) => slug(i.title))), [pending])

  const suggestions = useMemo(() => history
    .filter((h) => !pendingKeys.has(slug(h.title)))
    .sort((a, b) => (b.count || 0) - (a.count || 0) || time(b.lastAt) - time(a.lastAt))
    .slice(0, 10), [history, pendingKeys])

  // ---- aggiunta ----
  async function addItems(list) {
    setErr('')
    const fresh = []
    const seen = new Set(pendingKeys)
    list.forEach((it) => {
      const key = slug(it.title)
      if (!it.title || seen.has(key)) return
      seen.add(key)
      fresh.push(it)
    })
    try {
      let base = Date.now()
      for (const it of fresh) {
        await addDoc(famCol('shopping'), {
          title: it.title, quantity: it.quantity || '', note: it.note || '', status: 'pending',
          addedBy: me.uid, orderIndex: base++, createdAt: serverTimestamp(),
        })
        await setDoc(famDoc('shoppingHistory', slug(it.title)), {
          title: it.title, quantity: it.quantity || '', note: it.note || '', count: increment(1), lastAt: serverTimestamp(),
        }, { merge: true })
      }
    } catch { setErr('Non sono riuscito ad aggiungere i prodotti.') }
    return fresh.length
  }

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    await addItems([{ title: title.trim(), quantity: qty.trim(), note: note.trim() }])
    setTitle(''); setQty(''); setNote('')
  }

  // ---- spunta ----
  async function toggle(item) {
    if (selecting) { toggleSelect(item.id); return }
    try {
      if (item.status === 'purchased') {
        await updateDoc(famDoc('shopping', item.id), { status: 'pending', purchasedBy: null, purchasedAt: null, updatedAt: serverTimestamp() })
      } else {
        await updateDoc(famDoc('shopping', item.id), { status: 'purchased', purchasedBy: me.uid, purchasedAt: Timestamp.now(), updatedAt: serverTimestamp() })
      }
    } catch { setErr('Non sono riuscito ad aggiornare il prodotto.') }
  }

  // ---- eliminazione ----
  const payload = (i) => ({
    title: i.title, quantity: i.quantity || '', note: i.note || '', status: i.status || 'pending',
    addedBy: i.addedBy || me.uid, orderIndex: i.orderIndex || Date.now(), createdAt: serverTimestamp(),
  })
  async function restore(list) {
    try { for (const d of list) await addDoc(famCol('shopping'), d) } catch { setErr('Non sono riuscito a ripristinare.') }
  }
  async function removeMany(list, label) {
    const backup = list.map(payload)
    try {
      await Promise.all(list.map((i) => deleteDoc(famDoc('shopping', i.id))))
      showSnack(label, 'Annulla', () => restore(backup))
    } catch { setErr('Eliminazione non riuscita.') }
  }
  const removeOne = (item) => removeMany([item], `"${item.title}" eliminato`)

  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const startSelect = (item) => { setSelecting(true); setSelected([item.id]) }
  const stopSelect = () => { setSelecting(false); setSelected([]) }
  async function deleteSelected() {
    const list = items.filter((i) => selected.includes(i.id))
    stopSelect()
    await removeMany(list, `${list.length} ${list.length === 1 ? 'prodotto eliminato' : 'prodotti eliminati'}`)
  }

  // Svuota la lista conservando una copia tra le "liste precedenti"
  async function clearList(mode) {
    const list = mode === 'bought' ? bought : items
    setSheet(null)
    if (list.length === 0) return
    try {
      await addDoc(famCol('shoppingLists'), {
        items: list.map((i) => ({ title: i.title, quantity: i.quantity || '', note: i.note || '' })),
        createdAt: serverTimestamp(), createdBy: me.uid,
      })
    } catch { setErr('Non sono riuscito a salvare la lista precedente.') }
    await removeMany(list, mode === 'bought' ? 'Prodotti comprati eliminati' : 'Lista svuotata')
  }

  // ---- dettatura ----
  async function dictate() {
    setErr('')
    setListening(true)
    try {
      const text = await listen()
      const parsed = parseItems(text)
      if (parsed.length === 0) setErr('Non ho sentito nessun prodotto. Riprova.')
      else { setVoiceText(parsed.join('\n')); setSheet('voice') }
    } catch (e) {
      setErr(e && e.message === 'permission' ? 'Serve il permesso per usare il microfono.' : 'La dettatura non è disponibile.')
    }
    setListening(false)
  }

  const renderRow = (item, done) => {
    const isSel = selected.includes(item.id)
    return (
      <SwipeRow key={item.id} disabled={selecting} onDelete={() => removeOne(item)} onLongPress={() => !selecting && startSelect(item)}>
        <button type="button" className={'shop-row' + (done ? ' done' : '') + (isSel ? ' sel' : '')} onClick={() => toggle(item)}
                aria-pressed={selecting ? isSel : undefined} onContextMenu={(e) => e.preventDefault()}>
          {selecting
            ? <span className={'sq' + (isSel ? ' on' : '')}>{isSel && <Icon name="check" size={14} />}</span>
            : <span className={'round' + (done ? ' on' : '')}>{done && <Icon name="check" size={14} />}</span>}
          <span className="shop-main">
            <span className="shop-title">{item.title}</span>
            {(item.note || (!done && item.addedBy !== me.uid)) && (
              <span className="muted small">{item.note}{item.note && item.addedBy !== me.uid ? ' · ' : ''}{item.addedBy !== me.uid ? `aggiunto da ${nameOf(item.addedBy) || '—'}` : ''}</span>
            )}
          </span>
          {item.quantity && <span className="qty">{item.quantity}</span>}
        </button>
      </SwipeRow>
    )
  }

  return (
    <>
      <ScreenHeader title="Spesa" subtitle="Lista condivisa" />
      <div className="content">
        <form className="add-form" onSubmit={submit}>
          <div className="add-row">
            <label className="sr" htmlFor="s-title">Nuovo prodotto</label>
            <input id="s-title" placeholder="Aggiungi prodotto" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="sr" htmlFor="s-qty">Quantità</label>
            <input id="s-qty" className="qty-input" placeholder="Q.tà" value={qty} onChange={(e) => setQty(e.target.value)} />
            {canVoice && (
              <button type="button" className={'btn btn-outline square' + (listening ? ' rec' : '')} aria-label="Detta i prodotti" onClick={dictate} disabled={listening}><Icon name="mic" /></button>
            )}
            <button type="submit" className="btn btn-primary square" aria-label="Aggiungi"><Icon name="plus" /></button>
          </div>
          <label className="sr" htmlFor="s-note">Nota</label>
          <input id="s-note" placeholder="Nota (facoltativa)" value={note} onChange={(e) => setNote(e.target.value)} />
          {!canVoice && <span className="hint">Per dettare i prodotti usa il microfono della tastiera.</span>}
        </form>

        {suggestions.length > 0 && (
          <div className="suggest">
            <span className="small muted strong">Suggeriti</span>
            <div className="chips">
              {suggestions.map((h) => (
                <button key={h.id} type="button" className="chip" onClick={() => addItems([h])} aria-label={`Aggiungi ${h.title}`}>
                  <Icon name="plus" size={14} />{h.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="tools">
          <button type="button" className="chip" onClick={() => (selecting ? stopSelect() : setSelecting(true))} aria-pressed={selecting}>{selecting ? 'Fine selezione' : 'Seleziona'}</button>
          <button type="button" className="chip" onClick={() => setSheet('history')}>Da liste precedenti</button>
          <button type="button" className="chip" onClick={() => setSheet('clear')} disabled={items.length === 0}>Svuota lista</button>
        </div>

        <ErrorNote error={error} />
        {err && <p className="error" role="alert">{err}</p>}

        <div className="section-head"><h2>Da comprare · {pending.length}</h2><span className="muted small">Tocca per spuntare · scorri per eliminare</span></div>
        {pending.length === 0 && <Empty>La lista è vuota. Aggiungi un prodotto o carica una lista precedente.</Empty>}
        <div className="card list">{pending.map((i) => renderRow(i, false))}</div>

        {bought.length > 0 && (
          <>
            <button type="button" className="section-head toggle" onClick={() => setShowBought(!showBought)} aria-expanded={showBought}>
              <h2 className="muted">Comprati · {bought.length}</h2>
              <Icon name={showBought ? 'back' : 'next'} size={18} />
            </button>
            {showBought && <div className="card list muted-card">{bought.map((i) => renderRow(i, true))}</div>}
          </>
        )}
      </div>

      {selecting && (
        <div className="savebar">
          <span>{selected.length} {selected.length === 1 ? 'selezionato' : 'selezionati'}</span>
          <span className="bar-actions">
            <button type="button" className="btn btn-quiet-light" onClick={() => setSelected([...pending, ...bought].map((i) => i.id))}>Tutti</button>
            <button type="button" className="btn btn-light" onClick={deleteSelected} disabled={selected.length === 0}>Elimina</button>
            <button type="button" className="icon-btn light" onClick={stopSelect} aria-label="Annulla selezione"><Icon name="close" /></button>
          </span>
        </div>
      )}
      {snack}

      {sheet === 'clear' && (
        <Sheet title="Svuota lista" onClose={() => setSheet(null)}>
          <p className="muted small">Prima di eliminare, la lista viene salvata tra le liste precedenti, così potrai ricaricarla.</p>
          <button type="button" className="btn btn-outline" onClick={() => clearList('bought')} disabled={bought.length === 0}>Elimina solo i comprati ({bought.length})</button>
          <button type="button" className="btn btn-danger" onClick={() => clearList('all')}>Elimina tutta la lista ({items.length})</button>
        </Sheet>
      )}
      {sheet === 'voice' && (
        <Sheet title="Prodotti riconosciuti" onClose={() => setSheet(null)}>
          <p className="muted small">Correggi il testo se serve: un prodotto per riga.</p>
          <label className="sr" htmlFor="v-text">Prodotti</label>
          <textarea id="v-text" rows="6" value={voiceText} onChange={(e) => setVoiceText(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={async () => {
            const list = voiceText.split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ title: t }))
            setSheet(null)
            await addItems(list)
          }}>Aggiungi alla lista</button>
        </Sheet>
      )}
      {sheet === 'history' && (
        <HistorySheet history={history} lists={lists} pendingKeys={pendingKeys}
                      onAdd={async (list) => { setSheet(null); await addItems(list) }} onClose={() => setSheet(null)} />
      )}
    </>
  )
}

function HistorySheet({ history, lists, pendingKeys, onAdd, onClose }) {
  const [picked, setPicked] = useState({}) // slug -> item
  const [open, setOpen] = useState(null)
  const frequent = [...history].sort((a, b) => (b.count || 0) - (a.count || 0) || time(b.lastAt) - time(a.lastAt)).slice(0, 20)
  const sortedLists = [...lists].sort((a, b) => time(b.createdAt) - time(a.createdAt))

  const toggle = (it) => setPicked((p) => {
    const k = slug(it.title)
    const n = { ...p }
    if (n[k]) delete n[k]; else n[k] = { title: it.title, quantity: it.quantity || '', note: it.note || '' }
    return n
  })
  const selectAll = (arr) => setPicked((p) => {
    const n = { ...p }
    arr.forEach((it) => { n[slug(it.title)] = { title: it.title, quantity: it.quantity || '', note: it.note || '' } })
    return n
  })
  const renderPick = (it, key) => {
    const k = slug(it.title)
    const already = pendingKeys.has(k)
    return (
      <label key={key} className={'pick-row' + (already ? ' dim' : '')}>
        <input type="checkbox" checked={!!picked[k]} disabled={already} onChange={() => toggle(it)} />
        <span>{it.title}{it.quantity ? <span className="muted"> · {it.quantity}</span> : null}{already ? <span className="muted small"> · già in lista</span> : null}</span>
      </label>
    )
  }
  const count = Object.keys(picked).length

  return (
    <Sheet title="Da liste precedenti" onClose={onClose}>
      {frequent.length === 0 && sortedLists.length === 0 && <Empty>Non ci sono ancora prodotti precedenti. Si costruiscono man mano che aggiungi prodotti alla lista.</Empty>}
      {frequent.length > 0 && (
        <div className="pick-group">
          <div className="section-head"><h3>Più usati</h3><button type="button" className="link-btn" onClick={() => selectAll(frequent.filter((i) => !pendingKeys.has(slug(i.title))))}>Seleziona tutti</button></div>
          {frequent.map((it) => renderPick(it, it.id))}
        </div>
      )}
      {sortedLists.map((l) => (
        <div key={l.id} className="pick-group">
          <button type="button" className="toggle-row" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>
            <span>Lista del {l.createdAt ? fmtDateShort(toDate(l.createdAt)) : '—'} · {(l.items || []).length} prodotti</span>
            <Icon name={open === l.id ? 'back' : 'next'} size={16} />
          </button>
          {open === l.id && (
            <>
              <button type="button" className="link-btn" onClick={() => selectAll((l.items || []).filter((i) => !pendingKeys.has(slug(i.title))))}>Seleziona tutta la lista</button>
              {(l.items || []).map((it, i) => renderPick(it, i))}
            </>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-primary" disabled={count === 0} onClick={() => onAdd(Object.values(picked))}>
        {count === 0 ? 'Scegli i prodotti da aggiungere' : `Aggiungi ${count} ${count === 1 ? 'prodotto' : 'prodotti'}`}
      </button>
    </Sheet>
  )
}
