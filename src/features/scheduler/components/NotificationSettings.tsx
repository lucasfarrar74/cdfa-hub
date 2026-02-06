import { useNotifications } from '../hooks/useNotifications';

export default function NotificationSettings() {
  const {
    settings,
    permission,
    updateSettings,
    toggleEnabled,
    isSupported,
  } = useNotifications();

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative group">
      <button
        onClick={toggleEnabled}
        className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
          settings.enabled
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={settings.enabled ? 'Notifications enabled' : 'Enable notifications'}
      >
        <span className="text-base">{settings.enabled ? '🔔' : '🔕'}</span>
        <span className="hidden sm:inline">
          {settings.enabled ? 'On' : 'Off'}
        </span>
      </button>

      {/* Dropdown settings - shown on hover when enabled */}
      {settings.enabled && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 p-3 z-50 w-56 hidden group-hover:block">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
            Notification Settings
          </h4>

          {permission !== 'granted' && (
            <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded mb-2">
              Browser permission required
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Play sound</span>
            </label>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={settings.delayAlerts}
                onChange={(e) => updateSettings({ delayAlerts: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Alert on delays</span>
            </label>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={settings.completionAlerts}
                onChange={(e) => updateSettings({ completionAlerts: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-gray-700 dark:text-gray-300">Alert on completion</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
