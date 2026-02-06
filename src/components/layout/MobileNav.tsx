import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/projects', label: 'Projects', icon: ClipboardDocumentListIcon },
  { path: '/meeting-scheduler', label: 'Meetings', icon: CalendarIcon },
  { path: '/budget-tracker', label: 'Budget', icon: CurrencyDollarIcon },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 lg:hidden">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center flex-1 h-full px-2 text-xs font-medium transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                )
              }
            >
              <Icon className="w-6 h-6 mb-1" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
