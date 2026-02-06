import { useState, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityEventType } from '../types';

// Activity tracking hook - stores in memory for current session
// In a real app, this would be synced via Firebase
interface ActivityItem {
  id: string;
  type: ActivityEventType;
  timestamp: string;
  supplierName?: string;
  buyerName?: string;
  reason?: string;
  userName?: string;
}

// Generate recent activity from meeting states
function useActivityFromMeetings() {
  const { meetings, suppliers, buyers } = useSchedule();

  return useMemo(() => {
    const activities: ActivityItem[] = [];

    meetings.forEach(meeting => {
      const supplier = suppliers.find(s => s.id === meeting.supplierId);
      const buyer = buyers.find(b => b.id === meeting.buyerId);

      if (!supplier || !buyer) return;

      // Generate activity based on meeting status
      if (meeting.status === 'completed') {
        activities.push({
          id: `${meeting.id}-completed`,
          type: 'meeting_completed',
          timestamp: meeting.delayedAt || new Date().toISOString(),
          supplierName: supplier.companyName,
          buyerName: buyer.name,
        });
      } else if (meeting.status === 'in_progress') {
        activities.push({
          id: `${meeting.id}-started`,
          type: 'meeting_started',
          timestamp: meeting.delayedAt || new Date().toISOString(),
          supplierName: supplier.companyName,
          buyerName: buyer.name,
        });
      } else if (meeting.status === 'delayed') {
        activities.push({
          id: `${meeting.id}-delayed`,
          type: 'meeting_delayed',
          timestamp: meeting.delayedAt || new Date().toISOString(),
          supplierName: supplier.companyName,
          buyerName: buyer.name,
          reason: meeting.delayReason,
        });
      } else if (meeting.status === 'running_late') {
        activities.push({
          id: `${meeting.id}-late`,
          type: 'meeting_delayed',
          timestamp: meeting.delayedAt || new Date().toISOString(),
          supplierName: supplier.companyName,
          buyerName: buyer.name,
          reason: 'Running over time',
        });
      } else if (meeting.status === 'bumped') {
        activities.push({
          id: `${meeting.id}-bumped`,
          type: 'meeting_bumped',
          timestamp: meeting.delayedAt || new Date().toISOString(),
          supplierName: supplier.companyName,
          buyerName: buyer.name,
        });
      } else if (meeting.status === 'cancelled') {
        activities.push({
          id: `${meeting.id}-cancelled`,
          type: 'meeting_cancelled',
          timestamp: new Date().toISOString(),
          supplierName: supplier.companyName,
          buyerName: buyer.name,
        });
      }
    });

    // Sort by timestamp, most recent first
    return activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [meetings, suppliers, buyers]);
}

const activityConfig: Record<ActivityEventType, { icon: string; color: string; verb: string }> = {
  meeting_started: { icon: '▶', color: 'text-blue-600', verb: 'started' },
  meeting_completed: { icon: '✓', color: 'text-green-600', verb: 'completed' },
  meeting_delayed: { icon: '⏳', color: 'text-yellow-600', verb: 'was delayed' },
  meeting_bumped: { icon: '➡️', color: 'text-purple-600', verb: 'was bumped' },
  meeting_cancelled: { icon: '✕', color: 'text-red-600', verb: 'was cancelled' },
  schedule_generated: { icon: '📅', color: 'text-blue-600', verb: 'Schedule was generated' },
  schedule_cleared: { icon: '🗑️', color: 'text-gray-600', verb: 'Schedule was cleared' },
};

interface ActivityFeedProps {
  maxItems?: number;
  compact?: boolean;
}

export default function ActivityFeed({ maxItems = 10, compact = false }: ActivityFeedProps) {
  const activities = useActivityFromMeetings();
  const [filter, setFilter] = useState<ActivityEventType | 'all'>('all');

  const filteredActivities = useMemo(() => {
    const filtered = filter === 'all'
      ? activities
      : activities.filter(a => a.type === filter);
    return filtered.slice(0, maxItems);
  }, [activities, filter, maxItems]);

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Activity Feed</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet. Changes will appear here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Activity Feed</h3>
        {!compact && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ActivityEventType | 'all')}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Activity</option>
            <option value="meeting_completed">Completed</option>
            <option value="meeting_delayed">Delayed</option>
            <option value="meeting_bumped">Bumped</option>
            <option value="meeting_cancelled">Cancelled</option>
          </select>
        )}
      </div>

      <div className={`space-y-2 ${compact ? 'max-h-48' : 'max-h-64'} overflow-y-auto`}>
        {filteredActivities.map(activity => {
          const config = activityConfig[activity.type];
          return (
            <div
              key={activity.id}
              className="flex items-start gap-2 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0"
            >
              <span className={`${config.color} mt-0.5`}>{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-gray-800 dark:text-gray-200">
                  {activity.supplierName && activity.buyerName ? (
                    <>
                      <span className="font-medium">{activity.supplierName}</span>
                      <span className="text-gray-500 dark:text-gray-400"> × </span>
                      <span className="font-medium">{activity.buyerName}</span>
                      <span className="text-gray-600 dark:text-gray-400"> {config.verb}</span>
                    </>
                  ) : (
                    <span>{config.verb}</span>
                  )}
                </div>
                {activity.reason && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {activity.reason}
                  </div>
                )}
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activities.length > maxItems && (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          Showing {maxItems} of {activities.length} activities
        </div>
      )}
    </div>
  );
}
