export interface ContactPerson {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
}

export interface AvailabilityRestriction {
  type: 'unavailable_date' | 'unavailable_slot' | 'preferred_time' | 'note';
  date?: string;       // YYYY-MM-DD
  startTime?: string;  // HH:mm
  endTime?: string;    // HH:mm
  note?: string;
}

export interface Supplier {
  id: string;
  companyName: string;           // PRIMARY FIELD (required)
  primaryContact: ContactPerson; // Main representative
  secondaryContact?: ContactPerson; // Optional second person
  tableNumber?: number;
  meetingDuration: number; // in minutes
  preference: PreferenceType;
  preferenceList: string[]; // buyer IDs
  availabilityRestrictions?: AvailabilityRestriction[];
  selectedDays?: string[]; // YYYY-MM-DD dates the supplier is available for meetings
  availableFrom?: string;  // HH:mm — earliest time this supplier can meet (e.g. "09:00")
  availableTo?: string;    // HH:mm — latest time this supplier can meet (e.g. "14:00")

}

export interface Buyer {
  id: string;
  name: string;
  organization: string;
  email?: string;
  phone?: string;
  color?: string; // Hex color for schedule grid display
}

export type PreferenceType = 'all' | 'include' | 'exclude';

export type SchedulingStrategy = 'efficient' | 'spaced' | 'equitable';

export interface TimeSlot {
  id: string;
  date: string; // YYYY-MM-DD format - which day this slot belongs to
  startTime: Date;
  endTime: Date;
  isBreak: boolean;
  breakName?: string;
}

export interface Meeting {
  id: string;
  supplierId: string;
  buyerId: string;
  timeSlotId: string;
  status: MeetingStatus;
  // Delay handling fields
  originalTimeSlotId?: string;  // Track original slot if bumped
  delayReason?: string;         // Optional note for delays
  delayedAt?: string;           // When marked delayed (ISO string)
  bumpedFrom?: string;          // Meeting ID this was bumped from
  // Collaboration fields
  notes?: MeetingNote[];        // Comments/notes for this meeting
}

export type MeetingStatus =
  | 'scheduled'      // Normal scheduled meeting
  | 'in_progress'    // Meeting currently happening
  | 'completed'      // Meeting finished
  | 'cancelled'      // Meeting cancelled
  | 'running_late'   // Started but running over time
  | 'delayed'        // Delayed due to external factors (buyer late, etc.)
  | 'bumped';        // Moved to a later slot

export interface Break {
  id: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  date?: string;     // YYYY-MM-DD — when set, break applies only to this day; when undefined, applies to all enabled days
}

export interface EventConfig {
  id: string;
  name: string;
  startDate: string;   // YYYY-MM-DD format
  endDate: string;     // YYYY-MM-DD format
  startTime: string;   // HH:mm format (daily start time)
  endTime: string;     // HH:mm format (daily end time)
  defaultMeetingDuration: number; // in minutes
  breaks: Break[];
  disabledDays?: string[];  // YYYY-MM-DD dates within range that should generate no time slots
  schedulingStrategy: SchedulingStrategy;
  optimizationEnabled?: boolean;  // Evaluate multiple candidates to minimize gaps (default true)
  candidateCount?: number;        // Number of candidates to evaluate (default 10)
}

// Legacy EventConfig for migration
export interface LegacyEventConfig {
  id: string;
  name: string;
  date: string;        // YYYY-MM-DD format (single day)
  startTime: string;
  endTime: string;
  defaultMeetingDuration: number;
  breaks: Break[];
}

export function migrateEventConfig(legacy: LegacyEventConfig): EventConfig {
  return {
    ...legacy,
    startDate: legacy.date,
    endDate: legacy.date,
    schedulingStrategy: 'efficient',
  };
}

export function isLegacyEventConfig(obj: unknown): obj is LegacyEventConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'date' in obj &&
    !('startDate' in obj)
  );
}

export interface UnscheduledPair {
  supplierId: string;
  buyerId: string;
}

export interface ScheduleState {
  eventConfig: EventConfig | null;
  suppliers: Supplier[];
  buyers: Buyer[];
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: UnscheduledPair[];
  isGenerating: boolean;
}

// Project container for multi-event support
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  eventConfig: EventConfig | null;
  suppliers: Supplier[];
  buyers: Buyer[];
  meetings: Meeting[];
  timeSlots: TimeSlot[];
  unscheduledPairs: UnscheduledPair[];
  // Cloud sync fields
  isCloud?: boolean;           // Whether this project is synced to cloud
  ownerId?: string;            // Firebase user ID of owner
  collaborators?: string[];    // User IDs with access
  shareId?: string;            // Short ID for sharing links

  // Integration with CDFA Project Manager
  cdfaActivityId?: string;     // Link back to Project Manager activity
  fiscalYear?: string;         // Fiscal year for budget alignment (e.g., "FY2025-26")

  // Google Sheets export
  googleSheetsId?: string;     // Spreadsheet ID of the linked Google Sheet, if pushed
  googleSheetsUrl?: string;    // Full URL of the linked Sheet (for display/copy)

  // Optimistic-concurrency counter. Incremented atomically inside a
  // Firestore transaction on every cloud write. Clients that start a
  // write with a stale `revision` get rejected (sync-conflict), which
  // is how two admins editing within the 500ms debounce window are
  // prevented from silently overwriting each other. Absent on legacy
  // projects; treated as 0. See useSyncProjectChanges + computeSyncOutcome.
  revision?: number;
}

// Sync status for cloud projects
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

// Detail about the most recent sync failure, surfaced to UI.
export interface SyncError {
  message: string;
  code?: string; // Firebase FirestoreError code, e.g. 'permission-denied'
  operation?: 'upload' | 'open' | 'listen' | 'write' | 'presence';
}

// Active collaborator info
export interface ActiveCollaborator {
  userId: string;
  userName?: string;
  lastSeen: string;
  // Cell-level presence: the id of the meeting this collaborator is
  // currently focused on (hovering / opened menu / dragging). Null or
  // absent means they're viewing the project but not attending to a
  // specific meeting. Used to render presence chips on meeting cells
  // so teammates can see what each other is working on and avoid
  // stepping on the same edit.
  focusedMeetingId?: string | null;
}

// Activity event for collaboration feed
export type ActivityEventType =
  | 'meeting_moved'
  | 'meeting_swapped'
  | 'meeting_added'
  | 'meeting_cancelled'
  | 'meeting_started'
  | 'meeting_completed'
  | 'meeting_delayed'
  | 'meeting_bumped'
  | 'meeting_status_changed'
  | 'schedule_generated'
  | 'schedule_cleared'
  | 'auto_fix_applied'
  | 'undo_applied';

/**
 * Enough state to reverse a change. Every activity event that admins
 * can undo carries one of these. Bulk events (auto-fix, schedule-
 * generated) carry a full-array snapshot; single-meeting events carry
 * only the tiny delta needed to invert the change.
 */
export type UndoPayload =
  | { kind: 'move'; meetingId: string; previousSlotId: string }
  | { kind: 'swap'; meetingId1: string; meetingId2: string; previousSlot1: string; previousSlot2: string }
  | { kind: 'add'; meetingId: string }
  | { kind: 'cancel'; meetingId: string; previousStatus: MeetingStatus }
  | { kind: 'status-change'; meetingId: string; previousStatus: MeetingStatus }
  | { kind: 'bulk-meetings'; previousMeetings: Meeting[] }
  | { kind: 'none' }; // event is informational, not undoable

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string; // ISO string
  userId: string;
  userName?: string;
  /** Short human summary — precomputed at write time so consumers don't need lookups. */
  summary: string;
  /** Reference IDs for optional deep-linking (highlight the affected meeting). */
  details: {
    meetingId?: string;
    supplierName?: string;
    buyerName?: string;
    reason?: string;
    fromSlot?: string;
    toSlot?: string;
  };
  /** How to reverse this event. `kind: 'none'` = informational only. */
  undoPayload: UndoPayload;
  /** True after someone has clicked Undo on this event, to grey it out and prevent double-undo. */
  undone?: boolean;
}

// Meeting note for collaboration
export interface MeetingNote {
  id: string;
  meetingId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
}

// Reports a single (supplier, slot) or (buyer, slot) collision — two
// active meetings scheduled for the same party in the same slot. This
// is the schedule-integrity invariant the write-time guards enforce.
export interface DoubleBooking {
  kind: 'supplier' | 'buyer';
  partyId: string;
  slotId: string;
  meetingIds: string[];
}

// App-level state for managing multiple projects
export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  isGenerating: boolean;
}

// Conflict types for conflict detection
export interface ConflictInfo {
  type: 'supplier_busy' | 'buyer_busy' | 'preference_violation';
  severity: 'error' | 'warning';
  description: string;
  affectedMeetingId?: string;
  affectedPartyName: string;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface ScheduleConflictsSummary {
  buyerDoubleBookings: Array<{
    buyerId: string;
    buyerName: string;
    slotId: string;
    slotTime: string;
    meetingIds: string[];
    supplierNames: string[];
  }>;
  preferenceViolations: Array<{
    meetingId: string;
    supplierId: string;
    supplierName: string;
    buyerId: string;
    buyerName: string;
  }>;
  totalConflicts: number;
}

export interface ScheduleContextType extends ScheduleState {
  // Project management
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  createProject: (name: string, options?: { cdfaActivityId?: string; fiscalYear?: string }) => Project;
  switchProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  duplicateProject: (projectId: string) => Project;
  renameProject: (projectId: string, name: string) => void;

  // Event config
  setEventConfig: (config: EventConfig) => void;

  // Suppliers
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  removeSupplier: (id: string) => void;
  importSuppliers: (suppliers: Supplier[]) => void;

  // Buyers
  addBuyer: (buyer: Buyer) => void;
  updateBuyer: (id: string, buyer: Partial<Buyer>) => void;
  removeBuyer: (id: string) => void;
  importBuyers: (buyers: Buyer[]) => void;
  autoAssignBuyerColors: () => void;

  // Schedule generation
  generateSchedule: () => void;

  // Meeting operations
  updateMeetingStatus: (meetingId: string, status: MeetingStatus) => void;
  swapMeetings: (meetingId1: string, meetingId2: string) => void;
  moveMeeting: (meetingId: string, newTimeSlotId: string) => void;
  cancelMeeting: (meetingId: string) => void;
  autoFillGaps: () => void;
  clearSchedule: () => void;

  // New meeting management
  addMeeting: (supplierId: string, buyerId: string, timeSlotId: string) => { success: boolean; meetingId?: string; message: string };

  // Conflict detection
  getScheduleConflicts: () => ScheduleConflictsSummary;
  checkMoveConflicts: (meetingId: string, targetSlotId: string) => ConflictCheckResult;
  checkAddMeetingConflicts: (supplierId: string, buyerId: string, slotId: string) => ConflictCheckResult;
  getMeetingConflicts: (meetingId: string) => ConflictInfo[];

  // Delay handling
  markMeetingDelayed: (meetingId: string, reason?: string) => void;
  markMeetingRunningLate: (meetingId: string) => void;
  startMeeting: (meetingId: string) => void;
  bumpMeeting: (meetingId: string) => { success: boolean; newSlotId?: string; message: string };
  findNextAvailableSlot: (meetingId: string) => string | null;

  // Meeting notes
  addMeetingNote: (meetingId: string, content: string) => void;

  // Google Sheets export link persistence
  setActiveProjectSheetsLink: (googleSheetsId: string, googleSheetsUrl: string) => void;

  // Guard-rejection message from the last blocked mutation (double-booking
  // etc.). The scheduler page mounts <ScheduleErrorToast> which subscribes.
  mutationError: string | null;
  clearMutationError: () => void;

  // Import/Export
  exportToJSON: () => string;
  importFromJSON: (json: string) => void;
  exportProjectToJSON: (projectId: string) => string;
  importProjectFromJSON: (json: string) => Project;
  resetAllData: () => void;

  // Cloud sync
  isFirebaseEnabled: boolean;
  syncStatus: SyncStatus;
  activeCollaborators: ActiveCollaborator[];
  uploadProjectToCloud: (projectId: string) => Promise<string | null>;
  openCloudProject: (shareId: string) => Promise<Project | null>;
  disconnectFromCloud: (projectId: string) => void;
  /**
   * Cell-level presence — tell the sync layer this user is now attending
   * to a specific meeting (or `null` to clear). Consumed as a no-op when
   * the active project isn't a cloud project.
   */
  setFocusedMeeting: (meetingId: string | null) => void;

  /**
   * Live-tailed shared activity log for the active cloud project.
   * Newest first, capped at ~50 events. Empty when the active project
   * isn't a cloud project.
   */
  activityEvents: ActivityEvent[];
  /**
   * Apply the inverse of an activity event ("undo this change"). The
   * inverse is dispatched through the standard write-time guards, so it
   * can be refused with a red toast if it would create a stack (e.g. a
   * later change now occupies the slot we'd restore into).
   */
  applyActivityUndo: (event: ActivityEvent) => Promise<'ok' | 'skipped'>;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Schedule optimization
  generationProgress: { current: number; total: number } | null;
  lastScheduleScore: ScheduleScoreInfo | null;

  // Most recent cloud-sync error (null when healthy or offline).
  lastSyncError: SyncError | null;

  // Error from the on-login "which cloud projects do I have?" query.
  // Non-null usually means Firestore rules haven't been deployed with
  // the new list permissions (`permission-denied`) — surfacing this is
  // what stops the feature from failing silently on a fresh device.
  discoveryError: SyncError | null;

  // Warning surfaced when an incoming Firestore snapshot contained a
  // double-booking — evidence that a concurrent edit race got past the
  // per-client guards. Null when the last snapshot was clean.
  remoteIntegrityWarning: string | null;

  // Every double-booking currently present in the active project's
  // meetings. Computed on every render — the schedule panel surfaces a
  // banner when this is non-empty, regardless of how the stacks got
  // there (past bug, corrupted import, sync race, etc.).
  scheduleIntegrityIssues: DoubleBooking[];

  // One-shot auto-cleanup: for each stack, keep the meeting whose
  // (supplier, buyer) pair best matches the supplier's preferences and
  // try to reschedule each loser to a different open slot. Losers with
  // no valid open slot are cancelled (recoverable — meeting stays in
  // the array with status='cancelled'). Returns counts so the UI can
  // report what happened.
  resolveActiveProjectStacks: () => { rescheduledCount: number; cancelledCount: number };
}

export interface ScheduleScoreInfo {
  totalScore: number;
  totalMeetings: number;
  maxConsecutiveGap: number;
  candidatesEvaluated: number;
}

// Helper to migrate old supplier format to new
export interface LegacySupplier {
  id: string;
  name: string;
  organization: string;
  email?: string;
  phone?: string;
  tableNumber?: number;
  meetingDuration: number;
  preference: PreferenceType;
  preferenceList: string[];
}

export function migrateSupplier(legacy: LegacySupplier): Supplier {
  return {
    id: legacy.id,
    companyName: legacy.organization || legacy.name,
    primaryContact: {
      name: legacy.name,
      email: legacy.email,
      phone: legacy.phone,
    },
    tableNumber: legacy.tableNumber,
    meetingDuration: legacy.meetingDuration,
    preference: legacy.preference,
    preferenceList: legacy.preferenceList,
  };
}

export function isLegacySupplier(obj: unknown): obj is LegacySupplier {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'organization' in obj &&
    !('companyName' in obj)
  );
}
