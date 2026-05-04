// src/lib/firebase-lazy.ts
// Dynamic import wrapper para Firebase - reduz bundle inicial em ~52MB

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
let initializationPromise: Promise<void> | null = null;

// Lazy initialization function
async function initializeFirebase(): Promise<void> {
  if (!isFirebaseConfigured()) {
    // Firebase não configurado - isso é esperado se não estiver usando Firebase Analytics
    // Silenciado para evitar poluição dos logs
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    const [{ initializeApp, getApps, getApp }, { getAnalytics, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/analytics'),
    ]);

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

    if (app && typeof window !== 'undefined') {
      const supported = await isSupported();
      if (supported) {
        analytics = getAnalytics(app);
      }
    }
  })();

  return initializationPromise;
}

// Getter functions with lazy loading
export async function getFirebaseApp(): Promise<FirebaseApp | null> {
  await initializeFirebase();
  return app;
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  await initializeFirebase();
  return analytics;
}

// For backward compatibility - immediate access (may return null if not initialized)
export { app, analytics };
