
import React, { createContext, useContext, useState, useRef } from 'react';
import { MLCEngine, CreateMLCEngine } from "@mlc-ai/web-llm";

// CONFIGURATION
const R2_FOLDER_NAME = 'gemma-2-2b-it-q4f16_1-MLC';
const R2_DOMAIN = 'https://models.localdatatools.com';

// Unique ID for cache management
const INTERNAL_MODEL_ID = 'Gemma-2-2b-Local-v4000'; 

interface GemmaContextType {
  engine: any;
  isModelLoaded: boolean;
  isLoading: boolean;
  progress: string;
  progressVal: number;
  error: string | null;
  initGemma: () => Promise<void>;
  downloadModelOnly: () => Promise<void>;
  resetEngine: () => Promise<void>;
  getStats: () => string;
}

const GemmaContext = createContext<GemmaContextType>({} as GemmaContextType);
export const useGemma = () => useContext(GemmaContext);

export const GemmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [engine, setEngine] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<any>(null);
  const initializingRef = useRef(false);
  
  const getStats = () => {
    if (!engineRef.current || !isModelLoaded) return "Engine not active.";
    try {
        return engineRef.current.runtimeStatsText();
    } catch(e) {
        return "Stats unavailable.";
    }
  };

  const resetEngine = async () => {
    if (engineRef.current) {
        try {
            await engineRef.current.unload();
        } catch (e) {
            console.warn("Unload failed", e);
        }
    }
    setEngine(null);
    engineRef.current = null;
    setIsModelLoaded(false);
    initializingRef.current = false;
    // Reset state but keep progress for UI feedback if needed
    setIsLoading(false);
  };

  const createEngineInternal = async (signalLoaded: boolean = true) => {
    if (initializingRef.current) return;
    
    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress('Detecting WebGPU...');

    try {
        if (!(navigator as any).gpu) {
            throw new Error("WebGPU is not supported. Please use Chrome or Edge.");
        }

        const modelBaseUrl = `${R2_DOMAIN}/${R2_FOLDER_NAME}/resolve/main/`;
        const wasmUrl = `${R2_DOMAIN}/${R2_FOLDER_NAME}/resolve/main/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm`;
        
        const initProgressCallback = (report: any) => {
            let unifiedProgress = 0;
            let userText = report.text;

            if (report.text.includes("Fetching")) {
                unifiedProgress = report.progress * 0.7;
                userText = `Downloading Weights (${Math.round(report.progress * 100)}%)`;
            } else if (report.text.includes("Loading")) {
                unifiedProgress = 0.7 + (report.progress * 0.3);
                userText = `Loading GPU Memory (${Math.round(report.progress * 100)}%)`;
            } else {
                unifiedProgress = report.progress;
            }

            setProgress(userText);
            setProgressVal(unifiedProgress);
        };

        let currentEngine;
        
        // Attempt 1: Try with Caching Enabled
        try {
            const appConfig = {
                model_list: [
                    {
                        "model_id": INTERNAL_MODEL_ID,
                        "model": modelBaseUrl, 
                        "model_lib": wasmUrl,
                        "vram_required_MB": 3200,
                        "low_resource_required": false,
                        "required_features": ["shader-f16"]
                    }
                ],
                useIndexedDBCache: true 
            };

            currentEngine = await CreateMLCEngine(
                INTERNAL_MODEL_ID,
                {
                    appConfig,
                    initProgressCallback
                }
            );
        } catch (initError: any) {
            console.warn("Initial load failed, retrying without cache...", initError);
            
            // Attempt 2: Disable Caching (Fixes "Failed to store... Load failed" errors)
            const appConfigNoCache = {
                model_list: [
                    {
                        "model_id": INTERNAL_MODEL_ID,
                        "model": modelBaseUrl, 
                        "model_lib": wasmUrl,
                        "vram_required_MB": 3200,
                        "low_resource_required": false,
                        "required_features": ["shader-f16"]
                    }
                ],
                useIndexedDBCache: false 
            };

            currentEngine = await CreateMLCEngine(
                INTERNAL_MODEL_ID,
                {
                    appConfig: appConfigNoCache,
                    initProgressCallback
                }
            );
        }
        
        if (signalLoaded) {
            engineRef.current = currentEngine;
            setEngine(currentEngine);
            setIsModelLoaded(true);
        } else {
            // IMPORTANT: Add delay before unloading to ensure all IndexedDB cache writes 
            // (params_shard_*.bin) are finalized. Premature unload closes DB connection 
            // causing InvalidStateError on pending writes.
            await new Promise(resolve => setTimeout(resolve, 2000));

            // If just downloading, unload immediately to free VRAM
            await currentEngine.unload();
        }

    } catch (err: any) {
         console.error("Gemma Fatal Error", err);
         setError(err.message || "Gemma initialization failed");
         setIsModelLoaded(false);
         throw err;
    } finally {
        initializingRef.current = false;
        setIsLoading(false);
    }
  };

  const initGemma = async () => {
      if (isModelLoaded) return;
      await createEngineInternal(true);
  };

  const downloadModelOnly = async () => {
      if (isModelLoaded) return; // Already have it
      await createEngineInternal(false);
  };

  return (
    <GemmaContext.Provider value={{ engine, isModelLoaded, isLoading, progress, progressVal, error, initGemma, downloadModelOnly, resetEngine, getStats }}>
      {children}
    </GemmaContext.Provider>
  );
};
