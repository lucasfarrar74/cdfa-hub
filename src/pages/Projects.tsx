import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { ProjectsProvider } from '../features/projects/context/ProjectsContext';
import {
  Dashboard,
  ActivityList,
  CalendarView,
  TimelineView,
} from '../features/projects/components';

const tabs = [
  { label: 'Overview', path: '/projects', end: true },
  { label: 'Activities', path: '/projects/activities', end: false },
  { label: 'Calendar', path: '/projects/calendar', end: false },
  { label: 'Timeline', path: '/projects/timeline', end: false },
];

export function Projects() {
  return (
    <ProjectsProvider>
      <div className="h-full flex flex-col">
        <nav className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-0">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="flex-1 overflow-auto pt-6">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="activities" element={<ActivityList />} />
            <Route path="calendar" element={<CalendarView />} />
            <Route path="timeline" element={<TimelineView />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </div>
      </div>
    </ProjectsProvider>
  );
}
