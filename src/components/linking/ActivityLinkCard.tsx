import { Link } from 'react-router-dom';
import {
  CalendarIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  ArrowTopRightOnSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { ActivityLink } from '../../types/linking';
import {
  getBudgetTrackerUrl,
  getMeetingSchedulerUrl,
} from '../../types/linking';
import { cn } from '../../lib/utils';

interface ActivityLinkCardProps {
  activity: ActivityLink;
  onCreateProjectManagerActivity: (activity: ActivityLink) => void;
  onCreateMeetingSchedule: (activity: ActivityLink) => void;
  onCreateBudget: (activity: ActivityLink) => void;
  onDelete: (activityId: string) => void;
  isCreatingProject?: boolean;
  isCreatingSchedule?: boolean;
  isCreatingBudget?: boolean;
}

export function ActivityLinkCard({
  activity,
  onCreateProjectManagerActivity,
  onCreateMeetingSchedule,
  onCreateBudget,
  onDelete,
  isCreatingProject = false,
  isCreatingSchedule = false,
  isCreatingBudget = false,
}: ActivityLinkCardProps) {
  const hasProjectManager = !!activity.projectManagerActivityId;
  const hasMeetingSchedule = !!activity.meetingSchedulerProjectId;
  const hasBudget = !!activity.budgetTrackerActivityId;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {activity.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activity.fiscalYear}
          </p>
        </div>
        <button
          onClick={() => onDelete(activity.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          title="Delete activity link"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CalendarIcon className="w-4 h-4" />
          <span>
            {formatDate(activity.startDate)}
            {activity.endDate !== activity.startDate && (
              <> &ndash; {formatDate(activity.endDate)}</>
            )}
          </span>
        </div>
        {activity.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPinIcon className="w-4 h-4" />
            <span>{activity.location}</span>
          </div>
        )}
      </div>

      {/* Linked Resources */}
      <div className="space-y-3">
        {/* Project Manager */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              hasProjectManager
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            )}>
              <ClipboardDocumentListIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Project Manager
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasProjectManager ? 'Linked' : 'Not created'}
              </p>
            </div>
          </div>

          {hasProjectManager ? (
            <Link
              to={`/projects/activities/${activity.projectManagerActivityId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Open
            </Link>
          ) : (
            <button
              onClick={() => onCreateProjectManagerActivity(activity)}
              disabled={isCreatingProject}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                isCreatingProject
                  ? "text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              )}
            >
              {isCreatingProject ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircleIcon className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          )}
        </div>

        {/* Meeting Scheduler */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              hasMeetingSchedule
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            )}>
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Meeting Schedule
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasMeetingSchedule ? 'Linked' : 'Not created'}
              </p>
            </div>
          </div>

          {hasMeetingSchedule ? (
            <Link
              to={getMeetingSchedulerUrl(activity.meetingSchedulerShareId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Open
            </Link>
          ) : (
            <button
              onClick={() => onCreateMeetingSchedule(activity)}
              disabled={isCreatingSchedule}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                isCreatingSchedule
                  ? "text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  : "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50"
              )}
            >
              {isCreatingSchedule ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircleIcon className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          )}
        </div>

        {/* Budget Tracker */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              hasBudget
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            )}>
              <CurrencyDollarIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Budget
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasBudget ? 'Linked' : 'Not created'}
              </p>
            </div>
          </div>

          {hasBudget ? (
            <Link
              to={getBudgetTrackerUrl()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Open
            </Link>
          ) : (
            <button
              onClick={() => onCreateBudget(activity)}
              disabled={isCreatingBudget}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                isCreatingBudget
                  ? "text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              )}
            >
              {isCreatingBudget ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PlusCircleIcon className="w-4 h-4" />
                  Create
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Status indicators */}
      {(hasProjectManager || hasMeetingSchedule || hasBudget) && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex-wrap">
          {hasProjectManager && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <CheckCircleIcon className="w-3 h-3" />
              Project Linked
            </span>
          )}
          {hasMeetingSchedule && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircleIcon className="w-3 h-3" />
              Schedule Linked
            </span>
          )}
          {hasBudget && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <CheckCircleIcon className="w-3 h-3" />
              Budget Linked
            </span>
          )}
        </div>
      )}
    </div>
  );
}
