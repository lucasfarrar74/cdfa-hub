import { useState, useMemo, useCallback, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { formatTime, getUniqueDatesFromSlots, formatDateReadable } from '../utils/timeUtils';
import { createBuyerColorMap, getContrastTextColor, getLighterColor } from '../utils/colors';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getBuyerAvailabilityForSlot } from '../utils/conflictDetection';
import StatusDashboard from './StatusDashboard';
import ActivityFeed from './ActivityFeed';
import BumpPreviewModal from './BumpPreviewModal';
import MobileScheduleView from './MobileScheduleView';
import ConflictSummaryPanel from './ConflictSummaryPanel';
import ConflictWarningModal from './ConflictWarningModal';
import AddMeetingPanel from './AddMeetingPanel';
import CrossDayMoveModal from './CrossDayMoveModal';
import type { Meeting, Buyer, ConflictInfo } from '../types';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

type ViewMode = 'grid' | 'supplier' | 'buyer';

// Droppable slot component for empty cells and cells with meetings
function DroppableSlot({
  id,
  isEmpty,
  children,
}: {
  id: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'slot', isEmpty },
  });

  return (
    <td
      ref={setNodeRef}
      className={`px-3 py-2 relative transition-colors ${
        isOver && isEmpty ? 'bg-blue-100 dark:bg-blue-900/30' : ''
      }`}
    >
      {children}
    </td>
  );
}

// Draggable meeting cell component
function DraggableMeeting({
  meeting,
  buyer,
  buyerColorMap,
  onToggleMenu,
  conflicts = [],
  isHighlighted = false,
  children,
}: {
  meeting: Meeting;
  buyer: Buyer;
  buyerColorMap: Map<string, string>;
  onToggleMenu: () => void;
  conflicts?: ConflictInfo[];
  isHighlighted?: boolean;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: meeting.id,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const buyerColor = buyerColorMap.get(buyer.id) || '#3B82F6';

  // Check for conflicts
  const hasBuyerConflict = conflicts.some(c => c.type === 'buyer_busy');
  const hasPreferenceViolation = conflicts.some(c => c.type === 'preference_violation');
  const hasConflict = conflicts.length > 0;

  // Determine colors based on status
  let bgColor: string;
  let borderColor: string;
  let pulseClass = '';
  let statusIcon = '';

  switch (meeting.status) {
    case 'completed':
      bgColor = getLighterColor(buyerColor, 0.7);
      borderColor = buyerColor;
      statusIcon = '✓';
      break;
    case 'in_progress':
      bgColor = getLighterColor('#3B82F6', 0.8);
      borderColor = '#3B82F6';
      pulseClass = 'animate-pulse';
      statusIcon = '▶';
      break;
    case 'running_late':
      bgColor = getLighterColor('#EF4444', 0.85);
      borderColor = '#EF4444';
      pulseClass = 'animate-pulse';
      statusIcon = '🔴';
      break;
    case 'delayed':
      bgColor = getLighterColor('#F59E0B', 0.85);
      borderColor = '#F59E0B';
      statusIcon = '⏳';
      break;
    default:
      bgColor = getLighterColor(buyerColor, 0.85);
      borderColor = buyerColor;
      statusIcon = '';
  }

  const textColor = getContrastTextColor(bgColor);

  // Conflict ring classes
  let conflictRingClass = '';
  if (isHighlighted) {
    conflictRingClass = 'ring-4 ring-blue-500 animate-pulse';
  } else if (hasBuyerConflict) {
    conflictRingClass = 'ring-2 ring-red-500';
  } else if (hasPreferenceViolation) {
    conflictRingClass = 'ring-2 ring-amber-500';
  }

  // Build tooltip
  let tooltipText = meeting.delayReason ? `Delay reason: ${meeting.delayReason}` : 'Drag to move';
  if (hasConflict) {
    tooltipText = conflicts.map(c => c.description).join('\n');
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        {...attributes}
        {...listeners}
        className={`p-2 rounded text-xs cursor-grab active:cursor-grabbing border-l-4 ${pulseClass} ${conflictRingClass} ${
          isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''
        }`}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          borderLeftColor: borderColor,
        }}
        onClick={(e) => {
          // Don't toggle menu if we're in the middle of a drag
          if (!isDragging) {
            e.stopPropagation();
            onToggleMenu();
          }
        }}
        title={tooltipText}
      >
        {/* Conflict Badge */}
        {hasConflict && (
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
            hasBuyerConflict
              ? 'bg-red-500 text-white'
              : 'bg-amber-500 text-white'
          }`} title={conflicts.map(c => c.description).join('\n')}>
            {hasBuyerConflict ? '!' : '!'}
          </div>
        )}
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium">{buyer.name}</span>
          {statusIcon && <span className="text-[10px]">{statusIcon}</span>}
        </div>
        <div className="text-[10px] opacity-80">{buyer.organization}</div>
        {meeting.originalTimeSlotId && (
          <div className="text-[9px] opacity-60 mt-0.5">↪ Rescheduled</div>
        )}
      </div>
      {children}
    </div>
  );
}

export default function SchedulePanel() {
  const {
    eventConfig,
    suppliers,
    buyers,
    meetings,
    timeSlots,
    unscheduledPairs,
    isGenerating,
    generateSchedule,
    clearSchedule,
    cancelMeeting,
    updateMeetingStatus,
    autoFillGaps,
    markMeetingDelayed,
    markMeetingRunningLate,
    startMeeting,
    bumpMeeting,
    findNextAvailableSlot,
    moveMeeting,
    swapMeetings,
    addMeeting,
    checkMoveConflicts,
    getMeetingConflicts,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSchedule();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeMeetingMenu, setActiveMeetingMenu] = useState<string | null>(null);
  const [delayReasonInput, setDelayReasonInput] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [bumpPreview, setBumpPreview] = useState<{
    meetingId: string;
    targetSlotId: string;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Add meeting panel state
  const [showAddMeetingPanel, setShowAddMeetingPanel] = useState(false);
  const [addMeetingDefaults, setAddMeetingDefaults] = useState<{
    supplierId?: string;
    slotId?: string;
  }>({});

  // Click-on-slot dropdown state
  const [slotDropdown, setSlotDropdown] = useState<{
    supplierId: string;
    slotId: string;
  } | null>(null);

  // Conflict modal state
  const [conflictModal, setConflictModal] = useState<{
    title: string;
    conflicts: ConflictInfo[];
    onConfirm?: () => void;
  } | null>(null);

  // Highlighted meeting for conflict resolution
  const [highlightedMeetingId, setHighlightedMeetingId] = useState<string | null>(null);

  // Cross-day move state
  const [crossDayMove, setCrossDayMove] = useState<{
    meetingId: string;
    targetDate: string;
  } | null>(null);

  // Show open slots highlighting
  const [showOpenSlots, setShowOpenSlots] = useState(false);

  // Track which meeting is being moved for contextual slot highlighting
  const [movingMeetingId, setMovingMeetingId] = useState<string | null>(null);

  // Move to Day submenu state
  const [showMoveToDayMenu, setShowMoveToDayMenu] = useState(false);

  // Ref for highlight timeout to prevent stale closures
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Drag and drop state
  const [activeDragMeeting, setActiveDragMeeting] = useState<Meeting | null>(null);

  // Configure drag sensors - require a small movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Mobile detection
  const isMobile = useIsMobile();

  // Keyboard shortcuts (disabled on mobile)
  useKeyboardShortcuts({
    enabled: meetings.length > 0 && viewMode === 'grid' && !isMobile,
  });

  // Memoized Maps for O(1) lookups instead of O(n)
  const meetingMap = useMemo(() => {
    const map = new Map<string, Map<string, Meeting>>();
    meetings.forEach(m => {
      if (m.status === 'cancelled' || m.status === 'bumped') return;
      if (!map.has(m.supplierId)) map.set(m.supplierId, new Map());
      map.get(m.supplierId)!.set(m.timeSlotId, m);
    });
    return map;
  }, [meetings]);

  const buyerMeetingMap = useMemo(() => {
    const map = new Map<string, Map<string, Meeting>>();
    meetings.forEach(m => {
      if (m.status === 'cancelled' || m.status === 'bumped') return;
      if (!map.has(m.buyerId)) map.set(m.buyerId, new Map());
      map.get(m.buyerId)!.set(m.timeSlotId, m);
    });
    return map;
  }, [meetings]);

  const buyerMap = useMemo(() => new Map(buyers.map(b => [b.id, b])), [buyers]);
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
  const buyerColorMap = useMemo(() => createBuyerColorMap(buyers), [buyers]);

  // Memoized conflict map for all meetings
  const meetingConflictMap = useMemo(() => {
    const map = new Map<string, ConflictInfo[]>();
    meetings.forEach(m => {
      if (m.status !== 'cancelled' && m.status !== 'bumped') {
        const conflicts = getMeetingConflicts(m.id);
        if (conflicts.length > 0) {
          map.set(m.id, conflicts);
        }
      }
    });
    return map;
  }, [meetings, getMeetingConflicts]);

  const [showColorLegend, setShowColorLegend] = useState(true);

  // Multi-day support: get unique dates and filter by selected day
  const eventDates = useMemo(() => getUniqueDatesFromSlots(timeSlots), [timeSlots]);
  const isMultiDay = eventDates.length > 1;
  const currentDay = selectedDay || eventDates[0] || '';

  // Filter time slots by selected day
  const dayTimeSlots = useMemo(
    () => isMultiDay ? timeSlots.filter(s => s.date === currentDay) : timeSlots,
    [timeSlots, currentDay, isMultiDay]
  );

  // Calculate slot availability when moving a specific meeting
  const movingMeetingSlotStatus = useMemo(() => {
    if (!movingMeetingId) return null;

    const meeting = meetings.find(m => m.id === movingMeetingId);
    if (!meeting) return null;

    const statusMap = new Map<string, 'free' | 'warning' | 'blocked'>();

    for (const slot of dayTimeSlots) {
      if (slot.isBreak) continue;

      // Check if supplier is busy at this slot (excluding the meeting being moved)
      const supplierBusy = meetings.some(m =>
        m.supplierId === meeting.supplierId &&
        m.timeSlotId === slot.id &&
        m.status !== 'cancelled' &&
        m.status !== 'bumped' &&
        m.id !== movingMeetingId
      );

      if (supplierBusy) {
        statusMap.set(slot.id, 'blocked');
        continue;
      }

      // Check if buyer is busy at this slot (excluding the meeting being moved)
      const buyerBusy = meetings.some(m =>
        m.buyerId === meeting.buyerId &&
        m.timeSlotId === slot.id &&
        m.status !== 'cancelled' &&
        m.status !== 'bumped' &&
        m.id !== movingMeetingId
      );

      statusMap.set(slot.id, buyerBusy ? 'warning' : 'free');
    }

    return { meeting, statusMap };
  }, [movingMeetingId, meetings, dayTimeSlots]);

  // Memoized filtered arrays
  const meetingSlots = useMemo(() => dayTimeSlots.filter(s => !s.isBreak), [dayTimeSlots]);
  const cancelledCount = useMemo(() => meetings.filter(m => m.status === 'cancelled').length, [meetings]);
  const scheduledCount = useMemo(() => meetings.filter(m => m.status === 'scheduled').length, [meetings]);

  // O(1) lookup functions
  const getMeetingForSlot = (supplierId: string, slotId: string) =>
    meetingMap.get(supplierId)?.get(slotId);

  const getBuyerMeetingForSlot = (buyerId: string, slotId: string) =>
    buyerMeetingMap.get(buyerId)?.get(slotId);

  const getBuyer = (id: string) => buyerMap.get(id);
  const getSupplier = (id: string) => supplierMap.get(id);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const meetingId = event.active.id as string;
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      setActiveDragMeeting(meeting);
      setMovingMeetingId(meetingId); // Set context for slot highlighting
      setActiveMeetingMenu(null); // Close any open menus
    }
  }, [meetings]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragMeeting(null);
    setMovingMeetingId(null); // Clear context for slot highlighting

    if (!over) return;

    const draggedMeetingId = active.id as string;
    const draggedMeeting = meetings.find(m => m.id === draggedMeetingId);
    if (!draggedMeeting) return;

    const overId = over.id as string;

    // Check if dropping on another meeting (swap)
    const targetMeeting = meetings.find(m => m.id === overId);
    if (targetMeeting) {
      // Swap meetings
      swapMeetings(draggedMeetingId, targetMeeting.id);
      return;
    }

    // Check if dropping on an empty slot
    // Slot IDs are formatted as "slot-{supplierId}-{slotId}"
    if (overId.startsWith('slot-')) {
      const parts = overId.split('-');
      // Validate we have at least 3 parts: "slot", supplierId, and slotId
      if (parts.length < 3) return;
      const targetSupplierId = parts[1];
      const targetSlotId = parts.slice(2).join('-');
      // Validate both IDs are present
      if (!targetSupplierId || !targetSlotId) return;

      // Only allow dropping within the same supplier column
      if (targetSupplierId === draggedMeeting.supplierId) {
        // Check if slot is empty for supplier
        const existingMeeting = getMeetingForSlot(targetSupplierId, targetSlotId);
        if (!existingMeeting) {
          // Check for conflicts before moving
          const conflictResult = checkMoveConflicts(draggedMeetingId, targetSlotId);

          if (conflictResult.hasErrors) {
            // Show error modal - cannot proceed
            setConflictModal({
              title: 'Cannot Move Meeting',
              conflicts: conflictResult.conflicts,
            });
          } else if (conflictResult.hasWarnings) {
            // Show warning but allow with confirmation
            setConflictModal({
              title: 'Move Meeting with Conflicts?',
              conflicts: conflictResult.conflicts,
              onConfirm: () => {
                moveMeeting(draggedMeetingId, targetSlotId);
                setConflictModal(null);
              },
            });
          } else {
            // No conflicts - move directly
            moveMeeting(draggedMeetingId, targetSlotId);
          }
        }
      }
    }
  }, [meetings, swapMeetings, moveMeeting, getMeetingForSlot, checkMoveConflicts]);

  // Handler for clicking on empty slot
  const handleEmptySlotClick = useCallback((supplierId: string, slotId: string) => {
    setSlotDropdown({ supplierId, slotId });
    setActiveMeetingMenu(null);
  }, []);

  // Handler for adding meeting from slot dropdown
  const handleAddMeetingFromSlot = useCallback((buyerId: string) => {
    if (!slotDropdown) return;

    const { supplierId, slotId } = slotDropdown;

    // Get buyer availability to check for conflicts
    const availability = getBuyerAvailabilityForSlot(
      buyerId,
      supplierId,
      slotId,
      meetings,
      suppliers,
      buyers
    );

    if (availability.conflictType === 'busy' || availability.conflictType === 'preference') {
      // Has warning conflicts - show confirmation
      const conflicts: ConflictInfo[] = [];
      if (availability.conflictType === 'busy') {
        conflicts.push({
          type: 'buyer_busy',
          severity: 'warning',
          description: availability.conflictDescription || 'Buyer is busy at this time',
          affectedPartyName: buyers.find(b => b.id === buyerId)?.name || 'Buyer',
        });
      }
      if (availability.conflictType === 'preference') {
        conflicts.push({
          type: 'preference_violation',
          severity: 'warning',
          description: availability.conflictDescription || 'Violates supplier preference',
          affectedPartyName: suppliers.find(s => s.id === supplierId)?.companyName || 'Supplier',
        });
      }

      setConflictModal({
        title: 'Add Meeting with Conflicts?',
        conflicts,
        onConfirm: () => {
          addMeeting(supplierId, buyerId, slotId);
          setConflictModal(null);
          setSlotDropdown(null);
        },
      });
    } else {
      // No conflicts - add directly
      addMeeting(supplierId, buyerId, slotId);
      setSlotDropdown(null);
    }
  }, [slotDropdown, meetings, suppliers, buyers, addMeeting]);

  // Get buyer availability for slot dropdown
  const slotDropdownBuyers = useMemo(() => {
    if (!slotDropdown) return [];

    return buyers.map(buyer => {
      const availability = getBuyerAvailabilityForSlot(
        buyer.id,
        slotDropdown.supplierId,
        slotDropdown.slotId,
        meetings,
        suppliers,
        buyers
      );
      return { buyer, ...availability };
    });
  }, [slotDropdown, buyers, meetings, suppliers]);

  // Handler for highlighting meeting (from conflict panel)
  const handleHighlightMeeting = useCallback((meetingId: string) => {
    // Clear any existing timeout to prevent stale closures
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedMeetingId(meetingId);
    // Clear highlight after a few seconds
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMeetingId(null), 3000);
  }, []);

  // Close slot dropdown when clicking outside
  const handleClickOutside = useCallback(() => {
    setSlotDropdown(null);
    setActiveMeetingMenu(null);
    setShowMoveToDayMenu(false);
  }, []);

  if (!eventConfig) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-yellow-800">Please configure the event first.</p>
      </div>
    );
  }

  if (suppliers.length === 0 || buyers.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-yellow-800">Please add suppliers and buyers first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 no-print">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={generateSchedule}
              disabled={isGenerating}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-green-300 disabled:cursor-wait flex items-center gap-2"
            >
              {isGenerating && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isGenerating ? 'Generating...' : 'Generate Schedule'}
            </button>
            {meetings.length > 0 && (
              <>
                <button
                  onClick={clearSchedule}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  Clear Schedule
                </button>
                {cancelledCount > 0 && (
                  <button
                    onClick={autoFillGaps}
                    className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    Auto-fill Gaps ({cancelledCount})
                  </button>
                )}
                <button
                  onClick={() => {
                    setAddMeetingDefaults({});
                    setShowAddMeetingPanel(true);
                  }}
                  className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50"
                >
                  + Add Meeting
                </button>
                <button
                  onClick={() => setShowOpenSlots(!showOpenSlots)}
                  className={`px-4 py-2 rounded-md ${
                    showOpenSlots
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                  }`}
                  title="Highlight all available time slots"
                >
                  {showOpenSlots ? '● Hide Open Slots' : '○ Show Open Slots'}
                </button>
                {/* Undo/Redo buttons */}
                <div className="flex gap-1 border-l border-gray-300 dark:border-gray-600 pl-2 ml-1">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="px-2 py-2 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Undo (Ctrl+Z)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="px-2 py-2 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Redo (Ctrl+Y)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View mode toggle - hidden on mobile (mobile has its own view selector) */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded text-sm text-gray-700 dark:text-gray-300 ${
                    viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow' : ''
                  }`}
                >
                  Grid View
                </button>
                <button
                  onClick={() => setViewMode('supplier')}
                  className={`px-3 py-1 rounded text-sm text-gray-700 dark:text-gray-300 ${
                    viewMode === 'supplier' ? 'bg-white dark:bg-gray-600 shadow' : ''
                  }`}
                >
                  By Supplier
                </button>
                <button
                  onClick={() => setViewMode('buyer')}
                  className={`px-3 py-1 rounded text-sm text-gray-700 dark:text-gray-300 ${
                    viewMode === 'buyer' ? 'bg-white dark:bg-gray-600 shadow' : ''
                  }`}
                >
                  By Buyer
                </button>
              </div>
              {meetings.length > 0 && (
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`px-2 py-1 rounded text-sm ${
                    showSidebar ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title={showSidebar ? 'Hide status panel' : 'Show status panel'}
                >
                  {showSidebar ? '◀' : '▶'} Status
                </button>
              )}
            </div>
          )}
        </div>

        {meetings.length > 0 && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-4">
            <span className="text-green-600 dark:text-green-400">{scheduledCount} scheduled</span>
            {cancelledCount > 0 && <span className="text-red-600 dark:text-red-400">{cancelledCount} cancelled</span>}
            {unscheduledPairs.length > 0 && (
              <span className="text-orange-600 dark:text-orange-400" title="Some requested meetings couldn't be scheduled due to time constraints">
                {unscheduledPairs.length} couldn't be scheduled
              </span>
            )}
          </div>
        )}
        {unscheduledPairs.length > 0 && meetings.length > 0 && (
          <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md text-sm">
            <p className="text-orange-800 dark:text-orange-300 font-medium mb-1">
              {unscheduledPairs.length} requested meeting(s) couldn't be scheduled
            </p>
            <p className="text-orange-700 dark:text-orange-400 text-xs">
              Not enough time slots available. Consider extending event hours or reducing meeting durations.
            </p>
          </div>
        )}

        {/* Day Navigation for Multi-Day Events */}
        {isMultiDay && meetings.length > 0 && (
          <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Day:</span>
              {eventDates.map((date, index) => (
                <button
                  key={date}
                  onClick={() => setSelectedDay(date)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentDay === date
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Day {index + 1}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDateReadable(currentDay)}
            </p>
          </div>
        )}

        {/* Buyer Color Legend */}
        {meetings.length > 0 && buyers.length > 0 && (
          <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button
              onClick={() => setShowColorLegend(!showColorLegend)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <svg
                className={`w-3 h-3 transform transition-transform ${showColorLegend ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Buyer Colors
            </button>
            {showColorLegend && (
              <div className="flex flex-wrap gap-2 mt-2">
                {buyers.map(buyer => {
                  const color = buyerColorMap.get(buyer.id) || '#3B82F6';
                  return (
                    <div
                      key={buyer.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-700 rounded text-xs"
                    >
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-gray-700 dark:text-gray-300">{buyer.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Click "Generate Schedule" to create the meeting schedule based on supplier preferences.
          </p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Main Schedule Content */}
          <div className={`${showSidebar && !isMobile ? 'flex-1 min-w-0' : 'w-full'}`}>
            {/* Mobile View */}
            {isMobile ? (
              <MobileScheduleView
                onStatusChange={(meetingId, status) => {
                  if (status === 'in_progress') startMeeting(meetingId);
                  else updateMeetingStatus(meetingId, status);
                }}
              />
            ) : viewMode === 'grid' ? (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <th className="px-3 py-2 text-left font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-700">Time</th>
                        {suppliers.map(s => (
                          <th key={s.id} className="px-3 py-2 text-left font-medium text-gray-900 dark:text-gray-100 min-w-32">
                            {s.companyName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dayTimeSlots.map(slot => (
                        <tr key={slot.id} className={`border-b border-gray-200 dark:border-gray-700 ${slot.isBreak ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 whitespace-nowrap">
                            {formatTime(slot.startTime)}
                            {slot.isBreak && (
                              <span className="ml-2 text-xs text-yellow-700 dark:text-yellow-400">({slot.breakName})</span>
                            )}
                          </td>
                          {slot.isBreak ? (
                            <td colSpan={suppliers.length} className="px-3 py-2 text-center text-yellow-700 dark:text-yellow-400">
                              {slot.breakName}
                            </td>
                          ) : (
                            suppliers.map(supplier => {
                              const meeting = getMeetingForSlot(supplier.id, slot.id);
                              const buyer = meeting ? getBuyer(meeting.buyerId) : null;
                              return (
                                <DroppableSlot
                                  key={supplier.id}
                                  id={`slot-${supplier.id}-${slot.id}`}
                                  isEmpty={!meeting}
                                >
                                  {meeting && buyer ? (
                                    <DraggableMeeting
                                      meeting={meeting}
                                      buyer={buyer}
                                      buyerColorMap={buyerColorMap}
                                      conflicts={meetingConflictMap.get(meeting.id) || []}
                                      isHighlighted={highlightedMeetingId === meeting.id}
                                      onToggleMenu={() => setActiveMeetingMenu(activeMeetingMenu === meeting.id ? null : meeting.id)}
                                    >
                                      {/* Meeting action menu */}
                                      {activeMeetingMenu === meeting.id && (
                                        <div
                                          className="absolute z-30 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-40"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {meeting.status === 'scheduled' && (
                                            <button
                                              onClick={() => { startMeeting(meeting.id); setActiveMeetingMenu(null); }}
                                              className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                            >
                                              ▶ Start Meeting
                                            </button>
                                          )}
                                          {(meeting.status === 'scheduled' || meeting.status === 'in_progress') && (
                                            <button
                                              onClick={() => { updateMeetingStatus(meeting.id, 'completed'); setActiveMeetingMenu(null); }}
                                              className="w-full px-3 py-2 text-left text-xs hover:bg-green-50 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400"
                                            >
                                              ✓ Mark Completed
                                            </button>
                                          )}
                                          <div className="border-t border-gray-200 dark:border-gray-700">
                                            {meeting.status === 'in_progress' && (
                                              <button
                                                onClick={() => { markMeetingRunningLate(meeting.id); setActiveMeetingMenu(null); }}
                                                className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400"
                                              >
                                                🔴 Running Late
                                              </button>
                                            )}
                                            {(meeting.status === 'scheduled' || meeting.status === 'delayed') && (
                                              <button
                                                onClick={() => { setDelayReasonInput(meeting.id); }}
                                                className="w-full px-3 py-2 text-left text-xs hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                                              >
                                                ⏳ Mark Delayed
                                              </button>
                                            )}
                                            {(meeting.status === 'scheduled' || meeting.status === 'delayed' || meeting.status === 'running_late') && (
                                              <button
                                                onClick={() => {
                                                  const targetSlotId = findNextAvailableSlot(meeting.id);
                                                  if (targetSlotId) {
                                                    setBumpPreview({ meetingId: meeting.id, targetSlotId });
                                                    setActiveMeetingMenu(null);
                                                  } else {
                                                    alert('No available slots later in the day');
                                                    setActiveMeetingMenu(null);
                                                  }
                                                }}
                                                className="w-full px-3 py-2 text-left text-xs hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                                              >
                                                ➡️ Bump to Later Slot
                                              </button>
                                            )}
                                            {/* Move to Day submenu - only show for multi-day events */}
                                            {isMultiDay && (
                                              <div className="relative">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowMoveToDayMenu(!showMoveToDayMenu);
                                                  }}
                                                  className="w-full px-3 py-2 text-left text-xs hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-between"
                                                >
                                                  <span>📅 Move to Day</span>
                                                  <span className={`text-[10px] transition-transform ${showMoveToDayMenu ? 'rotate-90' : ''}`}>▶</span>
                                                </button>
                                                {showMoveToDayMenu && (
                                                  <div className="absolute left-full top-0 ml-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-32 z-40">
                                                    {eventDates.filter(d => d !== currentDay).map((date) => (
                                                      <button
                                                        key={date}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setCrossDayMove({ meetingId: meeting.id, targetDate: date });
                                                          setActiveMeetingMenu(null);
                                                          setShowMoveToDayMenu(false);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-xs hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                                                      >
                                                        Day {eventDates.indexOf(date) + 1} ({formatDateReadable(date)})
                                                      </button>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <div className="border-t border-gray-200 dark:border-gray-700">
                                            <button
                                              onClick={() => { updateMeetingStatus(meeting.id, 'scheduled'); setActiveMeetingMenu(null); }}
                                              className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                            >
                                              ↺ Reset Status
                                            </button>
                                            <button
                                              onClick={() => { cancelMeeting(meeting.id); setActiveMeetingMenu(null); }}
                                              className="w-full px-3 py-2 text-left text-xs hover:bg-red-50 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400"
                                            >
                                              ✕ Cancel Meeting
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {/* Delay reason input */}
                                      {delayReasonInput === meeting.id && (
                                        <div
                                          className="absolute z-30 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-3 min-w-48"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Reason for delay:</p>
                                          <input
                                            type="text"
                                            value={delayReason}
                                            onChange={(e) => setDelayReason(e.target.value)}
                                            placeholder="e.g., Buyer running late"
                                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                markMeetingDelayed(meeting.id, delayReason || undefined);
                                                setDelayReasonInput(null);
                                                setDelayReason('');
                                                setActiveMeetingMenu(null);
                                              }
                                              if (e.key === 'Escape') {
                                                setDelayReasonInput(null);
                                                setDelayReason('');
                                              }
                                            }}
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => {
                                                markMeetingDelayed(meeting.id, delayReason || undefined);
                                                setDelayReasonInput(null);
                                                setDelayReason('');
                                                setActiveMeetingMenu(null);
                                              }}
                                              className="flex-1 px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                                            >
                                              Confirm
                                            </button>
                                            <button
                                              onClick={() => {
                                                setDelayReasonInput(null);
                                                setDelayReason('');
                                              }}
                                              className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </DraggableMeeting>
                                  ) : (() => {
                                    // Check if we're moving a meeting and if this slot is for the same supplier
                                    const isMovingContext = !!movingMeetingId && movingMeetingSlotStatus?.meeting.supplierId === supplier.id;
                                    const slotStatus = isMovingContext ? movingMeetingSlotStatus?.statusMap.get(slot.id) : null;
                                    const showSlotHighlight = showOpenSlots || isMovingContext;

                                    return (
                                    <div className="relative">
                                      <button
                                        onClick={() => handleEmptySlotClick(supplier.id, slot.id)}
                                        className={`w-full h-8 flex items-center justify-center rounded transition-colors ${
                                          isMovingContext && slotStatus === 'blocked'
                                            ? 'bg-red-100 dark:bg-red-900/20 text-red-400 dark:text-red-500 cursor-not-allowed'
                                            : isMovingContext && slotStatus === 'warning'
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-2 border-dashed border-amber-400 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                                            : showSlotHighlight && (!isMovingContext || slotStatus === 'free')
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-2 border-dashed border-green-400 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50'
                                            : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                        title={isMovingContext && slotStatus === 'blocked' ? 'Supplier busy at this time' : isMovingContext && slotStatus === 'warning' ? 'Buyer has another meeting' : 'Click to add meeting'}
                                      >
                                        {isMovingContext && slotStatus === 'blocked' ? (
                                          <span className="text-xs">✕</span>
                                        ) : isMovingContext && slotStatus === 'warning' ? (
                                          <span className="text-xs font-medium">! Busy</span>
                                        ) : showSlotHighlight ? (
                                          <span className="text-xs font-medium">✓ Free</span>
                                        ) : (
                                          <>
                                            <span className="group-hover:hidden">-</span>
                                            <span className="hidden group-hover:inline text-xs">+ Add</span>
                                          </>
                                        )}
                                      </button>

                                      {/* Slot dropdown for adding meetings */}
                                      {slotDropdown?.supplierId === supplier.id && slotDropdown?.slotId === slot.id && (
                                        <div
                                          className="absolute z-30 top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg min-w-48 max-h-64 overflow-y-auto"
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Add Meeting</p>
                                          </div>
                                          {slotDropdownBuyers.map(({ buyer: b, conflictType, conflictDescription }) => (
                                            <button
                                              key={b.id}
                                              onClick={() => handleAddMeetingFromSlot(b.id)}
                                              className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                                conflictType === 'busy' ? 'opacity-75' : ''
                                              }`}
                                            >
                                              {conflictType === 'none' && (
                                                <span className="text-green-500 flex-shrink-0">&#10003;</span>
                                              )}
                                              {conflictType === 'busy' && (
                                                <span className="text-red-500 flex-shrink-0">!</span>
                                              )}
                                              {conflictType === 'preference' && (
                                                <span className="text-amber-500 flex-shrink-0">!</span>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <div className="text-gray-900 dark:text-gray-100 truncate">{b.name}</div>
                                                {conflictDescription && (
                                                  <div className={`text-[10px] truncate ${
                                                    conflictType === 'busy' ? 'text-red-500' : 'text-amber-500'
                                                  }`}>
                                                    {conflictDescription}
                                                  </div>
                                                )}
                                              </div>
                                            </button>
                                          ))}
                                          <div className="border-t border-gray-200 dark:border-gray-700">
                                            <button
                                              onClick={() => setSlotDropdown(null)}
                                              className="w-full px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })()}
                                </DroppableSlot>
                              );
                            })
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Drag Overlay - shows what's being dragged */}
                <DragOverlay>
                  {activeDragMeeting && (() => {
                    const buyer = getBuyer(activeDragMeeting.buyerId);
                    if (!buyer) return null;
                    const buyerColor = buyerColorMap.get(buyer.id) || '#3B82F6';
                    const bgColor = getLighterColor(buyerColor, 0.85);
                    const textColor = getContrastTextColor(bgColor);
                    return (
                      <div
                        className="p-2 rounded text-xs border-l-4 shadow-lg opacity-90"
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                          borderLeftColor: buyerColor,
                          minWidth: '100px',
                        }}
                      >
                        <div className="font-medium">{buyer.name}</div>
                        <div className="text-[10px] opacity-80">{buyer.organization}</div>
                      </div>
                    );
                  })()}
                </DragOverlay>
              </DndContext>
            ) : viewMode === 'supplier' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(supplier => (
                  <div key={supplier.id} className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{supplier.companyName}</h3>
                    <div className="space-y-2">
                      {meetingSlots.map(slot => {
                        const meeting = getMeetingForSlot(supplier.id, slot.id);
                        const buyer = meeting ? getBuyer(meeting.buyerId) : null;
                        return (
                          <div
                            key={slot.id}
                            className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-gray-700 pb-1"
                          >
                            <span className="text-gray-500 dark:text-gray-400">{formatTime(slot.startTime)}</span>
                            <span className="text-gray-900 dark:text-gray-100">{buyer?.name || '-'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buyers.map(buyer => {
                  const buyerColor = buyerColorMap.get(buyer.id) || '#3B82F6';
                  return (
                    <div
                      key={buyer.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4 border-t-4"
                      style={{ borderTopColor: buyerColor }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: buyerColor }}
                        />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{buyer.name}</h3>
                      </div>
                      <div className="space-y-2">
                        {meetingSlots.map(slot => {
                          const meeting = getBuyerMeetingForSlot(buyer.id, slot.id);
                          const supplier = meeting ? getSupplier(meeting.supplierId) : null;
                          return (
                            <div
                              key={slot.id}
                              className="flex justify-between items-center text-sm border-b border-gray-200 dark:border-gray-700 pb-1"
                            >
                              <span className="text-gray-500 dark:text-gray-400">{formatTime(slot.startTime)}</span>
                              <span className="text-gray-900 dark:text-gray-100">{supplier?.companyName || '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Status Sidebar - hidden on mobile */}
          {showSidebar && !isMobile && (
            <div className="w-80 flex-shrink-0 space-y-4">
              <ConflictSummaryPanel onHighlightMeeting={handleHighlightMeeting} />
              <StatusDashboard />
              <ActivityFeed />
            </div>
          )}
        </div>
      )}

      {/* Bump Preview Modal */}
      {bumpPreview && (() => {
        const meeting = meetings.find(m => m.id === bumpPreview.meetingId);
        const currentSlot = timeSlots.find(s => s.id === meeting?.timeSlotId);
        const targetSlot = timeSlots.find(s => s.id === bumpPreview.targetSlotId);
        const supplier = meeting ? supplierMap.get(meeting.supplierId) : undefined;
        const buyer = meeting ? buyerMap.get(meeting.buyerId) : undefined;

        if (!meeting || !currentSlot || !targetSlot || !supplier || !buyer) {
          return null;
        }

        return (
          <BumpPreviewModal
            meeting={meeting}
            currentSlot={currentSlot}
            targetSlot={targetSlot}
            supplier={supplier}
            buyer={buyer}
            onConfirm={() => {
              bumpMeeting(meeting.id);
              setBumpPreview(null);
            }}
            onCancel={() => setBumpPreview(null)}
          />
        );
      })()}

      {/* Add Meeting Panel */}
      {showAddMeetingPanel && (
        <AddMeetingPanel
          onClose={() => setShowAddMeetingPanel(false)}
          defaultSupplierId={addMeetingDefaults.supplierId}
          defaultSlotId={addMeetingDefaults.slotId}
        />
      )}

      {/* Conflict Warning Modal */}
      {conflictModal && (
        <ConflictWarningModal
          title={conflictModal.title}
          conflicts={conflictModal.conflicts}
          onClose={() => setConflictModal(null)}
          onConfirm={conflictModal.onConfirm}
          showConfirm={!!conflictModal.onConfirm}
          confirmText="Proceed Anyway"
        />
      )}

      {/* Cross-Day Move Modal */}
      {crossDayMove && (
        <CrossDayMoveModal
          meetingId={crossDayMove.meetingId}
          targetDate={crossDayMove.targetDate}
          onClose={() => setCrossDayMove(null)}
          onMove={(targetSlotId) => {
            moveMeeting(crossDayMove.meetingId, targetSlotId);
            setCrossDayMove(null);
          }}
        />
      )}

      {/* Click outside overlay to close dropdowns */}
      {(slotDropdown || activeMeetingMenu) && (
        <div
          className="fixed inset-0 z-10"
          onClick={handleClickOutside}
        />
      )}
    </div>
  );
}
