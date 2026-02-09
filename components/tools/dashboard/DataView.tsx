
import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface DataViewProps {
    file: File;
    headers: string[];
    rows: string[][];
    onNext: () => void;
}

const DataView: React.FC<DataViewProps> = ({ file, headers, rows, onNext }) => {
    const [visibleRows, setVisibleRows] = useState(100);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 200) {
            if (visibleRows < rows.length) {
                setVisibleRows(prev => Math.min(prev + 100, rows.length));
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] animate-in fade-in duration-500">
            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar relative" onScroll={handleScroll}>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#111827] sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-r border-gray-800 w-12 text-center bg-[#111827]">#</th>
                            {headers.map((h, i) => (
                                <th key={i} className="px-4 py-3 text-[10px] font-black text-gray-300 uppercase tracking-widest border-b border-r border-gray-800 whitespace-nowrap bg-[#111827]">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {rows.slice(0, visibleRows).map((row, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-4 py-2 text-[10px] font-mono text-gray-600 border-r border-gray-800/50 text-center bg-[#0d0d0d] sticky left-0">{i + 1}</td>
                                {headers.map((h, j) => (
                                    <td key={j} className="px-4 py-2 text-xs text-gray-400 border-r border-gray-800/50 truncate max-w-[300px]">
                                        {row[j]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {visibleRows < rows.length && (
                    <div className="py-4 text-center text-xs text-gray-600 italic">
                        Showing {visibleRows} of {rows.length.toLocaleString()} rows...
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataView;
