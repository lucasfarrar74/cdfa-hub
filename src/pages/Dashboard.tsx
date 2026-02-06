import { DeadlinesWidget } from '../components/dashboard/DeadlinesWidget';
import { BudgetOverview } from '../components/dashboard/BudgetOverview';
import { ProjectsOverview } from '../components/dashboard/ProjectsOverview';
import { MeetingsWidget } from '../components/dashboard/MeetingsWidget';
import { QuickActions } from '../components/dashboard/QuickActions';

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          At-a-glance view of your projects, deadlines, and budgets
        </p>
      </div>

      {/* Primary widgets - actionable information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Deadlines and Projects */}
        <div className="space-y-6">
          <DeadlinesWidget />
          <ProjectsOverview />
        </div>

        {/* Right column: Budget and Meetings */}
        <div className="space-y-6">
          <BudgetOverview />
          <MeetingsWidget />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
