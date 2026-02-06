import { FolderIcon, CheckCircleIcon, PlayCircleIcon, PauseCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Project {
  id: string;
  name: string;
  type: 'trade_mission' | 'educational' | 'consultation';
  status: 'draft' | 'planning' | 'active' | 'completed';
  progress: number;
  nextMilestone?: string;
  daysUntilDeadline?: number;
}

// Mock data - would be fetched from Project Manager API
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Japan Trade Mission 2026',
    type: 'trade_mission',
    status: 'active',
    progress: 65,
    nextMilestone: 'Participant Registration',
    daysUntilDeadline: 12,
  },
  {
    id: '2',
    name: 'Korea Export Seminar',
    type: 'educational',
    status: 'planning',
    progress: 30,
    nextMilestone: 'Venue Confirmation',
    daysUntilDeadline: 5,
  },
  {
    id: '3',
    name: 'Almond Board Consultation',
    type: 'consultation',
    status: 'active',
    progress: 80,
    nextMilestone: 'Final Report',
    daysUntilDeadline: 3,
  },
  {
    id: '4',
    name: 'Wine Export Workshop',
    type: 'educational',
    status: 'draft',
    progress: 10,
  },
  {
    id: '5',
    name: 'Taiwan Market Entry',
    type: 'trade_mission',
    status: 'planning',
    progress: 45,
    nextMilestone: 'Budget Approval',
    daysUntilDeadline: 8,
  },
];

const statusConfig = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    icon: DocumentTextIcon,
  },
  planning: {
    label: 'Planning',
    color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    icon: PauseCircleIcon,
  },
  active: {
    label: 'Active',
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    icon: PlayCircleIcon,
  },
  completed: {
    label: 'Completed',
    color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
    icon: CheckCircleIcon,
  },
};

const typeLabels = {
  trade_mission: 'Trade Mission',
  educational: 'Educational',
  consultation: 'Consultation',
};

function getProgressColor(progress: number): string {
  if (progress >= 75) return 'bg-emerald-500';
  if (progress >= 50) return 'bg-blue-500';
  if (progress >= 25) return 'bg-amber-500';
  return 'bg-gray-400';
}

export function ProjectsOverview() {
  const activeCount = mockProjects.filter(p => p.status === 'active').length;
  const planningCount = mockProjects.filter(p => p.status === 'planning').length;
  const draftCount = mockProjects.filter(p => p.status === 'draft').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow dark:shadow-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <FolderIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Active Projects</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{mockProjects.length} total projects</p>
          </div>
        </div>
      </div>

      {/* Status summary */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="text-center border-x border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{planningCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Planning</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{draftCount}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Draft</p>
        </div>
      </div>

      {/* Project list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {mockProjects.filter(p => p.status !== 'completed').slice(0, 5).map((project) => {
          const config = statusConfig[project.status];
          const StatusIcon = config.icon;
          return (
            <div
              key={project.id}
              className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{project.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{typeLabels[project.type]}</p>
                </div>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {config.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(project.progress)}`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">
                  {project.progress}%
                </span>
              </div>

              {/* Next milestone */}
              {project.nextMilestone && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    Next: <span className="text-gray-700 dark:text-gray-300">{project.nextMilestone}</span>
                  </span>
                  {project.daysUntilDeadline !== undefined && (
                    <span className={`font-medium ${project.daysUntilDeadline <= 3 ? 'text-red-600 dark:text-red-400' : project.daysUntilDeadline <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {project.daysUntilDeadline} days
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <a
          href="/projects"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View all projects →
        </a>
      </div>
    </div>
  );
}
