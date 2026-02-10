import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useProjects } from '../context/ProjectsContext';
import type { ChecklistItem, ChecklistItemStatus } from '../types';
import { getTasksByPhase, getPhaseStatus, formatDueDateWithStatus } from '../utils/reminderScheduler';

interface ChecklistPanelProps {
  activityId: string;
}

export default function ChecklistPanel({ activityId }: ChecklistPanelProps) {
  const { getChecklistForActivity, updateChecklistItem, procedureTemplates, activities } = useProjects();

  const activity = activities.find((a) => a.id === activityId);
  const checklist = getChecklistForActivity(activityId);
  const template = procedureTemplates.find((t) => t.id === activity?.procedureTemplateId);

  const phaseData = useMemo(() => {
    if (!checklist || !template) return null;
    return getTasksByPhase(checklist, template);
  }, [checklist, template]);

  if (!checklist || !template || !phaseData) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p>No checklist available for this activity.</p>
        <p className="text-sm mt-2">Set a start date to generate the checklist.</p>
      </div>
    );
  }

  const handleStatusChange = (itemId: string, newStatus: ChecklistItemStatus) => {
    const updates: Partial<ChecklistItem> = { status: newStatus };
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    updateChecklistItem(checklist.id, itemId, updates);
  };

  const getStatusIcon = (status: ChecklistItemStatus) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
      case 'blocked':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getPhaseStatusBadge = (status: 'not_started' | 'in_progress' | 'completed') => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded-full">Complete</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full">In Progress</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">Not Started</span>;
    }
  };

  const progress = Math.round((checklist.completedCount / checklist.totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* Progress overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {checklist.completedCount} / {checklist.totalCount} tasks
          </span>
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        {checklist.overdueCount > 0 && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {checklist.overdueCount} task{checklist.overdueCount !== 1 ? 's' : ''} overdue
          </div>
        )}
      </div>

      {/* Phases */}
      {Array.from(phaseData.entries()).map(([phaseId, { phase, items }]) => {
        const phaseStatus = getPhaseStatus(items);

        return (
          <div key={phaseId} className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
            {/* Phase header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">{phase.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{phase.description}</p>
              </div>
              {getPhaseStatusBadge(phaseStatus)}
            </div>

            {/* Tasks */}
            <div className="divide-y dark:divide-gray-700">
              {items.map((item) => {
                const dueDateInfo = formatDueDateWithStatus(item.dueDate);

                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      dueDateInfo.status === 'overdue' && item.status !== 'completed' && item.status !== 'skipped'
                        ? 'bg-red-50 dark:bg-red-900/30'
                        : ''
                    }`}
                  >
                    {/* Status toggle */}
                    <button
                      onClick={() => {
                        const newStatus: ChecklistItemStatus =
                          item.status === 'completed' || item.status === 'skipped'
                            ? 'not_started'
                            : 'completed';
                        handleStatusChange(item.id, newStatus);
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {getStatusIcon(item.status)}
                    </button>

                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`font-medium ${
                            item.status === 'completed' || item.status === 'skipped'
                              ? 'text-gray-400 dark:text-gray-500 line-through'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {item.title}
                          {item.isRequired && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            dueDateInfo.status === 'overdue'
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                              : dueDateInfo.status === 'today'
                              ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                              : dueDateInfo.status === 'upcoming'
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {dueDateInfo.text}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{item.category}</span>
                        {item.requiresApproval && (
                          <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                            Requires approval
                          </span>
                        )}
                        {item.completedAt && (
                          <span>Completed {format(parseISO(item.completedAt), 'MMM d')}</span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex-shrink-0">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as ChecklistItemStatus)}
                        className="text-xs border dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
