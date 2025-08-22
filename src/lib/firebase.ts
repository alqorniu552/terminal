'use client';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp | null {
    const allConfigPresent = Object.values(firebaseConfig).every(Boolean);
    if (!allConfigPresent) {
        if (typeof window !== 'undefined') {
            console.error("Firebase configuration is missing. Please check your .env file.");
        }
        return null;
    }
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function getFirebaseAuth(): Auth | null {
    const app = getFirebaseApp();
    return app ? getAuth(app) : null;
}

function getFirebaseDb(): Firestore | null {
    const app = getFirebaseApp();
    return app ? getFirestore(app) : null;
}

const app = getFirebaseApp();
const auth = getFirebaseAuth();
const db = getFirebaseDb();

export { app, db, auth };
