import { useSchedule } from '../context/ScheduleContext';

export default function SyncStatusIndicator() {
  const { activeProject, syncStatus, activeCollaborators, isFirebaseEnabled } = useSchedule();

  // Don't show anything if not a cloud project
  if (!activeProject?.isCloud || !isFirebaseEnabled) {
    return null;
  }

  const statusConfig = {
    synced: {
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      label: 'Synced',
    },
    syncing: {
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      icon: (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ),
      label: 'Syncing',
    },
    offline: {
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
      ),
      label: 'Offline',
    },
    error: {
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      label: 'Error',
    },
  };

  const config = statusConfig[syncStatus];
  const otherCollaborators = activeCollaborators.filter(c => c.userId !== activeProject.ownerId);

  return (
    <div className="flex items-center gap-3">
      {/* Collaborators */}
      {otherCollaborators.length > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-2">
            {otherCollaborators.slice(0, 3).map((collaborator, index) => (
              <div
                key={collaborator.userId}
                className="w-6 h-6 rounded-full bg-purple-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] text-white font-medium"
                title={collaborator.userName || `User ${collaborator.userId.slice(0, 4)}`}
                style={{ zIndex: 3 - index }}
              >
                {(collaborator.userName || collaborator.userId).charAt(0).toUpperCase()}
              </div>
            ))}
            {otherCollaborators.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] text-white font-medium">
                +{otherCollaborators.length - 3}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {otherCollaborators.length} {otherCollaborators.length === 1 ? 'viewer' : 'viewers'}
          </span>
        </div>
      )}

      {/* Sync Status */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} ${config.color}`}
        title={`Status: ${config.label}`}
      >
        {config.icon}
        <span className="text-xs font-medium">{config.label}</span>
      </div>

      {/* Cloud indicator */}
      <div className="text-gray-400 dark:text-gray-500" title="Synced to cloud">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      </div>
    </div>
  );
}
