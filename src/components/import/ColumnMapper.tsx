import { useCallback } from 'react';
import {
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';
import type { ColumnMapping } from '../../utils/excelParser';

interface ColumnMapperProps {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  parseInfo: {
    headerRow: number;
    dataRows: number;
    sheet: string;
  };
}

interface FieldConfig {
  key: keyof ColumnMapping;
  label: string;
  description: string;
  required: boolean;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'companyName',
    label: 'Company Name',
    description: 'The name of the supplier company (required)',
    required: true,
  },
  {
    key: 'firstName',
    label: 'First Name',
    description: 'Contact person first name',
    required: false,
  },
  {
    key: 'lastName',
    label: 'Last Name',
    description: 'Contact person last name',
    required: false,
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Contact email address',
    required: false,
  },
  {
    key: 'website',
    label: 'Website',
    description: 'Company website (for reference only)',
    required: false,
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Products or services offered (for reference only)',
    required: false,
  },
];

export function ColumnMapper({ headers, mapping, onChange, parseInfo }: ColumnMapperProps) {
  const handleFieldChange = useCallback((field: keyof ColumnMapping, value: string) => {
    onChange({
      ...mapping,
      [field]: value || null,
    });
  }, [mapping, onChange]);

  const isMapped = (field: keyof ColumnMapping) => mapping[field] !== null;
  const isCompanyNameMapped = mapping.companyName !== null;
  const hasContactName = mapping.firstName !== null || mapping.lastName !== null;

  return (
    <div className="space-y-6">
      {/* Parse Info */}
      <div className="flex flex-wrap gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <InformationCircleIcon className="w-5 h-5 text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Sheet: <strong>{parseInfo.sheet}</strong>
          </span>
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          Headers found on row <strong>{parseInfo.headerRow}</strong>
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <strong>{parseInfo.dataRows}</strong> data rows detected
        </div>
      </div>

      {/* Validation Status */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg",
        isCompanyNameMapped && hasContactName
          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
      )}>
        {isCompanyNameMapped && hasContactName ? (
          <>
            <CheckIcon className="w-5 h-5 text-green-500" />
            <span className="text-sm text-green-700 dark:text-green-300">
              Required fields are mapped. Ready to continue.
            </span>
          </>
        ) : (
          <>
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              {!isCompanyNameMapped
                ? "Please map the Company Name field (required)"
                : "Consider mapping First Name or Last Name for better contact information"}
            </span>
          </>
        )}
      </div>

      {/* Column Mapping Grid */}
      <div className="grid gap-4">
        {FIELD_CONFIGS.map((field) => (
          <div
            key={field.key}
            className={cn(
              "grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border transition-colors",
              isMapped(field.key)
                ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            )}
          >
            {/* Field Info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {field.label}
                </span>
                {field.required && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded">
                    Required
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {field.description}
              </p>
            </div>

            {/* Column Selector */}
            <div className="md:col-span-2">
              <select
                value={mapping[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  isMapped(field.key)
                    ? "border-green-300 dark:border-green-700"
                    : "border-gray-300 dark:border-gray-600"
                )}
              >
                <option value="">-- Select column --</option>
                {headers.filter(h => h.trim() !== '').map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>

              {/* Show current value preview */}
              {isMapped(field.key) && (
                <div className="mt-2 flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Mapped to "{mapping[field.key]}"
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Tips</h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
          <li>First Name and Last Name will be combined into "Primary Contact Name"</li>
          <li>If you only have a combined "Name" field, map it to First Name</li>
          <li>Website and Products are saved as metadata but not displayed in the scheduler</li>
          <li>Unmapped columns will be ignored during import</li>
        </ul>
      </div>
    </div>
  );
}
