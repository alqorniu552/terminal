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

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function initializeFirebase() {
    if (typeof window === 'undefined' || app) {
        return;
    }

    const allConfigPresent = Object.values(firebaseConfig).every(Boolean);
    if (!allConfigPresent) {
        return;
    }

    if (getApps().length === 0) {
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
        } catch (e) {
            console.error("Firebase initialization error:", e);
            app = null;
            auth = null;
            db = null;
        }
    } else {
        app = getApp();
        auth = getAuth(app);
        db = getFirestore(app);
    }
}

initializeFirebase();

// Getter functions to ensure consumers get the initialized instances
export function getAuthInstance(): Auth | null {
    if (!auth) initializeFirebase();
    return auth;
}

export function getDbInstance(): Firestore | null {
    if (!db) initializeFirebase();
    return db;
}

export { app, db, auth };
