import { Link } from 'react-router-dom';
import {
  PlusIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ArrowUpTrayIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { quickActions } from '../../config/navigation';

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'plus': PlusIcon,
  'academic-cap': AcademicCapIcon,
  'calendar-days': CalendarDaysIcon,
  'user-group': UserGroupIcon,
  'arrow-up-tray': ArrowUpTrayIcon,
  'link': LinkIcon,
};

export function QuickActions() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow dark:shadow-gray-900/50">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map((action) => {
          const Icon = iconMap[action.icon] || PlusIcon;
          const isInternal = action.url.startsWith('/');

          const content = (
            <>
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                  {action.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{action.description}</p>
              </div>
            </>
          );

          const className = "flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group";

          if (isInternal) {
            return (
              <Link
                key={action.id}
                to={action.url}
                className={className}
              >
                {content}
              </Link>
            );
          }

          return (
            <a
              key={action.id}
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
