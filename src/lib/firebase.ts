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


// Seed missions data if it doesn't exist
const seedMissions = async () => {
    const missionsCol = collection(db, 'missions');
    const snapshot = await getDocs(missionsCol);
    if (snapshot.empty) {
        console.log('No missions found, seeding...');
        const batch = writeBatch(db);
        const missions = [
            { id: 'mission1', title: 'Log Analysis', description: 'Find the secret in the system logs.', flag: 'FLAG{L0G_F0R3NS1CS_R0CKS}', points: 10 },
            { id: 'mission2', title: 'Privilege Escalation', description: 'An automated script might reveal more than it should.', flag: 'FLAG{P3A_55_15_4W3S0M3}', points: 20 },
            { id: 'mission3', title: 'Metadata Exfiltration', description: 'Secrets can hide in plain sight. Check the file\'s metadata.', flag: 'FLAG{3X1F_M3T4D4T4_H1DD3N_S3CR3T}', points: 15 },
            { id: 'mission4', title: 'Basic Reversing', description: 'Sometimes, you just need to look at the strings.', flag: 'FLAG{B4S1C_R3V3RS1NG_W1TH_STR1NGS}', points: 10 },
            { id: 'mission5', title: 'Password Cracking', description: 'Crack the password hash found in shadow.bak.', flag: 'FLAG{D1CT10NARY_BRU73_F0RC3}', points: 25 },
            { id: 'mission6', title: 'Steganography', description: 'There is a message hidden in mission_image.jpg.', flag: 'FLAG{ST3G4N0GRAPHY_1S_C00L}', points: 30 },
            { id: 'mission7', title: 'Anti-Virus Evasion', description: 'A rival AI, Warlock, is defending this system. Find and delete its core file to disable it.', flag: 'FLAG{W4RL0CK_D1S4BL3D}', points: 50 },

        ];

        missions.forEach(mission => {
            const docRef = doc(db, 'missions', mission.id);
            batch.set(docRef, mission);
        });

        await batch.commit();
        console.log('Missions seeded successfully.');
    }
};

if (typeof window !== 'undefined') {
    seedMissions();
}


export { app, db, auth };
