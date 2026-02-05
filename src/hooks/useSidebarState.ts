import { useLocalStorage } from './useLocalStorage';

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const [mobileOpen, setMobileOpen] = useLocalStorage('sidebar-mobile-open', false);

  const toggleCollapsed = () => setCollapsed(prev => !prev);
  const toggleMobileOpen = () => setMobileOpen(prev => !prev);
  const closeMobile = () => setMobileOpen(false);

  return {
    collapsed,
    mobileOpen,
    setCollapsed,
    setMobileOpen,
    toggleCollapsed,
    toggleMobileOpen,
    closeMobile,
  } satisfies SidebarState & {
    setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
    setMobileOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
    toggleCollapsed: () => void;
    toggleMobileOpen: () => void;
    closeMobile: () => void;
  };
}
