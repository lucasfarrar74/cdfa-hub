import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  collection,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fsLimit,
  updateDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
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
import type { Project, SyncStatus, ActiveCollaborator, SyncError, ActivityEvent, ProjectVersion } from '../types';
import { findAllDoubleBookings } from '../utils/conflictDetection';
import { computeSyncOutcome, getProjectRevision } from '../utils/syncOutcome';

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
  /**
   * Push a project's changes to Firestore atomically. Returns:
   * - 'proceed'  on success (revision matched, write committed)
   * - 'conflict' when a teammate saved first — the caller should NOT
   *              retry; a red toast is already surfaced via
   *              `lastSyncError`, and onSnapshot brings fresh state
   * - 'error'    for anything else (network, permission, etc.)
   */
  syncProjectChanges: (project: Project) => Promise<'proceed' | 'conflict' | 'error'>;
  /**
   * Tell the sync layer which meeting this user is currently focused on
   * (hovering, editing, dragging). Writes to the presence doc with a
   * per-user 500ms throttle. Pass `null` to clear focus.
   */
  setFocusedMeeting: (meetingId: string | null) => void;
  /** Live-tailed activity log for the active project (newest first, cap 50). */
  activityEvents: ActivityEvent[];
  /** Append an event to the shared activity log. Fire-and-forget. */
  logActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => Promise<void>;
  /** Mark an event as undone so the History UI can grey it out. */
  markActivityUndone: (eventId: string) => Promise<void>;
  /** Live-tailed named-version snapshots for the active project (newest first). */
  projectVersions: ProjectVersion[];
  /** Save the current project state as a named snapshot. */
  saveProjectVersion: (
    project: Project,
    name: string,
    user: { userId: string; userName?: string },
  ) => Promise<{ ok: boolean; versionId?: string; message?: string }>;
  /** Delete a saved version snapshot. */
  deleteProjectVersion: (versionId: string) => Promise<boolean>;
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
  const activityUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  const lastLocalUpdateRef = useRef<string | null>(null);
  // Latest revision we've observed on the server for the active cloud
  // project. Read inside runTransaction to decide whether our write is
  // still up-to-date; updated on: uploadProject, openProject, every
  // onSnapshot, and after a successful sync transaction commits.
  const lastKnownRevisionRef = useRef<number>(0);
  // Live-tailed activity log (last 50 events, newest first).
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  // Live-tailed list of named snapshots for the active project.
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([]);
  const versionsUnsubscribeRef = useRef<Unsubscribe | null>(null);

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
        revision: 1, // first cloud write establishes the concurrency counter
      };

      // Store project in Firestore
      const projectRef = doc(instances.db, 'projects', shareId);
      await setDoc(projectRef, projectToFirestore(cloudProject));

      lastKnownRevisionRef.current = 1;
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
      lastKnownRevisionRef.current = getProjectRevision(project);
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
    activeSyncedShareIdRef.current = project.shareId;
    setSyncStatus('syncing');

    // One-shot bootstrap on first snapshot: add ourselves to this
    // project's collaborators array. Without this the cross-device
    // discovery query (which filters by ownerId or collaborators-
    // contains uid) never returns this project for a non-owner user,
    // so opening a shared link on device A wouldn't make the project
    // discoverable on device B for the same account.
    let hasAttemptedEnrollment = false;

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

        // Track the server's revision so subsequent transactional writes
        // know what we're basing our change on. Kept fresh on every
        // snapshot (whether it's a teammate's write, our own echo, or
        // this initial fetch).
        lastKnownRevisionRef.current = getProjectRevision(remoteProject);

        // Auto-enrol as collaborator once we've seen the first
        // successful snapshot. Uses arrayUnion so parallel enrollments
        // from other users don't clobber each other. Fire-and-forget:
        // if it fails (e.g. offline), sync still works — discovery is
        // just degraded until the next successful sync.
        if (!hasAttemptedEnrollment) {
          hasAttemptedEnrollment = true;
          const currentUid = getEffectiveUserId();
          if (currentUid) {
            const isOwner = remoteProject.ownerId === currentUid;
            const alreadyCollaborator = (remoteProject.collaborators ?? []).includes(currentUid);
            if (!isOwner && !alreadyCollaborator) {
              updateDoc(projectRef, { collaborators: arrayUnion(currentUid) })
                .then(() => console.log('[enroll] added self to collaborators of', remoteProject.shareId))
                .catch(err => console.warn('[enroll] failed to add self to collaborators:', err));
            }
          }
        }

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

    // Subscribe to the activity log — the last 50 events by timestamp
    // desc. Feeds the History panel and any live-change notifications.
    const activityRef = collection(instances.db, 'projects', project.shareId, 'activity');
    const activityQuery = query(activityRef, orderBy('timestamp', 'desc'), fsLimit(50));
    activityUnsubscribeRef.current = onSnapshot(
      activityQuery,
      (snap) => {
        const events: ActivityEvent[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as Omit<ActivityEvent, 'id'>;
          events.push({ ...data, id: doc.id });
        });
        setActivityEvents(events);
      },
      (err) => {
        console.warn('[activity] subscription error:', err);
      },
    );

    // Subscribe to named version snapshots (newest first, no limit —
    // client-side cap of 20 is enforced on writes).
    const versionsRef = collection(instances.db, 'projects', project.shareId, 'versions');
    const versionsQuery = query(versionsRef, orderBy('createdAt', 'desc'));
    versionsUnsubscribeRef.current = onSnapshot(
      versionsQuery,
      (snap) => {
        const versions: ProjectVersion[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as Omit<ProjectVersion, 'id'>;
          versions.push({ ...data, id: doc.id });
        });
        setProjectVersions(versions);
      },
      (err) => {
        console.warn('[versions] subscription error:', err);
      },
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
              focusedMeetingId: typeof data.focusedMeetingId === 'string' ? data.focusedMeetingId : null,
            });
          }
        });

        setActiveCollaborators(collaborators);
      }
    );

    // Update our presence heartbeat. Kept small on purpose — cell-level
    // focus goes through a separate throttled path (see focusedMeetingIdRef
    // and updateFocusedMeeting below) so that intent to focus doesn't
    // wait for the 30s heartbeat.
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
          focusedMeetingId: focusedMeetingIdRef.current,
        }, { merge: true });
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

  // Cell-level focus: which meeting is this user currently attending to.
  // Written to the presence doc with a 500 ms throttle so hover storms
  // don't spam Firestore. `activeSyncedShareIdRef` tracks the project
  // whose sync is currently active — set when syncProject starts,
  // cleared when it stops — so the throttled writer knows where to
  // write without capturing shareId in a closure.
  const focusedMeetingIdRef = useRef<string | null>(null);
  const focusFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSyncedShareIdRef = useRef<string | null>(null);

  const flushFocusedMeeting = useCallback(async () => {
    const instances = getFirebaseInstances();
    const userId = getEffectiveUserId();
    const activeShareId = activeSyncedShareIdRef.current;
    if (!instances || !userId || !activeShareId) return;
    try {
      const presenceDocRef = doc(instances.db, 'projects', activeShareId, 'presence', userId);
      await setDoc(presenceDocRef, {
        lastSeen: serverTimestamp(),
        userName: `User ${userId.slice(0, 4)}`,
        focusedMeetingId: focusedMeetingIdRef.current,
      }, { merge: true });
    } catch (error) {
      console.warn('[presence] focus write failed:', error);
    }
  }, []);

  const setFocusedMeeting = useCallback((meetingId: string | null) => {
    if (focusedMeetingIdRef.current === meetingId) return;
    focusedMeetingIdRef.current = meetingId;
    // Coalesce rapid hover changes into one write per 500ms window.
    if (focusFlushTimerRef.current) return;
    focusFlushTimerRef.current = setTimeout(() => {
      focusFlushTimerRef.current = null;
      flushFocusedMeeting();
    }, 500);
  }, [flushFocusedMeeting]);

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
    if (activityUnsubscribeRef.current) {
      activityUnsubscribeRef.current();
      activityUnsubscribeRef.current = null;
    }
    if (versionsUnsubscribeRef.current) {
      versionsUnsubscribeRef.current();
      versionsUnsubscribeRef.current = null;
    }
    setActivityEvents([]);
    setProjectVersions([]);
    if (focusFlushTimerRef.current) {
      clearTimeout(focusFlushTimerRef.current);
      focusFlushTimerRef.current = null;
    }
    focusedMeetingIdRef.current = null;
    activeSyncedShareIdRef.current = null;
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

  /**
   * Append an activity event to the current project's log. Fire-and-
   * forget — errors are logged, not thrown, because a lost log entry
   * should never block the underlying mutation from committing.
   *
   * Skipped when there's no active cloud project (solo-dev mode is a
   * no-op; local-only projects don't have a shared log to write to).
   */
  const logActivity = useCallback(async (event: Omit<ActivityEvent, 'id' | 'timestamp'>): Promise<void> => {
    const instances = getFirebaseInstances();
    const shareId = activeSyncedShareIdRef.current;
    if (!instances || !shareId) return;
    try {
      const activityCol = collection(instances.db, 'projects', shareId, 'activity');
      await addDoc(activityCol, {
        ...event,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[activity] write failed:', err);
    }
  }, []);

  /**
   * Mark an existing activity event as undone. Used after successfully
   * applying its inverse, so the History panel greys it out and the
   * button becomes disabled to prevent double-undo.
   */
  const markActivityUndone = useCallback(async (eventId: string): Promise<void> => {
    const instances = getFirebaseInstances();
    const shareId = activeSyncedShareIdRef.current;
    if (!instances || !shareId) return;
    try {
      const eventRef = doc(instances.db, 'projects', shareId, 'activity', eventId);
      await updateDoc(eventRef, { undone: true });
    } catch (err) {
      console.warn('[activity] mark-undone failed:', err);
    }
  }, []);

  /**
   * Save the current project state as a named version snapshot.
   * Enforces a client-side cap of 20 snapshots by deleting the oldest
   * when writing beyond that (soft cap — the Firestore rules permit
   * more, this is UX-driven).
   *
   * `createdBy` is captured from the passed-in `user` argument so this
   * hook doesn't need a direct dependency on AuthContext.
   */
  const saveProjectVersion = useCallback(
    async (
      projectData: Project,
      name: string,
      user: { userId: string; userName?: string },
    ): Promise<{ ok: boolean; versionId?: string; message?: string }> => {
      if (!projectData.isCloud || !projectData.shareId) {
        return { ok: false, message: 'Only cloud projects can be versioned.' };
      }
      const instances = getFirebaseInstances();
      if (!instances) return { ok: false, message: 'Firebase not configured.' };
      const shareId = projectData.shareId;

      const trimmedName = name.trim();
      if (!trimmedName) {
        return { ok: false, message: 'Please give the version a name.' };
      }

      try {
        // Enforce cap: if we already have >= 20 snapshots, remove the
        // oldest until we're back under. Client-side only — a race with
        // another admin saving at the same time may leave a couple extra,
        // which is fine.
        const versionsRef = collection(instances.db, 'projects', shareId, 'versions');
        const existing = await getDocs(query(versionsRef, orderBy('createdAt', 'desc')));
        if (existing.size >= 20) {
          const doomed = existing.docs.slice(19); // keep the 19 newest
          await Promise.all(
            doomed.map(d =>
              deleteDoc(doc(instances.db, 'projects', shareId, 'versions', d.id))
                .catch(err => console.warn('[versions] trim failed:', err)),
            ),
          );
        }

        const versionData: Omit<ProjectVersion, 'id'> = {
          name: trimmedName,
          createdAt: new Date().toISOString(),
          createdBy: {
            userId: user.userId,
            userName: user.userName,
          },
          project: projectData,
        };
        const written = await addDoc(versionsRef, versionData);
        return { ok: true, versionId: written.id };
      } catch (error) {
        console.error('[versions] save failed:', error);
        return { ok: false, message: (error as Error)?.message || 'Save failed.' };
      }
    },
    [],
  );

  /**
   * Delete a saved version snapshot. Idempotent — doesn't error if the
   * version was already deleted by another admin.
   */
  const deleteProjectVersion = useCallback(async (versionId: string): Promise<boolean> => {
    const instances = getFirebaseInstances();
    const shareId = activeSyncedShareIdRef.current;
    if (!instances || !shareId) return false;
    try {
      await deleteDoc(doc(instances.db, 'projects', shareId, 'versions', versionId));
      return true;
    } catch (err) {
      console.warn('[versions] delete failed:', err);
      return false;
    }
  }, []);

  /**
   * Push a project's changes to Firestore inside an atomic transaction.
   *
   * Rejects (and returns 'conflict') when the server revision has moved
   * past what we last observed — that's the signal a teammate saved
   * first, and we must NOT overwrite them. The caller (usually the
   * debounced sync in ScheduleContext) surfaces a red toast so the
   * user knows to redo their action against the fresh state.
   *
   * On success, increments the server revision atomically. Also flushes
   * `lastKnownRevisionRef` immediately, so a follow-up write in the
   * same tick uses the freshest counter and doesn't self-conflict
   * before the onSnapshot echo catches up.
   */
  const syncProjectChanges = useCallback(
    async (projectData: Project): Promise<'proceed' | 'conflict' | 'error'> => {
      if (!projectData.isCloud || !projectData.shareId) return 'proceed';

      const instances = getFirebaseInstances();
      if (!instances) return 'error';

      const projectRef = doc(instances.db, 'projects', projectData.shareId);
      const baseRevision = lastKnownRevisionRef.current;

      try {
        const nextRevision = await runTransaction(instances.db, async (tx) => {
          const snap = await tx.get(projectRef);
          if (!snap.exists()) {
            throw new Error('project-missing');
          }
          const serverProject = firestoreToProject(snap.data() as Record<string, unknown>);
          const serverRevision = getProjectRevision(serverProject);

          const outcome = computeSyncOutcome(baseRevision, serverRevision, projectData.meetings);
          if (outcome === 'conflict') {
            const err = new Error(
              `Sync conflict: local base rev ${baseRevision} is behind server rev ${serverRevision}. A teammate saved first.`,
            );
            (err as Error & { code?: string }).code = 'sync-conflict';
            throw err;
          }
          if (outcome === 'would-double-book') {
            const err = new Error('Refused write — outgoing meetings contain a double-booking.');
            (err as Error & { code?: string }).code = 'would-double-book';
            throw err;
          }

          const rev = serverRevision + 1;
          tx.update(projectRef, {
            ...projectToFirestore(projectData),
            revision: rev,
          });
          return rev;
        });

        lastKnownRevisionRef.current = nextRevision;
        console.log('[sync-tx] committed revision', nextRevision);
        reportSyncError(null);
        return 'proceed';
      } catch (error) {
        const code = (error as Error & { code?: string }).code;
        if (code === 'sync-conflict') {
          console.warn('[sync-tx] conflict — teammate saved first');
          reportSyncError({
            message:
              "Sync conflict: a teammate saved a change before yours. Your last edit wasn't kept — please redo it on the fresh schedule.",
            code: 'sync-conflict',
            operation: 'write',
          });
          return 'conflict';
        }
        console.error('[sync-tx] failed:', error);
        reportSyncError(extractSyncError(error, 'write'));
        return 'error';
      }
    },
    [reportSyncError],
  );

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
    syncProjectChanges,
    setFocusedMeeting,
    activityEvents,
    logActivity,
    markActivityUndone,
    projectVersions,
    saveProjectVersion,
    deleteProjectVersion,
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

// (`useSyncProjectChanges` was removed in favour of the transactional
// `syncProjectChanges` callback returned from `useFirebaseSync`. It
// used `updateDoc` non-atomically, which was the source of the
// two-admin lost-write race — see docs/collaboration-workflow-plan.md
// item C.)
