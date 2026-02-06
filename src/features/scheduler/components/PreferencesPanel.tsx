import { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import type { PreferenceType } from '../types';

export default function PreferencesPanel() {
  const { suppliers, buyers, updateSupplier } = useSchedule();
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(
    suppliers.length > 0 ? suppliers[0].id : null
  );

  const currentSupplier = suppliers.find(s => s.id === selectedSupplier);

  const handlePreferenceChange = (preference: PreferenceType) => {
    if (!selectedSupplier) return;
    updateSupplier(selectedSupplier, { preference, preferenceList: [] });
  };

  const toggleBuyerInList = (buyerId: string) => {
    if (!currentSupplier) return;
    const newList = currentSupplier.preferenceList.includes(buyerId)
      ? currentSupplier.preferenceList.filter(id => id !== buyerId)
      : [...currentSupplier.preferenceList, buyerId];
    updateSupplier(selectedSupplier!, { preferenceList: newList });
  };

  const selectAllBuyers = () => {
    if (!selectedSupplier) return;
    updateSupplier(selectedSupplier, { preferenceList: buyers.map(b => b.id) });
  };

  const clearAllBuyers = () => {
    if (!selectedSupplier) return;
    updateSupplier(selectedSupplier, { preferenceList: [] });
  };

  if (suppliers.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
        <p className="text-yellow-800 dark:text-yellow-300">
          Please add suppliers in the "Participants" tab first.
        </p>
      </div>
    );
  }

  if (buyers.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
        <p className="text-yellow-800 dark:text-yellow-300">
          Please add buyers in the "Participants" tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Suppliers</h2>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {suppliers.map(supplier => (
            <button
              key={supplier.id}
              onClick={() => setSelectedSupplier(supplier.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                selectedSupplier === supplier.id
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="font-medium">{supplier.companyName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {supplier.preference === 'all' && 'Meeting everyone'}
                {supplier.preference === 'include' &&
                  `Include list (${supplier.preferenceList.length})`}
                {supplier.preference === 'exclude' &&
                  `Exclude list (${supplier.preferenceList.length})`}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50 p-4">
        {currentSupplier ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Preferences for {currentSupplier.companyName}
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meeting Preference
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
                  <input
                    type="radio"
                    name="preference"
                    checked={currentSupplier.preference === 'all'}
                    onChange={() => handlePreferenceChange('all')}
                    className="text-blue-500"
                  />
                  <span>Meet everyone</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
                  <input
                    type="radio"
                    name="preference"
                    checked={currentSupplier.preference === 'include'}
                    onChange={() => handlePreferenceChange('include')}
                    className="text-blue-500"
                  />
                  <span>Meet only selected buyers</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-900 dark:text-gray-100">
                  <input
                    type="radio"
                    name="preference"
                    checked={currentSupplier.preference === 'exclude'}
                    onChange={() => handlePreferenceChange('exclude')}
                    className="text-blue-500"
                  />
                  <span>Meet everyone except selected buyers</span>
                </label>
              </div>
            </div>

            {currentSupplier.preference !== 'all' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {currentSupplier.preference === 'include'
                      ? 'Select buyers to meet:'
                      : 'Select buyers to exclude:'}
                  </label>
                  <div className="space-x-2">
                    <button
                      onClick={selectAllBuyers}
                      className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAllBuyers}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-64 overflow-y-auto">
                  {buyers.map(buyer => (
                    <label
                      key={buyer.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={currentSupplier.preferenceList.includes(buyer.id)}
                        onChange={() => toggleBuyerInList(buyer.id)}
                        className="text-blue-500 rounded"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{buyer.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({buyer.organization})</span>
                    </label>
                  ))}
                </div>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {currentSupplier.preferenceList.length} buyer(s) selected
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">Select a supplier to configure preferences</p>
        )}
      </div>
    </div>
  );
}
