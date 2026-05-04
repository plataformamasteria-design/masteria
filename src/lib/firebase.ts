// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';

// Check if Firebase configuration is available
const isFirebaseConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

// Only initialize Firebase if configuration is available
if (isFirebaseConfigured()) {
  const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
  };

  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Initialize analytics only if app is initialized, in browser, and analytics opt-in is enabled
  if (app && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true') {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app!);
      }
    });
  }
} else {
  // Firebase não configurado - isso é esperado se não estiver usando Firebase Analytics
  // Silenciado para evitar poluição dos logs
}

export { app, analytics };
