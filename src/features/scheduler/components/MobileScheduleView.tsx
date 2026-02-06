import { useState, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime } from '../utils/timeUtils';
import { getBuyerColor } from '../utils/colors';
import type { Meeting, TimeSlot, Supplier, Buyer, MeetingStatus } from '../types';

interface MobileScheduleViewProps {
  onMeetingClick?: (meeting: Meeting, slot: TimeSlot) => void;
  onStatusChange?: (meetingId: string, status: MeetingStatus) => void;
}

type ViewMode = 'timeline' | 'supplier' | 'buyer';

export default function MobileScheduleView({ onMeetingClick, onStatusChange }: MobileScheduleViewProps) {
  const { meetings, timeSlots, suppliers, buyers, updateMeetingStatus } = useSchedule();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(
    suppliers.length > 0 ? suppliers[0].id : null
  );
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(
    buyers.length > 0 ? buyers[0].id : null
  );
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  const meetingSlots = useMemo(() =>
    timeSlots.filter(s => !s.isBreak),
    [timeSlots]
  );

  const activeMeetings = useMemo(() =>
    meetings.filter(m => m.status !== 'cancelled' && m.status !== 'bumped'),
    [meetings]
  );

  const getBuyer = (id: string): Buyer | undefined => buyers.find(b => b.id === id);
  const getSupplier = (id: string): Supplier | undefined => suppliers.find(s => s.id === id);

  const getStatusColor = (status: MeetingStatus): string => {
    const colors: Record<MeetingStatus, string> = {
      scheduled: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
      in_progress: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700',
      completed: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
      delayed: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
      running_late: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
      bumped: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',
      cancelled: 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600',
    };
    return colors[status];
  };

  const getStatusIcon = (status: MeetingStatus): string => {
    const icons: Record<MeetingStatus, string> = {
      scheduled: '📅',
      in_progress: '▶️',
      completed: '✅',
      delayed: '⏳',
      running_late: '🔴',
      bumped: '➡️',
      cancelled: '❌',
    };
    return icons[status];
  };

  const handleStatusCycle = (meeting: Meeting) => {
    const statusFlow: MeetingStatus[] = ['scheduled', 'in_progress', 'completed'];
    const currentIndex = statusFlow.indexOf(meeting.status);
    const nextIndex = (currentIndex + 1) % statusFlow.length;
    const newStatus = statusFlow[nextIndex];

    if (onStatusChange) {
      onStatusChange(meeting.id, newStatus);
    } else {
      updateMeetingStatus(meeting.id, newStatus);
    }
  };

  // Timeline view - shows all meetings grouped by time slot
  const renderTimelineView = () => (
    <div className="space-y-3">
      {meetingSlots.map(slot => {
        const slotMeetings = activeMeetings.filter(m => m.timeSlotId === slot.id);
        const isExpanded = expandedSlot === slot.id;

        return (
          <div
            key={slot.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden"
          >
            <button
              onClick={() => setExpandedSlot(isExpanded ? null : slot.id)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatTime(slot.startTime)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({slotMeetings.length} meetings)
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="p-3 space-y-2">
                {slotMeetings.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                    No meetings scheduled
                  </p>
                ) : (
                  slotMeetings.map((meeting) => {
                    const supplier = getSupplier(meeting.supplierId);
                    const buyer = getBuyer(meeting.buyerId);
                    const buyerColor = buyer?.color || getBuyerColor(buyers.indexOf(buyer!));

                    return (
                      <div
                        key={meeting.id}
                        className={`p-3 rounded-lg border-l-4 ${getStatusColor(meeting.status)}`}
                        style={{ borderLeftColor: buyerColor }}
                        onClick={() => onMeetingClick?.(meeting, slot)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {supplier?.companyName}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {buyer?.name}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusCycle(meeting);
                            }}
                            className="ml-2 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                          >
                            {getStatusIcon(meeting.status)} {meeting.status.replace('_', ' ')}
                          </button>
                        </div>
                        {meeting.delayReason && (
                          <div className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                            {meeting.delayReason}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Supplier view - shows one supplier's schedule
  const renderSupplierView = () => {
    const supplier = suppliers.find(s => s.id === selectedSupplier);
    const supplierMeetings = activeMeetings.filter(m => m.supplierId === selectedSupplier);

    return (
      <div className="space-y-3">
        {/* Supplier Selector */}
        <select
          value={selectedSupplier || ''}
          onChange={(e) => setSelectedSupplier(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
        >
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.companyName}</option>
          ))}
        </select>

        {supplier && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {supplier.companyName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {supplier.primaryContact.name}
            </p>
          </div>
        )}

        {/* Timeline for this supplier */}
        <div className="space-y-2">
          {meetingSlots.map(slot => {
            const meeting = supplierMeetings.find(m => m.timeSlotId === slot.id);
            const buyer = meeting ? getBuyer(meeting.buyerId) : null;

            return (
              <div
                key={slot.id}
                className={`p-3 rounded-lg border ${
                  meeting
                    ? getStatusColor(meeting.status)
                    : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => meeting && onMeetingClick?.(meeting, slot)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-16">
                    {formatTime(slot.startTime)}
                  </span>
                  {meeting && buyer ? (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {buyer.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusCycle(meeting);
                        }}
                        className="text-xs px-2 py-1 rounded bg-white/50 dark:bg-gray-600/50"
                      >
                        {getStatusIcon(meeting.status)}
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Buyer view - shows one buyer's schedule
  const renderBuyerView = () => {
    const buyer = buyers.find(b => b.id === selectedBuyer);
    const buyerMeetings = activeMeetings.filter(m => m.buyerId === selectedBuyer);

    return (
      <div className="space-y-3">
        {/* Buyer Selector */}
        <select
          value={selectedBuyer || ''}
          onChange={(e) => setSelectedBuyer(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
        >
          {buyers.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {buyer && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {buyer.name}
            </h3>
            {buyer.organization && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {buyer.organization}
              </p>
            )}
          </div>
        )}

        {/* Timeline for this buyer */}
        <div className="space-y-2">
          {meetingSlots.map(slot => {
            const meeting = buyerMeetings.find(m => m.timeSlotId === slot.id);
            const supplier = meeting ? getSupplier(meeting.supplierId) : null;

            return (
              <div
                key={slot.id}
                className={`p-3 rounded-lg border ${
                  meeting
                    ? getStatusColor(meeting.status)
                    : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                }`}
                onClick={() => meeting && onMeetingClick?.(meeting, slot)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-16">
                    {formatTime(slot.startTime)}
                  </span>
                  {meeting && supplier ? (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {supplier.companyName}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusCycle(meeting);
                        }}
                        className="text-xs px-2 py-1 rounded bg-white/50 dark:bg-gray-600/50"
                      >
                        {getStatusIcon(meeting.status)}
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (meetings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No schedule generated yet. Generate a schedule to view it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Mode Selector */}
      <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {(['timeline', 'supplier', 'buyer'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {mode === 'timeline' && 'Timeline'}
            {mode === 'supplier' && 'By Supplier'}
            {mode === 'buyer' && 'By Buyer'}
          </button>
        ))}
      </div>

      {/* View Content */}
      {viewMode === 'timeline' && renderTimelineView()}
      {viewMode === 'supplier' && renderSupplierView()}
      {viewMode === 'buyer' && renderBuyerView()}
    </div>
  );
}
