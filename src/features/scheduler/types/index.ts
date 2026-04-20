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
}

// Activity event for collaboration feed
export type ActivityEventType =
  | 'meeting_started'
  | 'meeting_completed'
  | 'meeting_delayed'
  | 'meeting_bumped'
  | 'meeting_cancelled'
  | 'schedule_generated'
  | 'schedule_cleared';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  userId?: string;
  userName?: string;
  details: {
    meetingId?: string;
    supplierName?: string;
    buyerName?: string;
    reason?: string;
    fromSlot?: string;
    toSlot?: string;
  };
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
