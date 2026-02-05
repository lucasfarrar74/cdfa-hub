import { useState, useCallback, useRef } from 'react';
import {
  DocumentArrowUpIcon,
  XMarkIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface ExcelUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ExcelUploader({ onFileSelect, isLoading = false, error = null }: ExcelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (isValidExcelFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const isValidExcelFile = (file: File): boolean => {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.xls', '.xlsx'];

    return validTypes.includes(file.type) ||
           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFileInput}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : selectedFile
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800",
          error && "border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20",
          isLoading && "opacity-60 pointer-events-none"
        )}
      >
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Processing file...</p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center">
            <div className="relative">
              <DocumentIcon className="w-12 h-12 text-green-500 mb-3" />
              <button
                onClick={handleClear}
                className="absolute -top-1 -right-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{selectedFile.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <DocumentArrowUpIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" />
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Drop Excel file here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Supports .xls and .xlsx files
            </p>
          </div>
        )}

        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <p className="text-blue-600 dark:text-blue-400 font-medium">Drop file here</p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
