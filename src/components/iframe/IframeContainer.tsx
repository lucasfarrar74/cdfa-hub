import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface AuthMessage {
  type: 'CDFA_AUTH';
  action: 'AUTH_STATE_CHANGED' | 'LOGOUT';
  payload: {
    user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } | null;
    idToken: string | null;
  };
}

interface ThemeMessage {
  type: 'CDFA_THEME';
  action: 'THEME_CHANGED';
  payload: {
    theme: 'light' | 'dark';
  };
}

interface IframeContainerProps {
  src: string;
  title: string;
  minHeight?: number;
  onExpand?: () => void;
  className?: string;
  showHeader?: boolean;
}

export function IframeContainer({
  src,
  title,
  minHeight = 400,
  onExpand,
  className,
  showHeader = true,
}: IframeContainerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user, idToken } = useAuth();
  const { resolvedTheme } = useTheme();

  // Send auth state to iframe
  const sendAuthToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;

    const message: AuthMessage = {
      type: 'CDFA_AUTH',
      action: 'AUTH_STATE_CHANGED',
      payload: { user, idToken },
    };

    try {
      iframeRef.current.contentWindow.postMessage(message, '*');
    } catch (e) {
      console.warn(`Failed to send auth to iframe ${title}:`, e);
    }
  }, [user, idToken, title]);

  // Send auth state when user or token changes
  useEffect(() => {
    if (!isLoading && !hasError) {
      sendAuthToIframe();
    }
  }, [user, idToken, isLoading, hasError, sendAuthToIframe]);

  // Send theme to iframe
  const sendThemeToIframe = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;

    const message: ThemeMessage = {
      type: 'CDFA_THEME',
      action: 'THEME_CHANGED',
      payload: { theme: resolvedTheme },
    };

    try {
      iframeRef.current.contentWindow.postMessage(message, '*');
    } catch (e) {
      console.warn(`Failed to send theme to iframe ${title}:`, e);
    }
  }, [resolvedTheme, title]);

  // Send theme when it changes
  useEffect(() => {
    if (!isLoading && !hasError) {
      sendThemeToIframe();
    }
  }, [resolvedTheme, isLoading, hasError, sendThemeToIframe]);

  // Listen for auth and theme requests from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'CDFA_AUTH_REQUEST' && data?.action === 'REQUEST_AUTH_STATE') {
        sendAuthToIframe();
      }
      if (data?.type === 'CDFA_THEME_REQUEST' && data?.action === 'REQUEST_THEME') {
        sendThemeToIframe();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendAuthToIframe, sendThemeToIframe]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    // Send auth and theme state after iframe loads
    setTimeout(() => {
      sendAuthToIframe();
      sendThemeToIframe();
    }, 500);
  }, [sendAuthToIframe, sendThemeToIframe]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = src;
    }
  }, [src]);

  const handleOpenNewTab = useCallback(() => {
    window.open(src, '_blank', 'noopener,noreferrer');
  }, [src]);

  return (
    <div className={cn("flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow dark:shadow-gray-900/50", className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </button>
            {onExpand && (
              <button
                onClick={onExpand}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title="Expand"
              >
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleOpenNewTab}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              title="Open in new tab"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative flex-1" style={{ minHeight }}>
        {/* Loading skeleton */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center z-10">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading {title}...</p>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center z-10">
            <ExclamationTriangleIcon className="w-12 h-12 text-amber-500 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Failed to load {title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">The tool may be temporarily unavailable</p>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleOpenNewTab}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Open in New Tab
              </button>
            </div>
          </div>
        )}

        {/* Iframe */}
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          className={cn(
            "w-full h-full border-0",
            (isLoading || hasError) && "invisible"
          )}
          style={{ minHeight }}
          onLoad={handleLoad}
          onError={handleError}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
        />
      </div>
    </div>
  );
}
