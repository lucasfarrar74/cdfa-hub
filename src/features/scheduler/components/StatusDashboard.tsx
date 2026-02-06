import { useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime } from '../utils/timeUtils';

export default function StatusDashboard() {
  const { meetings, timeSlots, suppliers, buyers } = useSchedule();

  // Calculate meeting statistics
  const stats = useMemo(() => {
    const activeMeetings = meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped');

    return {
      total: activeMeetings.length,
      scheduled: activeMeetings.filter(m => m.status === 'scheduled').length,
      inProgress: activeMeetings.filter(m => m.status === 'in_progress').length,
      completed: activeMeetings.filter(m => m.status === 'completed').length,
      runningLate: activeMeetings.filter(m => m.status === 'running_late').length,
      delayed: activeMeetings.filter(m => m.status === 'delayed').length,
      cancelled: meetings.filter(m => m.status === 'cancelled').length,
    };
  }, [meetings]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats]);

  // Find meetings needing attention (running late or delayed)
  const attentionNeeded = useMemo(() => {
    return meetings.filter(
      m => m.status === 'running_late' || m.status === 'delayed'
    );
  }, [meetings]);

  // Find next upcoming meetings (scheduled, sorted by time slot)
  const upcomingMeetings = useMemo(() => {
    const meetingSlots = timeSlots.filter(s => !s.isBreak);
    const now = new Date();

    // Find current or next time slot
    const currentSlotIndex = meetingSlots.findIndex(
      slot => slot.startTime <= now && slot.endTime > now
    );
    const nextSlotIndex = currentSlotIndex >= 0 ? currentSlotIndex :
      meetingSlots.findIndex(slot => slot.startTime > now);

    if (nextSlotIndex < 0) return [];

    // Get meetings for current and next few slots
    const relevantSlots = meetingSlots.slice(
      Math.max(0, nextSlotIndex),
      Math.min(meetingSlots.length, nextSlotIndex + 3)
    );

    const upcoming: Array<{
      meeting: typeof meetings[0];
      slot: typeof timeSlots[0];
      supplierName: string;
      buyerName: string;
    }> = [];

    relevantSlots.forEach(slot => {
      meetings
        .filter(m => m.timeSlotId === slot.id && m.status === 'scheduled')
        .forEach(meeting => {
          const supplier = suppliers.find(s => s.id === meeting.supplierId);
          const buyer = buyers.find(b => b.id === meeting.buyerId);
          if (supplier && buyer) {
            upcoming.push({
              meeting,
              slot,
              supplierName: supplier.companyName,
              buyerName: buyer.name,
            });
          }
        });
    });

    return upcoming.slice(0, 5);
  }, [meetings, timeSlots, suppliers, buyers]);

  // Get supplier and buyer names for attention items
  const getParticipantNames = (meeting: typeof meetings[0]) => {
    const supplier = suppliers.find(s => s.id === meeting.supplierId);
    const buyer = buyers.find(b => b.id === meeting.buyerId);
    return {
      supplierName: supplier?.companyName || 'Unknown',
      buyerName: buyer?.name || 'Unknown',
    };
  };

  if (meetings.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Status Dashboard</h3>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">Day Progress</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{progressPercent}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.scheduled}</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">Scheduled</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-2">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inProgress}</div>
          <div className="text-xs text-yellow-700 dark:text-yellow-300">In Progress</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 rounded p-2">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
          <div className="text-xs text-green-700 dark:text-green-300">Completed</div>
        </div>
      </div>

      {/* Attention Needed */}
      {attentionNeeded.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Attention Needed ({attentionNeeded.length})
          </h4>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {attentionNeeded.map(meeting => {
              const { supplierName, buyerName } = getParticipantNames(meeting);
              const slot = timeSlots.find(s => s.id === meeting.timeSlotId);
              return (
                <div
                  key={meeting.id}
                  className={`text-xs p-2 rounded ${
                    meeting.status === 'running_late'
                      ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                      : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {meeting.status === 'running_late' ? '🔴' : '⏳'} {supplierName} × {buyerName}
                    </span>
                    {slot && (
                      <span className="opacity-70">{formatTime(slot.startTime)}</span>
                    )}
                  </div>
                  {meeting.delayReason && (
                    <div className="text-[10px] opacity-75 mt-0.5">
                      Reason: {meeting.delayReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upcoming Meetings
          </h4>
          <div className="space-y-1.5">
            {upcomingMeetings.map(({ meeting, slot, supplierName, buyerName }) => (
              <div
                key={meeting.id}
                className="text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded flex items-center justify-between"
              >
                <span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{supplierName}</span>
                  <span className="text-gray-500 dark:text-gray-400"> × </span>
                  <span className="text-gray-900 dark:text-gray-100">{buyerName}</span>
                </span>
                <span className="text-gray-500 dark:text-gray-400">{formatTime(slot.startTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats Footer */}
      {(stats.runningLate > 0 || stats.delayed > 0 || stats.cancelled > 0) && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
          {stats.runningLate > 0 && (
            <span className="text-red-600 dark:text-red-400">{stats.runningLate} running late</span>
          )}
          {stats.delayed > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">{stats.delayed} delayed</span>
          )}
          {stats.cancelled > 0 && (
            <span className="text-gray-400 dark:text-gray-500">{stats.cancelled} cancelled</span>
          )}
        </div>
      )}
    </div>
  );
}
