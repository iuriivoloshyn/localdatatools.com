
import React, { useState, useRef, useCallback, useEffect } from 'react';
import ToolHeader from '../layout/ToolHeader';
import {
  TableProperties, Plus, Trash2, Download, Shuffle, Zap, Copy,
  CheckCircle2, AlertTriangle, Settings2, Rows3, Columns3, Dices,
  Hash, Type, Mail, MapPin, Phone, Calendar, DollarSign, Globe,
  User, Building2, CreditCard, Fingerprint, FileText, Percent,
  Link2, Clock, Binary, ToggleLeft, GripVertical, ChevronDown,
  Sparkles, Lock, Unlock, BarChart3, Play, Eye
} from 'lucide-react';
import { useLanguage } from '../../App';

// ─── DATA TYPES ───────────────────────────────────────────────
type DataType =
  | 'first_name' | 'last_name' | 'full_name' | 'email' | 'phone'
  | 'address' | 'city' | 'country' | 'zip_code'
  | 'company' | 'job_title'
  | 'integer' | 'float' | 'price' | 'percentage'
  | 'date' | 'datetime' | 'timestamp'
  | 'boolean' | 'uuid' | 'ip_address' | 'url'
  | 'credit_card' | 'iban'
  | 'text' | 'sentence' | 'paragraph'
  | 'custom_list' | 'sequence' | 'hex_color';

interface DataTypeInfo {
  label: string;
  icon: any;
  category: string;
  example: string;
}

const DATA_TYPES: Record<DataType, DataTypeInfo> = {
  first_name:  { label: 'First Name',  icon: User,        category: 'Person',   example: 'Alice' },
  last_name:   { label: 'Last Name',   icon: User,        category: 'Person',   example: 'Johnson' },
  full_name:   { label: 'Full Name',   icon: User,        category: 'Person',   example: 'Alice Johnson' },
  email:       { label: 'Email',       icon: Mail,        category: 'Person',   example: 'alice@mail.com' },
  phone:       { label: 'Phone',       icon: Phone,       category: 'Person',   example: '+1-555-1234567' },
  company:     { label: 'Company',     icon: Building2,   category: 'Business', example: 'Acme Inc' },
  job_title:   { label: 'Job Title',   icon: FileText,    category: 'Business', example: 'Engineer' },
  address:     { label: 'Address',     icon: MapPin,      category: 'Location', example: '123 Main St' },
  city:        { label: 'City',        icon: MapPin,      category: 'Location', example: 'New York' },
  country:     { label: 'Country',     icon: Globe,       category: 'Location', example: 'USA' },
  zip_code:    { label: 'Zip Code',    icon: Hash,        category: 'Location', example: '10001' },
  integer:     { label: 'Integer',     icon: Hash,        category: 'Number',   example: '42' },
  float:       { label: 'Float',       icon: Hash,        category: 'Number',   example: '3.14' },
  price:       { label: 'Price',       icon: DollarSign,  category: 'Number',   example: '$99.99' },
  percentage:  { label: 'Percentage',  icon: Percent,     category: 'Number',   example: '73.5%' },
  date:        { label: 'Date',        icon: Calendar,    category: 'DateTime', example: '2024-03-15' },
  datetime:    { label: 'DateTime',    icon: Calendar,    category: 'DateTime', example: '2024-03-15T14:30' },
  timestamp:   { label: 'Timestamp',   icon: Clock,       category: 'DateTime', example: '1710512400' },
  boolean:     { label: 'Boolean',     icon: ToggleLeft,  category: 'Other',    example: 'true' },
  uuid:        { label: 'UUID',        icon: Fingerprint, category: 'Other',    example: 'a1b2c3d4-...' },
  ip_address:  { label: 'IP Address',  icon: Globe,       category: 'Other',    example: '192.168.1.1' },
  url:         { label: 'URL',         icon: Link2,       category: 'Other',    example: 'https://...' },
  credit_card: { label: 'Credit Card', icon: CreditCard,  category: 'Other',    example: '4111-1111-...' },
  iban:        { label: 'IBAN',        icon: CreditCard,  category: 'Other',    example: 'DE89370400...' },
  text:        { label: 'Word',        icon: Type,        category: 'Text',     example: 'lorem' },
  sentence:    { label: 'Sentence',    icon: Type,        category: 'Text',     example: 'Lorem ipsum...' },
  paragraph:   { label: 'Paragraph',   icon: FileText,    category: 'Text',     example: 'Lorem ipsum dolor...' },
  custom_list: { label: 'Custom List', icon: Dices,       category: 'Custom',   example: 'A, B, C' },
  sequence:    { label: 'Sequence',    icon: Rows3,       category: 'Custom',   example: '1, 2, 3...' },
  hex_color:   { label: 'Hex Color',   icon: Sparkles,    category: 'Other',    example: '#FF5733' },
};

const DATA_TYPE_CATEGORIES = ['Person', 'Business', 'Location', 'Number', 'DateTime', 'Text', 'Other', 'Custom'];

// ─── COLUMN CONFIG ────────────────────────────────────────────
interface ColumnConfig {
  id: string;
  name: string;
  dataType: DataType;
  unique: boolean;
  nullPercentage: number; // 0-100, % of cells that are null
  customValues?: string;  // for custom_list
  min?: number;           // for numeric types
  max?: number;           // for numeric types
  prefix?: string;        // for sequence
}

// ─── PRESET TEMPLATES ─────────────────────────────────────────
interface Preset {
  label: string;
  labelRu: string;
  icon: any;
  columns: Omit<ColumnConfig, 'id'>[];
}

const PRESETS: Preset[] = [
  {
    label: 'Users Table', labelRu: 'Таблица пользователей', icon: User,
    columns: [
      { name: 'id', dataType: 'sequence', unique: true, nullPercentage: 0 },
      { name: 'first_name', dataType: 'first_name', unique: false, nullPercentage: 0 },
      { name: 'last_name', dataType: 'last_name', unique: false, nullPercentage: 0 },
      { name: 'email', dataType: 'email', unique: true, nullPercentage: 0 },
      { name: 'phone', dataType: 'phone', unique: false, nullPercentage: 5 },
      { name: 'city', dataType: 'city', unique: false, nullPercentage: 0 },
      { name: 'created_at', dataType: 'datetime', unique: false, nullPercentage: 0 },
    ]
  },
  {
    label: 'E-Commerce Orders', labelRu: 'Заказы интернет-магазина', icon: DollarSign,
    columns: [
      { name: 'order_id', dataType: 'uuid', unique: true, nullPercentage: 0 },
      { name: 'customer_name', dataType: 'full_name', unique: false, nullPercentage: 0 },
      { name: 'email', dataType: 'email', unique: false, nullPercentage: 0 },
      { name: 'product', dataType: 'custom_list', unique: false, nullPercentage: 0, customValues: 'Laptop,Phone,Tablet,Monitor,Keyboard,Mouse,Headset,Camera' },
      { name: 'amount', dataType: 'price', unique: false, nullPercentage: 0, min: 10, max: 2000 },
      { name: 'status', dataType: 'custom_list', unique: false, nullPercentage: 0, customValues: 'pending,processing,shipped,delivered,cancelled' },
      { name: 'order_date', dataType: 'date', unique: false, nullPercentage: 0 },
    ]
  },
  {
    label: 'Company Directory', labelRu: 'Справочник компаний', icon: Building2,
    columns: [
      { name: 'id', dataType: 'sequence', unique: true, nullPercentage: 0 },
      { name: 'company', dataType: 'company', unique: false, nullPercentage: 0 },
      { name: 'industry', dataType: 'custom_list', unique: false, nullPercentage: 0, customValues: 'Tech,Finance,Healthcare,Education,Retail,Energy,Manufacturing' },
      { name: 'country', dataType: 'country', unique: false, nullPercentage: 0 },
      { name: 'employees', dataType: 'integer', unique: false, nullPercentage: 0, min: 10, max: 50000 },
      { name: 'revenue', dataType: 'price', unique: false, nullPercentage: 10, min: 100000, max: 10000000 },
      { name: 'website', dataType: 'url', unique: false, nullPercentage: 15 },
    ]
  },
  {
    label: 'IoT Sensor Data', labelRu: 'Данные IoT сенсоров', icon: BarChart3,
    columns: [
      { name: 'timestamp', dataType: 'timestamp', unique: false, nullPercentage: 0 },
      { name: 'device_id', dataType: 'custom_list', unique: false, nullPercentage: 0, customValues: 'sensor-A1,sensor-A2,sensor-B1,sensor-B2,sensor-C1' },
      { name: 'temperature', dataType: 'float', unique: false, nullPercentage: 2, min: -20, max: 45 },
      { name: 'humidity', dataType: 'percentage', unique: false, nullPercentage: 2 },
      { name: 'pressure', dataType: 'float', unique: false, nullPercentage: 5, min: 980, max: 1040 },
      { name: 'status', dataType: 'custom_list', unique: false, nullPercentage: 0, customValues: 'ok,warning,error,offline' },
    ]
  },
];

// ─── DATA GENERATORS ──────────────────────────────────────────
const FIRST_NAMES = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Christopher','Karen','Charles','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra','Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle','Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa','Timothy','Deborah','Ronald','Stephanie','Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia','Jacob','Kathleen','Gary','Amy','Nicholas','Angela','Eric','Shirley','Jonathan','Anna','Stephen','Brenda','Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen','Benjamin','Samantha','Samuel','Katherine','Raymond','Christine','Gregory','Debra','Frank','Rachel','Alexander','Carolyn','Patrick','Janet','Jack','Catherine','Dennis','Maria','Jerry','Heather','Tyler','Diane'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross'];
const CITIES = ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus','Charlotte','Indianapolis','San Francisco','Seattle','Denver','Washington','Nashville','Oklahoma City','El Paso','Boston','Portland','Las Vegas','Memphis','Louisville','Baltimore','Milwaukee','Albuquerque','Tucson','Fresno','Sacramento','Mesa','Kansas City','Atlanta','Omaha','Colorado Springs','Raleigh','Long Beach','Virginia Beach','Miami','Oakland','Minneapolis','Tulsa','Tampa','Arlington','New Orleans'];
const COUNTRIES = ['USA','UK','Canada','Germany','France','Japan','Australia','Brazil','India','China','Mexico','Italy','Spain','Netherlands','Sweden','Norway','Denmark','Finland','Switzerland','Austria','Belgium','Portugal','Ireland','New Zealand','South Korea','Singapore','Poland','Czech Republic','Argentina','Chile','Colombia','Peru','Thailand','Malaysia','Indonesia','Philippines','Vietnam','Turkey','Egypt','South Africa','Nigeria','Kenya','Morocco','Saudi Arabia','UAE','Israel','Greece','Romania','Hungary','Ukraine'];
const COMPANIES = ['Acme Corp','Globex Inc','Initech','Umbrella Corp','Stark Industries','Wayne Enterprises','Cyberdyne Systems','Weyland Corp','Soylent Corp','Tyrell Corp','Hooli','Pied Piper','Dunder Mifflin','Sterling Cooper','Prestige Worldwide','Vandelay Industries','Massive Dynamic','InGen','Oscorp','LexCorp','Aperture Science','Black Mesa','Abstergo','Momcorp','Planet Express','Buy n Large','Wonka Industries','Nakatomi Trading','Oceanic Airlines','Dharma Initiative'];
const JOB_TITLES = ['Software Engineer','Product Manager','Data Analyst','UX Designer','Marketing Manager','Sales Representative','DevOps Engineer','Project Manager','Business Analyst','QA Engineer','Frontend Developer','Backend Developer','Full Stack Developer','Data Scientist','Machine Learning Engineer','Cloud Architect','Security Analyst','Technical Writer','Scrum Master','CTO','VP of Engineering','HR Manager','Account Executive','Financial Analyst','Operations Manager'];
const STREETS = ['Main St','Oak Ave','Elm St','Park Blvd','Cedar Ln','Maple Dr','Pine Rd','Lake Ave','Hill St','River Rd','Forest Ave','Meadow Ln','Sunset Blvd','Broadway','Washington Ave','Lincoln Rd','Cherry Ln','Walnut St','Spruce Dr','Birch Ave'];
const WORDS = ['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim','ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi','aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit','voluptate','velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint','occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt','mollit','anim','id','est'];
const DOMAINS = ['gmail.com','yahoo.com','outlook.com','hotmail.com','protonmail.com','icloud.com','mail.com','fastmail.com','zoho.com','aol.com','company.com','work.org','business.net','corp.io','enterprise.co'];
const TLDS = ['com','org','net','io','co','dev','app','tech','ai','xyz'];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function generateValue(col: ColumnConfig, rowIndex: number, usedValues?: Set<string>): string {
  // Null check
  if (col.nullPercentage > 0 && Math.random() * 100 < col.nullPercentage) {
    return '';
  }

  const min = col.min ?? 0;
  const max = col.max ?? 10000;
  let value = '';
  let attempts = 0;

  do {
    switch (col.dataType) {
      case 'first_name': value = pick(FIRST_NAMES); break;
      case 'last_name': value = pick(LAST_NAMES); break;
      case 'full_name': value = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; break;
      case 'email': {
        const fn = pick(FIRST_NAMES).toLowerCase();
        const ln = pick(LAST_NAMES).toLowerCase();
        const sep = pick(['.', '_', '']);
        const num = col.unique ? rowIndex : (Math.random() > 0.5 ? rand(1, 999) : 0);
        value = `${fn}${sep}${ln}${num ? num : ''}@${pick(DOMAINS)}`;
        break;
      }
      case 'phone': value = `+1-${rand(200,999)}-${rand(1000000,9999999)}`; break;
      case 'address': value = `${rand(100,9999)} ${pick(STREETS)}`; break;
      case 'city': value = pick(CITIES); break;
      case 'country': value = pick(COUNTRIES); break;
      case 'zip_code': value = String(rand(10000, 99999)); break;
      case 'company': value = pick(COMPANIES); break;
      case 'job_title': value = pick(JOB_TITLES); break;
      case 'integer': value = String(rand(min, max)); break;
      case 'float': value = (min + Math.random() * (max - min)).toFixed(2); break;
      case 'price': value = (min + Math.random() * ((col.max ?? 1000) - min)).toFixed(2); break;
      case 'percentage': value = (Math.random() * 100).toFixed(1); break;
      case 'date': {
        const d = new Date(Date.now() - rand(0, 365 * 3) * 86400000);
        value = d.toISOString().split('T')[0];
        break;
      }
      case 'datetime': {
        const d = new Date(Date.now() - rand(0, 365 * 3) * 86400000 - rand(0, 86400) * 1000);
        value = d.toISOString().replace('Z', '').split('.')[0];
        break;
      }
      case 'timestamp': value = String(Math.floor(Date.now() / 1000) - rand(0, 365 * 3 * 86400)); break;
      case 'boolean': value = Math.random() > 0.5 ? 'true' : 'false'; break;
      case 'uuid': value = uuid(); break;
      case 'ip_address': value = `${rand(1,255)}.${rand(0,255)}.${rand(0,255)}.${rand(1,254)}`; break;
      case 'url': value = `https://${pick(WORDS)}${pick(WORDS)}.${pick(TLDS)}/${pick(WORDS)}`; break;
      case 'credit_card': value = `4${rand(100,999)}-${rand(1000,9999)}-${rand(1000,9999)}-${rand(1000,9999)}`; break;
      case 'iban': {
        const cc = pick(['DE','FR','GB','NL','ES','IT']);
        value = `${cc}${rand(10,99)}${Array.from({length: 18}, () => rand(0,9)).join('')}`;
        break;
      }
      case 'text': value = pick(WORDS); break;
      case 'sentence': value = Array.from({length: rand(5,12)}, () => pick(WORDS)).join(' ') + '.'; break;
      case 'paragraph': {
        const sentences = Array.from({length: rand(3,6)}, () =>
          Array.from({length: rand(5,12)}, () => pick(WORDS)).join(' ') + '.'
        );
        value = sentences.join(' ');
        break;
      }
      case 'custom_list': {
        const items = (col.customValues || 'A,B,C').split(',').map(s => s.trim()).filter(Boolean);
        value = pick(items);
        break;
      }
      case 'sequence': value = String((col.min ?? 1) + rowIndex); break;
      case 'hex_color': value = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase(); break;
      default: value = `row_${rowIndex}`;
    }
    attempts++;
    if (!col.unique || !usedValues?.has(value) || attempts > 100) break;
  } while (col.unique && usedValues?.has(value));

  if (col.unique && usedValues) usedValues.add(value);
  return value;
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// ─── SIZE PRESETS ─────────────────────────────────────────────
interface SizePreset {
  label: string;
  rows: number;
  description: string;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: '100', rows: 100, description: 'Quick test' },
  { label: '1K', rows: 1_000, description: '~50KB' },
  { label: '10K', rows: 10_000, description: '~500KB' },
  { label: '100K', rows: 100_000, description: '~5MB' },
  { label: '500K', rows: 500_000, description: '~25MB' },
  { label: '1M', rows: 1_000_000, description: '~50MB' },
  { label: '5M', rows: 5_000_000, description: '~250MB' },
  { label: '10M', rows: 10_000_000, description: '~500MB' },
  { label: '20M', rows: 20_000_000, description: '~1GB' },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────
const GenerateCsvTool: React.FC = () => {
  const { t, isProMode, lang } = useLanguage();

  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: '1', name: 'id', dataType: 'sequence', unique: true, nullPercentage: 0 },
    { id: '2', name: 'name', dataType: 'full_name', unique: false, nullPercentage: 0 },
    { id: '3', name: 'email', dataType: 'email', unique: true, nullPercentage: 0 },
    { id: '4', name: 'city', dataType: 'city', unique: false, nullPercentage: 0 },
  ]);
  const [rowCount, setRowCount] = useState(1000);
  const [customRowCount, setCustomRowCount] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][] | null>(null);

  const abortRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(5);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup download URL on unmount
  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  const addColumn = () => {
    const id = String(nextId.current++);
    setColumns(prev => [...prev, {
      id, name: `column_${prev.length + 1}`, dataType: 'text', unique: false, nullPercentage: 0
    }]);
  };

  const removeColumn = (id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
  };

  const updateColumn = (id: string, updates: Partial<ColumnConfig>) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const applyPreset = (preset: Preset) => {
    const newCols = preset.columns.map((col, i) => ({
      ...col,
      id: String(nextId.current++),
    }));
    setColumns(newCols);
    setDownloadUrl(null);
    setPreviewRows(null);
    setError(null);
  };

  const randomizeColumns = () => {
    const types = Object.keys(DATA_TYPES) as DataType[];
    const count = rand(3, 8);
    const newCols: ColumnConfig[] = [
      { id: String(nextId.current++), name: 'id', dataType: 'sequence', unique: true, nullPercentage: 0 },
    ];
    const usedTypes = new Set<DataType>(['sequence']);
    for (let i = 0; i < count; i++) {
      let dt: DataType;
      do { dt = pick(types); } while (usedTypes.has(dt) && usedTypes.size < types.length);
      usedTypes.add(dt);
      const info = DATA_TYPES[dt];
      newCols.push({
        id: String(nextId.current++),
        name: info.label.toLowerCase().replace(/\s+/g, '_'),
        dataType: dt,
        unique: dt === 'email' || dt === 'uuid',
        nullPercentage: Math.random() > 0.7 ? rand(1, 15) : 0,
      });
    }
    setColumns(newCols);
    setDownloadUrl(null);
    setPreviewRows(null);
  };

  const generatePreview = () => {
    const rows: string[][] = [];
    const usedSets = columns.map(() => new Set<string>());
    for (let r = 0; r < 5; r++) {
      const row = columns.map((col, ci) => generateValue(col, r, col.unique ? usedSets[ci] : undefined));
      rows.push(row);
    }
    setPreviewRows(rows);
  };

  // ─── WEB WORKER GENERATION (off main thread) ───────────────
  const generate = useCallback(() => {
    if (columns.length === 0) {
      setError('Add at least one column.');
      return;
    }

    const totalRows = customRowCount ? parseInt(customRowCount) : rowCount;
    if (!totalRows || totalRows < 1) {
      setError('Row count must be at least 1.');
      return;
    }
    if (totalRows > 20_000_000) {
      setError('Maximum 20 million rows supported in-browser.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
    abortRef.current = false;

    // Inline Web Worker for off-thread CSV generation
    const workerCode = `
const FN = ${JSON.stringify(FIRST_NAMES)};
const LN = ${JSON.stringify(LAST_NAMES)};
const CT = ${JSON.stringify(CITIES)};
const CO = ${JSON.stringify(COUNTRIES)};
const CM = ${JSON.stringify(COMPANIES)};
const JT = ${JSON.stringify(JOB_TITLES)};
const ST = ${JSON.stringify(STREETS)};
const WD = ${JSON.stringify(WORDS)};
const DM = ${JSON.stringify(DOMAINS)};
const TL = ${JSON.stringify(TLDS)};
const HX = '0123456789abcdef';
const SEPS = ['.','_',''];
const CCS = ['DE','FR','GB','NL','ES','IT'];

const R = (a,b) => (Math.random()*(b-a+1)|0)+a;
const P = (a) => a[(Math.random()*a.length)|0];

// Pre-compiled per-column generator to avoid switch in hot loop
function makeGen(col) {
  const dt = col.dataType, mn = col.min??0, mx = col.max??10000, np = col.nullPercentage;
  const needsEscape = dt === 'full_name' || dt === 'address' || dt === 'sentence' || dt === 'paragraph' || dt === 'job_title' || dt === 'company';
  let items;
  if (dt === 'custom_list') items = (col.customValues||'A,B,C').split(',').map(s=>s.trim()).filter(Boolean);
  const seqStart = col.min ?? 1;
  const priceMx = col.max ?? 1000;
  // Pre-compute lowercase names for email
  let fnLow, lnLow;
  if (dt === 'email') { fnLow = FN.map(s=>s.toLowerCase()); lnLow = LN.map(s=>s.toLowerCase()); }
  // Fast UUID via hex table
  const fastUuid = () => {
    let s = '';
    for (let i = 0; i < 36; i++) {
      if (i===8||i===13||i===18||i===23) { s+='-'; }
      else if (i===14) { s+='4'; }
      else if (i===19) { s+=HX[(Math.random()*4|0)+8]; }
      else { s+=HX[Math.random()*16|0]; }
    }
    return s;
  };
  // Fast date without Date object
  const now = Date.now();
  const nowSec = Math.floor(now/1000);
  const maxDayOff = 365*3;
  const fastDate = () => {
    const d = new Date(now - R(0,maxDayOff)*86400000);
    const y = d.getUTCFullYear(), m = d.getUTCMonth()+1, day = d.getUTCDate();
    return y+'-'+(m<10?'0':'')+m+'-'+(day<10?'0':'')+day;
  };
  const fastDateTime = () => {
    const d = new Date(now - R(0,maxDayOff)*86400000 - R(0,86400)*1000);
    const y=d.getUTCFullYear(),mo=d.getUTCMonth()+1,dy=d.getUTCDate(),h=d.getUTCHours(),mi=d.getUTCMinutes(),s=d.getUTCSeconds();
    return y+'-'+(mo<10?'0':'')+mo+'-'+(dy<10?'0':'')+dy+'T'+(h<10?'0':'')+h+':'+(mi<10?'0':'')+mi+':'+(s<10?'0':'')+s;
  };

  // Return a [generator, needsEscape] pair
  let gen;
  switch(dt) {
    case 'first_name': gen = () => P(FN); break;
    case 'last_name': gen = () => P(LN); break;
    case 'full_name': gen = () => P(FN)+' '+P(LN); break;
    case 'email': gen = (ri) => { const f=P(fnLow),l=P(lnLow),sep=P(SEPS),num=col.unique?ri:(Math.random()>0.5?R(1,999):0); return f+sep+l+(num||'')+'@'+P(DM); }; break;
    case 'phone': gen = () => '+1-'+R(200,999)+'-'+R(1000000,9999999); break;
    case 'address': gen = () => R(100,9999)+' '+P(ST); break;
    case 'city': gen = () => P(CT); break;
    case 'country': gen = () => P(CO); break;
    case 'zip_code': gen = () => ''+R(10000,99999); break;
    case 'company': gen = () => P(CM); break;
    case 'job_title': gen = () => P(JT); break;
    case 'integer': gen = () => ''+R(mn,mx); break;
    case 'float': gen = () => (mn+Math.random()*(mx-mn)).toFixed(2); break;
    case 'price': gen = () => (mn+Math.random()*(priceMx-mn)).toFixed(2); break;
    case 'percentage': gen = () => (Math.random()*100).toFixed(1); break;
    case 'date': gen = fastDate; break;
    case 'datetime': gen = fastDateTime; break;
    case 'timestamp': gen = () => ''+(nowSec-R(0,maxDayOff*86400)); break;
    case 'boolean': gen = () => Math.random()>0.5?'true':'false'; break;
    case 'uuid': gen = fastUuid; break;
    case 'ip_address': gen = () => R(1,255)+'.'+R(0,255)+'.'+R(0,255)+'.'+R(1,254); break;
    case 'url': gen = () => 'https://'+P(WD)+P(WD)+'.'+P(TL)+'/'+P(WD); break;
    case 'credit_card': gen = () => '4'+R(100,999)+'-'+R(1000,9999)+'-'+R(1000,9999)+'-'+R(1000,9999); break;
    case 'iban': gen = () => { let s=P(CCS)+R(10,99); for(let i=0;i<18;i++) s+=R(0,9); return s; }; break;
    case 'text': gen = () => P(WD); break;
    case 'sentence': gen = () => { let s=P(WD); const n=R(4,11); for(let i=0;i<n;i++) s+=' '+P(WD); return s+'.'; }; break;
    case 'paragraph': gen = () => { let p=''; const sn=R(3,6); for(let si=0;si<sn;si++){if(si)p+=' ';let s=P(WD);const n=R(4,11);for(let i=0;i<n;i++)s+=' '+P(WD);p+=s+'.';} return p; }; break;
    case 'custom_list': gen = () => P(items); break;
    case 'sequence': gen = (ri) => ''+(seqStart+ri); break;
    case 'hex_color': gen = () => { let s='#'; for(let i=0;i<6;i++) s+=HX[Math.random()*16|0]; return s.toUpperCase(); }; break;
    default: gen = (ri) => 'row_'+ri;
  }

  // Wrap with null check and escape if needed
  if (np > 0 && needsEscape) {
    return (ri, used) => {
      if (Math.random()*100 < np) return '';
      let v = gen(ri);
      if (col.unique && used) { let att=0; while(used.has(v)&&att++<100) v=gen(ri); used.add(v); }
      if (v.indexOf(',')>=0||v.indexOf('"')>=0) return '"'+v.replace(/"/g,'""')+'"';
      return v;
    };
  } else if (np > 0) {
    return (ri, used) => {
      if (Math.random()*100 < np) return '';
      let v = gen(ri);
      if (col.unique && used) { let att=0; while(used.has(v)&&att++<100) v=gen(ri); used.add(v); }
      return v;
    };
  } else if (needsEscape) {
    return (ri, used) => {
      let v = gen(ri);
      if (col.unique && used) { let att=0; while(used.has(v)&&att++<100) v=gen(ri); used.add(v); }
      if (v.indexOf(',')>=0||v.indexOf('"')>=0) return '"'+v.replace(/"/g,'""')+'"';
      return v;
    };
  } else {
    return (ri, used) => {
      let v = gen(ri);
      if (col.unique && used) { let att=0; while(used.has(v)&&att++<100) v=gen(ri); used.add(v); }
      return v;
    };
  }
}

self.onmessage = function(e) {
  const { columns, totalRows } = e.data;
  const CHUNK = 500000;
  const parts = [];
  const header = columns.map(c => {
    const n = c.name;
    return (n.indexOf(',')>=0||n.indexOf('"')>=0) ? '"'+n.replace(/"/g,'""')+'"' : n;
  }).join(',') + '\\n';
  parts.push(header);

  const gens = columns.map(c => makeGen(c));
  const usedSets = columns.map(c => c.unique ? new Set() : null);
  const numCols = columns.length;
  let generated = 0;
  let lastPct = 0;

  while (generated < totalRows) {
    const end = Math.min(generated + CHUNK, totalRows);
    let chunk = '';
    for (let r = generated; r < end; r++) {
      let row = gens[0](r, usedSets[0]);
      for (let ci = 1; ci < numCols; ci++) {
        row += ',' + gens[ci](r, usedSets[ci]);
      }
      chunk += row + '\\n';
    }
    parts.push(chunk);
    generated = end;
    const pct = (generated * 100 / totalRows) | 0;
    if (pct !== lastPct) { lastPct = pct; self.postMessage({ type: 'progress', progress: pct }); }
  }

  const blob = new Blob(parts, { type: 'text/csv;charset=utf-8' });
  self.postMessage({ type: 'done', blob, size: blob.size });
};
`;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type } = e.data;
      if (type === 'progress') {
        if (abortRef.current) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          workerRef.current = null;
          setIsGenerating(false);
          return;
        }
        setProgress(e.data.progress);
      } else if (type === 'done') {
        const url = URL.createObjectURL(e.data.blob);
        setDownloadUrl(url);
        setDownloadSize(e.data.size);
        setProgress(100);
        setIsGenerating(false);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      setError(err.message || 'Generation failed.');
      setIsGenerating(false);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      workerRef.current = null;
    };

    // Serialize column configs (strip non-serializable fields)
    const colData = columns.map(c => ({
      name: c.name, dataType: c.dataType, unique: c.unique,
      nullPercentage: c.nullPercentage, customValues: c.customValues,
      min: c.min, max: c.max, prefix: c.prefix,
    }));
    worker.postMessage({ columns: colData, totalRows });
  }, [columns, rowCount, customRowCount]);

  const handleReset = () => {
    abortRef.current = true;
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    setColumns([
      { id: String(nextId.current++), name: 'id', dataType: 'sequence', unique: true, nullPercentage: 0 },
      { id: String(nextId.current++), name: 'name', dataType: 'full_name', unique: false, nullPercentage: 0 },
      { id: String(nextId.current++), name: 'email', dataType: 'email', unique: true, nullPercentage: 0 },
      { id: String(nextId.current++), name: 'city', dataType: 'city', unique: false, nullPercentage: 0 },
    ]);
    setRowCount(1000);
    setCustomRowCount('');
    setIsGenerating(false);
    setProgress(0);
    setDownloadUrl(null);
    setPreviewRows(null);
    setError(null);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalRows = customRowCount ? parseInt(customRowCount) || 0 : rowCount;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <ToolHeader
        title="CSV Generator"
        description="Generate CSV files with realistic fake data"
        instructions={[
          'Configure columns: set name, data type, and uniqueness',
          'Choose row count or pick a size preset',
          'Click Generate to create the CSV locally',
          'Preview data and download the file'
        ]}
        icon={TableProperties}
        colorClass="text-teal-400"
        onReset={handleReset}
        badge="LOCAL"
      />

      {/* ── PRESETS ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {lang === 'ru' ? 'Шаблоны' : 'Quick Start'}
          </span>
          <button
            onClick={randomizeColumns}
            className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-teal-400/10"
          >
            <Dices size={14} />
            {lang === 'ru' ? 'Случайная схема' : 'Random Schema'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PRESETS.map((preset, i) => {
            const Icon = preset.icon;
            return (
              <button
                key={i}
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/50 border border-white/5 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group text-left"
              >
                <Icon size={16} className="text-gray-600 group-hover:text-teal-400 transition-colors shrink-0" />
                <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors truncate">
                  {lang === 'ru' ? preset.labelRu : preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── COLUMNS CONFIG ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Columns3 size={14} className="text-teal-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              {lang === 'ru' ? 'Колонки' : 'Columns'} ({columns.length})
            </span>
          </div>
          <button
            onClick={addColumn}
            className="flex items-center gap-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 px-3 py-1.5 rounded-lg hover:bg-teal-400/10 transition-all"
          >
            <Plus size={14} />
            {lang === 'ru' ? 'Добавить' : 'Add Column'}
          </button>
        </div>

        <div className="space-y-2">
          {columns.map((col) => {
            const typeInfo = DATA_TYPES[col.dataType];
            const TypeIcon = typeInfo.icon;
            const isExpanded = expandedCol === col.id;

            return (
              <div
                key={col.id}
                className={`rounded-xl border transition-all ${
                  isExpanded
                    ? 'bg-gray-900/80 border-teal-500/20 shadow-lg'
                    : 'bg-gray-900/40 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Compact Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical size={14} className="text-gray-700 shrink-0 cursor-grab" />

                  {/* Column Name */}
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                    className="bg-transparent text-sm font-mono text-gray-200 w-32 md:w-40 outline-none border-b border-transparent focus:border-teal-500/50 transition-colors"
                    placeholder="column_name"
                  />

                  {/* Data Type Selector */}
                  <div className="relative" ref={showTypeDropdown === col.id ? dropdownRef : undefined}>
                    <button
                      onClick={() => setShowTypeDropdown(showTypeDropdown === col.id ? null : col.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-white/5 hover:border-teal-500/30 transition-all text-xs"
                    >
                      <TypeIcon size={12} className="text-teal-400" />
                      <span className="text-gray-300">{typeInfo.label}</span>
                      <ChevronDown size={12} className="text-gray-600" />
                    </button>

                    {showTypeDropdown === col.id && (
                      <div className="absolute z-50 mt-1 left-0 w-64 max-h-72 overflow-y-auto bg-gray-900 border border-white/10 rounded-xl shadow-2xl p-2 custom-scrollbar">
                        {DATA_TYPE_CATEGORIES.map(cat => {
                          const types = (Object.entries(DATA_TYPES) as [DataType, DataTypeInfo][])
                            .filter(([, info]) => info.category === cat);
                          if (types.length === 0) return null;
                          return (
                            <div key={cat}>
                              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 pt-2 pb-1">{cat}</div>
                              {types.map(([dt, info]) => {
                                const I = info.icon;
                                return (
                                  <button
                                    key={dt}
                                    onClick={() => { updateColumn(col.id, { dataType: dt }); setShowTypeDropdown(null); }}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                                      col.dataType === dt ? 'bg-teal-500/10 text-teal-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                    }`}
                                  >
                                    <I size={12} />
                                    <span className="flex-1 text-left">{info.label}</span>
                                    <span className="text-[10px] text-gray-600 font-mono">{info.example}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Unique Toggle */}
                  <button
                    onClick={() => updateColumn(col.id, { unique: !col.unique })}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                      col.unique
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-gray-800/50 text-gray-600 border border-transparent hover:text-gray-400'
                    }`}
                    title={col.unique ? 'Unique values' : 'Allow duplicates'}
                  >
                    {col.unique ? <Lock size={10} /> : <Unlock size={10} />}
                    {col.unique ? 'Unique' : 'Any'}
                  </button>

                  {/* Expand / Settings */}
                  <button
                    onClick={() => setExpandedCol(isExpanded ? null : col.id)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all ml-auto"
                  >
                    <Settings2 size={14} />
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="p-1.5 rounded-lg text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded Settings */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
                    {/* Null Percentage */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-500 w-24 shrink-0">
                        {lang === 'ru' ? 'Пустые (%)' : 'Null %'}
                      </span>
                      <input
                        type="range"
                        min={0} max={50} step={1}
                        value={col.nullPercentage}
                        onChange={(e) => updateColumn(col.id, { nullPercentage: Number(e.target.value) })}
                        className="flex-1 accent-teal-500 h-1"
                      />
                      <span className="text-xs font-mono text-gray-400 w-10 text-right">{col.nullPercentage}%</span>
                    </div>

                    {/* Min/Max for numeric types */}
                    {['integer', 'float', 'price', 'sequence'].includes(col.dataType) && (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-500 w-24 shrink-0">Range</span>
                        <input
                          type="number"
                          placeholder="Min"
                          value={col.min ?? ''}
                          onChange={(e) => updateColumn(col.id, { min: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-24 px-2 py-1 text-xs font-mono bg-gray-800/80 border border-white/5 rounded-lg text-gray-300 outline-none focus:border-teal-500/30"
                        />
                        <span className="text-gray-600 text-xs">to</span>
                        <input
                          type="number"
                          placeholder="Max"
                          value={col.max ?? ''}
                          onChange={(e) => updateColumn(col.id, { max: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-24 px-2 py-1 text-xs font-mono bg-gray-800/80 border border-white/5 rounded-lg text-gray-300 outline-none focus:border-teal-500/30"
                        />
                      </div>
                    )}

                    {/* Custom Values for custom_list */}
                    {col.dataType === 'custom_list' && (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-500 w-24 shrink-0">Values</span>
                        <input
                          type="text"
                          value={col.customValues || ''}
                          onChange={(e) => updateColumn(col.id, { customValues: e.target.value })}
                          placeholder="value1, value2, value3"
                          className="flex-1 px-2 py-1 text-xs font-mono bg-gray-800/80 border border-white/5 rounded-lg text-gray-300 outline-none focus:border-teal-500/30"
                        />
                      </div>
                    )}

                    {/* Example Preview */}
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-500 w-24 shrink-0">Example</span>
                      <span className="text-xs font-mono text-teal-400/70">
                        {generateValue(col, 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ROW COUNT / SIZE ───────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Rows3 size={14} className="text-teal-400" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {lang === 'ru' ? 'Количество строк' : 'Row Count'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((sp) => (
            <button
              key={sp.label}
              onClick={() => { setRowCount(sp.rows); setCustomRowCount(''); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                !customRowCount && rowCount === sp.rows
                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/30 shadow-lg shadow-teal-500/5'
                  : 'bg-gray-900/50 text-gray-500 border-white/5 hover:border-white/10 hover:text-gray-300'
              }`}
            >
              <div className="font-bold">{sp.label}</div>
              <div className="text-[10px] opacity-60 mt-0.5">{sp.description}</div>
            </button>
          ))}

        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span>{columns.length} {lang === 'ru' ? 'колонок' : 'columns'} x {totalRows.toLocaleString()} {lang === 'ru' ? 'строк' : 'rows'}</span>
          <span>= {(totalRows * columns.length).toLocaleString()} {lang === 'ru' ? 'ячеек' : 'cells'}</span>
        </div>
      </div>

      {/* ── ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generatePreview}
          disabled={isGenerating || columns.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-800/80 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
        >
          <Eye size={16} />
          {lang === 'ru' ? 'Предпросмотр' : 'Preview'}
        </button>

        <button
          onClick={generate}
          disabled={isGenerating || columns.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-teal-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {lang === 'ru' ? 'Генерация...' : 'Generating...'}
            </>
          ) : (
            <>
              <Play size={16} />
              {lang === 'ru' ? 'Сгенерировать CSV' : 'Generate CSV'}
            </>
          )}
        </button>

        {isGenerating && (
          <button
            onClick={() => { abortRef.current = true; if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; setIsGenerating(false); } }}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
          >
            {lang === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
        )}
      </div>

      {/* ── PROGRESS BAR ───────────────────────────────────── */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>{progress}%</span>
            <span>{Math.round(totalRows * progress / 100).toLocaleString()} / {totalRows.toLocaleString()} {lang === 'ru' ? 'строк' : 'rows'}</span>
          </div>
        </div>
      )}

      {/* ── PREVIEW TABLE ──────────────────────────────────── */}
      {previewRows && !isGenerating && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {lang === 'ru' ? 'Предпросмотр (5 строк)' : 'Preview (5 rows)'}
          </span>
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-900/80 border-b border-white/5">
                  {columns.map(col => (
                    <th key={col.id} className="px-4 py-2.5 text-left font-mono font-bold text-teal-400 whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap max-w-[200px] truncate">
                        {cell || <span className="text-gray-700 italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ERROR ──────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── DOWNLOAD RESULT ────────────────────────────────── */}
      {downloadUrl && !isGenerating && (
        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-gradient-to-b from-teal-500/5 to-transparent border border-teal-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-teal-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-200">
                {lang === 'ru' ? 'CSV готов!' : 'CSV Ready!'}
              </div>
              <div className="text-[11px] text-gray-500">
                {totalRows.toLocaleString()} {lang === 'ru' ? 'строк' : 'rows'} &middot; {columns.length} {lang === 'ru' ? 'колонок' : 'columns'} &middot; {formatSize(downloadSize)}
              </div>
            </div>
          </div>
          <a
            href={downloadUrl}
            download={`generated_${totalRows}_rows.csv`}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-lg shadow-teal-500/20 transition-all"
          >
            <Download size={16} />
            {lang === 'ru' ? 'Скачать CSV' : 'Download CSV'} ({formatSize(downloadSize)})
          </a>
        </div>
      )}
    </div>
  );
};

export default GenerateCsvTool;
