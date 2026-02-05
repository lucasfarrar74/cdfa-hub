import { useEffect, useCallback, useRef } from 'react';
import { useAuth, type AuthUser } from '../context/AuthContext';

// Message types for Hub -> Iframe communication
export interface AuthMessage {
  type: 'CDFA_AUTH';
  action: 'AUTH_STATE_CHANGED' | 'LOGOUT';
  payload: {
    user: AuthUser | null;
    idToken: string | null;
  };
}

// Message types for Iframe -> Hub communication
export interface AuthRequest {
  type: 'CDFA_AUTH_REQUEST';
  action: 'REQUEST_AUTH_STATE';
}

// Allowed origins for iframe communication
const ALLOWED_ORIGINS = [
  'http://localhost:5173',  // Vite dev server (Hub)
  'http://localhost:5174',  // Project Manager
  'http://localhost:5175',  // Meeting Scheduler
  'http://localhost:5000',  // Budget Tracker Flask
  'http://127.0.0.1:5000',  // Budget Tracker Flask alt
  // Production domains - add as needed
  window.location.origin,
];

function isAllowedOrigin(origin: string): boolean {
  // Allow same origin
  if (origin === window.location.origin) return true;
  // Check against allowed list
  return ALLOWED_ORIGINS.includes(origin);
}

export function useIframeAuth() {
  const { user, idToken } = useAuth();
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

  // Register an iframe to receive auth messages
  const registerIframe = useCallback((id: string, iframe: HTMLIFrameElement) => {
    iframeRefs.current.set(id, iframe);

    // Send current auth state to newly registered iframe
    if (iframe.contentWindow) {
      const message: AuthMessage = {
        type: 'CDFA_AUTH',
        action: 'AUTH_STATE_CHANGED',
        payload: { user, idToken },
      };
      // Wait for iframe to be ready
      setTimeout(() => {
        try {
          iframe.contentWindow?.postMessage(message, '*');
        } catch (e) {
          console.warn(`Failed to send auth to iframe ${id}:`, e);
        }
      }, 1000);
    }
  }, [user, idToken]);

  // Unregister an iframe
  const unregisterIframe = useCallback((id: string) => {
    iframeRefs.current.delete(id);
  }, []);

  // Broadcast auth state to all registered iframes
  const broadcastAuth = useCallback((action: 'AUTH_STATE_CHANGED' | 'LOGOUT') => {
    const message: AuthMessage = {
      type: 'CDFA_AUTH',
      action,
      payload: { user, idToken },
    };

    iframeRefs.current.forEach((iframe, id) => {
      try {
        iframe.contentWindow?.postMessage(message, '*');
      } catch (e) {
        console.warn(`Failed to send auth to iframe ${id}:`, e);
      }
    });
  }, [user, idToken]);

  // Listen for auth requests from iframes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (!isAllowedOrigin(event.origin)) {
        return;
      }

      // Check if it's an auth request
      const data = event.data as AuthRequest;
      if (data?.type !== 'CDFA_AUTH_REQUEST') return;

      if (data.action === 'REQUEST_AUTH_STATE') {
        // Respond with current auth state
        const response: AuthMessage = {
          type: 'CDFA_AUTH',
          action: 'AUTH_STATE_CHANGED',
          payload: { user, idToken },
        };
        event.source?.postMessage(response, { targetOrigin: event.origin });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user, idToken]);

  // Broadcast auth changes
  useEffect(() => {
    broadcastAuth('AUTH_STATE_CHANGED');
  }, [user, idToken, broadcastAuth]);

  return {
    registerIframe,
    unregisterIframe,
    broadcastAuth,
  };
}
