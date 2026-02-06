import { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useFirebaseSync, useSyncProjectChanges } from '../hooks/useFirebaseSync';
import { useHistoryTracker } from '../hooks/useHistory';
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
} from '../types';
import { isLegacySupplier, migrateSupplier, isLegacyEventConfig, migrateEventConfig } from '../types';
import { autoFillCancelledSlots, bumpMeetingToLaterSlot, findNextAvailableSlotAfter } from '../utils/scheduler';
import { assignBuyerColors } from '../utils/colors';
import {
  checkMoveConflicts as checkMoveConflictsUtil,
  checkAddMeetingConflicts as checkAddMeetingConflictsUtil,
  getConflictsForMeeting,
  getScheduleConflictsSummary,
  isSupplierAvailableAtSlot,
} from '../utils/conflictDetection';

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
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

  // History tracking for undo/redo
  const historyTracker = useHistoryTracker<MeetingsSnapshot>(20);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  // Create default project if none exist
  useEffect(() => {
    if (appState.projects.length === 0) {
      const defaultProject = createEmptyProject('New Event');
      setAppState({
        projects: [defaultProject],
        activeProjectId: defaultProject.id,
        isGenerating: false,
      });
    }
  }, [appState.projects.length, setAppState]);

  // Get active project
  const activeProject = useMemo(() => {
    if (!appState.activeProjectId) return null;
    return appState.projects.find(p => p.id === appState.activeProjectId) ?? null;
  }, [appState.projects, appState.activeProjectId]);

  // Firebase sync
  const handleRemoteProjectUpdate = useCallback((remoteProject: Project) => {
    setAppState(prev => ({
      ...prev,
      projects: prev.projects.map(p =>
        p.shareId === remoteProject.shareId ? remoteProject : p
      ),
    }));
  }, [setAppState]);

  const {
    isEnabled: isFirebaseEnabled,
    syncStatus,
    activeCollaborators,
    uploadProject,
    openProject,
    syncProject,
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

  // Cloud sync: Push local changes to Firebase
  const syncChangesToCloud = useSyncProjectChanges(activeProject, syncStatus);
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced sync function to avoid excessive Firebase writes
  const debouncedSyncToCloud = useCallback((project: Project) => {
    if (!project.isCloud || !project.shareId || syncStatus !== 'synced') {
      return;
    }

    // Clear existing timeout
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }

    // Debounce: wait 500ms before syncing
    syncDebounceRef.current = setTimeout(() => {
      syncChangesToCloud(project);
    }, 500);
  }, [syncStatus, syncChangesToCloud]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

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

  // Undo last operation
  const undo = useCallback(() => {
    const snapshot = historyTracker.undo();
    if (snapshot) {
      updateActiveProject(project => ({
        ...project,
        meetings: snapshot.meetings,
        timeSlots: snapshot.timeSlots,
        unscheduledPairs: snapshot.unscheduledPairs,
      }));
      setHistoryState({ canUndo: historyTracker.canUndo, canRedo: historyTracker.canRedo });
    }
  }, [historyTracker, updateActiveProject]);

  // Redo last undone operation
  const redo = useCallback(() => {
    const snapshot = historyTracker.redo();
    if (snapshot) {
      updateActiveProject(project => ({
        ...project,
        meetings: snapshot.meetings,
        timeSlots: snapshot.timeSlots,
        unscheduledPairs: snapshot.unscheduledPairs,
      }));
      setHistoryState({ canUndo: historyTracker.canUndo, canRedo: historyTracker.canRedo });
    }
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

  // Event config
  const setEventConfig = useCallback((config: EventConfig) => {
    updateActiveProject(project => ({
      ...project,
      eventConfig: config,
      meetings: [],
      timeSlots: [],
    }));
  }, [updateActiveProject]);

  // Suppliers
  const addSupplier = useCallback((supplier: Supplier) => {
    updateActiveProject(project => ({
      ...project,
      suppliers: [...project.suppliers, supplier],
    }));
  }, [updateActiveProject]);

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

  // Buyers
  const addBuyer = useCallback((buyer: Buyer) => {
    updateActiveProject(project => ({
      ...project,
      buyers: [...project.buyers, buyer],
    }));
  }, [updateActiveProject]);

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
      updateActiveProject(project => ({
        ...project,
        meetings: e.data.meetings,
        timeSlots: e.data.timeSlots,
        unscheduledPairs: e.data.unscheduledPairs,
      }));
      setAppState(prev => ({ ...prev, isGenerating: false }));
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      setAppState(prev => ({ ...prev, isGenerating: false }));
      worker.terminate();
    };
  }, [activeProject, setAppState, updateActiveProject]);

  // Meeting operations
  const updateMeetingStatus = useCallback((meetingId: string, status: MeetingStatus) => {
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m => (m.id === meetingId ? { ...m, status } : m)),
    }));
  }, [saveToHistory, updateActiveProject]);

  const swapMeetings = useCallback((meetingId1: string, meetingId2: string) => {
    saveToHistory();
    updateActiveProject(project => {
      const meeting1 = project.meetings.find(m => m.id === meetingId1);
      const meeting2 = project.meetings.find(m => m.id === meetingId2);
      if (!meeting1 || !meeting2) return project;

      return {
        ...project,
        meetings: project.meetings.map(m => {
          if (m.id === meetingId1) return { ...m, timeSlotId: meeting2.timeSlotId };
          if (m.id === meetingId2) return { ...m, timeSlotId: meeting1.timeSlotId };
          return m;
        }),
      };
    });
  }, [saveToHistory, updateActiveProject]);

  const moveMeeting = useCallback((meetingId: string, newTimeSlotId: string) => {
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId ? { ...m, timeSlotId: newTimeSlotId } : m
      ),
    }));
  }, [saveToHistory, updateActiveProject]);

  const cancelMeeting = useCallback((meetingId: string) => {
    saveToHistory();
    updateActiveProject(project => ({
      ...project,
      meetings: project.meetings.map(m =>
        m.id === meetingId ? { ...m, status: 'cancelled' as const } : m
      ),
    }));
  }, [saveToHistory, updateActiveProject]);

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

    const result = bumpMeetingToLaterSlot(meetingId, activeProject.meetings, activeProject.timeSlots);

    if (result.success) {
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

    const slot = findNextAvailableSlotAfter(
      meeting,
      activeProject.timeSlots,
      activeProject.meetings,
      meeting.timeSlotId
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
      return { success: false, message: 'Supplier already has a meeting at this time' };
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

    return { success: true, meetingId: newMeetingId, message: 'Meeting added successfully' };
  }, [activeProject, saveToHistory, updateActiveProject]);

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

      // Debug logging for import tracing
      console.log('[Import] Parsed data:', {
        hasId: !!parsed.id,
        hasName: !!parsed.name,
        hasCreatedAt: !!parsed.createdAt,
        meetingsCount: parsed.meetings?.length ?? 0,
        timeSlotsCount: parsed.timeSlots?.length ?? 0,
        suppliersCount: parsed.suppliers?.length ?? 0,
        buyersCount: parsed.buyers?.length ?? 0,
      });

      // Check if it's a Project or old ScheduleState format
      if (parsed.id && parsed.name && parsed.createdAt) {
        // It's a Project - restore dates and add/replace
        const project = restoreProjectDates(parsed as Project);

        console.log('[Import] Restored project:', {
          meetingsCount: project.meetings?.length ?? 0,
          timeSlotsCount: project.timeSlots?.length ?? 0,
        });

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
            console.log('[Import] Adding new project');
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
          meetingsCount: project.meetings?.length ?? 0,
        });
        setAppState(prev => ({
          ...prev,
          projects: [...prev.projects, project],
          activeProjectId: project.id,
        }));
      }
    } catch (error) {
      console.error('Failed to import JSON:', error);
      throw new Error('Invalid JSON format');
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
    uploadProjectToCloud,
    openCloudProject,
    disconnectFromCloud,

    // Undo/Redo
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
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
    exportToJSON,
    importFromJSON,
    exportProjectToJSON,
    importProjectFromJSON,
    resetAllData,
    isFirebaseEnabled,
    syncStatus,
    activeCollaborators,
    uploadProjectToCloud,
    openCloudProject,
    disconnectFromCloud,
    undo,
    redo,
    historyState,
  ]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule(): ScheduleContextType {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
