import type { Tool } from '../types';

// Use localhost URLs for development, production URLs for deployed version
const isDev = import.meta.env.DEV;

export const tools: Tool[] = [
  {
    id: 'project-manager',
    name: 'Project Manager',
    description: 'Plan and track trade missions, educational events, and consultations. Manage checklists, timelines, and team assignments.',
    url: isDev ? 'http://localhost:5179' : 'https://cdfa-project-manager.vercel.app',
    dashboardUrl: isDev ? 'http://localhost:5179' : 'https://cdfa-project-manager.vercel.app',
    color: 'blue',
    status: 'available',
  },
  {
    id: 'meeting-scheduler',
    name: 'Meeting Scheduler',
    description: 'Schedule and manage B2B meetings between suppliers and buyers. Generate optimized meeting schedules for trade events.',
    url: isDev ? 'http://localhost:5176' : 'https://meeting-scheduler-five.vercel.app',
    dashboardUrl: isDev ? 'http://localhost:5176' : 'https://meeting-scheduler-five.vercel.app',
    color: 'green',
    status: 'available',
  },
  {
    id: 'budget-tracker',
    name: 'Budget Tracker',
    description: 'Track budgets, expenses, and financial allocations for activities. Monitor spending against fiscal year allocations.',
    url: isDev ? 'http://localhost:5000' : 'https://budget-tracker-three-kappa.vercel.app',
    dashboardUrl: isDev ? 'http://localhost:5000' : 'https://budget-tracker-three-kappa.vercel.app',
    color: 'amber',
    status: 'available',
  },
];

export const getToolById = (id: string): Tool | undefined => {
  return tools.find(tool => tool.id === id);
};
