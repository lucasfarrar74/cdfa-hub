export interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  dashboardUrl: string;
  color: 'blue' | 'green' | 'amber';
  status: 'available' | 'coming_soon';
}

export interface NavigationChild {
  id: string;
  label: string;
  path: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  section: 'main' | 'tools';
  children?: NavigationChild[];
  hidden?: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: string;
  internal?: boolean;
}

export interface WidgetConfig {
  id: string;
  toolId: string;
  title: string;
  gridSpan: 'half' | 'full';
  minHeight: number;
}
