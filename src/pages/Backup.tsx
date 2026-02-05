import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  collectHubData,
  restoreHubData,
  requestToolBackup,
  sendRestoreToTool,
  downloadBackup,
  validateBackup,
  getBackupStats,
  type ComprehensiveBackup,
} from '../services/backupService';
import { tools } from '../config/tools';
import { cn } from '../lib/utils';

interface BackupStatus {
  isCreating: boolean;
  isRestoring: boolean;
  lastBackup: string | null;
  error: string | null;
  success: string | null;
}

export function Backup() {
  const [status, setStatus] = useState<BackupStatus>({
    isCreating: false,
    isRestoring: false,
    lastBackup: localStorage.getItem('cdfa-last-backup'),
    error: null,
    success: null,
  });
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<ComprehensiveBackup | null>(null);
  const [toolStatuses, setToolStatuses] = useState<Map<string, 'pending' | 'success' | 'error'>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

  // Clear messages after 5 seconds
  useEffect(() => {
    if (status.error || status.success) {
      const timer = setTimeout(() => {
        setStatus(s => ({ ...s, error: null, success: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status.error, status.success]);

  // Register iframe refs
  const registerIframe = useCallback((toolId: string, iframe: HTMLIFrameElement | null) => {
    if (iframe) {
      iframeRefs.current.set(toolId, iframe);
    } else {
      iframeRefs.current.delete(toolId);
    }
  }, []);

  // Create comprehensive backup
  const handleCreateBackup = useCallback(async () => {
    setStatus(s => ({ ...s, isCreating: true, error: null, success: null }));
    setToolStatuses(new Map(tools.map(t => [t.id, 'pending'])));

    try {
      // Collect Hub data first
      const backup: ComprehensiveBackup = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        hub: collectHubData(),
        tools: [],
      };

      // Request data from each tool iframe
      for (const tool of tools) {
        const iframe = iframeRefs.current.get(tool.id);
        if (iframe) {
          try {
            const toolData = await requestToolBackup(iframe, tool.id, 10000);
            if (toolData) {
              backup.tools.push(toolData);
              setToolStatuses(s => new Map(s).set(tool.id, 'success'));
            } else {
              setToolStatuses(s => new Map(s).set(tool.id, 'error'));
            }
          } catch {
            setToolStatuses(s => new Map(s).set(tool.id, 'error'));
          }
        }
      }

      // Download the backup
      downloadBackup(backup);

      // Update last backup time
      const backupTime = new Date().toISOString();
      localStorage.setItem('cdfa-last-backup', backupTime);

      setStatus(s => ({
        ...s,
        isCreating: false,
        lastBackup: backupTime,
        success: `Backup created successfully! Includes ${backup.tools.length} tool(s).`,
      }));
    } catch (error) {
      setStatus(s => ({
        ...s,
        isCreating: false,
        error: `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }, []);

  // Handle file selection for restore
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!validateBackup(data)) {
          setStatus(s => ({ ...s, error: 'Invalid backup file format' }));
          return;
        }

        setPendingRestore(data);
        setShowRestoreConfirm(true);
      } catch {
        setStatus(s => ({ ...s, error: 'Failed to read backup file' }));
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Confirm and execute restore
  const handleConfirmRestore = useCallback(async () => {
    if (!pendingRestore) return;

    setShowRestoreConfirm(false);
    setStatus(s => ({ ...s, isRestoring: true, error: null, success: null }));
    setToolStatuses(new Map(tools.map(t => [t.id, 'pending'])));

    try {
      // Restore Hub data first
      restoreHubData(pendingRestore.hub);

      // Restore each tool's data
      let restoredCount = 0;
      for (const toolData of pendingRestore.tools) {
        const iframe = iframeRefs.current.get(toolData.toolId);
        if (iframe) {
          try {
            const success = await sendRestoreToTool(iframe, toolData.toolId, toolData.data, 10000);
            if (success) {
              restoredCount++;
              setToolStatuses(s => new Map(s).set(toolData.toolId, 'success'));
            } else {
              setToolStatuses(s => new Map(s).set(toolData.toolId, 'error'));
            }
          } catch {
            setToolStatuses(s => new Map(s).set(toolData.toolId, 'error'));
          }
        }
      }

      setStatus(s => ({
        ...s,
        isRestoring: false,
        success: `Restore complete! Hub data and ${restoredCount} tool(s) restored. Please refresh the page.`,
      }));

      setPendingRestore(null);
    } catch (error) {
      setStatus(s => ({
        ...s,
        isRestoring: false,
        error: `Failed to restore: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }, [pendingRestore]);

  const stats = pendingRestore ? getBackupStats(pendingRestore) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
          <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Backup & Restore</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create comprehensive backups of all your CDFA Hub data
          </p>
        </div>
      </div>

      {/* Status Messages */}
      {status.error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          <XCircleIcon className="w-5 h-5 flex-shrink-0" />
          <p>{status.error}</p>
        </div>
      )}

      {status.success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
          <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
          <p>{status.success}</p>
        </div>
      )}

      {/* Last Backup Info */}
      {status.lastBackup && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
          <ClockIcon className="w-4 h-4" />
          <span>Last backup: {new Date(status.lastBackup).toLocaleString()}</span>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Backup */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <ArrowDownTrayIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Backup</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Download a comprehensive backup of all your data including activities, checklists,
            meeting schedules, and preferences from all tools.
          </p>
          <button
            onClick={handleCreateBackup}
            disabled={status.isCreating || status.isRestoring}
            className={cn(
              'w-full px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-green-600 text-white hover:bg-green-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {status.isCreating ? 'Creating Backup...' : 'Download Backup'}
          </button>
        </div>

        {/* Restore Backup */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <ArrowUpTrayIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Restore Backup</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Restore your data from a previous backup file. This will overwrite your current data.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status.isCreating || status.isRestoring}
            className={cn(
              'w-full px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-amber-600 text-white hover:bg-amber-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {status.isRestoring ? 'Restoring...' : 'Select Backup File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Tool Status during backup/restore */}
      {(status.isCreating || status.isRestoring) && toolStatuses.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {status.isCreating ? 'Backing up tools...' : 'Restoring tools...'}
          </h3>
          <div className="space-y-2">
            {tools.map(tool => {
              const toolStatus = toolStatuses.get(tool.id);
              return (
                <div key={tool.id} className="flex items-center justify-between py-2">
                  <span className="text-gray-700 dark:text-gray-300">{tool.name}</span>
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    toolStatus === 'pending' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                    toolStatus === 'success' && 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
                    toolStatus === 'error' && 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  )}>
                    {toolStatus === 'pending' && 'Waiting...'}
                    {toolStatus === 'success' && 'Done'}
                    {toolStatus === 'error' && 'Failed'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden iframes for tool communication */}
      <div className="hidden">
        {tools.map(tool => (
          <iframe
            key={tool.id}
            ref={(el) => registerIframe(tool.id, el)}
            src={tool.url}
            title={`${tool.name} backup frame`}
          />
        ))}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && pendingRestore && stats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Confirm Restore
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This will <strong>overwrite all your current data</strong> with the backup from:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Backup Date:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {new Date(stats.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Activity Links:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {stats.activityLinksCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tools Included:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {stats.toolsCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setPendingRestore(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          What's included in a backup?
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Activity links connecting tools together</li>
          <li>• Project Manager: Activities, checklists, staff, and templates</li>
          <li>• Meeting Scheduler: Projects, meetings, and participants</li>
          <li>• Budget Tracker: Budget allocations and expense records</li>
          <li>• Your theme and display preferences</li>
        </ul>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
          Tip: Create regular backups before making major changes to protect your data.
        </p>
      </div>
    </div>
  );
}
