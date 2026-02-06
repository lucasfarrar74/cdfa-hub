import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  getDay,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  addMonths,
} from 'date-fns';
import type { AnyActivity } from '../types';
import { getActivityCategory } from '../types';
import { getHolidaysForYears, type Holiday } from '../utils/holidays';

interface QuarterViewProps {
  currentDate: Date;
  activities: AnyActivity[];
  onActivityClick: (activity: AnyActivity) => void;
  onMonthClick: (date: Date) => void;
}

interface EventPosition {
  activity: AnyActivity;
  row: number;
  startCol: number;
  endCol: number;
  isStart: boolean;
  isEnd: boolean;
}

export default function QuarterView({
  currentDate,
  activities,
  onActivityClick,
  onMonthClick,
}: QuarterViewProps) {
  // Get the three months of the quarter
  const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1);
  const months = useMemo(() => {
    return [0, 1, 2].map((offset) => addMonths(quarterStart, offset));
  }, [quarterStart]);

  // Get holidays for the year
  const holidays = useMemo(() => {
    return getHolidaysForYears(quarterStart.getFullYear(), quarterStart.getFullYear());
  }, [quarterStart]);

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

  return (
    <div className="grid grid-cols-3 gap-4 p-4 h-full overflow-auto">
      {months.map((monthDate, monthIdx) => (
        <QuarterMonthView
          key={monthIdx}
          monthDate={monthDate}
          activities={activities}
          holidays={holidays}
          onActivityClick={onActivityClick}
          onMonthClick={onMonthClick}
          getActivityColor={getActivityColor}
        />
      ))}
    </div>
  );
}

interface QuarterMonthViewProps {
  monthDate: Date;
  activities: AnyActivity[];
  holidays: Map<string, Holiday>;
  onActivityClick: (activity: AnyActivity) => void;
  onMonthClick: (date: Date) => void;
  getActivityColor: (activity: AnyActivity) => string;
}

function QuarterMonthView({
  monthDate,
  activities,
  holidays,
  onActivityClick,
  onMonthClick,
  getActivityColor,
}: QuarterMonthViewProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Get all weeks that overlap with this month
  const weeks = useMemo(() => {
    const allWeeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });
    return allWeeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart);
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    });
  }, [monthStart, monthEnd]);

  // Calculate event positions for each week
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
          return (
            isWithinInterval(actStart, { start: weekStart, end: weekEnd }) ||
            isWithinInterval(actEnd, { start: weekStart, end: weekEnd }) ||
            (actStart <= weekStart && actEnd >= weekEnd)
          );
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
          if (row > 2) break; // Max 3 rows in compact view
        }

        positions.push({ activity, row, startCol, endCol, isStart, isEnd });
      });

      result.push(positions);
    });

    return result;
  }, [weeks, activities]);

  return (
    <div className="flex flex-col h-full">
      <h3
        className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
        onClick={() => onMonthClick(monthDate)}
      >
        {format(monthDate, 'MMMM')}
      </h3>
      <div className="flex-1 border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-600 dark:text-gray-300 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex-1">
          {weeks.map((week, weekIdx) => {
            const weekPositions = weekEventPositions[weekIdx] || [];

            return (
              <div key={weekIdx} className="relative" style={{ minHeight: '60px' }}>
                {/* Day cells */}
                <div className="absolute inset-0 grid grid-cols-7">
                  {week.map((date, dayIdx) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const holiday = holidays.get(dateStr);
                    const isTodayDate = isToday(date);
                    const isCurrentMonth = date.getMonth() === monthDate.getMonth();

                    return (
                      <div
                        key={dayIdx}
                        className={`border-b border-r dark:border-gray-700 text-center relative ${
                          !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : holiday ? 'bg-red-50 dark:bg-red-900/30' : 'bg-white dark:bg-gray-900'
                        }`}
                        title={holiday?.name}
                      >
                        <span
                          className={`inline-block text-xs mt-0.5 ${
                            isTodayDate
                              ? 'bg-blue-600 text-white rounded-full w-5 h-5 leading-5'
                              : holiday
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : isCurrentMonth
                              ? 'text-gray-700 dark:text-gray-300'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {format(date, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Event bars */}
                <div className="absolute inset-x-0 top-5 bottom-0 pointer-events-none">
                  {weekPositions.map((pos, idx) => {
                    if (pos.row >= 2) return null;

                    const leftPercent = (pos.startCol / 7) * 100;
                    const widthPercent = ((pos.endCol - pos.startCol + 1) / 7) * 100;

                    return (
                      <div
                        key={pos.activity.id + '-' + weekIdx + '-' + idx}
                        className={`absolute h-4 flex items-center px-0.5 text-[10px] text-white font-medium cursor-pointer pointer-events-auto truncate ${
                          getActivityColor(pos.activity)
                        } hover:opacity-80 ${pos.isStart ? 'rounded-l ml-0.5' : ''} ${
                          pos.isEnd ? 'rounded-r mr-0.5' : ''
                        }`}
                        style={{
                          left: `calc(${leftPercent}% + 1px)`,
                          width: `calc(${widthPercent}% - 2px)`,
                          top: `${pos.row * 18}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivityClick(pos.activity);
                        }}
                        title={`${pos.activity.name}\n${format(parseISO(pos.activity.startDate), 'MMM d')}${
                          pos.activity.endDate && pos.activity.endDate !== pos.activity.startDate
                            ? ' - ' + format(parseISO(pos.activity.endDate), 'MMM d')
                            : ''
                        }`}
                      >
                        {pos.isStart ? pos.activity.name : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
