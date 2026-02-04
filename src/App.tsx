import './index.css';

interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  status: 'available' | 'coming_soon';
  actions: { label: string; url: string }[];
}

const tools: Tool[] = [
  {
    id: 'project-manager',
    name: 'Project Manager',
    description: 'Plan and track trade missions, educational events, and consultations. Manage checklists, timelines, and team assignments.',
    url: 'https://cdfa-project-manager.vercel.app',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: 'blue',
    status: 'available',
    actions: [
      { label: 'Open Dashboard', url: 'https://cdfa-project-manager.vercel.app' },
      { label: 'View Calendar', url: 'https://cdfa-project-manager.vercel.app/calendar' },
      { label: 'Activities', url: 'https://cdfa-project-manager.vercel.app/activities' },
    ],
  },
  {
    id: 'meeting-scheduler',
    name: 'Meeting Scheduler',
    description: 'Schedule and manage B2B meetings between suppliers and buyers. Generate optimized meeting schedules for trade events.',
    url: 'https://meeting-scheduler-pi-one.vercel.app',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: 'green',
    status: 'available',
    actions: [
      { label: 'Open Scheduler', url: 'https://meeting-scheduler-pi-one.vercel.app' },
    ],
  },
  {
    id: 'budgeting',
    name: 'Budgeting Tool',
    description: 'Track budgets, expenses, and financial allocations for activities. Monitor spending against fiscal year allocations.',
    url: '#',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'amber',
    status: 'coming_soon',
    actions: [],
  },
];

function ToolCard({ tool }: { tool: Tool }) {
  const colorClasses: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:border-blue-400' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', hover: 'hover:border-green-400' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', hover: 'hover:border-amber-400' },
  };
  const colors = colorClasses[tool.color] || colorClasses.blue;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${colors.border} ${colors.hover} transition-all p-6 flex flex-col`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colors.bg} ${colors.text}`}>
          {tool.icon}
        </div>
        {tool.status === 'coming_soon' && (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            Coming Soon
          </span>
        )}
        {tool.status === 'available' && (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            Available
          </span>
        )}
      </div>

      <h3 className="text-xl font-semibold text-gray-900 mb-2">{tool.name}</h3>
      <p className="text-gray-600 text-sm mb-4 flex-grow">{tool.description}</p>

      {tool.status === 'available' ? (
        <div className="space-y-2">
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full text-center py-2.5 px-4 rounded-lg font-medium text-white bg-gradient-to-r ${
              tool.color === 'blue' ? 'from-blue-500 to-blue-600' :
              tool.color === 'green' ? 'from-green-500 to-green-600' :
              'from-amber-500 to-amber-600'
            } hover:shadow-md transition-shadow`}
          >
            Open Tool
          </a>
          {tool.actions.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {tool.actions.slice(1).map((action) => (
                <a
                  key={action.label}
                  href={action.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  {action.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="py-2.5 px-4 rounded-lg bg-gray-100 text-gray-500 text-center font-medium">
          Coming Soon
        </div>
      )}
    </div>
  );
}

function QuickLinks() {
  const links = [
    {
      label: 'Create Trade Mission',
      description: 'Start planning a new trade mission',
      url: 'https://cdfa-project-manager.vercel.app/activities?new=true&type=outbound_trade_mission',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      label: 'Create Educational Event',
      description: 'Plan a webinar or seminar',
      url: 'https://cdfa-project-manager.vercel.app/activities?new=true&type=webinar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      label: 'View Calendar',
      description: 'See all scheduled activities',
      url: 'https://cdfa-project-manager.vercel.app/calendar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Schedule Meetings',
      description: 'Create B2B meeting schedules',
      url: 'https://meeting-scheduler-pi-one.vercel.app',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
              {link.icon}
            </div>
            <div>
              <p className="font-medium text-gray-900 group-hover:text-blue-700">{link.label}</p>
              <p className="text-xs text-gray-500">{link.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CDFA Tools</h1>
              <p className="text-sm text-gray-600">International Trade Program Management Suite</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Tool Cards */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <QuickLinks />
        </section>

        {/* Integration Info */}
        <section className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Integrated Workflow</h2>
          <p className="text-blue-800 text-sm mb-4">
            These tools are designed to work together. Create a trade activity in Project Manager,
            then link it to Meeting Scheduler for B2B meeting coordination. Budget tracking
            will integrate with both tools when available.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Deep linking between tools
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Shared activity references
            </div>
            <div className="flex items-center gap-2 text-blue-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Fiscal year alignment
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-gray-500">
        <p>CDFA International Trade Program Tools</p>
      </footer>
    </div>
  );
}

export default App;
