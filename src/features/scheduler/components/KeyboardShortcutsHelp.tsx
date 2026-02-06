import { useState } from 'react';

const shortcuts = [
  { key: '←/→', description: 'Navigate time slots' },
  { key: '↑/↓', description: 'Navigate suppliers' },
  { key: 'Space', description: 'Toggle meeting status' },
  { key: 'D', description: 'Mark meeting as delayed' },
  { key: 'B', description: 'Bump to later slot' },
  { key: 'Ctrl+Z', description: 'Undo last action' },
  { key: 'Ctrl+Y', description: 'Redo last action' },
  { key: 'Esc', description: 'Clear selection' },
];

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        title="Keyboard shortcuts"
      >
        <span className="text-base">⌨</span>
        <span className="hidden sm:inline">Shortcuts</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 p-3 z-50 w-56">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1.5">
              {shortcuts.map(({ key, description }) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">{description}</span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500">
              Click on a meeting cell to select it first
            </div>
          </div>
        </>
      )}
    </div>
  );
}
