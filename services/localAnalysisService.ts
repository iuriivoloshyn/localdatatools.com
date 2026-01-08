
import { AnalysisResult, FileData } from "../types";

export const analyzeBatch = async (
  primary: FileData, 
  queue: FileData[]
): Promise<AnalysisResult> => {
  
  const primaryJson = JSON.stringify(primary.headers);
  const results = [];
  let allCompatible = true;

  // Simulate a short processing time for UI smoothness (scaled by queue size)
  await new Promise(resolve => setTimeout(resolve, 300 + (queue.length * 100)));

  for (const file of queue) {
    const fileJson = JSON.stringify(file.headers);
    const isMatch = primaryJson === fileJson;

    let reason = "Compatible";
    if (!isMatch) {
        allCompatible = false;
        if (primary.headers.length !== file.headers.length) {
            reason = `Column count mismatch (${file.headers.length} vs ${primary.headers.length})`;
        } else {
            reason = "Header name or order mismatch";
        }
    }

    results.push({
        fileId: file.id,
        fileName: file.file.name,
        isCompatible: isMatch,
        reason
    });
  }

  return {
    canMerge: allCompatible,
    score: allCompatible ? 100 : 0, // Simplified score for batch
    results
  };
};
