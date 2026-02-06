import { useState, useCallback, useEffect } from 'react';
import {
  PlusIcon,
  LinkIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { ActivityLinkCard } from '../components/linking/ActivityLinkCard';
import { CreateActivityModal } from '../components/linking/CreateActivityModal';
import { ProjectsProvider, useProjects } from '../features/projects/context/ProjectsContext';
import { ScheduleProvider, useSchedule } from '../features/scheduler/context/ScheduleContext';
import type { ActivityLink, ActivityLinkFormData } from '../types/linking';
import { ACTIVITY_LINKS_STORAGE_KEY } from '../types/linking';

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// Load activity links from localStorage
function loadActivityLinks(): ActivityLink[] {
  try {
    const stored = localStorage.getItem(ACTIVITY_LINKS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load activity links:', error);
  }
  return [];
}

// Save activity links to localStorage
function saveActivityLinks(links: ActivityLink[]): void {
  try {
    localStorage.setItem(ACTIVITY_LINKS_STORAGE_KEY, JSON.stringify(links));
  } catch (error) {
    console.error('Failed to save activity links:', error);
  }
}

function ActivityLinksContent() {
  const [activityLinks, setActivityLinks] = useState<ActivityLink[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingScheduleForId, setCreatingScheduleForId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { createActivity } = useProjects();
  const { createProject, setEventConfig } = useSchedule();

  // Load activity links on mount
  useEffect(() => {
    setActivityLinks(loadActivityLinks());
  }, []);

  // Save activity links when they change
  useEffect(() => {
    if (activityLinks.length > 0) {
      saveActivityLinks(activityLinks);
    }
  }, [activityLinks]);

  const handleAddActivity = useCallback(async (formData: ActivityLinkFormData) => {
    const now = new Date().toISOString();
    const linkId = generateId();

    const newLink: ActivityLink = {
      id: linkId,
      ...formData,
      createdAt: now,
      updatedAt: now,
    };

    setActivityLinks(prev => [...prev, newLink]);
    setIsModalOpen(false);

    // Also create the activity in Project Manager
    try {
      createActivity('outbound_trade_mission', {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        location: formData.location,
        status: 'planning',
      });
    } catch (err) {
      console.error('Failed to create activity in Project Manager:', err);
    }
  }, [createActivity]);

  const handleDeleteActivity = useCallback((activityId: string) => {
    if (!window.confirm('Are you sure you want to delete this activity link?')) {
      return;
    }

    setActivityLinks(prev => {
      const updated = prev.filter(a => a.id !== activityId);
      saveActivityLinks(updated);
      return updated;
    });
  }, []);

  const handleCreateMeetingSchedule = useCallback(async (activity: ActivityLink) => {
    setCreatingScheduleForId(activity.id);
    setError(null);

    try {
      // Create a project in Meeting Scheduler
      const project = createProject(activity.name, { cdfaActivityId: activity.id });

      if (project) {
        // Set the event config with dates from the activity
        setEventConfig({
          id: crypto.randomUUID(),
          name: activity.name,
          startDate: activity.startDate,
          endDate: activity.endDate || activity.startDate,
          startTime: '09:00',
          endTime: '17:00',
          defaultMeetingDuration: 30,
          breaks: [],
          schedulingStrategy: 'efficient',
        });

        // Update the activity link with the Meeting Scheduler project info
        setActivityLinks(prev => {
          const updated = prev.map(a =>
            a.id === activity.id
              ? {
                  ...a,
                  meetingSchedulerProjectId: project.id,
                  meetingSchedulerShareId: project.shareId,
                  updatedAt: new Date().toISOString(),
                }
              : a
          );
          saveActivityLinks(updated);
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting schedule');
    } finally {
      setCreatingScheduleForId(null);
    }
  }, [createProject, setEventConfig]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-3">
            <LinkIcon className="w-7 h-7 text-blue-500" />
            Activity Links
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Link activities across Meeting Scheduler and Budget Tracker
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Activity list */}
      {activityLinks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <LinkIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No activities yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Add an activity to start linking it with Meeting Scheduler and Budget Tracker
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Activity
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activityLinks.map(activity => (
            <ActivityLinkCard
              key={activity.id}
              activity={activity}
              onCreateMeetingSchedule={handleCreateMeetingSchedule}
              onDelete={handleDeleteActivity}
              isCreatingSchedule={creatingScheduleForId === activity.id}
            />
          ))}
        </div>
      )}

      {/* Create Activity Modal */}
      <CreateActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddActivity}
      />
    </div>
  );
}

export function ActivityLinks() {
  return (
    <ProjectsProvider>
      <ScheduleProvider>
        <ActivityLinksContent />
      </ScheduleProvider>
    </ProjectsProvider>
  );
}
