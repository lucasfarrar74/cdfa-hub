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
} from 'date-fns';
import type { AnyActivity } from '../types';
import { getActivityCategory } from '../types';
import { getHolidaysForYears, type Holiday } from '../utils/holidays';

interface YearViewProps {
  year: number;
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

export default function YearView({
  year,
  activities,
  onActivityClick,
  onMonthClick,
}: YearViewProps) {
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  }, [year]);

  // Get holidays for the year
  const holidays = useMemo(() => {
    return getHolidaysForYears(year, year);
  }, [year]);

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
    <div className="grid grid-cols-4 gap-3 p-4 h-full overflow-auto">
      {months.map((monthDate) => (
        <YearMonthView
          key={monthDate.getTime()}
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

interface YearMonthViewProps {
  monthDate: Date;
  activities: AnyActivity[];
  holidays: Map<string, Holiday>;
  onActivityClick: (activity: AnyActivity) => void;
  onMonthClick: (date: Date) => void;
  getActivityColor: (activity: AnyActivity) => string;
}

function YearMonthView({
  monthDate,
  activities,
  holidays,
  onActivityClick,
  onMonthClick,
  getActivityColor,
}: YearMonthViewProps) {
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
          if (row > 1) break; // Max 2 rows in year view (very compact)
        }

        positions.push({ activity, row, startCol, endCol, isStart, isEnd });
      });

      result.push(positions);
    });

    return result;
  }, [weeks, activities]);

  // Count activities for summary
  const activitySummary = useMemo(() => {
    const monthActivities = activities.filter((a) => {
      if (!a.startDate) return false;
      const startMonth = a.startDate.substring(0, 7);
      const thisMonth = format(monthDate, 'yyyy-MM');
      return startMonth === thisMonth;
    });
    const tradeCount = monthActivities.filter(
      (a) => getActivityCategory(a.activityType) === 'trade'
    ).length;
    const eduCount = monthActivities.filter(
      (a) => getActivityCategory(a.activityType) === 'educational'
    ).length;
    const consultCount = monthActivities.filter(
      (a) => getActivityCategory(a.activityType) === 'consultation'
    ).length;
    return { tradeCount, eduCount, consultCount, total: tradeCount + eduCount + consultCount };
  }, [activities, monthDate]);

  return (
    <div
      className="border dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow flex flex-col bg-white dark:bg-gray-800"
      onClick={() => onMonthClick(monthDate)}
    >
      {/* Month header */}
      <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 font-semibold text-sm text-gray-800 dark:text-gray-200">
        {format(monthDate, 'MMMM')}
      </div>

      {/* Mini calendar with bars */}
      <div className="flex-1 p-1 bg-white dark:bg-gray-800">
        {/* Day headers */}
        <div className="grid grid-cols-7 text-center text-[9px] text-gray-500 dark:text-gray-400 mb-0.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="flex-1">
          {weeks.map((week, weekIdx) => {
            const weekPositions = weekEventPositions[weekIdx] || [];

            return (
              <div key={weekIdx} className="relative" style={{ minHeight: '28px' }}>
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
                        className={`text-center relative ${
                          !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : holiday ? 'bg-red-50 dark:bg-red-900/30' : 'bg-white dark:bg-gray-800'
                        }`}
                        title={holiday?.name}
                      >
                        <span
                          className={`inline-block text-[9px] leading-3 ${
                            isTodayDate
                              ? 'bg-blue-600 text-white rounded-full w-3 h-3 leading-3'
                              : holiday
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : isCurrentMonth
                              ? 'text-gray-700 dark:text-gray-300'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        >
                          {format(date, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Event bars */}
                <div
                  className="absolute inset-x-0 top-3 bottom-0 pointer-events-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {weekPositions.map((pos, idx) => {
                    if (pos.row >= 2) return null;

                    const leftPercent = (pos.startCol / 7) * 100;
                    const widthPercent = ((pos.endCol - pos.startCol + 1) / 7) * 100;

                    return (
                      <div
                        key={pos.activity.id + '-' + weekIdx + '-' + idx}
                        className={`absolute h-2.5 flex items-center text-[7px] text-white font-medium cursor-pointer pointer-events-auto truncate ${getActivityColor(
                          pos.activity
                        )} hover:opacity-80 ${pos.isStart ? 'rounded-l ml-px' : ''} ${
                          pos.isEnd ? 'rounded-r mr-px' : ''
                        }`}
                        style={{
                          left: `calc(${leftPercent}% + 1px)`,
                          width: `calc(${widthPercent}% - 2px)`,
                          top: `${pos.row * 11}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivityClick(pos.activity);
                        }}
                        title={`${pos.activity.name}\n${format(
                          parseISO(pos.activity.startDate),
                          'MMM d'
                        )}${
                          pos.activity.endDate && pos.activity.endDate !== pos.activity.startDate
                            ? ' - ' + format(parseISO(pos.activity.endDate), 'MMM d')
                            : ''
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity summary */}
      <div className="px-2 py-1 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
        {activitySummary.total === 0 ? (
          'No activities'
        ) : (
          <div className="flex gap-2">
            {activitySummary.tradeCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {activitySummary.tradeCount}
              </span>
            )}
            {activitySummary.eduCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {activitySummary.eduCount}
              </span>
            )}
            {activitySummary.consultCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {activitySummary.consultCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
