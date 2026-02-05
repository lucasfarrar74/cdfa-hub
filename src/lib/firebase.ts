import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import type { Auth, User, UserCredential } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain
  );
}

// Singleton instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

// Initialize Firebase (lazy initialization)
export function initializeFirebase(): { app: FirebaseApp; auth: Auth } | null {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase is not configured. Authentication is disabled.');
    return null;
  }

  if (!app) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  }

  if (!auth) {
    auth = getAuth(app);
  }

  return { app, auth };
}

// Get Firebase Auth instance
export function getFirebaseAuth(): Auth | null {
  const result = initializeFirebase();
  return result?.auth ?? null;
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured');
  return signInWithEmailAndPassword(auth, email, password);
}

// Create account with email and password
export async function createAccountWithEmail(email: string, password: string, displayName?: string): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured');

  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName && credential.user) {
    await updateProfile(credential.user, { displayName });
  }

  return credential;
}

// Sign in with Google
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured');

  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

// Sign out
export async function firebaseSignOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured');
  return signOut(auth);
}

// Get current user
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth?.currentUser ?? null;
}

// Get ID token for current user
export async function getIdToken(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;
  return user.getIdToken();
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// Export types
export type { User, UserCredential };
