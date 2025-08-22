'use client';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
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


// Seeding data should be done manually in the Firebase console or via a secure backend script, not on the client.

export { app, db, auth };
