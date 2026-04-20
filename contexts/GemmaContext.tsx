import React, { createContext, useContext, useState, useRef } from 'react';
import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai';

const R2_DOMAIN = 'https://models.localdatatools.com';
const MODEL_FOLDER = 'gemma-4-E2B-it-web';
const MODEL_FILE = 'gemma-4-E2B-it-web.task';
const MODEL_URL = `${R2_DOMAIN}/${MODEL_FOLDER}/${MODEL_FILE}`;
const MODEL_BYTES_HINT = 2_003_697_664; // ~1.87 GiB; fallback if Content-Length missing
const CACHE_NAME = 'gemma-4-e2b-v1';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm';

// OpenAI-style message used by AiChatTool and AiCsvEditorTool
interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'model'; content: string; }
interface ChatCompletionParams { messages: ChatMessage[]; temperature?: number; max_tokens?: number; }
interface ChatCompletionResponse { choices: { message: { content: string } }[]; }

// Engine shim that mimics @mlc-ai/web-llm surface: engine.chat.completions.create({...})
interface EngineShim {
  chat: { completions: { create: (params: ChatCompletionParams) => Promise<ChatCompletionResponse> } };
  unload: () => Promise<void>;
  runtimeStatsText: () => string;
}

interface GemmaContextType {
  engine: EngineShim | null;
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

function messagesToGemmaPrompt(messages: ChatMessage[]): string {
  const systemParts = messages.filter(m => m.role === 'system').map(m => m.content).filter(Boolean);
  const turns = messages.filter(m => m.role !== 'system');

  let out = '';
  let firstUserSeen = false;
  for (const m of turns) {
    if (m.role === 'user') {
      let content = m.content;
      if (!firstUserSeen && systemParts.length > 0) {
        content = systemParts.join('\n\n') + '\n\n' + content;
        firstUserSeen = true;
      } else {
        firstUserSeen = true;
      }
      out += `<start_of_turn>user\n${content}<end_of_turn>\n`;
    } else {
      out += `<start_of_turn>model\n${m.content}<end_of_turn>\n`;
    }
  }
  out += '<start_of_turn>model\n';
  return out;
}

async function fetchModelBytes(
  onProgress: (downloadedBytes: number, totalBytes: number) => void,
): Promise<Uint8Array> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(MODEL_URL);
  if (cached) {
    const buf = await cached.arrayBuffer();
    onProgress(buf.byteLength, buf.byteLength);
    return new Uint8Array(buf);
  }

  const response = await fetch(MODEL_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Model fetch failed: HTTP ${response.status}`);
  }
  const totalBytes = Number(response.headers.get('content-length')) || MODEL_BYTES_HINT;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(received, totalBytes);
  }

  const full = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    full.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    await cache.put(MODEL_URL, new Response(full.slice(), { headers: { 'Content-Type': 'application/octet-stream' } }));
  } catch (e) {
    console.warn('Cache put failed (offline mode unavailable):', e);
  }
  return full;
}

export const GemmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [engine, setEngine] = useState<EngineShim | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const llmRef = useRef<LlmInference | null>(null);
  const lastTempRef = useRef<number>(0.7);
  const initializingRef = useRef(false);

  const getStats = () => {
    if (!llmRef.current) return 'Engine not active.';
    return 'MediaPipe LlmInference — Gemma 4 E2B (int4, WebGPU)';
  };

  const resetEngine = async () => {
    if (llmRef.current) {
      try { llmRef.current.close(); } catch (e) { console.warn('close failed', e); }
    }
    llmRef.current = null;
    setEngine(null);
    setIsModelLoaded(false);
    initializingRef.current = false;
    setIsLoading(false);
  };

  const buildEngineShim = (llm: LlmInference): EngineShim => ({
    chat: {
      completions: {
        create: async ({ messages, temperature }) => {
          if (temperature !== undefined && Math.abs(temperature - lastTempRef.current) > 0.01) {
            try {
              await llm.setOptions({ temperature });
              lastTempRef.current = temperature;
            } catch (e) {
              console.warn('setOptions(temperature) failed, continuing with previous value', e);
            }
          }
          const prompt = messagesToGemmaPrompt(messages);
          const text = await llm.generateResponse(prompt);
          return { choices: [{ message: { content: text } }] };
        },
      },
    },
    unload: async () => { try { llm.close(); } catch {} },
    runtimeStatsText: () => 'MediaPipe LlmInference (Gemma 4 E2B)',
  });

  const createEngineInternal = async (signalLoaded: boolean): Promise<void> => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    setIsLoading(true);
    setError(null);
    setProgress('Detecting WebGPU...');

    try {
      if (!(navigator as any).gpu) {
        throw new Error('WebGPU is not supported. Please use Chrome or Edge.');
      }

      setProgress('Loading runtime...');
      const wasmFileset = await FilesetResolver.forGenAiTasks(WASM_BASE);

      setProgress('Downloading Weights (0%)');
      const modelBytes = await fetchModelBytes((received, total) => {
        const fraction = total > 0 ? received / total : 0;
        setProgressVal(fraction * 0.85);
        setProgress(`Downloading Weights (${Math.round(fraction * 100)}%)`);
      });

      if (!signalLoaded) {
        setProgress('Cached for offline use');
        setProgressVal(1);
        return;
      }

      setProgress('Loading GPU Memory...');
      setProgressVal(0.9);

      const llm = await LlmInference.createFromModelBuffer(wasmFileset, modelBytes);
      lastTempRef.current = 0.7;

      llmRef.current = llm;
      setEngine(buildEngineShim(llm));
      setIsModelLoaded(true);
      setProgressVal(1);
      setProgress('Ready');
    } catch (err: any) {
      console.error('Gemma 4 Fatal Error', err);
      setError(err.message || 'Gemma initialization failed');
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
    if (isModelLoaded) return;
    await createEngineInternal(false);
  };

  return (
    <GemmaContext.Provider value={{ engine, isModelLoaded, isLoading, progress, progressVal, error, initGemma, downloadModelOnly, resetEngine, getStats }}>
      {children}
    </GemmaContext.Provider>
  );
};
