import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  ActivitySummary,
  Activity,
  Expense,
  Income,
  Cooperator,
  ExpenseCategory,
  DashboardSummary,
  ActivityFinancials,
  CreateActivityInput,
  UpdateActivityInput,
  CreateExpenseInput,
} from '../types';
import {
  sampleCooperators,
  sampleCategories,
  sampleActivities,
  sampleExpenses,
  sampleIncome,
  INITIAL_NEXT_ID,
} from '../data/sampleData';

const STORAGE_KEY = 'cdfa-budget-tracker-data';

// --- State ---

interface BudgetState {
  activities: ActivitySummary[];
  currentActivity: Activity | null;
  expenses: Expense[];
  income: Income[];
  cooperators: Cooperator[];
  categories: ExpenseCategory[];
  dashboardSummary: DashboardSummary | null;
  allExpenses: Record<number, Expense[]>;
  allIncome: Record<number, Income[]>;
  nextId: number;
  isLoading: boolean;
  isLinked: boolean;
  error: string | null;
}

// --- Actions ---

type BudgetAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LINKED'; payload: boolean }
  | { type: 'SET_ACTIVITIES'; payload: ActivitySummary[] }
  | { type: 'SET_CURRENT_ACTIVITY'; payload: Activity | null }
  | { type: 'SET_EXPENSES'; payload: Expense[] }
  | { type: 'SET_INCOME'; payload: Income[] }
  | { type: 'SET_COOPERATORS'; payload: Cooperator[] }
  | { type: 'SET_CATEGORIES'; payload: ExpenseCategory[] }
  | { type: 'SET_DASHBOARD_SUMMARY'; payload: DashboardSummary }
  | { type: 'ADD_ACTIVITY'; payload: ActivitySummary }
  | { type: 'UPDATE_ACTIVITY'; payload: { id: number; updates: Partial<ActivitySummary> } }
  | { type: 'ADD_EXPENSE'; payload: { activityId: number; expense: Expense } }
  | { type: 'DELETE_ACTIVITY'; payload: number }
  | { type: 'LOAD_STATE'; payload: PersistedState };

interface PersistedState {
  activities: ActivitySummary[];
  allExpenses: Record<number, Expense[]>;
  allIncome: Record<number, Income[]>;
  cooperators: Cooperator[];
  categories: ExpenseCategory[];
  nextId: number;
}

const initialState: BudgetState = {
  activities: [],
  currentActivity: null,
  expenses: [],
  income: [],
  cooperators: [],
  categories: [],
  dashboardSummary: null,
  allExpenses: {},
  allIncome: {},
  nextId: INITIAL_NEXT_ID,
  isLoading: false,
  isLinked: true,
  error: null,
};

// --- Helpers ---

function computeFinancials(
  activity: ActivitySummary,
  expenses: Expense[],
  income: Income[]
): ActivityFinancials {
  let total_projected = 0;
  let total_actual = 0;
  let projected_only_total = 0;

  for (const e of expenses) {
    const proj = e.projected_amount ?? 0;
    const act = e.actual_amount ?? 0;
    total_projected += proj;
    total_actual += act;
    if (e.status === 'projected') {
      projected_only_total += proj;
    }
  }

  const total_committed = total_actual + projected_only_total;

  let total_income_actual = 0;
  let total_income_projected = 0;
  for (const i of income) {
    total_income_actual += i.actual_amount ?? 0;
    total_income_projected += i.projected_amount ?? 0;
  }
  const total_income_committed = total_income_actual +
    income.filter(i => i.status === 'projected').reduce((s, i) => s + (i.projected_amount ?? 0), 0);

  const net_actual = total_actual - total_income_actual;
  const net_committed = total_committed - total_income_committed;
  const available_budget = activity.budget - total_committed;
  const net_available_budget = activity.budget - net_committed;

  const utilization_percent = activity.budget > 0
    ? Math.round((total_actual / activity.budget) * 100)
    : 0;
  const committed_percent = activity.budget > 0
    ? Math.round((total_committed / activity.budget) * 100)
    : 0;

  let budget_status: 'under' | 'near' | 'over';
  if (committed_percent > 100) budget_status = 'over';
  else if (committed_percent >= 85) budget_status = 'near';
  else budget_status = 'under';

  return {
    total_projected,
    total_actual,
    total_committed,
    projected_only_total,
    total_income_actual,
    total_income_projected,
    total_income_committed,
    net_actual,
    net_committed,
    available_budget,
    net_available_budget,
    utilization_percent,
    committed_percent,
    budget_status,
  };
}

function computeDashboardSummary(activities: ActivitySummary[]): DashboardSummary {
  const total_activities = activities.length;
  const active_activities = activities.filter(a => a.status === 'active').length;
  const total_budget = activities.reduce((s, a) => s + a.budget, 0);
  const total_spent = activities.reduce((s, a) => s + a.total_actual, 0);
  const total_committed = activities.reduce((s, a) => s + a.total_committed, 0);
  const budget_remaining = total_budget - total_committed;

  return {
    total_activities,
    active_activities,
    total_budget,
    total_spent,
    total_committed,
    budget_remaining,
    recent_activities: [...activities].slice(0, 5),
  };
}

// --- Reducer ---

function budgetReducer(state: BudgetState, action: BudgetAction): BudgetState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_LINKED':
      return { ...state, isLinked: action.payload };
    case 'SET_ACTIVITIES':
      return { ...state, activities: action.payload };
    case 'SET_CURRENT_ACTIVITY':
      return { ...state, currentActivity: action.payload };
    case 'SET_EXPENSES':
      return { ...state, expenses: action.payload };
    case 'SET_INCOME':
      return { ...state, income: action.payload };
    case 'SET_COOPERATORS':
      return { ...state, cooperators: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_DASHBOARD_SUMMARY':
      return { ...state, dashboardSummary: action.payload };

    case 'ADD_ACTIVITY':
      return {
        ...state,
        activities: [...state.activities, action.payload],
        allExpenses: { ...state.allExpenses, [action.payload.id]: [] },
        allIncome: { ...state.allIncome, [action.payload.id]: [] },
        nextId: state.nextId + 1,
      };

    case 'UPDATE_ACTIVITY': {
      const { id, updates } = action.payload;
      return {
        ...state,
        activities: state.activities.map(a =>
          a.id === id ? { ...a, ...updates } : a
        ),
      };
    }

    case 'ADD_EXPENSE': {
      const { activityId, expense } = action.payload;
      const updatedExpenses = [
        ...(state.allExpenses[activityId] || []),
        expense,
      ];
      return {
        ...state,
        allExpenses: { ...state.allExpenses, [activityId]: updatedExpenses },
        expenses: state.currentActivity?.id === activityId
          ? updatedExpenses
          : state.expenses,
        nextId: state.nextId + 1,
      };
    }

    case 'DELETE_ACTIVITY': {
      const id = action.payload;
      const { [id]: _e, ...restExpenses } = state.allExpenses;
      const { [id]: _i, ...restIncome } = state.allIncome;
      return {
        ...state,
        activities: state.activities.filter(a => a.id !== id),
        allExpenses: restExpenses,
        allIncome: restIncome,
      };
    }

    case 'LOAD_STATE':
      return {
        ...state,
        activities: action.payload.activities,
        allExpenses: action.payload.allExpenses,
        allIncome: action.payload.allIncome,
        cooperators: action.payload.cooperators,
        categories: action.payload.categories,
        nextId: action.payload.nextId,
      };

    default:
      return state;
  }
}

// --- Context ---

interface BudgetContextType extends BudgetState {
  loadActivities: () => Promise<void>;
  loadActivity: (activityId: number) => Promise<void>;
  loadActivityByCdfaId: (cdfaId: string) => Promise<void>;
  loadExpenses: (activityId: number) => Promise<void>;
  loadIncome: (activityId: number) => Promise<void>;
  loadDashboard: () => Promise<void>;
  createActivity: (data: CreateActivityInput) => Promise<Activity | null>;
  updateActivity: (activityId: number, data: UpdateActivityInput) => Promise<Activity | null>;
  createExpense: (activityId: number, data: CreateExpenseInput) => Promise<Expense | null>;
  linkAccount: (username: string, password: string) => Promise<boolean>;
  clearError: () => void;
  loadSampleData: () => void;
  exportToJSON: () => string;
  importFromJSON: (json: string) => boolean;
}

const BudgetContext = createContext<BudgetContextType | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(budgetReducer, initialState);

  // Load from localStorage on mount (or auto-load sample data)
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved: PersistedState = JSON.parse(raw);
        dispatch({ type: 'LOAD_STATE', payload: saved });
        return;
      } catch {
        // Corrupted data - fall through to load sample data
      }
    }
    // First visit: auto-load sample data
    const sampleState: PersistedState = {
      activities: sampleActivities,
      allExpenses: sampleExpenses,
      allIncome: sampleIncome,
      cooperators: sampleCooperators,
      categories: sampleCategories,
      nextId: INITIAL_NEXT_ID,
    };
    dispatch({ type: 'LOAD_STATE', payload: sampleState });
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    // Only persist if we have data loaded (avoid writing empty state on first render)
    if (state.activities.length === 0 && state.cooperators.length === 0) return;

    const persisted: PersistedState = {
      activities: state.activities,
      allExpenses: state.allExpenses,
      allIncome: state.allIncome,
      cooperators: state.cooperators,
      categories: state.categories,
      nextId: state.nextId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [state.activities, state.allExpenses, state.allIncome, state.cooperators, state.categories, state.nextId]);

  // Auto-compute dashboard summary when activities change
  useEffect(() => {
    if (state.activities.length > 0) {
      const summary = computeDashboardSummary(state.activities);
      dispatch({ type: 'SET_DASHBOARD_SUMMARY', payload: summary });
    }
  }, [state.activities]);

  // --- Action functions ---

  const loadActivities = useCallback(async () => {
    // Data already in state from localStorage / sample data
  }, []);

  const loadActivity = useCallback(async (activityId: number) => {
    const summary = state.activities.find(a => a.id === activityId);
    if (!summary) {
      dispatch({ type: 'SET_ERROR', payload: `Activity ${activityId} not found` });
      return;
    }

    const cooperator = state.cooperators.find(c => c.id === summary.cooperator_id) || null;
    const expenses = state.allExpenses[activityId] || [];
    const income = state.allIncome[activityId] || [];
    const financials = computeFinancials(summary, expenses, income);

    const activity: Activity = {
      id: summary.id,
      name: summary.name,
      description: summary.description,
      cooperator_id: summary.cooperator_id,
      budget: summary.budget,
      start_date: summary.start_date,
      end_date: summary.end_date,
      status: summary.status,
      location: summary.location,
      cdfa_activity_id: summary.cdfa_activity_id,
      total_actual: financials.total_actual,
      total_committed: financials.total_committed,
      net_committed: financials.net_committed,
      available_budget: financials.available_budget,
      budget_status: financials.budget_status,
      cooperator,
      financials,
      created_at: null,
      updated_at: null,
    };

    dispatch({ type: 'SET_CURRENT_ACTIVITY', payload: activity });
  }, [state.activities, state.cooperators, state.allExpenses, state.allIncome]);

  const loadActivityByCdfaId = useCallback(async (cdfaId: string) => {
    const summary = state.activities.find(a => a.cdfa_activity_id === cdfaId);
    if (!summary) {
      dispatch({ type: 'SET_ERROR', payload: `Activity with CDFA ID ${cdfaId} not found` });
      return;
    }
    await loadActivity(summary.id);
  }, [state.activities, loadActivity]);

  const loadExpenses = useCallback(async (activityId: number) => {
    const expenses = state.allExpenses[activityId] || [];
    dispatch({ type: 'SET_EXPENSES', payload: expenses });
  }, [state.allExpenses]);

  const loadIncome = useCallback(async (activityId: number) => {
    const income = state.allIncome[activityId] || [];
    dispatch({ type: 'SET_INCOME', payload: income });
  }, [state.allIncome]);

  const loadDashboard = useCallback(async () => {
    // Dashboard summary auto-computed via useEffect
  }, []);

  const createActivity = useCallback(async (data: CreateActivityInput): Promise<Activity | null> => {
    const id = state.nextId;
    const cooperator = state.cooperators.find(c => c.id === data.cooperator_id) || null;

    const summary: ActivitySummary = {
      id,
      name: data.name,
      description: data.description || null,
      cooperator_id: data.cooperator_id,
      cooperator_name: cooperator?.name || null,
      budget: data.budget,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      status: data.status || 'planning',
      location: data.location || null,
      cdfa_activity_id: data.cdfa_activity_id || null,
      total_actual: 0,
      total_committed: 0,
      net_committed: 0,
      available_budget: data.budget,
      budget_status: 'under',
    };

    dispatch({ type: 'ADD_ACTIVITY', payload: summary });

    const activity: Activity = {
      ...summary,
      cooperator,
      financials: {
        total_projected: 0,
        total_actual: 0,
        total_committed: 0,
        projected_only_total: 0,
        total_income_actual: 0,
        total_income_projected: 0,
        total_income_committed: 0,
        net_actual: 0,
        net_committed: 0,
        available_budget: data.budget,
        net_available_budget: data.budget,
        utilization_percent: 0,
        committed_percent: 0,
        budget_status: 'under',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return activity;
  }, [state.nextId, state.cooperators]);

  const updateActivity = useCallback(async (
    activityId: number,
    data: UpdateActivityInput
  ): Promise<Activity | null> => {
    const existing = state.activities.find(a => a.id === activityId);
    if (!existing) return null;

    const cooperatorName = data.cooperator_id
      ? state.cooperators.find(c => c.id === data.cooperator_id)?.name || existing.cooperator_name
      : existing.cooperator_name;

    dispatch({
      type: 'UPDATE_ACTIVITY',
      payload: {
        id: activityId,
        updates: {
          ...data,
          cooperator_name: cooperatorName,
        } as Partial<ActivitySummary>,
      },
    });

    // Return full Activity object
    const updated = { ...existing, ...data, cooperator_name: cooperatorName };
    const cooperator = state.cooperators.find(c => c.id === updated.cooperator_id) || null;
    const expenses = state.allExpenses[activityId] || [];
    const income = state.allIncome[activityId] || [];
    const financials = computeFinancials(updated, expenses, income);

    return {
      ...updated,
      cooperator,
      financials,
      created_at: null,
      updated_at: new Date().toISOString(),
    };
  }, [state.activities, state.cooperators, state.allExpenses, state.allIncome]);

  const createExpense = useCallback(async (
    activityId: number,
    data: CreateExpenseInput
  ): Promise<Expense | null> => {
    const category = state.categories.find(c => c.id === data.category_id);
    const now = new Date().toISOString();

    let status: 'projected' | 'actual' | 'partial' = 'projected';
    if (data.actual_amount && data.projected_amount) status = 'partial';
    else if (data.actual_amount) status = 'actual';

    const expense: Expense = {
      id: state.nextId,
      activity_id: activityId,
      category_id: data.category_id,
      category_name: category?.name || 'Unknown',
      description: data.description,
      projected_amount: data.projected_amount ?? null,
      projected_date: data.projected_date ?? null,
      actual_amount: data.actual_amount ?? null,
      actual_date: data.actual_date ?? null,
      status,
      receipt_reference: data.receipt_reference ?? null,
      notes: data.notes ?? null,
      participants: [],
      created_at: now,
      updated_at: now,
    };

    dispatch({ type: 'ADD_EXPENSE', payload: { activityId, expense } });

    // Recompute activity financials
    const activity = state.activities.find(a => a.id === activityId);
    if (activity) {
      const allExp = [...(state.allExpenses[activityId] || []), expense];
      const allInc = state.allIncome[activityId] || [];
      const financials = computeFinancials(activity, allExp, allInc);

      dispatch({
        type: 'UPDATE_ACTIVITY',
        payload: {
          id: activityId,
          updates: {
            total_actual: financials.total_actual,
            total_committed: financials.total_committed,
            net_committed: financials.net_committed,
            available_budget: financials.available_budget,
            budget_status: financials.budget_status,
          },
        },
      });
    }

    return expense;
  }, [state.nextId, state.categories, state.activities, state.allExpenses, state.allIncome]);

  const linkAccount = useCallback(async (_username: string, _password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LINKED', payload: true });
    return true;
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const loadSampleData = useCallback(() => {
    const sampleState: PersistedState = {
      activities: sampleActivities,
      allExpenses: sampleExpenses,
      allIncome: sampleIncome,
      cooperators: sampleCooperators,
      categories: sampleCategories,
      nextId: INITIAL_NEXT_ID,
    };
    dispatch({ type: 'LOAD_STATE', payload: sampleState });
  }, []);

  const exportToJSON = useCallback((): string => {
    const data: PersistedState = {
      activities: state.activities,
      allExpenses: state.allExpenses,
      allIncome: state.allIncome,
      cooperators: state.cooperators,
      categories: state.categories,
      nextId: state.nextId,
    };
    return JSON.stringify(data, null, 2);
  }, [state.activities, state.allExpenses, state.allIncome, state.cooperators, state.categories, state.nextId]);

  const importFromJSON = useCallback((json: string): boolean => {
    try {
      const data: PersistedState = JSON.parse(json);
      if (!data.activities || !data.cooperators || !data.categories) return false;
      dispatch({ type: 'LOAD_STATE', payload: data });
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <BudgetContext.Provider
      value={{
        ...state,
        loadActivities,
        loadActivity,
        loadActivityByCdfaId,
        loadExpenses,
        loadIncome,
        loadDashboard,
        createActivity,
        updateActivity,
        createExpense,
        linkAccount,
        clearError,
        loadSampleData,
        exportToJSON,
        importFromJSON,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
}
