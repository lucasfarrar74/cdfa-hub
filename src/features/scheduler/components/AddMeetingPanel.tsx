import { useState, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime } from '../utils/timeUtils';
import { getBuyerAvailabilityForSlot } from '../utils/conflictDetection';

interface AddMeetingPanelProps {
  onClose: () => void;
  defaultSupplierId?: string;
  defaultSlotId?: string;
}

export default function AddMeetingPanel({
  onClose,
  defaultSupplierId,
  defaultSlotId,
}: AddMeetingPanelProps) {
  const {
    suppliers,
    buyers,
    meetings,
    timeSlots,
    addMeeting,
    checkAddMeetingConflicts,
  } = useSchedule();

  const [selectedSupplierId, setSelectedSupplierId] = useState(defaultSupplierId || '');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(defaultSlotId || '');
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);

  // Get non-break slots
  const meetingSlots = useMemo(
    () => timeSlots.filter(s => !s.isBreak),
    [timeSlots]
  );

  // Get available slots for selected supplier
  const supplierAvailableSlots = useMemo(() => {
    if (!selectedSupplierId) return meetingSlots;

    return meetingSlots.filter(slot => {
      const hasExistingMeeting = meetings.some(
        m =>
          m.supplierId === selectedSupplierId &&
          m.timeSlotId === slot.id &&
          m.status !== 'cancelled' &&
          m.status !== 'bumped'
      );
      return !hasExistingMeeting;
    });
  }, [selectedSupplierId, meetingSlots, meetings]);

  // Get buyer availability for selected slot
  const buyerAvailability = useMemo(() => {
    if (!selectedSupplierId || !selectedSlotId) return [];

    return buyers.map(buyer => {
      const availability = getBuyerAvailabilityForSlot(
        buyer.id,
        selectedSupplierId,
        selectedSlotId,
        meetings,
        suppliers,
        buyers
      );

      return {
        buyer,
        ...availability,
      };
    });
  }, [selectedSupplierId, selectedSlotId, buyers, meetings, suppliers]);

  // Check conflicts for current selection
  const currentConflicts = useMemo(() => {
    if (!selectedSupplierId || !selectedBuyerId || !selectedSlotId) {
      return null;
    }
    return checkAddMeetingConflicts(selectedSupplierId, selectedBuyerId, selectedSlotId);
  }, [selectedSupplierId, selectedBuyerId, selectedSlotId, checkAddMeetingConflicts]);

  const handleSubmit = () => {
    if (!selectedSupplierId || !selectedBuyerId || !selectedSlotId) return;

    // Check for errors (hard blocks)
    if (currentConflicts?.hasErrors) {
      setShowWarningConfirm(false);
      return;
    }

    // Check for warnings - show confirmation
    if (currentConflicts?.hasWarnings && !showWarningConfirm) {
      setShowWarningConfirm(true);
      return;
    }

    const result = addMeeting(selectedSupplierId, selectedBuyerId, selectedSlotId);
    if (result.success) {
      onClose();
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const selectedBuyer = buyers.find(b => b.id === selectedBuyerId);
  const selectedSlot = timeSlots.find(s => s.id === selectedSlotId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300">Add Meeting</h3>
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
          {/* Supplier Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Supplier
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                setSelectedSlotId('');
                setSelectedBuyerId('');
                setShowWarningConfirm(false);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a supplier...</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Time Slot Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Slot
            </label>
            <select
              value={selectedSlotId}
              onChange={(e) => {
                setSelectedSlotId(e.target.value);
                setSelectedBuyerId('');
                setShowWarningConfirm(false);
              }}
              disabled={!selectedSupplierId}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="">Select a time slot...</option>
              {supplierAvailableSlots.map(slot => (
                <option key={slot.id} value={slot.id}>
                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                </option>
              ))}
            </select>
            {selectedSupplierId && supplierAvailableSlots.length === 0 && (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                No available slots for this supplier
              </p>
            )}
          </div>

          {/* Buyer Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buyer
            </label>
            {selectedSlotId ? (
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {buyerAvailability.map(({ buyer, conflictType, conflictDescription }) => (
                  <button
                    key={buyer.id}
                    onClick={() => {
                      setSelectedBuyerId(buyer.id);
                      setShowWarningConfirm(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${
                      selectedBuyerId === buyer.id
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    } ${conflictType === 'busy' ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      {conflictType === 'none' && (
                        <span className="text-green-500">&#10003;</span>
                      )}
                      {conflictType === 'busy' && (
                        <span className="text-red-500">!</span>
                      )}
                      {conflictType === 'preference' && (
                        <span className="text-amber-500">!</span>
                      )}
                      <div>
                        <span className="text-gray-900 dark:text-gray-100">{buyer.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                          ({buyer.organization})
                        </span>
                      </div>
                    </div>
                    {conflictDescription && (
                      <span className={`text-xs ${
                        conflictType === 'busy' ? 'text-red-500' : 'text-amber-500'
                      }`}>
                        {conflictDescription}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <select
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
              >
                <option>Select a time slot first...</option>
              </select>
            )}
          </div>

          {/* Conflict Preview */}
          {currentConflicts && currentConflicts.hasConflicts && (
            <div className={`p-3 rounded-md ${
              currentConflicts.hasErrors
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
            }`}>
              <p className={`text-sm font-medium ${
                currentConflicts.hasErrors
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {currentConflicts.hasErrors ? 'Cannot Add Meeting' : 'Warning'}
              </p>
              <ul className="mt-1 space-y-1">
                {currentConflicts.conflicts.map((conflict, index) => (
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

          {/* Selection Summary */}
          {selectedSupplier && selectedBuyer && selectedSlot && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Summary</p>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Supplier:</strong> {selectedSupplier.companyName}</p>
                <p><strong>Buyer:</strong> {selectedBuyer.name} ({selectedBuyer.organization})</p>
                <p><strong>Time:</strong> {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</p>
              </div>
            </div>
          )}

          {/* Warning Confirmation */}
          {showWarningConfirm && currentConflicts?.hasWarnings && !currentConflicts.hasErrors && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Proceed with conflicts?
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                The meeting will be added with a conflict indicator. You can resolve conflicts later.
              </p>
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
            onClick={handleSubmit}
            disabled={
              !selectedSupplierId ||
              !selectedBuyerId ||
              !selectedSlotId ||
              currentConflicts?.hasErrors
            }
            className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
              showWarningConfirm
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {showWarningConfirm ? 'Confirm Add' : 'Add Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
