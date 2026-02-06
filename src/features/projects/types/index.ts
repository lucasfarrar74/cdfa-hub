// Activity Categories (high-level groupings)
export type ActivityCategory = 'trade' | 'educational' | 'consultation' | 'other';

// Built-in Activity Types
export type BuiltInActivityType =
  | 'outbound_trade_mission'
  | 'inbound_trade_mission'
  | 'trade_show'
  | 'webinar'
  | 'seminar'
  | 'seminar_series'
  | 'consultation';

// Activity type can be built-in or a custom type ID
export type ActivityType = BuiltInActivityType | string;

export type ActivityStatus =
  | 'draft'
  | 'planning'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'postponed';

// Custom Activity Type definition (for extensibility)
export interface CustomActivityType {
  id: string;
  name: string;
  category: ActivityCategory;
  description?: string;
  color?: string;
  defaultProcedureTemplateId?: string;
  createdAt: string;
}

// Activity Type Metadata (for display and categorization)
export interface ActivityTypeInfo {
  id: string;
  name: string;
  shortName: string;
  category: ActivityCategory;
  color: string;
  icon?: string;
  isBuiltIn: boolean;
}

// Built-in activity type definitions
export const ACTIVITY_TYPES: Record<BuiltInActivityType, ActivityTypeInfo> = {
  outbound_trade_mission: {
    id: 'outbound_trade_mission',
    name: 'Outbound Trade Mission',
    shortName: 'Trade Mission',
    category: 'trade',
    color: 'blue',
    isBuiltIn: true,
  },
  inbound_trade_mission: {
    id: 'inbound_trade_mission',
    name: 'Inbound Trade Mission',
    shortName: 'Inbound Mission',
    category: 'trade',
    color: 'indigo',
    isBuiltIn: true,
  },
  trade_show: {
    id: 'trade_show',
    name: 'Trade Show',
    shortName: 'Trade Show',
    category: 'trade',
    color: 'purple',
    isBuiltIn: true,
  },
  webinar: {
    id: 'webinar',
    name: 'Webinar',
    shortName: 'Webinar',
    category: 'educational',
    color: 'green',
    isBuiltIn: true,
  },
  seminar: {
    id: 'seminar',
    name: 'Seminar',
    shortName: 'Seminar',
    category: 'educational',
    color: 'teal',
    isBuiltIn: true,
  },
  seminar_series: {
    id: 'seminar_series',
    name: 'Seminar Series',
    shortName: 'Series',
    category: 'educational',
    color: 'cyan',
    isBuiltIn: true,
  },
  consultation: {
    id: 'consultation',
    name: 'Consultation',
    shortName: 'Consultation',
    category: 'consultation',
    color: 'amber',
    isBuiltIn: true,
  },
};

// Helper to get category for an activity type
export function getActivityCategory(activityType: ActivityType, customTypes?: CustomActivityType[]): ActivityCategory {
  if (activityType in ACTIVITY_TYPES) {
    return ACTIVITY_TYPES[activityType as BuiltInActivityType].category;
  }
  const customType = customTypes?.find(t => t.id === activityType);
  return customType?.category || 'other';
}

// Helper to get activity type info
export function getActivityTypeInfo(activityType: ActivityType, customTypes?: CustomActivityType[]): ActivityTypeInfo {
  if (activityType in ACTIVITY_TYPES) {
    return ACTIVITY_TYPES[activityType as BuiltInActivityType];
  }
  const customType = customTypes?.find(t => t.id === activityType);
  if (customType) {
    return {
      id: customType.id,
      name: customType.name,
      shortName: customType.name,
      category: customType.category,
      color: customType.color || 'gray',
      isBuiltIn: false,
    };
  }
  return {
    id: activityType,
    name: activityType,
    shortName: activityType,
    category: 'other',
    color: 'gray',
    isBuiltIn: false,
  };
}

// Legacy type mappings for backward compatibility
export type TradeEventType = 'trade_show' | 'trade_mission' | 'reverse_mission';
export type EducationalFormat = 'seminar' | 'webinar' | 'workshop' | 'conference' | 'training';

// Location/Stop for multi-city trips
export interface ActivityLocation {
  id: string;
  city: string;
  country: string;
  venue?: string;
  startDate?: string; // Optional specific dates for this stop
  endDate?: string;
  notes?: string;
}

// Base Activity
export interface Activity {
  id: string;
  activityType: ActivityType; // The specific activity type (outbound_trade_mission, webinar, etc.)
  name: string;
  description: string;
  status: ActivityStatus;
  isArchived?: boolean; // Archived activities are hidden from main views but kept for reference
  archivedAt?: string; // When the activity was archived
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  // Single location (for simple activities)
  location: string;
  locationType: 'domestic' | 'international' | 'virtual';
  country?: string;
  // Multiple locations/stops (for trade missions with multiple cities)
  locations: ActivityLocation[];
  leadStaffId: string;
  teamMemberIds: string[];
  procedureTemplateId: string;
  checklistInstanceId?: string;
  fiscalYear: string;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;

  // Integration fields
  budgetId?: string; // Link to budgeting tool

  // Legacy field for backward compatibility (derived from activityType)
  type?: 'trade_assistance' | 'educational';
}

// Trade Activity specific
export interface ParticipantOrg {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  commodities?: string[];
  country: string;
}

// Trade activity extends base with trade-specific fields
export interface TradeActivity extends Activity {
  activityType: 'outbound_trade_mission' | 'inbound_trade_mission' | 'trade_show' | string;
  targetMarket: string;
  commodities: string[];
  suppliers: ParticipantOrg[];
  buyers: ParticipantOrg[];
  eventName?: string;
  boothNumber?: string;
  expectedMeetings?: number;
  actualMeetings?: number;
  expectedLeads?: number;
  actualLeads?: number;
  expectedSales?: number;
  reportedSales?: number;
  meetingSchedulerProjectId?: string; // Integration with meeting-scheduler (local project ID)
  meetingSchedulerShareId?: string;   // Integration with meeting-scheduler (cloud share ID)
}

// Legacy type alias for backward compatibility
export interface TradeAssistanceProject extends TradeActivity {
  type?: 'trade_assistance';
  eventType?: TradeEventType;
}

// Educational Activity specific
export interface Presenter {
  id: string;
  name: string;
  title: string;
  organization: string;
  email: string;
  bio?: string;
  isExternal: boolean;
}

export interface ActivityDocument {
  id: string;
  name: string;
  type: 'agenda' | 'presentation' | 'handout' | 'flyer' | 'report' | 'other';
  url: string;
  uploadedAt: string;
}

export interface EducationalActivity extends Activity {
  activityType: 'webinar' | 'seminar' | 'seminar_series' | string;
  topic: string;
  targetAudience: string[];
  presenters: Presenter[];
  materials: ActivityDocument[];
  registrationRequired: boolean;
  registrationDeadline?: string;
  maxAttendees?: number;
  registeredCount?: number;
  attendedCount?: number;
  recordingUrl?: string;
  // For seminar series
  seriesInfo?: {
    totalSessions: number;
    currentSession?: number;
    parentSeriesId?: string; // If this is part of a series
  };
  // Legacy field
  type?: 'educational';
  format?: EducationalFormat;
}

// Consultation Activity specific
export interface ConsultationActivity extends Activity {
  activityType: 'consultation' | string;
  consultationType: 'one_on_one' | 'group' | 'virtual' | 'in_person';
  clientName?: string;
  clientOrganization?: string;
  clientEmail?: string;
  clientPhone?: string;
  topics: string[];
  outcomes?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  duration?: number; // in minutes
}

// Union type for all activities
export type AnyActivity = TradeActivity | EducationalActivity | ConsultationActivity | Activity;

// Procedure Templates
export type TaskCategory =
  | 'administrative'
  | 'logistics'
  | 'communications'
  | 'budget'
  | 'participants'
  | 'materials'
  | 'compliance'
  | 'follow_up';

export interface ProcedureTask {
  id: string;
  title: string;
  description: string;
  order: number;
  dueOffset: number; // Days relative to activity start
  reminderOffsets: number[]; // Days before due date to remind
  isRequired: boolean;
  requiresApproval: boolean;
  approverRole?: string;
  dependsOnTaskIds: string[];
  category: TaskCategory;
  estimatedHours?: number;
  templateDocuments?: string[];
  instructions?: string;
}

export interface ProcedurePhase {
  id: string;
  name: string;
  description: string;
  order: number;
  startOffset: number; // Days before/after activity start
  endOffset: number;
  tasks: ProcedureTask[];
}

export interface ProcedureTemplate {
  id: string;
  name: string;
  description: string;
  activityType: ActivityType;
  eventType?: string;
  version: string;
  isActive: boolean;
  phases: ProcedurePhase[];
  createdAt: string;
  updatedAt: string;
}

// Checklist Instance (actual tracking for an activity)
export type ChecklistItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'skipped';

export interface ChecklistNote {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string; // Reference to ProcedureTask
  phaseId: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: ChecklistItemStatus;
  dueDate: string;
  reminderDates: string[];
  isRequired: boolean;
  requiresApproval: boolean;
  assigneeId?: string;
  completedAt?: string;
  completedById?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedById?: string;
  approvedAt?: string;
  notes: ChecklistNote[];
  attachments: string[];
}

export interface ChecklistInstance {
  id: string;
  activityId: string;
  procedureTemplateId: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  overdueCount: number;
  createdAt: string;
  updatedAt: string;
}

// Reminders
export type ReminderType = 'task_due' | 'task_overdue' | 'activity_upcoming' | 'custom';

export interface Reminder {
  id: string;
  type: ReminderType;
  activityId: string;
  checklistItemId?: string;
  title: string;
  message: string;
  scheduledFor: string;
  isRead: boolean;
  isDismissed: boolean;
  recipientIds: string[];
  createdAt: string;
}

// Staff/Team
export type StaffRole = 'admin' | 'manager' | 'coordinator' | 'specialist' | 'viewer';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  avatarUrl?: string;
}

export interface UserPreferences {
  userId: string;
  defaultCalendarView: 'month' | 'quarter' | 'year';
  emailNotifications: boolean;
  reminderDaysBefore: number[];
  theme: 'light' | 'dark' | 'system';
}

// Filtering
export interface ActivityFilters {
  activityType?: ActivityType; // Specific activity type
  category?: ActivityCategory; // Filter by category (trade, educational, etc.)
  status?: ActivityStatus[];
  fiscalYear?: string;
  leadStaffId?: string;
  dateRange?: { start: string; end: string };
  searchQuery?: string;
  showArchived?: boolean; // Include archived activities in results
  // Legacy
  type?: 'trade_assistance' | 'educational';
}

// Firebase sync status
export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

// App State
export interface AppState {
  currentFiscalYear: string;
  activities: AnyActivity[];
  activeActivityId: string | null;
  procedureTemplates: ProcedureTemplate[];
  checklistInstances: ChecklistInstance[];
  staffMembers: StaffMember[];
  customActivityTypes: CustomActivityType[];
  currentUserId: string | null;
  isLoading: boolean;
  filters: ActivityFilters;
  reminders: Reminder[];
  unreadReminderCount: number;
  syncStatus: SyncStatus;
}
