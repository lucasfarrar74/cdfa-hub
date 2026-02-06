import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActivityLink } from '../types/linking';
import { getToolById } from '../config/tools';

interface ActivityResultMessage {
  type: 'CDFA_ACTIVITY_RESULT';
  success: boolean;
  activityId?: string;
  error?: string;
}

interface UseActivityBridgeResult {
  isReady: boolean;
  isCreating: boolean;
  error: string | null;
  createActivity: (activity: ActivityLink) => Promise<{ activityId: string } | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

/**
 * Hook to communicate with Project Manager via PostMessage for activity creation
 */
export function useActivityBridge(): UseActivityBridgeResult {
  const [isReady, setIsReady] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolveRef = useRef<((result: { activityId: string } | null) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for bridge ready signal and activity creation results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      // Listen for ready signal from Project Manager
      if (data?.type === 'CDFA_ACTIVITY_BRIDGE_READY') {
        setIsReady(true);
        return;
      }

      if (data?.type === 'CDFA_ACTIVITY_RESULT') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const result = data as ActivityResultMessage;

        if (result.success && result.activityId) {
          resolveRef.current?.({ activityId: result.activityId });
        } else {
          setError(result.error || 'Failed to create activity');
          resolveRef.current?.(null);
        }

        setIsCreating(false);
        resolveRef.current = null;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const createActivity = useCallback(async (activity: ActivityLink): Promise<{ activityId: string } | null> => {
    if (!iframeRef.current?.contentWindow) {
      // Project Manager iframe not loaded - silently skip
      return null;
    }

    if (!isReady) {
      // Not ready - silently skip
      return null;
    }

    setIsCreating(true);
    setError(null);

    return new Promise((resolve) => {
      resolveRef.current = resolve;

      // Set timeout for response (5 seconds)
      timeoutRef.current = setTimeout(() => {
        setIsCreating(false);
        resolveRef.current = null;
        resolve(null); // Silently fail - don't show error
      }, 5000);

      // Send create activity message
      const message = {
        type: 'CDFA_ACTIVITY',
        action: 'CREATE_ACTIVITY',
        payload: {
          id: activity.id,
          name: activity.name,
          fiscalYear: activity.fiscalYear,
          startDate: activity.startDate,
          endDate: activity.endDate,
          location: activity.location,
        },
      };

      try {
        iframeRef.current!.contentWindow!.postMessage(message, '*');
      } catch {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setIsCreating(false);
        resolveRef.current = null;
        resolve(null);
      }
    });
  }, [isReady]);

  return {
    isReady,
    isCreating,
    error,
    createActivity,
    iframeRef,
  };
}

/**
 * Get the Project Manager iframe URL
 */
export function getProjectManagerIframeUrl(): string {
  const tool = getToolById('project-manager');
  return tool?.url || 'http://localhost:5175';
}
