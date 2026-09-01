import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import {
  getFirebaseInstances,
  isFirebaseConfigured,
  signInAnonymouslyIfNeeded,
  getEffectiveUserId,
} from '../lib/firebase';
import type { Project, SyncStatus, ActiveCollaborator, SyncError } from '../types';
import { findAllDoubleBookings } from '../utils/conflictDetection';

function extractSyncError(err: unknown, operation: SyncError['operation']): SyncError {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    return { message: err.message, code, operation };
  }
  return { message: String(err), operation };
}

// Generate a short share ID
function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Convert Project to Firestore-safe format
function projectToFirestore(project: Project): Record<string, unknown> {
  return {
    ...project,
    // Convert Date objects in timeSlots to ISO strings
    timeSlots: project.timeSlots.map(slot => ({
      ...slot,
      startTime: slot.startTime instanceof Date ? slot.startTime.toISOString() : slot.startTime,
      endTime: slot.endTime instanceof Date ? slot.endTime.toISOString() : slot.endTime,
    })),
    updatedAt: serverTimestamp(),
  };
}

// Convert Firestore data to Project
function firestoreToProject(data: Record<string, unknown>): Project {
  const project = { ...data } as unknown as Project;

  // Restore Date objects in timeSlots
  if (project.timeSlots) {
    project.timeSlots = project.timeSlots.map(slot => ({
      ...slot,
      startTime: new Date(slot.startTime as unknown as string),
      endTime: new Date(slot.endTime as unknown as string),
    }));
  }

  // Convert Firestore Timestamps to ISO strings
  if (project.createdAt && typeof project.createdAt === 'object' && 'toDate' in project.createdAt) {
    project.createdAt = (project.createdAt as Timestamp).toDate().toISOString();
  }
  if (project.updatedAt && typeof project.updatedAt === 'object' && 'toDate' in project.updatedAt) {
    project.updatedAt = (project.updatedAt as Timestamp).toDate().toISOString();
  }

  return project;
}

interface UseFirebaseSyncOptions {
  onProjectUpdate?: (project: Project) => void;
  onError?: (error: Error) => void;
}

interface UseFirebaseSyncReturn {
  isEnabled: boolean;
  syncStatus: SyncStatus;
  activeCollaborators: ActiveCollaborator[];
  lastSyncError: SyncError | null;
  reportSyncError: (error: SyncError | null) => void;
  /**
   * Non-null when the most recent remote snapshot contained a
   * double-booking (usually caused by a race between two admins editing
   * within the 500ms debounce window). Surfaces as a persistent yellow
   * warning in SyncStatusIndicator until either the state clears
   * (a subsequent snapshot with no violations arrives) or the admin
   * runs the audit script to clean up.
   */
  remoteIntegrityWarning: string | null;
  uploadProject: (project: Project) => Promise<string | null>;
  openProject: (shareId: string) => Promise<Project | null>;
  syncProject: (project: Project) => void;
  stopSync: () => void;
  disconnectProject: (projectId: string) => void;
}

export function useFirebaseSync(options: UseFirebaseSyncOptions = {}): UseFirebaseSyncReturn {
  const { onProjectUpdate, onError } = options;

  const [isEnabled] = useState(() => isFirebaseConfigured());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [activeCollaborators, setActiveCollaborators] = useState<ActiveCollaborator[]>([]);
  const [lastSyncError, setLastSyncError] = useState<SyncError | null>(null);
  const [remoteIntegrityWarning, setRemoteIntegrityWarning] = useState<string | null>(null);
  const reportSyncError = useCallback((err: SyncError | null) => {
    setLastSyncError(err);
  }, []);

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const presenceUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  const lastLocalUpdateRef = useRef<string | null>(null);

  // Note: Auth is now handled by AuthContext which will call setOverrideUserId

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (presenceUnsubscribeRef.current) {
        presenceUnsubscribeRef.current();
      }
    };
  }, []);

  // Upload a project to Firestore
  const uploadProject = useCallback(async (project: Project): Promise<string | null> => {
    if (!isEnabled) return null;

    const instances = getFirebaseInstances();
    if (!instances) return null;

    const userId = await signInAnonymouslyIfNeeded();
    if (!userId) return null;

    try {
      setSyncStatus('syncing');

      const shareId = project.shareId || generateShareId();
      const cloudProject: Project = {
        ...project,
        isCloud: true,
        ownerId: userId,
        shareId,
        collaborators: project.collaborators || [],
      };

      // Store project in Firestore
      const projectRef = doc(instances.db, 'projects', shareId);
      await setDoc(projectRef, projectToFirestore(cloudProject));

      setSyncStatus('synced');
      setLastSyncError(null);
      return shareId;
    } catch (error) {
      console.error('Failed to upload project:', error);
      setSyncStatus('error');
      setLastSyncError(extractSyncError(error, 'upload'));
      onError?.(error as Error);
      return null;
    }
  }, [isEnabled, onError]);

  // Open a cloud project by share ID
  const openProject = useCallback(async (shareId: string): Promise<Project | null> => {
    if (!isEnabled) return null;

    const instances = getFirebaseInstances();
    if (!instances) return null;

    try {
      setSyncStatus('syncing');

      const projectRef = doc(instances.db, 'projects', shareId);
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        setSyncStatus('error');
        setLastSyncError({
          message: `No project found for share ID "${shareId}". Double-check the link.`,
          operation: 'open',
        });
        return null;
      }

      const project = firestoreToProject(projectSnap.data() as Record<string, unknown>);
      setSyncStatus('synced');
      setLastSyncError(null);
      return project;
    } catch (error) {
      console.error('Failed to open project:', error);
      setSyncStatus('error');
      setLastSyncError(extractSyncError(error, 'open'));
      onError?.(error as Error);
      return null;
    }
  }, [isEnabled, onError]);

  // Start syncing a cloud project
  const syncProject = useCallback((project: Project) => {
    if (!isEnabled || !project.isCloud || !project.shareId) return;

    const instances = getFirebaseInstances();
    if (!instances) return;

    // Stop any existing sync
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    if (presenceUnsubscribeRef.current) {
      presenceUnsubscribeRef.current();
    }

    currentProjectIdRef.current = project.id;
    setSyncStatus('syncing');

    // Subscribe to project changes
    const projectRef = doc(instances.db, 'projects', project.shareId);
    unsubscribeRef.current = onSnapshot(
      projectRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSyncStatus('error');
          return;
        }

        const remoteProject = firestoreToProject(snapshot.data() as Record<string, unknown>);

        // Skip if this is our own update
        if (lastLocalUpdateRef.current === remoteProject.updatedAt) {
          setSyncStatus('synced');
          return;
        }

        // Race check: if the remote snapshot arrives with a double-
        // booking, some concurrent edit slipped through the 500ms
        // debounce window and produced a stack. The write is accepted
        // (so we don't lose data) but flagged so the admin knows to
        // audit + repair.
        const violations = findAllDoubleBookings(remoteProject.meetings || []);
        if (violations.length > 0) {
          const first = violations[0];
          setRemoteIntegrityWarning(
            `${violations.length} sync-conflict double-booking${violations.length > 1 ? 's' : ''} detected in incoming data (first: ${first.kind} ${first.partyId.slice(0, 6)} at slot ${first.slotId.slice(0, 6)}). Run the audit script to clean up.`,
          );
          console.warn('[remote-integrity]', { count: violations.length, violations });
        } else {
          setRemoteIntegrityWarning(null);
        }

        // Notify about remote update
        onProjectUpdate?.(remoteProject);
        setSyncStatus('synced');
        setLastSyncError(null);
      },
      (error) => {
        console.error('Sync error:', error);
        setSyncStatus('error');
        setLastSyncError(extractSyncError(error, 'listen'));
        onError?.(error);
      }
    );

    // Subscribe to presence (active collaborators)
    const presenceRef = collection(instances.db, 'projects', project.shareId, 'presence');
    presenceUnsubscribeRef.current = onSnapshot(
      presenceRef,
      (snapshot) => {
        const now = Date.now();
        const collaborators: ActiveCollaborator[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const lastSeen = data.lastSeen?.toDate?.() || new Date(data.lastSeen);
          // Only show collaborators active in last 5 minutes
          if (now - lastSeen.getTime() < 5 * 60 * 1000) {
            collaborators.push({
              userId: doc.id,
              userName: data.userName,
              lastSeen: lastSeen.toISOString(),
            });
          }
        });

        setActiveCollaborators(collaborators);
      }
    );

    // Update our presence
    const updatePresence = async () => {
      let userId = getEffectiveUserId();

      // Try to authenticate if we don't have a user ID
      if (!userId) {
        userId = await signInAnonymouslyIfNeeded();
      }

      if (!userId || !project.shareId) {
        // Auth failed - don't set error status as it would be confusing
        // The user can still work locally, sync just won't show collaborators
        return;
      }

      try {
        const presenceDocRef = doc(instances.db, 'projects', project.shareId, 'presence', userId);
        await setDoc(presenceDocRef, {
          lastSeen: serverTimestamp(),
          userName: `User ${userId.slice(0, 4)}`,
        });
      } catch (error) {
        console.error('Failed to update presence:', error);
      }
    };

    // Update presence immediately and every 30 seconds
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30000);

    // Store interval for cleanup
    const cleanup = unsubscribeRef.current;
    unsubscribeRef.current = () => {
      cleanup?.();
      clearInterval(presenceInterval);
    };

    setSyncStatus('synced');
  }, [isEnabled, onProjectUpdate, onError]);

  // Stop syncing
  const stopSync = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (presenceUnsubscribeRef.current) {
      presenceUnsubscribeRef.current();
      presenceUnsubscribeRef.current = null;
    }
    currentProjectIdRef.current = null;
    setActiveCollaborators([]);
    setSyncStatus('offline');
  }, []);

  // Disconnect a project from cloud (keep local copy)
  const disconnectProject = useCallback(async (_projectId: string) => {
    stopSync();
    // Note: We don't delete from Firestore, just stop syncing
    // The project remains in the cloud for other collaborators
  }, [stopSync]);

  return {
    isEnabled,
    syncStatus,
    activeCollaborators,
    lastSyncError,
    reportSyncError,
    remoteIntegrityWarning,
    uploadProject,
    openProject,
    syncProject,
    stopSync,
    disconnectProject,
  };
}

/**
 * Discovery hook — on login, fetch every cloud project the user has
 * access to (they either own it, or their uid is in `collaborators`).
 *
 * This is the piece that fixes "new device shows no projects": until
 * now, cloud projects were only reachable if you knew the shareId.
 *
 * Returns a status object. `discovered` is null before the first fetch
 * completes; after that it's the merged, deduped list.
 *
 * The Firestore rules in `firestore.rules` scope `list` queries to
 * documents matching one of the two filters, so this only ever returns
 * projects the caller is actually tied to.
 */
export interface DiscoveryState {
  discovered: Project[] | null;
  loading: boolean;
  error: SyncError | null;
}

export function useDiscoveredCloudProjects(userId: string | null): DiscoveryState {
  const [discovered, setDiscovered] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SyncError | null>(null);

  useEffect(() => {
    if (!userId || !isFirebaseConfigured()) {
      // Solo-dev mode or signed out — nothing to discover.
      setDiscovered(null);
      setLoading(false);
      setError(null);
      return;
    }

    const instances = getFirebaseInstances();
    if (!instances) {
      setDiscovered(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const projectsRef = collection(instances.db, 'projects');
    const ownedQuery = query(projectsRef, where('ownerId', '==', userId));
    const collabQuery = query(projectsRef, where('collaborators', 'array-contains', userId));

    Promise.all([getDocs(ownedQuery), getDocs(collabQuery)])
      .then(([ownedSnap, collabSnap]) => {
        if (cancelled) return;
        // Dedupe by document id (shareId). If the same project matches
        // both queries it only appears once.
        const seen = new Set<string>();
        const results: Project[] = [];
        const addFromSnap = (snap: typeof ownedSnap) => {
          snap.forEach(docSnap => {
            if (seen.has(docSnap.id)) return;
            seen.add(docSnap.id);
            const project = firestoreToProject(docSnap.data() as Record<string, unknown>);
            // Defensive: ensure shareId is set (doc id IS the shareId
            // by construction — see uploadProject).
            if (!project.shareId) project.shareId = docSnap.id;
            results.push(project);
          });
        };
        addFromSnap(ownedSnap);
        addFromSnap(collabSnap);
        console.log('[discovery] found', results.length, 'cloud project(s) for', userId);
        setDiscovered(results);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[discovery] Failed to list cloud projects:', err);
        setError(extractSyncError(err, 'listen'));
        setDiscovered([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { discovered, loading, error };
}

// Hook to sync project changes to Firestore.
// onSyncResult is called with the SyncError on failure, or null on success
// (callers can use it to clear a previous error indicator).
export function useSyncProjectChanges(
  project: Project | null,
  syncStatus: SyncStatus,
  onSyncResult?: (error: SyncError | null) => void,
): (projectData: Project) => Promise<void> {
  const syncChanges = useCallback(async (projectData: Project) => {
    if (!project?.isCloud || !project.shareId || syncStatus !== 'synced') {
      console.log('[Sync] Skipping sync - not a cloud project or not synced');
      return;
    }

    const instances = getFirebaseInstances();
    if (!instances) {
      console.log('[Sync] Skipping sync - Firebase not configured');
      return;
    }

    try {
      console.log('[Sync] Syncing project changes to cloud:', {
        shareId: project.shareId,
        meetingsCount: projectData.meetings?.length ?? 0,
      });

      const projectRef = doc(instances.db, 'projects', project.shareId);

      // Use the full serialization to ensure Date objects are converted
      const serializedData = projectToFirestore(projectData);

      await updateDoc(projectRef, serializedData);
      console.log('[Sync] Successfully synced to cloud');
      onSyncResult?.(null);
    } catch (error) {
      console.error('[Sync] Failed to sync changes:', error);
      onSyncResult?.(extractSyncError(error, 'write'));
    }
  }, [project, syncStatus, onSyncResult]);

  return syncChanges;
}
