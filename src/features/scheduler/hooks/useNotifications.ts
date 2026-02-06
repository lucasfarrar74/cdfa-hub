import { useEffect, useCallback, useRef, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  delayAlerts: boolean;
  completionAlerts: boolean;
}

const defaultSettings: NotificationSettings = {
  enabled: false,
  soundEnabled: false,
  delayAlerts: true,
  completionAlerts: false,
};

export function useNotifications() {
  const { meetings, suppliers, buyers } = useSchedule();
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem('meeting-scheduler-notifications');
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  // Track previous meeting states to detect changes
  const prevMeetingsRef = useRef<typeof meetings>([]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('meeting-scheduler-notifications', JSON.stringify(settings));
  }, [settings]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setSettings(prev => ({ ...prev, enabled: true }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  // Show a notification
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!settings.enabled || permission !== 'granted') return;

      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });

        // Play sound if enabled
        if (settings.soundEnabled) {
          // Use a simple beep - browsers allow this after user interaction
          const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.frequency.value = 440;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.15);
        }

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        console.error('Failed to show notification:', error);
      }
    },
    [settings.enabled, settings.soundEnabled, permission]
  );

  // Monitor meeting changes for automatic notifications
  useEffect(() => {
    if (!settings.enabled || permission !== 'granted') return;

    const prevMeetings = prevMeetingsRef.current;
    prevMeetingsRef.current = meetings;

    // Skip initial render
    if (prevMeetings.length === 0) return;

    meetings.forEach(meeting => {
      const prevMeeting = prevMeetings.find(m => m.id === meeting.id);
      if (!prevMeeting || prevMeeting.status === meeting.status) return;

      const supplier = suppliers.find(s => s.id === meeting.supplierId);
      const buyer = buyers.find(b => b.id === meeting.buyerId);
      if (!supplier || !buyer) return;

      const meetingLabel = `${supplier.companyName} × ${buyer.name}`;

      // Delay alerts
      if (settings.delayAlerts) {
        if (
          meeting.status === 'delayed' &&
          prevMeeting.status !== 'delayed'
        ) {
          showNotification('Meeting Delayed', {
            body: `${meetingLabel}${meeting.delayReason ? `\nReason: ${meeting.delayReason}` : ''}`,
            tag: `delay-${meeting.id}`,
          });
        }

        if (
          meeting.status === 'running_late' &&
          prevMeeting.status !== 'running_late'
        ) {
          showNotification('Meeting Running Late', {
            body: meetingLabel,
            tag: `late-${meeting.id}`,
          });
        }

        if (
          meeting.status === 'bumped' &&
          prevMeeting.status !== 'bumped'
        ) {
          showNotification('Meeting Bumped', {
            body: `${meetingLabel} was moved to a later slot`,
            tag: `bump-${meeting.id}`,
          });
        }
      }

      // Completion alerts
      if (settings.completionAlerts) {
        if (
          meeting.status === 'completed' &&
          prevMeeting.status !== 'completed'
        ) {
          showNotification('Meeting Completed', {
            body: meetingLabel,
            tag: `complete-${meeting.id}`,
          });
        }
      }
    });
  }, [meetings, suppliers, buyers, settings, permission, showNotification]);

  const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleEnabled = useCallback(async () => {
    if (!settings.enabled) {
      // Enabling - need permission first
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return;
      }
      setSettings(prev => ({ ...prev, enabled: true }));
    } else {
      setSettings(prev => ({ ...prev, enabled: false }));
    }
  }, [settings.enabled, permission, requestPermission]);

  return {
    settings,
    permission,
    updateSettings,
    toggleEnabled,
    requestPermission,
    showNotification,
    isSupported: typeof Notification !== 'undefined',
  };
}
