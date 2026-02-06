import { useState, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime, formatDateReadable } from '../utils/timeUtils';

interface CrossDayMoveModalProps {
  meetingId: string;
  targetDate: string;
  onClose: () => void;
  onMove: (targetSlotId: string) => void;
}

export default function CrossDayMoveModal({
  meetingId,
  targetDate,
  onClose,
  onMove,
}: CrossDayMoveModalProps) {
  const {
    meetings,
    suppliers,
    buyers,
    timeSlots,
    checkMoveConflicts,
  } = useSchedule();

  const [selectedSlotId, setSelectedSlotId] = useState<string>('');

  // Get the meeting being moved
  const meeting = useMemo(
    () => meetings.find(m => m.id === meetingId),
    [meetings, meetingId]
  );

  // Get supplier and buyer for this meeting
  const supplier = useMemo(
    () => meeting ? suppliers.find(s => s.id === meeting.supplierId) : null,
    [suppliers, meeting]
  );

  const buyer = useMemo(
    () => meeting ? buyers.find(b => b.id === meeting.buyerId) : null,
    [buyers, meeting]
  );

  // Get available slots on target day for this supplier
  const targetDaySlots = useMemo(() => {
    if (!meeting) return [];

    return timeSlots.filter(slot =>
      slot.date === targetDate &&
      !slot.isBreak &&
      !meetings.some(m =>
        m.supplierId === meeting.supplierId &&
        m.timeSlotId === slot.id &&
        m.status !== 'cancelled' &&
        m.status !== 'bumped' &&
        m.id !== meeting.id // Exclude the meeting being moved
      )
    );
  }, [timeSlots, targetDate, meetings, meeting]);

  // Check conflicts for selected slot
  const conflicts = useMemo(() => {
    if (!selectedSlotId) return null;
    return checkMoveConflicts(meetingId, selectedSlotId);
  }, [selectedSlotId, meetingId, checkMoveConflicts]);

  // Get conflict info for each available slot (for preview)
  const slotConflictPreview = useMemo(() => {
    const preview = new Map<string, { hasBuyerConflict: boolean; hasWarning: boolean }>();

    for (const slot of targetDaySlots) {
      const result = checkMoveConflicts(meetingId, slot.id);
      preview.set(slot.id, {
        hasBuyerConflict: result.conflicts.some(c => c.type === 'buyer_busy'),
        hasWarning: result.hasWarnings,
      });
    }

    return preview;
  }, [targetDaySlots, meetingId, checkMoveConflicts]);

  if (!meeting || !supplier || !buyer) {
    return null;
  }

  const handleConfirm = () => {
    if (!selectedSlotId) return;
    if (conflicts?.hasErrors) return;
    onMove(selectedSlotId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-purple-800 dark:text-purple-300">
              Move Meeting to {formatDateReadable(targetDate)}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Meeting Info */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Moving Meeting</p>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Supplier:</strong> {supplier.companyName}</p>
              <p><strong>Buyer:</strong> {buyer.name} ({buyer.organization})</p>
            </div>
          </div>

          {/* Slot Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select New Time Slot
            </label>
            {targetDaySlots.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  No available slots on {formatDateReadable(targetDate)} for {supplier.companyName}
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {targetDaySlots.map(slot => {
                  const preview = slotConflictPreview.get(slot.id);
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                        selectedSlotId === slot.id
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {!preview?.hasWarning && (
                          <span className="text-green-500">&#10003;</span>
                        )}
                        {preview?.hasBuyerConflict && (
                          <span className="text-amber-500">!</span>
                        )}
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </span>
                      </div>
                      {preview?.hasBuyerConflict && (
                        <span className="text-xs text-amber-500">
                          Buyer conflict
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conflict Warning */}
          {conflicts && conflicts.hasConflicts && (
            <div className={`p-3 rounded-md ${
              conflicts.hasErrors
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
            }`}>
              <p className={`text-sm font-medium ${
                conflicts.hasErrors
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {conflicts.hasErrors ? 'Cannot Move' : 'Warning'}
              </p>
              <ul className="mt-1 space-y-1">
                {conflicts.conflicts.map((conflict, index) => (
                  <li key={index} className={`text-xs ${
                    conflict.severity === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {conflict.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSlotId || conflicts?.hasErrors || targetDaySlots.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Move Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
