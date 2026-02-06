import { useState } from 'react';
import { format, addMonths, subMonths, addYears, subYears } from 'date-fns';
import { useProjects } from '../context/ProjectsContext';
import MonthView from './MonthView';
import QuarterView from './QuarterView';
import YearView from './YearView';

type ViewMode = 'month' | 'quarter' | 'year';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const { filteredActivities, selectActivity } = useProjects();

  const handlePrevious = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'quarter':
        setCurrentDate(subMonths(currentDate, 3));
        break;
      case 'year':
        setCurrentDate(subYears(currentDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'quarter':
        setCurrentDate(addMonths(currentDate, 3));
        break;
      case 'year':
        setCurrentDate(addYears(currentDate, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'quarter':
        const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
        return `Q${quarter} ${format(currentDate, 'yyyy')}`;
      case 'year':
        return format(currentDate, 'yyyy');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{getTitle()}</h2>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* View mode selector */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['month', 'quarter', 'year'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                  viewMode === mode
                    ? 'bg-white dark:bg-gray-600 shadow dark:shadow-gray-900/50 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-900 dark:text-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-gray-900 dark:text-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4 text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Trade</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Educational</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Consultation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-600"></span>
          <span className="text-gray-600 dark:text-gray-400">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-300 dark:bg-gray-600"></span>
          <span className="text-gray-600 dark:text-gray-400">Draft</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700"></span>
          <span className="text-gray-600 dark:text-gray-400">Holiday</span>
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 overflow-hidden">
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            activities={filteredActivities}
            onActivityClick={(activity) => selectActivity(activity.id)}
            onDateClick={(date) => console.log('Date clicked:', date)}
          />
        )}
        {viewMode === 'quarter' && (
          <QuarterView
            currentDate={currentDate}
            activities={filteredActivities}
            onActivityClick={(activity) => selectActivity(activity.id)}
            onMonthClick={(date) => {
              setCurrentDate(date);
              setViewMode('month');
            }}
          />
        )}
        {viewMode === 'year' && (
          <YearView
            year={currentDate.getFullYear()}
            activities={filteredActivities}
            onActivityClick={(activity) => selectActivity(activity.id)}
            onMonthClick={(date) => {
              setCurrentDate(date);
              setViewMode('month');
            }}
          />
        )}
      </div>
    </div>
  );
}
