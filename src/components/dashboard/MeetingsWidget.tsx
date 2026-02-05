import { CalendarDaysIcon, UserGroupIcon, BuildingOfficeIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface Meeting {
  id: string;
  eventName: string;
  date: Date;
  endDate: Date;
  location: string;
  supplierCount: number;
  buyerCount: number;
  meetingCount: number;
  status: 'upcoming' | 'ongoing' | 'completed';
}

// Mock data - would be fetched from Meeting Scheduler API
const mockMeetings: Meeting[] = [
  {
    id: '1',
    eventName: 'Japan Food Expo 2026',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: 'Tokyo, Japan',
    supplierCount: 12,
    buyerCount: 45,
    meetingCount: 68,
    status: 'upcoming',
  },
  {
    id: '2',
    eventName: 'Korea Trade Show',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
    location: 'Seoul, South Korea',
    supplierCount: 8,
    buyerCount: 32,
    meetingCount: 0,
    status: 'upcoming',
  },
  {
    id: '3',
    eventName: 'Wine Export Summit',
    date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
    location: 'San Francisco, CA',
    supplierCount: 15,
    buyerCount: 28,
    meetingCount: 42,
    status: 'upcoming',
  },
];

function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = start.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startDay}-${endDay}, ${year}`;
  }
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

function getDaysUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return 'Next week';
  return `In ${Math.ceil(diffDays / 7)} weeks`;
}

export function MeetingsWidget() {
  const totalMeetings = mockMeetings.reduce((sum, m) => sum + m.meetingCount, 0);
  const totalSuppliers = mockMeetings.reduce((sum, m) => sum + m.supplierCount, 0);
  const totalBuyers = mockMeetings.reduce((sum, m) => sum + m.buyerCount, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow dark:shadow-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <CalendarDaysIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Upcoming Events</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{mockMeetings.length} scheduled</p>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalMeetings}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Meetings</p>
        </div>
        <div className="text-center border-x border-gray-200 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalSuppliers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Suppliers</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalBuyers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Buyers</p>
        </div>
      </div>

      {/* Event list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {mockMeetings.map((event) => (
          <div
            key={event.id}
            className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{event.eventName}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <MapPinIcon className="w-3.5 h-3.5" />
                  {event.location}
                </div>
              </div>
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 whitespace-nowrap ml-2">
                {getDaysUntil(event.date)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                {formatDateRange(event.date, event.endDate)}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <BuildingOfficeIcon className="w-3.5 h-3.5" />
                  {event.supplierCount}
                </span>
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <UserGroupIcon className="w-3.5 h-3.5" />
                  {event.buyerCount}
                </span>
                {event.meetingCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded font-medium">
                    {event.meetingCount} mtgs
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <a
          href="/meeting-scheduler"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View all events →
        </a>
      </div>
    </div>
  );
}
