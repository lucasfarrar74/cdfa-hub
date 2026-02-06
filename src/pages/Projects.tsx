import { Routes, Route, Navigate } from 'react-router-dom';
import { ProjectsProvider } from '../features/projects/context/ProjectsContext';
import {
  Dashboard,
  ActivityList,
  CalendarView,
  TimelineView,
} from '../features/projects/components';

export function Projects() {
  return (
    <ProjectsProvider>
      <div className="h-full flex flex-col">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="activities" element={<ActivityList />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="timeline" element={<TimelineView />} />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </div>
    </ProjectsProvider>
  );
}
