import type { NavigationItem, QuickAction, WidgetConfig } from '../types';

// Use localhost URLs for development
const isDev = import.meta.env.DEV;
const projectManagerUrl = isDev ? 'http://localhost:5179' : 'https://cdfa-project-manager.vercel.app';
const meetingSchedulerUrl = isDev ? 'http://localhost:5176' : 'https://meeting-scheduler-five.vercel.app';

export const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
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
    children: [
      { id: 'projects-dashboard', label: 'Dashboard', path: '/projects' },
      { id: 'projects-activities', label: 'Activities', path: '/projects/activities' },
      { id: 'projects-calendar', label: 'Calendar', path: '/projects/calendar' },
      { id: 'projects-timeline', label: 'Timeline', path: '/projects/timeline' },
    ],
  },
  {
    id: 'project-manager-iframe',
    label: 'Project Manager (Legacy)',
    path: '/project-manager',
    icon: 'clipboard-document-list',
    section: 'tools',
    hidden: true,
  },
  {
    id: 'meeting-scheduler',
    label: 'Meeting Scheduler',
    path: '/meeting-scheduler',
    icon: 'calendar',
    section: 'tools',
  },
  {
    id: 'budget-tracker',
    label: 'Budget Tracker',
    path: '/budget-tracker',
    icon: 'currency-dollar',
    section: 'tools',
  },
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
    url: meetingSchedulerUrl,
    icon: 'user-group',
  },
  {
    id: 'import-data',
    label: 'Import Participants',
    description: 'Upload Excel file with participant data',
    url: '/data-import',
    icon: 'arrow-up-tray',
  },
  {
    id: 'link-activities',
    label: 'Link Activities',
    description: 'Connect activities across tools',
    url: '/activity-links',
    icon: 'link',
  },
];

export const dashboardWidgets: WidgetConfig[] = [
  {
    id: 'widget-pm',
    toolId: 'project-manager',
    title: 'Project Manager',
    gridSpan: 'half',
    minHeight: 400,
  },
  {
    id: 'widget-ms',
    toolId: 'meeting-scheduler',
    title: 'Meeting Scheduler',
    gridSpan: 'half',
    minHeight: 400,
  },
  {
    id: 'widget-bt',
    toolId: 'budget-tracker',
    title: 'Budget Tracker',
    gridSpan: 'full',
    minHeight: 350,
  },
];
