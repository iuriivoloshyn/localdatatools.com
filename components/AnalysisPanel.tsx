
import React from 'react';
import { AnalysisResult } from '../types';
import { Check, X, AlertTriangle, FileText, CheckCircle2, XCircle } from 'lucide-react';

interface AnalysisPanelProps {
  analysis: AnalysisResult;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis }) => {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`
        rounded-xl p-6 border backdrop-blur-sm
        ${analysis.canMerge 
          ? 'bg-emerald-500/5 border-emerald-500/20' 
          : 'bg-amber-500/5 border-amber-500/20'}
      `}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${analysis.canMerge ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}
            `}>
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Compatibility Report</h3>
              <p className="text-sm text-gray-400">
                {analysis.canMerge 
                  ? "All files match the primary schema." 
                  : "Some files have conflicting headers."}
              </p>
            </div>
          </div>
          <div className="text-right">
             {analysis.canMerge ? (
                 <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle2 size={16} />
                    <span className="text-sm font-bold">Ready to Merge</span>
                 </div>
             ) : (
                <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-bold">Conflicts Found</span>
                 </div>
             )}
          </div>
        </div>

        {/* Detailed File List */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
            <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
                <span>File Name</span>
                <span>Status</span>
            </div>
            <div className="divide-y divide-gray-800">
                {analysis.results.map((res) => (
                    <div key={res.fileId} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-300 truncate max-w-[200px] md:max-w-md" title={res.fileName}>
                            {res.fileName}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className={`text-xs ${res.isCompatible ? 'text-gray-500' : 'text-red-400'}`}>
                                {res.reason}
                            </span>
                            {res.isCompatible ? (
                                <Check size={18} className="text-emerald-500" />
                            ) : (
                                <X size={18} className="text-red-500" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {!analysis.canMerge && (
            <div className="mt-4 flex items-start gap-2 text-amber-400/80 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs">
                    <strong>Merge Blocked:</strong> Direct appending requires identical headers for all files to ensure data integrity. Please remove incompatible files or fix their headers.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
