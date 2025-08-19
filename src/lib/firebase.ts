'use client';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: 'command-center-op9s7',
  appId: '1:305576831079:web:d2e7315bcbcca8e4d18cc2',
  storageBucket: 'command-center-op9s7.firebasestorage.app',
  apiKey: 'AIzaSyCM-TOEBiU75ic_2CSEfJnQ8PLCyGP_u30',
  authDomain: 'command-center-op9s7.firebaseapp.com',
  messagingSenderId: '305576831079',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
