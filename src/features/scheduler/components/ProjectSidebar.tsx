import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { format } from 'date-fns';
import ShareDialog from './ShareDialog';

interface ProjectSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ProjectSidebar({ isCollapsed, onToggleCollapse }: ProjectSidebarProps) {
  const {
    projects,
    activeProjectId,
    createProject,
    switchProject,
    deleteProject,
    duplicateProject,
    renameProject,
    isFirebaseEnabled,
  } = useSchedule();

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [shareDialogProjectId, setShareDialogProjectId] = useState<string | null>(null);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleStartRename = (projectId: string, currentName: string) => {
    setEditingId(projectId);
    setEditName(currentName);
  };

  const handleRename = (projectId: string) => {
    if (editName.trim() && editName !== projects.find(p => p.id === projectId)?.name) {
      renameProject(projectId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      alert('Cannot delete the last project');
      return;
    }
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(projectId);
    }
  };

  const handleDuplicate = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateProject(projectId);
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-800 flex flex-col items-center py-4 no-print">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <div className="mt-4 space-y-2">
          {projects.map((project, index) => (
            <button
              key={project.id}
              onClick={() => switchProject(project.id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                project.id === activeProjectId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              title={project.name}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-800 flex flex-col no-print">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Projects</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Collapse sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => switchProject(project.id)}
            className={`group p-3 border-b border-gray-700 cursor-pointer transition-colors ${
              project.id === activeProjectId
                ? 'bg-blue-600 bg-opacity-30'
                : 'hover:bg-gray-700'
            }`}
          >
            {editingId === project.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRename(project.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(project.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm bg-gray-600 text-white rounded border border-gray-500 focus:outline-none focus:border-blue-400"
                autoFocus
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3
                      className={`text-sm font-medium truncate ${
                        project.id === activeProjectId ? 'text-white' : 'text-gray-200'
                      }`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(project.id, project.name);
                      }}
                      title="Double-click to rename"
                    >
                      {project.name}
                    </h3>
                    {project.isCloud && (
                      <span title="Synced to cloud">
                        <svg
                          className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {project.eventConfig?.startDate
                      ? format(new Date(project.eventConfig.startDate), 'MMM d, yyyy')
                      : 'No date set'}
                  </p>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isFirebaseEnabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareDialogProjectId(project.id);
                      }}
                      className={`p-1 hover:bg-gray-600 rounded ${
                        project.isCloud ? 'text-blue-400 hover:text-blue-300' : 'text-gray-400 hover:text-white'
                      }`}
                      title={project.isCloud ? 'Share settings' : 'Share project'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDuplicate(project.id, e)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                    title="Duplicate project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="flex items-center space-x-3 mt-2 text-xs text-gray-400">
              <span title="Suppliers">{project.suppliers.length} suppliers</span>
              <span title="Buyers">{project.buyers.length} buyers</span>
              <span title="Meetings">{project.meetings.length} meetings</span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Project */}
      <div className="p-3 border-t border-gray-700">
        {isCreating ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewProjectName('');
                }
              }}
              placeholder="Project name..."
              className="w-full px-3 py-2 text-sm bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-400"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewProjectName('');
                }}
                className="px-3 py-1.5 text-sm bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Share Dialog */}
      {shareDialogProjectId && (
        <ShareDialog
          isOpen={true}
          onClose={() => setShareDialogProjectId(null)}
          projectId={shareDialogProjectId}
        />
      )}
    </div>
  );
}
