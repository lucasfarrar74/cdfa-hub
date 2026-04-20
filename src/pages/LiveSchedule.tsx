import { ScheduleProvider } from '../features/scheduler/context/ScheduleContext';
import { ThemeProvider } from '../features/scheduler/context/ThemeContext';
import LiveScheduleView from '../features/scheduler/components/LiveScheduleView';

// Projector-mode wrapper — rendered outside MainLayout so none of the app
// chrome (sidebar, header, navigation) shows. The view itself is full-bleed
// dark-themed and updates live via Firestore sync inside ScheduleProvider.
export function LiveSchedule() {
  return (
    <ThemeProvider>
      <ScheduleProvider>
        <LiveScheduleView />
      </ScheduleProvider>
    </ThemeProvider>
  );
}
