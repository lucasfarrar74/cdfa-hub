/**
 * Budget Tracker API Service
 *
 * Calls the Flask backend API with Firebase authentication.
 */

import type {
  User,
  Activity,
  ActivitySummary,
  Expense,
  Income,
  Cooperator,
  ExpenseCategory,
  DashboardSummary,
  CreateActivityInput,
  UpdateActivityInput,
  CreateExpenseInput,
  CreateIncomeInput,
} from '../types';

// API base URL - uses environment variable or defaults
const API_BASE_URL = import.meta.env.VITE_BUDGET_TRACKER_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'https://cdfa-budget-tracker.vercel.app');

class BudgetApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BudgetApiError';
    this.status = status;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new BudgetApiError(errorData.error || `HTTP ${response.status}`, response.status);
  }

  return response.json();
}

// ========== User Endpoints ==========

export async function getCurrentUser(token: string): Promise<User> {
  return apiRequest<User>('/api/me', {}, token);
}

export async function linkAccount(
  token: string,
  username: string,
  password: string
): Promise<{ message: string; user: User }> {
  return apiRequest('/api/link-account', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }, token);
}

// ========== Activity Endpoints ==========

export async function getActivities(token: string): Promise<ActivitySummary[]> {
  return apiRequest<ActivitySummary[]>('/api/activities', {}, token);
}

export async function getActivity(token: string, activityId: number): Promise<Activity> {
  return apiRequest<Activity>(`/api/activities/${activityId}`, {}, token);
}

export async function getActivityByCdfaId(token: string, cdfaId: string): Promise<Activity> {
  return apiRequest<Activity>(`/api/activities/by-cdfa-id/${cdfaId}`, {}, token);
}

export async function createActivity(
  token: string,
  data: CreateActivityInput
): Promise<Activity> {
  return apiRequest<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
}

export async function updateActivity(
  token: string,
  activityId: number,
  data: UpdateActivityInput
): Promise<Activity> {
  return apiRequest<Activity>(`/api/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
}

// ========== Expense Endpoints ==========

export async function getExpenses(token: string, activityId: number): Promise<Expense[]> {
  return apiRequest<Expense[]>(`/api/activities/${activityId}/expenses`, {}, token);
}

export async function createExpense(
  token: string,
  activityId: number,
  data: CreateExpenseInput
): Promise<Expense> {
  return apiRequest<Expense>(`/api/activities/${activityId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
}

// ========== Income Endpoints ==========

export async function getIncome(token: string, activityId: number): Promise<Income[]> {
  return apiRequest<Income[]>(`/api/activities/${activityId}/income`, {}, token);
}

// ========== Reference Data Endpoints ==========

export async function getCooperators(token: string): Promise<Cooperator[]> {
  return apiRequest<Cooperator[]>('/api/cooperators', {}, token);
}

export async function getCategories(token: string): Promise<ExpenseCategory[]> {
  return apiRequest<ExpenseCategory[]>('/api/categories', {}, token);
}

// ========== Dashboard Endpoints ==========

export async function getDashboardSummary(token: string): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>('/api/dashboard/summary', {}, token);
}

// ========== Health Check ==========

export async function checkHealth(): Promise<{ status: string; message: string }> {
  return apiRequest('/api/health');
}

export { BudgetApiError };
