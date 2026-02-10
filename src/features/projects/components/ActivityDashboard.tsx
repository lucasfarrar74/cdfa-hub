import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useProjects } from '../context/ProjectsContext';
import { useCrossToolData } from '../hooks/useCrossToolData';
import { getActivityCategory } from '../types';
import type { TradeActivity, EducationalActivity, ConsultationActivity, ActivityStatus, ActivityLocation } from '../types';
import ChecklistPanel from './ChecklistPanel';

interface ActivityDashboardProps {
  activityId: string;
  onBack: () => void;
}

type TabType = 'dashboard' | 'details' | 'checklist' | 'notes';

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  green: '#22c55e',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  gray: '#6b7280',
};

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function getStatusColor(status: ActivityStatus): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';
    case 'planning':
      return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
    case 'in_progress':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
    case 'completed':
      return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
    case 'cancelled':
      return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
    case 'postponed':
      return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600';
  }
}

function getStatusLabel(status: ActivityStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'planning': return 'Planning';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'postponed': return 'Postponed';
    default: return status;
  }
}

export default function ActivityDashboard({ activityId, onBack }: ActivityDashboardProps) {
  const {
    activities,
    updateActivity,
    deleteActivity: ctxDeleteActivity,
    archiveActivity,
    unarchiveActivity,
    getChecklistForActivity,
    getActivityTypeInfo,
    customActivityTypes,
    procedureTemplates,
  } = useProjects();

  const crossToolData = useCrossToolData(activityId);

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activity = activities.find((a) => a.id === activityId);
  const checklist = getChecklistForActivity(activityId);

  const activityTypeInfo = activity ? getActivityTypeInfo(activity.activityType) : null;
  const activityCategory = activity ? getActivityCategory(activity.activityType, customActivityTypes) : 'other';
  const isTradeActivity = activityCategory === 'trade';
  const isEducationalActivity = activityCategory === 'educational';
  const isConsultationActivity = activityCategory === 'consultation';

  const tradeActivity = activity as TradeActivity;
  const eduActivity = activity as EducationalActivity;
  const consultActivity = activity as ConsultationActivity;

  // Dashboard computations
  const daysUntilStart = useMemo(() => {
    if (!activity?.startDate) return null;
    try {
      const start = startOfDay(parseISO(activity.startDate));
      const today = startOfDay(new Date());
      return differenceInDays(start, today);
    } catch {
      return null;
    }
  }, [activity?.startDate]);

  const checklistProgress = useMemo(() => {
    if (!checklist || checklist.totalCount === 0) return null;
    return Math.round((checklist.completedCount / checklist.totalCount) * 100);
  }, [checklist]);

  const linkedToolsCount = useMemo(() => {
    let count = 0;
    if (crossToolData.budget) count++;
    if (crossToolData.scheduler) count++;
    return count;
  }, [crossToolData.budget, crossToolData.scheduler]);

  const procedureTemplate = useMemo(() => {
    if (!activity?.procedureTemplateId) return null;
    return procedureTemplates.find((t) => t.id === activity.procedureTemplateId) || null;
  }, [activity?.procedureTemplateId, procedureTemplates]);

  const phaseProgress = useMemo(() => {
    if (!procedureTemplate || !checklist) return null;
    return procedureTemplate.phases
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((phase) => {
        const phaseItems = checklist.items.filter((item) => item.phaseId === phase.id);
        const completedInPhase = phaseItems.filter((item) => item.status === 'completed').length;
        return {
          id: phase.id,
          name: phase.name,
          total: phaseItems.length,
          completed: completedInPhase,
          isComplete: phaseItems.length > 0 && completedInPhase === phaseItems.length,
        };
      });
  }, [procedureTemplate, checklist]);

  const currentPhaseIndex = useMemo(() => {
    if (!phaseProgress) return -1;
    const idx = phaseProgress.findIndex((p) => !p.isComplete);
    return idx === -1 ? phaseProgress.length - 1 : idx;
  }, [phaseProgress]);

  const upcomingTasks = useMemo(() => {
    if (!checklist) return [];
    return checklist.items
      .filter((item) => item.status !== 'completed' && item.status !== 'skipped')
      .filter((item) => item.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [checklist]);

  if (!activity || !activityTypeInfo) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Activity not found
      </div>
    );
  }

  const colorHex = COLOR_MAP[activityTypeInfo.color] || COLOR_MAP.gray;

  const handleStatusChange = (newStatus: ActivityStatus) => {
    updateActivity(activityId, { status: newStatus });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFieldChange = (field: string, value: any) => {
    updateActivity(activityId, { [field]: value });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    ctxDeleteActivity(activityId);
    onBack();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {isEditing ? 'Done' : 'Edit'}
            </button>
            {activity.isArchived ? (
              <button
                onClick={() => unarchiveActivity(activityId)}
                className="px-3 py-1.5 text-sm border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Unarchive
              </button>
            ) : (
              <button
                onClick={() => archiveActivity(activityId)}
                className="px-3 py-1.5 text-sm border border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Archive
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Activity Name */}
        {isEditing ? (
          <input
            type="text"
            value={activity.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            className="text-xl font-bold w-full border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none pb-1 bg-transparent text-gray-900 dark:text-gray-100"
          />
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{activity.name}</h2>
            {activity.isArchived && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded">
                Archived
              </span>
            )}
          </div>
        )}

        {/* Type badge + status */}
        <div className="flex items-center gap-3 mt-2 text-sm">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: colorHex }}
          />
          <span className="text-gray-600 dark:text-gray-400">
            {activityTypeInfo.name}
          </span>
        </div>

        {/* Status selector */}
        <div className="mt-3">
          <select
            value={activity.status}
            onChange={(e) => handleStatusChange(e.target.value as ActivityStatus)}
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${getStatusColor(activity.status)}`}
          >
            <option value="draft">Draft</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
          </select>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex px-4 sm:px-6">
          {(['dashboard', 'details', 'checklist', 'notes'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'checklist' && checklist && (
                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  {checklist.completedCount}/{checklist.totalCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* ==================== DASHBOARD TAB ==================== */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(activity.status)}`}>
                    {getStatusLabel(activity.status)}
                  </span>
                </div>

                {/* Days until start */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Days Until Start</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {daysUntilStart === null
                      ? 'N/A'
                      : daysUntilStart <= 0
                      ? 'Started'
                      : daysUntilStart}
                  </p>
                </div>

                {/* Checklist progress */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Checklist Progress</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {checklistProgress !== null ? `${checklistProgress}%` : 'N/A'}
                  </p>
                </div>

                {/* Linked tools */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Linked Tools</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{linkedToolsCount}</p>
                </div>
              </div>

              {/* Procedure Progress */}
              {phaseProgress && phaseProgress.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Procedure Progress</h3>
                  <div className="space-y-3">
                    {phaseProgress.map((phase, index) => {
                      const isCurrent = index === currentPhaseIndex;
                      return (
                        <div
                          key={phase.id}
                          className={`flex items-center gap-3 p-2 rounded-lg ${
                            isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700' : ''
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              phase.isComplete
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                : isCurrent
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {phase.isComplete ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              index + 1
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${
                              isCurrent ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                              {phase.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {phase.completed} / {phase.total} tasks
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming Tasks */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Upcoming Tasks</h3>
                {upcomingTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming tasks.</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingTasks.map((task) => {
                      const today = startOfDay(new Date());
                      const dueDay = startOfDay(parseISO(task.dueDate));
                      const daysUntilDue = differenceInDays(dueDay, today);
                      const isOverdue = daysUntilDue < 0;
                      const isDueSoon = !isOverdue && daysUntilDue <= 7;

                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${
                            isOverdue
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : isDueSoon
                              ? 'bg-yellow-50 dark:bg-yellow-900/20'
                              : 'bg-gray-50 dark:bg-gray-700/50'
                          }`}
                        >
                          <span className={`text-sm font-medium truncate ${
                            isOverdue
                              ? 'text-red-700 dark:text-red-300'
                              : isDueSoon
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {task.title}
                          </span>
                          <span className={`text-xs flex-shrink-0 ml-2 px-2 py-0.5 rounded ${
                            isOverdue
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                              : isDueSoon
                              ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                              : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                          }`}>
                            {format(parseISO(task.dueDate), 'MMM d')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Budget Summary */}
              {crossToolData.budget && (() => {
                const { budgetAmount, committed, actual, available } = crossToolData.budget;
                const spentPercent = budgetAmount > 0 ? Math.min((actual / budgetAmount) * 100, 100) : 0;
                const committedPercent = budgetAmount > 0 ? Math.min((committed / budgetAmount) * 100, 100 - spentPercent) : 0;
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Budget Summary</h3>
                    {/* Bold stat row */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{currencyFormat.format(budgetAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Actual Spent</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{currencyFormat.format(actual)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                        <p className={`text-lg font-bold ${available < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {currencyFormat.format(available)}
                        </p>
                      </div>
                    </div>
                    {/* Stacked progress bar */}
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 flex overflow-hidden">
                      <div className="bg-emerald-500 h-3 transition-all" style={{ width: `${spentPercent}%` }} />
                      <div className="bg-blue-500 h-3 transition-all" style={{ width: `${committedPercent}%` }} />
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Spent</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Committed</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" /> Remaining</span>
                    </div>
                    {/* Detail rows */}
                    <div className="space-y-1.5 text-sm mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Budget</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{currencyFormat.format(budgetAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Committed</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{currencyFormat.format(committed)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Actual</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{currencyFormat.format(actual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Available</span>
                        <span className={`font-medium ${available < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {currencyFormat.format(available)}
                        </span>
                      </div>
                    </div>
                    <a href="/budget-tracker" className="block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      View in Budget Tracker
                    </a>
                  </div>
                );
              })()}

              {/* Meetings Summary */}
              {crossToolData.scheduler && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Meetings Summary</h3>
                  {/* Bold stat row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Meetings</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{crossToolData.scheduler.meetingCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Suppliers</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{crossToolData.scheduler.supplierCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Buyers</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{crossToolData.scheduler.buyerCount}</p>
                    </div>
                  </div>
                  <a href="/meeting-scheduler" className="block mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    View in Meeting Scheduler
                  </a>
                </div>
              )}

              {/* Activity Info */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Activity Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Type</span>
                    <span className="text-gray-900 dark:text-gray-100">{activityTypeInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Location</span>
                    <span className="text-gray-900 dark:text-gray-100">{activity.location || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Start Date</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {activity.startDate ? format(parseISO(activity.startDate), 'MMM d, yyyy') : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">End Date</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {activity.endDate ? format(parseISO(activity.endDate), 'MMM d, yyyy') : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Fiscal Year</span>
                    <span className="text-gray-900 dark:text-gray-100">{activity.fiscalYear}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== DETAILS TAB ==================== */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Dates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={activity.startDate}
                      onChange={(e) => handleFieldChange('startDate', e.target.value)}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {activity.startDate
                        ? format(parseISO(activity.startDate), 'MMMM d, yyyy')
                        : 'Not set'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={activity.endDate}
                      onChange={(e) => handleFieldChange('endDate', e.target.value)}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">
                      {activity.endDate
                        ? format(parseISO(activity.endDate), 'MMMM d, yyyy')
                        : 'Not set'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Description</h3>
              {isEditing ? (
                <textarea
                  value={activity.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  rows={4}
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Add a description..."
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {activity.description || 'No description'}
                </p>
              )}
            </div>

            {/* Location & Stops */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Locations / Stops</h3>
                {isEditing && (
                  <button
                    onClick={() => {
                      const newLocation: ActivityLocation = {
                        id: uuidv4(),
                        city: '',
                        country: '',
                        venue: '',
                        notes: '',
                      };
                      handleFieldChange('locations', [...(activity.locations || []), newLocation]);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Stop
                  </button>
                )}
              </div>

              {/* Location Type */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Location Type</label>
                {isEditing ? (
                  <select
                    value={activity.locationType}
                    onChange={(e) => handleFieldChange('locationType', e.target.value)}
                    className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="domestic">Domestic (US)</option>
                    <option value="international">International</option>
                    <option value="virtual">Virtual</option>
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-gray-100 capitalize">{activity.locationType}</p>
                )}
              </div>

              {/* Primary Location */}
              {(!activity.locations || activity.locations.length === 0) && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Primary Location</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={activity.location}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., Tokyo, Japan or San Francisco, CA"
                    />
                  ) : (
                    <p className="text-gray-900 dark:text-gray-100">{activity.location || 'Not specified'}</p>
                  )}
                </div>
              )}

              {/* Multiple Stops */}
              {activity.locations && activity.locations.length > 0 && (
                <div className="space-y-3">
                  {activity.locations.map((loc, index) => (
                    <div
                      key={loc.id}
                      className="border dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Stop {index + 1}
                        </span>
                        {isEditing && (
                          <button
                            onClick={() => {
                              const updated = activity.locations.filter((l) => l.id !== loc.id);
                              handleFieldChange('locations', updated);
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={loc.city}
                            onChange={(e) => {
                              const updated = activity.locations.map((l) =>
                                l.id === loc.id ? { ...l, city: e.target.value } : l
                              );
                              handleFieldChange('locations', updated);
                            }}
                            className="border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                            placeholder="City"
                          />
                          <input
                            type="text"
                            value={loc.country}
                            onChange={(e) => {
                              const updated = activity.locations.map((l) =>
                                l.id === loc.id ? { ...l, country: e.target.value } : l
                              );
                              handleFieldChange('locations', updated);
                            }}
                            className="border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                            placeholder="Country"
                          />
                          <input
                            type="text"
                            value={loc.venue || ''}
                            onChange={(e) => {
                              const updated = activity.locations.map((l) =>
                                l.id === loc.id ? { ...l, venue: e.target.value } : l
                              );
                              handleFieldChange('locations', updated);
                            }}
                            className="border dark:border-gray-600 rounded px-2 py-1.5 text-sm col-span-2 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                            placeholder="Venue (optional)"
                          />
                          <input
                            type="date"
                            value={loc.startDate || ''}
                            onChange={(e) => {
                              const updated = activity.locations.map((l) =>
                                l.id === loc.id ? { ...l, startDate: e.target.value } : l
                              );
                              handleFieldChange('locations', updated);
                            }}
                            className="border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                          />
                          <input
                            type="date"
                            value={loc.endDate || ''}
                            onChange={(e) => {
                              const updated = activity.locations.map((l) =>
                                l.id === loc.id ? { ...l, endDate: e.target.value } : l
                              );
                              handleFieldChange('locations', updated);
                            }}
                            className="border dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {loc.city}{loc.country ? `, ${loc.country}` : ''}
                          </p>
                          {loc.venue && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{loc.venue}</p>
                          )}
                          {(loc.startDate || loc.endDate) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {loc.startDate && format(parseISO(loc.startDate), 'MMM d')}
                              {loc.startDate && loc.endDate && ' - '}
                              {loc.endDate && format(parseISO(loc.endDate), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trade Details */}
            {isTradeActivity && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Trade Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Target Market</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={tradeActivity.targetMarket}
                        onChange={(e) => handleFieldChange('targetMarket', e.target.value)}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Japan, Southeast Asia"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">{tradeActivity.targetMarket || 'Not specified'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Commodities</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={tradeActivity.commodities?.join(', ') || ''}
                        onChange={(e) =>
                          handleFieldChange(
                            'commodities',
                            e.target.value.split(',').map((s) => s.trim())
                          )
                        }
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Almonds, Wine, Dairy"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">
                        {tradeActivity.commodities?.join(', ') || 'Not specified'}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Suppliers</label>
                      <p className="text-gray-900 dark:text-gray-100">{tradeActivity.suppliers?.length || 0}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Buyers</label>
                      <p className="text-gray-900 dark:text-gray-100">{tradeActivity.buyers?.length || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Educational Details */}
            {isEducationalActivity && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Educational Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Topic</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={eduActivity.topic}
                        onChange={(e) => handleFieldChange('topic', e.target.value)}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Export Regulations Overview"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">{eduActivity.topic || 'Not specified'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Target Audience</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={eduActivity.targetAudience?.join(', ') || ''}
                        onChange={(e) =>
                          handleFieldChange(
                            'targetAudience',
                            e.target.value.split(',').map((s) => s.trim())
                          )
                        }
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Exporters, Producers, Processors"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">
                        {eduActivity.targetAudience?.join(', ') || 'Not specified'}
                      </p>
                    )}
                  </div>
                  {eduActivity.seriesInfo && (
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Series Info</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        Session {eduActivity.seriesInfo.currentSession || 1} of {eduActivity.seriesInfo.totalSessions}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Registered</label>
                      <p className="text-gray-900 dark:text-gray-100">{eduActivity.registeredCount || 0}</p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Attended</label>
                      <p className="text-gray-900 dark:text-gray-100">{eduActivity.attendedCount || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Consultation Details */}
            {isConsultationActivity && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Consultation Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Client</label>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={consultActivity.clientName || ''}
                          onChange={(e) => handleFieldChange('clientName', e.target.value)}
                          className="border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Contact Name"
                        />
                        <input
                          type="text"
                          value={consultActivity.clientOrganization || ''}
                          onChange={(e) => handleFieldChange('clientOrganization', e.target.value)}
                          className="border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          placeholder="Organization"
                        />
                      </div>
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">
                        {consultActivity.clientName || 'Not specified'}
                        {consultActivity.clientOrganization && ` - ${consultActivity.clientOrganization}`}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Topics Discussed</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={consultActivity.topics?.join(', ') || ''}
                        onChange={(e) =>
                          handleFieldChange(
                            'topics',
                            e.target.value.split(',').map((s) => s.trim())
                          )
                        }
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="e.g., Market Entry, Regulations, Pricing"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-100">
                        {consultActivity.topics?.join(', ') || 'Not specified'}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Type</label>
                      <p className="text-gray-900 dark:text-gray-100 capitalize">
                        {consultActivity.consultationType?.replace('_', ' ') || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Duration</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {consultActivity.duration ? `${consultActivity.duration} min` : 'Not specified'}
                      </p>
                    </div>
                  </div>
                  {consultActivity.followUpRequired && consultActivity.followUpDate && (
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Follow-up Date</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {format(parseISO(consultActivity.followUpDate), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Metadata</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <p>Fiscal Year: {activity.fiscalYear}</p>
                <p>Created: {format(parseISO(activity.createdAt), 'MMM d, yyyy h:mm a')}</p>
                <p>Updated: {format(parseISO(activity.updatedAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
          </div>
        )}

        {/* ==================== CHECKLIST TAB ==================== */}
        {activeTab === 'checklist' && <ChecklistPanel activityId={activityId} />}

        {/* ==================== NOTES TAB ==================== */}
        {activeTab === 'notes' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Notes</h3>
            <textarea
              value={activity.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              rows={10}
              className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Add notes about this activity..."
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-900/50 p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Activity</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Are you sure you want to delete <strong>&quot;{activity.name}&quot;</strong>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              All associated checklists and data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Activity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
