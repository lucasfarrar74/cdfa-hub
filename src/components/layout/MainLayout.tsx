import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from '../ErrorBoundary';
import { useSidebarState } from '../../hooks/useSidebarState';
import { cn } from '../../lib/utils';

export function MainLayout() {
  const { collapsed, mobileOpen, toggleCollapsed, toggleMobileOpen, closeMobile } = useSidebarState();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={toggleCollapsed}
        onCloseMobile={closeMobile}
      />
      <Header
        onMenuClick={toggleMobileOpen}
        sidebarCollapsed={collapsed}
      />
      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-300",
          collapsed ? "lg:pl-16" : "lg:pl-60"
        )}
      >
        <div className="p-4 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
