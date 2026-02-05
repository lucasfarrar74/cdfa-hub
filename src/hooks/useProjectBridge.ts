import { useState, useCallback, useEffect, useRef } from 'react';
import type { CreateProjectMessage, ProjectResultMessage, ActivityLink } from '../types/linking';
import { getToolById } from '../config/tools';

interface UseProjectBridgeResult {
  isReady: boolean;
  isCreating: boolean;
  error: string | null;
  createProject: (activity: ActivityLink) => Promise<{ projectId: string; shareId?: string } | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

/**
 * Hook to communicate with Meeting Scheduler via PostMessage for project creation
 */
export function useProjectBridge(): UseProjectBridgeResult {
  const [isReady, setIsReady] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolveRef = useRef<((result: { projectId: string; shareId?: string } | null) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for project creation results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;

      if (data?.type === 'CDFA_PROJECT_RESULT') {
        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const result = data as ProjectResultMessage;

        if (result.success && result.projectId) {
          resolveRef.current?.({
            projectId: result.projectId,
            shareId: result.shareId,
          });
        } else {
          setError(result.error || 'Failed to create project');
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

  // Mark iframe as ready when it loads
  const handleIframeLoad = useCallback(() => {
    setIsReady(true);
  }, []);

  // Attach load handler when ref is set
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
      // Check if already loaded
      if (iframe.contentWindow) {
        setIsReady(true);
      }
      return () => {
        iframe.removeEventListener('load', handleIframeLoad);
      };
    }
  }, [handleIframeLoad]);

  const createProject = useCallback(async (activity: ActivityLink): Promise<{ projectId: string; shareId?: string } | null> => {
    if (!iframeRef.current?.contentWindow) {
      setError('Meeting Scheduler is not loaded');
      return null;
    }

    if (!isReady) {
      setError('Meeting Scheduler is still loading');
      return null;
    }

    setIsCreating(true);
    setError(null);

    return new Promise((resolve) => {
      resolveRef.current = resolve;

      // Set timeout for response (10 seconds)
      timeoutRef.current = setTimeout(() => {
        setError('Request timed out. Meeting Scheduler may not be responding.');
        setIsCreating(false);
        resolveRef.current = null;
        resolve(null);
      }, 10000);

      // Send create project message
      const message: CreateProjectMessage = {
        type: 'CDFA_PROJECT',
        action: 'CREATE_PROJECT',
        payload: {
          name: activity.name,
          cdfaActivityId: activity.id,
          fiscalYear: activity.fiscalYear,
          startDate: activity.startDate,
          endDate: activity.endDate,
          location: activity.location,
        },
      };

      try {
        iframeRef.current!.contentWindow!.postMessage(message, '*');
      } catch (err) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setError('Failed to communicate with Meeting Scheduler');
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
    createProject,
    iframeRef,
  };
}

/**
 * Get the Meeting Scheduler iframe URL
 */
export function getMeetingSchedulerIframeUrl(): string {
  const tool = getToolById('meeting-scheduler');
  return tool?.url || 'http://localhost:5176';
}
