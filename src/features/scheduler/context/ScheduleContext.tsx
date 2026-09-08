import { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useFirebaseSync, useDiscoveredCloudProjects } from '../hooks/useFirebaseSync';
import { useHistoryTracker } from '../hooks/useHistory';
import { useAuth } from '../../../context/AuthContext';
import { mergeDiscoveredProjects } from '../utils/mergeDiscoveredProjects';
import type {
  ScheduleState,
  ScheduleContextType,
  EventConfig,
  Supplier,
  Buyer,
  MeetingStatus,
  Meeting,
  MeetingNote,
  TimeSlot,
  UnscheduledPair,
  Project,
  AppState,
  ConflictCheckResult,
  ConflictInfo,
  ScheduleConflictsSummary,
  ScheduleScoreInfo,
  ActivityEvent,
  ActivityEventType,
  UndoPayload,
} from '../types';
import { isLegacySupplier, migrateSupplier, isLegacyEventConfig, migrateEventConfig } from '../types';
import { autoFillCancelledSlots, bumpMeetingToLaterSlot, findNextAvailableSlotAfter } from '../utils/scheduler';
import { resolveScheduleStacks } from '../utils/resolveScheduleStacks';
import {
  placeSupplierIncrementally,
  placeBuyerIncrementally,
  rebalanceSupplier,
  removeSupplierFromEvent,
  applyLateArrival,
  shiftScheduleAfter,
  type PlacementResult,
  type RebalanceResult,
  type RemoveSupplierResult,
  type LateArrivalResult,
  type ShiftScheduleResult,
} from '../utils/incrementalPlacement';
import { generateTimeSlots } from '../utils/timeUtils';
import { assignBuyerColors } from '../utils/colors';
import {
  checkMoveConflicts as checkMoveConflictsUtil,
  checkAddMeetingConflicts as checkAddMeetingConflictsUtil,
  checkPreferenceViolation,
  getConflictsForMeeting,
  getScheduleConflictsSummary,
  isSupplierAvailableAtSlot,
  detectFirstDoubleBooking,
  findAllDoubleBookings,
} from '../utils/conflictDetection';

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Bump a YYYY-MM-DD date string forward by exactly one day. Used by
// `extendEventEndDate` to build a config that spans only the newly
// appended days.
function bumpDateByOneDay(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Format a DoubleBooking violation into a short human message for the
// toast. Falls back to IDs if names aren't available.
function describeViolationForToast(
  violation: { kind: 'supplier' | 'buyer'; partyId: string; slotId: string },
  project: Project,
): string {
  const party = violation.kind === 'supplier'
    ? project.suppliers.find(s => s.id === violation.partyId)?.companyName
    : project.buyers.find(b => b.id === violation.partyId)?.name;
  const partyLabel = party || `${violation.kind} ${violation.partyId.slice(0, 6)}`;
  return `Move blocked: ${partyLabel} already has a meeting in that slot.`;
}

// Create a new empty project
function createEmptyProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    eventConfig: null,
    suppliers: [],
    buyers: [],
    meetings: [],
    timeSlots: [],
    unscheduledPairs: [],
  };
}

const initialAppState: AppState = {
  projects: [],
  activeProjectId: null,
  isGenerating: false,
};

// Migrate single ScheduleState to Project
function migrateScheduleStateToProject(data: Record<string, unknown>): Project {
  const now = new Date().toISOString();

  let suppliers = (data.suppliers as Supplier[]) ?? [];
  // Migrate legacy suppliers if needed
  if (suppliers.length > 0 && isLegacySupplier(suppliers[0])) {
    suppliers = suppliers.map(s =>
      migrateSupplier(s as unknown as Parameters<typeof migrateSupplier>[0])
    );
  }

  let timeSlots = (data.timeSlots as TimeSlot[]) ?? [];
  // Restore Date objects and add date field if missing
  if (timeSlots.length > 0) {
    timeSlots = timeSlots.map(slot => {
      const startTime = new Date(slot.startTime);
      return {
        ...slot,
        startTime,
        endTime: new Date(slot.endTime),
        // Add date field if missing (legacy data)
        date: slot.date || startTime.toISOString().split('T')[0],
      };
    });
  }

  // Migrate legacy EventConfig if needed
  let eventConfig = data.eventConfig as EventConfig | null;
  if (eventConfig && isLegacyEventConfig(eventConfig)) {
    eventConfig = migrateEventConfig(eventConfig);
  }

  return {
    id: generateId(),
    name: eventConfig?.name || 'Imported Project',
    createdAt: now,
    updatedAt: now,
    eventConfig: eventConfig ?? null,
    suppliers,
    buyers: (data.buyers as Buyer[]) ?? [],
    meetings: (data.meetings as Meeting[]) ?? [],
    timeSlots,
    unscheduledPairs: (data.unscheduledPairs as UnscheduledPair[]) ?? [],
  };
}

// Migration function for stored data
function migrateAppState(data: unknown): AppState {
  if (!data || typeof data !== 'object') return initialAppState;

  const rawData = data as Record<string, unknown>;

  // Check if this is new AppState format
  if (Array.isArray(rawData.projects)) {
    // Already in AppState format, restore Date objects and migrate any legacy data
    const projects = (rawData.projects as Project[]).map(project => {
      // Migrate legacy EventConfig if needed
      let eventConfig = project.eventConfig;
      if (eventConfig && isLegacyEventConfig(eventConfig)) {
        eventConfig = migrateEventConfig(eventConfig);
      }

      return {
        ...project,
        eventConfig,
        timeSlots: project.timeSlots.map(slot => {
          const startTime = new Date(slot.startTime);
          return {
            ...slot,
            startTime,
            endTime: new Date(slot.endTime),
            // Add date field if missing (legacy data)
            date: slot.date || startTime.toISOString().split('T')[0],
          };
        }),
      };
    });

    return {
      projects,
      activeProjectId: (rawData.activeProjectId as string | null) ?? (projects[0]?.id ?? null),
      isGenerating: false,
    };
  }

  // Old ScheduleState format - migrate to AppState with single project
  if (rawData.eventConfig !== undefined || rawData.suppliers !== undefined) {
    const migratedProject = migrateScheduleStateToProject(rawData);
    return {
      projects: [migratedProject],
      activeProjectId: migratedProject.id,
      isGenerating: false,
    };
  }

  return initialAppState;
}

// Helper to restore TimeSlot dates in a project and migrate legacy data
function restoreProjectDates(project: Project): Project {
  // Migrate legacy EventConfig if needed
  let eventConfig = project.eventConfig;
  if (eventConfig && isLegacyEventConfig(eventConfig)) {
    eventConfig = migrateEventConfig(eventConfig);
  }

  // Safely restore timeSlots with Date objects
  const timeSlots = (project.timeSlots || []).map(slot => {
    const startTime = new Date(slot.startTime);
    return {
      ...slot,
      startTime,
      endTime: new Date(slot.endTime),
      // Add date field if missing (legacy data)
      date: slot.date || startTime.toISOString().split('T')[0],
    };
  });

  // Preserve all project data including meetings
  return {
    ...project,
    eventConfig,
    timeSlots,
    // Explicitly preserve arrays to ensure they're not lost
    meetings: project.meetings || [],
    suppliers: project.suppliers || [],
    buyers: project.buyers || [],
    unscheduledPairs: project.unscheduledPairs || [],
  };
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// Type for history snapshots
interface MeetingsSnapshot {
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: UnscheduledPair[];
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useLocalStorage<AppState>(
    'meeting-scheduler-projects',
    initialAppState,
    migrateAppState
  );

  // Cross-device project discovery: when a real Firebase user is
  // signed in (i.e. auth is enabled, not solo-dev mode), fetch every
  // cloud project they own or collaborate on. On first arrival, merge
  // any that aren't already local — this is what makes cloud projects
  // show up on a fresh browser after login.
  const auth = useAuth();
  const discoveryUserId = auth.isConfigured ? auth.user?.uid ?? null : null;
  const { discovered: discoveredCloudProjects, error: discoveryError } =
    useDiscoveredCloudProjects(discoveryUserId);

  // History tracking for undo/redo
  const historyTracker = useHistoryTracker<MeetingsSnapshot>(20);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  // Schedule optimization state
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastScheduleScore, setLastScheduleScore] = useState<ScheduleScoreInfo | null>(null);

  // Rejection message from a mutation guard (double-booking, etc.).
  // The scheduler page mounts <ScheduleErrorToast> which subscribes.
  const [mutationError, setMutationError] = useState<string | null>(null);
  const clearMutationError = useCallback(() => setMutationError(null), []);

  // Create a starter project only if there's nothing to hydrate from
  // discovery. If auth is on and discovery is still in flight, wait —
  // otherwise a "New Event" briefly races the discovered cloud projects
  // and can end up as the active project on every login.
  useEffect(() => {
    if (appState.projects.length > 0) return;
    // Discovery pending — hold off; it may bring cloud projects that
    // make a default unnecessary. When discovery is disabled
    // (`discoveryUserId === null`, i.e. solo-dev mode), skip the wait.
    if (discoveryUserId !== null && discoveredCloudProjects === null) return;
    setAppState(prev => {
      // Race guard: another effect (e.g. hydration) added projects
      // between fire and commit.
      if (prev.projects.length > 0) return prev;
      const defaultProject = createEmptyProject('New Event');
      return {
        projects: [defaultProject],
        activeProjectId: defaultProject.id,
        isGenerating: false,
      };
    });
  }, [appState.projects.length, discoveryUserId, discoveredCloudProjects, setAppState]);

  // Hydrate discovered cloud projects into the local list. Additions
  // only — mergeDiscoveredProjects never overwrites a local project
  // that shares the same shareId, so the live Firestore subscription
  // remains the source of truth for anything already being synced.
  useEffect(() => {
    if (!discoveredCloudProjects) return;
    setAppState(prev => {
      const { merged, additions } = mergeDiscoveredProjects(prev.projects, discoveredCloudProjects);
      if (additions.length === 0) return prev;
      console.log(
        `[schedule-context] hydrated ${additions.length} cloud project(s) discovered for user ${discoveryUserId}`,
      );
      // If we still have no active project (fresh device, first login),
      // pick the first hydrated cloud project so the user lands on real
      // work rather than the empty "New Event" default.
      const nextActiveId =
        prev.activeProjectId && merged.some(p => p.id === prev.activeProjectId)
          ? prev.activeProjectId
          : additions[0].id;
      return { ...prev, projects: merged, activeProjectId: nextActiveId };
    });
  }, [discoveredCloudProjects, discoveryUserId, setAppState]);

  // Get active project
  const activeProject = useMemo(() => {
    if (!appState.activeProjectId) return null;
    return appState.projects.find(p => p.id === appState.activeProjectId) ?? null;
  }, [appState.projects, appState.activeProjectId]);

  // Live integrity check — surfaces stacked meetings from any source
  // (pre-existing bug damage, corrupted import, sync race, etc.).
  // The schedule view mounts a banner when this is non-empty.
  const scheduleIntegrityIssues = useMemo(() => {
    if (!activeProject) return [];
    return findAllDoubleBookings(activeProject.meetings || []);
  }, [activeProject]);

  // Latest appState in a ref so `handleRemoteProjectUpdate` can compare
  // incoming remote data against our current local state without
  // recreating the callback (which would tear down the Firestore
  // subscription on every state change).
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // Firebase sync. When a remote snapshot actually diverges from our
  // local state (i.e. is not just an echo of our own write), the local
  // undo history becomes stale — any snapshot in it pre-dates edits we
  // now know about, so applying it via Undo could silently wipe a
  // teammate's change. Clear the history to force the user to re-do
  // any correction against the fresh state.
  const handleRemoteProjectUpdate = useCallback((remoteProject: Project) => {
    const currentLocal = appStateRef.current.projects.find(
      p => p.shareId === remoteProject.shareId,
    );
    const meetingsChanged =
      !currentLocal ||
      JSON.stringify(currentLocal.meetings) !== JSON.stringify(remoteProject.meetings);
    const slotsChanged =
      !currentLocal ||
      JSON.stringify(currentLocal.timeSlots) !== JSON.stringify(remoteProject.timeSlots);
    const contentDiverged = meetingsChanged || slotsChanged;

    setAppState(prev => ({
      ...prev,
      projects: prev.projects.map(p =>
        p.shareId === remoteProject.shareId ? remoteProject : p
      ),
    }));

    if (contentDiverged) {
      historyTracker.clear();
      setHistoryState({ canUndo: false, canRedo: false });
    }
  }, [setAppState, historyTracker]);

  const {
    isEnabled: isFirebaseEnabled,
    syncStatus,
    activeCollaborators,
    lastSyncError,
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
    saveProjectVersion: saveProjectVersionInternal,
    deleteProjectVersion,
    removeCollaborator,
    transferOwnership,
    stopSync,
    disconnectProject: disconnectFromCloudInternal,
  } = useFirebaseSync({
    onProjectUpdate: handleRemoteProjectUpdate,
    onError: (error) => console.error('Firebase sync error:', error),
  });

  // Track if we're syncing a cloud project
  const lastSyncedProjectRef = useRef<string | null>(null);

  // Start/stop syncing when active project changes
  useEffect(() => {
    if (activeProject?.isCloud && activeProject.shareId) {
      if (lastSyncedProjectRef.current !== activeProject.shareId) {
        syncProject(activeProject);
        lastSyncedProjectRef.current = activeProject.shareId;
      }
    } else {
      if (lastSyncedProjectRef.current) {
        stopSync();
        lastSyncedProjectRef.current = null;
      }
    }
  }, [activeProject, syncProject, stopSync]);

  // Cloud sync: Push local changes to Firebase inside a transaction.
  // If the transaction reports 'conflict' (a teammate saved first),
  // the mutation error toast is already surfaced via `reportSyncError`;
  // we additionally clear the undo history because it's stale relative
  // to whatever the incoming onSnapshot is about to bring in.
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Latest project scheduled for a debounced sync. Used by the flush
  // path so unmount / beforeunload can send whatever is pending even
  // if the debounce timer hasn't fired yet — previously we cleared the
  // timer and lost the write on any refresh within the debounce window.
  const pendingSyncProjectRef = useRef<Project | null>(null);

  const flushPendingSync = useCallback(() => {
    if (!pendingSyncProjectRef.current) return;
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
      syncDebounceRef.current = null;
    }
    const project = pendingSyncProjectRef.current;
    pendingSyncProjectRef.current = null;
    // Fire-and-forget. During beforeunload the browser typically lets
    // the in-flight request complete; on regular unmount it just runs
    // to completion in the background.
    void syncProjectChanges(project);
  }, [syncProjectChanges]);

  // Debounced sync function to avoid excessive Firebase writes
  const debouncedSyncToCloud = useCallback((project: Project) => {
    if (!project.isCloud || !project.shareId || syncStatus !== 'synced') {
      return;
    }

    pendingSyncProjectRef.current = project;

    // Clear existing timeout
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }

    // Debounce: wait 250ms before syncing (tightened from 500ms so a
    // quick refresh has half the vulnerability window it used to).
    syncDebounceRef.current = setTimeout(async () => {
      syncDebounceRef.current = null;
      const scheduled = pendingSyncProjectRef.current;
      if (!scheduled) return;
      pendingSyncProjectRef.current = null;
      const outcome = await syncProjectChanges(scheduled);
      if (outcome === 'conflict') {
        // Undo stack pre-dates the teammate's landing write; nothing
        // in it can be safely applied against the newer server state.
        historyTracker.clear();
        setHistoryState({ canUndo: false, canRedo: false });
      }
    }, 250);
  }, [syncStatus, syncProjectChanges, historyTracker]);

  // Flush any pending debounced sync when the tab is closing, when the
  // page is hidden, or on unmount. Previously we just cancelled the
  // timeout, which meant a refresh within the debounce window silently
  // dropped whatever the user had just done (added meetings vanished
  // on refresh — user report).
  useEffect(() => {
    const onBeforeUnload = () => flushPendingSync();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPendingSync();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      // On unmount (route change / provider teardown), flush too — the
      // in-flight request continues to completion after unmount.
      flushPendingSync();
    };
  }, [flushPendingSync]);

  // Helper to update the active project (with cloud sync)
  const updateActiveProject = useCallback((updater: (project: Project) => Project) => {
    setAppState(prev => {
      if (!prev.activeProjectId) return prev;
      const now = new Date().toISOString();

      const currentProject = prev.projects.find(p => p.id === prev.activeProjectId);
      if (!currentProject) return prev;

      const updatedProject = { ...updater(currentProject), updatedAt: now };

      // Trigger cloud sync for cloud projects
      if (updatedProject.isCloud && updatedProject.shareId) {
        debouncedSyncToCloud(updatedProject);
      }

      return {
        ...prev,
        projects: prev.projects.map(p =>
          p.id === prev.activeProjectId ? updatedProject : p
        ),
      };
    });
  }, [setAppState, debouncedSyncToCloud]);

  // Save current state to history before making changes
  const saveToHistory = useCallback(() => {
    if (!activeProject) return;
    historyTracker.push({
      meetings: activeProject.meetings,
      timeSlots: activeProject.timeSlots,
      unscheduledPairs: activeProject.unscheduledPairs,
    });
    setHistoryState({ canUndo: true, canRedo: false });
  }, [activeProject, historyTracker]);

  // Helper: build a short human summary for an activity event. Kept
  // simple — the History panel will show it verbatim.
  const buildMeetingLabel = useCallback((meetingId: string): string => {
    if (!activeProject) return `meeting ${meetingId.slice(0, 6)}`;
    const m = activeProject.meetings.find(x => x.id === meetingId);
    if (!m) return `meeting ${meetingId.slice(0, 6)}`;
    const supplier = activeProject.suppliers.find(s => s.id === m.supplierId);
    const buyer = activeProject.buyers.find(b => b.id === m.buyerId);
    return `${supplier?.companyName ?? 'unknown supplier'} × ${buyer?.name ?? 'unknown buyer'}`;
  }, [activeProject]);

  // Helper: dispatch an activity event with consistent user attribution.
  // Fire-and-forget; falls back to a no-op when there's no cloud project
  // to log against (solo-dev mode).
  const emitActivity = useCallback(
    (type: ActivityEventType, summary: string, undoPayload: UndoPayload, details: ActivityEvent['details'] = {}) => {
      if (!activeProject?.isCloud) return;
      const uid = auth.user?.uid || 'local-user';
      const userName = auth.user?.displayName || auth.user?.email || undefined;
      void logActivity({
        type,
        userId: uid,
        userName,
        summary,
        details,
        undoPayload,
      });
    },
    [activeProject, auth.user, logActivity],
  );

  // Undo last operation. Peeks the snapshot first and runs the same
  // double-booking guard used by write mutations — if restoring the
  // snapshot would create a stack (e.g. a teammate's change landed after
  // the snapshot was pushed and now collides with what it would
  // restore), refuse the undo, clear the now-stale history, and surface
  // a red toast instead of silently corrupting the schedule.
  const undo = useCallback(() => {
    const snapshot = historyTracker.peekPast();
    if (!snapshot) return;
    const violation = detectFirstDoubleBooking(snapshot.meetings);
    if (violation) {
      setMutationError(
        'Undo blocked: reverting would create a double-booking (a teammate may have edited the schedule since). Undo history has been cleared.',
      );
      historyTracker.clear();
      setHistoryState({ canUndo: false, canRedo: false });
      return;
    }
    historyTracker.undo();
    updateActiveProject(project => ({
      ...project,
      meetings: snapshot.meetings,
      timeSlots: snapshot.timeSlots,
      unscheduledPairs: snapshot.unscheduledPairs,
    }));
    setHistoryState({ canUndo: historyTracker.canUndo, canRedo: historyTracker.canRedo });
  }, [historyTracker, updateActiveProject]);

  // Redo last undone operation. Same guard as undo.
  const redo = useCallback(() => {
    const snapshot = historyTracker.peekFuture();
    if (!snapshot) return;
    const violation = detectFirstDoubleBooking(snapshot.meetings);
    if (violation) {
      setMutationError(
        'Redo blocked: re-applying would create a double-booking (a teammate may have edited the schedule since). Redo history has been cleared.',
      );
      historyTracker.clear();
      setHistoryState({ canUndo: false, canRedo: false });
      return;
    }
    historyTracker.redo();
    updateActiveProject(project => ({
      ...project,
      meetings: snapshot.meetings,
      timeSlots: snapshot.timeSlots,
      unscheduledPairs: snapshot.unscheduledPairs,
    }));
    setHistoryState({ canUndo: historyTracker.canUndo, canRedo: historyTracker.canRedo });
  }, [historyTracker, updateActiveProject]);

  // Clear history when switching projects
  const lastProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (appState.activeProjectId !== lastProjectIdRef.current) {
      historyTracker.clear();
      setHistoryState({ canUndo: false, canRedo: false });
      lastProjectIdRef.current = appState.activeProjectId;
    }
  }, [appState.activeProjectId, historyTracker]);

  // Project management
  const createProject = useCallback((name: string, options?: { cdfaActivityId?: string; fiscalYear?: string }): Project => {
    const newProject = createEmptyProject(name);
    // Add CDFA integration fields if provided
    if (options?.cdfaActivityId) {
      newProject.cdfaActivityId = options.cdfaActivityId;
    }
    if (options?.fiscalYear) {
      newProject.fiscalYear = options.fiscalYear;
    }
    setAppState(prev => ({
      ...prev,
      projects: [...prev.projects, newProject],
      activeProjectId: newProject.id,
    }));
    return newProject;
  }, [setAppState]);

  const switchProject = useCallback((projectId: string) => {
    setAppState(prev => ({
      ...prev,
      activeProjectId: projectId,
    }));
  }, [setAppState]);

  const deleteProject = useCallback((projectId: string) => {
    setAppState(prev => {
      const newProjects = prev.projects.filter(p => p.id !== projectId);
      let newActiveId = prev.activeProjectId;

      // If deleting active project, switch to first remaining or null
      if (prev.activeProjectId === projectId) {
        newActiveId = newProjects[0]?.id ?? null;
      }

      return {
        ...prev,
        projects: newProjects,
        activeProjectId: newActiveId,
      };
    });
  }, [setAppState]);

  const duplicateProject = useCallback((projectId: string): Project => {
    const source = appState.projects.find(p => p.id === projectId);
    if (!source) throw new Error('Project not found');

    const now = new Date().toISOString();
    const newProject: Project = {
      ...source,
      id: generateId(),
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    setAppState(prev => ({
      ...prev,
      projects: [...prev.projects, newProject],
      activeProjectId: newProject.id,
    }));

    return newProject;
  }, [appState.projects, setAppState]);

  const renameProject = useCallback((projectId: string, name: string) => {
    setAppState(prev => ({
      ...prev,
      projects: prev.projects.map(p =>
        p.id === projectId
          ? { ...p, name, updatedAt: new Date().toISOString() }
          : p
      ),
    }));
  }, [setAppState]);

  // Auto-fix every double-booking in the active project. For each
  // stack, keep the highest-preference-scoring meeting and try to
  // reschedule each loser to a different open slot. If no open slot
  // fits, the loser is cancelled (recoverable — meeting stays in the
  // array with status='cancelled'). Returns the counts so the UI can
  // report what happened.
  const resolveActiveProjectStacks = useCallback((): { rescheduledCount: number; cancelledCount: number } => {
    if (!activeProject) return { rescheduledCount: 0, cancelledCount: 0 };
    const { updatedMeetings, rescheduledIds, cancelledIds } = resolveScheduleStacks(
      activeProject.meetings,
      activeProject.suppliers,
      activeProject.timeSlots,
    );
    if (rescheduledIds.length === 0 && cancelledIds.length === 0) {
      return { rescheduledCount: 0, cancelledCount: 0 };
    }
    saveToHistory();
    updateActiveProject(project => ({ ...project, meetings: updatedMeetings }));
    return { rescheduledCount: rescheduledIds.length, cancelledCount: cancelledIds.length };
  }, [activeProject, saveToHistory, updateActiveProject]);

  // Remember the Google Sheet the active project was pushed to, so future
  // pushes update the same Sheet instead of creating a new one each time.
  const setActiveProjectSheetsLink = useCallback(
    (googleSheetsId: string, googleSheetsUrl: string) => {
      updateActiveProject(project => ({
        ...project,
        googleSheetsId,
        googleSheetsUrl,
      }));
    },
    [updateActiveProject],
  );

  // Event config. Three cases:
  //  1. Cosmetic-only change (name, strategy, optimizer toggles) →
  //     preserve schedule.
  //  2. Pure endDate extension (nothing else changed, new endDate is
  //     later than old) → preserve schedule + append slots for the
  //     new day(s). Non-destructive extend.
  //  3. Any other scheduling-relevant change (start date, times,
  //     duration, breaks, disabled days, non-extension endDate change)
  //     → wipe meetings + timeSlots.
  const setEventConfig = useCallback((config: EventConfig) => {
    updateActiveProject(project => {
      const previous = project.eventConfig;
      const isFirstConfig = !previous;

      if (isFirstConfig || !previous) {
        return {
          ...project,
          eventConfig: config,
          meetings: [],
          timeSlots: [],
        };
      }

      const startDateChanged = previous.startDate !== config.startDate;
      const endDateChanged = previous.endDate !== config.endDate;
      const timesChanged = previous.startTime !== config.startTime || previous.endTime !== config.endTime;
      const durationChanged = previous.defaultMeetingDuration !== config.defaultMeetingDuration;
      const breaksChanged = JSON.stringify(previous.breaks) !== JSON.stringify(config.breaks);
      const disabledDaysChanged =
        JSON.stringify(previous.disabledDays || []) !== JSON.stringify(config.disabledDays || []);

      const isPureEndDateExtension =
        endDateChanged &&
        config.endDate > previous.endDate &&
        !startDateChanged &&
        !timesChanged &&
        !durationChanged &&
        !breaksChanged &&
        !disabledDaysChanged;

      if (isPureEndDateExtension && project.timeSlots.length > 0) {
        // Generate slots ONLY for the newly-added trailing days.
        const newDaysConfig: EventConfig = {
          ...config,
          startDate: bumpDateByOneDay(previous.endDate),
        };
        const newSlots = generateTimeSlots(newDaysConfig);
        return {
          ...project,
          eventConfig: config,
          timeSlots: [...project.timeSlots, ...newSlots],
        };
      }

      const scheduleAffected =
        startDateChanged ||
        endDateChanged ||
        timesChanged ||
        durationChanged ||
        breaksChanged ||
        disabledDaysChanged;

      if (scheduleAffected) {
        return {
          ...project,
          eventConfig: config,
          meetings: [],
          timeSlots: [],
        };
      }
      // Cosmetic-only change (name, scheduling strategy, optimizer
      // toggles). Preserve the generated schedule.
      return {
        ...project,
        eventConfig: config,
      };
    });
  }, [updateActiveProject]);

  // Suppliers
  const addSupplier = useCallback((supplier: Supplier) => {
    updateActiveProject(project => ({
      ...project,
      suppliers: [...project.suppliers, supplier],
    }));
  }, [updateActiveProject]);

  /**
   * Add a supplier AND incrementally place their meetings into the
   * existing schedule. Never moves or cancels existing meetings.
   *
   * Returns a summary: how many meetings landed, how many couldn't be
   * placed (with reasons), what the new unscheduledPairs are.
   */
  const addSupplierAndAutoSchedule = useCallback(
    (supplier: Supplier): PlacementResult & { placed: number; unplaced: number } => {
      if (!activeProject) {
        return { additions: [], unscheduledPairs: [], failures: [], placed: 0, unplaced: 0 };
      }
      const nextSuppliers = [...activeProject.suppliers, supplier];
      const result = placeSupplierIncrementally(
        supplier.id,
        nextSuppliers,
        activeProject.buyers,
        activeProject.timeSlots,
        activeProject.meetings,
      );
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        suppliers: [...project.suppliers, supplier],
        meetings: [...project.meetings, ...result.additions],
        unscheduledPairs: [...project.unscheduledPairs, ...result.unscheduledPairs],
      }));
      emitActivity(
        'auto_fix_applied',
        `Added supplier "${supplier.companyName}" — placed ${result.additions.length} meeting(s), ${result.unscheduledPairs.length} could not be scheduled`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return {
        ...result,
        placed: result.additions.length,
        unplaced: result.unscheduledPairs.length,
      };
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  const updateSupplier = useCallback((id: string, updates: Partial<Supplier>) => {
    updateActiveProject(project => ({
      ...project,
      suppliers: project.suppliers.map(s => (s.id === id ? { ...s, ...updates } : s)),
    }));
  }, [updateActiveProject]);

  const removeSupplier = useCallback((id: string) => {
    updateActiveProject(project => ({
      ...project,
      suppliers: project.suppliers.filter(s => s.id !== id),
      meetings: project.meetings.filter(m => m.supplierId !== id),
    }));
  }, [updateActiveProject]);

  const importSuppliers = useCallback((suppliers: Supplier[]) => {
    updateActiveProject(project => ({
      ...project,
      suppliers,
      meetings: [],
      timeSlots: [],
    }));
  }, [updateActiveProject]);

  /**
   * Rebalance a single supplier's meetings against their (possibly
   * changed) availability window / selected days. Anything that still
   * fits stays put; anything that no longer fits is moved (if a
   * compatible slot exists) or cancelled.
   */
  const rebalanceSupplierAction = useCallback(
    (supplierId: string): RebalanceResult => {
      if (!activeProject) return { updatedMeetings: [], movedIds: [], cancelledIds: [] };
      const result = rebalanceSupplier(
        supplierId,
        activeProject.suppliers,
        activeProject.timeSlots,
        activeProject.meetings,
      );
      if (result.movedIds.length === 0 && result.cancelledIds.length === 0) return result;
      saveToHistory();
      updateActiveProject(project => ({ ...project, meetings: result.updatedMeetings }));
      const supplier = activeProject.suppliers.find(s => s.id === supplierId);
      emitActivity(
        'auto_fix_applied',
        `Rebalanced ${supplier?.companyName ?? 'supplier'} — moved ${result.movedIds.length}, cancelled ${result.cancelledIds.length}`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return result;
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  /**
   * Remove a supplier from the event: cancel all their active meetings,
   * add the affected buyers to `unscheduledPairs`. If `reassignTo` is
   * provided, try to place each cancelled pair with that supplier
   * instead. Other suppliers' meetings are never touched.
   */
  const removeSupplierFromEventAction = useCallback(
    (supplierId: string, reassignTo?: string): RemoveSupplierResult => {
      if (!activeProject) {
        return { updatedMeetings: [], cancelledIds: [], reassignments: [], unscheduledPairs: [] };
      }
      const result = removeSupplierFromEvent(
        supplierId,
        activeProject.suppliers,
        activeProject.buyers,
        activeProject.timeSlots,
        activeProject.meetings,
        reassignTo,
      );
      if (result.cancelledIds.length === 0) return result;
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        meetings: result.updatedMeetings,
        unscheduledPairs: [...project.unscheduledPairs, ...result.unscheduledPairs],
      }));
      const supplier = activeProject.suppliers.find(s => s.id === supplierId);
      const replacement = reassignTo ? activeProject.suppliers.find(s => s.id === reassignTo) : undefined;
      const summary = reassignTo
        ? `Removed ${supplier?.companyName ?? 'supplier'} — reassigned ${result.reassignments.length} to ${replacement?.companyName ?? 'replacement'}, ${result.unscheduledPairs.length} unplaced`
        : `Removed ${supplier?.companyName ?? 'supplier'} — cancelled ${result.cancelledIds.length} meeting(s)`;
      emitActivity(
        'auto_fix_applied',
        summary,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return result;
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  /**
   * "Late arrival" — a supplier can only start meeting at `earliestHHMM`
   * on `date`. Every one of their scheduled meetings before that time
   * is either bumped to a later same-day slot or cancelled.
   */
  const applyLateArrivalAction = useCallback(
    (supplierId: string, date: string, earliestHHMM: string): LateArrivalResult => {
      if (!activeProject) return { updatedMeetings: [], movedIds: [], cancelledIds: [] };
      const result = applyLateArrival(
        supplierId,
        date,
        earliestHHMM,
        activeProject.suppliers,
        activeProject.timeSlots,
        activeProject.meetings,
      );
      if (result.movedIds.length === 0 && result.cancelledIds.length === 0) return result;
      saveToHistory();
      updateActiveProject(project => ({ ...project, meetings: result.updatedMeetings }));
      const supplier = activeProject.suppliers.find(s => s.id === supplierId);
      emitActivity(
        'auto_fix_applied',
        `${supplier?.companyName ?? 'Supplier'} late arrival at ${earliestHHMM} — moved ${result.movedIds.length}, cancelled ${result.cancelledIds.length}`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return result;
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  /**
   * Shift every meeting at/after `fromHHMM` on `date` by `minutes`.
   * Meetings that can't shift (no matching later slot, or a party is
   * busy in the target) are left in place; the caller may want to
   * inspect couldNotShiftIds and handle them separately.
   */
  const shiftScheduleAfterAction = useCallback(
    (date: string, fromHHMM: string, minutes: number): ShiftScheduleResult => {
      if (!activeProject) return { updatedMeetings: [], shiftedIds: [], couldNotShiftIds: [] };
      const result = shiftScheduleAfter(date, fromHHMM, minutes, activeProject.timeSlots, activeProject.meetings);
      if (result.shiftedIds.length === 0) return result;
      saveToHistory();
      updateActiveProject(project => ({ ...project, meetings: result.updatedMeetings }));
      emitActivity(
        'auto_fix_applied',
        `Shifted ${result.shiftedIds.length} meeting(s) after ${fromHHMM} by ${minutes} min`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return result;
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  /**
   * Extend the event by one or more additional days at the end. Only
   * NEW slots are generated; existing meetings and slots are preserved.
   * Also updates `eventConfig.endDate` so the config stays coherent.
   */
  const extendEventEndDate = useCallback(
    (newEndDate: string): { addedSlots: number } => {
      if (!activeProject?.eventConfig) return { addedSlots: 0 };
      const config = activeProject.eventConfig;
      if (newEndDate <= config.endDate) return { addedSlots: 0 };

      // Build a temporary config that spans ONLY the new days so
      // generateTimeSlots only produces those, then append to
      // existing slots.
      const nextConfig = { ...config, endDate: newEndDate };
      const newDayConfig: EventConfig = {
        ...config,
        startDate: bumpDateByOneDay(config.endDate),
        endDate: newEndDate,
      };
      const newSlots = generateTimeSlots(newDayConfig);
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        eventConfig: nextConfig,
        timeSlots: [...project.timeSlots, ...newSlots],
      }));
      emitActivity(
        'auto_fix_applied',
        `Extended event to ${newEndDate} — added ${newSlots.length} slot(s), preserved existing schedule`,
        { kind: 'none' },
        {},
      );
      return { addedSlots: newSlots.length };
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  /**
   * Mark a specific slot as reserved / blocked. Its rendering changes
   * (dimmed, labeled) and no meetings can be placed there. Any
   * currently-scheduled active meetings in that slot are cancelled;
   * bumping them requires a separate manual step.
   */
  const reserveSlot = useCallback(
    (slotId: string, reason: string): { cancelledIds: string[] } => {
      if (!activeProject) return { cancelledIds: [] };
      const cancelledIds: string[] = [];
      const nextMeetings = activeProject.meetings.map(m => {
        if (m.timeSlotId !== slotId) return m;
        if (m.status === 'cancelled' || m.status === 'bumped') return m;
        cancelledIds.push(m.id);
        return { ...m, status: 'cancelled' as const };
      });
      const nextSlots = activeProject.timeSlots.map(s =>
        s.id === slotId ? { ...s, isBreak: true, breakName: reason || 'Reserved' } : s,
      );
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        meetings: nextMeetings,
        timeSlots: nextSlots,
      }));
      emitActivity(
        'auto_fix_applied',
        `Reserved slot: ${reason || 'blocked'} (cancelled ${cancelledIds.length} meeting(s))`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return { cancelledIds };
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  /**
   * List every currently-scheduled meeting whose supplier×buyer pair
   * now violates the supplier's preference. Used after editing a
   * supplier's preference to show the admin what to reconcile.
   */
  const getPreferenceViolations = useCallback((): Array<{
    meetingId: string;
    supplierId: string;
    supplierName: string;
    buyerId: string;
    buyerName: string;
  }> => {
    if (!activeProject) return [];
    const result: Array<{
      meetingId: string;
      supplierId: string;
      supplierName: string;
      buyerId: string;
      buyerName: string;
    }> = [];
    for (const m of activeProject.meetings) {
      if (m.status === 'cancelled' || m.status === 'bumped') continue;
      const supplier = activeProject.suppliers.find(s => s.id === m.supplierId);
      const buyer = activeProject.buyers.find(b => b.id === m.buyerId);
      if (!supplier || !buyer) continue;
      if (checkPreferenceViolation(supplier, m.buyerId)) {
        result.push({
          meetingId: m.id,
          supplierId: supplier.id,
          supplierName: supplier.companyName,
          buyerId: buyer.id,
          buyerName: buyer.name,
        });
      }
    }
    return result;
  }, [activeProject]);

  /**
   * Resolve preference violations in bulk. `mode`:
   *  - 'cancel'          — set violating meetings to cancelled
   *  - 'move-to-unsched' — cancel + add each pair to unscheduledPairs
   *  - 'ignore'          — no-op (informational log only)
   */
  const resolvePreferenceViolations = useCallback(
    (mode: 'cancel' | 'move-to-unsched' | 'ignore'): { affected: number } => {
      if (!activeProject) return { affected: 0 };
      const violations = getPreferenceViolations();
      if (violations.length === 0) return { affected: 0 };
      if (mode === 'ignore') {
        emitActivity(
          'auto_fix_applied',
          `Preference violations acknowledged: ${violations.length} grandfathered`,
          { kind: 'none' },
          {},
        );
        return { affected: violations.length };
      }
      const violationIds = new Set(violations.map(v => v.meetingId));
      const nextMeetings = activeProject.meetings.map(m =>
        violationIds.has(m.id) ? { ...m, status: 'cancelled' as const } : m,
      );
      const additionalPairs: UnscheduledPair[] =
        mode === 'move-to-unsched'
          ? violations.map(v => ({ supplierId: v.supplierId, buyerId: v.buyerId }))
          : [];
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        meetings: nextMeetings,
        unscheduledPairs:
          additionalPairs.length > 0
            ? [...project.unscheduledPairs, ...additionalPairs]
            : project.unscheduledPairs,
      }));
      emitActivity(
        'auto_fix_applied',
        mode === 'cancel'
          ? `Cancelled ${violations.length} preference-violating meeting(s)`
          : `Moved ${violations.length} preference-violating meeting(s) to unscheduled`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return { affected: violations.length };
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity, getPreferenceViolations],
  );

  /**
   * Insert a break covering [startTime..endTime] on `date` mid-event.
   * Any active meetings that fall inside that window are cancelled
   * (recoverable via the History panel). Slots are regenerated to
   * reflect the new break.
   *
   * `date` is optional — if omitted, the break applies to all enabled
   * days (matches EventConfig.breaks semantics).
   */
  const addBreakMidEvent = useCallback(
    (breakData: { name: string; startTime: string; endTime: string; date?: string }): { cancelledIds: string[] } => {
      if (!activeProject?.eventConfig) return { cancelledIds: [] };
      const existingBreaks = activeProject.eventConfig.breaks || [];
      const newBreak = {
        id: generateId(),
        name: breakData.name,
        startTime: breakData.startTime,
        endTime: breakData.endTime,
        date: breakData.date,
      };
      const nextConfig: EventConfig = {
        ...activeProject.eventConfig,
        breaks: [...existingBreaks, newBreak],
      };
      // Regenerate all slots against the updated config.
      const regeneratedSlots = generateTimeSlots(nextConfig);
      // Cancel any active meeting whose old slot falls inside the new
      // break window (based on date + startTime overlap).
      const isInBreak = (slot: TimeSlot | undefined): boolean => {
        if (!slot) return false;
        if (breakData.date && slot.date !== breakData.date) return false;
        const t = slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime);
        const hhmm = t.toTimeString().substring(0, 5);
        return hhmm >= breakData.startTime && hhmm < breakData.endTime;
      };
      const oldSlotById = new Map(activeProject.timeSlots.map(s => [s.id, s]));
      const cancelledIds: string[] = [];
      const nextMeetings = activeProject.meetings.map(m => {
        if (m.status === 'cancelled' || m.status === 'bumped') return m;
        if (isInBreak(oldSlotById.get(m.timeSlotId))) {
          cancelledIds.push(m.id);
          return { ...m, status: 'cancelled' as const };
        }
        return m;
      });

      // Rebuild slot id references: match old→new slots by (date, HHMM).
      const slotHHMM = (s: TimeSlot): string => {
        const t = s.startTime instanceof Date ? s.startTime : new Date(s.startTime);
        return t.toTimeString().substring(0, 5);
      };
      const newSlotIdByKey = new Map<string, string>();
      for (const s of regeneratedSlots) {
        newSlotIdByKey.set(`${s.date}__${slotHHMM(s)}`, s.id);
      }
      const remappedMeetings = nextMeetings.map(m => {
        if (m.status === 'cancelled' || m.status === 'bumped') return m;
        const oldSlot = oldSlotById.get(m.timeSlotId);
        if (!oldSlot) return m;
        const key = `${oldSlot.date}__${slotHHMM(oldSlot)}`;
        const newId = newSlotIdByKey.get(key);
        return newId ? { ...m, timeSlotId: newId } : m;
      });

      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        eventConfig: nextConfig,
        timeSlots: regeneratedSlots,
        meetings: remappedMeetings,
      }));
      emitActivity(
        'auto_fix_applied',
        `Added break "${breakData.name}" ${breakData.startTime}–${breakData.endTime}${breakData.date ? ` on ${breakData.date}` : ''} — cancelled ${cancelledIds.length} affected meeting(s)`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return { cancelledIds };
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  // Buyers
  const addBuyer = useCallback((buyer: Buyer) => {
    updateActiveProject(project => ({
      ...project,
      buyers: [...project.buyers, buyer],
    }));
  }, [updateActiveProject]);

  /**
   * Add a buyer AND incrementally place their meetings — the buyer
   * mirror of `addSupplierAndAutoSchedule`.
   */
  const addBuyerAndAutoSchedule = useCallback(
    (buyer: Buyer): PlacementResult & { placed: number; unplaced: number } => {
      if (!activeProject) {
        return { additions: [], unscheduledPairs: [], failures: [], placed: 0, unplaced: 0 };
      }
      const nextBuyers = [...activeProject.buyers, buyer];
      const result = placeBuyerIncrementally(
        buyer.id,
        activeProject.suppliers,
        nextBuyers,
        activeProject.timeSlots,
        activeProject.meetings,
      );
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        buyers: [...project.buyers, buyer],
        meetings: [...project.meetings, ...result.additions],
        unscheduledPairs: [...project.unscheduledPairs, ...result.unscheduledPairs],
      }));
      emitActivity(
        'auto_fix_applied',
        `Added buyer "${buyer.name}" — placed ${result.additions.length} meeting(s), ${result.unscheduledPairs.length} could not be scheduled`,
        { kind: 'bulk-meetings', previousMeetings: activeProject.meetings },
        {},
      );
      return {
        ...result,
        placed: result.additions.length,
        unplaced: result.unscheduledPairs.length,
      };
    },
    [activeProject, saveToHistory, updateActiveProject, emitActivity],
  );

  const updateBuyer = useCallback((id: string, updates: Partial<Buyer>) => {
    updateActiveProject(project => ({
      ...project,
      buyers: project.buyers.map(b => (b.id === id ? { ...b, ...updates } : b)),
    }));
  }, [updateActiveProject]);

  const removeBuyer = useCallback((id: string) => {
    updateActiveProject(project => ({
      ...project,
      buyers: project.buyers.filter(b => b.id !== id),
      meetings: project.meetings.filter(m => m.buyerId !== id),
      suppliers: project.suppliers.map(s => ({
        ...s,
        preferenceList: s.preferenceList.filter(bid => bid !== id),
      })),
    }));
  }, [updateActiveProject]);

  const importBuyers = useCallback((buyers: Buyer[]) => {
    updateActiveProject(project => ({
      ...project,
      buyers,
      meetings: [],
      timeSlots: [],
    }));
  }, [updateActiveProject]);

  const autoAssignBuyerColors = useCallback(() => {
    updateActiveProject(project => ({
      ...project,
      buyers: assignBuyerColors(project.buyers),
    }));
  }, [updateActiveProject]);

  // Schedule generation
  const generateScheduleAction = useCallback(() => {
    if (!activeProject?.eventConfig) return;

    setAppState(prev => ({ ...prev, isGenerating: true }));
    setGenerationProgress(null);
    setLastScheduleScore(null);

    const worker = new Worker(
      new URL('../workers/scheduler.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.postMessage({
      config: activeProject.eventConfig,
      suppliers: activeProject.suppliers,
      buyers: activeProject.buyers,
    });

    worker.onmessage = (e) => {
      const data = e.data;

      if (data.type === 'progress') {
        setGenerationProgress({ current: data.current, total: data.total });
        return;
      }

      if (data.type === 'error') {
        console.error('Schedule generation error:', data.error);
        setAppState(prev => ({ ...prev, isGenerating: false }));
        setGenerationProgress(null);
        worker.terminate();
        return;
      }

      updateActiveProject(project => ({
        ...project,
        meetings: data.meetings,
        timeSlots: data.timeSlots,
        unscheduledPairs: data.unscheduledPairs,
      }));

      // Store schedule quality score if available
      if (data.score) {
        setLastScheduleScore({
          totalScore: data.score.totalScore,
          totalMeetings: data.score.totalMeetings,
          maxConsecutiveGap: data.score.maxConsecutiveGap,
          candidatesEvaluated: data.score.candidatesEvaluated,
        });
      }

      setAppState(prev => ({ ...prev, isGenerating: false }));
      setGenerationProgress(null);
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      setAppState(prev => ({ ...prev, isGenerating: false }));
      setGenerationProgress(null);
      worker.terminate();
    };
  }, [activeProject, setAppState, updateActiveProject]);

  // Apply the inverse of an activity event ("undo this change"). Reads
  // the event's undoPayload and runs the write-time guards on the
  // result — if the inverse would create a double-booking (e.g. a
  // later change now occupies the slot we'd restore into), we set
  // mutationError and skip. Otherwise we apply, mark the source event
  // undone, and log a new "Undid: X" event for the audit trail.
  const applyActivityUndo = useCallback(async (event: ActivityEvent): Promise<'ok' | 'skipped'> => {
    if (event.undone) return 'skipped';
    const p = event.undoPayload;
    if (p.kind === 'none') return 'skipped';
    if (!activeProject) return 'skipped';

    switch (p.kind) {
      case 'move': {
        const nextMeetings = activeProject.meetings.map(m =>
          m.id === p.meetingId ? { ...m, timeSlotId: p.previousSlotId } : m,
        );
        const violation = detectFirstDoubleBooking(nextMeetings);
        if (violation) {
          setMutationError(
            `Undo blocked: reverting this move would create a double-booking. Undo a later change first.`,
          );
          return 'skipped';
        }
        saveToHistory();
        updateActiveProject(project => ({ ...project, meetings: nextMeetings }));
        break;
      }
      case 'swap': {
        const nextMeetings = activeProject.meetings.map(m => {
          if (m.id === p.meetingId1) return { ...m, timeSlotId: p.previousSlot1 };
          if (m.id === p.meetingId2) return { ...m, timeSlotId: p.previousSlot2 };
          return m;
        });
        const violation = detectFirstDoubleBooking(nextMeetings);
        if (violation) {
          setMutationError(`Undo blocked: reverting this swap would create a double-booking.`);
          return 'skipped';
        }
        saveToHistory();
        updateActiveProject(project => ({ ...project, meetings: nextMeetings }));
        break;
      }
      case 'add': {
        saveToHistory();
        updateActiveProject(project => ({
          ...project,
          meetings: project.meetings.filter(m => m.id !== p.meetingId),
        }));
        break;
      }
      case 'cancel':
      case 'status-change': {
        saveToHistory();
        updateActiveProject(project => ({
          ...project,
          meetings: project.meetings.map(m =>
            m.id === p.meetingId ? { ...m, status: p.previousStatus } : m,
          ),
        }));
        break;
      }
      case 'bulk-meetings': {
        saveToHistory();
        updateActiveProject(project => ({ ...project, meetings: p.previousMeetings }));
        break;
      }
    }

    await markActivityUndone(event.id);
    emitActivity(
      'undo_applied',
      `Undid: ${event.summary}`,
      { kind: 'none' },
      { meetingId: event.details.meetingId },
    );
    return 'ok';
  }, [activeProject, saveToHistory, updateActiveProject, emitActivity, markActivityUndone]);

  // Save the current active project state as a named version snapshot.
  // Wraps the sync-layer's `saveProjectVersionInternal`, filling in
  // the acting user's uid/name and dispatching to the active project.
  const saveActiveProjectVersion = useCallback(
    async (name: string): Promise<{ ok: boolean; message?: string }> => {
      if (!activeProject?.isCloud) {
        return { ok: false, message: 'Only cloud projects can be versioned.' };
      }
      const uid = auth.user?.uid || 'local-user';
      const userName = auth.user?.displayName || auth.user?.email || undefined;
      const result = await saveProjectVersionInternal(activeProject, name, { userId: uid, userName });
      if (result.ok) {
        emitActivity(
          'auto_fix_applied', // reuse a non-undoable info type — no dedicated version_saved yet
          `Saved version "${name.trim()}"`,
          { kind: 'none' },
          {},
        );
      }
      return { ok: result.ok, message: result.message };
    },
    [activeProject, auth.user, saveProjectVersionInternal, emitActivity],
  );

  // Restore the schedule to a named version snapshot. Overwrites the
  // active project's meetings, timeSlots, unscheduledPairs, and
  // eventConfig from the saved snapshot — leaves suppliers/buyers/
  // ownership/collaborators as they are (those are participant lists,
  // not scheduling state). Confirmation is the caller's responsibility.
  const restoreProjectVersion = useCallback(
    async (versionId: string): Promise<{ ok: boolean; message?: string }> => {
      if (!activeProject) return { ok: false, message: 'No active project.' };
      const version = projectVersions.find(v => v.id === versionId);
      if (!version) return { ok: false, message: 'Version not found.' };
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        meetings: version.project.meetings || [],
        timeSlots: (version.project.timeSlots || []).map(slot => ({
          ...slot,
          startTime: slot.startTime instanceof Date ? slot.startTime : new Date(slot.startTime),
          endTime: slot.endTime instanceof Date ? slot.endTime : new Date(slot.endTime),
        })),
        unscheduledPairs: version.project.unscheduledPairs || [],
        eventConfig: version.project.eventConfig ?? project.eventConfig,
      }));
      emitActivity(
        'auto_fix_applied',
        `Restored version "${version.name}"`,
        { kind: 'none' },
        {},
      );
      return { ok: true };
    },
    [activeProject, projectVersions, saveToHistory, updateActiveProject, emitActivity],
  );

  // Meeting operations
  const updateMeetingStatus = useCallback((meetingId: string, status: MeetingStatus) => {
    if (!activeProject) return;
    const prev = activeProject.meetings.find(m => m.id === meetingId);
    if (!prev) return;
    const previousStatus = prev.status;
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m => (m.id === meetingId ? { ...m, status } : m)),
    }));
    emitActivity(
      'meeting_status_changed',
      `Set ${buildMeetingLabel(meetingId)} to ${status}`,
      { kind: 'status-change', meetingId, previousStatus },
      { meetingId },
    );
  }, [activeProject, saveToHistory, updateActiveProject, emitActivity, buildMeetingLabel]);

  const swapMeetings = useCallback((meetingId1: string, meetingId2: string) => {
    if (!activeProject) return;
    const meeting1 = activeProject.meetings.find(m => m.id === meetingId1);
    const meeting2 = activeProject.meetings.find(m => m.id === meetingId2);
    if (!meeting1 || !meeting2) return;
    const previousSlot1 = meeting1.timeSlotId;
    const previousSlot2 = meeting2.timeSlotId;

    const nextMeetings = activeProject.meetings.map(m => {
      if (m.id === meetingId1) return { ...m, timeSlotId: meeting2.timeSlotId };
      if (m.id === meetingId2) return { ...m, timeSlotId: meeting1.timeSlotId };
      return m;
    });

    const violation = detectFirstDoubleBooking(nextMeetings);
    if (violation) {
      const msg = describeViolationForToast(violation, activeProject);
      console.warn('[schedule-guard] swap blocked:', msg, violation);
      setMutationError(msg);
      return;
    }

    saveToHistory();
    updateActiveProject(project => ({ ...project, meetings: nextMeetings }));
    emitActivity(
      'meeting_swapped',
      `Swapped ${buildMeetingLabel(meetingId1)} ↔ ${buildMeetingLabel(meetingId2)}`,
      { kind: 'swap', meetingId1, meetingId2, previousSlot1, previousSlot2 },
      { meetingId: meetingId1 },
    );
  }, [activeProject, saveToHistory, updateActiveProject, emitActivity, buildMeetingLabel]);

  const moveMeeting = useCallback((meetingId: string, newTimeSlotId: string) => {
    if (!activeProject) return;
    const prev = activeProject.meetings.find(m => m.id === meetingId);
    if (!prev) return;
    const previousSlotId = prev.timeSlotId;
    const nextMeetings = activeProject.meetings.map(m =>
      m.id === meetingId ? { ...m, timeSlotId: newTimeSlotId } : m,
    );

    const violation = detectFirstDoubleBooking(nextMeetings);
    if (violation) {
      const msg = describeViolationForToast(violation, activeProject);
      console.warn('[schedule-guard] move blocked:', msg, violation);
      setMutationError(msg);
      return;
    }

    saveToHistory();
    updateActiveProject(project => ({ ...project, meetings: nextMeetings }));
    emitActivity(
      'meeting_moved',
      `Moved ${buildMeetingLabel(meetingId)}`,
      { kind: 'move', meetingId, previousSlotId },
      { meetingId, fromSlot: previousSlotId, toSlot: newTimeSlotId },
    );
  }, [activeProject, saveToHistory, updateActiveProject, emitActivity, buildMeetingLabel]);

  const cancelMeeting = useCallback((meetingId: string) => {
    if (!activeProject) return;
    const prev = activeProject.meetings.find(m => m.id === meetingId);
    if (!prev) return;
    const previousStatus = prev.status;
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId ? { ...m, status: 'cancelled' as const } : m
      ),
    }));
    emitActivity(
      'meeting_cancelled',
      `Cancelled ${buildMeetingLabel(meetingId)}`,
      { kind: 'cancel', meetingId, previousStatus },
      { meetingId },
    );
  }, [activeProject, saveToHistory, updateActiveProject, emitActivity, buildMeetingLabel]);

  const autoFillGaps = useCallback(() => {
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: autoFillCancelledSlots(
        project.suppliers,
        project.buyers,
        project.timeSlots,
        project.meetings
      ),
    }));
  }, [saveToHistory, updateActiveProject]);

  const clearSchedule = useCallback(() => {
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: [],
      timeSlots: [],
      unscheduledPairs: [],
    }));
    setLastScheduleScore(null);
  }, [saveToHistory, updateActiveProject]);

  // Delay handling
  const markMeetingDelayed = useCallback((meetingId: string, reason?: string) => {
    saveToHistory();
    const now = new Date().toISOString();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId
          ? { ...m, status: 'delayed' as const, delayReason: reason, delayedAt: now }
          : m
      ),
    }));
  }, [saveToHistory, updateActiveProject]);

  const markMeetingRunningLate = useCallback((meetingId: string) => {
    saveToHistory();
    const now = new Date().toISOString();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId
          ? { ...m, status: 'running_late' as const, delayedAt: now }
          : m
      ),
    }));
  }, [saveToHistory, updateActiveProject]);

  const startMeeting = useCallback((meetingId: string) => {
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId ? { ...m, status: 'in_progress' as const } : m
      ),
    }));
  }, [saveToHistory, updateActiveProject]);

  const bumpMeetingAction = useCallback((meetingId: string): { success: boolean; newSlotId?: string; message: string } => {
    if (!activeProject) {
      return { success: false, message: 'No active project' };
    }

    const result = bumpMeetingToLaterSlot(
      meetingId,
      activeProject.meetings,
      activeProject.timeSlots,
      activeProject.suppliers,
    );

    if (result.success) {
      const violation = detectFirstDoubleBooking(result.updatedMeetings);
      if (violation) {
        const msg = describeViolationForToast(violation, activeProject);
        console.warn('[schedule-guard] bump blocked:', msg, violation);
        setMutationError(msg);
        return { success: false, message: msg };
      }
      saveToHistory();
      updateActiveProject(project => ({
        ...project,
        meetings: result.updatedMeetings,
      }));
    }

    return {
      success: result.success,
      newSlotId: result.newSlotId,
      message: result.message,
    };
  }, [activeProject, saveToHistory, updateActiveProject]);

  const findNextAvailableSlotAction = useCallback((meetingId: string): string | null => {
    if (!activeProject) return null;

    const meeting = activeProject.meetings.find(m => m.id === meetingId);
    if (!meeting) return null;

    const supplier = activeProject.suppliers.find(s => s.id === meeting.supplierId);
    const slot = findNextAvailableSlotAfter(
      meeting,
      activeProject.timeSlots,
      activeProject.meetings,
      meeting.timeSlotId,
      supplier,
    );

    return slot?.id ?? null;
  }, [activeProject]);

  // Meeting notes
  const addMeetingNote = useCallback((meetingId: string, content: string) => {
    const note: MeetingNote = {
      id: generateId(),
      meetingId,
      userId: 'local-user', // Would be Firebase user ID in cloud mode
      userName: 'You',
      content,
      timestamp: new Date().toISOString(),
    };

    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId
          ? { ...m, notes: [...(m.notes || []), note] }
          : m
      ),
    }));
  }, [updateActiveProject]);

  // Add meeting manually
  const addMeetingAction = useCallback((
    supplierId: string,
    buyerId: string,
    timeSlotId: string
  ): { success: boolean; meetingId?: string; message: string } => {
    if (!activeProject) {
      return { success: false, message: 'No active project' };
    }

    // Check if supplier slot is available (hard error)
    if (!isSupplierAvailableAtSlot(supplierId, timeSlotId, activeProject.meetings)) {
      const msg = 'Supplier already has a meeting at this time';
      setMutationError(msg);
      return { success: false, message: msg };
    }
    // Also block if the buyer is already in this slot with someone else.
    const buyerAlreadyBooked = activeProject.meetings.some(
      m =>
        m.buyerId === buyerId &&
        m.timeSlotId === timeSlotId &&
        m.status !== 'cancelled' &&
        m.status !== 'bumped',
    );
    if (buyerAlreadyBooked) {
      const msg = 'Buyer already has a meeting at this time';
      setMutationError(msg);
      return { success: false, message: msg };
    }

    saveToHistory();
    const newMeetingId = generateId();

    updateActiveProject(project => ({
      ...project,
      meetings: [
        ...project.meetings,
        {
          id: newMeetingId,
          supplierId,
          buyerId,
          timeSlotId,
          status: 'scheduled' as const,
        },
      ],
    }));

    // Log after the state update — buildMeetingLabel needs the meeting
    // to be present in activeProject to resolve names, but that only
    // updates on the next render. Fall back to explicit name lookup.
    const supplier = activeProject.suppliers.find(s => s.id === supplierId);
    const buyer = activeProject.buyers.find(b => b.id === buyerId);
    emitActivity(
      'meeting_added',
      `Added ${supplier?.companyName ?? 'supplier'} × ${buyer?.name ?? 'buyer'}`,
      { kind: 'add', meetingId: newMeetingId },
      { meetingId: newMeetingId, supplierName: supplier?.companyName, buyerName: buyer?.name },
    );

    return { success: true, meetingId: newMeetingId, message: 'Meeting added successfully' };
  }, [activeProject, saveToHistory, updateActiveProject, emitActivity]);

  // Conflict detection functions
  const getScheduleConflictsAction = useCallback((): ScheduleConflictsSummary => {
    if (!activeProject) {
      return { buyerDoubleBookings: [], preferenceViolations: [], totalConflicts: 0 };
    }
    return getScheduleConflictsSummary(
      activeProject.meetings,
      activeProject.suppliers,
      activeProject.buyers,
      activeProject.timeSlots
    );
  }, [activeProject]);

  const checkMoveConflictsAction = useCallback((
    meetingId: string,
    targetSlotId: string
  ): ConflictCheckResult => {
    if (!activeProject) {
      return { hasConflicts: false, conflicts: [], hasErrors: false, hasWarnings: false };
    }

    const meeting = activeProject.meetings.find(m => m.id === meetingId);
    if (!meeting) {
      return { hasConflicts: false, conflicts: [], hasErrors: false, hasWarnings: false };
    }

    return checkMoveConflictsUtil(
      meeting,
      targetSlotId,
      activeProject.meetings,
      activeProject.suppliers,
      activeProject.buyers
    );
  }, [activeProject]);

  const checkAddMeetingConflictsAction = useCallback((
    supplierId: string,
    buyerId: string,
    slotId: string
  ): ConflictCheckResult => {
    if (!activeProject) {
      return { hasConflicts: false, conflicts: [], hasErrors: false, hasWarnings: false };
    }

    return checkAddMeetingConflictsUtil(
      supplierId,
      buyerId,
      slotId,
      activeProject.meetings,
      activeProject.suppliers,
      activeProject.buyers
    );
  }, [activeProject]);

  const getMeetingConflictsAction = useCallback((meetingId: string): ConflictInfo[] => {
    if (!activeProject) {
      return [];
    }

    const meeting = activeProject.meetings.find(m => m.id === meetingId);
    if (!meeting) {
      return [];
    }

    return getConflictsForMeeting(
      meeting,
      activeProject.meetings,
      activeProject.suppliers,
      activeProject.buyers
    );
  }, [activeProject]);

  // Import/Export
  const exportToJSON = useCallback((): string => {
    if (!activeProject) return '{}';
    return JSON.stringify(activeProject, null, 2);
  }, [activeProject]);

  const importFromJSON = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);

      // Comprehensive debug logging for import tracing
      console.log('[Import] Parsed data:', {
        hasId: !!parsed.id,
        hasName: !!parsed.name,
        hasCreatedAt: !!parsed.createdAt,
        meetingsCount: parsed.meetings?.length ?? 0,
        timeSlotsCount: parsed.timeSlots?.length ?? 0,
        suppliersCount: parsed.suppliers?.length ?? 0,
        buyersCount: parsed.buyers?.length ?? 0,
        unscheduledPairsCount: parsed.unscheduledPairs?.length ?? 0,
        hasEventConfig: !!parsed.eventConfig,
        eventConfigName: parsed.eventConfig?.name,
      });

      // Ensure arrays exist even if missing from export
      if (!parsed.suppliers) parsed.suppliers = [];
      if (!parsed.buyers) parsed.buyers = [];
      if (!parsed.meetings) parsed.meetings = [];
      if (!parsed.timeSlots) parsed.timeSlots = [];
      if (!parsed.unscheduledPairs) parsed.unscheduledPairs = [];

      // Check if it's a Project or old ScheduleState format
      if (parsed.id && parsed.name && parsed.createdAt) {
        // It's a Project - restore dates and add/replace
        const project = restoreProjectDates(parsed as Project);

        console.log('[Import] Restored project:', {
          id: project.id,
          name: project.name,
          meetingsCount: project.meetings?.length ?? 0,
          timeSlotsCount: project.timeSlots?.length ?? 0,
          suppliersCount: project.suppliers?.length ?? 0,
          buyersCount: project.buyers?.length ?? 0,
        });

        if (project.timeSlots.length > 0 && project.meetings.length === 0) {
          console.warn('[Import] Project has time slots but no meetings — schedule may not have been generated before export');
        }

        setAppState(prev => {
          const existingIndex = prev.projects.findIndex(p => p.id === project.id);
          if (existingIndex >= 0) {
            // Replace existing project
            const newProjects = [...prev.projects];
            newProjects[existingIndex] = project;
            console.log('[Import] Replacing existing project at index', existingIndex);
            return { ...prev, projects: newProjects, activeProjectId: project.id };
          } else {
            // Add new project
            console.log('[Import] Adding new project, total projects:', prev.projects.length + 1);
            return {
              ...prev,
              projects: [...prev.projects, project],
              activeProjectId: project.id,
            };
          }
        });
      } else {
        // Old format - migrate to project and add
        const project = migrateScheduleStateToProject(parsed);
        console.log('[Import] Migrated from old format:', {
          id: project.id,
          name: project.name,
          meetingsCount: project.meetings?.length ?? 0,
          suppliersCount: project.suppliers?.length ?? 0,
          buyersCount: project.buyers?.length ?? 0,
        });
        setAppState(prev => ({
          ...prev,
          projects: [...prev.projects, project],
          activeProjectId: project.id,
        }));
      }
    } catch (error) {
      console.error('[Import] Failed to import JSON:', error);
      throw error instanceof Error ? error : new Error('Invalid JSON format');
    }
  }, [setAppState]);

  const exportProjectToJSON = useCallback((projectId: string): string => {
    const project = appState.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');
    return JSON.stringify(project, null, 2);
  }, [appState.projects]);

  const importProjectFromJSON = useCallback((json: string): Project => {
    try {
      const parsed = JSON.parse(json);
      const project = restoreProjectDates(
        parsed.id ? parsed : migrateScheduleStateToProject(parsed)
      );

      // Generate new ID to avoid conflicts
      const newProject = {
        ...project,
        id: generateId(),
        name: `${project.name} (Imported)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setAppState(prev => ({
        ...prev,
        projects: [...prev.projects, newProject],
        activeProjectId: newProject.id,
      }));

      return newProject;
    } catch (error) {
      console.error('Failed to import project:', error);
      throw new Error('Invalid JSON format');
    }
  }, [setAppState]);

  const resetAllData = useCallback(() => {
    setAppState(initialAppState);
  }, [setAppState]);

  // Cloud sync methods
  const uploadProjectToCloud = useCallback(async (projectId: string): Promise<string | null> => {
    const project = appState.projects.find(p => p.id === projectId);
    if (!project) return null;

    const shareId = await uploadProject(project);
    if (shareId) {
      // Update local project with cloud info
      setAppState(prev => ({
        ...prev,
        projects: prev.projects.map(p =>
          p.id === projectId
            ? { ...p, isCloud: true, shareId }
            : p
        ),
      }));
    }
    return shareId;
  }, [appState.projects, uploadProject, setAppState]);

  const openCloudProject = useCallback(async (shareId: string): Promise<Project | null> => {
    // Check if we already have this project locally
    const existingProject = appState.projects.find(p => p.shareId === shareId);
    if (existingProject) {
      setAppState(prev => ({ ...prev, activeProjectId: existingProject.id }));
      return existingProject;
    }

    // Fetch from cloud
    const cloudProject = await openProject(shareId);
    if (!cloudProject) return null;

    // Add to local projects
    setAppState(prev => ({
      ...prev,
      projects: [...prev.projects, cloudProject],
      activeProjectId: cloudProject.id,
    }));

    return cloudProject;
  }, [appState.projects, openProject, setAppState]);

  const disconnectFromCloud = useCallback((projectId: string) => {
    disconnectFromCloudInternal(projectId);
    setAppState(prev => ({
      ...prev,
      projects: prev.projects.map(p =>
        p.id === projectId
          ? { ...p, isCloud: false, shareId: undefined }
          : p
      ),
    }));
  }, [disconnectFromCloudInternal, setAppState]);

  // Build ScheduleState-compatible object for backwards compatibility
  const scheduleState: ScheduleState = useMemo(() => ({
    eventConfig: activeProject?.eventConfig ?? null,
    suppliers: activeProject?.suppliers ?? [],
    buyers: activeProject?.buyers ?? [],
    meetings: activeProject?.meetings ?? [],
    timeSlots: activeProject?.timeSlots ?? [],
    unscheduledPairs: activeProject?.unscheduledPairs ?? [],
    isGenerating: appState.isGenerating,
  }), [activeProject, appState.isGenerating]);

  const value = useMemo<ScheduleContextType>(() => ({
    // ScheduleState fields
    ...scheduleState,

    // Project management
    projects: appState.projects,
    activeProjectId: appState.activeProjectId,
    activeProject,
    createProject,
    switchProject,
    deleteProject,
    duplicateProject,
    renameProject,

    // Event config
    setEventConfig,

    // Suppliers
    addSupplier,
    updateSupplier,
    removeSupplier,
    importSuppliers,

    // Buyers
    addBuyer,
    updateBuyer,
    removeBuyer,
    importBuyers,
    autoAssignBuyerColors,

    // Schedule generation
    generateSchedule: generateScheduleAction,

    // Meeting operations
    updateMeetingStatus,
    swapMeetings,
    moveMeeting,
    cancelMeeting,
    autoFillGaps,
    clearSchedule,

    // New meeting management
    addMeeting: addMeetingAction,

    // Conflict detection
    getScheduleConflicts: getScheduleConflictsAction,
    checkMoveConflicts: checkMoveConflictsAction,
    checkAddMeetingConflicts: checkAddMeetingConflictsAction,
    getMeetingConflicts: getMeetingConflictsAction,

    // Delay handling
    markMeetingDelayed,
    markMeetingRunningLate,
    startMeeting,
    bumpMeeting: bumpMeetingAction,
    findNextAvailableSlot: findNextAvailableSlotAction,

    // Meeting notes
    addMeetingNote,

    // Google Sheets link persistence
    setActiveProjectSheetsLink,

    // Mutation guard toast
    mutationError,
    clearMutationError,

    // Live schedule-integrity report (double-bookings from any source)
    scheduleIntegrityIssues,
    resolveActiveProjectStacks,

    // Import/Export
    exportToJSON,
    importFromJSON,
    exportProjectToJSON,
    importProjectFromJSON,
    resetAllData,

    // Cloud sync
    isFirebaseEnabled,
    syncStatus,
    activeCollaborators,
    lastSyncError,
    discoveryError,
    remoteIntegrityWarning,
    uploadProjectToCloud,
    openCloudProject,
    disconnectFromCloud,
    setFocusedMeeting,
    activityEvents,
    applyActivityUndo,
    projectVersions,
    saveActiveProjectVersion,
    restoreProjectVersion,
    deleteProjectVersion,
    removeCollaborator,
    transferOwnership,

    // Incremental scheduling
    addSupplierAndAutoSchedule,
    addBuyerAndAutoSchedule,
    rebalanceSupplier: rebalanceSupplierAction,
    removeSupplierFromEvent: removeSupplierFromEventAction,
    applyLateArrival: applyLateArrivalAction,
    shiftScheduleAfter: shiftScheduleAfterAction,
    extendEventEndDate,
    reserveSlot,
    getPreferenceViolations,
    resolvePreferenceViolations,
    addBreakMidEvent,

    // Undo/Redo
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,

    // Schedule optimization
    generationProgress,
    lastScheduleScore,
  }), [
    scheduleState,
    appState.projects,
    appState.activeProjectId,
    activeProject,
    createProject,
    switchProject,
    deleteProject,
    duplicateProject,
    renameProject,
    setEventConfig,
    addSupplier,
    updateSupplier,
    removeSupplier,
    importSuppliers,
    addBuyer,
    updateBuyer,
    removeBuyer,
    importBuyers,
    autoAssignBuyerColors,
    generateScheduleAction,
    updateMeetingStatus,
    swapMeetings,
    moveMeeting,
    cancelMeeting,
    autoFillGaps,
    clearSchedule,
    addMeetingAction,
    getScheduleConflictsAction,
    checkMoveConflictsAction,
    checkAddMeetingConflictsAction,
    getMeetingConflictsAction,
    markMeetingDelayed,
    markMeetingRunningLate,
    startMeeting,
    bumpMeetingAction,
    findNextAvailableSlotAction,
    addMeetingNote,
    setActiveProjectSheetsLink,
    mutationError,
    clearMutationError,
    scheduleIntegrityIssues,
    resolveActiveProjectStacks,
    exportToJSON,
    importFromJSON,
    exportProjectToJSON,
    importProjectFromJSON,
    resetAllData,
    isFirebaseEnabled,
    syncStatus,
    activeCollaborators,
    lastSyncError,
    discoveryError,
    remoteIntegrityWarning,
    uploadProjectToCloud,
    openCloudProject,
    disconnectFromCloud,
    setFocusedMeeting,
    activityEvents,
    applyActivityUndo,
    projectVersions,
    saveActiveProjectVersion,
    restoreProjectVersion,
    deleteProjectVersion,
    removeCollaborator,
    transferOwnership,
    addSupplierAndAutoSchedule,
    addBuyerAndAutoSchedule,
    rebalanceSupplierAction,
    removeSupplierFromEventAction,
    applyLateArrivalAction,
    shiftScheduleAfterAction,
    extendEventEndDate,
    reserveSlot,
    getPreferenceViolations,
    resolvePreferenceViolations,
    addBreakMidEvent,
    undo,
    redo,
    historyState,
    generationProgress,
    lastScheduleScore,
  ]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook colocated with Provider; splitting breaks consumer imports
export function useSchedule(): ScheduleContextType {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
