import { useRef, useState } from 'react'
import { addDoc, deleteDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useFamily } from '../context.jsx'
import { famCol, famDoc, useFamilyCol } from '../lib/data.js'
import { time } from '../lib/dates.js'
import { Empty, ErrorNote, Icon, ScreenHeader } from '../ui.jsx'

export default function Spesa() {
  const { me, members } = useFamily()
  const { docs: items, error } = useFamilyCol('shopping')
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [showBought, setShowBought] = useState(false)
  const [err, setErr] = useState('')
  const timer = useRef(null)
  const longPressed = useRef(false)

  const pending = items.filter((i) => i.status !== 'purchased').sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
  const bought = items.filter((i) => i.status === 'purchased').sort((a, b) => time(b.purchasedAt) - time(a.purchasedAt))
  const nameOf = (uid) => (members.find((m) => m.uid === uid) || {}).displayName

  async function add(e) {
    e.preventDefault()
    if (!title.trim()) return
    setErr('')
    try {
      await addDoc(famCol('shopping'), {
        title: title.trim(), quantity: qty.trim(), note: note.trim(), status: 'pending',
        addedBy: me.uid, orderIndex: Date.now(), createdAt: serverTimestamp(),
      })
      setTitle(''); setQty(''); setNote('')
    } catch { setErr('Non sono riuscito ad aggiungere il prodotto.') }
  }

  async function toggle(item) {
    if (longPressed.current) { longPressed.current = false; return }
    try {
      if (item.status === 'purchased') {
        await updateDoc(famDoc('shopping', item.id), { status: 'pending', purchasedBy: null, purchasedAt: null, updatedAt: serverTimestamp() })
      } else {
        await updateDoc(famDoc('shopping', item.id), { status: 'purchased', purchasedBy: me.uid, purchasedAt: Timestamp.now(), updatedAt: serverTimestamp() })
      }
    } catch { setErr('Non sono riuscito ad aggiornare il prodotto.') }
  }

  const startPress = (item) => {
    longPressed.current = false
    timer.current = setTimeout(async () => {
      longPressed.current = true
      if (window.confirm(`Eliminare "${item.title}"?`)) {
        try { await deleteDoc(famDoc('shopping', item.id)) } catch { setErr('Eliminazione non riuscita.') }
      }
    }, 600)
  }
  const endPress = () => clearTimeout(timer.current)

  async function clearBought() {
    if (!window.confirm('Eliminare tutti i prodotti già comprati?')) return
    try { await Promise.all(bought.map((i) => deleteDoc(famDoc('shopping', i.id)))) } catch { setErr('Non sono riuscito a svuotare la lista.') }
  }

  const renderRow = (item, done) => (
    <button key={item.id} type="button" className={'shop-row' + (done ? ' done' : '')}
            onClick={() => toggle(item)} onPointerDown={() => startPress(item)} onPointerUp={endPress}
            onPointerLeave={endPress} onPointerCancel={endPress} onContextMenu={(e) => e.preventDefault()}>
      <span className={'round' + (done ? ' on' : '')}>{done && <Icon name="check" size={14} />}</span>
      <span className="shop-main">
        <span className="shop-title">{item.title}</span>
        {(item.note || (!done && item.addedBy !== me.uid)) && (
          <span className="muted small">{item.note}{item.note && item.addedBy !== me.uid ? ' · ' : ''}{item.addedBy !== me.uid ? `aggiunto da ${nameOf(item.addedBy) || '—'}` : ''}</span>
        )}
      </span>
      {item.quantity && <span className="qty">{item.quantity}</span>}
    </button>
  )

  return (
    <>
      <ScreenHeader title="Spesa" subtitle="Lista condivisa" />
      <div className="content">
        <form className="add-form" onSubmit={add}>
          <div className="add-row">
            <label className="sr" htmlFor="s-title">Nuovo prodotto</label>
            <input id="s-title" placeholder="Aggiungi prodotto" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="sr" htmlFor="s-qty">Quantità</label>
            <input id="s-qty" className="qty-input" placeholder="Q.tà" value={qty} onChange={(e) => setQty(e.target.value)} />
            <button type="submit" className="btn btn-primary square" aria-label="Aggiungi"><Icon name="plus" /></button>
          </div>
          <label className="sr" htmlFor="s-note">Nota</label>
          <input id="s-note" placeholder="Nota (facoltativa), per esempio senza lattosio" value={note} onChange={(e) => setNote(e.target.value)} />
        </form>
        <ErrorNote error={error} />
        {err && <p className="error" role="alert">{err}</p>}

        <div className="section-head"><h2>Da comprare · {pending.length}</h2><span className="muted small">Tocca per spuntare, tieni premuto per eliminare</span></div>
        {pending.length === 0 && <Empty>La lista è vuota. Aggiungi il primo prodotto.</Empty>}
        <div className="card list">{pending.map((i) => renderRow(i, false))}</div>

        {bought.length > 0 && (
          <>
            <button type="button" className="section-head toggle" onClick={() => setShowBought(!showBought)} aria-expanded={showBought}>
              <h2 className="muted">Comprati · {bought.length}</h2>
              <Icon name={showBought ? 'back' : 'next'} size={18} />
            </button>
            {showBought && (
              <>
                <div className="card list muted-card">{bought.map((i) => renderRow(i, true))}</div>
                <button type="button" className="btn btn-quiet" onClick={clearBought}>Svuota i comprati</button>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
