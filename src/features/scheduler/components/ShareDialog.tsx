import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function ShareDialog({ isOpen, onClose, projectId }: ShareDialogProps) {
  const {
    projects,
    isFirebaseEnabled,
    uploadProjectToCloud,
    openCloudProject,
    disconnectFromCloud,
  } = useSchedule();

  const [isUploading, setIsUploading] = useState(false);
  const [joinShareId, setJoinShareId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const project = projects.find(p => p.id === projectId);
  const isCloud = project?.isCloud && project?.shareId;

  if (!isOpen) return null;

  const handleUpload = async () => {
    setIsUploading(true);
    setError(null);
    try {
      const shareId = await uploadProjectToCloud(projectId);
      if (!shareId) {
        setError('Failed to upload project. Please check your Firebase configuration.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinShareId.trim()) return;

    setIsJoining(true);
    setError(null);
    try {
      const result = await openCloudProject(joinShareId.trim());
      if (!result) {
        setError('Project not found. Please check the share ID.');
      } else {
        onClose();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsJoining(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect from cloud? Your local copy will be kept but won\'t sync anymore.')) {
      disconnectFromCloud(projectId);
    }
  };

  const handleCopyLink = () => {
    if (project?.shareId) {
      const shareUrl = `${window.location.origin}?share=${project.shareId}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyId = () => {
    if (project?.shareId) {
      navigator.clipboard.writeText(project.shareId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-900/50 max-w-md w-full mx-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share & Collaborate</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!isFirebaseEnabled ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
              <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                Cloud sync is not configured. To enable real-time collaboration:
              </p>
              <ol className="text-yellow-700 dark:text-yellow-400 text-xs mt-2 list-decimal list-inside space-y-1">
                <li>Create a Firebase project at console.firebase.google.com</li>
                <li>Enable Firestore and Anonymous Authentication</li>
                <li>Copy .env.example to .env and fill in your Firebase config</li>
                <li>Restart the development server</li>
              </ol>
            </div>
          ) : isCloud ? (
            <>
              {/* Already synced to cloud */}
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md p-3">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Synced to Cloud</span>
                </div>
                <p className="text-green-700 dark:text-green-400 text-sm mt-1">
                  Changes are synced in real-time with collaborators.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Share ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={project?.shareId || ''}
                    readOnly
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyId}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}?share=${project?.shareId}`}
                    readOnly
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 text-sm"
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-sm"
              >
                Disconnect from Cloud
              </button>
            </>
          ) : (
            <>
              {/* Not yet synced */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Upload to Cloud</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload this project to enable real-time collaboration. Anyone with the share link can view and edit.
                </p>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-800 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload to Cloud
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Join Shared Project</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter a share ID to join an existing project.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinShareId}
                    onChange={e => setJoinShareId(e.target.value)}
                    placeholder="Enter share ID..."
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={isJoining || !joinShareId.trim()}
                    className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-sm"
                  >
                    {isJoining ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
