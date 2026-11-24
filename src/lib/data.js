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
