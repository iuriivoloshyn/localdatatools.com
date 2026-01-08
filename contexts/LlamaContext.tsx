import React, { createContext, useContext, useState, useRef } from 'react';
import { MLCEngine, CreateMLCEngine } from "@mlc-ai/web-llm";

// CONFIGURATION - Points to the root folder. 
// Library expects files inside: {R2_DOMAIN}/{R2_FOLDER_NAME}/resolve/main/
const R2_FOLDER_NAME = 'gemma-2-2b-it-q4f16_1-MLC';
const R2_DOMAIN = 'https://models.localdatatools.com';

// Unique ID for cache management
const INTERNAL_MODEL_ID = 'Gemma-2-2b-Local-v1'; 

interface LlamaContextType {
  engine: any;
  isModelLoaded: boolean;
  isLoading: boolean;
  progress: string;
  progressVal: number;
  error: string | null;
  initLlama: () => Promise<void>;
  resetEngine: () => Promise<void>;
  getStats: () => string;
}

const LlamaContext = createContext<LlamaContextType>({} as LlamaContextType);
export const useLlama = () => useContext(LlamaContext);

export const LlamaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
            console.warn("Unload failed, forcing state reset", e);
        }
    }
    setEngine(null);
    engineRef.current = null;
    setIsModelLoaded(false);
    initializingRef.current = false;
    await initLlama();
  };

  const initLlama = async () => {
    if (initializingRef.current || isModelLoaded) return;
    
    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress('Detecting WebGPU...');

    try {
        if (!(navigator as any).gpu) {
            throw new Error("WebGPU is not supported on this browser/device. Please use Chrome or Edge.");
        }

        // The 'model' URL is the base. The library appends 'resolve/main/' itself.
        const modelBaseUrl = `${R2_DOMAIN}/${R2_FOLDER_NAME}/`;
        const wasmUrl = `${R2_DOMAIN}/${R2_FOLDER_NAME}/resolve/main/gemma-2-2b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm`;
        
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

        const currentEngine = await CreateMLCEngine(
            INTERNAL_MODEL_ID,
            {
                appConfig,
                initProgressCallback: (report) => {
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
                }
            }
        );
        
        engineRef.current = currentEngine;
        setEngine(currentEngine);
        setIsModelLoaded(true);

    } catch (err: any) {
         console.error("Gemma Init Error:", err);
         let msg = err.message || "Initialization failed";
         if (msg.includes("shader-f16")) {
             msg = "Hardware Error: Your GPU does not support 'shader-f16'.";
         }
         setError(msg);
         setIsModelLoaded(false);
    } finally {
        initializingRef.current = false;
        setIsLoading(false);
    }
  };

  return (
    <LlamaContext.Provider value={{ engine, isModelLoaded, isLoading, progress, progressVal, error, initLlama, resetEngine, getStats }}>
      {children}
    </LlamaContext.Provider>
  );
};