import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChevronLeftIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';
import { navigationItems } from '../../config/navigation';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'home': HomeIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  'calendar': CalendarIcon,
  'currency-dollar': CurrencyDollarIcon,
  'arrow-up-tray': ArrowUpTrayIcon,
  'link': LinkIcon,
};

export function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const mainNavItems = navigationItems.filter(item => item.section === 'main');
  const toolNavItems = navigationItems.filter(item => item.section === 'tools');

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          <div className={cn("flex items-center gap-3", collapsed && "lg:justify-center")}>
            <div className="p-1.5 bg-blue-600 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">CDFA Hub</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Integration Center</p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {/* Main section */}
          <div className="mb-6">
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Overview
              </p>
            )}
            <ul className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = iconMap[item.icon] || HomeIcon;
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          collapsed && "lg:justify-center lg:px-2",
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                        )
                      }
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Tools section */}
          <div>
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Tools
              </p>
            )}
            <ul className="space-y-1">
              {toolNavItems.map((item) => {
                const Icon = iconMap[item.icon] || ClipboardDocumentListIcon;
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          collapsed && "lg:justify-center lg:px-2",
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                        )
                      }
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Collapse toggle - desktop only */}
        <div className="hidden lg:block p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onToggleCollapse}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors",
              collapsed && "justify-center px-2"
            )}
          >
            <ChevronLeftIcon
              className={cn(
                "w-5 h-5 transition-transform",
                collapsed && "rotate-180"
              )}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
