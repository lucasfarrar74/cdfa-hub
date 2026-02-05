export interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  dashboardUrl: string;
  color: 'blue' | 'green' | 'amber';
  status: 'available' | 'coming_soon';
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  section: 'main' | 'tools';
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: string;
}

export interface WidgetConfig {
  id: string;
  toolId: string;
  title: string;
  gridSpan: 'half' | 'full';
  minHeight: number;
}
