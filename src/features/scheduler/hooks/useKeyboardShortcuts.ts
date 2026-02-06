import { useEffect, useCallback, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';

export interface SelectedCell {
  supplierId: string;
  timeSlotId: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onSelectionChange?: (cell: SelectedCell | null) => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, onSelectionChange } = options;
  const {
    suppliers,
    timeSlots,
    meetings,
    updateMeetingStatus,
    markMeetingDelayed,
    bumpMeeting,
    startMeeting,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSchedule();

  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  // Get meeting slots (non-break time slots)
  const meetingSlots = timeSlots.filter(s => !s.isBreak);

  // Find meeting at selected cell
  const selectedMeeting = selectedCell
    ? meetings.find(
        m =>
          m.supplierId === selectedCell.supplierId &&
          m.timeSlotId === selectedCell.timeSlotId &&
          m.status !== 'cancelled' &&
          m.status !== 'bumped'
      )
    : null;

  // Update external listener when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedCell);
  }, [selectedCell, onSelectionChange]);

  // Navigate to adjacent cell
  const navigate = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!selectedCell) {
        // Select first cell if nothing selected
        if (suppliers.length > 0 && meetingSlots.length > 0) {
          setSelectedCell({
            supplierId: suppliers[0].id,
            timeSlotId: meetingSlots[0].id,
          });
        }
        return;
      }

      const supplierIndex = suppliers.findIndex(s => s.id === selectedCell.supplierId);
      const slotIndex = meetingSlots.findIndex(s => s.id === selectedCell.timeSlotId);

      let newSupplierIndex = supplierIndex;
      let newSlotIndex = slotIndex;

      switch (direction) {
        case 'up':
          newSupplierIndex = Math.max(0, supplierIndex - 1);
          break;
        case 'down':
          newSupplierIndex = Math.min(suppliers.length - 1, supplierIndex + 1);
          break;
        case 'left':
          newSlotIndex = Math.max(0, slotIndex - 1);
          break;
        case 'right':
          newSlotIndex = Math.min(meetingSlots.length - 1, slotIndex + 1);
          break;
      }

      if (newSupplierIndex !== supplierIndex || newSlotIndex !== slotIndex) {
        setSelectedCell({
          supplierId: suppliers[newSupplierIndex].id,
          timeSlotId: meetingSlots[newSlotIndex].id,
        });
      }
    },
    [selectedCell, suppliers, meetingSlots]
  );

  // Toggle meeting status: scheduled -> in_progress -> completed -> scheduled
  const toggleStatus = useCallback(() => {
    if (!selectedMeeting) return;

    const statusCycle: Record<string, string> = {
      scheduled: 'in_progress',
      in_progress: 'completed',
      completed: 'scheduled',
      running_late: 'completed',
      delayed: 'in_progress',
    };

    const nextStatus = statusCycle[selectedMeeting.status];
    if (nextStatus) {
      if (nextStatus === 'in_progress') {
        startMeeting(selectedMeeting.id);
      } else {
        updateMeetingStatus(selectedMeeting.id, nextStatus as Parameters<typeof updateMeetingStatus>[1]);
      }
    }
  }, [selectedMeeting, updateMeetingStatus, startMeeting]);

  // Mark meeting as delayed
  const markDelayed = useCallback(() => {
    if (!selectedMeeting) return;
    markMeetingDelayed(selectedMeeting.id);
  }, [selectedMeeting, markMeetingDelayed]);

  // Bump meeting to later slot
  const bump = useCallback(() => {
    if (!selectedMeeting) return;
    const result = bumpMeeting(selectedMeeting.id);
    if (!result.success) {
      console.warn('Failed to bump meeting:', result.message);
    }
  }, [selectedMeeting, bumpMeeting]);

  // Handle key events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Handle undo/redo with Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            // Ctrl+Shift+Z = Redo
            if (canRedo) {
              e.preventDefault();
              redo();
            }
          } else {
            // Ctrl+Z = Undo
            if (canUndo) {
              e.preventDefault();
              undo();
            }
          }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          // Ctrl+Y = Redo
          if (canRedo) {
            e.preventDefault();
            redo();
          }
          return;
        }
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigate('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigate('right');
          break;
        case ' ': // Space
          e.preventDefault();
          toggleStatus();
          break;
        case 'd':
        case 'D':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            markDelayed();
          }
          break;
        case 'b':
        case 'B':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            bump();
          }
          break;
        case 'Escape':
          setSelectedCell(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, navigate, toggleStatus, markDelayed, bump, undo, redo, canUndo, canRedo]);

  return {
    selectedCell,
    setSelectedCell,
    selectedMeeting,
    navigate,
    toggleStatus,
    markDelayed,
    bump,
  };
}
