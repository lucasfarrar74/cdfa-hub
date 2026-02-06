import { formatTime } from '../utils/timeUtils';
import type { Meeting, TimeSlot, Supplier, Buyer } from '../types';

interface BumpPreviewModalProps {
  meeting: Meeting;
  currentSlot: TimeSlot;
  targetSlot: TimeSlot;
  supplier: Supplier;
  buyer: Buyer;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BumpPreviewModal({
  currentSlot,
  targetSlot,
  supplier,
  buyer,
  onConfirm,
  onCancel,
}: BumpPreviewModalProps) {
  // Calculate time difference
  const timeDiffMs = targetSlot.startTime.getTime() - currentSlot.startTime.getTime();
  const timeDiffMinutes = Math.round(timeDiffMs / (1000 * 60));
  const hours = Math.floor(timeDiffMinutes / 60);
  const minutes = timeDiffMinutes % 60;

  let timeDiffText = '';
  if (hours > 0 && minutes > 0) {
    timeDiffText = `${hours}h ${minutes}m later`;
  } else if (hours > 0) {
    timeDiffText = `${hours} hour${hours > 1 ? 's' : ''} later`;
  } else {
    timeDiffText = `${minutes} minute${minutes > 1 ? 's' : ''} later`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-gray-900/50 max-w-md w-full mx-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bump Meeting Preview</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Meeting Details */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Meeting between</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{supplier.companyName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">and</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{buyer.name}</p>
            {buyer.organization && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{buyer.organization}</p>
            )}
          </div>

          {/* Time Change Visualization */}
          <div className="flex items-center gap-3">
            {/* Current Time */}
            <div className="flex-1 text-center p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Current</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatTime(currentSlot.startTime)}</p>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center">
              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{timeDiffText}</p>
            </div>

            {/* New Time */}
            <div className="flex-1 text-center p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">New</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatTime(targetSlot.startTime)}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            The original slot will be marked as bumped and a new meeting will be created at the later time.
          </p>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-3 justify-end rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-purple-600 dark:bg-purple-500 rounded-md hover:bg-purple-700 dark:hover:bg-purple-600"
          >
            Confirm Bump
          </button>
        </div>
      </div>
    </div>
  );
}
