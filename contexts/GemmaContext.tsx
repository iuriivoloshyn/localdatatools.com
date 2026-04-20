import React, { createContext, useContext, useState, useRef } from 'react';
import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai';

const R2_DOMAIN = 'https://models.localdatatools.com';
const MODEL_FOLDER = 'gemma-4-E2B-it-web';
const MODEL_FILE = 'gemma-4-E2B-it-web.task';
const MODEL_URL = `${R2_DOMAIN}/${MODEL_FOLDER}/${MODEL_FILE}`;
const MODEL_BYTES_HINT = 2_003_697_664; // ~1.87 GiB; fallback if Content-Length missing
const CACHE_NAME = 'gemma-4-e2b-v1';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@0.10.27/wasm';

// OpenAI-style message used by AiChatTool / AiCsvEditorTool / OCRTool
type ImageInput = Blob | File | HTMLImageElement | ImageBitmap | HTMLCanvasElement | string;
type MessageContentPart = { type: 'text'; text: string } | { type: 'image'; image: ImageInput };
type MessageContent = string | MessageContentPart[];
interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'model'; content: MessageContent; }
interface ChatCompletionParams {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  onPartial?: (cleanedPartial: string) => void;
}
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

function cleanGemmaOutput(raw: string): string {
  // MediaPipe doesn't auto-stop at chat-template tokens. The community
  // LiteRT conversion also emits mangled variants (`<1end_of_turn>`,
  // `<starts_of_turn>`, `<エンド_of_turn>`). Find any `of_turn`-ish or
  // Japanese-variant marker, then cut from the nearest preceding '<'.
  let end = raw.length;
  const markers: RegExp[] = [
    /of[_\s]?turn/i,
    /エンド/,
    /<\s*(bos|eos|pad|unk)\s*>/i,
    /<\|\s*end\s*\|>/i,
  ];
  for (const m of markers) {
    const idx = raw.search(m);
    if (idx === -1) continue;
    const lt = raw.lastIndexOf('<', idx);
    const cut = lt !== -1 && idx - lt < 40 ? lt : idx;
    if (cut < end) end = cut;
  }
  return raw.slice(0, end).trim();
}

// Coerce supported image inputs into MediaPipe-compatible sources (ImageBitmap or string URL)
async function toImageSource(img: ImageInput): Promise<any> {
  if (typeof img === 'string') return img;
  if (img instanceof Blob) return await createImageBitmap(img);
  return img; // HTMLImageElement, HTMLCanvasElement, ImageBitmap — already accepted
}

function contentToText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n');
}

// Returns a MediaPipe Prompt: array interleaving strings and { imageSource } objects
async function messagesToGemmaPrompt(messages: ChatMessage[]): Promise<any[]> {
  const systemText = messages
    .filter(m => m.role === 'system')
    .map(m => contentToText(m.content))
    .filter(Boolean)
    .join('\n\n');
  const turns = messages.filter(m => m.role !== 'system');

  const parts: any[] = [];
  let firstUserSeen = false;
  for (const m of turns) {
    if (m.role === 'user') {
      parts.push(firstUserSeen || !systemText
        ? '<start_of_turn>user\n'
        : `<start_of_turn>user\n${systemText}\n\n`);
      firstUserSeen = true;

      if (typeof m.content === 'string') {
        parts.push(m.content);
      } else {
        for (const p of m.content) {
          if (p.type === 'text') parts.push(p.text);
          else parts.push({ imageSource: await toImageSource(p.image) });
        }
      }
      parts.push('<end_of_turn>\n');
    } else {
      parts.push(`<start_of_turn>model\n${contentToText(m.content)}<end_of_turn>\n`);
    }
  }
  parts.push('<start_of_turn>model\n');
  return parts;
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
  // Preallocate so we don't briefly hold 2× memory during concatenation.
  const full = new Uint8Array(totalBytes);
  const reader = response.body.getReader();
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.byteLength > full.length) {
      throw new Error('Model response exceeded Content-Length');
    }
    full.set(value, offset);
    offset += value.byteLength;
    onProgress(offset, totalBytes);
  }
  const received = offset === full.length ? full : full.subarray(0, offset);

  try {
    await cache.put(MODEL_URL, new Response(received, { headers: { 'Content-Type': 'application/octet-stream' } }));
  } catch (e) {
    console.warn('Cache put failed (offline mode unavailable):', e);
  }
  return received as Uint8Array;
}

export const GemmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [engine, setEngine] = useState<EngineShim | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressVal, setProgressVal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const llmRef = useRef<LlmInference | null>(null);
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

  // Per-call temperature cannot be changed safely: MediaPipe's setOptions()
  // requires baseOptions.modelAssetBuffer to be re-supplied each time, which
  // we no longer hold (WASM owns it). Temperature is baked in at init.
  const buildEngineShim = (llm: LlmInference): EngineShim => ({
    chat: {
      completions: {
        create: async ({ messages, onPartial }) => {
          const prompt = await messagesToGemmaPrompt(messages);
          let accumulated = '';
          const raw = await llm.generateResponse(prompt, (partial: string, _done: boolean) => {
            accumulated += partial;
            if (onPartial) {
              // Stream the cleaned running total so the caller can render it live
              try { onPartial(cleanGemmaOutput(accumulated)); } catch {}
            }
          });
          const cleaned = cleanGemmaOutput(raw);
          return { choices: [{ message: { content: cleaned } }] };
        },
      },
    },
    unload: async () => { try { llm.close(); } catch {} },
    runtimeStatsText: () => 'MediaPipe LlmInference (Gemma 4 E2B, vision)',
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

      // Vision (maxNumImages > 0) disabled pending upstream MediaPipe fix:
      // https://github.com/google-ai-edge/mediapipe/issues/6270 — crashes
      // with "memory access out of bounds" ~43-63s into GPU graph build
      // on Chrome/macOS, more reliably when vision tokens are reserved.
      // Re-enable once the issue is resolved.
      const llm = await LlmInference.createFromOptions(wasmFileset, {
        baseOptions: { modelAssetBuffer: modelBytes },
        maxTokens: 4096,
        temperature: 0.7,
        topK: 40,
      });

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
