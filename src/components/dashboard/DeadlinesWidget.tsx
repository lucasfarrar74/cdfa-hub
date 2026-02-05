import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface Deadline {
  id: string;
  title: string;
  project: string;
  dueDate: Date;
  status: 'overdue' | 'due-soon' | 'upcoming';
  type: 'task' | 'milestone' | 'deliverable';
}

// Mock data - would be fetched from Project Manager API
const mockDeadlines: Deadline[] = [
  {
    id: '1',
    title: 'Submit visa applications',
    project: 'Japan Trade Mission',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    status: 'overdue',
    type: 'task',
  },
  {
    id: '2',
    title: 'Finalize participant list',
    project: 'Korea Export Seminar',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
    status: 'due-soon',
    type: 'milestone',
  },
  {
    id: '3',
    title: 'Book venue',
    project: 'Almond Board Consultation',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    status: 'due-soon',
    type: 'task',
  },
  {
    id: '4',
    title: 'Send invitations',
    project: 'Wine Export Workshop',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
    status: 'upcoming',
    type: 'task',
  },
  {
    id: '5',
    title: 'Budget approval',
    project: 'Taiwan Market Entry',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
    status: 'upcoming',
    type: 'deliverable',
  },
];

function formatDueDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function getStatusStyles(status: Deadline['status']) {
  switch (status) {
    case 'overdue':
      return {
        bg: 'bg-red-50 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
        icon: 'text-red-500 dark:text-red-400',
      };
    case 'due-soon':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        icon: 'text-amber-500 dark:text-amber-400',
      };
    case 'upcoming':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        icon: 'text-blue-500 dark:text-blue-400',
      };
  }
}

export function DeadlinesWidget() {
  const overdueCount = mockDeadlines.filter(d => d.status === 'overdue').length;
  const dueSoonCount = mockDeadlines.filter(d => d.status === 'due-soon').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow dark:shadow-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
            <ClockIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Upcoming Deadlines</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Next 14 days</p>
          </div>
        </div>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            {overdueCount} overdue
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-gray-600 dark:text-gray-400">{overdueCount} overdue</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span className="text-gray-600 dark:text-gray-400">{dueSoonCount} due soon</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span className="text-gray-600 dark:text-gray-400">{mockDeadlines.length - overdueCount - dueSoonCount} upcoming</span>
        </div>
      </div>

      {/* Deadline list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {mockDeadlines.map((deadline) => {
          const styles = getStatusStyles(deadline.status);
          return (
            <div
              key={deadline.id}
              className={`px-5 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer`}
            >
              <div className={`w-1 h-10 rounded-full ${deadline.status === 'overdue' ? 'bg-red-500' : deadline.status === 'due-soon' ? 'bg-amber-500' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{deadline.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{deadline.project}</p>
              </div>
              <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${styles.bg} ${styles.text}`}>
                {formatDueDate(deadline.dueDate)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <a
          href="/project-manager"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View all tasks →
        </a>
      </div>
    </div>
  );
}
