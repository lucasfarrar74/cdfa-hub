import { useState, useMemo } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  parseISO,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isWeekend,
} from 'date-fns';
import { useProjects } from '../context/ProjectsContext';
import type { AnyActivity, ActivityCategory } from '../types';
import { getActivityCategory } from '../types';

type ZoomLevel = 'month' | 'quarter' | 'year';

export default function TimelineView() {
  const { filteredActivities, selectActivity, getActivityTypeInfo, customActivityTypes } = useProjects();
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('quarter');
  const [viewStart, setViewStart] = useState(() => startOfMonth(new Date()));
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hoveredActivity, setHoveredActivity] = useState<string | null>(null);

  const viewEnd = useMemo(() => {
    switch (zoomLevel) {
      case 'month':
        return endOfMonth(viewStart);
      case 'quarter':
        return endOfMonth(addMonths(viewStart, 2));
      case 'year':
        return endOfMonth(addMonths(viewStart, 11));
    }
  }, [viewStart, zoomLevel]);

  const months = useMemo(() => {
    return eachMonthOfInterval({ start: viewStart, end: viewEnd });
  }, [viewStart, viewEnd]);

  const weeks = useMemo(() => {
    return eachWeekOfInterval({ start: viewStart, end: viewEnd });
  }, [viewStart, viewEnd]);

  const days = useMemo(() => {
    if (zoomLevel !== 'month') return [];
    return eachDayOfInterval({ start: viewStart, end: viewEnd });
  }, [viewStart, viewEnd, zoomLevel]);

  const totalDays = useMemo(() => {
    return differenceInDays(viewEnd, viewStart) + 1;
  }, [viewStart, viewEnd]);

  // Calculate today's position
  const todayPosition = useMemo(() => {
    const today = new Date();
    if (today < viewStart || today > viewEnd) return null;
    const daysFromStart = differenceInDays(today, viewStart);
    return (daysFromStart / totalDays) * 100;
  }, [viewStart, viewEnd, totalDays]);

  const handlePrevious = () => {
    switch (zoomLevel) {
      case 'month':
        setViewStart(subMonths(viewStart, 1));
        break;
      case 'quarter':
        setViewStart(subMonths(viewStart, 3));
        break;
      case 'year':
        setViewStart(subMonths(viewStart, 12));
        break;
    }
  };

  const handleNext = () => {
    switch (zoomLevel) {
      case 'month':
        setViewStart(addMonths(viewStart, 1));
        break;
      case 'quarter':
        setViewStart(addMonths(viewStart, 3));
        break;
      case 'year':
        setViewStart(addMonths(viewStart, 12));
        break;
    }
  };

  const handleToday = () => {
    setViewStart(startOfMonth(new Date()));
  };

  const getActivityPosition = (activity: AnyActivity) => {
    if (!activity.startDate || !activity.endDate) return null;

    const start = parseISO(activity.startDate);
    const end = parseISO(activity.endDate);

    // Check if activity is visible in current view
    if (end < viewStart || start > viewEnd) return null;

    const effectiveStart = start < viewStart ? viewStart : start;
    const effectiveEnd = end > viewEnd ? viewEnd : end;

    const leftDays = differenceInDays(effectiveStart, viewStart);
    const widthDays = differenceInDays(effectiveEnd, effectiveStart) + 1;

    return {
      left: (leftDays / totalDays) * 100,
      width: (widthDays / totalDays) * 100,
      startsBeforeView: start < viewStart,
      endsAfterView: end > viewEnd,
    };
  };

  const getActivityColor = (activity: AnyActivity) => {
    if (activity.status === 'draft') return 'bg-gray-400';
    if (activity.status === 'cancelled') return 'bg-red-400';
    if (activity.status === 'completed') return 'bg-emerald-500';
    const typeInfo = getActivityTypeInfo(activity.activityType);
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

  const getActivityBorderColor = (activity: AnyActivity) => {
    if (activity.status === 'draft') return 'border-gray-500';
    if (activity.status === 'cancelled') return 'border-red-500';
    if (activity.status === 'completed') return 'border-emerald-600';
    const typeInfo = getActivityTypeInfo(activity.activityType);
    const colorMap: Record<string, string> = {
      blue: 'border-blue-600',
      indigo: 'border-indigo-600',
      purple: 'border-purple-600',
      green: 'border-green-600',
      teal: 'border-teal-600',
      cyan: 'border-cyan-600',
      amber: 'border-amber-600',
      gray: 'border-gray-600',
    };
    return colorMap[typeInfo.color] || 'border-gray-600';
  };

  const getEventTypeLabel = (activity: AnyActivity) => {
    return getActivityTypeInfo(activity.activityType).shortName;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', label: 'Draft' },
      planning: { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-300', label: 'Planning' },
      in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', label: 'Active' },
      completed: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-300', label: 'Done' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300', label: 'Cancelled' },
    };
    return badges[status] || badges.draft;
  };

  const getCategoryIcon = (category: ActivityCategory) => {
    switch (category) {
      case 'trade':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'educational':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case 'consultation':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
    }
  };

  const visibleActivities = useMemo(() => {
    return filteredActivities
      .filter((a) => {
        if (!a.startDate) return false;
        const start = parseISO(a.startDate);
        const end = a.endDate ? parseISO(a.endDate) : start;
        if (end < viewStart || start > viewEnd) return false;

        // Apply category filter
        if (categoryFilter !== 'all') {
          const actCategory = getActivityCategory(a.activityType, customActivityTypes);
          if (actCategory !== categoryFilter) return false;
        }

        // Apply status filter
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort by start date, then by duration (longer first)
        const aStart = parseISO(a.startDate);
        const bStart = parseISO(b.startDate);
        if (aStart.getTime() !== bStart.getTime()) {
          return aStart.getTime() - bStart.getTime();
        }
        const aDuration = differenceInDays(parseISO(a.endDate || a.startDate), aStart);
        const bDuration = differenceInDays(parseISO(b.endDate || b.startDate), bStart);
        return bDuration - aDuration;
      });
  }, [filteredActivities, viewStart, viewEnd, categoryFilter, statusFilter, customActivityTypes]);

  const getDateRangeLabel = () => {
    return `${format(viewStart, 'MMM d, yyyy')} - ${format(viewEnd, 'MMM d, yyyy')}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Timeline</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{getDateRangeLabel()}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Today button */}
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            Today
          </button>

          {/* Zoom selector */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['month', 'quarter', 'year'] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                  zoomLevel === level
                    ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-700 dark:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-700 dark:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Legend */}
      <div className="flex items-center justify-between mb-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ActivityCategory | 'all')}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="trade">Trade</option>
              <option value="educational">Educational</option>
              <option value="consultation">Consultation</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Trade</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Educational</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Consultation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-400"></span>
            <span className="text-gray-600 dark:text-gray-400">Draft</span>
          </div>
          {todayPosition !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-0.5 h-3 bg-red-500"></span>
              <span className="text-gray-600 dark:text-gray-400">Today</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden border dark:border-gray-700">
        {/* Month headers */}
        <div className="flex border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="w-64 flex-shrink-0 border-r dark:border-gray-600 px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
            Activity
          </div>
          <div className="flex-1 flex">
            {months.map((month, idx) => {
              const monthStart = startOfMonth(month);
              const monthEnd = endOfMonth(month);
              const effectiveStart = monthStart < viewStart ? viewStart : monthStart;
              const effectiveEnd = monthEnd > viewEnd ? viewEnd : monthEnd;
              const monthDays = differenceInDays(effectiveEnd, effectiveStart) + 1;
              const width = (monthDays / totalDays) * 100;

              return (
                <div
                  key={month.getTime()}
                  className={`text-center py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 ${
                    idx < months.length - 1 ? 'border-r dark:border-gray-600' : ''
                  } ${isSameMonth(month, new Date()) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                  style={{ width: `${width}%` }}
                >
                  {format(month, zoomLevel === 'year' ? 'MMM' : 'MMMM yyyy')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day markers row (for month view) */}
        {zoomLevel === 'month' && (
          <div className="flex border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="w-64 flex-shrink-0 border-r dark:border-gray-600"></div>
            <div className="flex-1 flex">
              {days.map((day, idx) => {
                const isTodayDay = isToday(day);
                const isWeekendDay = isWeekend(day);
                return (
                  <div
                    key={idx}
                    className={`flex-1 text-center py-1 text-xs border-r border-gray-100 dark:border-gray-700 ${
                      isTodayDay ? 'bg-blue-100 dark:bg-blue-900/50 font-semibold text-blue-700 dark:text-blue-300' :
                      isWeekendDay ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week markers row (for quarter view) */}
        {zoomLevel === 'quarter' && (
          <div className="flex border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <div className="w-64 flex-shrink-0 border-r dark:border-gray-600"></div>
            <div className="flex-1 relative h-6">
              {weeks.map((week, idx) => {
                const weekStart = week < viewStart ? viewStart : week;
                const leftDays = differenceInDays(weekStart, viewStart);
                const left = (leftDays / totalDays) * 100;
                const weekNum = format(week, 'w');

                return (
                  <div
                    key={idx}
                    className="absolute top-0 h-full border-l border-gray-200 dark:border-gray-600 text-xs text-gray-400 dark:text-gray-500 pl-1"
                    style={{ left: `${left}%` }}
                  >
                    W{weekNum}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity rows */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          {visibleActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No activities in this time period</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting the filters or date range</p>
            </div>
          ) : (
            visibleActivities.map((activity) => {
              const position = getActivityPosition(activity);
              if (!position) return null;
              const category = getActivityCategory(activity.activityType, customActivityTypes);
              const statusBadge = getStatusBadge(activity.status);
              const isHovered = hoveredActivity === activity.id;

              return (
                <div
                  key={activity.id}
                  className={`flex items-center h-16 border-b dark:border-gray-700 transition-colors group ${
                    isHovered ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/50'
                  }`}
                  onMouseEnter={() => setHoveredActivity(activity.id)}
                  onMouseLeave={() => setHoveredActivity(null)}
                >
                  {/* Activity name and details */}
                  <div
                    className="w-64 flex-shrink-0 border-r dark:border-gray-600 px-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-3"
                    onClick={() => selectActivity(activity.id)}
                  >
                    <div className={`p-1.5 rounded-md ${
                      category === 'trade' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' :
                      category === 'educational' ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' :
                      category === 'consultation' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getCategoryIcon(category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {activity.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <span>{getEventTypeLabel(activity)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline bar area */}
                  <div className="flex-1 relative h-full">
                    {/* Grid lines for months */}
                    {months.map((month, idx) => {
                      if (idx === 0) return null;
                      const monthStart = startOfMonth(month);
                      const leftDays = differenceInDays(monthStart, viewStart);
                      const left = (leftDays / totalDays) * 100;
                      return (
                        <div
                          key={month.getTime()}
                          className="absolute top-0 h-full border-l border-gray-100 dark:border-gray-700"
                          style={{ left: `${left}%` }}
                        />
                      );
                    })}

                    {/* Weekend backgrounds for month view */}
                    {zoomLevel === 'month' && days.map((day, idx) => {
                      if (!isWeekend(day)) return null;
                      const left = (idx / totalDays) * 100;
                      const width = (1 / totalDays) * 100;
                      return (
                        <div
                          key={idx}
                          className="absolute top-0 h-full bg-gray-50 dark:bg-gray-800/50"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      );
                    })}

                    {/* Today marker */}
                    {todayPosition !== null && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
                        style={{ left: `${todayPosition}%` }}
                      />
                    )}

                    {/* Activity bar */}
                    <div
                      className={`absolute top-3 h-10 rounded-md cursor-pointer
                        transition-all border-l-4 shadow-sm
                        ${getActivityColor(activity)} ${getActivityBorderColor(activity)}
                        ${position.startsBeforeView ? 'rounded-l-none border-l-0' : ''}
                        ${position.endsAfterView ? 'rounded-r-none' : ''}
                        ${isHovered ? 'shadow-md ring-2 ring-blue-300 ring-opacity-50' : 'hover:shadow-md'}`}
                      style={{
                        left: `${position.left}%`,
                        width: `${Math.max(position.width, 1)}%`,
                        minWidth: '12px',
                      }}
                      onClick={() => selectActivity(activity.id)}
                      title={`${activity.name}\n${format(parseISO(activity.startDate), 'MMM d, yyyy')} - ${format(
                        parseISO(activity.endDate || activity.startDate),
                        'MMM d, yyyy'
                      )}\nStatus: ${activity.status.replace('_', ' ')}`}
                    >
                      <div className="h-full flex items-center px-2 overflow-hidden">
                        <span className="text-xs text-white font-medium truncate">
                          {position.width > 6 ? activity.name : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Summary footer */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-medium">{visibleActivities.length}</span>
          <span>{visibleActivities.length === 1 ? 'activity' : 'activities'}</span>
          {(categoryFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }}
              className="ml-2 text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Trade: {visibleActivities.filter(a => getActivityCategory(a.activityType, customActivityTypes) === 'trade').length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Educational: {visibleActivities.filter(a => getActivityCategory(a.activityType, customActivityTypes) === 'educational').length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Consultation: {visibleActivities.filter(a => getActivityCategory(a.activityType, customActivityTypes) === 'consultation').length}
          </span>
        </div>
      </div>
    </div>
  );
}
