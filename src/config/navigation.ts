import type { NavigationItem, QuickAction } from '../types';

export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Home',
    path: '/',
    icon: 'home',
    section: 'main',
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    icon: 'clipboard-document-list',
    section: 'tools',
  },
  {
    id: 'meeting-scheduler',
    label: 'Meetings',
    path: '/meeting-scheduler',
    icon: 'calendar',
    section: 'tools',
  },
  {
    id: 'budget-tracker',
    label: 'Budget',
    path: '/budget-tracker',
    icon: 'currency-dollar',
    section: 'tools',
  },
];

export const utilityItems: NavigationItem[] = [
  {
    id: 'data-import',
    label: 'Import Data',
    path: '/data-import',
    icon: 'arrow-up-tray',
    section: 'tools',
  },
  {
    id: 'activity-links',
    label: 'Activity Links',
    path: '/activity-links',
    icon: 'link',
    section: 'tools',
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    path: '/backup',
    icon: 'shield-check',
    section: 'tools',
  },
];

export const quickActions: QuickAction[] = [
  {
    id: 'create-trade-mission',
    label: 'Create Trade Mission',
    description: 'Start planning a new trade mission',
    url: '/projects/activities?new=true&type=outbound_trade_mission',
    icon: 'plus',
    internal: true,
  },
  {
    id: 'create-event',
    label: 'Create Educational Event',
    description: 'Plan a webinar or seminar',
    url: '/projects/activities?new=true&type=webinar',
    icon: 'academic-cap',
    internal: true,
  },
  {
    id: 'view-calendar',
    label: 'View Calendar',
    description: 'See all scheduled activities',
    url: '/projects/calendar',
    icon: 'calendar-days',
    internal: true,
  },
  {
    id: 'schedule-meetings',
    label: 'Schedule Meetings',
    description: 'Create B2B meeting schedules',
    url: '/meeting-scheduler',
    icon: 'user-group',
    internal: true,
  },
  {
    id: 'import-data',
    label: 'Import Participants',
    description: 'Upload Excel file with participant data',
    url: '/data-import',
    icon: 'arrow-up-tray',
    internal: true,
  },
  {
    id: 'link-activities',
    label: 'Link Activities',
    description: 'Connect activities across tools',
    url: '/activity-links',
    icon: 'link',
    internal: true,
  },
];
