import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext';
import type { ActivityStatus } from '../types';
import ActivityDashboard from './ActivityDashboard';
import { useAllCrossToolData } from '../hooks/useAllCrossToolData';

export default function ActivityList() {
  const {
    filteredActivities,
    filters,
    setFilters,
    clearFilters,
    selectActivity,
    activeActivityId,
    archivedCount,
    activities,
    getChecklistForActivity,
  } = useProjects();

  const [showFilters, setShowFilters] = useState(false);
  const { getActivityTypeInfo } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dataByActivityId } = useAllCrossToolData();

  // Handle activityId URL parameter - open specific activity
  useEffect(() => {
    const activityId = searchParams.get('activityId');
    if (activityId && activities.length > 0) {
      const activity = activities.find(a => a.id === activityId);
      if (activity) {
        selectActivity(activity.id);
        // Clear the URL parameter after processing
        searchParams.delete('activityId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, activities, selectActivity, setSearchParams]);

  const getActivityTypeColor = (activityType: string) => {
    const typeInfo = getActivityTypeInfo(activityType);
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      indigo: 'bg-indigo-500',
      purple: 'bg-purple-500',
      green: 'bg-green-500',
      teal: 'bg-teal-500',
      cyan: 'bg-cyan-500',
      amber: 'bg-amber-500',
      gray: 'bg-gray-500',
    };
    return colorMap[typeInfo.color] || 'bg-gray-500';
  };

  const getStatusColor = (status: ActivityStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'planning':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300';
      case 'postponed':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  // Full-page dashboard when an activity is selected
  if (activeActivityId) {
    return (
      <ActivityDashboard
        activityId={activeActivityId}
        onBack={() => selectActivity(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activities</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              showFilters || Object.keys(filters).length > 0
                ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600'
            }`}
          >
            <svg className="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            {/* Activity Type Chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity Type</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilters({ ...filters, activityType: undefined, category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    !filters.activityType && !filters.category
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                {/* Trade types */}
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'outbound_trade_mission', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'outbound_trade_mission'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Outbound Mission
                </button>
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'inbound_trade_mission', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'inbound_trade_mission'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Inbound Mission
                </button>
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'trade_show', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'trade_show'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Trade Show
                </button>
                {/* Educational types */}
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'webinar', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'webinar'
                      ? 'bg-green-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Webinar
                </button>
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'seminar', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'seminar'
                      ? 'bg-teal-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-teal-50 dark:hover:bg-teal-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Seminar
                </button>
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'seminar_series', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'seminar_series'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Series
                </button>
                {/* Consultation */}
                <button
                  onClick={() => setFilters({ ...filters, activityType: 'consultation', category: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    filters.activityType === 'consultation'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-amber-50 dark:hover:bg-amber-900/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Consultation
                </button>
              </div>
            </div>

            {/* Status Chips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilters({ ...filters, status: undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    !filters.status
                      ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                {[
                  { value: 'draft', label: 'Draft', color: 'gray' },
                  { value: 'planning', label: 'Planning', color: 'yellow' },
                  { value: 'in_progress', label: 'In Progress', color: 'blue' },
                  { value: 'completed', label: 'Completed', color: 'green' },
                  { value: 'cancelled', label: 'Cancelled', color: 'red' },
                ].map((status) => (
                  <button
                    key={status.value}
                    onClick={() => setFilters({ ...filters, status: [status.value as ActivityStatus] })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filters.status?.[0] === status.value
                        ? `bg-${status.color}-600 text-white`
                        : `bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-${status.color}-50 dark:hover:bg-${status.color}-900/50`
                    }`}
                    style={filters.status?.[0] === status.value ? {
                      backgroundColor: status.color === 'gray' ? '#4b5563' :
                        status.color === 'yellow' ? '#ca8a04' :
                        status.color === 'blue' ? '#2563eb' :
                        status.color === 'green' ? '#16a34a' :
                        status.color === 'red' ? '#dc2626' : '#4b5563'
                    } : {}}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
              <input
                type="text"
                value={filters.searchQuery || ''}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value || undefined })}
                placeholder="Search activities..."
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showArchived || false}
                  onChange={(e) => setFilters({ ...filters, showArchived: e.target.checked || undefined })}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show archived ({archivedCount})
                </span>
              </label>
              {Object.keys(filters).length > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-auto">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p>No activities found</p>
            <p className="text-sm mt-1">Create a new activity to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Start Date</th>
                <th className="px-4 py-3 hidden lg:table-cell">Location</th>
                <th className="px-4 py-3 hidden lg:table-cell">Checklist</th>
                <th className="px-4 py-3 hidden lg:table-cell">Linked Tools</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredActivities.map((activity) => {
                const typeInfo = getActivityTypeInfo(activity.activityType);
                const checklist = getChecklistForActivity(activity.id);
                const checklistProgress = checklist
                  ? checklist.totalCount > 0
                    ? Math.round((checklist.completedCount / checklist.totalCount) * 100)
                    : 0
                  : null;

                return (
                  <tr
                    key={activity.id}
                    onClick={() => selectActivity(activity.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getActivityTypeColor(activity.activityType)}`} />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {activity.name}
                          </div>
                          {/* Mobile-only: show type & status inline */}
                          <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {typeInfo.shortName}
                            {activity.startDate && ` · ${format(parseISO(activity.startDate), 'MMM d')}`}
                          </div>
                        </div>
                        {activity.isArchived && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex-shrink-0">
                            archived
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{typeInfo.shortName}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {activity.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {activity.startDate ? format(parseISO(activity.startDate), 'MMM d, yyyy') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate block max-w-[200px]">
                        {activity.location || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {checklistProgress !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                checklistProgress === 100
                                  ? 'bg-green-500'
                                  : checklistProgress > 50
                                  ? 'bg-blue-500'
                                  : 'bg-gray-400'
                              }`}
                              style={{ width: `${checklistProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{checklistProgress}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {(() => {
                        const crossTool = dataByActivityId.get(activity.id);
                        if (!crossTool) return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;

                        const hasBudget = !!crossTool.budget;
                        const hasScheduler = !!crossTool.scheduler;

                        if (!hasBudget && !hasScheduler) {
                          return <span className="text-sm text-gray-400 dark:text-gray-500">—</span>;
                        }

                        return (
                          <div className="space-y-1">
                            {hasBudget && (
                              <div className="flex items-center gap-2" title={`Budget: $${crossTool.budget!.budgetAmount.toLocaleString()} | Used: ${crossTool.budget!.utilizationPercent}%`}>
                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      crossTool.budget!.utilizationPercent > 100
                                        ? 'bg-red-500'
                                        : crossTool.budget!.utilizationPercent > 80
                                        ? 'bg-yellow-500'
                                        : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(crossTool.budget!.utilizationPercent, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs ${
                                  crossTool.budget!.utilizationPercent > 100
                                    ? 'text-red-600 dark:text-red-400'
                                    : crossTool.budget!.utilizationPercent > 80
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {crossTool.budget!.utilizationPercent}%
                                </span>
                              </div>
                            )}
                            {hasScheduler && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <span title="Meetings">{crossTool.scheduler!.meetingCount}M</span>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <span title="Suppliers">{crossTool.scheduler!.supplierCount}S</span>
                                <span className="text-gray-300 dark:text-gray-600">|</span>
                                <span title="Buyers">{crossTool.scheduler!.buyerCount}B</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
