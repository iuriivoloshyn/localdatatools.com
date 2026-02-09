
import React, { useState, useEffect, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import ToolHeader from '../layout/ToolHeader';
import { 
  MessageSquareText, Send, Image as ImageIcon, Loader2, User, 
  Bot, Trash2, Settings, SlidersHorizontal, Info, X, 
  Paperclip, Sparkles, Zap, Cpu, Download, Upload
} from 'lucide-react';
import { useLanguage } from '../../App';
import { useGemma } from '../../contexts/GemmaContext';
import { ChatMessage } from '../../types';

const AiChatTool: React.FC = () => {
  const { t, lang } = useLanguage();
  const { 
    engine, 
    isModelLoaded, 
    isLoading: isModelLoading, 
    progress: modelProgress, 
    progressVal: modelProgressVal, 
    error: modelError, 
    initGemma
  } = useGemma();

  // Local Chat History State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOcrActive, setIsOcrActive] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Model Config
  const [systemInstruction, setSystemInstruction] = useState("You use context from previous messages and images provided via local OCR to help the user.");
  const [temperature, setTemperature] = useState(0.7);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingImages, isSending]);

  const addChatMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleReset = () => {
    setMessages([]);
    setPendingImages([]);
    setInput('');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      const newPreviews = files.map(f => ({
        file: f,
        preview: URL.createObjectURL(f)
      }));
      setPendingImages(prev => [...prev, ...newPreviews]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      const files: File[] = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) {
        const newPreviews = files.map(f => ({
          file: f,
          preview: URL.createObjectURL(f)
        }));
        setPendingImages(prev => [...prev, ...newPreviews]);
      }
    }
  };

  const processOcr = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    setIsOcrActive(true);
    const results: string[] = [];
    const tessLang = lang === 'ru' ? 'rus' : 'eng';
    
    try {
      const worker = await createWorker(tessLang, 1, {
        workerPath: 'https://models.localdatatools.com/tesseract/worker.min.js',
        corePath: 'https://models.localdatatools.com/tesseract/tesseract-core.wasm.js',
        langPath: 'https://models.localdatatools.com/tesseract/',
        gzip: true,
      });

      for (const file of files) {
        const ret = await worker.recognize(file);
        results.push(ret.data.text);
      }
      await worker.terminate();
    } catch (e) {
      console.error("OCR Error", e);
    } finally {
      setIsOcrActive(false);
    }
    return results;
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || isSending || !isModelLoaded || !engine) return;

    const userText = input.trim();
    const currentImages = [...pendingImages];
    setPendingImages([]);
    setInput('');

    // 1. Add User Message to Context
    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      imagePreviews: currentImages.map(img => img.preview),
    };
    addChatMessage(userMessage);

    setIsSending(true);

    try {
      // 2. Perform OCR on any images
      const ocrResults = await processOcr(currentImages.map(img => img.file));
      
      // 3. Construct message for Gemma
      let finalPrompt = userText;
      if (ocrResults.length > 0) {
        const ocrCombined = ocrResults.map((text, i) => `[Image ${i+1} OCR Text: ${text}]`).join('\n\n');
        finalPrompt = `${ocrCombined}\n\nUser Message: ${userText || "Please analyze the extracted text above."}`;
      }

      // 4. Construct Full History for Context
      const apiMessages = [
        { role: "system", content: systemInstruction },
        ...messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.ocrResults ? 
                `${m.ocrResults.map((t, i) => `[Image ${i+1} Context]: ${t}`).join('\n')}\n${m.content}` 
                : m.content
        })),
        { role: "user", content: finalPrompt }
      ];

      // 5. Send to Gemma
      const completion = await engine.chat.completions.create({
        messages: apiMessages,
        temperature: temperature,
        max_tokens: 1024, 
      });

      const responseText = completion.choices[0].message.content;

      // 6. Add AI Message to Context
      const aiMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'model',
        content: responseText || '',
        timestamp: Date.now(),
        ocrResults: ocrResults.length > 0 ? ocrResults : undefined
      };
      addChatMessage(aiMessage);

    } catch (e: any) {
      addChatMessage({
        id: Math.random().toString(36).substr(2, 9),
        role: 'model',
        content: `Error: ${e.message || "Failed to get response from Gemma"}`,
        timestamp: Date.now(),
        isError: true
      });
    } finally {
      setIsSending(false);
    }
  };

  // --- MARKDOWN RENDERING START ---
  const renderItalic = (text: string, prefix: number) => {
      // Matches *italic* but tries to avoid matching * bullet or * alone
      const parts = text.split(/(\*(?!\s).*?[^\s]\*)/g);
      return parts.map((part, idx) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
              return <em key={`${prefix}-i-${idx}`} className="italic opacity-90">{part.slice(1, -1)}</em>;
          }
          return part;
      });
  };

  const renderInlineStyles = (text: string, prefix: number) => {
      // Matches **bold**
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
              return <strong key={`${prefix}-b-${idx}`} className="font-bold">{part.slice(2, -2)}</strong>;
          }
          // Recursively handle italics inside non-bold segments
          return <span key={`${prefix}-span-${idx}`}>{renderItalic(part, idx)}</span>;
      });
  };

  const renderMessageContent = (text: string, isUser: boolean) => {
    if (!text) return null;
    const lines = text.split('\n');
    
    return (
      <div className="space-y-1">
        {lines.map((line, i) => {
            const trimmed = line.trim();
            
            // Handle Bullet Points (* or -)
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                return (
                    <div key={i} className="flex gap-2 ml-1 items-start">
                        <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${isUser ? 'bg-white' : 'bg-rose-400'}`}></span>
                        <span className="leading-relaxed flex-1">{renderInlineStyles(trimmed.substring(2), i)}</span>
                    </div>
                );
            }

            // Handle Headers
            if (trimmed.startsWith('### ')) return <h3 key={i} className="text-base font-bold mt-3 mb-1">{renderInlineStyles(trimmed.substring(4), i)}</h3>;
            if (trimmed.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{renderInlineStyles(trimmed.substring(3), i)}</h2>;
            if (trimmed.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-5 mb-3">{renderInlineStyles(trimmed.substring(2), i)}</h1>;

            // Empty Line
            if (!trimmed) return <div key={i} className="h-2"></div>;

            // Regular Line
            return <div key={i} className="leading-relaxed min-h-[1.2em]">{renderInlineStyles(line, i)}</div>;
        })}
      </div>
    );
  };
  // --- MARKDOWN RENDERING END ---

  return (
    <div className={!isModelLoaded 
        ? "space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500" 
        : "flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-2 duration-500"
    }>
      <div className={!isModelLoaded ? "" : "shrink-0 mb-4"}>
        <ToolHeader 
          title="AI Chat"
          description="Talk with Gemma 2 (Local). Integrated Tesseract OCR extracts text from images for discussion context."
          instructions={[
            "Click the paperclip or Drag & Drop images for local OCR analysis",
            "History is purely in-memory (resets on reload)",
            "System Instructions allow you to steer the AI's persona",
            "Runs entirely in your browser using WebGPU"
          ]}
          icon={MessageSquareText}
          colorClass="text-rose-400"
          onReset={handleReset}
        />
      </div>

      {!isModelLoaded ? (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4">
            <div className="bg-gray-900 border border-rose-500/20 p-12 rounded-3xl text-center shadow-2xl animate-in fade-in zoom-in-95 max-w-2xl mx-auto">
                <Cpu size={48} className="mx-auto mb-6 text-rose-400" />
                <h2 className="text-2xl font-bold text-white mb-3">Load Local AI Engine</h2>
                <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">Gemma 2 runs entirely in your browser using WebGPU. No data leaves your device.</p>
                {!isModelLoading ? (
                <button onClick={initGemma} className="bg-gradient-to-br from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center gap-3 mx-auto active:scale-95"><Download size={20}/> Load Gemma 2B</button>
                ) : (
                <div className="space-y-4 max-w-md mx-auto">
                    <div className="flex justify-between text-xs font-black text-rose-400 uppercase tracking-widest"><span>{modelProgress}</span><span>{Math.round(modelProgressVal * 100)}%</span></div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${modelProgressVal * 100}%` }} /></div>
                </div>
                )}
                {modelError && <div className="mt-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl text-left text-red-400 text-xs font-mono leading-relaxed">{modelError}</div>}
            </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0 relative">
            {/* Chat Area */}
            <div 
                className={`flex-1 flex flex-col bg-gray-900/40 border border-white/5 rounded-3xl overflow-hidden relative shadow-2xl transition-all duration-300 ${isDraggingOver ? 'ring-2 ring-rose-500 bg-rose-900/10' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDraggingOver && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-sm animate-in fade-in">
                        <Upload size={48} className="text-rose-400 mb-4 animate-bounce" />
                        <h3 className="text-xl font-bold text-white">Drop Images to Scan</h3>
                    </div>
                )}

                {/* Scrollable Messages */}
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"
                >
                    {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-30">
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
                        <Bot size={32} className="text-rose-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Gemma is Ready</h3>
                        <p className="text-sm text-gray-400 max-w-xs">Ask questions, paste text, or drop images for OCR analysis.</p>
                    </div>
                    ) : (
                    messages.map(msg => (
                        <div 
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-1`}
                        >
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gray-800 border border-white/10'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-rose-400" />}
                            </div>
                            <div className="space-y-2">
                            <div className={`rounded-2xl px-4 py-3 text-sm ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white shadow-lg rounded-tr-none' 
                                : msg.isError 
                                    ? 'bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-none' 
                                    : 'bg-gray-800 border border-white/5 text-gray-200 shadow-md rounded-tl-none'
                            }`}>
                                {msg.imagePreviews && msg.imagePreviews.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {msg.imagePreviews.map((url, i) => (
                                    <img key={i} src={url} className="h-24 w-auto rounded-lg border border-white/10" />
                                    ))}
                                </div>
                                )}
                                {renderMessageContent(msg.content, msg.role === 'user')}
                            </div>
                            <div className={`text-[10px] text-gray-600 font-medium ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            </div>
                        </div>
                        </div>
                    ))
                    )}
                    
                    {isSending && (
                    <div className="flex justify-start animate-in fade-in">
                        <div className="flex gap-3 max-w-[85%]">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-rose-400" />
                        </div>
                        <div className="bg-gray-800/50 border border-white/5 rounded-2xl px-5 py-3 rounded-tl-none">
                            <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-0"></span>
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-300"></span>
                            </div>
                            {isOcrActive && <span className="text-[10px] text-gray-500 font-bold uppercase mt-2 block tracking-widest">Running OCR...</span>}
                        </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="shrink-0 p-4 border-t border-white/5 bg-gray-950/20">
                    {pendingImages.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-900/50 rounded-xl border border-white/5">
                        {pendingImages.map((img, i) => (
                        <div key={i} className="relative group">
                            <img src={img.preview} className="h-16 w-16 object-cover rounded-lg ring-1 ring-white/10" />
                            <button 
                            onClick={() => removePendingImage(i)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                            <X size={12} />
                            </button>
                        </div>
                        ))}
                    </div>
                    )}

                    <div className="flex items-end gap-3 max-w-5xl mx-auto">
                    <div className="flex gap-1 mb-1">
                        <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-500 hover:text-rose-400 transition-colors bg-gray-800 rounded-2xl border border-white/5"
                        title="Attach Images"
                        >
                        <Paperclip size={20} />
                        </button>
                        <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept="image/*"
                        onChange={handleImageSelect}
                        />
                        <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-3 transition-colors bg-gray-800 rounded-2xl border border-white/5 ${showSettings ? 'text-rose-400' : 'text-gray-500 hover:text-white'}`}
                        >
                        <Settings size={20} />
                        </button>
                    </div>

                    <div className="flex-1 relative">
                        <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                            }
                        }}
                        placeholder="Ask Gemma anything..."
                        className="w-full bg-gray-900 border border-white/10 rounded-2xl px-5 py-3 pr-12 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 outline-none resize-none custom-scrollbar min-h-[48px] max-h-32"
                        rows={1}
                        />
                        <button 
                        onClick={handleSend}
                        disabled={isSending || (!input.trim() && pendingImages.length === 0)}
                        className="absolute right-2 bottom-2 p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-20 disabled:grayscale"
                        >
                        <Send size={18} fill="currentColor" />
                        </button>
                    </div>
                    </div>
                </div>
            </div>

            {/* Config Sidebar */}
            {showSettings && (
            <div className="w-80 flex flex-col bg-gray-900/60 border border-white/10 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-rose-400" />
                    Chat Config
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                </div>

                <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={12} className="text-rose-400" /> System Instruction
                    </label>
                    <textarea 
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    placeholder="Set AI persona..."
                    className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-gray-300 focus:border-rose-500/30 outline-none resize-none"
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={12} className="text-rose-400" /> Temperature
                    </label>
                    <span className="text-[10px] font-mono text-rose-400 font-bold">{temperature.toFixed(1)}</span>
                    </div>
                    <input 
                    type="range" 
                    min="0" 
                    max="1.5" 
                    step="0.1" 
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-rose-500"
                    />
                    <p className="text-[9px] text-gray-600 italic">Lower is factual, higher is creative.</p>
                </div>

                <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 mb-1">
                    <Info size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Privacy Info</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                    Images are processed using <span className="text-rose-300 font-bold">Tesseract.js</span> locally.
                    </p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                    Gemma 2 runs in-browser via WebGPU.
                    </p>
                </div>
                </div>
                
                <button 
                onClick={handleReset}
                className="mt-6 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center justify-center gap-2"
                >
                <Trash2 size={14} /> Reset Session
                </button>
            </div>
            )}
        </div>
      )}
    </div>
  );
};

export default AiChatTool;
