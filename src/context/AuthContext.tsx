import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  onAuthChange,
  signInWithEmail,
  signInWithGoogle,
  createAccountWithEmail,
  firebaseSignOut,
  getIdToken,
  isFirebaseConfigured,
  type User
} from '../lib/firebase';

// Simplified user type for messaging
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  idToken: string | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  createAccount: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Default user for development (no login required)
const DEFAULT_USER: AuthUser = {
  uid: 'local-dev-user',
  email: 'lucas@cdfa.local',
  displayName: 'Lucas Farrar',
  photoURL: null,
};

// Auth is driven by the VITE_ENABLE_AUTH env var so the production cutover
// doesn't require a code change. Set VITE_ENABLE_AUTH=true in the Vercel
// project env vars (and in local .env for dev) only AFTER:
//   1. Firestore rules are deployed (see firestore.rules / CLAUDE.md)
//   2. Sign-in methods are enabled in the Firebase Console
//   3. Authorized domains include the Vercel production domain
// While unset or false, a hardcoded local user is used (solo-dev mode).
const ENABLE_AUTH = import.meta.env.VITE_ENABLE_AUTH === 'true';

export function AuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = ENABLE_AUTH && isFirebaseConfigured();
  // When auth is enforced, start with no user and a loading state so
  // ProtectedRoute shows a spinner rather than briefly rendering the app
  // as "logged in as Lucas Farrar" before Firebase resolves.
  const [user, setUser] = useState<AuthUser | null>(isConfigured ? null : DEFAULT_USER);
  const [idToken, setIdToken] = useState<string | null>(isConfigured ? null : 'dev-token');
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);

  // Convert Firebase User to AuthUser
  const toAuthUser = (firebaseUser: User | null): AuthUser | null => {
    if (!firebaseUser) return null;
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
    };
  };

  // Refresh ID token
  const refreshToken = useCallback(async () => {
    const token = await getIdToken();
    setIdToken(token);
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(toAuthUser(firebaseUser));
      if (firebaseUser) {
        await refreshToken();
      } else {
        setIdToken(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [isConfigured, refreshToken]);

  // Refresh token periodically (every 50 minutes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(refreshToken, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, refreshToken]);

  const handleSignInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignInWithGoogle = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateAccount = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await createAccountWithEmail(email, password, displayName);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        isLoading,
        isConfigured,
        error,
        signInWithEmail: handleSignInWithEmail,
        signInWithGoogle: handleSignInWithGoogle,
        createAccount: handleCreateAccount,
        signOut: handleSignOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook colocated with Provider; splitting breaks consumer imports
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
