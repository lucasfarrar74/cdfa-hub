import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  collection,
  setDoc,
  getDoc,
  onSnapshot,
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
import type { Project, SyncStatus, ActiveCollaborator } from '../types';

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
      return shareId;
    } catch (error) {
      console.error('Failed to upload project:', error);
      setSyncStatus('error');
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
        return null;
      }

      const project = firestoreToProject(projectSnap.data() as Record<string, unknown>);
      setSyncStatus('synced');
      return project;
    } catch (error) {
      console.error('Failed to open project:', error);
      setSyncStatus('error');
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

        // Notify about remote update
        onProjectUpdate?.(remoteProject);
        setSyncStatus('synced');
      },
      (error) => {
        console.error('Sync error:', error);
        setSyncStatus('error');
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
    uploadProject,
    openProject,
    syncProject,
    stopSync,
    disconnectProject,
  };
}

// Hook to sync project changes to Firestore
export function useSyncProjectChanges(
  project: Project | null,
  syncStatus: SyncStatus
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
    } catch (error) {
      console.error('[Sync] Failed to sync changes:', error);
    }
  }, [project, syncStatus]);

  return syncChanges;
}
