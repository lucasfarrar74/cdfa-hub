import { useState, useEffect } from 'react';
import { ScheduleProvider, useSchedule } from '../features/scheduler/context/ScheduleContext';
import {
  EventConfigPanel,
  ParticipantsPanel,
  PreferencesPanel,
  SchedulePanel,
  ExportPanel,
  ProjectSidebar,
  SyncStatusIndicator,
  KeyboardShortcutsHelp,
  NotificationSettings,
  ThemeToggle,
} from '../features/scheduler/components';

type Tab = 'config' | 'participants' | 'preferences' | 'schedule' | 'export';

function SchedulerContent() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { activeProject, openCloudProject, isFirebaseEnabled, createProject, setEventConfig } = useSchedule();

  // Handle share URL parameter on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');

    if (shareId && isFirebaseEnabled) {
      openCloudProject(shareId).then(project => {
        if (project) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    }
  }, [isFirebaseEnabled, openCloudProject]);

  // Handle fromActivity URL parameter - create linked project from Project Manager
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromActivity = urlParams.get('fromActivity');
    const activityName = urlParams.get('activityName');
    const startDate = urlParams.get('startDate');
    const endDate = urlParams.get('endDate');

    if (fromActivity && activityName) {
      const newProject = createProject(activityName, { cdfaActivityId: fromActivity });

      if (newProject) {
        setEventConfig({
          id: crypto.randomUUID(),
          name: activityName,
          startDate: startDate || new Date().toISOString().split('T')[0],
          endDate: endDate || startDate || new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '17:00',
          defaultMeetingDuration: 30,
          breaks: [],
          schedulingStrategy: 'efficient',
        });
      }

      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [createProject, setEventConfig]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'config', label: 'Event Setup' },
    { id: 'participants', label: 'Participants' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'export', label: 'Export' },
  ];

  return (
    <div className="h-full flex">
      {/* Project Sidebar */}
      <ProjectSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meeting Scheduler</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Supplier-Buyer Meeting Organizer</p>
              </div>
              <div className="flex items-center gap-3">
                {activeProject?.cdfaActivityId && (
                  <a
                    href={`/projects/activities?activityId=${activeProject.cdfaActivityId}`}
                    className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    View Activity
                  </a>
                )}
                <ThemeToggle />
                <KeyboardShortcutsHelp />
                <NotificationSettings />
                <SyncStatusIndicator />
                {activeProject && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activeProject.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {activeProject.eventConfig?.startDate || 'No date set'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4">
            <div className="flex space-x-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <main className="flex-1 px-4 py-6 overflow-auto bg-gray-50 dark:bg-gray-900">
          {activeTab === 'config' && <EventConfigPanel />}
          {activeTab === 'participants' && <ParticipantsPanel />}
          {activeTab === 'preferences' && <PreferencesPanel />}
          {activeTab === 'schedule' && <SchedulePanel />}
          {activeTab === 'export' && <ExportPanel />}
        </main>
      </div>
    </div>
  );
}

export function MeetingScheduler() {
  return (
    <ScheduleProvider>
      <SchedulerContent />
    </ScheduleProvider>
  );
}
