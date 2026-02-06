import { useMemo, useRef, useState } from 'react';
import { format, parseISO, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { useProjects } from '../context/ProjectsContext';
import type { AnyActivity, ChecklistItem, ActivityType } from '../types';
import { getActivityCategory, ACTIVITY_TYPES } from '../types';
import { getFiscalYear } from '../utils/fiscalYear';

export default function Dashboard() {
  const {
    activities,
    checklistInstances,
    selectActivity,
    createTradeActivity,
    createEducationalActivity,
    createConsultationActivity,
    loadSampleData,
    exportToJSON,
    importFromJSON,
    customActivityTypes,
    getActivityTypeInfo,
  } = useProjects();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [showNewActivityMenu, setShowNewActivityMenu] = useState(false);

  const handleExport = () => {
    const data = exportToJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cdfa-activities-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        importFromJSON(content);
        setImportError(null);
        setShowDataPanel(false);
      } catch (err) {
        setImportError('Failed to import: Invalid file format');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const today = startOfDay(new Date());
  const currentFY = getFiscalYear();

  // Upcoming activities (next 30 days)
  const upcomingActivities = useMemo(() => {
    const cutoff = addDays(today, 30);
    return activities
      .filter((a) => {
        if (!a.startDate || a.status === 'cancelled' || a.status === 'completed') return false;
        const start = parseISO(a.startDate);
        return isAfter(start, today) && isBefore(start, cutoff);
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
  }, [activities, today]);

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    const tasks: { item: ChecklistItem; activity: AnyActivity }[] = [];
    for (const checklist of checklistInstances) {
      const activity = activities.find((a) => a.id === checklist.activityId);
      if (!activity || activity.status === 'cancelled' || activity.status === 'completed') continue;

      for (const item of checklist.items) {
        if (item.status === 'completed' || item.status === 'skipped') continue;
        if (isBefore(parseISO(item.dueDate), today)) {
          tasks.push({ item, activity });
        }
      }
    }
    return tasks.sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate)).slice(0, 5);
  }, [checklistInstances, activities, today]);

  // Tasks due soon (next 7 days)
  const dueSoonTasks = useMemo(() => {
    const cutoff = addDays(today, 7);
    const tasks: { item: ChecklistItem; activity: AnyActivity }[] = [];
    for (const checklist of checklistInstances) {
      const activity = activities.find((a) => a.id === checklist.activityId);
      if (!activity || activity.status === 'cancelled' || activity.status === 'completed') continue;

      for (const item of checklist.items) {
        if (item.status === 'completed' || item.status === 'skipped') continue;
        const dueDate = parseISO(item.dueDate);
        if (!isBefore(dueDate, today) && isBefore(dueDate, cutoff)) {
          tasks.push({ item, activity });
        }
      }
    }
    return tasks.sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate)).slice(0, 5);
  }, [checklistInstances, activities, today]);

  // Fiscal year stats
  const fyStats = useMemo(() => {
    const fyActivities = activities.filter((a) => a.fiscalYear === currentFY && !a.isArchived);
    const tradeActivities = fyActivities.filter((a) => getActivityCategory(a.activityType, customActivityTypes) === 'trade');
    const eduActivities = fyActivities.filter((a) => getActivityCategory(a.activityType, customActivityTypes) === 'educational');
    const consultActivities = fyActivities.filter((a) => getActivityCategory(a.activityType, customActivityTypes) === 'consultation');

    return {
      total: fyActivities.length,
      trade: {
        total: tradeActivities.length,
        completed: tradeActivities.filter((a) => a.status === 'completed').length,
        inProgress: tradeActivities.filter((a) => a.status === 'in_progress' || a.status === 'planning')
          .length,
      },
      educational: {
        total: eduActivities.length,
        completed: eduActivities.filter((a) => a.status === 'completed').length,
        inProgress: eduActivities.filter((a) => a.status === 'in_progress' || a.status === 'planning')
          .length,
      },
      consultation: {
        total: consultActivities.length,
        completed: consultActivities.filter((a) => a.status === 'completed').length,
        inProgress: consultActivities.filter((a) => a.status === 'in_progress' || a.status === 'planning')
          .length,
      },
    };
  }, [activities, currentFY, customActivityTypes]);

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

  const handleCreateActivity = (activityType: ActivityType) => {
    setShowNewActivityMenu(false);
    const typeInfo = ACTIVITY_TYPES[activityType as keyof typeof ACTIVITY_TYPES];
    const category = getActivityCategory(activityType, customActivityTypes);

    if (category === 'trade') {
      createTradeActivity({
        name: `New ${typeInfo?.name || 'Trade Activity'}`,
        activityType
      });
    } else if (category === 'consultation') {
      createConsultationActivity({
        name: `New ${typeInfo?.name || 'Consultation'}`,
        activityType
      });
    } else {
      createEducationalActivity({
        name: `New ${typeInfo?.name || 'Activity'}`,
        activityType
      });
    }
  };

  const getStatusColor = (status: string) => {
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
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">{currentFY} Overview</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDataPanel(!showDataPanel)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            title="Backup & Restore"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowNewActivityMenu(!showNewActivityMenu)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Activity
              <svg className={`w-4 h-4 transition-transform ${showNewActivityMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showNewActivityMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNewActivityMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 border dark:border-gray-700 z-20 py-2">
                  {/* Trade Section */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trade
                  </div>
                  <button
                    onClick={() => handleCreateActivity('outbound_trade_mission')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Outbound Trade Mission
                  </button>
                  <button
                    onClick={() => handleCreateActivity('inbound_trade_mission')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    Inbound Trade Mission
                  </button>
                  <button
                    onClick={() => handleCreateActivity('trade_show')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Trade Show
                  </button>

                  <div className="my-2 border-t dark:border-gray-700" />

                  {/* Educational Section */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Educational
                  </div>
                  <button
                    onClick={() => handleCreateActivity('webinar')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Webinar
                  </button>
                  <button
                    onClick={() => handleCreateActivity('seminar')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    Seminar
                  </button>
                  <button
                    onClick={() => handleCreateActivity('seminar_series')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Seminar Series
                  </button>

                  <div className="my-2 border-t dark:border-gray-700" />

                  {/* Other Section */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Other
                  </div>
                  <button
                    onClick={() => handleCreateActivity('consultation')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-900/50 flex items-center gap-3 dark:text-gray-100"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Consultation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Data Management Panel */}
      {showDataPanel && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Backup & Restore</h3>
            <button
              onClick={() => setShowDataPanel(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Export your activities to a JSON file for backup, or import from a previous backup.
          </p>
          {importError && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded text-sm text-red-600 dark:text-red-400">
              {importError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={activities.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Backup
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {activities.length} activities stored • Last export creates a timestamped backup file
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trade</h3>
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{fyStats.trade.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {fyStats.trade.completed} completed, {fyStats.trade.inProgress} active
            </div>
            <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${fyStats.trade.total ? (fyStats.trade.completed / fyStats.trade.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Educational</h3>
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{fyStats.educational.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {fyStats.educational.completed} completed, {fyStats.educational.inProgress} active
            </div>
            <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    fyStats.educational.total
                      ? (fyStats.educational.completed / fyStats.educational.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Consultations</h3>
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{fyStats.consultation.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {fyStats.consultation.completed} completed, {fyStats.consultation.inProgress} active
            </div>
            <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    fyStats.consultation.total
                      ? (fyStats.consultation.completed / fyStats.consultation.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tasks</h3>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                overdueTasks.length > 0 ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
              }`}
            >
              {overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'All caught up'}
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{dueSoonTasks.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">due in the next 7 days</div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming activities */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upcoming Activities</h3>
          </div>
          <div className="divide-y dark:divide-gray-700">
            {upcomingActivities.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                <p>No upcoming activities in the next 30 days</p>
                {activities.length === 0 && (
                  <button
                    onClick={loadSampleData}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Load sample data to explore
                  </button>
                )}
              </div>
            ) : (
              upcomingActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => selectActivity(activity.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span
                        className={`w-2 h-2 rounded-full mt-2 ${getActivityTypeColor(activity.activityType)}`}
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{activity.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {getActivityTypeInfo(activity.activityType).shortName} • {format(parseISO(activity.startDate), 'MMM d, yyyy')}
                          {activity.location && ` • ${activity.location}`}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {activity.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Overdue & due soon tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Task Reminders</h3>
          </div>
          <div className="divide-y dark:divide-gray-700 max-h-96 overflow-auto">
            {overdueTasks.length === 0 && dueSoonTasks.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                No pending tasks
              </div>
            ) : (
              <>
                {overdueTasks.map(({ item, activity }) => (
                  <div
                    key={item.id}
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors bg-red-50 dark:bg-red-900/30"
                    onClick={() => selectActivity(activity.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full mt-2 bg-red-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{activity.name}</div>
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Overdue: was due {format(parseISO(item.dueDate), 'MMM d')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {dueSoonTasks.map(({ item, activity }) => (
                  <div
                    key={item.id}
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => selectActivity(activity.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full mt-2 bg-yellow-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{activity.name}</div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                          Due: {format(parseISO(item.dueDate), 'MMM d')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
