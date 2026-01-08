
import React, { useState, useEffect, useRef, Suspense, createContext, useContext } from 'react';
import { ToolType, Language } from './types';
import { Layers, Zap, ScanText, ChevronDown, Loader2, Snowflake, X, Maximize, Minimize, RotateCcw, BookOpen, Settings as SettingsIcon, RefreshCw, Eye, VenetianMask, BrainCircuit, Shield, HardDrive, Cpu, Lock, Database, Wrench, ArrowRight, Lightbulb, Fingerprint, MessageSquareText, MessageCircle, ExternalLink, Minimize2, GitCompare, Wifi, WifiOff, Download, CheckCircle2, Info, LayoutDashboard } from 'lucide-react';
import Snowfall, { SnowfallLayerConfig } from './components/effects/Snowfall';
import SantaFace from './components/effects/SantaFace';
import { GemmaProvider, useGemma } from './contexts/GemmaContext';

// --- LAZY LOAD TOOLS TO PREVENT CIRCULAR DEPENDENCY ---
const MergeTool = React.lazy(() => import('./components/tools/MergeTool'));
const DiffTool = React.lazy(() => import('./components/tools/DiffTool'));
const OCRTool = React.lazy(() => import('./components/tools/OCRTool'));
const ConverterTool = React.lazy(() => import('./components/tools/ConverterTool'));
const ViewerTool = React.lazy(() => import('./components/tools/ViewerTool'));
const AnonymizerTool = React.lazy(() => import('./components/tools/AnonymizerTool'));
const AiCsvEditorTool = React.lazy(() => import('./components/tools/AiCsvEditorTool'));
const MetadataTool = React.lazy(() => import('./components/tools/MetadataTool'));
const AiChatTool = React.lazy(() => import('./components/tools/AiChatTool'));
const CompressorTool = React.lazy(() => import('./components/tools/CompressorTool'));
const InstantDashboardTool = React.lazy(() => import('./components/tools/InstantDashboardTool'));

// Expanded Context
const AppContext = createContext<{ 
  lang: Language; 
  setLang: (l: Language) => void; 
  t: (key: string) => string;
  isProMode: boolean;
}>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  isProMode: true,
});

export const useLanguage = () => useContext(AppContext);

const DICTIONARY: Record<Language, Record<string, string>> = {
  en: {
    'local_badge': 'LOCAL PROCESSING & AI',
    'hero_title': 'Local Data Tools',
    'hero_desc': 'A secure, offline-first toolkit for data professionals. Merge CSVs, extract text from images, or use AI to clean data-all running 100% in your browser.',
    'snow_settings': 'Atmosphere',
    'atmosphere': 'Atmosphere',
    'winter_theme': 'Particle Effects',
    'snow_speed': 'Speed',
    'density': 'Density',
    'zen_mode_btn': 'Zen Mode',
    'zen_mode_title': 'Zen Focus',
    'zen_hint': 'Controls hide after 3s. Move cursor to reveal.',
    'utilities': 'Toolkit',
    'reset_defaults': 'Reset to Defaults',
    'sub_merge': 'Join or Append CSVs',
    'sub_diff': 'Compare Datasets',
    'sub_ocr': 'AI Image Parsing',
    'sub_converter': 'Universal Format Tool',
    'sub_viewer': 'Preview Data Files',
    'sub_anonymizer': 'Sanitize Sensitive Data',
    'sub_ai_editor': 'Natural Language Modification',
    'sub_metadata': 'Analyze & Hash Scramble',
    'sub_ai_chat': 'Local AI Conversation with OCR',
    'sub_compressor': 'Smart Archive & Optimization',
    'sub_dashboard': 'Instant BI Visualization',
    'processing': 'Processing...',
    'analyzing': 'Analyzing...',
    'settings': 'Settings',
    'upload_default': 'Click or drag file here',
    'upload_limit_info': 'Large files supported. Local processing.',
    'pro_mode': 'Pro',
    'learner_mode': 'Guide',
    'interface': 'Interface',
    'language': 'Language',
    'system_settings': 'System Settings',
    'drop_to_add': 'Drop files to add',
    'select_file_view': 'Select a file to view',
    'upload_formats': 'Supported formats: PNG, JPG, WEBP',
    'clear_all': 'Clear All',
    'flake_sizes': 'Flake sizes',
    'small': 'Small',
    'medium': 'Medium',
    'large': 'Large',
    'open_workspace': 'Open Workspace',
    'access_tools': 'Access Local Tools',
    'offline_mode': 'Offline Mode',
    'offline_desc': 'Download AI models & assets for air-gapped use.',
    'offline_desc_ready': 'Models downloaded. Network locked. Reload to reconnect.',
    'downloading': 'Downloading Assets...',
    'offline_ready': 'Offline Ready',
    'caching_app': 'Caching App Components...',
    // Merge Tool Translations
    'column_join': 'Column Join',
    'row_append': 'Row Append',
    'left_table': 'Left Table',
    'right_table': 'Right Table',
    'join_key': 'Join Key',
    'primary_source': 'Primary Source',
    'additional_datasets': 'Additional Datasets',
    'queue': 'Queue',
    'reset': 'Reset',
    'analyze_all': 'Analyze All',
    'merge_tables': 'Merge Tables',
    'commit_append': 'Merge Files',
    'schema_mismatch': 'Schema Mismatch',
    'analysis_complete': 'Merge Complete',
    'download_csv': 'Download CSV',
    'clear': 'Clear',
    'configuration': 'Configuration',
    'strategy': 'Strategy',
    'options': 'Options',
    'case_sensitive': 'Case Sensitive',
    'output_fields': 'Output Fields',
    // Feature Request
    'feature_req_title': 'Feedback & Requests',
    'feature_req_desc': 'Have an idea to improve a tool? Found a bug? Or need a custom workflow to fit your specific needs?',
    'feature_req_cta': 'Join our community channel to report issues and help us build the tools you need.',
    'join_telegram': 'Join Telegram Channel',
    'join_reddit': 'Join Reddit Community'
  },
  ru: {
    'local_badge': 'ЛОКАЛЬНАЯ ОБРАБОТКА & ИИ',
    'hero_title': 'Local Data Tools',
    'hero_desc': 'Безопасный набор инструментов для работы с данными. Объединяйте CSV, извлекайте текст из изображений или используйте ИИ для очистки — всё работает на 100% в вашем браузере.',
    'snow_settings': 'Атмосфера',
    'atmosphere': 'Атмосфера',
    'winter_theme': 'Эффекты частиц',
    'snow_speed': 'Скорость',
    'density': 'Плотность',
    'zen_mode_btn': 'Дзен режим',
    'zen_mode_title': 'Дзен Фокус',
    'zen_hint': 'Элементы скрываются через 3с.',
    'utilities': 'Инструменты',
    'reset_defaults': 'Сброс настроек',
    'sub_merge': 'Объединение CSV',
    'sub_diff': 'Сравнение таблиц',
    'sub_ocr': 'ИИ парсинг изображений',
    'sub_converter': 'Универсальный конвертер',
    'sub_viewer': 'Просмотр файлов',
    'sub_anonymizer': 'Очистка данных',
    'sub_ai_editor': 'ИИ Редактор CSV',
    'sub_metadata': 'Анализ и Хеш',
    'sub_ai_chat': 'Локальный ИИ чат с OCR',
    'sub_compressor': 'Архивация и Оптимизация',
    'sub_dashboard': 'Мгновенная BI Визуализация',
    'processing': 'Обработка...',
    'analyzing': 'Анализ...',
    'settings': 'Настройки',
    'upload_default': 'Нажмите или перетащите файл',
    'upload_limit_info': 'Поддержка больших файлов. Локально.',
    'pro_mode': 'Pro',
    'learner_mode': 'Guide',
    'interface': 'Интерфейс',
    'language': 'Язык',
    'system_settings': 'Настройки системы',
    'drop_to_add': 'Отпустите файлы',
    'select_file_view': 'Выберите файл для просмотра',
    'upload_formats': 'Форматы: PNG, JPG, WEBP',
    'clear_all': 'Очистить',
    'flake_sizes': 'Размер частиц',
    'small': 'Мал',
    'medium': 'Сред',
    'large': 'Бол',
    'open_workspace': 'Открыть Рабочую Среду',
    'access_tools': 'Доступ к Инструментам',
    'offline_mode': 'Офлайн Режим',
    'offline_desc': 'Скачать ИИ модели и ресурсы для работы без сети.',
    'offline_desc_ready': 'Ресурсы загружены. Сеть отключена. Перезагрузите для выхода.',
    'downloading': 'Загрузка ресурсов...',
    'offline_ready': 'Офлайн Готов',
    'caching_app': 'Кеширование приложения...',
    // Merge Tool Translations
    'column_join': 'Объединение Колонок',
    'row_append': 'Добавление Строк',
    'left_table': 'Левая Таблица',
    'right_table': 'Правая Таблица',
    'join_key': 'Ключ Объединения',
    'primary_source': 'Основной Файл',
    'additional_datasets': 'Доп. Наборы Данных',
    'queue': 'Очередь',
    'reset': 'Сброс',
    'analyze_all': 'Анализировать Все',
    'merge_tables': 'Объединить',
    'commit_append': 'Объединить Файлы',
    'schema_mismatch': 'Несовпадение Схемы',
    'analysis_complete': 'Готово',
    'download_csv': 'Скачать CSV',
    'clear': 'Очистить',
    'configuration': 'Конфигурация',
    'strategy': 'Стратегия',
    'options': 'Опции',
    'case_sensitive': 'Чувствительность к регистру',
    'output_fields': 'Поля Вывода',
    // Feature Request
    'feature_req_title': 'Запросы и Ошибки',
    'feature_req_desc': 'Есть идеи по улучшению? Нашли ошибку? Или нужен инструмент под специфические задачи?',
    'feature_req_cta': 'Присоединяйтесь к нашему сообществу, чтобы сообщать о проблемах и предлагать новые функции.',
    'join_telegram': 'Открыть Telegram',
    'join_reddit': 'Открыть Reddit'
  }
};

interface ToolConfig {
  id: ToolType | 'dashboard'; // Add dashboard type manually here or in types
  label: string;
  subKey: string;
  icon: any;
  color: string;
  gradient: string;
  description: string;
}

const TOOLS_LIST: ToolConfig[] = [
  { id: 'dashboard', label: 'Dashboard', subKey: 'sub_dashboard', icon: LayoutDashboard, color: 'text-violet-400', gradient: 'from-violet-500/20 to-purple-600/20', description: 'Auto-generate BI dashboards from CSV files with interactive charts.' },
  { id: 'merge', label: 'CSV Fusion', subKey: 'sub_merge', icon: Layers, color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-blue-600/20', description: 'Merge or append massive CSV files entirely in-browser.' },
  { id: 'diff', label: 'CSV Diff', subKey: 'sub_diff', icon: GitCompare, color: 'text-orange-400', gradient: 'from-orange-500/20 to-red-600/20', description: 'Compare two CSV files to spot added, removed, or modified rows instantly.' },
  { id: 'ai-csv-editor', label: 'Smart CSV Editor', subKey: 'sub_ai_editor', icon: BrainCircuit, color: 'text-fuchsia-400', gradient: 'from-fuchsia-500/20 to-purple-600/20', description: 'Use Natural Language to clean and transform datasets.' },
  { id: 'ocr', label: 'Image to Text', subKey: 'sub_ocr', icon: ScanText, color: 'text-blue-400', gradient: 'from-blue-500/20 to-indigo-600/20', description: 'Extract text from screenshots using local Tesseract or Cloud AI.' },
  { id: 'converter', label: 'Converter', subKey: 'sub_converter', icon: RefreshCw, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-teal-600/20', description: 'Switch between CSV, XLSX, PDF, and Images instantly.' },
  { id: 'viewer', label: 'File Viewer', subKey: 'sub_viewer', icon: Eye, color: 'text-lime-400', gradient: 'from-lime-500/20 to-green-600/20', description: 'Securely preview spreadsheets and documents locally.' },
  { id: 'anonymizer', label: 'Anonymizer', subKey: 'sub_anonymizer', icon: VenetianMask, color: 'text-zinc-400', gradient: 'from-zinc-500/20 to-slate-600/20', description: 'Scrub sensitive data with reversible key generation.' },
  { id: 'metadata', label: 'Metadata & Hash', subKey: 'sub_metadata', icon: Fingerprint, color: 'text-amber-400', gradient: 'from-amber-500/20 to-orange-600/20', description: 'View invisible metadata and scramble file hashes.' },
  { id: 'compressor', label: 'Compressor', subKey: 'sub_compressor', icon: Minimize2, color: 'text-violet-400', gradient: 'from-violet-500/20 to-purple-600/20', description: 'Smart archive creation and media optimization.' },
  { id: 'chat', label: 'AI Chat', subKey: 'sub_ai_chat', icon: MessageSquareText, color: 'text-rose-400', gradient: 'from-rose-500/20 to-pink-600/20', description: 'Interactive chat with persistent context and OCR image parsing.' },
];

interface SidebarButtonProps {
  config: ToolConfig;
  isActive: boolean;
  isProMode: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ config, isActive, isProMode, onClick, t }) => {
  const Icon = config.icon;
  
  return (
    <button 
        onClick={onClick}
        className={`w-full relative flex items-center gap-3 px-3 ${isProMode ? 'py-3' : 'py-2.5'} rounded-xl text-left transition-all duration-200 group outline-none
            ${isActive 
            ? `bg-gray-800/80 shadow-md ring-1 ring-white/5` 
            : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300'}
        `}
    >
        {isActive && (
           <div className={`absolute inset-0 rounded-xl opacity-10 ${config.color.replace('text-', 'bg-')}`} />
        )}

        <div className={`shrink-0 transition-colors duration-200 ${isActive ? config.color : 'text-gray-600 group-hover:text-gray-400'}`}>
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className="flex flex-col min-w-0 flex-1 relative z-10">
            <span className={`text-sm font-medium tracking-tight truncate ${isActive ? config.color : 'text-gray-400 group-hover:text-gray-200'}`}>
                {config.label}
            </span>
            {!isProMode && (
              <span className="text-[10px] text-gray-600 truncate mt-0.5">
                {t(config.subKey)}
              </span>
            )}
        </div>
        {isActive && <div className={`w-1 h-4 rounded-full ${config.color.replace('text-', 'bg-')}`}></div>}
    </button>
  );
};

// Main App Component Content (Separated for context usage)
const AppContent: React.FC = () => {
  const { lang, setLang, t, isProMode } = useLanguage();
  const { downloadModelOnly, progressVal: modelProgress, isLoading: modelLoading } = useGemma();
  
  const [activeTool, setActiveTool] = useState<ToolType | 'dashboard' | null>(null);
  const [visitedTools, setVisitedTools] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeatureRequestOpen, setIsFeatureRequestOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [snowSpeed, setSnowSpeed] = useState(1.0);
  const [snowDensity, setSnowDensity] = useState(50);
  const [snowLayers, setSnowLayers] = useState<SnowfallLayerConfig>({ background: true, midground: true, foreground: false });
  const [isSnowEnabled, setIsSnowEnabled] = useState(true);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isZenControlsVisible, setIsZenControlsVisible] = useState(true);
  const [isProModeInternal, setIsProMode] = useState(true); // Internal state for switch visualization, sync with context in real app
  
  // Offline State
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState(0);
  const [offlineStatusText, setOfflineStatusText] = useState("");

  const mainContentRef = useRef<HTMLElement>(null);
  const zenControlsTimeoutRef = useRef<number>(0);

  // ... (Theme variables remain same)
  const theme = isOfflineReady ? {
    // Stealth / Offline Mode (Red/Rose - Tactical Night Vision)
    logoGradient: "from-red-900 to-red-950",
    logoShadow: "shadow-red-900/20",
    logoHoverShadow: "group-hover:shadow-red-500/40",
    textAccent: "text-red-500",
    textAccentHover: "group-hover:text-red-400",
    heroGlow: "rgba(239, 68, 68, 0.05)", // red-500 glow
    buttonGradient: "from-red-800 to-red-900",
    buttonShadow: "shadow-red-900/50 group-hover:shadow-red-500/50",
    buttonBorder: "hover:border-red-500/40",
    buttonGlow: "hover:shadow-[0_0_60px_-15px_rgba(239,68,68,0.3)]",
    creatorAccent: "text-red-500",
    creatorBorder: "hover:border-red-500/30",
    creatorShadow: "hover:shadow-[0_0_20px_-5px_rgba(239,68,68,0.2)]",
    creatorDot: "bg-red-500/40"
  } : {
    // Default Mode (Indigo/Violet)
    logoGradient: "from-indigo-500 to-violet-600",
    logoShadow: "shadow-lg",
    logoHoverShadow: "group-hover:shadow-indigo-500/40",
    textAccent: "text-indigo-400",
    textAccentHover: "group-hover:text-indigo-300",
    heroGlow: "rgba(99, 102, 241, 0.05)",
    buttonGradient: "from-indigo-600 to-violet-600",
    buttonShadow: "shadow-indigo-900/50 group-hover:shadow-indigo-500/50",
    buttonBorder: "hover:border-indigo-500/40",
    buttonGlow: "hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.3)]",
    creatorAccent: "text-indigo-500",
    creatorBorder: "hover:border-indigo-500/30",
    creatorShadow: "hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]",
    creatorDot: "bg-indigo-500/40"
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ... (Offline progress effect, Zen Mode, Offline Toggle remain same)
  useEffect(() => {
    if (isDownloadingOffline && modelLoading) {
      setOfflineProgress(15 + (modelProgress * 0.8 * 100)); 
    }
  }, [modelProgress, isDownloadingOffline, modelLoading]);

  const toggleZenMode = async (enable: boolean) => {
    if (enable) {
        setIsZenMode(true);
        setIsSettingsOpen(false);
        try { 
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen(); 
            }
        } catch (e) {}
    } else {
        try { 
            if (document.fullscreenElement && document.exitFullscreen) {
                await document.exitFullscreen(); 
            }
        } catch (e) {}
        setIsZenMode(false);
    }
  };

  const resetAtmosphere = () => {
    setSnowSpeed(1.0);
    setSnowDensity(50);
    setSnowLayers({ background: true, midground: true, foreground: false });
    setIsSnowEnabled(true);
  };

  const handleOfflineToggle = async (enabled: boolean) => {
    if (enabled) {
      setIsDownloadingOffline(true);
      setOfflineStatusText("Initializing...");
      setOfflineProgress(2);
      
      try {
        setOfflineStatusText(t('caching_app'));
        const toolImports = [
            import('./components/tools/MergeTool'),
            import('./components/tools/DiffTool'),
            import('./components/tools/OCRTool'),
            import('./components/tools/ConverterTool'),
            import('./components/tools/ViewerTool'),
            import('./components/tools/AnonymizerTool'),
            import('./components/tools/AiCsvEditorTool'),
            import('./components/tools/MetadataTool'),
            import('./components/tools/AiChatTool'),
            import('./components/tools/CompressorTool'),
            import('./components/tools/InstantDashboardTool')
        ];
        
        await Promise.all(toolImports);
        setOfflineProgress(10);

        setOfflineStatusText("Downloading OCR Engine...");
        const tesseractFiles = [
          'https://models.localdatatools.com/tesseract/worker.min.js',
          'https://models.localdatatools.com/tesseract/tesseract-core.wasm.js',
          'https://models.localdatatools.com/tesseract/eng.traineddata.gzip',
          'https://models.localdatatools.com/tesseract/rus.traineddata.gzip'
        ];
        
        await Promise.all(tesseractFiles.map(async (url) => {
          try { await fetch(url, { cache: 'force-cache' }); } catch(e) { console.warn("Cache fetch failed", e)}
        }));
        
        setOfflineProgress(15);

        setOfflineStatusText("Downloading AI Model...");
        await downloadModelOnly();
        
        setIsOfflineReady(true);
      } catch (e) {
        console.error("Offline download failed", e);
      } finally {
        setIsDownloadingOffline(false);
        setOfflineProgress(100);
      }
    } else {
      if (window.confirm("To re-enable network connections and go back online, the page must be reloaded. Reload now?")) {
          window.location.reload();
      }
    }
  };

  const getToggleColor = () => {
      if (isDownloadingOffline) return 'bg-amber-500';
      if (isOfflineReady) return 'bg-red-600'; 
      return 'bg-gray-800';
  };

  // ... (Zen mode effects remain same)
  useEffect(() => {
    if (!isZenMode) { setIsZenControlsVisible(true); return; }
    const showControls = () => {
        setIsZenControlsVisible(true);
        if (zenControlsTimeoutRef.current) clearTimeout(zenControlsTimeoutRef.current);
        zenControlsTimeoutRef.current = window.setTimeout(() => setIsZenControlsVisible(false), 3000);
    };
    showControls();
    window.addEventListener('mousemove', showControls);
    window.addEventListener('mousedown', showControls);
    window.addEventListener('keydown', showControls);
    return () => {
        window.removeEventListener('mousemove', showControls);
        window.removeEventListener('mousedown', showControls);
        window.removeEventListener('keydown', showControls);
        if (zenControlsTimeoutRef.current) clearTimeout(zenControlsTimeoutRef.current);
    };
  }, [isZenMode]);

  useEffect(() => {
    if (isZenMode) { document.body.style.overflow = 'hidden'; } 
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [isZenMode]);

  const handleToolClick = (tool: ToolType | 'dashboard' | null) => {
    if (tool === activeTool) return;
    if (tool) {
        setVisitedTools(prev => new Set(prev).add(tool));
    }
    setActiveTool(tool);
  };

  const transitionClass = isTransitioning ? 'view-transition-exit' : 'view-transition-enter';

  const ToolLoader = () => (
    <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  return (
        <div className="bg-[#0d0d0d] text-gray-200 font-sans selection:bg-indigo-500/30 relative flex flex-col w-full min-h-screen md:h-screen md:overflow-hidden">
          {isSnowEnabled && <Snowfall speedMultiplier={snowSpeed} density={snowDensity} layers={snowLayers} />}
          
          {/* ... (Feature Request Modal and Zen Mode Modal remain same) ... */}
          {/* Re-inserted Feature Modal and Zen Modal logic from original App.tsx to ensure completeness */}
          {isFeatureRequestOpen && (
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsFeatureRequestOpen(false)}>
                <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setIsFeatureRequestOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full">
                        <X size={20} />
                    </button>
                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 text-indigo-400 border border-indigo-500/20 shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)]">
                            <Lightbulb size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">{t('feature_req_title')}</h2>
                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            {t('feature_req_desc')}
                            <br/><br/>
                            <span className="text-gray-300 font-medium">{t('feature_req_cta')}</span>
                        </p>
                        <div className="flex flex-col gap-3 w-full">
                            <a href="https://t.me/localdatatoolsfr" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/30 rounded-xl transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-500/20 transition-colors"><MessageCircle size={20} /></div>
                                    <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{t('join_telegram')}</span>
                                </div>
                                <ArrowRight size={16} className="text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                            </a>
                             <a href="https://www.reddit.com/r/LocalDataTools/" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/30 rounded-xl transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400 group-hover:text-orange-300 group-hover:bg-orange-500/20 transition-colors"><MessageSquareText size={20} /></div>
                                    <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{t('join_reddit')}</span>
                                </div>
                                <ArrowRight size={16} className="text-gray-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {isZenMode && (
            <div className="fixed inset-0 z-[5000] bg-[#0d0d0d] flex items-end justify-center pb-12 animate-in fade-in duration-1000 overflow-hidden">
                <div className={`bg-black/60 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-6 w-full max-w-md mx-4 hover:bg-black/80 transition-all duration-500 ease-in-out group ${isZenControlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3"><Snowflake className="text-cyan-400" size={24} /><h2 className="text-xl font-light text-white tracking-wide">{t('zen_mode_title')}</h2></div>
                        <div className="flex items-center gap-2">
                           <button onClick={resetAtmosphere} className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded-full transition-colors" title="Reset Atmosphere"><RotateCcw size={16} /></button>
                           <div className="w-px h-4 bg-white/10 mx-1"></div>
                           <button onClick={() => toggleZenMode(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors" title="Exit Zen Mode"><Minimize size={20} /></button>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-gray-400"><span>{t('snow_speed')}</span><span className="text-cyan-400">{snowSpeed.toFixed(1)}x</span></div>
                            <input type="range" min="0.1" max="3.0" step="0.1" value={snowSpeed} onChange={(e) => setSnowSpeed(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-gray-400"><span>{t('density')}</span><span className="text-cyan-400">{snowDensity}</span></div>
                            <input type="range" min="0" max="500" step="10" value={snowDensity} onChange={(e) => setSnowDensity(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                        </div>
                        <div className="space-y-2">
                           <span className="text-xs font-medium text-gray-400">{t('flake_sizes')}</span>
                           <div className="flex gap-2">
                              <button onClick={() => setSnowLayers(p => ({...p, background: !p.background}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${snowLayers.background ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{t('small')}</button>
                              <button onClick={() => setSnowLayers(p => ({...p, midground: !p.midground}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${snowLayers.midground ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{t('medium')}</button>
                              <button onClick={() => setSnowLayers(p => ({...p, foreground: !p.foreground}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${snowLayers.foreground ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{t('large')}</button>
                           </div>
                        </div>
                    </div>
                    <div className="text-center pt-2 border-t border-white/5"><p className="text-[10px] text-gray-500 font-medium">{t('zen_hint')}</p></div>
                </div>
            </div>
          )}

          <nav className="border-b border-white/[0.04] bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-50 shrink-0">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 relative">
              <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => handleToolClick(null)}>
                <div className={`relative bg-gradient-to-br w-8 h-8 rounded-lg ${theme.logoShadow} flex items-center justify-center text-white overflow-hidden transition-all duration-500 ${theme.logoGradient} ${theme.logoHoverShadow}`}>
                    <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-full group-hover:opacity-0 group-hover:rotate-12"><Database size={18} /></div>
                    <div className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] translate-y-full opacity-0 rotate-12 group-hover:translate-y-0 group-hover:opacity-100 group-hover:rotate-0"><Wrench size={18} /></div>
                </div>
                <div className="flex flex-col justify-center h-8">
                    <span className="text-lg font-bold text-gray-100 tracking-tight leading-none group-hover:text-white transition-colors flex items-center">
                        <span>LocalData</span><span className={`${theme.textAccent} ${theme.textAccentHover} transition-colors`}>Tools</span>
                    </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="relative h-9 w-9" ref={settingsRef}>
                    <button onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }} className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all shadow-sm p-0 bg-gray-900 border-white/[0.06] ${isSettingsOpen ? 'bg-gray-800 border-gray-700 text-white' : 'text-gray-400 hover:text-white hover:border-gray-600'}`}><SettingsIcon size={16} strokeWidth={2} /></button>
                    {isSettingsOpen && (
                      <div className="absolute right-0 top-full mt-2 w-72 bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 slide-in-from-top-2 overflow-hidden ring-1 ring-white/10">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{t('system_settings')}</h3><button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X size={14} /></button></div>
                        <div className="p-5 space-y-6">
                           <div className="space-y-3">
                              <span className="text-xs font-medium text-gray-400">{t('interface')}</span>
                              <div className="grid grid-cols-2 gap-2 bg-gray-900/50 p-1 rounded-xl border border-white/5">
                                 <button onClick={() => setIsProMode(true)} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isProModeInternal ? 'bg-gray-800 text-indigo-400 shadow-sm ring-1 ring-white/5' : 'text-gray-500 hover:text-gray-300'}`}><Zap size={14} fill={isProModeInternal ? "currentColor" : "none"} /> {t('pro_mode')}</button>
                                 <button onClick={() => setIsProMode(false)} className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${!isProModeInternal ? 'bg-gray-800 text-emerald-400 shadow-sm ring-1 ring-white/5' : 'text-gray-500 hover:text-gray-300'}`}><BookOpen size={14} /> {t('learner_mode')}</button>
                              </div>
                           </div>
                           <div className="h-px bg-white/5"></div>
                           <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2 text-rose-400">
                                    <div className="flex items-center gap-1.5">{isOfflineReady ? <WifiOff size={14} className="text-red-500" /> : <Wifi size={14} />}<span className={`text-sm font-bold ${isOfflineReady ? 'text-red-500' : 'text-gray-200'}`}>{t('offline_mode')}</span></div>
                                    <div className="group relative"><Info size={12} className="text-gray-500 cursor-help" /><div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-black border border-white/10 rounded-xl text-[10px] text-gray-300 leading-relaxed shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[200]">Downloads all AI models and assets to local storage. Creates a secure, air-gapped environment for maximum privacy—ensuring no data ever leaves your browser.</div></div>
                                 </div>
                                 <button onClick={() => handleOfflineToggle(!isOfflineReady)} disabled={isDownloadingOffline} className={`w-10 h-5 rounded-full relative transition-colors duration-300 focus:outline-none ${getToggleColor()}`}><div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${isOfflineReady || isDownloadingOffline ? 'translate-x-5' : 'translate-x-0'}`} /></button>
                              </div>
                              {(isDownloadingOffline || isOfflineReady) && (
                                <div className="bg-gray-900/50 p-3 rounded-xl border border-white/5 space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest"><span className={isOfflineReady ? "text-red-500" : "text-amber-400"}>{isOfflineReady ? t('offline_ready') : (offlineStatusText || t('downloading'))}</span>{isDownloadingOffline && <span>{Math.round(offlineProgress)}%</span>}</div>
                                    {isDownloadingOffline ? (<div className="h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${offlineProgress}%` }}></div></div>) : (<p className="text-[10px] text-gray-500 leading-relaxed">{t('offline_desc_ready')}</p>)}
                                </div>
                              )}
                           </div>
                           <div className="h-px bg-white/5"></div>
                           <div className="space-y-4">
                              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-cyan-400"><Snowflake size={14} /><span className="text-sm font-bold text-gray-200">{t('atmosphere')}</span></div><div className="flex items-center gap-3"><button onClick={resetAtmosphere} className="text-gray-500 hover:text-cyan-400 transition-colors" title="Reset"><RotateCcw size={14} /></button><button onClick={() => setIsSnowEnabled(!isSnowEnabled)} className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isSnowEnabled ? 'bg-cyan-500' : 'bg-gray-800'}`}><div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${isSnowEnabled ? 'translate-x-5' : 'translate-x-0'}`} /></button></div></div>
                              <div className={`space-y-4 transition-all duration-300 ${isSnowEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                 <div className="space-y-2"><div className="flex justify-between text-xs font-medium"><span className="text-gray-500">{t('snow_speed')}</span><span className="text-cyan-400">{snowSpeed.toFixed(1)}x</span></div><input type="range" min="0.1" max="3.0" step="0.1" value={snowSpeed} onChange={(e) => setSnowSpeed(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500" /></div>
                                 <div className="space-y-2"><div className="flex justify-between text-xs font-medium"><span className="text-gray-500">{t('density')}</span><span className="text-cyan-400">{snowDensity}</span></div><input type="range" min="0" max="500" step="10" value={snowDensity} onChange={(e) => setSnowDensity(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-500" /></div>
                                 <div className="space-y-2"><span className="text-xs font-medium text-gray-500">{t('flake_sizes')}</span><div className="flex gap-2"><button onClick={() => setSnowLayers(p => ({...p, background: !p.background}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${snowLayers.background ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{t('small')}</button><button onClick={() => setSnowLayers(p => ({...p, midground: !p.midground}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${snowLayers.midground ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{t('medium')}</button><button onClick={() => setSnowLayers(p => ({...p, foreground: !p.foreground}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${snowLayers.foreground ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{t('large')}</button></div></div>
                              </div>
                           </div>
                           <button onClick={() => toggleZenMode(true)} className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${isZenMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-900 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-300'}`}><Maximize size={14} /> {t('zen_mode_btn')}</button>
                        </div>
                      </div>
                    )}
                  </div>
              </div>
            </div>
          </nav>

          {!activeTool ? (
              <div key="landing" className={`relative w-full flex-1 overflow-hidden flex flex-col items-center justify-center ${transitionClass}`}>
                   <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
                       <div className="w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${theme.heroGlow} 0%, rgba(0,0,0,0) 70%)`, filter: 'blur(100px)', transform: 'translate3d(0,0,0)' }} />
                   </div>
                   <div className="relative z-10 text-center w-full max-w-4xl px-6 flex flex-col items-center gap-12 md:gap-16">
                       <div className="flex flex-col items-center">
                           <h1 className="text-5xl md:text-8xl font-black mb-6 flex items-center justify-center gap-1 md:gap-3 flex-wrap tracking-tight py-2">
                              <span className="flex items-center whitespace-nowrap"><span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 to-zinc-300">L</span><div className="relative inline-flex items-center justify-center align-middle h-[0.8em]" style={{ width: '0.6em' }}>{isSnowEnabled ? (<div className="absolute inset-0 flex items-center justify-center scale-90 translate-y-[6px]"><SantaFace /></div>) : (<span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 to-zinc-300">o</span>)}</div><span className="text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 to-zinc-300">cal</span></span><span className="whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 to-zinc-300">Data</span><span className="whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 to-zinc-300">Tools</span>
                           </h1>
                           <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">{t('hero_desc')}</p>
                       </div>
                       <button onClick={() => handleToolClick('merge')} className={`group relative flex items-center gap-5 px-10 py-5 bg-gray-900/50 hover:bg-gray-800/80 border border-white/10 rounded-full transition-all duration-500 hover:scale-105 backdrop-blur-md ${theme.buttonBorder} ${theme.buttonGlow}`}>
                            <div className="flex flex-col items-start"><span className="text-sm font-bold text-gray-100 group-hover:text-white uppercase tracking-widest transition-colors">{t('open_workspace')}</span><span className={`text-[10px] text-gray-500 font-mono transition-colors ${theme.textAccentHover}`}>{t('access_tools')}</span></div>
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center transition-all shadow-lg group-hover:rotate-45 ${theme.buttonGradient} ${theme.buttonShadow}`}><ArrowRight size={22} className="text-white" /></div>
                       </button>
                       <div className="flex flex-wrap justify-center gap-3 opacity-50 hover:opacity-100 transition-opacity duration-500">
                            {TOOLS_LIST.map(tool => {
                                const Icon = tool.icon;
                                return (<div key={tool.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-[10px] font-medium select-none cursor-default hover:bg-white/10 hover:text-gray-200 transition-all hover:border-white/10"><Icon size={12} /><span className="tracking-wide">{tool.label}</span></div>)
                            })}
                       </div>
                   </div>
              </div>
          ) : (
            <div key="dashboard" className={`flex flex-col md:flex-row max-w-[1920px] mx-auto w-full flex-1 md:overflow-hidden ${transitionClass}`}>
                <aside className="w-full md:w-[240px] py-4 px-3 md:border-r border-white/[0.04] bg-[#0d0d0d] md:overflow-y-auto shrink-0 z-10 relative flex flex-col">
                  <div className="px-3 mb-3 flex items-center justify-between group">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('utilities')}</span>
                      <button onClick={() => setIsFeatureRequestOpen(true)} className="text-gray-600 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-white/5" title="Request Features"><Lightbulb size={12} /></button>
                  </div>
                  <nav className="space-y-1">
                     {TOOLS_LIST.map(tool => (
                       <React.Fragment key={tool.id}>
                         {tool.id === 'chat' && <div className="my-2 mx-3 border-t border-white/[0.06]"></div>}
                         {tool.id === 'merge' && <div className="my-2 mx-3 border-t border-white/[0.06]"></div>}
                         <SidebarButton config={tool} isActive={activeTool === tool.id} isProMode={isProModeInternal} onClick={() => handleToolClick(tool.id)} t={t} />
                       </React.Fragment>
                     ))}
                  </nav>
                  <div className="mt-auto pt-8 pb-6 px-3">
                    <div className="flex flex-col items-center gap-0 group opacity-80 hover:opacity-100 transition-all duration-300">
                        <span className="text-[5.5px] font-bold text-gray-500 uppercase tracking-[0.25em] text-center mb-0.5">Created by</span>
                        <a href="https://ivlabs.xyz" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-px font-mono text-sm bg-gray-900 border border-white/[0.06] px-4 py-2 rounded-xl transition-all ${theme.creatorBorder} ${theme.creatorShadow}`}><span className="text-gray-300 font-bold group-hover:text-white transition-colors">ivlabs</span><span className={`${theme.creatorAccent} font-bold`}>.xyz</span><span className={`w-1.5 h-3 rounded-[1px] ml-[1px] ${theme.creatorDot}`}></span></a>
                    </div>
                  </div>
                </aside>
                <main className="flex-1 px-4 py-6 md:p-8 md:overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar scroll-smooth bg-[#0d0d0d]" ref={mainContentRef}>
                  <div className="max-w-7xl mx-auto h-full">
                      <Suspense fallback={<ToolLoader />}>
                          {visitedTools.has('merge') && <div className={activeTool === 'merge' ? 'block h-full' : 'hidden h-full'}><MergeTool /></div>}
                          {visitedTools.has('diff') && <div className={activeTool === 'diff' ? 'block h-full' : 'hidden h-full'}><DiffTool /></div>}
                          {visitedTools.has('ai-csv-editor') && <div className={activeTool === 'ai-csv-editor' ? 'block h-full' : 'hidden h-full'}><AiCsvEditorTool /></div>}
                          {visitedTools.has('ocr') && <div className={activeTool === 'ocr' ? 'block h-full' : 'hidden h-full'}><OCRTool /></div>}
                          {visitedTools.has('chat') && <div className={activeTool === 'chat' ? 'block h-full' : 'hidden h-full'}><AiChatTool /></div>}
                          {visitedTools.has('converter') && <div className={activeTool === 'converter' ? 'block h-full' : 'hidden h-full'}><ConverterTool /></div>}
                          {visitedTools.has('viewer') && <div className={activeTool === 'viewer' ? 'block h-full' : 'hidden h-full'}><ViewerTool /></div>}
                          {visitedTools.has('anonymizer') && <div className={activeTool === 'anonymizer' ? 'block h-full' : 'hidden h-full'}><AnonymizerTool /></div>}
                          {visitedTools.has('metadata') && <div className={activeTool === 'metadata' ? 'block h-full' : 'hidden h-full'}><MetadataTool /></div>}
                          {visitedTools.has('compressor') && <div className={activeTool === 'compressor' ? 'block h-full' : 'hidden h-full'}><CompressorTool /></div>}
                          {visitedTools.has('dashboard') && <div className={activeTool === 'dashboard' ? 'block h-full' : 'hidden h-full'}><InstantDashboardTool /></div>}
                      </Suspense>
                  </div>
                </main>
            </div>
          )}
        </div>
  );
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [isProMode, setIsProMode] = useState(true);
  
  const t = (key: string) => DICTIONARY[lang][key] || key;

  return (
    <GemmaProvider>
      <AppContext.Provider value={{ lang, setLang, t, isProMode }}>
        <AppContent />
      </AppContext.Provider>
    </GemmaProvider>
  );
};

export default App;
