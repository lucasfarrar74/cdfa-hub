import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../context/ProjectsContext';
import type { StaffMember, AnyActivity } from '../types';

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  completed: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  cancelled: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
  postponed: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

interface StaffWorkload {
  member: StaffMember;
  leadActivities: AnyActivity[];
  teamActivities: AnyActivity[];
  assignedItems: Array<{
    activityName: string;
    itemTitle: string;
    status: string;
    dueDate?: string;
    isOverdue: boolean;
  }>;
  overdueCount: number;
}

export default function TeamDashboard() {
  const { staffMembers, activities, checklistInstances } = useProjects();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const activeStaff = staffMembers.filter(s => s.isActive);

  const workloads = useMemo((): StaffWorkload[] => {
    const now = new Date();

    return activeStaff.map(member => {
      const leadActivities = activities.filter(a => a.leadStaffId === member.id && a.status !== 'cancelled');
      const teamActivities = activities.filter(
        a => a.teamMemberIds?.includes(member.id) && a.leadStaffId !== member.id && a.status !== 'cancelled'
      );

      const assignedItems: StaffWorkload['assignedItems'] = [];
      for (const checklist of checklistInstances) {
        const activity = activities.find(a => a.id === checklist.activityId);
        if (!activity) continue;

        for (const item of checklist.items) {
          if (item.assigneeId === member.id) {
            const isOverdue = item.status !== 'completed' && item.status !== 'skipped'
              && item.dueDate && new Date(item.dueDate) < now;
            assignedItems.push({
              activityName: activity.name,
              itemTitle: item.title,
              status: item.status,
              dueDate: item.dueDate,
              isOverdue: !!isOverdue,
            });
          }
        }
      }

      const overdueCount = assignedItems.filter(i => i.isOverdue).length;

      return { member, leadActivities, teamActivities, assignedItems, overdueCount };
    }).sort((a, b) => {
      // Sort by overdue items first, then by total activities
      if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
      return (b.leadActivities.length + b.teamActivities.length) - (a.leadActivities.length + a.teamActivities.length);
    });
  }, [activeStaff, activities, checklistInstances]);

  const totalOverdue = workloads.reduce((s, w) => s + w.overdueCount, 0);
  const totalAssignments = workloads.reduce((s, w) => s + w.leadActivities.length + w.teamActivities.length, 0);

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Team Overview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Who's working on what across all activities</p>
        </div>
        <Link
          to="/projects/team/directory"
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          Manage Team
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeStaff.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Team Members</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalAssignments}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Activity Assignments</p>
        </div>
        <div className={`rounded-lg border p-4 text-center ${
          totalOverdue > 0
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <p className={`text-2xl font-bold ${totalOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {totalOverdue}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Overdue Items</p>
        </div>
      </div>

      {/* Per-member breakdown */}
      {workloads.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          No active team members. Add staff in the Team Directory.
        </div>
      ) : (
        <div className="space-y-2">
          {workloads.map(({ member, leadActivities, teamActivities, assignedItems, overdueCount }) => {
            const isExpanded = expandedMember === member.id;
            const totalActivities = leadActivities.length + teamActivities.length;

            return (
              <div key={member.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Member header */}
                <button
                  onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>

                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{member.role}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {totalActivities} {totalActivities === 1 ? 'activity' : 'activities'}
                    </span>
                    {assignedItems.length > 0 && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {assignedItems.length} tasks
                      </span>
                    )}
                    {overdueCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-medium">
                        {overdueCount} overdue
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                    {/* Leading activities */}
                    {leadActivities.length > 0 && (
                      <div className="px-4 py-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Leading</p>
                        <div className="space-y-1">
                          {leadActivities.map(a => (
                            <div key={a.id} className="flex items-center gap-2 text-sm">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || STATUS_COLORS.draft}`}>
                                {a.status.replace('_', ' ')}
                              </span>
                              <span className="text-gray-900 dark:text-gray-100">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team activities */}
                    {teamActivities.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Team Member</p>
                        <div className="space-y-1">
                          {teamActivities.map(a => (
                            <div key={a.id} className="flex items-center gap-2 text-sm">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || STATUS_COLORS.draft}`}>
                                {a.status.replace('_', ' ')}
                              </span>
                              <span className="text-gray-900 dark:text-gray-100">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assigned checklist items */}
                    {assignedItems.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Assigned Tasks</p>
                        <div className="space-y-1">
                          {assignedItems.map((item, i) => (
                            <div key={i} className={`flex items-center gap-2 text-sm ${item.isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                item.status === 'completed' ? 'bg-green-500'
                                : item.isOverdue ? 'bg-red-500'
                                : item.status === 'in_progress' ? 'bg-blue-500'
                                : 'bg-gray-400'
                              }`} />
                              <span className={item.status === 'completed' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}>
                                {item.itemTitle}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">— {item.activityName}</span>
                              {item.isOverdue && item.dueDate && (
                                <span className="text-xs font-medium text-red-600 dark:text-red-400 ml-auto">
                                  Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {totalActivities === 0 && assignedItems.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        No assignments yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
