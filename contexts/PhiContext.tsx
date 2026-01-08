import React, { createContext, useContext, useState, useRef } from 'react';
import { MLCEngine, CreateMLCEngine } from "@mlc-ai/web-llm";

const R2_FOLDER_NAME = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
const R2_DOMAIN = 'https://models.localdatatools.com';

/**
 * INTERNAL_MODEL_ID bumped to v18000.
 * v18000: Extreme error sanitization for WebGPU events.
 */
const INTERNAL_MODEL_ID = 'Phi-3.5-Vision-Local-v18000';

interface PhiContextType {
  engine: any;
  isModelLoaded: boolean;
  isLoading: boolean;
  progress: string;
  progressVal: number;
  error: string | null;
  initPhi: () => Promise<void>;
  resetPhi: () => Promise<void>;
}

const PhiContext = createContext<PhiContextType>({} as PhiContextType);
export const usePhi = () => useContext(PhiContext);

export const PhiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [engine, setEngine] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<any>(null);
  const initializingRef = useRef(false);

  const sanitizeTvmError = (err: any): string => {
    // 1. Unwrap common wrapper objects (e.g. GPUUncapturedErrorEvent)
    let actualErr = err;
    if (typeof err === 'object' && err !== null) {
        if (err.error) {
            actualErr = err.error;
        } else if (err.message && typeof err.message === 'string') {
            actualErr = err.message;
        }
    }

    // 2. Convert to string safely
    let msg = "";
    try {
        if (typeof actualErr === 'string') {
            msg = actualErr;
        } else if (actualErr instanceof Error) {
            msg = actualErr.message;
        } else {
            msg = JSON.stringify(actualErr, Object.getOwnPropertyNames(actualErr));
            if (msg === '{}' || msg === '[]') msg = String(actualErr);
        }
    } catch (e) {
        msg = String(actualErr);
    }

    // 3. Handle unhelpful string conversions
    if (msg === '[object Object]' || msg === '{}') {
        // Try to reconstruct from original if strict conversion failed
        if (err && err.constructor && err.constructor.name) {
            msg = `${err.constructor.name} (Details unavailable)`;
        } else {
            msg = "Unknown WebGPU Error Object";
        }
    }

    // 4. Handle empty messages
    if (!msg || msg.trim() === '') {
        msg = "Initialization failed with an empty error signal. This often indicates a GPU driver crash or strict browser security block.";
    }

    // 5. User-friendly mapping for common WebLLM/WebGPU issues
    const lower = msg.toLowerCase();
    
    if (lower.includes("shader-f16")) {
        return "Your GPU driver does not support 16-bit floating point shaders (shader-f16). Please update your drivers or try a different device.";
    }
    if (lower.includes("out of memory") || lower.includes("buffer")) {
        return "System ran out of GPU Memory (VRAM). Try closing other tabs or using a device with more dedicated GPU memory.";
    }
    if (lower.includes("validating shadermodule") || lower.includes("shader validation")) {
        return "Shader Validation Failed: Your GPU drivers rejected the compiled AI shaders. Update drivers or restart browser.";
    }
    if (lower.includes("device lost")) {
        return "GPU Device Lost: The operating system reset the graphics driver. This usually happens when the model is too heavy for the GPU.";
    }
    if (lower.includes("uncaptured")) {
        return `WebGPU Uncaptured Error: ${msg}`;
    }

    return msg;
  };

  const resetPhi = async () => {
      if (engineRef.current) {
          try { await engineRef.current.unload(); } catch (e) { console.warn("Unload error", e); }
      }
      setEngine(null);
      engineRef.current = null;
      setIsModelLoaded(false);
      initializingRef.current = false;
      setError(null);
      setProgress('');
  };

  const initPhi = async () => {
    if (initializingRef.current || isModelLoaded) return;
    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress('Checking GPU Capabilities...');

    try {
        const nav = navigator as any;
        if (!nav.gpu) throw new Error("WebGPU is not supported on this browser.");
        
        const adapter = await nav.gpu.requestAdapter();
        if (!adapter) throw new Error("No GPU adapter found.");
        
        // STRICT CHECK: The q4f16 model REQUIRES shader-f16. 
        if (!adapter.features.has("shader-f16")) {
             throw new Error("Your GPU does not support 'shader-f16', which is required for this model. Please try a different device or browser.");
        }

        const modelBaseUrl = `${R2_DOMAIN}/${R2_FOLDER_NAME}/resolve/main/`;
        const wasmUrl = `${R2_DOMAIN}/${R2_FOLDER_NAME}/resolve/main/Phi-3.5-vision-instruct-q4f16_1-ctx4k_cs2k-webgpu.wasm`;

        // Create engine with low resource requirement
        const appConfig = {
            model_list: [
                {
                    "model_id": INTERNAL_MODEL_ID,
                    "model": modelBaseUrl, 
                    "model_lib": wasmUrl, 
                    "vram_required_MB": 3000, 
                    "low_resource_required": true,
                    "required_features": ["shader-f16"]
                }
            ],
            useIndexedDBCache: true,
            logger: (level: string, message: string) => {
                if (level === 'error') {
                    // Prevent [object Object] logging
                    let safeMsg = message;
                    if (typeof message === 'object') {
                        try { safeMsg = JSON.stringify(message); } catch {}
                    }
                    console.error("WebLLM Internal:", safeMsg);
                }
            }
        };

        const currentEngine = await CreateMLCEngine(
            INTERNAL_MODEL_ID,
            {
                appConfig,
                initProgressCallback: (report) => {
                    let unifiedProgress = 0;
                    let userText = report.text;
                    if (report.text.includes("Fetching")) {
                        unifiedProgress = report.progress * 0.8;
                        userText = `Downloading Weights (${Math.round(report.progress * 100)}%)`;
                    } else if (report.text.includes("Loading")) {
                        unifiedProgress = 0.8 + (report.progress * 0.2);
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
         console.error("Phi Critical Error Raw:", err);
         const readableError = sanitizeTvmError(err);
         setError(readableError);
         setIsModelLoaded(false);
         // Force cleanup
         if (engineRef.current) { 
            try { await engineRef.current.unload(); } catch(e) {} 
            engineRef.current = null; 
            setEngine(null);
         }
    } finally {
        initializingRef.current = false;
        setIsLoading(false);
    }
  };

  return (
    <PhiContext.Provider value={{ engine, isModelLoaded, isLoading, progress, progressVal, error, initPhi, resetPhi }}>
      {children}
    </PhiContext.Provider>
  );
};