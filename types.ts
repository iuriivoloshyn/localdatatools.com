
export interface FileData {
  id: string;
  file: File;
  headers: string[];
  previewRows: string[][];
  sizeFormatted: string;
  delimiter?: string;
}

export interface FileCompatibility {
  fileId: string;
  fileName: string;
  isCompatible: boolean;
  reason: string;
}

export interface AnalysisResult {
  canMerge: boolean;
  score: number; // 0 to 100 (overall confidence)
  results: FileCompatibility[];
}

export enum MergeStatus {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  READY = 'ready',
  MERGING = 'merging',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export type ToolType = 'merge' | 'diff' | 'ocr' | 'ai-csv-editor' | 'converter' | 'viewer' | 'anonymizer' | 'metadata' | 'chat' | 'compressor';

export type Language = 'en' | 'ru';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  imagePreviews?: string[];
  ocrResults?: string[];
  isError?: boolean;
}
