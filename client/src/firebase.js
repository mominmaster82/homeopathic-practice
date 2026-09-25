// Firebase সংযোগ — এই কনফিগ পাবলিক, গোপন নয় (নিরাপত্তা Security Rules দিয়ে হয়)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDxwDx4C_gHP1q-dL00drlWGXQZUM6MnNQ',
  authDomain: 'homeopathy-clinic-7f4e0.firebaseapp.com',
  projectId: 'homeopathy-clinic-7f4e0',
  storageBucket: 'homeopathy-clinic-7f4e0.firebasestorage.app',
  messagingSenderId: '967901094587',
  appId: '1:967901094587:web:25f744e1512969a3d27f9e',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
