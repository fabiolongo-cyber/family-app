import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db, FAMILY_ID } from '../firebase.js'
import { useFamily } from '../context.jsx'

export const famCol = (name) => collection(db, 'families', FAMILY_ID, name)
export const famDoc = (name, id) => doc(db, 'families', FAMILY_ID, name, id)

// Ascolta una raccolta in tempo reale. Ordinamenti e filtri complessi si fanno
// sul telefono, cosi' non servono indici compositi in Firestore.
export function useCollection(pathArr, makeConstraints, key = '') {
  const [state, setState] = useState({ docs: [], loading: true, error: null })
  const path = pathArr.join('/')
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }))
    const base = collection(db, ...path.split('/'))
    const q = makeConstraints ? query(base, ...makeConstraints()) : base
    return onSnapshot(
      q,
      (snap) => setState({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => setState({ docs: [], loading: false, error }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key])
  return state
}

export const useFamilyCol = (name, makeConstraints, key = '') =>
  useCollection(['families', FAMILY_ID, name], makeConstraints, key)

// I genitori vedono tutti gli eventi, i figli solo quelli a cui sono assegnati.
export function useMyEvents() {
  const { me, isParent } = useFamily()
  const res = useFamilyCol('events', () => (isParent ? [] : [where('assignedTo', 'array-contains', me.uid)]),
    isParent ? 'all' : me.uid)
  return { events: res.docs, loading: res.loading, error: res.error }
}

// Obiettivi: i figli vedono solo quelli con visibilita' "tutti".
export function useVisibleObjectives() {
  const { isParent } = useFamily()
  const res = useFamilyCol('objectives', () => (isParent ? [] : [where('visibility', '==', 'all')]),
    isParent ? 'all' : 'child')
  return { objectives: res.docs, loading: res.loading, error: res.error }
}

export const lines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean)

// Nome sicuro per usare un testo come ID di documento ("Latte intero" -> "latte-intero")
export const slug = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voce'

// Ascolta un singolo documento in tempo reale (data = undefined mentre carica, null se non esiste)
export function useFamilyDoc(pathArr) {
  const [state, setState] = useState({ data: undefined, error: null })
  const path = pathArr.join('/')
  useEffect(() => onSnapshot(
    doc(db, ...path.split('/')),
    (snap) => setState({ data: snap.exists() ? snap.data() : null, error: null }),
    (error) => setState({ data: null, error }),
  ), [path])
  return state
}

export const DEFAULT_DOC_TYPES = [
  { id: 'cie', name: 'CIE' },
  { id: 'tessera-sanitaria', name: 'Tessera Sanitaria' },
  { id: 'fasi', name: 'FASI' },
  { id: 'blue-assistance', name: 'Blue Assistance' },
]

// Le "voci" dei documenti sono configurabili da Impostazioni
// Restituisce null finche' le voci si stanno caricando
export function useDocTypes() {
  const { data } = useFamilyDoc(['families', FAMILY_ID, 'settings', 'documentTypes'])
  if (data === undefined) return null
  return data && Array.isArray(data.items) ? data.items : DEFAULT_DOC_TYPES
}
