// Minimal Google Identity Services (GIS) loader + OAuth helper.
//
// We intentionally do NOT bundle the Google auth library — it's ~200KB and
// only needed when the user clicks "Push to Google Sheets". We lazy-load
// https://accounts.google.com/gsi/client on demand and cache the access
// token in sessionStorage with its expiry.

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const TOKEN_STORAGE_KEY = 'cdfa-google-access-token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

interface CachedToken {
  accessToken: string;
  /** Unix ms when this token expires. */
  expiresAt: number;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleNamespace {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: {
          access_token?: string;
          expires_in?: string | number;
          error?: string;
          error_description?: string;
        }) => void;
        error_callback?: (err: { type: string; message?: string }) => void;
      }) => GoogleTokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

let loadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

function getClientId(): string | null {
  return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || null;
}

export function isGoogleOAuthConfigured(): boolean {
  return !!getClientId();
}

function readCachedToken(): CachedToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedToken;
    if (!parsed.accessToken || typeof parsed.expiresAt !== 'number') return null;
    // Treat anything within 60 seconds of expiry as already expired so callers
    // don't race a token that dies mid-request.
    if (Date.now() > parsed.expiresAt - 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedToken(token: CachedToken): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch {
    // Private browsing or full storage — not fatal, just don't cache.
  }
}

export function clearStoredGoogleToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Request a Google access token with the spreadsheets + drive.file scopes.
 * Returns a cached token if one is still valid; otherwise opens the OAuth
 * popup. Throws if the user dismisses consent or if `VITE_GOOGLE_OAUTH_CLIENT_ID`
 * is not configured.
 */
export async function requestSheetsAccess(): Promise<string> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID is not configured');
  }

  const cached = readCachedToken();
  if (cached) return cached.accessToken;

  await loadGisScript();

  return new Promise<string>((resolve, reject) => {
    const google = window.google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services script loaded but API is unavailable'));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`${response.error}: ${response.error_description ?? 'no description'}`));
          return;
        }
        if (!response.access_token) {
          reject(new Error('Google returned no access token'));
          return;
        }
        const expiresInSec = Number(response.expires_in) || 3600;
        writeCachedToken({
          accessToken: response.access_token,
          expiresAt: Date.now() + expiresInSec * 1000,
        });
        resolve(response.access_token);
      },
      error_callback: (err) => {
        reject(new Error(`Google OAuth error (${err.type}): ${err.message ?? 'unknown'}`));
      },
    });

    // 'consent' forces the consent screen; omit to let Google decide (silent
    // refresh when the user already granted consent).
    client.requestAccessToken({});
  });
}
