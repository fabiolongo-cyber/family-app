import { createContext, useContext } from 'react'

export const FamilyContext = createContext(null)
export const useFamily = () => useContext(FamilyContext)

// Colori assegnati ai membri (se nel documento del membro non c'e' un colore)
export const PALETTE = ['#2563EB', '#C2410C', '#DB2777', '#7C3AED', '#0F766E', '#B45309']
