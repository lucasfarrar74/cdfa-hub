import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { colorForCollaborator, initialForCollaborator } from '../utils/collaboratorColors';
import type { ProjectVersion } from '../types';

/**
 * Named version snapshots. Header button opens a dropdown listing the
 * saved versions, each with Restore and Delete actions, plus a
 * "Save current as…" input at the top.
 *
 * Only renders when the active project is a cloud project (versions
 * live in Firestore alongside the project doc).
 */
export default function VersionsPanel() {
  const {
    projectVersions,
    saveActiveProjectVersion,
    restoreProjectVersion,
    deleteProjectVersion,
    activeProject,
    isFirebaseEnabled,
  } = useSchedule();

  const [isOpen, setIsOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!activeProject?.isCloud || !isFirebaseEnabled) return null;

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setBusy('save');
    setError(null);
    try {
      const result = await saveActiveProjectVersion(saveName);
      if (!result.ok) {
        setError(result.message || 'Save failed.');
      } else {
        setSaveName('');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (version: ProjectVersion) => {
    const ok = window.confirm(
      `Restore this schedule to "${version.name}"?\n\n` +
      `Saved ${new Date(version.createdAt).toLocaleString()} by ${version.createdBy.userName || 'a teammate'}.\n\n` +
      `All changes since will be replaced with the saved schedule. This is undoable via History but if you want to be safe, save the current state as a new version first.`,
    );
    if (!ok) return;
    setBusy(`restore-${version.id}`);
    setError(null);
    try {
      const result = await restoreProjectVersion(version.id);
      if (!result.ok) {
        setError(result.message || 'Restore failed.');
      } else {
        setIsOpen(false);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (version: ProjectVersion) => {
    const ok = window.confirm(`Delete saved version "${version.name}"? This cannot be undone.`);
    if (!ok) return;
    setBusy(`del-${version.id}`);
    try {
      await deleteProjectVersion(version.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Named version snapshots"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        <span>Versions</span>
        {projectVersions.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">({projectVersions.length})</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-96 max-h-[70vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl z-40 flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Save current as…
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setIsOpen(false);
                  }}
                  placeholder="e.g. Locked v1"
                  className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                  maxLength={60}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || busy === 'save'}
                  className="px-3 py-1 text-sm bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy === 'save' ? 'Saving…' : 'Save'}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div className="flex-1 overflow-y-auto">
              {projectVersions.length === 0 ? (
                <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No saved versions yet. Save the schedule at a milestone (e.g. "Locked pre-event") so you can roll back later.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {projectVersions.map(version => {
                    const color = colorForCollaborator(version.createdBy.userId);
                    const initial = initialForCollaborator(version.createdBy.userName, version.createdBy.userId);
                    return (
                      <li key={version.id} className="p-3">
                        <div className="flex items-start gap-2">
                          <div
                            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: color }}
                            title={version.createdBy.userName || `User ${version.createdBy.userId.slice(0, 6)}`}
                          >
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {version.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {new Date(version.createdAt).toLocaleString()}
                              {version.createdBy.userName && (
                                <span className="ml-1">· {version.createdBy.userName}</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {version.project.meetings?.length ?? 0} meetings
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end gap-1">
                          <button
                            onClick={() => handleRestore(version)}
                            disabled={busy === `restore-${version.id}`}
                            className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded disabled:opacity-50"
                          >
                            {busy === `restore-${version.id}` ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            onClick={() => handleDelete(version)}
                            disabled={busy === `del-${version.id}`}
                            className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                          >
                            {busy === `del-${version.id}` ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
