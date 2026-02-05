import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';
import type { MappedSupplier } from '../../utils/excelParser';

interface DataPreviewProps {
  suppliers: MappedSupplier[];
}

const ITEMS_PER_PAGE = 10;

export function DataPreview({ suppliers }: DataPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(suppliers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, suppliers.length);
  const currentSuppliers = suppliers.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          No suppliers to preview. Please check your column mappings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Companies</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {suppliers.length}
          </p>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300">With Contact Name</span>
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
            {suppliers.filter(s => s.primaryContact.name && s.primaryContact.name !== 'Contact').length}
          </p>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-purple-700 dark:text-purple-300">With Email</span>
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
            {suppliers.filter(s => s.primaryContact.email).length}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Company Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Primary Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {currentSuppliers.map((supplier, index) => (
              <tr
                key={supplier.id}
                className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {startIndex + index + 1}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {supplier.companyName}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className={cn(
                    "text-sm",
                    supplier.primaryContact.name !== 'Contact'
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-gray-400 dark:text-gray-500 italic"
                  )}>
                    {supplier.primaryContact.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className={cn(
                    "text-sm",
                    supplier.primaryContact.email
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-gray-400 dark:text-gray-500 italic"
                  )}>
                    {supplier.primaryContact.email || 'Not provided'}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {supplier.meetingDuration} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {startIndex + 1} to {endIndex} of {suppliers.length} suppliers
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className={cn(
                "p-2 rounded-lg transition-colors",
                currentPage === 1
                  ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className={cn(
                "p-2 rounded-lg transition-colors",
                currentPage === totalPages
                  ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Import Notes */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Import Notes</h4>
        <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
          <li>Importing will replace all existing suppliers in the Meeting Scheduler</li>
          <li>All suppliers will have default 15-minute meeting duration</li>
          <li>No buyer preferences will be set initially</li>
        </ul>
      </div>
    </div>
  );
}
