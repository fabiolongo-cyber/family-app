import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Configurazione web di Firebase: non e' un segreto.
// I dati sono protetti dal login e dalle regole di sicurezza di Firestore.
const firebaseConfig = {
  apiKey: 'AIzaSyD1w9fsJzp1BJfZZf3brRJo60yOaQbcjhU',
  authDomain: 'family-app-152a7.firebaseapp.com',
  projectId: 'family-app-152a7',
  storageBucket: 'family-app-152a7.firebasestorage.app',
  messagingSenderId: '996622663923',
  appId: '1:996622663923:web:c4d0418966626164c2f786',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Cache locale: l'app continua a mostrare i dati anche senza connessione.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// App pensata per una sola famiglia.
export const FAMILY_ID = 'famiglia'
