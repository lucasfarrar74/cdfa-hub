import { useMemo } from 'react';
import { format, isSameMonth, isToday, parseISO, isSameDay, startOfWeek, endOfWeek, isWithinInterval, getDay } from 'date-fns';
import type { AnyActivity } from '../types';
import { getActivityCategory } from '../types';
import { generateMonthWeeks } from '../utils/dateUtils';
import { getHolidaysForYears } from '../utils/holidays';

interface MonthViewProps {
  currentDate: Date;
  activities: AnyActivity[];
  onActivityClick: (activity: AnyActivity) => void;
  onDateClick: (date: Date) => void;
  compact?: boolean;
}

interface EventPosition {
  activity: AnyActivity;
  row: number;
  startCol: number;
  endCol: number;
  isStart: boolean;
  isEnd: boolean;
}

export default function MonthView({
  currentDate,
  activities,
  onActivityClick,
  onDateClick,
  compact = false,
}: MonthViewProps) {
  const weeks = useMemo(() => generateMonthWeeks(currentDate), [currentDate]);

  // Get holidays for the current year and adjacent years (to handle month boundaries)
  const holidays = useMemo(() => {
    const year = currentDate.getFullYear();
    return getHolidaysForYears(year - 1, year + 1);
  }, [currentDate]);

  // Calculate event positions for each week (for spanning bars)
  const weekEventPositions = useMemo(() => {
    const result: EventPosition[][] = [];

    weeks.forEach((week) => {
      const weekStart = startOfWeek(week[0]);
      const weekEnd = endOfWeek(week[6]);
      const positions: EventPosition[] = [];
      const rowOccupancy: boolean[][] = [];

      const weekActivities = activities
        .filter((activity) => {
          if (!activity.startDate) return false;
          const actStart = parseISO(activity.startDate);
          const actEnd = activity.endDate ? parseISO(activity.endDate) : actStart;
          return isWithinInterval(actStart, { start: weekStart, end: weekEnd }) ||
                 isWithinInterval(actEnd, { start: weekStart, end: weekEnd }) ||
                 (actStart <= weekStart && actEnd >= weekEnd);
        })
        .sort((a, b) => {
          const aStart = parseISO(a.startDate);
          const bStart = parseISO(b.startDate);
          if (aStart.getTime() !== bStart.getTime()) {
            return aStart.getTime() - bStart.getTime();
          }
          const aEnd = a.endDate ? parseISO(a.endDate) : aStart;
          const bEnd = b.endDate ? parseISO(b.endDate) : bStart;
          return bEnd.getTime() - aEnd.getTime();
        });

      weekActivities.forEach((activity) => {
        const actStart = parseISO(activity.startDate);
        const actEnd = activity.endDate ? parseISO(activity.endDate) : actStart;

        const startCol = actStart < weekStart ? 0 : getDay(actStart);
        const endCol = actEnd > weekEnd ? 6 : getDay(actEnd);
        const isStart = actStart >= weekStart;
        const isEnd = actEnd <= weekEnd;

        let row = 0;
        while (true) {
          if (!rowOccupancy[row]) {
            rowOccupancy[row] = [false, false, false, false, false, false, false];
          }

          let canFit = true;
          for (let col = startCol; col <= endCol; col++) {
            if (rowOccupancy[row][col]) {
              canFit = false;
              break;
            }
          }

          if (canFit) {
            for (let col = startCol; col <= endCol; col++) {
              rowOccupancy[row][col] = true;
            }
            break;
          }
          row++;
          if (row > 5) break;
        }

        positions.push({ activity, row, startCol, endCol, isStart, isEnd });
      });

      result.push(positions);
    });

    return result;
  }, [weeks, activities]);

  const getActivityColor = (activity: AnyActivity) => {
    if (activity.status === 'completed') return 'bg-emerald-500';
    if (activity.status === 'draft') return 'bg-gray-400';
    if (activity.status === 'cancelled') return 'bg-red-400';
    const category = getActivityCategory(activity.activityType);
    if (category === 'trade') return 'bg-blue-500';
    if (category === 'educational') return 'bg-green-500';
    if (category === 'consultation') return 'bg-amber-500';
    return 'bg-gray-500';
  };

  const getActivityHoverColor = (activity: AnyActivity) => {
    if (activity.status === 'completed') return 'hover:bg-emerald-600';
    if (activity.status === 'draft') return 'hover:bg-gray-500';
    if (activity.status === 'cancelled') return 'hover:bg-red-500';
    const category = getActivityCategory(activity.activityType);
    if (category === 'trade') return 'hover:bg-blue-600';
    if (category === 'educational') return 'hover:bg-green-600';
    if (category === 'consultation') return 'hover:bg-amber-600';
    return 'hover:bg-gray-600';
  };

  const getStatusIcon = (activity: AnyActivity) => {
    if (activity.status === 'completed') {
      return (
        <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    if (activity.status === 'in_progress') {
      return (
        <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="3" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className={`text-center font-medium text-gray-700 dark:text-gray-300 ${
              compact ? 'py-1 text-xs' : 'py-2 text-sm'
            }`}
          >
            {compact ? day.charAt(0) : day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 flex flex-col">
        {weeks.map((week, weekIdx) => {
          const weekPositions = weekEventPositions[weekIdx] || [];

          return (
            <div key={weekIdx} className="flex-1 relative min-h-[100px]">
              {/* Day cells grid */}
              <div className="absolute inset-0 grid grid-cols-7">
                {week.map((date, dayIdx) => {
                  const isCurrentMonth = isSameMonth(date, currentDate);
                  const isTodayDate = isToday(date);
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const holiday = holidays.get(dateStr);

                  return (
                    <div
                      key={dayIdx}
                      className={`border-b border-r dark:border-gray-700 overflow-hidden cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors ${
                        !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-800/50' : holiday ? 'bg-red-50 dark:bg-red-900/30' : 'bg-white dark:bg-gray-900'
                      }`}
                      onClick={() => onDateClick(date)}
                      title={holiday?.name}
                    >
                      <div className={`p-1 ${compact ? 'text-center' : 'text-right'}`}>
                        <span
                          className={`inline-flex items-center justify-center ${compact ? 'text-xs' : 'text-sm'} ${
                            isTodayDate
                              ? 'bg-blue-600 text-white rounded-full w-6 h-6 font-semibold'
                              : holiday
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : isCurrentMonth
                              ? 'text-gray-900 dark:text-gray-100'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {format(date, 'd')}
                        </span>
                      </div>

                      {/* Compact view dots */}
                      {compact && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {activities.filter((a) => {
                            if (!a.startDate) return false;
                            const start = parseISO(a.startDate);
                            const end = a.endDate ? parseISO(a.endDate) : start;
                            return isSameDay(date, start) || isSameDay(date, end) ||
                                   (date > start && date < end);
                          }).slice(0, 3).map((activity) => (
                            <span
                              key={activity.id}
                              className={`w-1.5 h-1.5 rounded-full ${getActivityColor(activity)}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Event bars overlay */}
              {!compact && (
                <div className="absolute inset-x-0 top-8 bottom-0 pointer-events-none">
                  {weekPositions.map((pos, idx) => {
                    if (pos.row >= 3) return null;

                    const leftPercent = (pos.startCol / 7) * 100;
                    const widthPercent = ((pos.endCol - pos.startCol + 1) / 7) * 100;

                    return (
                      <div
                        key={pos.activity.id + '-' + weekIdx + '-' + idx}
                        className={`absolute h-5 flex items-center px-1.5 text-xs text-white font-medium cursor-pointer pointer-events-auto transition-all shadow-sm ${
                          getActivityColor(pos.activity)
                        } ${getActivityHoverColor(pos.activity)} ${
                          pos.isStart ? 'rounded-l-md ml-1' : ''
                        } ${pos.isEnd ? 'rounded-r-md mr-1' : ''}`}
                        style={{
                          left: `calc(${leftPercent}% + ${pos.isStart ? '2px' : '0px'})`,
                          width: `calc(${widthPercent}% - ${pos.isStart && pos.isEnd ? '4px' : pos.isStart || pos.isEnd ? '2px' : '0px'})`,
                          top: `${pos.row * 24}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivityClick(pos.activity);
                        }}
                        title={`${pos.activity.name}\n${format(parseISO(pos.activity.startDate), 'MMM d')}${pos.activity.endDate && pos.activity.endDate !== pos.activity.startDate ? ' - ' + format(parseISO(pos.activity.endDate), 'MMM d') : ''}\nStatus: ${pos.activity.status.replace('_', ' ')}`}
                      >
                        {pos.isStart && (
                          <span className="truncate flex items-center">
                            {getStatusIcon(pos.activity)}
                            {pos.activity.name}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Show "+N more" if there are hidden events */}
                  {weekPositions.filter(p => p.row >= 3).length > 0 && (
                    <div className="absolute bottom-1 right-2 text-xs text-gray-500 dark:text-gray-400 pointer-events-auto">
                      +{weekPositions.filter(p => p.row >= 3).length} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
