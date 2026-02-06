import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  AnyActivity,
  TradeActivity,
  EducationalActivity,
  ConsultationActivity,
  ActivityFilters,
  ChecklistInstance,
  ProcedureTemplate,
  Reminder,
  StaffMember,
  SyncStatus,
  CustomActivityType,
  ActivityType,
  ActivityCategory,
} from '../types';
import { ACTIVITY_TYPES, getActivityCategory, getActivityTypeInfo } from '../types';
import { defaultProcedures, getProcedureForActivity } from '../data/defaultProcedures';
import { getFiscalYear } from '../utils/fiscalYear';
import {
  generateChecklistFromTemplate,
  updateChecklistCounts,
  generateReminders,
} from '../utils/reminderScheduler';
import { useAuth } from '../../../context/AuthContext';

// State type
interface ProjectsState {
  activities: AnyActivity[];
  activeActivityId: string | null;
  checklistInstances: ChecklistInstance[];
  procedureTemplates: ProcedureTemplate[];
  staffMembers: StaffMember[];
  customActivityTypes: CustomActivityType[];
  currentUserId: string | null;
  filters: ActivityFilters;
  reminders: Reminder[];
  isLoading: boolean;
  syncStatus: SyncStatus;
}

// Action types
type ProjectsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ACTIVITIES'; payload: AnyActivity[] }
  | { type: 'ADD_ACTIVITY'; payload: AnyActivity }
  | { type: 'UPDATE_ACTIVITY'; payload: { id: string; updates: Partial<AnyActivity> } }
  | { type: 'DELETE_ACTIVITY'; payload: string }
  | { type: 'SET_ACTIVE_ACTIVITY'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: ActivityFilters }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'ADD_CHECKLIST'; payload: ChecklistInstance }
  | { type: 'UPDATE_CHECKLIST'; payload: ChecklistInstance }
  | { type: 'DELETE_CHECKLIST'; payload: string }
  | { type: 'SET_REMINDERS'; payload: Reminder[] }
  | { type: 'DISMISS_REMINDER'; payload: string }
  | { type: 'MARK_REMINDER_READ'; payload: string }
  | { type: 'SET_STAFF'; payload: StaffMember[] }
  | { type: 'SET_CURRENT_USER'; payload: string | null }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'LOAD_STATE'; payload: Partial<ProjectsState> }
  | { type: 'ADD_CUSTOM_TYPE'; payload: CustomActivityType }
  | { type: 'UPDATE_CUSTOM_TYPE'; payload: { id: string; updates: Partial<CustomActivityType> } }
  | { type: 'DELETE_CUSTOM_TYPE'; payload: string };

// Initial state
const initialState: ProjectsState = {
  activities: [],
  activeActivityId: null,
  checklistInstances: [],
  procedureTemplates: defaultProcedures,
  staffMembers: [],
  customActivityTypes: [],
  currentUserId: null,
  filters: {},
  reminders: [],
  isLoading: false,
  syncStatus: 'offline',
};

// Reducer
function projectsReducer(state: ProjectsState, action: ProjectsAction): ProjectsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ACTIVITIES':
      return { ...state, activities: action.payload };

    case 'ADD_ACTIVITY':
      return { ...state, activities: [...state.activities, action.payload] };

    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.payload.id
            ? { ...a, ...action.payload.updates, updatedAt: new Date().toISOString() }
            : a
        ) as AnyActivity[],
      };

    case 'DELETE_ACTIVITY':
      return {
        ...state,
        activities: state.activities.filter((a) => a.id !== action.payload),
        activeActivityId:
          state.activeActivityId === action.payload ? null : state.activeActivityId,
      };

    case 'SET_ACTIVE_ACTIVITY':
      return { ...state, activeActivityId: action.payload };

    case 'SET_FILTERS':
      return { ...state, filters: action.payload };

    case 'CLEAR_FILTERS':
      return { ...state, filters: {} };

    case 'ADD_CHECKLIST':
      return {
        ...state,
        checklistInstances: [...state.checklistInstances, action.payload],
      };

    case 'UPDATE_CHECKLIST':
      return {
        ...state,
        checklistInstances: state.checklistInstances.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };

    case 'DELETE_CHECKLIST':
      return {
        ...state,
        checklistInstances: state.checklistInstances.filter((c) => c.id !== action.payload),
      };

    case 'SET_REMINDERS':
      return { ...state, reminders: action.payload };

    case 'DISMISS_REMINDER':
      return {
        ...state,
        reminders: state.reminders.map((r) =>
          r.id === action.payload ? { ...r, isDismissed: true } : r
        ),
      };

    case 'MARK_REMINDER_READ':
      return {
        ...state,
        reminders: state.reminders.map((r) =>
          r.id === action.payload ? { ...r, isRead: true } : r
        ),
      };

    case 'SET_STAFF':
      return { ...state, staffMembers: action.payload };

    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: action.payload };

    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };

    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'ADD_CUSTOM_TYPE':
      return {
        ...state,
        customActivityTypes: [...state.customActivityTypes, action.payload],
      };

    case 'UPDATE_CUSTOM_TYPE':
      return {
        ...state,
        customActivityTypes: state.customActivityTypes.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      };

    case 'DELETE_CUSTOM_TYPE':
      return {
        ...state,
        customActivityTypes: state.customActivityTypes.filter((t) => t.id !== action.payload),
      };

    default:
      return state;
  }
}

// Context type
interface ProjectsContextType {
  // State
  activities: AnyActivity[];
  activeActivityId: string | null;
  activeActivity: AnyActivity | null;
  checklistInstances: ChecklistInstance[];
  procedureTemplates: ProcedureTemplate[];
  staffMembers: StaffMember[];
  customActivityTypes: CustomActivityType[];
  currentUserId: string | null;
  filters: ActivityFilters;
  reminders: Reminder[];
  isLoading: boolean;
  syncStatus: SyncStatus;

  // Activity CRUD
  createActivity: (activityType: ActivityType, data: Partial<AnyActivity>) => AnyActivity;
  createTradeActivity: (data: Partial<TradeActivity>) => TradeActivity;
  createEducationalActivity: (data: Partial<EducationalActivity>) => EducationalActivity;
  createConsultationActivity: (data: Partial<ConsultationActivity>) => ConsultationActivity;
  updateActivity: (id: string, updates: Partial<AnyActivity>) => void;
  deleteActivity: (id: string) => void;
  duplicateActivity: (id: string) => AnyActivity | null;
  archiveActivity: (id: string) => void;
  unarchiveActivity: (id: string) => void;

  // Selection
  selectActivity: (id: string | null) => void;

  // Filtering
  setFilters: (filters: ActivityFilters) => void;
  clearFilters: () => void;
  filteredActivities: AnyActivity[];
  archivedCount: number;

  // Custom Activity Types
  addCustomActivityType: (type: Omit<CustomActivityType, 'id' | 'createdAt'>) => CustomActivityType;
  updateCustomActivityType: (id: string, updates: Partial<CustomActivityType>) => void;
  deleteCustomActivityType: (id: string) => void;
  getActivityTypeInfo: (activityType: ActivityType) => ReturnType<typeof getActivityTypeInfo>;
  getAllActivityTypes: () => Array<{ id: string; name: string; category: ActivityCategory }>;

  // Checklists
  getChecklistForActivity: (activityId: string) => ChecklistInstance | undefined;
  updateChecklistItem: (
    checklistId: string,
    itemId: string,
    updates: Partial<ChecklistInstance['items'][0]>
  ) => void;

  // Reminders
  dismissReminder: (id: string) => void;
  markReminderRead: (id: string) => void;
  unreadReminderCount: number;

  // Staff
  getStaffMember: (id: string) => StaffMember | undefined;

  // Persistence
  exportToJSON: () => string;
  importFromJSON: (json: string) => void;
  loadSampleData: () => void;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

// Local storage key - using same key for data continuity with standalone app
const STORAGE_KEY = 'cdfa-project-manager-data';

// Provider component
export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectsReducer, initialState);
  const { user } = useAuth();

  // Sync Firebase UID from Hub auth
  useEffect(() => {
    if (user?.uid && user.uid !== state.currentUserId) {
      dispatch({ type: 'SET_CURRENT_USER', payload: user.uid });
    }
  }, [user?.uid, state.currentUserId]);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_STATE', payload: parsed });
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    }
  }, []);

  // Save to local storage on state change
  useEffect(() => {
    const toSave = {
      activities: state.activities,
      checklistInstances: state.checklistInstances,
      staffMembers: state.staffMembers,
      customActivityTypes: state.customActivityTypes,
      currentUserId: state.currentUserId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [state.activities, state.checklistInstances, state.staffMembers, state.customActivityTypes, state.currentUserId]);

  // Regenerate reminders when activities or checklists change
  useEffect(() => {
    const allReminders: Reminder[] = [];
    for (const checklist of state.checklistInstances) {
      const activity = state.activities.find((a) => a.id === checklist.activityId);
      if (activity && activity.status !== 'completed' && activity.status !== 'cancelled') {
        const activityReminders = generateReminders(checklist, activity);
        allReminders.push(...activityReminders);
      }
    }
    dispatch({ type: 'SET_REMINDERS', payload: allReminders });
  }, [state.activities, state.checklistInstances]);

  // Create trade activity
  const createTradeActivity = useCallback(
    (data: Partial<TradeActivity>): TradeActivity => {
      const now = new Date().toISOString();
      const activityType = data.activityType || 'trade_show';
      const activity: TradeActivity = {
        id: uuidv4(),
        activityType,
        type: 'trade_assistance', // Legacy compatibility
        name: data.name || 'New Trade Activity',
        description: data.description || '',
        status: data.status || 'draft',
        startDate: data.startDate || '',
        endDate: data.endDate || data.startDate || '',
        location: data.location || '',
        locationType: data.locationType || 'international',
        country: data.country,
        locations: data.locations || [],
        leadStaffId: data.leadStaffId || state.currentUserId || '',
        teamMemberIds: data.teamMemberIds || [],
        procedureTemplateId: data.procedureTemplateId || '',
        fiscalYear: data.fiscalYear || getFiscalYear(),
        tags: data.tags || [],
        notes: data.notes || '',
        targetMarket: data.targetMarket || '',
        commodities: data.commodities || [],
        suppliers: data.suppliers || [],
        buyers: data.buyers || [],
        createdAt: now,
        updatedAt: now,
      };

      dispatch({ type: 'ADD_ACTIVITY', payload: activity });

      // Generate checklist if procedure template is set
      const procedureEventType = activityType === 'outbound_trade_mission' ? 'trade_mission'
        : activityType === 'inbound_trade_mission' ? 'reverse_mission'
        : activityType;

      if (activity.procedureTemplateId || procedureEventType) {
        const template =
          state.procedureTemplates.find((t) => t.id === activity.procedureTemplateId) ||
          getProcedureForActivity('trade_assistance', procedureEventType);

        if (template && activity.startDate) {
          const checklist = generateChecklistFromTemplate(activity, template);
          dispatch({ type: 'ADD_CHECKLIST', payload: checklist });
          dispatch({
            type: 'UPDATE_ACTIVITY',
            payload: {
              id: activity.id,
              updates: {
                procedureTemplateId: template.id,
                checklistInstanceId: checklist.id,
              },
            },
          });
        }
      }

      return activity;
    },
    [state.currentUserId, state.procedureTemplates]
  );

  // Create educational activity
  const createEducationalActivity = useCallback(
    (data: Partial<EducationalActivity>): EducationalActivity => {
      const now = new Date().toISOString();
      const activityType = data.activityType || 'webinar';
      const activity: EducationalActivity = {
        id: uuidv4(),
        activityType,
        type: 'educational', // Legacy compatibility
        name: data.name || 'New Educational Activity',
        description: data.description || '',
        status: data.status || 'draft',
        startDate: data.startDate || '',
        endDate: data.endDate || data.startDate || '',
        location: data.location || '',
        locationType: data.locationType || 'virtual',
        locations: data.locations || [],
        leadStaffId: data.leadStaffId || state.currentUserId || '',
        teamMemberIds: data.teamMemberIds || [],
        procedureTemplateId: data.procedureTemplateId || '',
        fiscalYear: data.fiscalYear || getFiscalYear(),
        tags: data.tags || [],
        notes: data.notes || '',
        topic: data.topic || '',
        targetAudience: data.targetAudience || [],
        presenters: data.presenters || [],
        materials: data.materials || [],
        registrationRequired: data.registrationRequired ?? true,
        seriesInfo: data.seriesInfo,
        format: activityType as EducationalActivity['format'], // Legacy compatibility
        createdAt: now,
        updatedAt: now,
      };

      dispatch({ type: 'ADD_ACTIVITY', payload: activity });

      // Generate checklist if procedure template is set
      const procedureFormat = activityType === 'seminar_series' ? 'seminar' : activityType;
      if (activity.procedureTemplateId || procedureFormat) {
        const template =
          state.procedureTemplates.find((t) => t.id === activity.procedureTemplateId) ||
          getProcedureForActivity('educational', procedureFormat);

        if (template && activity.startDate) {
          const checklist = generateChecklistFromTemplate(activity, template);
          dispatch({ type: 'ADD_CHECKLIST', payload: checklist });
          dispatch({
            type: 'UPDATE_ACTIVITY',
            payload: {
              id: activity.id,
              updates: {
                procedureTemplateId: template.id,
                checklistInstanceId: checklist.id,
              },
            },
          });
        }
      }

      return activity;
    },
    [state.currentUserId, state.procedureTemplates]
  );

  // Create consultation activity
  const createConsultationActivity = useCallback(
    (data: Partial<ConsultationActivity>): ConsultationActivity => {
      const now = new Date().toISOString();
      const activity: ConsultationActivity = {
        id: uuidv4(),
        activityType: data.activityType || 'consultation',
        name: data.name || 'New Consultation',
        description: data.description || '',
        status: data.status || 'draft',
        startDate: data.startDate || '',
        endDate: data.endDate || data.startDate || '',
        location: data.location || '',
        locationType: data.locationType || 'virtual',
        locations: data.locations || [],
        leadStaffId: data.leadStaffId || state.currentUserId || '',
        teamMemberIds: data.teamMemberIds || [],
        procedureTemplateId: data.procedureTemplateId || '',
        fiscalYear: data.fiscalYear || getFiscalYear(),
        tags: data.tags || [],
        notes: data.notes || '',
        consultationType: data.consultationType || 'one_on_one',
        clientName: data.clientName,
        clientOrganization: data.clientOrganization,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        topics: data.topics || [],
        outcomes: data.outcomes,
        followUpRequired: data.followUpRequired,
        followUpDate: data.followUpDate,
        duration: data.duration,
        createdAt: now,
        updatedAt: now,
      };

      dispatch({ type: 'ADD_ACTIVITY', payload: activity });
      return activity;
    },
    [state.currentUserId]
  );

  // Generic create activity function
  const createActivity = useCallback(
    (activityType: ActivityType, data: Partial<AnyActivity>): AnyActivity => {
      const category = getActivityCategory(activityType, state.customActivityTypes);

      if (category === 'trade') {
        return createTradeActivity({ ...data, activityType } as Partial<TradeActivity>);
      } else if (category === 'educational') {
        return createEducationalActivity({ ...data, activityType } as Partial<EducationalActivity>);
      } else if (category === 'consultation') {
        return createConsultationActivity({ ...data, activityType } as Partial<ConsultationActivity>);
      } else {
        // Generic activity for custom types
        const now = new Date().toISOString();
        const activity: AnyActivity = {
          id: uuidv4(),
          activityType,
          name: data.name || 'New Activity',
          description: data.description || '',
          status: data.status || 'draft',
          startDate: data.startDate || '',
          endDate: data.endDate || data.startDate || '',
          location: data.location || '',
          locationType: data.locationType || 'domestic',
          locations: data.locations || [],
          leadStaffId: data.leadStaffId || state.currentUserId || '',
          teamMemberIds: data.teamMemberIds || [],
          procedureTemplateId: data.procedureTemplateId || '',
          fiscalYear: data.fiscalYear || getFiscalYear(),
          tags: data.tags || [],
          notes: data.notes || '',
          createdAt: now,
          updatedAt: now,
        };
        dispatch({ type: 'ADD_ACTIVITY', payload: activity });
        return activity;
      }
    },
    [state.customActivityTypes, state.currentUserId, createTradeActivity, createEducationalActivity, createConsultationActivity]
  );

  // Update activity
  const updateActivity = useCallback((id: string, updates: Partial<AnyActivity>) => {
    dispatch({ type: 'UPDATE_ACTIVITY', payload: { id, updates } });
  }, []);

  // Delete activity
  const deleteActivity = useCallback(
    (id: string) => {
      const activity = state.activities.find((a) => a.id === id);
      if (activity?.checklistInstanceId) {
        dispatch({ type: 'DELETE_CHECKLIST', payload: activity.checklistInstanceId });
      }
      dispatch({ type: 'DELETE_ACTIVITY', payload: id });
    },
    [state.activities]
  );

  // Duplicate activity
  const duplicateActivity = useCallback(
    (id: string): AnyActivity | null => {
      const original = state.activities.find((a) => a.id === id);
      if (!original) return null;

      const category = getActivityCategory(original.activityType, state.customActivityTypes);

      if (category === 'trade') {
        return createTradeActivity({
          ...original,
          name: `${original.name} (Copy)`,
          status: 'draft',
          startDate: '',
          endDate: '',
        } as Partial<TradeActivity>);
      } else if (category === 'consultation') {
        return createConsultationActivity({
          ...original,
          name: `${original.name} (Copy)`,
          status: 'draft',
          startDate: '',
          endDate: '',
        } as Partial<ConsultationActivity>);
      } else {
        return createEducationalActivity({
          ...original,
          name: `${original.name} (Copy)`,
          status: 'draft',
          startDate: '',
          endDate: '',
        } as Partial<EducationalActivity>);
      }
    },
    [state.activities, state.customActivityTypes, createTradeActivity, createEducationalActivity, createConsultationActivity]
  );

  // Archive activity
  const archiveActivity = useCallback((id: string) => {
    dispatch({
      type: 'UPDATE_ACTIVITY',
      payload: {
        id,
        updates: {
          isArchived: true,
          archivedAt: new Date().toISOString(),
        },
      },
    });
  }, []);

  // Unarchive activity
  const unarchiveActivity = useCallback((id: string) => {
    dispatch({
      type: 'UPDATE_ACTIVITY',
      payload: {
        id,
        updates: {
          isArchived: false,
          archivedAt: undefined,
        },
      },
    });
  }, []);

  // Custom Activity Type Management
  const addCustomActivityType = useCallback(
    (typeData: Omit<CustomActivityType, 'id' | 'createdAt'>): CustomActivityType => {
      const newType: CustomActivityType = {
        ...typeData,
        id: `custom_${uuidv4().substring(0, 8)}`,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_CUSTOM_TYPE', payload: newType });
      return newType;
    },
    []
  );

  const updateCustomActivityType = useCallback((id: string, updates: Partial<CustomActivityType>) => {
    dispatch({ type: 'UPDATE_CUSTOM_TYPE', payload: { id, updates } });
  }, []);

  const deleteCustomActivityType = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CUSTOM_TYPE', payload: id });
  }, []);

  const getActivityTypeInfoFn = useCallback(
    (activityType: ActivityType) => {
      return getActivityTypeInfo(activityType, state.customActivityTypes);
    },
    [state.customActivityTypes]
  );

  const getAllActivityTypes = useCallback(() => {
    const builtInTypes = Object.values(ACTIVITY_TYPES).map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
    }));

    const customTypes = state.customActivityTypes.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
    }));

    return [...builtInTypes, ...customTypes];
  }, [state.customActivityTypes]);

  // Select activity
  const selectActivity = useCallback((id: string | null) => {
    dispatch({ type: 'SET_ACTIVE_ACTIVITY', payload: id });
  }, []);

  // Filtering
  const setFilters = useCallback((filters: ActivityFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
  }, []);

  // Get filtered activities
  const filteredActivities = useMemo(() => {
    let result = [...state.activities];

    // Filter out archived activities unless showArchived is true
    if (!state.filters.showArchived) {
      result = result.filter((a) => !a.isArchived);
    }

    // Filter by specific activity type
    if (state.filters.activityType) {
      result = result.filter((a) => a.activityType === state.filters.activityType);
    }

    // Filter by category
    if (state.filters.category) {
      result = result.filter((a) => {
        const actCategory = getActivityCategory(a.activityType, state.customActivityTypes);
        return actCategory === state.filters.category;
      });
    }

    // Legacy type filter support
    if (state.filters.type) {
      result = result.filter((a) => a.type === state.filters.type);
    }

    if (state.filters.status && state.filters.status.length > 0) {
      result = result.filter((a) => state.filters.status!.includes(a.status));
    }

    if (state.filters.fiscalYear) {
      result = result.filter((a) => a.fiscalYear === state.filters.fiscalYear);
    }

    if (state.filters.leadStaffId) {
      result = result.filter((a) => a.leadStaffId === state.filters.leadStaffId);
    }

    if (state.filters.dateRange) {
      result = result.filter((a) => {
        const start = state.filters.dateRange!.start;
        const end = state.filters.dateRange!.end;
        return a.startDate >= start && a.startDate <= end;
      });
    }

    if (state.filters.searchQuery) {
      const query = state.filters.searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.location.toLowerCase().includes(query)
      );
    }

    // Sort by start date
    result.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.localeCompare(b.startDate);
    });

    return result;
  }, [state.activities, state.filters, state.customActivityTypes]);

  // Get archived activities count
  const archivedCount = useMemo(() => {
    return state.activities.filter((a) => a.isArchived).length;
  }, [state.activities]);

  // Get checklist for activity
  const getChecklistForActivity = useCallback(
    (activityId: string) => {
      return state.checklistInstances.find((c) => c.activityId === activityId);
    },
    [state.checklistInstances]
  );

  // Update checklist item
  const updateChecklistItem = useCallback(
    (
      checklistId: string,
      itemId: string,
      updates: Partial<ChecklistInstance['items'][0]>
    ) => {
      const checklist = state.checklistInstances.find((c) => c.id === checklistId);
      if (!checklist) return;

      const updatedItems = checklist.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      );

      const updatedChecklist = updateChecklistCounts({
        ...checklist,
        items: updatedItems,
      });

      dispatch({ type: 'UPDATE_CHECKLIST', payload: updatedChecklist });
    },
    [state.checklistInstances]
  );

  // Reminders
  const dismissReminder = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_REMINDER', payload: id });
  }, []);

  const markReminderRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_REMINDER_READ', payload: id });
  }, []);

  const unreadReminderCount = useMemo(() => {
    return state.reminders.filter((r) => !r.isRead && !r.isDismissed).length;
  }, [state.reminders]);

  // Staff
  const getStaffMember = useCallback(
    (id: string) => {
      return state.staffMembers.find((s) => s.id === id);
    },
    [state.staffMembers]
  );

  // Export/Import
  const exportToJSON = useCallback(() => {
    return JSON.stringify({
      activities: state.activities,
      checklistInstances: state.checklistInstances,
      staffMembers: state.staffMembers,
      customActivityTypes: state.customActivityTypes,
      exportedAt: new Date().toISOString(),
    });
  }, [state.activities, state.checklistInstances, state.staffMembers, state.customActivityTypes]);

  const importFromJSON = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          activities: data.activities || [],
          checklistInstances: data.checklistInstances || [],
          staffMembers: data.staffMembers || [],
          customActivityTypes: data.customActivityTypes || [],
        },
      });
    } catch (e) {
      console.error('Failed to import JSON:', e);
      throw new Error('Invalid JSON format');
    }
  }, []);

  // Load sample data for testing
  const loadSampleData = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Create diverse sample activities
    const sampleActivities: AnyActivity[] = [
      // Trade Shows
      {
        id: uuidv4(),
        activityType: 'trade_show',
        type: 'trade_assistance',
        name: 'Fancy Food Show 2026',
        description: 'Annual specialty food trade show in New York',
        status: 'planning',
        startDate: `${year}-06-25`,
        endDate: `${year}-06-27`,
        location: 'New York, NY',
        locationType: 'domestic',
        country: 'USA',
        locations: [],
        leadStaffId: '',
        teamMemberIds: [],
        procedureTemplateId: 'trade-show-template',
        fiscalYear: getFiscalYear(),
        tags: ['specialty food', 'domestic'],
        notes: '',
        targetMarket: 'USA',
        commodities: ['Specialty Foods', 'Wine', 'Olive Oil'],
        suppliers: [],
        buyers: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } as TradeActivity,
      {
        id: uuidv4(),
        activityType: 'trade_show',
        type: 'trade_assistance',
        name: 'FOODEX Japan 2026',
        description: 'Asia\'s largest food and beverage trade show',
        status: 'planning',
        startDate: `${year}-03-04`,
        endDate: `${year}-03-07`,
        location: 'Tokyo, Japan',
        locationType: 'international',
        country: 'Japan',
        locations: [
          { id: uuidv4(), city: 'Tokyo', country: 'Japan', venue: 'Makuhari Messe' }
        ],
        leadStaffId: '',
        teamMemberIds: [],
        procedureTemplateId: 'trade-show-template',
        fiscalYear: getFiscalYear(),
        tags: ['asia', 'food'],
        notes: '',
        targetMarket: 'Japan',
        commodities: ['Almonds', 'Wine', 'Pistachios', 'Dairy'],
        suppliers: [],
        buyers: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } as TradeActivity,
      // Outbound Trade Missions
      {
        id: uuidv4(),
        activityType: 'outbound_trade_mission',
        type: 'trade_assistance',
        name: 'Southeast Asia Trade Mission',
        description: 'Multi-city trade mission to Southeast Asian markets',
        status: 'in_progress',
        startDate: `${year}-${String(month + 1).padStart(2, '0')}-15`,
        endDate: `${year}-${String(month + 1).padStart(2, '0')}-28`,
        location: 'Multiple Cities',
        locationType: 'international',
        country: 'Multiple',
        locations: [
          { id: uuidv4(), city: 'Singapore', country: 'Singapore', venue: 'Marina Bay Sands' },
          { id: uuidv4(), city: 'Bangkok', country: 'Thailand', venue: 'BITEC' },
          { id: uuidv4(), city: 'Ho Chi Minh City', country: 'Vietnam', venue: 'SECC' },
        ],
        leadStaffId: '',
        teamMemberIds: [],
        procedureTemplateId: 'trade-mission-template',
        fiscalYear: getFiscalYear(),
        tags: ['southeast asia', 'multi-city'],
        notes: '',
        targetMarket: 'Southeast Asia',
        commodities: ['Fruits', 'Nuts', 'Wine'],
        suppliers: [],
        buyers: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } as TradeActivity,
      // Webinar
      {
        id: uuidv4(),
        activityType: 'webinar',
        type: 'educational',
        name: 'Japan Market Entry Webinar',
        description: 'Webinar on entering the Japanese food market',
        status: 'planning',
        startDate: `${year}-${String(month + 2).padStart(2, '0')}-20`,
        endDate: `${year}-${String(month + 2).padStart(2, '0')}-20`,
        location: 'Virtual',
        locationType: 'virtual',
        locations: [],
        leadStaffId: '',
        teamMemberIds: [],
        procedureTemplateId: 'webinar-template',
        fiscalYear: getFiscalYear(),
        tags: ['japan', 'webinar'],
        notes: '',
        format: 'webinar',
        topic: 'Japan Market Entry',
        targetAudience: ['Food Exporters', 'Wineries'],
        presenters: [],
        materials: [],
        registrationRequired: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } as EducationalActivity,
      // Consultation
      {
        id: uuidv4(),
        activityType: 'consultation',
        name: 'ABC Foods Export Planning',
        description: 'One-on-one consultation to develop export strategy',
        status: 'in_progress',
        startDate: `${year}-${String(month + 1).padStart(2, '0')}-03`,
        endDate: `${year}-${String(month + 1).padStart(2, '0')}-03`,
        location: 'Virtual',
        locationType: 'virtual',
        locations: [],
        leadStaffId: '',
        teamMemberIds: [],
        procedureTemplateId: '',
        fiscalYear: getFiscalYear(),
        tags: ['consultation', 'export planning'],
        notes: '',
        consultationType: 'one_on_one',
        clientName: 'John Smith',
        clientOrganization: 'ABC Foods Inc.',
        clientEmail: 'john@abcfoods.com',
        topics: ['Market Selection', 'Regulatory Requirements', 'Pricing Strategy'],
        followUpRequired: true,
        followUpDate: `${year}-${String(month + 2).padStart(2, '0')}-01`,
        duration: 60,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } as ConsultationActivity,
    ];

    dispatch({ type: 'SET_ACTIVITIES', payload: sampleActivities });
  }, []);

  // Active activity
  const activeActivity = useMemo(() => {
    if (!state.activeActivityId) return null;
    return state.activities.find((a) => a.id === state.activeActivityId) || null;
  }, [state.activities, state.activeActivityId]);

  const value: ProjectsContextType = {
    // State
    activities: state.activities,
    activeActivityId: state.activeActivityId,
    activeActivity,
    checklistInstances: state.checklistInstances,
    procedureTemplates: state.procedureTemplates,
    staffMembers: state.staffMembers,
    customActivityTypes: state.customActivityTypes,
    currentUserId: state.currentUserId,
    filters: state.filters,
    reminders: state.reminders,
    isLoading: state.isLoading,
    syncStatus: state.syncStatus,

    // Activity CRUD
    createActivity,
    createTradeActivity,
    createEducationalActivity,
    createConsultationActivity,
    updateActivity,
    deleteActivity,
    duplicateActivity,
    archiveActivity,
    unarchiveActivity,

    // Selection
    selectActivity,

    // Filtering
    setFilters,
    clearFilters,
    filteredActivities,
    archivedCount,

    // Custom Activity Types
    addCustomActivityType,
    updateCustomActivityType,
    deleteCustomActivityType,
    getActivityTypeInfo: getActivityTypeInfoFn,
    getAllActivityTypes,

    // Checklists
    getChecklistForActivity,
    updateChecklistItem,

    // Reminders
    dismissReminder,
    markReminderRead,
    unreadReminderCount,

    // Staff
    getStaffMember,

    // Persistence
    exportToJSON,
    importFromJSON,
    loadSampleData,
  };

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

// Hook to use context
export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
