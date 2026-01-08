
import React, { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, FileStack } from 'lucide-react';
import { FileData } from '../types';
import { parseCsvPreview, parseExcelPreview } from '../utils/csvHelpers';
import { useLanguage } from '../App';

type ThemeColor = 'cyan' | 'emerald' | 'purple' | 'pink' | 'orange' | 'red' | 'amber' | 'blue' | 'violet' | 'indigo' | 'lime' | 'gray';

interface FileUploaderProps {
  label?: string;
  onFileLoaded?: (data: FileData) => void;
  onFilesSelected?: (files: File[]) => void;
  fileData?: FileData; // For single file mode visualization
  disabled?: boolean;
  className?: string;
  theme?: ThemeColor | string;
  multiple?: boolean;
  limitText?: string;
  accept?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
    label, 
    onFileLoaded, 
    onFilesSelected,
    fileData, 
    disabled, 
    className, 
    theme = 'cyan', 
    multiple = false,
    limitText,
    accept = ".csv,.xlsx,.xls,.pdf,.docx,.png,.jpg,.jpeg,.webp"
}) => {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme color mappings
  const themeStyles: Record<string, { border: string, bg: string, iconBg: string, iconText: string, hoverBorder: string }> = {
    cyan: { border: 'border-cyan-400', bg: 'bg-cyan-400/10', iconBg: 'bg-cyan-500/20', iconText: 'text-cyan-400', hoverBorder: 'hover:border-cyan-500/50' },
    emerald: { border: 'border-emerald-400', bg: 'bg-emerald-400/10', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400', hoverBorder: 'hover:border-emerald-500/50' },
    purple: { border: 'border-purple-400', bg: 'bg-purple-400/10', iconBg: 'bg-purple-500/20', iconText: 'text-purple-400', hoverBorder: 'hover:border-purple-500/50' },
    pink: { border: 'border-pink-400', bg: 'bg-pink-400/10', iconBg: 'bg-pink-500/20', iconText: 'text-pink-400', hoverBorder: 'hover:border-pink-500/50' },
    orange: { border: 'border-orange-400', bg: 'bg-orange-400/10', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400', hoverBorder: 'hover:border-orange-500/50' },
    red: { border: 'border-red-400', bg: 'bg-red-400/10', iconBg: 'bg-red-500/20', iconText: 'text-red-400', hoverBorder: 'hover:border-red-500/50' },
    amber: { border: 'border-amber-400', bg: 'bg-amber-400/10', iconBg: 'bg-amber-500/20', iconText: 'text-amber-400', hoverBorder: 'hover:border-amber-500/50' },
    blue: { border: 'border-blue-400', bg: 'bg-blue-400/10', iconBg: 'bg-blue-500/20', iconText: 'text-blue-400', hoverBorder: 'hover:border-blue-500/50' },
    violet: { border: 'border-violet-400', bg: 'bg-violet-400/10', iconBg: 'bg-violet-500/20', iconText: 'text-violet-400', hoverBorder: 'hover:border-violet-500/50' },
    indigo: { border: 'border-indigo-400', bg: 'bg-indigo-400/10', iconBg: 'bg-indigo-500/20', iconText: 'text-indigo-400', hoverBorder: 'hover:border-indigo-500/50' },
    lime: { border: 'border-lime-400', bg: 'bg-lime-400/10', iconBg: 'bg-lime-500/20', iconText: 'text-lime-400', hoverBorder: 'hover:border-lime-500/50' },
    gray: { border: 'border-gray-400', bg: 'bg-gray-400/10', iconBg: 'bg-gray-500/20', iconText: 'text-gray-400', hoverBorder: 'hover:border-gray-500/50' },
  };

  const currentTheme = themeStyles[theme] || themeStyles['cyan'];

  const processFile = async (file: File): Promise<FileData> => {
    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith('.csv');
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    const isJson = file.name.toLowerCase().endsWith('.json');

    let previewData: Partial<FileData> = { headers: [], previewRows: [] };
    
    try {
        if (isExcel) {
            previewData = await parseExcelPreview(file);
        } else if (isCsv) {
            previewData = await parseCsvPreview(file);
        } else if (isJson) {
            previewData = { headers: ['JSON File'], previewRows: [] };
        }
    } catch (e) {
        console.warn("Preview parsing failed for", file.name, e);
    }

    return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        headers: previewData.headers || [],
        previewRows: previewData.previewRows || [],
        sizeFormatted: previewData.sizeFormatted || '0 B'
    };
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const fileArray = Array.from(files);

    // 1. Raw Multiple Files Mode (No internal parsing)
    if (multiple && onFilesSelected) {
        onFilesSelected(fileArray);
        if (inputRef.current) inputRef.current.value = '';
        return;
    }

    // 2. Parsed Files Mode (Supports Multiple or Single)
    if (onFileLoaded) {
        // Enforce single file only if not in multiple mode
        if (!multiple && fileArray.length > 1) {
            setError("Only single file allowed in this mode.");
            return;
        }

        setLoading(true);
        try {
            // Process files sequentially
            for (const file of fileArray) {
                const data = await processFile(file);
                onFileLoaded(data);
            }
            if (inputRef.current) inputRef.current.value = '';
        } catch (e) {
            setError("Failed to parse one or more files.");
        } finally {
            setLoading(false);
        }
        return;
    }

    // Fallback: Just pass raw files if no onFileLoaded handler
    if (onFilesSelected) {
        onFilesSelected(fileArray);
        if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent flickering by checking if we are really leaving the container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${className || ''}`}>
      {label && <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>}
      
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          relative group cursor-pointer transition-all duration-300 ease-in-out
          border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center
          ${fileData 
            ? 'border-emerald-500/50 bg-emerald-500/5' 
            : isDragging 
              ? `${currentTheme.border} ${currentTheme.bg}` 
              : `border-gray-700 bg-gray-800/50 ${currentTheme.hoverBorder} hover:bg-gray-800`}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          multiple={multiple}
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />

        {loading ? (
          <div className="animate-pulse flex flex-col items-center">
             <div className={`h-8 w-8 border-4 border-t-transparent rounded-full animate-spin mb-3 ${currentTheme.border.replace('border-', 'border-t-').replace('border-', 'border-')}`}></div>
             <p className="text-gray-400 text-sm font-medium">{t('analyzing')}</p>
          </div>
        ) : fileData ? (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 text-emerald-400 shadow-lg shadow-emerald-900/20">
              <CheckCircle size={24} />
            </div>
            <p className="font-semibold text-gray-200 truncate max-w-[200px] text-sm">{fileData.file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{fileData.sizeFormatted}</p>
            {fileData.headers.length > 0 && (
                <div className="mt-3">
                    <span className="text-[10px] bg-gray-700/50 text-gray-300 px-2 py-1 rounded border border-gray-600/50">
                        {fileData.headers.length} Columns
                    </span>
                </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-4 w-full pointer-events-none">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors ${isDragging ? `${currentTheme.iconBg} ${currentTheme.iconText}` : 'bg-gray-700/50 text-gray-400 group-hover:text-gray-300'}`}>
              <Upload size={24} />
            </div>
            <p className="text-gray-300 font-medium text-sm sm:text-base">{t('upload_default')}</p>
            <p className="text-xs text-gray-500 mt-2 max-w-[200px] leading-relaxed">
              {limitText || t('upload_limit_info')}
            </p>
          </div>
        )}

        {error && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2 justify-center animate-in fade-in">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-[10px] font-medium text-red-300">{error}</span>
          </div>
        )}
      </div>

      {fileData && fileData.headers.length > 0 && (
        <div className="mt-2 bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
          <p className="text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wide">Headers Preview</p>
          <div className="flex flex-wrap gap-1.5">
            {fileData.headers.slice(0, 5).map((h, i) => (
              <span key={i} className="text-[10px] bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 truncate max-w-[80px]">
                {h}
              </span>
            ))}
            {fileData.headers.length > 5 && (
              <span className="text-[10px] text-gray-500 self-center">+{fileData.headers.length - 5} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
