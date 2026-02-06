import { useState, useCallback } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { ExcelUploader } from '../components/import/ExcelUploader';
import { ColumnMapper } from '../components/import/ColumnMapper';
import { DataPreview } from '../components/import/DataPreview';
import {
  parseExcelFile,
  autoDetectColumnMapping,
  transformToSuppliers,
  type ExcelParseResult,
  type ColumnMapping,
  type MappedSupplier,
} from '../utils/excelParser';
import { cn } from '../lib/utils';
import { ScheduleProvider, useSchedule } from '../features/scheduler/context/ScheduleContext';

type ImportStep = 'upload' | 'map' | 'preview' | 'complete';

interface ImportResult {
  success: boolean;
  importedCount: number;
  error?: string;
}

function DataImportContent() {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [mappedSuppliers, setMappedSuppliers] = useState<MappedSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { importSuppliers } = useSchedule();

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await parseExcelFile(file);
      setParseResult(result);

      // Auto-detect column mappings
      const mapping = autoDetectColumnMapping(result.headers);
      setColumnMapping(mapping);

      // Move to mapping step
      setCurrentStep('map');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMappingChange = useCallback((mapping: ColumnMapping) => {
    setColumnMapping(mapping);
  }, []);

  const handleMappingComplete = useCallback(() => {
    if (!parseResult || !columnMapping) return;

    // Transform data to suppliers
    const suppliers = transformToSuppliers(parseResult.rows, columnMapping);
    setMappedSuppliers(suppliers);
    setCurrentStep('preview');
  }, [parseResult, columnMapping]);

  const handleImport = useCallback(() => {
    if (mappedSuppliers.length === 0) {
      setError('No suppliers to import');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Import directly to the Meeting Scheduler context
      importSuppliers(mappedSuppliers);

      setImportResult({
        success: true,
        importedCount: mappedSuppliers.length,
      });
      setCurrentStep('complete');
    } catch (err) {
      setImportResult({
        success: false,
        importedCount: 0,
        error: err instanceof Error ? err.message : 'Import failed',
      });
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  }, [mappedSuppliers, importSuppliers]);

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'map':
        setCurrentStep('upload');
        setParseResult(null);
        break;
      case 'preview':
        setCurrentStep('map');
        break;
      case 'complete':
        setCurrentStep('upload');
        setParseResult(null);
        setColumnMapping(null);
        setMappedSuppliers([]);
        setImportResult(null);
        break;
    }
  }, [currentStep]);

  const handleStartOver = useCallback(() => {
    setCurrentStep('upload');
    setParseResult(null);
    setColumnMapping(null);
    setMappedSuppliers([]);
    setImportResult(null);
    setError(null);
  }, []);

  const steps = [
    { id: 'upload', label: 'Upload' },
    { id: 'map', label: 'Map Columns' },
    { id: 'preview', label: 'Preview' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Import Participant Data
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload an Excel file to import suppliers into the Meeting Scheduler
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  index < currentStepIndex
                    ? "bg-green-500 text-white"
                    : index === currentStepIndex
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                )}
              >
                {index < currentStepIndex ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm font-medium",
                  index <= currentStepIndex
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4",
                    index < currentStepIndex
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        {currentStep === 'upload' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Upload Excel File
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Upload an Excel file (.xls or .xlsx) containing participant data.
              The file should include columns for company name and contact information.
            </p>
            <ExcelUploader
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              error={error}
            />
          </div>
        )}

        {currentStep === 'map' && parseResult && columnMapping && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Map Columns
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Map your Excel columns to the supplier fields. We've auto-detected some mappings for you.
            </p>
            <ColumnMapper
              headers={parseResult.headers}
              mapping={columnMapping}
              onChange={handleMappingChange}
              parseInfo={{
                headerRow: parseResult.headerRowIndex + 1,
                dataRows: parseResult.rows.length,
                sheet: parseResult.activeSheet,
              }}
            />
          </div>
        )}

        {currentStep === 'preview' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Preview Import
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Review the data that will be imported. {mappedSuppliers.length} suppliers will be added to the Meeting Scheduler.
            </p>
            <DataPreview suppliers={mappedSuppliers} />
          </div>
        )}

        {currentStep === 'complete' && importResult && (
          <div className="text-center py-8">
            {importResult.success ? (
              <>
                <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Import Successful!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {importResult.importedCount} suppliers have been imported to the Meeting Scheduler.
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleStartOver}
                    className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Import Another File
                  </button>
                  <a
                    href="/meeting-scheduler"
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open Meeting Scheduler
                  </a>
                </div>
              </>
            ) : (
              <>
                <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Import Failed
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {importResult.error || 'An error occurred during import.'}
                </p>
                <button
                  onClick={handleStartOver}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        )}

        {/* Error display */}
        {error && currentStep !== 'upload' && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        {currentStep !== 'complete' && (
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleBack}
              disabled={currentStep === 'upload'}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                currentStep === 'upload'
                  ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back
            </button>

            {currentStep === 'map' && (
              <button
                onClick={handleMappingComplete}
                disabled={!columnMapping?.companyName}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                  columnMapping?.companyName
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                )}
              >
                Continue
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            )}

            {currentStep === 'preview' && (
              <button
                onClick={handleImport}
                disabled={isLoading || mappedSuppliers.length === 0}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-lg transition-colors",
                  isLoading || mappedSuppliers.length === 0
                    ? "text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                    : "text-white bg-green-600 hover:bg-green-700"
                )}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <DocumentTextIcon className="w-4 h-4" />
                    Import {mappedSuppliers.length} Suppliers
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DataImport() {
  return (
    <ScheduleProvider>
      <DataImportContent />
    </ScheduleProvider>
  );
}
