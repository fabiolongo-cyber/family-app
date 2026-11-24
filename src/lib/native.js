import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export const isNative = () => Capacitor.isNativePlatform()

/* ---------- Biometria (impronta / riconoscimento del volto) ---------- */
const BIO_KEY = 'familyapp.bioLock'

export const bioLockEnabled = () => {
  try { return window.localStorage.getItem(BIO_KEY) === '1' } catch { return false }
}
export const setBioLock = (on) => {
  try {
    if (on) window.localStorage.setItem(BIO_KEY, '1')
    else window.localStorage.removeItem(BIO_KEY)
  } catch { /* storage non disponibile */ }
}

export async function biometricAvailable() {
  if (!isNative()) return false
  try {
    const r = await NativeBiometric.isAvailable()
    return !!(r && r.isAvailable)
  } catch { return false }
}

export async function biometricUnlock() {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Sblocca FamilyApp',
      title: 'Sblocca FamilyApp',
      subtitle: 'Usa impronta o riconoscimento del volto',
      useFallback: true,
    })
    return true
  } catch { return false }
}

/* ---------- Dettatura vocale ---------- */
const WebSpeech = () => (typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null)

export async function voiceAvailable() {
  if (isNative()) {
    try {
      const r = await SpeechRecognition.available()
      return !!(r && r.available)
    } catch { return false }
  }
  return !!WebSpeech()
}

// Ascolta e restituisce il testo riconosciuto (stringa vuota se non ha sentito nulla)
export async function listen() {
  if (isNative()) {
    let perm = await SpeechRecognition.checkPermissions()
    if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions()
    if (perm.speechRecognition !== 'granted') throw new Error('permission')
    const res = await SpeechRecognition.start({
      language: 'it-IT', maxResults: 1, prompt: 'Dì i prodotti da aggiungere', partialResults: false, popup: true,
    })
    return (res && res.matches && res.matches[0]) || ''
  }
  const SR = WebSpeech()
  return new Promise((resolve, reject) => {
    const r = new SR()
    r.lang = 'it-IT'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => resolve(e.results[0][0].transcript)
    r.onerror = (e) => reject(new Error(e.error))
    r.onend = () => resolve('')
    r.start()
  })
}

// "latte, pane e uova" -> ["Latte", "Pane", "Uova"]
export function parseItems(text) {
  return text.split(/,|;|\n|\s+e\s+|\s+più\s+|\s+poi\s+/i)
    .map((s) => s.trim()).filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
}
