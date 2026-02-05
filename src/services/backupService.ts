/**
 * Comprehensive Backup Service for CDFA Hub
 * Collects and restores data from all integrated tools
 */

import { ACTIVITY_LINKS_STORAGE_KEY } from '../types/linking';

// Storage keys used in the Hub
const HUB_STORAGE_KEYS = {
  activityLinks: ACTIVITY_LINKS_STORAGE_KEY,
  theme: 'theme',
  sidebarCollapsed: 'sidebar-collapsed',
};

// Backup data structure
export interface ToolBackupData {
  toolId: string;
  toolName: string;
  data: Record<string, unknown>;
  exportedAt: string;
}

export interface ComprehensiveBackup {
  version: '1.0';
  createdAt: string;
  hub: {
    activityLinks: unknown[];
    preferences: {
      theme: string | null;
      sidebarCollapsed: boolean | null;
    };
  };
  tools: ToolBackupData[];
}

/**
 * Collect all Hub localStorage data
 */
export function collectHubData(): ComprehensiveBackup['hub'] {
  let activityLinks: unknown[] = [];
  try {
    const stored = localStorage.getItem(HUB_STORAGE_KEYS.activityLinks);
    if (stored) {
      activityLinks = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to read activity links:', e);
  }

  return {
    activityLinks,
    preferences: {
      theme: localStorage.getItem(HUB_STORAGE_KEYS.theme),
      sidebarCollapsed: localStorage.getItem(HUB_STORAGE_KEYS.sidebarCollapsed) === 'true',
    },
  };
}

/**
 * Restore Hub data from backup
 */
export function restoreHubData(hubData: ComprehensiveBackup['hub']): void {
  if (hubData.activityLinks) {
    localStorage.setItem(HUB_STORAGE_KEYS.activityLinks, JSON.stringify(hubData.activityLinks));
  }
  if (hubData.preferences.theme) {
    localStorage.setItem(HUB_STORAGE_KEYS.theme, hubData.preferences.theme);
  }
  if (hubData.preferences.sidebarCollapsed !== null) {
    localStorage.setItem(HUB_STORAGE_KEYS.sidebarCollapsed, String(hubData.preferences.sidebarCollapsed));
  }
}

/**
 * Request backup data from an embedded tool iframe
 */
export function requestToolBackup(
  iframe: HTMLIFrameElement,
  toolId: string,
  timeoutMs: number = 5000
): Promise<ToolBackupData | null> {
  return new Promise((resolve) => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'CDFA_BACKUP_RESPONSE' && event.data?.toolId === toolId) {
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);
        resolve({
          toolId,
          toolName: event.data.toolName || toolId,
          data: event.data.data || {},
          exportedAt: new Date().toISOString(),
        });
      }
    };

    const timeout = setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      console.warn(`Backup request timed out for tool: ${toolId}`);
      resolve(null);
    }, timeoutMs);

    window.addEventListener('message', messageHandler);

    // Send backup request to iframe
    iframe.contentWindow?.postMessage(
      {
        type: 'CDFA_BACKUP_REQUEST',
        action: 'EXPORT_DATA',
        toolId,
      },
      '*'
    );
  });
}

/**
 * Send restore data to an embedded tool iframe
 */
export function sendRestoreToTool(
  iframe: HTMLIFrameElement,
  toolId: string,
  data: Record<string, unknown>,
  timeoutMs: number = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'CDFA_RESTORE_RESPONSE' && event.data?.toolId === toolId) {
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);
        resolve(event.data.success === true);
      }
    };

    const timeout = setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      console.warn(`Restore request timed out for tool: ${toolId}`);
      resolve(false);
    }, timeoutMs);

    window.addEventListener('message', messageHandler);

    // Send restore request to iframe
    iframe.contentWindow?.postMessage(
      {
        type: 'CDFA_RESTORE_REQUEST',
        action: 'IMPORT_DATA',
        toolId,
        data,
      },
      '*'
    );
  });
}

/**
 * Create a comprehensive backup of all tools
 */
export async function createComprehensiveBackup(
  toolIframes: Map<string, HTMLIFrameElement>
): Promise<ComprehensiveBackup> {
  const backup: ComprehensiveBackup = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    hub: collectHubData(),
    tools: [],
  };

  // Request backup from each tool
  const toolPromises = Array.from(toolIframes.entries()).map(async ([toolId, iframe]) => {
    const toolData = await requestToolBackup(iframe, toolId);
    if (toolData) {
      backup.tools.push(toolData);
    }
  });

  await Promise.all(toolPromises);

  return backup;
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(backup: ComprehensiveBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cdfa-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate backup file structure
 */
export function validateBackup(data: unknown): data is ComprehensiveBackup {
  if (!data || typeof data !== 'object') return false;
  const backup = data as ComprehensiveBackup;
  return (
    backup.version === '1.0' &&
    typeof backup.createdAt === 'string' &&
    backup.hub !== undefined &&
    Array.isArray(backup.tools)
  );
}

/**
 * Get backup statistics
 */
export function getBackupStats(backup: ComprehensiveBackup): {
  activityLinksCount: number;
  toolsCount: number;
  createdAt: string;
} {
  return {
    activityLinksCount: backup.hub.activityLinks?.length || 0,
    toolsCount: backup.tools.length,
    createdAt: backup.createdAt,
  };
}
