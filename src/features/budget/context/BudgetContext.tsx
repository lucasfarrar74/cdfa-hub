import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from '../../../context/AuthContext';
import * as api from '../services/api';
import type {
  ActivitySummary,
  Activity,
  Expense,
  Income,
  Cooperator,
  ExpenseCategory,
  DashboardSummary,
  CreateActivityInput,
  UpdateActivityInput,
  CreateExpenseInput,
} from '../types';

// State
interface BudgetState {
  activities: ActivitySummary[];
  currentActivity: Activity | null;
  expenses: Expense[];
  income: Income[];
  cooperators: Cooperator[];
  categories: ExpenseCategory[];
  dashboardSummary: DashboardSummary | null;
  isLoading: boolean;
  isLinked: boolean;
  error: string | null;
}

// Actions
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
  | { type: 'UPDATE_ACTIVITY'; payload: Activity }
  | { type: 'ADD_EXPENSE'; payload: Expense };

const initialState: BudgetState = {
  activities: [],
  currentActivity: null,
  expenses: [],
  income: [],
  cooperators: [],
  categories: [],
  dashboardSummary: null,
  isLoading: false,
  isLinked: false,
  error: null,
};

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
      return { ...state, activities: [...state.activities, action.payload] };
    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        currentActivity: action.payload,
        activities: state.activities.map(a =>
          a.id === action.payload.id
            ? { ...a, ...action.payload }
            : a
        ),
      };
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload] };
    default:
      return state;
  }
}

// Context
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
}

const BudgetContext = createContext<BudgetContextType | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(budgetReducer, initialState);
  const { idToken } = useAuth();

  // Check if user is linked on mount
  useEffect(() => {
    async function checkLink() {
      if (!idToken) {
        dispatch({ type: 'SET_LINKED', payload: false });
        return;
      }

      try {
        await api.getCurrentUser(idToken);
        dispatch({ type: 'SET_LINKED', payload: true });
      } catch {
        dispatch({ type: 'SET_LINKED', payload: false });
      }
    }
    checkLink();
  }, [idToken]);

  // Load reference data when linked
  useEffect(() => {
    async function loadReferenceData() {
      if (!idToken || !state.isLinked) return;

      try {
        const [cooperators, categories] = await Promise.all([
          api.getCooperators(idToken),
          api.getCategories(idToken),
        ]);
        dispatch({ type: 'SET_COOPERATORS', payload: cooperators });
        dispatch({ type: 'SET_CATEGORIES', payload: categories });
      } catch (err) {
        console.error('Failed to load reference data:', err);
      }
    }
    loadReferenceData();
  }, [idToken, state.isLinked]);

  const loadActivities = useCallback(async () => {
    if (!idToken) return;
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const activities = await api.getActivities(idToken);
      dispatch({ type: 'SET_ACTIVITIES', payload: activities });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to load activities' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [idToken]);

  const loadActivity = useCallback(async (activityId: number) => {
    if (!idToken) return;
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const activity = await api.getActivity(idToken, activityId);
      dispatch({ type: 'SET_CURRENT_ACTIVITY', payload: activity });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to load activity' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [idToken]);

  const loadActivityByCdfaId = useCallback(async (cdfaId: string) => {
    if (!idToken) return;
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const activity = await api.getActivityByCdfaId(idToken, cdfaId);
      dispatch({ type: 'SET_CURRENT_ACTIVITY', payload: activity });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to load activity' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [idToken]);

  const loadExpenses = useCallback(async (activityId: number) => {
    if (!idToken) return;

    try {
      const expenses = await api.getExpenses(idToken, activityId);
      dispatch({ type: 'SET_EXPENSES', payload: expenses });
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
  }, [idToken]);

  const loadIncome = useCallback(async (activityId: number) => {
    if (!idToken) return;

    try {
      const income = await api.getIncome(idToken, activityId);
      dispatch({ type: 'SET_INCOME', payload: income });
    } catch (err) {
      console.error('Failed to load income:', err);
    }
  }, [idToken]);

  const loadDashboard = useCallback(async () => {
    if (!idToken) return;
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const summary = await api.getDashboardSummary(idToken);
      dispatch({ type: 'SET_DASHBOARD_SUMMARY', payload: summary });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to load dashboard' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [idToken]);

  const createActivity = useCallback(async (data: CreateActivityInput): Promise<Activity | null> => {
    if (!idToken) return null;

    try {
      const activity = await api.createActivity(idToken, data);
      dispatch({
        type: 'ADD_ACTIVITY',
        payload: {
          id: activity.id,
          name: activity.name,
          description: activity.description,
          cooperator_id: activity.cooperator_id,
          cooperator_name: activity.cooperator?.name || null,
          budget: activity.budget,
          start_date: activity.start_date,
          end_date: activity.end_date,
          status: activity.status,
          location: activity.location,
          cdfa_activity_id: activity.cdfa_activity_id,
          total_actual: activity.financials.total_actual,
          total_committed: activity.financials.total_committed,
          net_committed: activity.financials.net_committed,
          available_budget: activity.financials.available_budget,
          budget_status: activity.financials.budget_status,
        },
      });
      return activity;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to create activity' });
      return null;
    }
  }, [idToken]);

  const updateActivity = useCallback(async (
    activityId: number,
    data: UpdateActivityInput
  ): Promise<Activity | null> => {
    if (!idToken) return null;

    try {
      const activity = await api.updateActivity(idToken, activityId, data);
      dispatch({ type: 'UPDATE_ACTIVITY', payload: activity });
      return activity;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to update activity' });
      return null;
    }
  }, [idToken]);

  const createExpense = useCallback(async (
    activityId: number,
    data: CreateExpenseInput
  ): Promise<Expense | null> => {
    if (!idToken) return null;

    try {
      const expense = await api.createExpense(idToken, activityId, data);
      dispatch({ type: 'ADD_EXPENSE', payload: expense });
      // Reload activity to update financials
      loadActivity(activityId);
      return expense;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to create expense' });
      return null;
    }
  }, [idToken, loadActivity]);

  const linkAccount = useCallback(async (username: string, password: string): Promise<boolean> => {
    if (!idToken) return false;

    try {
      await api.linkAccount(idToken, username, password);
      dispatch({ type: 'SET_LINKED', payload: true });
      return true;
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to link account' });
      return false;
    }
  }, [idToken]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
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
