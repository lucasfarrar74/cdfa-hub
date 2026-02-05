import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { DeadlinesWidget } from '../components/dashboard/DeadlinesWidget';
import { BudgetOverview } from '../components/dashboard/BudgetOverview';
import { ProjectsOverview } from '../components/dashboard/ProjectsOverview';
import { MeetingsWidget } from '../components/dashboard/MeetingsWidget';
import { QuickActions } from '../components/dashboard/QuickActions';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';

export function Dashboard() {
  const [showToolWindows, setShowToolWindows] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          At-a-glance view of your projects, deadlines, and budgets
        </p>
      </div>

      {/* Primary widgets - actionable information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Deadlines and Projects */}
        <div className="space-y-6">
          <DeadlinesWidget />
          <ProjectsOverview />
        </div>

        {/* Right column: Budget and Meetings */}
        <div className="space-y-6">
          <BudgetOverview />
          <MeetingsWidget />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Collapsible Tool Windows Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowToolWindows(!showToolWindows)}
          className="w-full px-5 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-900 dark:text-gray-100">Tool Windows</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Embedded views of Project Manager, Meeting Scheduler, and Budget Tracker
            </span>
          </div>
          {showToolWindows ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {showToolWindows && (
          <div className="p-6 bg-white dark:bg-gray-900">
            <DashboardGrid />
          </div>
        )}
      </div>
    </div>
  );
}
