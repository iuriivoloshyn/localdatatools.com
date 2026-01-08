
import React from 'react';
import { LucideIcon, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../App';

interface ToolHeaderProps {
  title: string;
  description: string;
  instructions: string[];
  icon: LucideIcon;
  colorClass: string;
  onReset?: () => void;
  badge?: string;
}

const TOOL_CONTENT_TRANSLATIONS: Record<string, Record<string, { desc: string; steps: string[] }>> = {
  en: {
    'CSV Fusion': {
      desc: 'The ultimate engine for high-speed CSV operations. Merge datasets horizontally with lookups or stack them vertically for bulk log analysis.',
      steps: [
        "Select 'Column Join' (SQL-Style) or 'Row Append' (Stacking)",
        "Upload your primary source and target files",
        "For Joins: Select matching columns and toggle output fields",
        "Execute merge and download the processed dataset locally"
      ]
    },
    'Local CSV Diff': {
      desc: 'Compare two CSV files side-by-side to detect additions, removals, and modifications. Streaming technology handles large files without crashing.',
      steps: [
        "Upload the 'Original' (Old) and 'New' (Updated) CSV files",
        "Select a unique identifier column (e.g., ID, Email, SKU)",
        "Click 'Compare Files' to stream and analyze differences",
        "View a unified diff highlighting Added (Green), Removed (Red), and Changed (Yellow) rows"
      ]
    },
    'Image to Text': {
      desc: 'Fast and secure local OCR engine. Extract plain text from images or screenshots using Tesseract technology running entirely in your browser.',
      steps: [
        "Drag & drop an image (PNG, JPG, WEBP)",
        "Optionally select the document language",
        "Click extract to process the image locally",
        "Copy or download the resulting text instantly"
      ]
    },
    'AI Chat': {
      desc: 'Talk with an advanced local-ready AI. Use Gemma 2 (Local) to brainstorm, analyze, or code. Includes integrated Tesseract OCR for image parsing.',
      steps: [
        "Type your message to start the conversation",
        "Attach images to extract text and discuss content locally",
        "Configure System Instruction and Temperature in settings",
        "History is stored in-memory and resets on tab close"
      ]
    },
    'File Converter': {
      desc: 'Universal format transformation engine. Convert between Spreadsheets (CSV/XLSX), Documents (DOCX/PDF), and Images instantly.',
      steps: [
        "Drag & Drop files (CSV, XLSX, PDF, DOCX, Images)",
        "For PDFs, choose between extraction to Images or conversion to DOCX",
        "Click 'Convert All' to process the queue",
        "Download results individually"
      ]
    },
    'File Viewer': {
      desc: 'Universal client-side preview tool. Instantly view spreadsheets, PDFs, Images (JPG, PNG, WEBP), and text documents directly in the browser.',
      steps: [
        "Drag & Drop a supported file (CSV, XLSX, PDF, DOCX, TXT, Images)",
        "The viewer automatically renders the content",
        "Navigate through spreadsheet pages or scroll through documents",
        "No data is uploaded; completely private and local"
      ]
    },
    'Smart CSV Editor': {
      desc: 'Modify datasets using natural language instructions. Powered by a downloadable local LLM (Gemma 2). No API calls, data never leaves your device.',
      steps: [
        "Upload any CSV file (Data stays local)",
        "Type your instruction (e.g., 'Delete rows where Status is Error')",
        "Local AI generates transformation logic instantly",
        "Preview and download the modified CSV"
      ]
    },
    'Anonymizer': {
      desc: "Securely anonymize datasets for external analysis and restore them with precision. Generates a cryptographic-like key file for 1-to-1 restoration.",
      steps: [
        "Mode 1: Anonymize - Upload source, map columns, and download clean data + key.",
        "Mode 2: Restore - Upload the report and your private key to reconstruct data.",
        "Supports multi-sheet XLSX restoration."
      ]
    },
    'Metadata & Hash': {
      desc: "View invisible image data and modify file signatures. Extract EXIF data and change file hashes without visible alteration.",
      steps: [
        "Upload an image to view hidden metadata (EXIF, GPS, Camera Info)",
        "View the real-time SHA-256 Hash of the file",
        "Click 'Scramble Hash' to add an invisible watermark",
        "Download the new unique file"
      ]
    }
  },
  ru: {
    'CSV Fusion': {
      desc: 'Мощный движок для скоростной обработки CSV. Объединяйте таблицы или добавляйте новые строки для анализа логов.',
      steps: [
        'Выберите "Column Join" (как в SQL) или "Row Append" (Добавление строк)',
        'Загрузите основной и целевые файлы',
        'Для Join: выберите общие колонки и настройте поля вывода',
        'Запустите объединение и скачайте результат'
      ]
    },
    'Local CSV Diff': {
      desc: 'Сравните два CSV файла, чтобы найти добавленные, удаленные и измененные строки. Потоковая технология обрабатывает большие файлы.',
      steps: [
        "Загрузите 'Оригинал' (Старый) и 'Новый' (Обновленный) CSV файлы",
        "Выберите уникальный идентификатор (например, ID, Email, SKU)",
        "Нажмите 'Сравнить', чтобы запустить анализ различий",
        "Просмотрите объединенный отчет: Добавлено (Зеленый), Удалено (Красный), Изменено (Желтый)"
      ]
    },
    'Image to Text': {
      desc: 'Быстрый и безопасный локальный OCR движок. Извлекайте текст из изображений или скриншотов с помощью технологии Tesseract, работающей полностью в браузере.',
      steps: [
        'Перетащите изображение (PNG, JPG, WEBP)',
        'Выберите язык документа при необходимости',
        'Нажмите кнопку извлечения для локальной обработки',
        'Скопируйте или скачайте полученный текст мгновенно'
      ]
    },
    'AI Chat': {
      desc: 'Общайтесь с продвинутым ИИ локально. Используйте Gemma 2 для идей, анализа или кода. Включает локальный OCR Tesseract.',
      steps: [
        'Напишите сообщение, чтобы начать диалог',
        'Прикрепляйте изображения для извлечения текста',
        'Настройте системную инструкцию и температуру',
        'История хранится в памяти и сбрасывается при закрытии вкладки'
      ]
    },
    'File Converter': {
      desc: 'Универсальный движок конвертации. Преобразуйте таблицы (CSV/XLSX), документы (DOCX/PDF) и изображения мгновенно.',
      steps: [
        "Перетащите файлы (CSV, XLSX, PDF, DOCX, Изображения)",
        "Для PDF выберите: извлечение в картинки или конвертация в DOCX",
        "Нажмите 'Convert All' для обработки очереди",
        "Скачивайте результаты по отдельности"
      ]
    },
    'File Viewer': {
      desc: 'Универсальный инструмент просмотра. Мгновенно просматривайте таблицы, PDF, изображения (JPG, PNG, WEBP) и документы прямо в браузере.',
      steps: [
        "Перетащите поддерживаемый файл (CSV, XLSX, PDF, DOCX, TXT, Изображения)",
        "Вьюер автоматически отобразит содержимое",
        "Навигация по страницам таблиц или скроллинг документов",
        "Данные не загружаются на сервер, полная приватность"
      ]
    },
    'Smart CSV Editor': {
      desc: 'Модифицируйте наборы данных с помощью инструкций на естественном языке. Использует локальную модель Llama 3.2. Никаких API вызовов.',
      steps: [
        "Загрузите CSV файл (Данные остаются локально)",
        "Введите инструкцию (например, 'Удалить строки где Статус Ошибка')",
        "Локальный ИИ сгенерирует логику изменений",
        "Просмотрите результаты и скачайте измененный CSV"
      ]
    },
    'Anonymizer': {
      desc: "Безопасная анонимизация данных. Генерирует ключ для восстановления.",
      steps: [
        "Режим 1: Анонимизация - Загрузите источник и скачайте чистые данные + ключ.",
        "Режим 2: Восстановление - Загрузите отчет и ключ для восстановления.",
        "Поддерживает XLSX и CSV."
      ]
    },
    'Metadata & Hash': {
      desc: "Просмотр метаданных и изменение подписи файла. Извлекайте EXIF и меняйте хеш без видимых изменений.",
      steps: [
        "Загрузите фото для просмотра метаданных (EXIF, GPS)",
        "Посмотрите текущий SHA-256 хеш файла",
        "Нажмите 'Изменить Хеш' для добавления невидимой маркировки",
        "Скачайте новый уникальный файл"
      ]
    }
  }
};

const ToolHeader: React.FC<ToolHeaderProps> = ({ title, description, instructions, icon: Icon, colorClass, onReset, badge }) => {
  const { lang, isProMode } = useLanguage();
  const baseColor = colorClass.split('-')[1];

  const translated = TOOL_CONTENT_TRANSLATIONS[lang] ? TOOL_CONTENT_TRANSLATIONS[lang][title] : null;
  const finalDesc = translated ? translated.desc : description;
  const finalSteps = translated ? translated.steps : instructions;

  return (
    <div className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <style>{`
        .flip-container {
            perspective: 1000px;
        }
        .flip-inner {
            position: relative;
            width: 100%;
            height: 100%;
            transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
            transform-style: preserve-3d;
        }
        /* Only enable hover flip if reset is available */
        .flip-container.has-reset:hover .flip-inner {
            transform: rotateY(180deg);
        }
        .flip-front, .flip-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            border-radius: 0.75rem; /* rounded-xl */
        }
        .flip-back {
            transform: rotateY(180deg);
        }
      `}</style>
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent p-6 backdrop-blur-md shadow-xl border border-${baseColor}-500/10`}>
        <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-10 bg-${baseColor}-500`}></div>
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            
            <div className={`shrink-0 w-16 h-16 flip-container cursor-pointer ${onReset ? 'has-reset' : 'cursor-default'}`}>
                <div className="flip-inner">
                    {/* Front Face (Icon) */}
                    <div className={`flip-front flex items-center justify-center bg-zinc-900 border border-white/5 shadow-xl ${colorClass}`}>
                        <Icon size={32} strokeWidth={1.5} />
                    </div>

                    {/* Back Face (Reset) - Only if onReset provided */}
                    {onReset && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); onReset(); }}
                            className="flip-back flex items-center justify-center bg-red-500/10 border border-red-500/30 shadow-xl hover:bg-red-500/20 hover:border-red-500/60 transition-colors cursor-pointer"
                            title="Reset Tool"
                        >
                             <RotateCcw size={24} className="text-red-500 hover:text-red-400 transition-colors" strokeWidth={2} />
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className={`text-2xl font-black tracking-tight ${colorClass}`}>
                        {title}
                    </h1>
                    {badge && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest border border-red-500/20 animate-pulse">
                            {badge}
                        </span>
                    )}
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                {finalDesc}
              </p>
            </div>
          </div>
          
          {!isProMode && finalSteps.length > 0 && (
            <div className="mt-2 pt-4 border-t border-white/5">
                <div className="flex flex-col gap-0.5">
                  {finalSteps.map((step, idx) => (
                    <div key={idx} className="group flex items-baseline gap-3 p-1 rounded hover:bg-white/[0.02] transition-all cursor-default -ml-1">
                      <span className={`text-[10px] font-bold opacity-30 group-hover:opacity-100 transition-opacity ${colorClass.replace('text-', 'text-')}`}>
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium leading-snug group-hover:text-gray-200 transition-colors">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolHeader;
