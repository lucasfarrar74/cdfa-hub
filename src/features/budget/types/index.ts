// Budget Tracker Types - matching the Flask API responses

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  firebase_uid: string | null;
  created_at: string | null;
  last_login: string | null;
}

export interface Cooperator {
  id: number;
  name: string;
  full_name: string | null;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface Participant {
  id: number;
  name: string;
  email: string | null;
  organization: string | null;
  activity_id: number | null;
  is_archived: boolean;
  created_at: string;
}

export interface CreateParticipantInput {
  name: string;
  email?: string;
  organization?: string;
  activity_id?: number | null;
}

export interface Expense {
  id: number;
  activity_id: number;
  category_id: number;
  category_name: string;
  description: string;
  projected_amount: number | null;
  projected_date: string | null;
  actual_amount: number | null;
  actual_date: string | null;
  status: 'projected' | 'actual' | 'partial';
  receipt_reference: string | null;
  notes: string | null;
  participants: Participant[];
  created_at: string;
  updated_at: string;
}

export interface Income {
  id: number;
  activity_id: number;
  description: string;
  source: string | null;
  projected_amount: number | null;
  projected_date: string | null;
  actual_amount: number | null;
  actual_date: string | null;
  status: 'projected' | 'actual' | 'partial';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityFinancials {
  total_projected: number;
  total_actual: number;
  total_committed: number;
  projected_only_total: number;
  total_income_actual: number;
  total_income_projected: number;
  total_income_committed: number;
  net_actual: number;
  net_committed: number;
  available_budget: number;
  net_available_budget: number;
  utilization_percent: number;
  committed_percent: number;
  budget_status: 'under' | 'near' | 'over';
}

export interface ActivitySummary {
  id: number;
  name: string;
  description: string | null;
  cooperator_id: number;
  cooperator_name: string | null;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  status: 'planning' | 'active' | 'completed';
  location: string | null;
  cdfa_activity_id: string | null;
  total_actual: number;
  total_committed: number;
  net_committed: number;
  available_budget: number;
  budget_status: 'under' | 'near' | 'over';
}

export interface Activity extends Omit<ActivitySummary, 'cooperator_name'> {
  cooperator: Cooperator | null;
  created_at: string | null;
  updated_at: string | null;
  financials: ActivityFinancials;
}

export interface DashboardSummary {
  total_activities: number;
  active_activities: number;
  total_budget: number;
  total_spent: number;
  total_committed: number;
  budget_remaining: number;
  recent_activities: ActivitySummary[];
}

export interface CreateActivityInput {
  name: string;
  description?: string;
  cooperator_id: number;
  budget: number;
  start_date?: string;
  end_date?: string;
  status?: 'planning' | 'active' | 'completed';
  location?: string;
  cdfa_activity_id?: string;
}

export interface UpdateActivityInput extends Partial<CreateActivityInput> {}

export interface CreateExpenseInput {
  category_id: number;
  description: string;
  projected_amount?: number;
  projected_date?: string;
  actual_amount?: number;
  actual_date?: string;
  receipt_reference?: string;
  notes?: string;
  participant_ids?: number[];
}

export interface CreateIncomeInput {
  description: string;
  source?: string;
  projected_amount?: number;
  projected_date?: string;
  actual_amount?: number;
  actual_date?: string;
  notes?: string;
}

export interface UpdateExpenseInput extends Partial<CreateExpenseInput> {}

export interface UpdateIncomeInput extends Partial<CreateIncomeInput> {}

export interface ExpenseTemplate {
  id: number;
  name: string;
  category_id: number;
  description: string;
  default_amount: number;
  notes: string;
}

export type BudgetStatus = 'under' | 'near' | 'over';
export type ActivityStatus = 'planning' | 'active' | 'completed';
export type ExpenseStatus = 'projected' | 'actual' | 'partial';
