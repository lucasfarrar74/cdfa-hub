import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSchedule } from '../context/ScheduleContext';
import { createBuyerColorMap } from '../utils/colors';
import { getUniqueDatesFromSlots, formatDateReadable, formatTime } from '../utils/timeUtils';
import type { Meeting, TimeSlot } from '../types';

function useLiveClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MeetingCell({
  meeting,
  buyerColor,
  buyerName,
}: {
  meeting: Meeting;
  buyerColor: string;
  buyerName: string;
}) {
  const isInProgress = meeting.status === 'in_progress';
  const isCompleted = meeting.status === 'completed';
  const isDelayed = meeting.status === 'delayed' || meeting.status === 'running_late';

  const bg = isCompleted
    ? hexToRgba(buyerColor, 0.18)
    : hexToRgba(buyerColor, 0.85);
  const borderColor = isInProgress ? '#FBBF24' : isDelayed ? '#EF4444' : buyerColor;

  return (
    <div
      className={`h-full w-full flex items-center justify-center px-2 py-3 text-center font-semibold transition-colors ${
        isInProgress ? 'ring-4 ring-yellow-400 animate-pulse' : ''
      } ${isCompleted ? 'line-through text-gray-500' : 'text-white'}`}
      style={{ backgroundColor: bg, borderLeft: `6px solid ${borderColor}` }}
      title={meeting.status}
    >
      <span className="text-2xl xl:text-3xl leading-tight">{buyerName}</span>
    </div>
  );
}

function LiveScheduleContent() {
  const {
    activeProject,
    suppliers,
    buyers,
    meetings,
    timeSlots,
    eventConfig,
    openCloudProject,
    isFirebaseEnabled,
  } = useSchedule();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clock = useLiveClock();
  const [isFullscreen, setIsFullscreen] = useState(() =>
    typeof document !== 'undefined' && !!document.fullscreenElement,
  );

  // Handle ?share=XXXX URL parameter to open cloud project directly
  useEffect(() => {
    const shareId = searchParams.get('share');
    if (shareId && isFirebaseEnabled) {
      openCloudProject(shareId).then(project => {
        if (project) {
          const url = new URL(window.location.href);
          url.searchParams.delete('share');
          window.history.replaceState({}, '', url.toString());
        }
      });
    }
  }, [searchParams, isFirebaseEnabled, openCloudProject]);

  // Track fullscreen state so the button icon matches reality
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const eventDates = useMemo(() => getUniqueDatesFromSlots(timeSlots), [timeSlots]);
  const isMultiDay = eventDates.length > 1;

  // Default the selected day to today (if within the event range) or day 1.
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDay, setSelectedDay] = useState<string>('');
  useEffect(() => {
    if (!selectedDay && eventDates.length > 0) {
      setSelectedDay(eventDates.includes(todayStr) ? todayStr : eventDates[0]);
    }
  }, [eventDates, selectedDay, todayStr]);

  const dayTimeSlots = useMemo<TimeSlot[]>(
    () => (isMultiDay ? timeSlots.filter(s => s.date === selectedDay) : timeSlots),
    [timeSlots, selectedDay, isMultiDay],
  );

  const buyerColorMap = useMemo(() => createBuyerColorMap(buyers), [buyers]);
  const buyerMap = useMemo(() => new Map(buyers.map(b => [b.id, b])), [buyers]);

  // supplierId → slotId → meeting, for O(1) cell lookup.
  const meetingGrid = useMemo(() => {
    const grid = new Map<string, Map<string, Meeting>>();
    for (const m of meetings) {
      if (m.status === 'cancelled' || m.status === 'bumped') continue;
      if (!grid.has(m.supplierId)) grid.set(m.supplierId, new Map());
      grid.get(m.supplierId)!.set(m.timeSlotId, m);
    }
    return grid;
  }, [meetings]);

  // Only show suppliers that actually have a meeting on the current day,
  // ordered by meeting count desc so the busy ones land on the left.
  const daySuppliers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of dayTimeSlots) {
      if (slot.isBreak) continue;
      for (const s of suppliers) {
        if (meetingGrid.get(s.id)?.has(slot.id)) {
          counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
        }
      }
    }
    return suppliers
      .filter(s => (counts.get(s.id) ?? 0) > 0)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [suppliers, dayTimeSlots, meetingGrid]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be rejected (e.g., iframe) — just ignore.
    }
  };

  if (!activeProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 p-10">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">No schedule open</h1>
          <p className="text-xl text-gray-400">
            Open a project in the Meeting Scheduler or paste a share link ending in
            <code className="mx-2 px-2 py-1 bg-gray-800 rounded">?share=YOUR_ID</code>.
          </p>
          <button
            onClick={() => navigate('/meeting-scheduler')}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-lg"
          >
            Back to Scheduler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <div>
          <h1 className="text-4xl font-bold">
            {eventConfig?.name || activeProject.name}
          </h1>
          <p className="text-xl text-gray-400">
            {selectedDay ? formatDateReadable(selectedDay) : 'Select a day'}
            {isMultiDay && selectedDay
              ? ` — Day ${eventDates.indexOf(selectedDay) + 1} of ${eventDates.length}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-5xl font-mono tabular-nums">{clock}</div>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-lg"
          >
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
          <button
            onClick={() => navigate('/meeting-scheduler')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-lg"
          >
            Back to Scheduler
          </button>
        </div>
      </header>

      {/* Day selector (multi-day only) */}
      {isMultiDay && (
        <div className="flex gap-2 px-8 py-3 border-b border-gray-800 overflow-x-auto">
          {eventDates.map((date, idx) => (
            <button
              key={date}
              onClick={() => setSelectedDay(date)}
              className={`px-4 py-2 rounded-lg text-lg whitespace-nowrap ${
                selectedDay === date
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Day {idx + 1} — {formatDateReadable(date)}
            </button>
          ))}
        </div>
      )}

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        {daySuppliers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-3xl text-gray-500">No meetings scheduled for this day.</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr>
                <th className="text-left px-4 py-3 text-xl font-semibold border-b border-gray-800 min-w-[10rem]">
                  Time
                </th>
                {daySuppliers.map(s => (
                  <th
                    key={s.id}
                    className="text-left px-4 py-3 text-xl font-semibold border-b border-gray-800 border-l border-gray-800 min-w-[12rem]"
                  >
                    {s.companyName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayTimeSlots.map(slot => {
                if (slot.isBreak) {
                  return (
                    <tr key={slot.id}>
                      <td
                        colSpan={daySuppliers.length + 1}
                        className="px-4 py-3 text-center text-xl italic text-gray-500 bg-gray-850 border-b border-gray-800"
                        style={{ backgroundColor: '#0F172A' }}
                      >
                        {formatTime(slot.startTime)} — {slot.breakName || 'Break'} — {formatTime(slot.endTime)}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={slot.id}>
                    <td className="px-4 py-3 text-2xl font-mono font-semibold border-b border-gray-800 whitespace-nowrap">
                      {formatTime(slot.startTime)}
                    </td>
                    {daySuppliers.map(s => {
                      const meeting = meetingGrid.get(s.id)?.get(slot.id);
                      const buyer = meeting ? buyerMap.get(meeting.buyerId) : null;
                      return (
                        <td
                          key={s.id}
                          className="p-0 border-b border-gray-800 border-l border-gray-800 h-20"
                        >
                          {meeting && buyer ? (
                            <MeetingCell
                              meeting={meeting}
                              buyerColor={buyerColorMap.get(buyer.id) || '#3B82F6'}
                              buyerName={buyer.name}
                            />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <footer className="flex flex-wrap items-center gap-4 px-8 py-3 border-t border-gray-800 text-sm text-gray-400">
        <span className="font-semibold text-gray-300">Status legend:</span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-4 ring-2 ring-yellow-400 rounded-sm" />
          In progress
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-4 bg-gray-600 rounded-sm line-through">&nbsp;</span>
          Completed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-4 h-4 border-l-4 border-red-500 bg-gray-700 rounded-sm" />
          Delayed / late
        </span>
      </footer>
    </div>
  );
}

export default function LiveScheduleView() {
  // ScheduleProvider + ThemeProvider are mounted in the page wrapper below
  // — this component assumes it runs inside them.
  return <LiveScheduleContent />;
}
