import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
} from 'firebase/firestore';
import * as maplibregl from 'maplibre-gl';
import type {
  GeoJSONSource,
  Map as MLMap,
  Marker as MLMarker,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {
  Home,
  CalendarDays,
  Map as MapIcon,
  Info,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sunset,
  CloudSun,
  Building2,
  Plus,
  Minus,
  Trash2,
  Check,
  ArrowRightLeft,
  Zap,
  Clock,
  Copy,
  X,
  MapPin,
  ShieldAlert,
  Satellite,
  Mountain,
  Crosshair,
  Navigation,
  RefreshCw,
  Utensils,
  ShoppingBag,
  ExternalLink,
  Waves,
  MessageCircle,
  Users,
  Coins,
  Lock,
  Unlock,
  Gamepad2,
  Trophy,
  Camera,
  Play,
  Pause,
  Plane,
  Search,
  BookOpen,
  Eye,
} from 'lucide-react';

declare const __firebase_config: string | undefined;
declare const __app_id: string | undefined;
declare const __initial_auth_token: string | undefined;

// ============================================================================
// 型別定義
// ============================================================================

interface DayMeta {
  isoDate: string;
  shortDate: string;
  dateLabel: string;
  sunset: string;
}

interface TripGroup {
  id: string;
  label: string;
  dateRange: string;
  fullRange: string;
  daysMeta: DayMeta[];
}

interface Member {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  height: number;
  hasCrown: boolean;
  quotes: string[];
}

interface TimelineItem {
  time: string;
  text: string;
  tag?: string;
}

interface BaseTripDay {
  day: number;
  badge: string;
  title: string;
  route: string;
  theme: string;
  hotelShort: string;
  weather: string;
  regionGroup: string;
  highlights: string[];
  timeline: TimelineItem[];
  tips: string[];
}

type TripDay = BaseTripDay & DayMeta;

interface Place {
  id: string;
  zh: string;
  en: string;
  region: string;
  category: string;
  days: string;
  dayNums: number[];
  coords: [number, number];
  isHotel?: boolean;
  hotelBadge?: string;
  phone?: string;
  desc: string;
  query: string;
}

interface ChecklistItem {
  id: string;
  cat: string;
  text: string;
  isCustom?: boolean;
}

interface MemberChecklistState {
  checked: Record<string, boolean>;
  custom: ChecklistItem[];
}

interface MemberClaim {
  groupId: string;
  memberId: string;
  ownerUid: string;
  claimedAt: number;
}

interface GameScoreEntry {
  groupId: string;
  memberId: string;
  name: string;
  emoji: string;
  score: number;
  updatedAt: number;
}

interface MemberFlightInfo {
  groupId: string;
  memberId: string;
  memberName: string;
  realName?: string;
  arrivalFlight: string;
  arrivalTime: string;
  departureFlight: string;
  departureTime: string;
  checkInNote: string;
  updatedAt: number;
}

interface AppUser {
  uid: string;
}

type MapFilterId = 'naha' | 'all' | 'food' | 'shop' | 1 | 2 | 3 | 4;

// 初始化雲端即時同步服務（同時相容預覽環境與 Vercel 正式部署環境）
function getFirebaseConfig(): FirebaseOptions | null {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config) as FirebaseOptions;
    }
  } catch {
    // 忽略預覽環境變數解析錯誤
  }
  try {
    const env = import.meta?.env;
    if (env?.VITE_FIREBASE_API_KEY && env?.VITE_FIREBASE_PROJECT_ID) {
      return {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      };
    }
  } catch {
    // 忽略非 Vite 環境
  }
  return null;
}

const firebaseConfig = getFirebaseConfig();
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId =
  typeof __app_id !== 'undefined'
    ? __app_id
    : import.meta?.env?.VITE_APP_ID || 'okinawa-whale-trip';

// ============================================================================
// 1. 旅程核心資料 (iDiving 沖繩大翅鯨之旅 · 兩團 / 2 教練 + 7 團員)
// ============================================================================

const TRIP_GROUPS: TripGroup[] = [
  {
    id: 'group1',
    label: '第 1 團',
    dateRange: '3/5 – 3/8',
    fullRange: '2027/03/05 (五) – 03/08 (一)',
    daysMeta: [
      { isoDate: '2027-03-05', shortDate: '03/05 (五)', dateLabel: '3月5日 週五', sunset: '18:32' },
      { isoDate: '2027-03-06', shortDate: '03/06 (六)', dateLabel: '3月6日 週六', sunset: '18:33' },
      { isoDate: '2027-03-07', shortDate: '03/07 (日)', dateLabel: '3月7日 週日', sunset: '18:33' },
      { isoDate: '2027-03-08', shortDate: '03/08 (一)', dateLabel: '3月8日 週一', sunset: '18:00 (台北)' },
    ],
  },
  {
    id: 'group2',
    label: '第 2 團',
    dateRange: '3/15 – 3/18',
    fullRange: '2027/03/15 (一) – 03/18 (四)',
    daysMeta: [
      { isoDate: '2027-03-15', shortDate: '03/15 (一)', dateLabel: '3月15日 週一', sunset: '18:36' },
      { isoDate: '2027-03-16', shortDate: '03/16 (二)', dateLabel: '3月16日 週二', sunset: '18:37' },
      { isoDate: '2027-03-17', shortDate: '03/17 (三)', dateLabel: '3月17日 週三', sunset: '18:37' },
      { isoDate: '2027-03-18', shortDate: '03/18 (四)', dateLabel: '3月18日 週四', sunset: '18:06 (台北)' },
    ],
  },
];

// 2 位帶隊教練 + 7 位團員（共 9 位，依隱私以編號編排）
const MEMBERS: Member[] = [
  {
    id: 'coach1',
    name: '潘潘',
    role: '帶隊教練 · LINE: 潘ᶜʸ',
    emoji: '🐋',
    color: '#0369a1',
    height: 92,
    hasCrown: true,
    quotes: [
      '出海見證人品，大翅鯨快出來！',
      '集合與出海時間請隨時留意 LINE 群組！',
      '下水安靜輕輕踢，不要追逐鯨魚喔！',
      '防風外套跟毛巾衣一定要帶上船！',
    ],
  },
  {
    id: 'coach2',
    name: '家輝',
    role: '帶隊教練 · LINE: 輝',
    emoji: '🧭',
    color: '#0c4a6e',
    height: 90,
    hasCrown: true,
    quotes: [
      '出海前 1 小時記得先吃暈船藥！',
      '有任何狀況隨時在 LINE 群組敲教練！',
      '3 月水溫 21–22 度，保暖裝備要帶齊！',
      '大家安全第一，開心享受慶良間藍！',
    ],
  },
  {
    id: 'member1',
    name: '團員 1',
    role: '潛伴',
    emoji: '🤿',
    color: '#0f766e',
    height: 86,
    hasCrown: false,
    quotes: [
      '5mm 防寒衣跟蛙鞋都收好了！',
      '出海完回飯店泡大浴場超期待～',
      'Visit Japan Web QR Code 截圖完成！',
    ],
  },
  {
    id: 'member2',
    name: '團員 2',
    role: '潛伴',
    emoji: '📸',
    color: '#7c3aed',
    height: 85,
    hasCrown: false,
    quotes: [
      '運動相機電池充飽、記憶卡清空！',
      '記得水下拍鯨魚要關閉閃光燈喔！',
      '希望可以拍到母子鯨共游！',
    ],
  },
  {
    id: 'member3',
    name: '團員 3',
    role: '潛伴',
    emoji: '🌊',
    color: '#c2410c',
    height: 87,
    hasCrown: false,
    quotes: [
      '傑克牛排跟琉球の牛我準備好了！',
      '飯店就在縣廳前站旁，逛國際通超近！',
      '日幣換好準備去唐吉訶德掃貨～',
    ],
  },
  {
    id: 'member4',
    name: '團員 4',
    role: '潛伴',
    emoji: '🐠',
    color: '#be185d',
    height: 84,
    hasCrown: false,
    quotes: [
      '白兔牌暈船藥先買起來放口袋！',
      '豬肉蛋飯糰當出海早餐最讚了！',
      '祈禱這趟風平浪靜、鯨況大爆發！',
    ],
  },
  {
    id: 'member5',
    name: '團員 5',
    role: '潛伴',
    emoji: '⚓',
    color: '#047857',
    height: 88,
    hasCrown: false,
    quotes: [
      '面鏡、呼吸管、配重帶再檢查一次！',
      '毛巾衣跟厚防風外套必備！',
      '晚上去吃阿古豬涮涮鍋補體力～',
    ],
  },
  {
    id: 'member6',
    name: '團員 6',
    role: '潛伴',
    emoji: '🌺',
    color: '#b45309',
    height: 85,
    hasCrown: false,
    quotes: [
      'eSIM 開通好，LINE 群組通知已打開！',
      '牧志市場海葡萄跟紅芋塔必買！',
      'Almont 飯店早餐聽說超好吃！',
    ],
  },
  {
    id: 'member7',
    name: '團員 7',
    role: '潛伴',
    emoji: '🐢',
    color: '#4f46e5',
    height: 86,
    hasCrown: false,
    quotes: [
      '第一次去沖繩追大翅鯨好興奮！',
      '回台灣不能帶豬肉製品跟水果喔！',
      '大家一起人品大爆發吧！',
    ],
  },
];

const BASE_TRIP_DAYS: BaseTripDay[] = [
  {
    day: 1,
    badge: '出發集合日',
    title: '飛往沖繩那霸 · 入住縣廳前',
    route: '台灣 (TPE) → 那霸機場 (OKA) → 單軌縣廳前站 → Almont Hotel',
    theme: '#0369a1',
    hotelShort: 'Almont 那霸縣廳前',
    weather: '🌤️ 17–22°C · 早晚微涼帶防風外套',
    regionGroup: '那霸市區 · 宿 Almont Hotel 那霸縣廳前 (3 晚)',
    highlights: ['抵達那霸＆簡易動線', '教練協助入住', '自由活動＆美食', '買明日早／午餐'],
    timeline: [
      { time: '抵達', text: '飛抵那霸機場國際線 1F，出示 Visit Japan Web QR Code 入境領行李', tag: '時差 +1hr' },
      { time: '搭車', text: '【機場→飯店動線】搭手扶梯上 2F 連通道往國內線方向 → 依指標走天橋至單軌「那霸機場站」→ 搭至「縣廳前站」（約 13 分鐘）→ 出站步行約 3 分鐘即達飯店', tag: '單軌 13 分' },
      { time: '入住', text: '抵達「Almont Hotel 那霸縣廳前」，由帶隊教練協助辦理 Check-in 入住', tag: '教練協助入住' },
      { time: '自由', text: '自由活動與自由覓食（每趟餐食皆為自由選擇），記得順便購買明日出海用的「早餐及簡易午餐」', tag: '買明日早／午餐' },
      { time: '睡前', text: '飯店 12F 大浴場泡湯放鬆，整理明日出海裝備與附杯蓋保溫瓶', tag: '整理裝備' },
    ],
    tips: [
      '【那霸機場搭車簡易動線】國際線入境大廳(1F) → 上 2F 連通道走向國內線 → 依「Yui Rail 單軌電車」指標走天橋到「那霸機場站」購票（可刷西瓜卡/信用卡）→ 搭到「縣廳前站」出站步行 3 分鐘即達飯店（若多人搭計程車約 10–15 分鐘）。',
      '自由活動期間請務必先買好明日的「早餐及簡易午餐」（飯店對面 RYUBO 百貨 B1 或附近 7-11／全家／Lawson 皆可採買）。',
      '本行程僅限使用「一般蛙鞋」（不可使用長蛙鞋）；帶上船的保溫瓶建議選「附杯子款式」，避免船隻搖晃喝熱水燙到。',
    ],
  },
  {
    day: 2,
    badge: '大翅鯨 Day 1',
    title: '06:10 集合出海 · 慶良間海域尋鯨',
    route: '06:10 飯店集合 → 碼頭出發 → 外海尋找大翅鯨 → 15:00 返港',
    theme: '#0c4a6e',
    hotelShort: 'Almont 那霸縣廳前',
    weather: '🌊 水溫 21–22°C · 船上海風偏冷',
    regionGroup: '那霸市區 · 宿 Almont Hotel 那霸縣廳前 (3 晚)',
    highlights: ['06:10 準時集合', '大翅鯨共游', '自備簡易午餐', '自由活動＆買明日餐'],
    timeline: [
      { time: '06:10', text: '飯店集合出發前往碼頭（請先吃完早餐、吃暈船藥，並先換好泳裝！）', tag: '06:10 集合' },
      { time: '08:00', text: '預計 08:00 出發（也可能 09:00 出發），出海見證人品、尋找大翅鯨！', tag: '出海追鯨' },
      { time: '12:00', text: '船上享用自備簡易午餐，喝熱飲保暖（保溫瓶建議使用附杯子款式）', tag: '船上午餐' },
      { time: '15:00', text: '預計 15:00 抵達港口（依當天海況與鯨況調整），返抵飯店清洗裝備與泡大浴場', tag: '依海況調整' },
      { time: '傍晚', text: '自由活動與自由覓食（每趟餐食皆為自由選擇），記得購買明日出海用的「早餐及簡易午餐」', tag: '買明日早／午餐' },
    ],
    tips: [
      '出發前請先換好泳裝（外面穿毛巾衣、一般衣服都可以；穿毛巾衣的團員可多帶一套乾衣服，上岸擦乾後可更換）。',
      '帶上船的保溫瓶建議選擇「附有杯子」的款式，倒在杯子裡喝比較安全，避免船隻搖晃直接就口燙傷。',
      '本行程僅限穿「一般蛙鞋」（不可穿長蛙鞋）；3 月水溫約 21–22°C，建議備妥 5mm 防寒衣、頭套背心與船潛／防風外套。',
      '與大翅鯨共游守則：嚴禁觸摸或追逐、聽從教練指示安靜入水、水下攝影請關閉閃光燈。',
    ],
  },
  {
    day: 3,
    badge: '大翅鯨 Day 2',
    title: '06:10 二度出海追鯨 · 國際通採買',
    route: '06:10 飯店集合 → 碼頭出海尋鯨 → 15:00 返港 → 國際通採買',
    theme: '#0f766e',
    hotelShort: 'Almont 那霸縣廳前',
    weather: '🌊 水溫 21–22°C · 注意防風防曬',
    regionGroup: '那霸市區 · 宿 Almont Hotel 那霸縣廳前 (3 晚)',
    highlights: ['06:10 準時集合', '第二日出海追鯨', '裝備沖洗晾乾', '唐吉訶德 / 市場掃貨'],
    timeline: [
      { time: '06:10', text: '飯店集合前往碼頭（先吃早餐、吃暈船藥、換好泳裝，並確認相機電量）', tag: '06:10 集合' },
      { time: '08:00', text: '預計 08:00（或 09:00）出海，第二回合尋找大翅鯨與水下共游！', tag: '出海追鯨' },
      { time: '12:00', text: '船上享用自備簡易午餐與熱飲保暖，持續搜尋鯨魚蹤跡', tag: '船上午餐' },
      { time: '15:00', text: '預計 15:00 返回港口，回飯店徹底淡水沖洗並晾乾潛水裝備', tag: '晾乾裝備' },
      { time: '18:00', text: '自由活動、自由覓食與最後採買（每趟餐食皆為自由選擇）：唐吉訶德、MaxValu、平和通買伴手禮', tag: '自由活動' },
    ],
    tips: [
      '與昨日相同：出發前先換好泳裝（穿毛巾衣可帶一套乾衣服上岸換）、保溫瓶建議帶附杯子款式防搖晃燙傷。',
      '今天下午回飯店後盡早把防寒衣、一般蛙鞋、毛巾衣沖洗脫水晾乾，明天才好打包進託運行李。',
      '免稅購物滿 ¥5,000（未稅）記得帶護照正本；回台灣嚴禁攜帶任何含肉製品（阿古豬肉乾、未吃完的豬肉蛋飯糰等）與新鮮水果！',
    ],
  },
  {
    day: 4,
    badge: '悠閒返程日',
    title: '睡飽吃飯店早餐 · 自由活動返台',
    route: 'Almont Hotel 早餐退房 → 國際通 / 機場逛街 → 返回台灣',
    theme: '#475569',
    hotelShort: '溫暖的家',
    weather: '✈️ 沖繩微暖 → 台灣早晚偏涼',
    regionGroup: '返程 · 滿載鯨魚回憶回家',
    highlights: ['飯店豐盛沖繩早餐', '悠閒 Check-out', '最後伴手禮採買', '搭機返台'],
    timeline: [
      { time: '08:30', text: '睡到自然醒！享用 Almont Hotel 超高評價的沖繩特色自助早餐', tag: '必吃早餐' },
      { time: '10:30', text: '整理行李與潛水裝備，辦理飯店 Check-out（行李可暫寄櫃台）', tag: 'Check-out' },
      { time: '自由', text: '那霸市區自由活動與自由覓食（推薦補吃豬肉蛋飯糰、一蘭拉麵、沖繩麵或去波上宮走走）', tag: '自由活動' },
      { time: '返程', text: '搭單軌電車（縣廳前站 → 那霸機場站約 13 分鐘）前往機場搭機返台', tag: '單軌 13 分' },
    ],
    tips: [
      'Almont Hotel 早餐非常有名（有沖繩麵、海葡萄、紅芋甜點等），退房日一定要留時間好好吃！',
      '一般蛙鞋、配重帶與潛水裝備請確認航空公司託運行李尺寸與重量規定；鋰電池與行動電源務必手提上機。',
      '那霸機場國內線航廈的伴手禮店比國際線豐富很多，有時間可先去國內線 2F 逛完再走去國際線報到。',
    ],
  },
];

function buildTripDays(group: TripGroup): TripDay[] {
  return BASE_TRIP_DAYS.map((base, idx) => ({
    ...base,
    ...group.daysMeta[idx],
  }));
}

// 沖繩那霸精選餐廳
const OKINAWA_RESTAURANTS = [
  {
    id: 'jacks-steak',
    zh: "傑克牛排館 (Jack's Steak House)",
    en: 'Jacks Steak House Naha',
    price: '¥2,000 – ¥3,800',
    walk: '飯店步行 7 分鐘',
    tag: '老牌美式牛排',
    desc: '1953 年創立的那霸必吃傳奇牛排館！出海追鯨耗體力後，點一客超嫩的菲力牛排（Tenderloin）補蛋白質最過癮。',
    query: 'Jacks Steak House Naha Okinawa',
  },
  {
    id: 'ryukyu-no-ushi',
    zh: '琉球の牛 那霸國際通店',
    en: 'Ryukyu no Ushi Naha Kokusai-dori',
    price: '¥6,000 – ¥10,000',
    walk: '飯店步行 7 分鐘',
    tag: '頂級和牛燒肉',
    desc: '沖繩人氣第一的縣產頂級和牛燒肉！油花入口即化，自由覓食聚餐首選（強烈建議出發前先線上預約）。',
    query: 'Ryukyu no Ushi Naha Kokusai-dori',
  },
  {
    id: 'ichiran-ramen',
    zh: '一蘭拉麵 那霸國際通店',
    en: 'ICHIRAN Naha Kokusai-dori',
    price: '¥1,000 – ¥1,600',
    walk: '飯店步行 10 分鐘',
    tag: '經典豚骨拉麵',
    desc: '人氣天然豚骨拉麵！可依個人喜好客製湯頭濃度、秘製辣醬與麵條硬度，自由活動時段想吃隨時可去。',
    query: 'ICHIRAN Naha Kokusai-dori',
  },
  {
    id: 'agu-matsumoto',
    zh: '阿古豬涮涮鍋 まつもと (松山店)',
    en: 'Shabu Shabu Matsumoto Matsuyama',
    price: '¥5,500 – ¥7,500',
    walk: '飯店步行 6 分鐘',
    tag: '必吃阿古豬',
    desc: '那霸最難訂的頂級沖繩阿古豬涮涮鍋！肉片清甜毫無腥味，最後的雜炊更是靈魂（務必提前預約）。',
    query: 'Agu Shabu Shabu Matsumoto Naha',
  },
  {
    id: 'oniku-no-isshin',
    zh: 'お肉の一心 (Oniku no Isshin)',
    en: 'Oniku no Isshin Naha Kumoji',
    price: '¥3,800 – ¥7,800',
    walk: '飯店步行 2 分鐘',
    tag: '桌邊壽喜燒・涮涮鍋',
    desc: '1985 年創立老字號！主打黑毛和牛與熟成阿古豬，專人桌邊現煮超享受。週三公休（週一 18:00 起、其餘 14:00 起），建議透過官網 TableCheck 線上預約。',
    query: 'Oniku no Isshin Kumoji Naha',
  },
  {
    id: 'pork-tamago',
    zh: '豬肉蛋飯糰 牧志市場本店',
    en: 'Pork Tamago Onigiri Makishi',
    price: '¥450 – ¥900',
    walk: '飯店步行 11 分鐘',
    tag: '沖繩靈魂早餐',
    desc: '現做熱騰騰的炸蝦、苦瓜天婦羅、島豆腐厚蛋配午餐肉飯糰！那霸機場 1F 也有分店可以外帶。',
    query: 'Pork Tamago Onigiri Makishi Market',
  },
  {
    id: 'danbo-ramen',
    zh: '暖暮拉麵 那霸牧志店',
    en: 'Ramen Danbo Naha Makishi',
    price: '¥900 – ¥1,400',
    walk: '飯店步行 11 分鐘',
    tag: '九州人氣拉麵',
    desc: '國際通排隊名店，濃厚豚骨湯頭配烈火拉麵與煎餃，晚上泡完湯肚子餓來一碗超滿足。',
    query: 'Ramen Danbo Naha Makishi',
  },
  {
    id: 'soba-doraemon',
    zh: '沖繩麵 どらえもん (國際通)',
    en: 'Okinawa Soba Doraemon Kokusai-dori',
    price: '¥850 – ¥1,300',
    walk: '飯店步行 6 分鐘',
    tag: '在地沖繩麵',
    desc: '國際通二樓的人氣在地沖繩麵，軟骨排骨燉到入口即化，平價又道地。',
    query: 'Okinawa Soba Doraemon Naha',
  },
];

// 沖繩那霸飯店周邊超市・藥妝・採買
const OKINAWA_MARKETS = [
  {
    id: 'ryubo-b1',
    zh: 'RYUBO 琉貿百貨 B1 超市',
    en: 'Palette Kumoji RYUBO Department Store',
    hours: '10:00 – 21:00',
    walk: '飯店對面步行 1 分鐘',
    tag: '最近超市',
    desc: '過個馬路就到！生鮮水果、熟食便當、沖繩限定零食飲料與百貨專櫃伴手禮一應俱全。',
    query: 'RYUBO Department Store Naha',
  },
  {
    id: 'combini-kumoji',
    zh: '7-11 / 全家 / Lawson（久茂地周邊）',
    en: '7-Eleven / FamilyMart / Lawson Naha Kumoji',
    hours: '24 小時營業',
    walk: '飯店旁步行 1–3 分鐘',
    tag: '出海早餐補給',
    desc: '飯店周邊 7-11、全家與 Lawson 都有！Day 2–3 出海前買飯糰、三明治、麵包、熱咖啡與簡易午餐最方便。',
    query: '7-Eleven near Almont Hotel Naha Kenchomae',
  },
  {
    id: 'donki-kokusai',
    zh: '唐吉訶德 國際通店 (Don Quijote)',
    en: 'MEGA Don Quijote Kokusai-dori',
    hours: '09:00 – 03:00',
    walk: '飯店步行 9 分鐘',
    tag: '深夜免稅掃貨',
    desc: '開到凌晨 3 點！藥妝、零食、防曬、防水袋或突然缺的旅遊小物通通買得到，滿額可退稅。',
    query: 'Don Quijote Kokusai-dori Naha',
  },
  {
    id: 'maxvalu-makishi',
    zh: 'AEON MaxValu 牧志店',
    en: 'MaxValu Makishi 24H Supermarket',
    hours: '24 小時營業',
    walk: '單軌牧志站旁 / 步行 15 分',
    tag: '24H 大型超市',
    desc: '那霸市區最受歡迎的 24 小時大型超市！沖繩限定飲料、生魚片、熟食與平價零食價格超實惠。',
    query: 'MaxValu Makishi Naha',
  },
  {
    id: 'makishi-market',
    zh: '第一牧志公設市場 & 平和通',
    en: 'First Makishi Public Market Naha',
    hours: '08:00 – 20:00',
    walk: '飯店步行 11 分鐘',
    tag: '在地市場伴手禮',
    desc: '買海葡萄、雪鹽、紅芋塔、島辣椒泡盛，還能 1F 挑海鮮 2F 代客料理。',
    query: 'First Makishi Public Market Naha',
  },
  {
    id: 'daikoku-kokusai',
    zh: '大國藥妝 國際通入口店',
    en: 'Daikoku Drug Kokusai-dori',
    hours: '10:00 – 22:30',
    walk: '飯店步行 4 分鐘',
    tag: '藥妝 & 暈船藥',
    desc: '距離飯店超近！補貨日本白兔牌暈船藥（Aneron）、海洋友善防曬、休足時間與眼藥水首選。',
    query: 'Daikoku Drug Kokusai-dori Naha',
  },
];

// 地圖標記點（涵蓋住宿、機場、出海港口、賞鯨海域、那霸美食與超市）
const PLACES: Place[] = [
  {
    id: 'almont',
    zh: 'Almont Hotel 那霸縣廳前',
    en: 'Almont Hotel Naha Kenchomae',
    region: '那霸久茂地',
    category: '飯店',
    days: 'D1–D4 (3晚)',
    dayNums: [1, 2, 3, 4],
    coords: [127.6795, 26.2145],
    isHotel: true,
    hotelBadge: '1·2·3',
    phone: '+81 98-866-3811',
    desc: '單軌「縣廳前站」步行 3 分鐘、國際通入口旁，附設 12F 準天然光明石大浴場與高評價沖繩早餐！',
    query: 'Almont Hotel Naha Kenchomae',
  },
  {
    id: 'oka-airport',
    zh: '那霸國際機場 (OKA)',
    en: 'Naha Airport',
    region: '那霸西側',
    category: '交通',
    days: 'D1 / D4',
    dayNums: [1, 4],
    coords: [127.6465, 26.2048],
    desc: '搭沖繩單軌電車（Yui Rail）至「縣廳前站」僅需約 13 分鐘，計程車約 10–15 分鐘。',
    query: 'Naha Airport Okinawa',
  },
  {
    id: 'miegusuku-port',
    zh: '三重城港 (那霸賞鯨出海碼頭)',
    en: 'Naha Miegusuku Port',
    region: '那霸港區',
    category: '碼頭',
    days: 'D2 / D3',
    dayNums: [2, 3],
    coords: [127.6669, 26.2133],
    desc: '那霸地區最主要的賞鯨／大翅鯨共游出海港口（實際登船碼頭依教練行前通知為準）。',
    query: 'Miegusuku Port Naha Okinawa',
  },
  {
    id: 'kerama-whales',
    zh: '慶良間諸島外海 (大翅鯨海域)',
    en: 'Kerama Islands Whale Swim Area',
    region: '慶良間海域',
    category: '追鯨',
    days: 'D2 / D3',
    dayNums: [2, 3],
    coords: [127.415, 26.195],
    desc: '每年 1–3 月大翅鯨洄游繁殖的經典海域，透明的「慶良間藍」海水與震撼鯨影！',
    query: 'Kerama Islands Okinawa',
  },
  {
    id: 'kokusai-dori',
    zh: '那霸國際通商店街',
    en: 'Kokusai-dori Street Naha',
    region: '那霸市中心',
    category: '逛街',
    days: 'D1 / D3 / D4',
    dayNums: [1, 3, 4],
    coords: [127.6845, 26.2153],
    desc: '距離飯店步行 2 分鐘即達入口，集結沖繩伴手禮、藥妝、Blue Seal 冰淇淋與各式居酒屋。',
    query: 'Kokusai-dori Naha Okinawa',
  },
  {
    id: 'jacks-steak',
    zh: '傑克牛排館',
    en: 'Jacks Steak House Naha',
    region: '那霸西町',
    category: '美食',
    days: '推薦美食',
    dayNums: [1, 2, 3],
    coords: [127.6736, 26.2139],
    desc: '飯店步行 7 分鐘！那霸最經典老牌美式牛排館，出海追鯨完補蛋白質首選。',
    query: 'Jacks Steak House Naha',
  },
  {
    id: 'ryukyu-no-ushi',
    zh: '琉球の牛 國際通店',
    en: 'Ryukyu no Ushi Naha',
    region: '國際通',
    category: '美食',
    days: '推薦美食',
    dayNums: [1, 2, 3],
    coords: [127.6848, 26.2162],
    desc: '沖繩超人氣縣產頂級和牛燒肉，建議出發前先線上預約座位。',
    query: 'Ryukyu no Ushi Naha Kokusai-dori',
  },
  {
    id: 'ichiran-ramen',
    zh: '一蘭拉麵 那霸國際通店',
    en: 'ICHIRAN Naha Kokusai-dori',
    region: '國際通',
    category: '美食',
    days: '推薦美食',
    dayNums: [1, 2, 3, 4],
    coords: [127.6865, 26.2156],
    desc: '飯店步行約 10 分鐘！人氣天然豚骨拉麵，自由覓食好選擇。',
    query: 'ICHIRAN Naha Kokusai-dori',
  },
  {
    id: 'agu-matsumoto',
    zh: '阿古豬涮涮鍋 まつもと',
    en: 'Agu Shabu Shabu Matsumoto',
    region: '那霸松山',
    category: '美食',
    days: '推薦美食',
    dayNums: [1, 2, 3],
    coords: [127.6762, 26.2178],
    desc: '飯店步行 6 分鐘，那霸超人氣頂級沖繩阿古豬涮涮鍋（需預約）。',
    query: 'Agu Shabu Shabu Matsumoto Naha',
  },
  {
    id: 'oniku-no-isshin',
    zh: 'お肉の一心 (Oniku no Isshin)',
    en: 'Oniku no Isshin Naha Kumoji',
    region: '那霸久茂地',
    category: '美食',
    days: '推薦美食',
    dayNums: [1, 2, 3, 4],
    coords: [127.6778, 26.2134],
    desc: '飯店步行 2 分鐘！1985 年老字號桌邊壽喜燒與涮涮鍋（黑毛和牛／熟成阿古豬），週三公休、建議線上預約。',
    query: 'Oniku no Isshin Kumoji Naha',
  },
  {
    id: 'ryubo-b1',
    zh: 'RYUBO 琉貿百貨 B1 超市',
    en: 'RYUBO Department Store',
    region: '縣廳前',
    category: '超市',
    days: '推薦超市',
    dayNums: [1, 2, 3, 4],
    coords: [127.6788, 26.2142],
    desc: '就在飯店正對面！步行 1 分鐘買水果、飲料、熟食與伴手禮。',
    query: 'RYUBO Department Store Naha',
  },
  {
    id: 'donki-kokusai',
    zh: '唐吉訶德 國際通店',
    en: 'Don Quijote Kokusai-dori',
    region: '國際通',
    category: '超市',
    days: '推薦超市',
    dayNums: [1, 3],
    coords: [127.6869, 26.2152],
    desc: '營業至凌晨 3 點，藥妝、零食、防曬與旅遊小物免稅一次買齊。',
    query: 'Don Quijote Kokusai-dori Naha',
  },
  {
    id: 'makishi-market',
    zh: '第一牧志公設市場 & 豬肉蛋飯糰',
    en: 'First Makishi Public Market',
    region: '牧志市場',
    category: '超市',
    days: '推薦超市',
    dayNums: [1, 3, 4],
    coords: [127.6885, 26.2141],
    desc: '沖繩那霸廚房！必吃豬肉蛋飯糰本店，並可採買海葡萄、雪鹽、紅芋塔。',
    query: 'First Makishi Public Market Naha',
  },
  {
    id: 'maxvalu-makishi',
    zh: 'AEON MaxValu 牧志店 (24H)',
    en: 'MaxValu Makishi Supermarket',
    region: '牧志站',
    category: '超市',
    days: '推薦超市',
    dayNums: [1, 2, 3],
    coords: [127.6929, 26.2175],
    desc: '24 小時營業大型生鮮超市，半夜也能採買宵夜與沖繩限定飲品。',
    query: 'MaxValu Makishi Naha',
  },
];

const DAY_ROUTES: { day: number; color: string; coords: [number, number][] }[] = [
  {
    day: 1,
    color: '#0369a1',
    coords: [
      [127.6465, 26.2048],
      [127.6795, 26.2145],
      [127.6845, 26.2153],
    ],
  },
  {
    day: 2,
    color: '#0c4a6e',
    coords: [
      [127.6795, 26.2145],
      [127.6669, 26.2133],
      [127.415, 26.195],
      [127.6669, 26.2133],
      [127.6795, 26.2145],
    ],
  },
  {
    day: 3,
    color: '#0f766e',
    coords: [
      [127.6795, 26.2145],
      [127.6669, 26.2133],
      [127.415, 26.195],
      [127.6669, 26.2133],
      [127.6869, 26.2152],
      [127.6795, 26.2145],
    ],
  },
  {
    day: 4,
    color: '#475569',
    coords: [
      [127.6795, 26.2145],
      [127.6885, 26.2141],
      [127.6465, 26.2048],
    ],
  },
];

const CHECKLIST_CATEGORIES = [
  '潛水與追鯨裝備',
  '證件與錢財',
  '衣物與防曬',
  '盥洗與化妝',
  '3C 與雜物',
  '自訂項目',
];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  // 潛水與追鯨裝備
  { id: 'dive-1', cat: '潛水與追鯨裝備', text: '面鏡、呼吸管（下水追鯨必備）' },
  { id: 'dive-2', cat: '潛水與追鯨裝備', text: '防寒衣（3 月水溫 21–22°C，建議 5mm 或加頭套背心）' },
  { id: 'dive-3', cat: '潛水與追鯨裝備', text: '一般蛙鞋（本行程僅限一般蛙鞋，不可穿長蛙鞋）、襪套、配重帶' },
  { id: 'dive-4', cat: '潛水與追鯨裝備', text: '毛巾衣、防風外套／有點厚度的雨衣（船上穿防風保暖）' },
  { id: 'dive-5', cat: '潛水與追鯨裝備', text: '泳裝、一套上岸換穿的乾衣物、防水包（裝手機與乾衣物）' },
  { id: 'dive-6', cat: '潛水與追鯨裝備', text: '保溫瓶（建議附杯子款式，船上搖晃倒杯喝較安全防燙）' },
  { id: 'dive-7', cat: '潛水與追鯨裝備', text: '暈船藥（外海追鯨浪大必備，出海前先吃）' },
  // 證件與錢財
  { id: 'doc-1', cat: '證件與錢財', text: '護照正本（免簽 90 天，確認效期）＋ 機票資訊' },
  { id: 'doc-2', cat: '證件與錢財', text: 'Visit Japan Web 登錄完成並截圖 QR Code' },
  { id: 'doc-3', cat: '證件與錢財', text: '日幣現金、台幣現金、海外回饋信用卡（確認已開通）' },
  // 衣物與防曬
  { id: 'cloth-1', cat: '衣物與防曬', text: '外出衣物、內衣褲、睡衣、襪子、防曬衣物' },
  { id: 'cloth-2', cat: '衣物與防曬', text: '休閒鞋、拖鞋、飾品、遮陽帽、眼鏡／墨鏡' },
  { id: 'cloth-3', cat: '衣物與防曬', text: '海洋友善防曬乳、護手霜、護唇膏' },
  // 盥洗與化妝
  { id: 'bath-1', cat: '盥洗與化妝', text: '牙刷牙膏、洗面乳、棉花棒、衛生紙／濕紙巾' },
  { id: 'bath-2', cat: '盥洗與化妝', text: '保養品、化妝品、卸妝用品、面膜、刮鬍／女性衛生用品' },
  { id: 'bath-3', cat: '盥洗與化妝', text: '隱形眼鏡、藥水、眼鏡盒' },
  // 3C 與雜物
  { id: 'tech-1', cat: '3C 與雜物', text: '手機、充電器、行動電源（限手提上機）、日本 eSIM / 網卡' },
  { id: 'tech-2', cat: '3C 與雜物', text: '運動相機／水下相機（充飽電、清記憶卡、檢查防水殼）' },
  { id: 'tech-3', cat: '3C 與雜物', text: '背包／登機箱、錢包、水瓶、收納袋、髒衣袋' },
  { id: 'tech-4', cat: '3C 與雜物', text: '個人常備藥、保健食品、家用鑰匙／行李箱鑰匙' },
];

const RENTAL_ITEMS = [
  { name: '5mm 防寒衣', price: '¥1,000' },
  { name: '船潛外套', price: '¥500' },
  { name: '頭套背心', price: '¥500' },
  { name: '蛙鞋（套腳蛙）', price: '¥500' },
];

// ============================================================================
// 2. 工具函式
// ============================================================================

function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTripStatus(todayStr: string, tripDays: TripDay[], groupLabel: string) {
  const startIso = tripDays[0].isoDate;
  const endIso = tripDays[tripDays.length - 1].isoDate;

  const toUtcMs = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };

  const todayMs = toUtcMs(todayStr);
  const startMs = toUtcMs(startIso);
  const endMs = toUtcMs(endIso);

  if (todayMs < startMs) {
    const diffDays = Math.round((startMs - todayMs) / 86400000);
    return {
      phase: 'before' as const,
      defaultDayIdx: 0,
      banner: `距離【${groupLabel}】沖繩大翅鯨出發還有 ${diffDays} 天！裝備與人品準備好了嗎 🐋`,
    };
  }
  if (todayMs > endMs) {
    return {
      phase: 'after' as const,
      defaultDayIdx: tripDays.length - 1,
      banner: `【${groupLabel}】沖繩大翅鯨之旅圓滿結束，感謝大海與每一位潛伴 🌊`,
    };
  }
  const idx = Math.max(
    0,
    Math.min(tripDays.length - 1, Math.round((todayMs - startMs) / 86400000))
  );
  return {
    phase: 'during' as const,
    defaultDayIdx: idx,
    banner: `【${groupLabel}】Day ${idx + 1} 進行中 · 祝今天風平浪靜、大翅鯨爆棚 🐋`,
  };
}

function formatNumber(num: number, decimals = 0): string {
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function sanitizeDecimalInput(val: string): string {
  const stripped = val.replace(/[^\d.]/g, '');
  const parts = stripped.split('.');
  if (parts.length <= 1) return stripped;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

// ============================================================================
// 3. 潛伴散步互動舞台 (CrewPlayground)
// ============================================================================

interface CrewPlaygroundProps {
  activeMemberId: string;
  onSelectMember?: (id: string) => void;
  avatars?: Record<string, string>;
  onOpenAvatarCrop?: (member: Member) => void;
}

function CrewPlayground({
  activeMemberId,
  onSelectMember,
  avatars = {},
  onOpenAvatarCrop,
}: CrewPlaygroundProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const figRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [speech, setSpeech] = useState<{
    id: string;
    name: string;
    text: string;
    x: number;
  } | null>(null);

  const actorsRef = useRef(
    MEMBERS.map((m, idx) => ({
      id: m.id,
      x: 16 + idx * 35,
      dir: idx % 2 === 0 ? 1 : -1,
      speed: 18 + (idx % 4) * 5,
      walking: true,
      timer: 1.8 + (idx % 3) * 0.9,
      jumpY: 0,
      jumpVel: 0,
    }))
  );

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const stageW = stageRef.current?.clientWidth || 360;
      const minX = 14;
      const maxX = Math.max(minX + 40, stageW - 58);

      actorsRef.current.forEach((a) => {
        a.timer -= dt;
        if (a.timer <= 0) {
          a.walking = !a.walking;
          a.timer = a.walking ? 2.5 + Math.random() * 3.2 : 1.1 + Math.random() * 1.8;
          if (a.walking && Math.random() < 0.45) {
            a.dir *= -1;
          }
        }

        if (a.walking) {
          a.x += a.dir * a.speed * dt;
          if (a.x <= minX) {
            a.x = minX;
            a.dir = 1;
          } else if (a.x >= maxX) {
            a.x = maxX;
            a.dir = -1;
          }
        }

        if (a.jumpY < 0 || a.jumpVel !== 0) {
          a.jumpY += a.jumpVel * dt;
          a.jumpVel += 680 * dt;
          if (a.jumpY >= 0) {
            a.jumpY = 0;
            a.jumpVel = 0;
          }
        }

        const el = figRefs.current[a.id];
        if (el) {
          el.dataset.motion = a.walking ? 'walk' : 'stand';
          el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.jumpY.toFixed(
            1
          )}px) scaleX(${a.dir})`;
        }
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleTapMember = (member: Member) => {
    const actor = actorsRef.current.find((a) => a.id === member.id);
    if (actor) {
      actor.jumpVel = -220;
      actor.walking = false;
      actor.timer = 2.0;
    }
    const quote = member.quotes[Math.floor(Math.random() * member.quotes.length)];
    const stageW = stageRef.current?.clientWidth || 360;
    const rawX = (actor?.x ?? 120) + 22;
    const clampedX = Math.max(84, Math.min(stageW - 84, rawX));

    setSpeech({ id: member.id, name: member.name, text: quote, x: clampedX });
    onSelectMember?.(member.id);
  };

  useEffect(() => {
    if (!speech) return;
    const t = setTimeout(() => setSpeech(null), 2600);
    return () => clearTimeout(t);
  }, [speech]);

  const activeMemberObj =
    MEMBERS.find((m) => m.id === activeMemberId) || MEMBERS[0];

  return (
    <div
      ref={stageRef}
      className="relative h-[178px] w-full overflow-hidden rounded-3xl border border-[#dbeafe] bg-gradient-to-b from-[#e0f2fe] via-[#f0f9ff] to-[#f4efe4]"
    >
      <div className="pointer-events-none absolute top-3.5 left-4 text-[22px] opacity-80">
        🐋
      </div>
      {onOpenAvatarCrop && (
        <button
          type="button"
          onClick={() => onOpenAvatarCrop(activeMemberObj)}
          className="absolute top-3.5 right-3 z-20 flex items-center gap-1 rounded-full border border-[#bae6fd] bg-white/95 px-2.5 py-1 text-[11.5px] font-extrabold text-[#0369a1] shadow-xs backdrop-blur transition active:scale-95"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>換頭像</span>
        </button>
      )}

      {/* 互動對話氣泡 */}
      {speech && (
        <div
          key={`${speech.id}-${speech.text}`}
          style={{
            left: `${speech.x}px`,
            animation: 'bubblePop 180ms ease-out forwards',
          }}
          className="pointer-events-none absolute top-10 z-30 max-w-[220px] -translate-x-1/2 rounded-2xl border border-[#bae6fd] bg-white px-3 py-1.5 text-center text-[12.5px] font-bold text-[#0f293a] shadow-md"
        >
          <span className="text-[#0369a1]">{speech.name}：</span>
          {speech.text}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-4 bottom-[18px] h-[2px] rounded-full bg-[#bae6fd]" />

      {MEMBERS.map((m) => {
        const isCurrent = m.id === activeMemberId;
        const bodyH = m.height - 32;
        const customAvatar = avatars[m.id];
        return (
          <button
            key={m.id}
            ref={(el) => {
              figRefs.current[m.id] = el;
            }}
            type="button"
            aria-label={m.name}
            onClick={() => handleTapMember(m)}
            data-motion="walk"
            className="crew-fig absolute bottom-[18px] left-0 flex w-[44px] flex-col items-center focus:outline-none"
            style={{ height: `${m.height}px`, willChange: 'transform' }}
          >
            {m.hasCrown && (
              <span
                className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 text-[15px] leading-none drop-shadow ${
                  customAvatar ? '-top-[19px]' : '-top-[14px]'
                }`}
              >
                👑
              </span>
            )}
            {customAvatar ? (
              <img
                src={customAvatar}
                alt={m.name}
                draggable={false}
                className={`relative z-10 -mt-1.5 h-[44px] w-[38px] shrink-0 object-contain drop-shadow-md ${
                  isCurrent ? 'scale-105' : ''
                }`}
              />
            ) : (
              <span
                className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[18px] text-white shadow-sm ${
                  isCurrent ? 'ring-2 ring-[#0c4a6e] ring-offset-1' : ''
                }`}
                style={{ backgroundColor: m.color }}
              >
                {m.emoji}
              </span>
            )}
            <svg
              viewBox="0 0 44 62"
              width="44"
              height={bodyH}
              className="pointer-events-none shrink-0"
              stroke={m.color}
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
              style={{ marginTop: '-5px' }}
            >
              <g className="crew-skeleton" style={{ transformOrigin: '22px 60px' }}>
                <path d="M22 0 Q20.5 15 22 29" />
                <path d="M17 8 Q22 6 27 8" />
                <path d="M18 29 Q22 27.5 26 29" />
                <g className="arm-l" style={{ transformOrigin: '22px 8px' }}>
                  <path d="M22 8 L12 17" />
                  <path d="M12 17 L13 26" />
                </g>
                <g className="arm-r" style={{ transformOrigin: '22px 8px' }}>
                  <path d="M22 8 L32 17" />
                  <path d="M32 17 L31 26" />
                </g>
                <g className="leg-l" style={{ transformOrigin: '22px 29px' }}>
                  <path d="M22 29 L16 43" />
                  <path d="M16 43 L13 59 L8 60" />
                </g>
                <g className="leg-r" style={{ transformOrigin: '22px 29px' }}>
                  <path d="M22 29 L27 43" />
                  <path d="M27 43 L30 59 L36 60" />
                </g>
              </g>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// 4. 沖繩那霸 & 慶良間互動地圖 (OkinawaMapTab — MapLibre GL JS + OpenFreeMap + 3D 地形)
// ============================================================================

// 免 API Key 的公開向量底圖、衛星影像與高程地形圖資（參考 Ireland-trip 地圖架構）
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ESRI_SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const AWS_TERRARIUM_DEM =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

function getPinColor(place: Place): string {
  if (place.category === '追鯨') return '#0c4a6e';
  if (place.category === '美食') return '#c2410c';
  if (place.category === '超市' || place.category === '逛街') return '#0f766e';
  if (place.category === '碼頭') return '#0369a1';
  return '#475569';
}

function getPinLabel(place: Place): string {
  if (place.category === '追鯨') return '🐋';
  if (place.category === '美食') return '🍽️';
  if (place.category === '超市') return '🛒';
  if (place.category === '碼頭') return '⚓';
  if (place.category === '交通') return '✈️';
  return '📍';
}

function OkinawaMapTab() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<MLMarker[]>([]);
  const tourRunRef = useRef(0);
  const is3DRef = useRef(false);
  const lastTerrainRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<MapFilterId>('naha');
  const [isSatellite, setIsSatellite] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [isTouring, setIsTouring] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place>(PLACES[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    is3DRef.current = is3D;
  }, [is3D]);

  const visiblePlaces = useMemo(() => {
    if (selectedFilter === 'all') return PLACES;
    if (selectedFilter === 'naha') return PLACES.filter((p) => p.id !== 'kerama-whales');
    if (selectedFilter === 'food') {
      return PLACES.filter((p) => p.isHotel || p.category === '美食');
    }
    if (selectedFilter === 'shop') {
      return PLACES.filter((p) => p.isHotel || p.category === '超市' || p.category === '逛街');
    }
    return PLACES.filter((p) => p.dayNums.includes(selectedFilter));
  }, [selectedFilter]);

  const visibleRoutes = useMemo(() => {
    if (selectedFilter === 'all') return DAY_ROUTES;
    if (typeof selectedFilter === 'number') {
      return DAY_ROUTES.filter((r) => r.day === selectedFilter);
    }
    return [];
  }, [selectedFilter]);

  const stopTour = useCallback(() => {
    tourRunRef.current += 1;
    setIsTouring(false);
  }, []);

  const flyToPlace = useCallback((place: Place) => {
    const m = mapRef.current;
    if (!m) return;
    m.flyTo({
      center: place.coords,
      zoom: place.id === 'kerama-whales' ? 11.4 : 15.2,
      pitch: is3DRef.current ? 60 : 0,
      bearing: is3DRef.current ? m.getBearing() : 0,
      duration: 1400,
      essential: true,
    });
  }, []);

  const fitPlacesBounds = useCallback(
    (placesToFit: Place[], filterVal: MapFilterId = selectedFilter) => {
      const m = mapRef.current;
      if (!m || placesToFit.length === 0) return;

      const bounds = new maplibregl.LngLatBounds();
      placesToFit.forEach((p) => bounds.extend(p.coords));

      if (!bounds.isEmpty()) {
        const maxZoom =
          filterVal === 'food' || filterVal === 'shop'
            ? 15.2
            : filterVal === 'naha'
            ? 14.2
            : 12.6;
        m.fitBounds(bounds, {
          padding: { top: 64, bottom: 56, left: 56, right: 64 },
          maxZoom,
          duration: 700,
        });
      }
    },
    [selectedFilter]
  );

  // 初始化 MapLibre GL JS 地圖與免金鑰圖層（向量底圖 + Esri 衛星 + AWS DEM 3D 地形與山影 + 路線圖層）
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    maplibregl.setWorkerUrl(new URL(maplibreWorkerUrl, window.location.href).href);

    const m = new maplibregl.Map({
      container,
      style: OPENFREEMAP_STYLE,
      center: [127.6795, 26.2135],
      zoom: 13.4,
      pitch: 0,
      bearing: 0,
      maxPitch: 70,
      attributionControl: false,
    });

    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'OpenFreeMap · Esri · AWS Terrain',
      }),
      'bottom-right'
    );
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right'
    );
    m.addControl(
      new maplibregl.GeolocateControl({
        trackUserLocation: true,
        positionOptions: { enableHighAccuracy: true },
      }),
      'top-right'
    );

    m.on('load', () => {
      const firstSymbol = m
        .getStyle()
        .layers?.find((l: { type: string; id: string }) => l.type === 'symbol')?.id;

      // 衛星影像圖層（置於地名文字下方，確保路名與地標依然清晰）
      m.addSource('sat', {
        type: 'raster',
        tiles: [ESRI_SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 18,
      });
      m.addLayer(
        {
          id: 'sat',
          type: 'raster',
          source: 'sat',
          layout: { visibility: 'none' },
        },
        firstSymbol
      );

      // 依 MapLibre 建議將山影與 3D 地形使用獨立 raster-dem 來源
      const demSource = {
        type: 'raster-dem' as const,
        tiles: [AWS_TERRARIUM_DEM],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium' as const,
      };
      m.addSource('dem-shade', demSource);
      m.addSource('dem-3d', demSource);
      m.addLayer(
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'dem-shade',
          paint: {
            'hillshade-exaggeration': 0.35,
            'hillshade-shadow-color': '#2d3b36',
          },
        },
        firstSymbol
      );

      // 每日行程路線 GeoJSON 圖層（陸地實線 + 海上賞鯨虛線）
      m.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'routes-casing',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7.5,
          'line-opacity': 0.9,
        },
      });
      m.addLayer({
        id: 'routes-land',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'sea'], 0],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      });
      m.addLayer({
        id: 'routes-sea',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'sea'], 1],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4.5,
          'line-dasharray': [2, 1.8],
          'line-opacity': 0.95,
        },
      });

      // 預設折疊右下角版權資訊列為 (i) 按鈕
      const attrib = container.querySelector('.maplibregl-ctrl-attrib');
      attrib?.classList.remove('maplibregl-compact-show');
      attrib?.removeAttribute('open');

      setMapReady(true);
    });

    // 手動拖曳地圖時自動停止飛行導覽
    m.on('dragstart', () => {
      tourRunRef.current += 1;
      setIsTouring(false);
    });

    mapRef.current = m;
    const resizeObserver = new ResizeObserver(() => m.resize());
    resizeObserver.observe(container);

    return () => {
      tourRunRef.current += 1;
      resizeObserver.disconnect();
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      m.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 更新 GeoJSON 路線資料
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m) return;
    const src = m.getSource('routes') as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: visibleRoutes.map((route) => ({
        type: 'Feature',
        properties: {
          color: route.color,
          sea: route.day === 2 || route.day === 3 ? 1 : 0,
        },
        geometry: {
          type: 'LineString',
          coordinates: route.coords,
        },
      })),
    });
  }, [mapReady, visibleRoutes]);

  // 切換衛星影像
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m || !m.getLayer('sat')) return;
    m.setLayoutProperty('sat', 'visibility', isSatellite ? 'visible' : 'none');
  }, [mapReady, isSatellite]);

  // 切換真實 3D 高程地形與 60° 俯視角
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m) return;
    m.setTerrain(is3D ? { source: 'dem-3d', exaggeration: 1.5 } : null);
    if (lastTerrainRef.current !== is3D) {
      m.easeTo({ pitch: is3D ? 60 : 0, duration: 800 });
    }
    lastTerrainRef.current = is3D;
  }, [mapReady, is3D]);

  // 依篩選條件更新地圖標記
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m) return;

    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    visiblePlaces.forEach((place) => {
      const isSelected = selectedPlace?.id === place.id;
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', place.zh);
      el.style.cursor = 'pointer';
      el.style.border = 'none';
      el.style.background = 'transparent';
      el.style.padding = '0';

      if (place.isHotel) {
        const badge = document.createElement('span');
        badge.textContent = `🛏️ ${place.hotelBadge || '飯店'}`;
        badge.style.cssText = [
          'display:inline-flex',
          'align-items:center',
          'gap:4px',
          'border-radius:999px',
          'background:#ffffff',
          'padding:4px 10px',
          'font-size:13px',
          'font-weight:800',
          'color:#0c4a6e',
          'white-space:nowrap',
          `border:2.5px solid ${isSelected ? '#c2410c' : '#0c4a6e'}`,
          `box-shadow:${isSelected ? '0 0 0 4px rgba(194,65,12,0.28), 0 4px 12px rgba(0,0,0,0.22)' : '0 2px 8px rgba(0,0,0,0.2)'}`,
          `transform:scale(${isSelected ? 1.1 : 1})`,
          'transition:transform 160ms ease',
        ].join(';');
        el.appendChild(badge);
      } else {
        const pin = document.createElement('span');
        pin.textContent = getPinLabel(place);
        const sizePx = isSelected ? 38 : 32;
        pin.style.cssText = [
          'display:grid',
          'place-items:center',
          `width:${sizePx}px`,
          `height:${sizePx}px`,
          'border-radius:999px',
          `background:${getPinColor(place)}`,
          'color:#ffffff',
          'border:2.5px solid #ffffff',
          `font-size:${isSelected ? 16 : 14}px`,
          `box-shadow:${isSelected ? '0 0 0 4px rgba(12,74,110,0.35), 0 4px 12px rgba(0,0,0,0.26)' : '0 2px 6px rgba(0,0,0,0.25)'}`,
          'transition:transform 160ms ease',
        ].join(';');
        el.appendChild(pin);
      }

      el.onclick = (e) => {
        e.stopPropagation();
        stopTour();
        setSelectedPlace(place);
        flyToPlace(place);
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(place.coords)
        .addTo(m);
      if (isSelected) {
        marker.getElement().style.zIndex = '5';
      }
      markersRef.current.push(marker);
    });
  }, [mapReady, visiblePlaces, selectedPlace, stopTour, flyToPlace]);

  // 切換篩選類別時自動縮放至該組地點視野
  useEffect(() => {
    if (!mapReady) return;
    stopTour();
    fitPlacesBounds(visiblePlaces, selectedFilter);
    if (
      visiblePlaces.length > 0 &&
      !visiblePlaces.some((p) => p.id === selectedPlace?.id)
    ) {
      setSelectedPlace(visiblePlaces[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selectedFilter]);

  const handleToggleTour = async () => {
    if (isTouring) {
      stopTour();
      return;
    }
    if (visiblePlaces.length === 0) return;

    const runId = ++tourRunRef.current;
    setIsTouring(true);
    for (let i = 0; i < visiblePlaces.length; i++) {
      if (tourRunRef.current !== runId) return;
      const target = visiblePlaces[i];
      setSelectedPlace(target);
      flyToPlace(target);
      await new Promise((r) => setTimeout(r, 3800));
    }
    if (tourRunRef.current === runId) {
      setIsTouring(false);
    }
  };

  const handleCopyName = (id: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // 忽略剪貼簿權限錯誤
    }
  };

  const focusPlaceOnMap = (place: Place) => {
    stopTour();
    setSelectedPlace(place);
    flyToPlace(place);
  };

  const currentIdx = visiblePlaces.findIndex((p) => p.id === selectedPlace?.id);
  const handleStepPlace = (delta: number) => {
    if (visiblePlaces.length === 0) return;
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = Math.max(0, Math.min(visiblePlaces.length - 1, baseIdx + delta));
    focusPlaceOnMap(visiblePlaces[nextIdx]);
  };

  const mapFilters: { id: MapFilterId; label: string }[] = [
    { id: 'naha', label: '那霸市區' },
    { id: 'all', label: '全覽含賞鯨' },
    { id: 'food', label: '🍽️ 美食' },
    { id: 'shop', label: '🛒 超市' },
    { id: 1, label: '第 1 天' },
    { id: 2, label: '第 2 天' },
    { id: 3, label: '第 3 天' },
    { id: 4, label: '第 4 天' },
  ];

  return (
    <div className="space-y-3.5">
      {/* 頂部篩選膠囊 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {mapFilters.map((f) => {
          const active = selectedFilter === f.id;
          return (
            <button
              key={String(f.id)}
              type="button"
              onClick={() => setSelectedFilter(f.id)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-[14px] font-bold transition active:scale-95 ${
                active
                  ? 'border-[#0c4a6e] bg-[#0c4a6e] text-white shadow-sm'
                  : 'border-[#e7e2d8] bg-white text-[#0f293a]'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* MapLibre GL JS 向量互動地圖主容器 */}
      <div className="relative isolate h-[58vh] min-h-[410px] w-full overflow-hidden rounded-3xl border border-[#e7e2d8] bg-[#cfe3f4] shadow-[0_6px_20px_rgba(12,74,110,0.12)]">
        {/* 使用 inline absolute 避免 MapLibre CSS 覆蓋容器高度 */}
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

        {/* 左上角控制：衛星 + 真實 3D 地形 + 飛行導覽 + 回到全覽 */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsSatellite((v) => !v)}
            aria-pressed={isSatellite}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold shadow-md transition active:scale-95 ${
              isSatellite
                ? 'bg-[#0c4a6e] text-white'
                : 'bg-white/95 text-[#0f293a] backdrop-blur'
            }`}
          >
            <Satellite className="h-4 w-4" />
            <span>衛星</span>
          </button>

          <button
            type="button"
            onClick={() => setIs3D((v) => !v)}
            aria-pressed={is3D}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold shadow-md transition active:scale-95 ${
              is3D
                ? 'bg-[#0c4a6e] text-white'
                : 'bg-white/95 text-[#0f293a] backdrop-blur'
            }`}
          >
            <Mountain className="h-4 w-4" />
            <span>3D</span>
          </button>

          <button
            type="button"
            onClick={handleToggleTour}
            aria-pressed={isTouring}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold shadow-md transition active:scale-95 ${
              isTouring
                ? 'bg-[#c2410c] text-white'
                : 'bg-white/95 text-[#0f293a] backdrop-blur'
            }`}
          >
            {isTouring ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{isTouring ? '停止導覽' : '飛行導覽'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopTour();
              fitPlacesBounds(visiblePlaces, selectedFilter);
            }}
            aria-label="回到全覽視野"
            className="flex min-h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-bold text-[#0f293a] shadow-md backdrop-blur transition active:scale-95"
          >
            <Crosshair className="h-4 w-4" />
            <span>全覽</span>
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#0f293a] shadow-sm backdrop-blur">
          🛏️ 飯店 · 🍽️ 美食 · 🛒 超市 · 🐋 追鯨
        </div>
      </div>

      {/* 選中地點詳細資訊卡片 */}
      {selectedPlace && (
        <article className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_12px_rgba(12,74,110,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                  selectedPlace.isHotel
                    ? 'bg-[#fff7ed] text-[#c2410c]'
                    : 'bg-[#e0f2fe] text-[#0369a1]'
                }`}
              >
                {selectedPlace.isHotel ? '🛏️ 飯店' : selectedPlace.category} ·{' '}
                {selectedPlace.region}
              </span>
              <span className="rounded-full bg-[#faf7f2] px-2.5 py-0.5 text-[12px] font-semibold text-[#57534e]">
                {selectedPlace.days}
              </span>
            </div>
            <MapPin className="h-5 w-5 shrink-0 text-[#0369a1]" />
          </div>

          <h3 className="mt-2 text-[19px] font-extrabold text-[#0f293a]">
            {selectedPlace.zh}
          </h3>
          <p className="mt-0.5 text-[14px] font-bold text-[#0369a1]">
            {selectedPlace.en}
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#57534e]">
            {selectedPlace.desc}
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              aria-label="上一個地點"
              disabled={currentIdx <= 0}
              onClick={() => handleStepPlace(-1)}
              className="grid h-11 w-10 shrink-0 place-items-center rounded-2xl border border-[#e7e2d8] bg-[#faf7f2] text-[#0f293a] transition active:scale-95 disabled:opacity-35"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                selectedPlace.query
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#0369a1] px-3 text-[14px] font-bold text-white transition active:scale-95"
            >
              <Navigation className="h-4 w-4" />
              <span>開啟 Google Maps 導航</span>
            </a>
            <button
              type="button"
              onClick={() => handleCopyName(selectedPlace.id, selectedPlace.en)}
              className="flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-2xl border border-[#e7e2d8] bg-[#faf7f2] px-3 text-[13px] font-bold text-[#0f293a] transition active:scale-95"
            >
              {copiedId === selectedPlace.id ? (
                <>
                  <Check className="h-4 w-4 text-[#0f766e]" />
                  <span className="text-[#0f766e]">已複製</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>複製</span>
                </>
              )}
            </button>
            <button
              type="button"
              aria-label="下一個地點"
              disabled={currentIdx < 0 || currentIdx >= visiblePlaces.length - 1}
              onClick={() => handleStepPlace(1)}
              className="grid h-11 w-10 shrink-0 place-items-center rounded-2xl border border-[#e7e2d8] bg-[#faf7f2] text-[#0f293a] transition active:scale-95 disabled:opacity-35"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </article>
      )}

      {/* 快速清單 */}
      <section className="rounded-3xl border border-[#e7e2d8] bg-white p-3.5">
        <div className="mb-2 flex items-center justify-between px-1">
          <h4 className="text-[14px] font-extrabold text-[#0f293a]">
            目前顯示地點
          </h4>
          <span className="text-[12px] font-semibold text-[#6b7280]">
            共 {visiblePlaces.length} 處 · 點擊定位
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visiblePlaces.map((p) => {
            const active = selectedPlace?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => focusPlaceOnMap(p)}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-bold transition ${
                  active
                    ? 'border-[#0369a1] bg-[#e0f2fe] text-[#0369a1]'
                    : 'border-[#e7e2d8] bg-[#faf7f2] text-[#0f293a]'
                }`}
              >
                {p.isHotel ? '🛏️ ' : `${getPinLabel(p)} `}
                {p.zh}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 5. 即時日圓換算器 (JpyCalculator - 支援含稅/免稅 10% 試算)
// ============================================================================

const FALLBACK_JPY_PER_TWD = 4.75; // 1 TWD ≈ 4.75 JPY (1 JPY ≈ 0.2105 TWD)

function JpyCalculator({
  calcRef,
  isOpen = true,
  onToggle,
}: {
  calcRef: React.RefObject<HTMLElement | null>;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const [rateJpyPerTwd, setRateJpyPerTwd] = useState(String(FALLBACK_JPY_PER_TWD));
  const [isTaxFree, setIsTaxFree] = useState(false);

  const [liveRates, setLiveRates] = useState<{
    jpyPerTwd: number;
    status: 'loading' | 'live' | 'fallback';
    updatedAt: string | null;
  }>({
    jpyPerTwd: FALLBACK_JPY_PER_TWD,
    status: 'loading',
    updatedAt: null,
  });

  const [lastEdited, setLastEdited] = useState<'jpy' | 'twd'>('jpy');
  const [jpyInput, setJpyInput] = useState('3000');
  const [twdInput, setTwdInput] = useState('632');

  const jpyInputRef = useRef(jpyInput);
  const twdInputRef = useRef(twdInput);
  jpyInputRef.current = jpyInput;
  twdInputRef.current = twdInput;

  const fetchLiveRates = useCallback(async (applyToInput = true) => {
    setLiveRates((prev) => ({ ...prev, status: 'loading' }));

    const tryApply = (twdToJpy: number) => {
      const rounded = Number(twdToJpy.toFixed(3));
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');

      setLiveRates({
        jpyPerTwd: rounded,
        status: 'live',
        updatedAt: `${hh}:${mm}`,
      });
      if (applyToInput) {
        setRateJpyPerTwd(String(rounded));
      }
    };

    try {
      const res = await fetch('https://open.er-api.com/v6/latest/TWD');
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.rates?.JPY === 'number') {
          tryApply(data.rates.JPY);
          return;
        }
      }
    } catch {
      // 嘗試備援 API
    }

    try {
      const res2 = await fetch(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json'
      );
      if (res2.ok) {
        const data2 = await res2.json();
        if (typeof data2?.twd?.jpy === 'number') {
          tryApply(data2.twd.jpy);
          return;
        }
      }
    } catch {
      // 退回預設匯率
    }

    setLiveRates((prev) => ({ ...prev, status: 'fallback' }));
  }, []);

  useEffect(() => {
    fetchLiveRates(true);
  }, [fetchLiveRates]);

  const parsedRate = Math.max(parseFloat(rateJpyPerTwd) || FALLBACK_JPY_PER_TWD, 0.1);
  const twdPerJpy = 1 / parsedRate;
  const taxMultiplier = isTaxFree ? 1 / 1.1 : 1;

  useEffect(() => {
    if (lastEdited === 'jpy') {
      const j = parseFloat(jpyInputRef.current);
      if (Number.isFinite(j)) {
        setTwdInput(String(Math.round((j * taxMultiplier) / parsedRate)));
      }
    } else {
      const t = parseFloat(twdInputRef.current);
      if (Number.isFinite(t)) {
        setJpyInput(String(Math.round((t * parsedRate) / taxMultiplier)));
      }
    }
  }, [parsedRate, taxMultiplier, lastEdited]);

  const handleJpyChange = (val: string) => {
    const clean = sanitizeDecimalInput(val);
    setLastEdited('jpy');
    setJpyInput(clean);
    const num = parseFloat(clean);
    if (Number.isFinite(num)) {
      setTwdInput(String(Math.round((num * taxMultiplier) / parsedRate)));
    } else {
      setTwdInput('');
    }
  };

  const handleTwdChange = (val: string) => {
    const clean = sanitizeDecimalInput(val);
    setLastEdited('twd');
    setTwdInput(clean);
    const num = parseFloat(clean);
    if (Number.isFinite(num)) {
      setJpyInput(String(Math.round((num * parsedRate) / taxMultiplier)));
    } else {
      setJpyInput('');
    }
  };

  const applyQuickJpy = (amount: number) => {
    setLastEdited('jpy');
    setJpyInput(String(amount));
    setTwdInput(String(Math.round((amount * taxMultiplier) / parsedRate)));
  };

  const quickJpyList = [
    { label: '¥500', value: 500 },
    { label: '¥1,000', value: 1000 },
    { label: '¥3,000', value: 3000 },
    { label: '¥5,500', value: 5500 },
    { label: '¥10,000', value: 10000 },
  ];

  return (
    <section
      ref={calcRef}
      className="rounded-3xl border-2 border-[#0369a1]/25 bg-white p-4 shadow-[0_4px_16px_rgba(3,105,161,0.08)]"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#e0f2fe] text-[#0369a1]">
            <ArrowRightLeft className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[17.5px] font-bold text-[#0f293a]">即時日圓換算器</h3>
            <p className="truncate text-[12px] font-semibold text-[#0369a1]">
              1 JPY ≈ {formatNumber(twdPerJpy, 4)} TWD
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {isOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fetchLiveRates(true);
              }}
              disabled={liveRates.status === 'loading'}
              className="flex min-h-8 items-center gap-1.5 rounded-full border border-[#e7e2d8] bg-[#faf7f2] px-2.5 text-[11.5px] font-bold text-[#0f293a] transition active:scale-95 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#0369a1] ${
                  liveRates.status === 'loading' ? 'animate-spin' : ''
                }`}
              />
              <span>
                {liveRates.status === 'loading'
                  ? '更新中...'
                  : liveRates.status === 'live'
                  ? `即時 ${liveRates.updatedAt}`
                  : '參考即期'}
              </span>
            </button>
          )}
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={isOpen ? '收合即時日圓換算器' : '展開即時日圓換算器'}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#f4f0e8] text-[#57534e]"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3">
      {/* 含稅 / 免稅 10% 切換 */}
      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#f4f0e8] p-1">
        <button
          type="button"
          onClick={() => setIsTaxFree(false)}
          className={`min-h-10 rounded-xl text-[13.5px] font-bold transition ${
            !isTaxFree ? 'bg-[#0369a1] text-white shadow-sm' : 'text-[#57534e]'
          }`}
        >
          一般含稅價
        </button>
        <button
          type="button"
          onClick={() => setIsTaxFree(true)}
          className={`min-h-10 rounded-xl text-[13.5px] font-bold transition ${
            isTaxFree ? 'bg-[#c2410c] text-white shadow-sm' : 'text-[#57534e]'
          }`}
        >
          免稅退 10% 試算
        </button>
      </div>

      {/* 匯率微調 */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-[#faf7f2] px-3 py-2">
        <span className="text-[12.5px] font-semibold text-[#57534e]">
          1 台幣換日圓 (JPY)
        </span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={rateJpyPerTwd}
          onChange={(e) => setRateJpyPerTwd(e.target.value)}
          className="w-24 rounded-xl border border-[#e7e2d8] bg-white px-2.5 py-1 text-right text-[15px] font-bold text-[#0f293a] focus:border-[#0369a1] focus:outline-none"
        />
      </div>

      {/* 雙向輸入框 */}
      <div className="space-y-2.5">
        <div className="rounded-2xl border border-[#e7e2d8] bg-[#faf7f2]/70 px-3.5 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#57534e]">
              日圓 JPY (¥){isTaxFree ? '（輸入含稅標價）' : ''}
            </span>
            {isTaxFree && Number.isFinite(parseFloat(jpyInput)) && (
              <span className="text-[12px] font-bold text-[#c2410c]">
                退稅後 ≈ ¥{formatNumber(Math.round(parseFloat(jpyInput) / 1.1))}
              </span>
            )}
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={jpyInput}
            onChange={(e) => handleJpyChange(e.target.value)}
            placeholder="輸入日圓"
            className="mt-1 w-full bg-transparent text-[24px] font-extrabold tracking-tight text-[#0f293a] focus:outline-none"
          />
        </div>

        <div className="rounded-2xl border border-[#bae6fd] bg-[#f0f9ff] px-3.5 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#0369a1]">
              折合台幣 TWD (NT$)
            </span>
            <span className="text-[11px] font-medium text-[#57534e]">
              輸入台幣也可反算日圓
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={twdInput}
            onChange={(e) => handleTwdChange(e.target.value)}
            placeholder="輸入台幣"
            className="mt-1 w-full bg-transparent text-[24px] font-extrabold tracking-tight text-[#0369a1] focus:outline-none"
          />
        </div>
      </div>

      {/* 快捷金額 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {quickJpyList.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => applyQuickJpy(q.value)}
            className={`min-h-8 rounded-full border px-3 text-[12.5px] font-bold transition ${
              Number(jpyInput) === q.value
                ? 'border-[#0369a1] bg-[#0369a1] text-white'
                : 'border-[#e7e2d8] bg-[#faf7f2] text-[#0f293a]'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// 5.5 頁面右上方互動小遊戲 (WhaleMiniGameModal - 慶良間追鯨人品大考驗)
// ============================================================================

const GAME_DURATION = 20;

interface OceanTarget {
  type: string;
  emoji: string;
  label: string;
  points: number;
  weight: number;
}

interface ActiveSlot extends OceanTarget {
  id: string;
  hit: boolean;
}

const OCEAN_TARGETS: OceanTarget[] = [
  { type: 'mom-calf', emoji: '🐳', label: '母子鯨', points: 50, weight: 10 },
  { type: 'humpback', emoji: '🐋', label: '大翅鯨', points: 30, weight: 22 },
  { type: 'turtle', emoji: '🐢', label: '海龜', points: 15, weight: 24 },
  { type: 'fish', emoji: '🐠', label: '魚群', points: 10, weight: 22 },
  { type: 'jelly', emoji: '🪼', label: '水母', points: -20, weight: 22 },
];

function pickRandomTarget(): OceanTarget {
  const total = OCEAN_TARGETS.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * total;
  for (const t of OCEAN_TARGETS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return OCEAN_TARGETS[1];
}

function getWhaleFortune(score: number): string {
  if (score >= 300) return '🐋 傳說級鯨王！明天母子鯨直接游到你面前打招呼！';
  if (score >= 200) return '🌊 人品大爆發！準備好清記憶卡拍爆大翅鯨吧！';
  if (score >= 120) return '🤿 穩健追鯨手！海況不錯，有機會近距離共游喔！';
  return '⚓ 暖身中！出海前記得先吃暈船藥再集氣一次！';
}

interface WhaleMiniGameModalProps {
  onClose: () => void;
  activeGroup: TripGroup;
  activeMember: Member;
  leaderboard: GameScoreEntry[];
  onSaveScore: (score: number) => void;
}

function WhaleMiniGameModal({
  onClose,
  activeGroup,
  activeMember,
  leaderboard,
  onSaveScore,
}: WhaleMiniGameModalProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'ended'>('ready');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [slots, setSlots] = useState<(ActiveSlot | null)[]>(() => Array(9).fill(null));
  const [popups, setPopups] = useState<
    Record<number, { id: number; text: string; isBad: boolean }>
  >({});

  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const slotTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const popupTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    Object.values(slotTimersRef.current).forEach((t) => clearTimeout(t));
    slotTimersRef.current = {};
    Object.values(popupTimersRef.current).forEach((t) => clearTimeout(t));
    popupTimersRef.current = {};
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  useEffect(() => {
    if (phase === 'playing' && timeLeft === 0) {
      clearAllTimers();
      setSlots(Array(9).fill(null));
      setPhase('ended');
      onSaveScore(scoreRef.current);
    }
  }, [phase, timeLeft, clearAllTimers, onSaveScore]);

  const spawnOne = useCallback(() => {
    setSlots((prev) => {
      const emptyIndices = prev
        .map((v, i) => (v === null ? i : -1))
        .filter((i) => i !== -1);
      if (emptyIndices.length === 0) return prev;

      const idx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      const target = pickRandomTarget();
      const id = `${Date.now()}-${Math.random()}`;
      const next = [...prev];
      next[idx] = { ...target, id, hit: false };

      if (slotTimersRef.current[idx]) clearTimeout(slotTimersRef.current[idx]);
      slotTimersRef.current[idx] = setTimeout(() => {
        setSlots((cur) => {
          if (cur[idx]?.id !== id) return cur;
          const updated = [...cur];
          updated[idx] = null;
          return updated;
        });
      }, 950 + Math.random() * 400);

      return next;
    });
  }, []);

  const startGame = () => {
    clearAllTimers();
    scoreRef.current = 0;
    comboRef.current = 0;
    setScore(0);
    setCombo(0);
    setTimeLeft(GAME_DURATION);
    setSlots(Array(9).fill(null));
    setPopups({});
    setPhase('playing');

    spawnOne();
    spawnIntervalRef.current = setInterval(() => {
      spawnOne();
      if (Math.random() < 0.4) spawnOne();
    }, 520);

    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
  };

  const handleTapSlot = (idx: number) => {
    if (phase !== 'playing') return;
    const item = slots[idx];
    if (!item || item.hit) return;

    const isBad = item.points < 0;
    const nextCombo = isBad ? 0 : comboRef.current + 1;
    comboRef.current = nextCombo;
    const bonus = !isBad && nextCombo >= 4 ? 5 : 0;
    const delta = item.points + bonus;

    scoreRef.current = Math.max(0, scoreRef.current + delta);
    setScore(scoreRef.current);
    setCombo(nextCombo);

    if (slotTimersRef.current[idx]) clearTimeout(slotTimersRef.current[idx]);
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });

    const popId = Date.now() + Math.random();
    setPopups((prev) => ({
      ...prev,
      [idx]: {
        id: popId,
        text: delta > 0 ? `+${delta}` : `${delta}`,
        isBad,
      },
    }));
    if (popupTimersRef.current[idx]) clearTimeout(popupTimersRef.current[idx]);
    popupTimersRef.current[idx] = setTimeout(() => {
      setPopups((prev) => {
        if (prev[idx]?.id !== popId) return prev;
        const next = { ...prev };
        delete next[idx];
        return next;
      });
    }, 450);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-[#bae6fd] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0f293a]">
              🐋 慶良間追鯨人品大考驗
            </h2>
            <p className="text-[12px] font-semibold text-[#0369a1]">
              挑戰者：{activeMember.emoji} {activeMember.name} · {activeGroup.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉小遊戲"
            className="grid h-9 w-9 place-items-center rounded-full bg-[#faf7f2] text-[#57534e]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 狀態列：分數 / 連擊 / 時間 */}
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl bg-[#f0f9ff] p-2.5 text-center">
          <div>
            <div className="text-[11px] font-bold text-[#6b7280]">目前分數</div>
            <div className="text-[20px] font-extrabold text-[#0369a1]">{score}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#6b7280]">連擊</div>
            <div className="text-[20px] font-extrabold text-[#c2410c]">
              {combo > 1 ? `${combo}x` : '-'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#6b7280]">剩餘秒數</div>
            <div
              className={`text-[20px] font-extrabold ${
                timeLeft <= 5 && phase === 'playing' ? 'text-[#dc2626]' : 'text-[#0f293a]'
              }`}
            >
              {timeLeft}s
            </div>
          </div>
        </div>

        {/* 遊戲主區：3x3 海洋方格 */}
        {phase === 'ready' && (
          <div className="space-y-3 rounded-2xl border border-[#dbeafe] bg-gradient-to-b from-[#e0f2fe] to-[#f0f9ff] p-4 text-center">
            <div className="text-[40px] leading-none">🐳 🐋 🐢</div>
            <p className="text-[13.5px] font-bold leading-relaxed text-[#0c4a6e]">
              20 秒內點擊海面出現的海洋生物累積人品值！
              <br />
              小心別點到有毒水母 🪼 會扣分喔！
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 text-[11.5px] font-bold">
              <span className="rounded-full bg-white px-2.5 py-1 text-[#0369a1]">🐳 +50</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[#0369a1]">🐋 +30</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[#0f766e]">🐢 +15</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[#0f766e]">🐠 +10</span>
              <span className="rounded-full bg-[#fef2f2] px-2.5 py-1 text-[#dc2626]">🪼 -20</span>
            </div>
            <button
              type="button"
              onClick={startGame}
              className="mt-1 min-h-12 w-full rounded-2xl bg-[#0369a1] text-[16px] font-extrabold text-white shadow-md transition active:scale-95"
            >
              開始出海追鯨！
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="grid grid-cols-3 gap-2.5 rounded-2xl bg-gradient-to-b from-[#0284c7] to-[#0c4a6e] p-3">
            {slots.map((item, idx) => {
              const pop = popups[idx];
              return (
                <button
                  key={idx}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleTapSlot(idx);
                  }}
                  className="relative grid h-[82px] place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white/15 text-center backdrop-blur-xs transition active:scale-90 select-none"
                >
                  {item ? (
                    <div className="flex flex-col items-center">
                      <span className="text-[34px] leading-none drop-shadow">
                        {item.emoji}
                      </span>
                      <span className="mt-1 rounded-full bg-black/25 px-1.5 text-[10px] font-bold text-white">
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[18px] opacity-25">〰️</span>
                  )}

                  {pop && (
                    <span
                      className={`pointer-events-none absolute top-1.5 right-2 rounded-full px-1.5 py-0.5 text-[12px] font-extrabold shadow ${
                        pop.isBad
                          ? 'bg-[#fef2f2] text-[#dc2626]'
                          : 'bg-[#fef9c3] text-[#854d0e]'
                      }`}
                    >
                      {pop.text}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {phase === 'ended' && (
          <div className="space-y-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4 text-center">
            <div className="text-[13px] font-bold text-[#92400e]">本局最終人品分數</div>
            <div className="text-[40px] font-extrabold leading-none text-[#0369a1]">
              {score}
            </div>
            <p className="text-[14px] font-bold leading-snug text-[#451a03]">
              {getWhaleFortune(score)}
            </p>
            <button
              type="button"
              onClick={startGame}
              className="min-h-11 w-full rounded-2xl bg-[#0369a1] text-[15px] font-extrabold text-white shadow-sm transition active:scale-95"
            >
              再玩一次刷新紀錄
            </button>
          </div>
        )}

        {/* 本團即時排行榜 */}
        <div className="mt-4 rounded-2xl border border-[#e7e2d8] bg-[#faf7f2] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-[#0f293a]">
              <Trophy className="h-4 w-4 text-[#d97706]" />
              <span>{activeGroup.label} 追鯨排行榜</span>
            </div>
            <span className="text-[11px] font-semibold text-[#6b7280]">自動同步最高分</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="py-2 text-center text-[12.5px] text-[#6b7280]">
              還沒有人上榜，快來當本團第一位鯨王！
            </p>
          ) : (
            <ul className="space-y-1.5">
              {leaderboard.slice(0, 5).map((entry, idx) => (
                <li
                  key={entry.memberId}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-[13px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center font-extrabold text-[#d97706]">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                    </span>
                    <span>{entry.emoji}</span>
                    <span className="font-bold text-[#0f293a]">{entry.name}</span>
                  </div>
                  <span className="font-extrabold text-[#0369a1]">{entry.score} 分</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5.6 火柴人頭部貼紙裁切工具 (AvatarCropModal)
// ============================================================================

const PREVIEW_SIZE = 240;
const HEAD_RX = 72;
const HEAD_RY = 88;

function isCoachMember(memberId: string): boolean {
  return memberId === 'coach1' || memberId === 'coach2';
}

function getAvatarKey(groupId: string, memberId: string): string {
  return isCoachMember(memberId) ? memberId : `${groupId}_${memberId}`;
}

interface AvatarCropModalProps {
  initialMember: Member | null;
  activeGroupLabel: string;
  avatars: Record<string, string>;
  onClose: () => void;
  onSaveAvatar: (memberId: string, dataUrl: string) => Promise<void>;
  onRemoveAvatar: (memberId: string) => Promise<void>;
}

function AvatarCropModal({
  initialMember,
  activeGroupLabel,
  avatars,
  onClose,
  onSaveAvatar,
  onRemoveAvatar,
}: AvatarCropModalProps) {
  const [targetId, setTargetId] = useState(initialMember?.id || 'coach1');
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1.6);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const targetMember = useMemo(
    () => MEMBERS.find((m) => m.id === targetId) || MEMBERS[0],
    [targetId]
  );

  // 繪製即時頭部裁切預覽
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseScale = Math.max(
      PREVIEW_SIZE / imgEl.naturalWidth,
      PREVIEW_SIZE / imgEl.naturalHeight
    );
    const drawW = imgEl.naturalWidth * baseScale * zoom;
    const drawH = imgEl.naturalHeight * baseScale * zoom;
    const dx = PREVIEW_SIZE / 2 + offset.x - drawW / 2;
    const dy = PREVIEW_SIZE / 2 + offset.y - drawH / 2;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.drawImage(imgEl, dx, dy, drawW, drawH);

    // 外部半透明遮罩，只清楚露出中央橢圓頭部範圍
    ctx.save();
    ctx.fillStyle = 'rgba(15, 41, 58, 0.58)';
    ctx.beginPath();
    ctx.rect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.ellipse(
      PREVIEW_SIZE / 2,
      PREVIEW_SIZE / 2,
      HEAD_RX,
      HEAD_RY,
      0,
      0,
      Math.PI * 2,
      true
    );
    ctx.fill();

    // 虛線頭型框提示
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.ellipse(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [imgEl, zoom, offset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        setImgEl(image);
        setZoom(1.8);
        setOffset({ x: 0, y: 0 });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imgEl) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.origX + (e.clientX - d.startX),
      y: d.origY + (e.clientY - d.startY),
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleConfirmCrop = async () => {
    if (!imgEl || isSaving) return;
    setIsSaving(true);
    try {
      const outW = 160;
      const outH = 192;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = outW;
      outCanvas.height = outH;
      const ctx = outCanvas.getContext('2d');
      if (!ctx) return;

      const baseScale = Math.max(
        PREVIEW_SIZE / imgEl.naturalWidth,
        PREVIEW_SIZE / imgEl.naturalHeight
      );
      const drawW = imgEl.naturalWidth * baseScale * zoom;
      const drawH = imgEl.naturalHeight * baseScale * zoom;

      // 先畫白色貼紙外框，再以 1:1 橢圓遮罩只裁切頭部
      ctx.clearRect(0, 0, outW, outH);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(outW / 2, outH / 2, HEAD_RX + 4, HEAD_RY + 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(outW / 2, outH / 2, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        imgEl,
        outW / 2 + offset.x - drawW / 2,
        outH / 2 + offset.y - drawH / 2,
        drawW,
        drawH
      );
      ctx.restore();

      const dataUrl = outCanvas.toDataURL('image/png');
      await onSaveAvatar(targetId, dataUrl);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const existingAvatar = avatars[targetId];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-[#bae6fd] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0f293a]">
              📷 火柴人頭部貼紙設定
            </h2>
            <p className="text-[12px] font-semibold text-[#0369a1]">
              {isCoachMember(targetId)
                ? '帶隊教練頭像會同步顯示於第 1 團與第 2 團'
                : `${activeGroupLabel}專屬頭像，與另一團團員分開獨立顯示`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="grid h-9 w-9 place-items-center rounded-full bg-[#faf7f2] text-[#57534e]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 選擇要更換頭像的成員 */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {MEMBERS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setTargetId(m.id);
                setImgEl(null);
              }}
              className={`flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[12.5px] font-bold transition ${
                m.id === targetId
                  ? 'border-transparent text-white shadow-xs'
                  : 'border-[#e7e2d8] bg-[#faf7f2] text-[#57534e]'
              }`}
              style={m.id === targetId ? { backgroundColor: m.color } : undefined}
            >
              <span>{m.emoji}</span>
              <span>{m.name}</span>
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {!imgEl ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#bae6fd] bg-[#f0f9ff]/70 p-5 text-center">
            {existingAvatar ? (
              <img
                src={existingAvatar}
                alt={targetMember.name}
                className="mb-3 h-24 w-20 object-contain drop-shadow-md"
              />
            ) : (
              <span
                className="mb-3 grid h-16 w-16 place-items-center rounded-full text-[30px] text-white shadow-sm"
                style={{ backgroundColor: targetMember.color }}
              >
                {targetMember.emoji}
              </span>
            )}
            <p className="text-[14px] font-extrabold text-[#0f293a]">
              正在設定「{targetMember.name}」的火柴人頭像
            </p>
            <p className="mt-1 text-[12px] text-[#57534e]">
              選取照片後可縮放拖曳，只保留頭部區域
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3.5 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#0369a1] text-[14.5px] font-extrabold text-white shadow-sm transition active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span>選擇照片裁切頭部</span>
            </button>
            {existingAvatar && (
              <button
                type="button"
                onClick={async () => {
                  await onRemoveAvatar(targetId);
                  onClose();
                }}
                className="mt-2 text-[12.5px] font-bold text-[#dc2626] underline underline-offset-2"
              >
                移除照片，恢復預設表情
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative overflow-hidden rounded-2xl border-2 border-[#0369a1]/30 bg-[#0f293a] shadow-inner">
              <canvas
                ref={canvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="block h-[240px] w-[240px] touch-none cursor-grab active:cursor-grabbing"
              />
            </div>

            <p className="text-[12px] font-semibold text-[#57534e]">
              👆 拖曳照片移動位置，滑動下方放大只留頭部
            </p>

            {/* 縮放拉桿 */}
            <div className="flex w-full items-center gap-2 rounded-2xl bg-[#faf7f2] px-3 py-2">
              <Minus className="h-4 w-4 shrink-0 text-[#57534e]" />
              <input
                type="range"
                min="1"
                max="4.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-[#0369a1]"
              />
              <Plus className="h-4 w-4 shrink-0 text-[#57534e]" />
            </div>

            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-11 flex-1 rounded-2xl border border-[#e7e2d8] bg-[#faf7f2] text-[13.5px] font-bold text-[#0f293a]"
              >
                重選照片
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleConfirmCrop}
                className="min-h-11 flex-[1.6] rounded-2xl bg-[#0369a1] text-[14.5px] font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
              >
                {isSaving ? '套用中...' : `套用到 ${targetMember.name} 頭上`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5.7 航班與抵達入住回報卡（需鎖定身分填寫，僅兩位帶隊教練可查看總表）
// ============================================================================

interface FlightSchedulePreset {
  airline: string;
  route: string;
  time: string; // HH:mm (當地時間：去程為抵達那霸時間，回程為那霸起飛時間)
}

// 台灣（桃園 / 台中 / 高雄）及常見轉機航點直飛沖繩那霸（OKA）表定參考時刻（當地時間）
const OKINAWA_ARRIVAL_FLIGHTS: Record<string, FlightSchedulePreset> = {
  CI120: { airline: '華航', route: '桃園→那霸', time: '10:50' },
  CI122: { airline: '華航', route: '桃園→那霸', time: '19:25' },
  CI132: { airline: '華航', route: '高雄→那霸', time: '18:45' },
  CI310: { airline: '華航', route: '台中→那霸', time: '12:40' },
  CI312: { airline: '華航', route: '台中→那霸', time: '18:00' },
  BR112: { airline: '長榮', route: '桃園→那霸', time: '09:15' },
  BR186: { airline: '長榮', route: '桃園→那霸', time: '19:10' },
  JX870: { airline: '星宇', route: '桃園→那霸', time: '14:15' },
  JX302: { airline: '星宇', route: '台中→那霸', time: '15:25' },
  IT230: { airline: '虎航', route: '桃園→那霸', time: '08:55' },
  IT232: { airline: '虎航', route: '桃園→那霸', time: '20:40' },
  IT288: { airline: '虎航', route: '高雄→那霸', time: '12:30' },
  IT792: { airline: '虎航', route: '台中→那霸', time: '09:40' },
  MM922: { airline: '樂桃', route: '桃園→那霸', time: '12:25' },
  MM924: { airline: '樂桃', route: '桃園→那霸', time: '12:20' },
  MM926: { airline: '樂桃', route: '桃園→那霸', time: '17:50' },
  MM928: { airline: '樂桃', route: '桃園→那霸', time: '20:50' },
  FD230: { airline: '泰亞航', route: '桃園→那霸', time: '15:55' },
  OD882: { airline: '峇迪', route: '桃園→那霸', time: '15:35' },
  SL390: { airline: '泰獅航', route: '高雄→那霸', time: '10:55' },
  UO820: { airline: '香港快運', route: '香港→那霸', time: '11:25' },
  UO826: { airline: '香港快運', route: '香港→那霸', time: '16:50' },
  HX658: { airline: '香港航空', route: '香港→那霸', time: '14:55' },
  HX676: { airline: '香港航空', route: '香港→那霸', time: '15:20' },
  JL901: { airline: '日航', route: '羽田→那霸', time: '09:15' },
  JL903: { airline: '日航', route: '羽田→那霸', time: '10:35' },
  JL905: { airline: '日航', route: '羽田→那霸', time: '11:30' },
  JL907: { airline: '日航', route: '羽田→那霸', time: '12:35' },
  JL913: { airline: '日航', route: '羽田→那霸', time: '14:25' },
  JL917: { airline: '日航', route: '羽田→那霸', time: '16:35' },
  NH461: { airline: '全日空', route: '羽田→那霸', time: '09:05' },
  NH463: { airline: '全日空', route: '羽田→那霸', time: '10:50' },
  NH467: { airline: '全日空', route: '羽田→那霸', time: '12:00' },
  NH469: { airline: '全日空', route: '羽田→那霸', time: '13:15' },
  NH473: { airline: '全日空', route: '羽田→那霸', time: '16:05' },
};

// 沖繩那霸（OKA）返台及常見轉機航點回程起飛表定參考時刻（日本時間）
const OKINAWA_DEPARTURE_FLIGHTS: Record<string, FlightSchedulePreset> = {
  CI121: { airline: '華航', route: '那霸→桃園', time: '11:55' },
  CI123: { airline: '華航', route: '那霸→桃園', time: '20:25' },
  CI133: { airline: '華航', route: '那霸→高雄', time: '19:45' },
  CI311: { airline: '華航', route: '那霸→台中', time: '13:40' },
  CI313: { airline: '華航', route: '那霸→台中', time: '19:00' },
  BR113: { airline: '長榮', route: '那霸→桃園', time: '10:15' },
  BR185: { airline: '長榮', route: '那霸→桃園', time: '20:10' },
  JX871: { airline: '星宇', route: '那霸→桃園', time: '15:25' },
  JX303: { airline: '星宇', route: '那霸→台中', time: '16:25' },
  IT231: { airline: '虎航', route: '那霸→桃園', time: '09:45' },
  IT233: { airline: '虎航', route: '那霸→桃園', time: '21:30' },
  IT289: { airline: '虎航', route: '那霸→高雄', time: '14:00' },
  IT793: { airline: '虎航', route: '那霸→台中', time: '10:35' },
  MM921: { airline: '樂桃', route: '那霸→桃園', time: '08:15' },
  MM923: { airline: '樂桃', route: '那霸→桃園', time: '08:10' },
  MM925: { airline: '樂桃', route: '那霸→桃園', time: '13:35' },
  MM927: { airline: '樂桃', route: '那霸→桃園', time: '16:50' },
  FD231: { airline: '泰亞航', route: '那霸→桃園', time: '16:55' },
  OD883: { airline: '峇迪', route: '那霸→桃園', time: '16:30' },
  SL391: { airline: '泰獅航', route: '那霸→高雄', time: '11:55' },
  UO821: { airline: '香港快運', route: '那霸→香港', time: '12:15' },
  UO827: { airline: '香港快運', route: '那霸→香港', time: '17:45' },
  HX659: { airline: '香港航空', route: '那霸→香港', time: '15:55' },
  HX677: { airline: '香港航空', route: '那霸→香港', time: '16:20' },
  JL902: { airline: '日航', route: '那霸→羽田', time: '10:15' },
  JL904: { airline: '日航', route: '那霸→羽田', time: '11:30' },
  JL906: { airline: '日航', route: '那霸→羽田', time: '12:35' },
  JL908: { airline: '日航', route: '那霸→羽田', time: '13:45' },
  JL914: { airline: '日航', route: '那霸→羽田', time: '15:30' },
  JL918: { airline: '日航', route: '那霸→羽田', time: '17:50' },
  NH462: { airline: '全日空', route: '那霸→羽田', time: '10:05' },
  NH464: { airline: '全日空', route: '那霸→羽田', time: '11:50' },
  NH468: { airline: '全日空', route: '那霸→羽田', time: '13:00' },
  NH470: { airline: '全日空', route: '那霸→羽田', time: '14:25' },
  NH474: { airline: '全日空', route: '那霸→羽田', time: '17:15' },
};

const QUICK_ARRIVAL_CODES = [
  'IT230',
  'BR112',
  'CI120',
  'MM922',
  'JX870',
  'FD230',
  'CI122',
  'BR186',
  'IT288',
  'CI132',
];

const QUICK_DEPARTURE_CODES = [
  'IT231',
  'BR113',
  'CI121',
  'MM925',
  'JX871',
  'MM927',
  'FD231',
  'BR185',
  'CI123',
  'IT289',
  'CI133',
];

function normalizeFlightCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

function searchLocalFlights(
  table: Record<string, FlightSchedulePreset>,
  rawQuery: string
): Array<{ code: string; preset: FlightSchedulePreset }> {
  const q = rawQuery.trim();
  if (!q) return [];
  const norm = normalizeFlightCode(q);
  const lower = q.toLowerCase();
  if (table[norm]) return [];

  return Object.entries(table)
    .filter(([code, preset]) => {
      return (
        code.includes(norm) ||
        preset.airline.toLowerCase().includes(lower) ||
        preset.route.toLowerCase().includes(lower)
      );
    })
    .slice(0, 6)
    .map(([code, preset]) => ({ code, preset }));
}

interface FlightInfoCardProps {
  activeGroup: TripGroup;
  activeGroupId: string;
  myClaimedMember: Member | null;
  isLockedCoach: boolean;
  flights: Record<string, MemberFlightInfo>;
  isOpen: boolean;
  onToggle: () => void;
  onSaveFlight: (data: {
    realName: string;
    arrivalFlight: string;
    arrivalTime: string;
    departureFlight: string;
    departureTime: string;
    checkInNote: string;
  }) => Promise<boolean>;
  onOpenClaimModal: () => void;
}

function FlightInfoCard({
  activeGroup,
  activeGroupId,
  myClaimedMember,
  isLockedCoach,
  flights,
  isOpen,
  onToggle,
  onSaveFlight,
  onOpenClaimModal,
}: FlightInfoCardProps) {
  const myFlightKey = myClaimedMember ? `${activeGroupId}_${myClaimedMember.id}` : '';
  const savedMine = myFlightKey ? flights[myFlightKey] : undefined;

  const [realName, setRealName] = useState('');
  const [arrivalFlight, setArrivalFlight] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureFlight, setDepartureFlight] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [checkInNote, setCheckInNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setRealName(savedMine?.realName || '');
    setArrivalFlight(savedMine?.arrivalFlight || '');
    setArrivalTime(savedMine?.arrivalTime || '');
    setDepartureFlight(savedMine?.departureFlight || '');
    setDepartureTime(savedMine?.departureTime || '');
    setCheckInNote(savedMine?.checkInNote || '');
    setSavedNotice(null);
    setFormError(null);
  }, [
    myFlightKey,
    savedMine?.realName,
    savedMine?.arrivalFlight,
    savedMine?.arrivalTime,
    savedMine?.departureFlight,
    savedMine?.departureTime,
    savedMine?.checkInNote,
  ]);

  const normalizedArrival = normalizeFlightCode(arrivalFlight);
  const normalizedDeparture = normalizeFlightCode(departureFlight);
  const matchedArrival = OKINAWA_ARRIVAL_FLIGHTS[normalizedArrival] || null;
  const matchedDeparture = OKINAWA_DEPARTURE_FLIGHTS[normalizedDeparture] || null;

  const arrivalSuggestions = useMemo(
    () => searchLocalFlights(OKINAWA_ARRIVAL_FLIGHTS, arrivalFlight),
    [arrivalFlight]
  );
  const departureSuggestions = useMemo(
    () => searchLocalFlights(OKINAWA_DEPARTURE_FLIGHTS, departureFlight),
    [departureFlight]
  );

  const handleArrivalFlightChange = (val: string) => {
    setArrivalFlight(val);
    const preset = OKINAWA_ARRIVAL_FLIGHTS[normalizeFlightCode(val)];
    if (preset) {
      setArrivalTime(preset.time);
    }
  };

  const handleDepartureFlightChange = (val: string) => {
    setDepartureFlight(val);
    const preset = OKINAWA_DEPARTURE_FLIGHTS[normalizeFlightCode(val)];
    if (preset) {
      setDepartureTime(preset.time);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myClaimedMember || isSaving) return;
    if (!realName.trim()) {
      setFormError('請先填寫你的姓名或綽號，方便教練辨識是哪位團員抵達。');
      return;
    }
    if (!arrivalFlight.trim() && !arrivalTime.trim()) {
      setFormError('請至少填寫去程航班編號或預計抵達時間。');
      return;
    }
    setFormError(null);
    setSavedNotice(null);
    setIsSaving(true);
    const ok = await onSaveFlight({
      realName: realName.trim(),
      arrivalFlight: normalizeFlightCode(arrivalFlight),
      arrivalTime: arrivalTime.trim(),
      departureFlight: normalizeFlightCode(departureFlight),
      departureTime: departureTime.trim(),
      checkInNote: checkInNote.trim(),
    });
    setIsSaving(false);
    if (ok) {
      setSavedNotice('已儲存姓名與航班資訊，僅帶隊教練可查看總表！');
    } else {
      setFormError('儲存失敗，請確認網路連線後再試一次。');
    }
  };

  const coachOverviewList = useMemo(() => {
    if (!isLockedCoach) return [];
    return MEMBERS.filter((m) => !m.hasCrown)
      .map((m) => ({
        member: m,
        info: flights[`${activeGroupId}_${m.id}`] || null,
      })).sort((a, b) => {
      if (a.info && !b.info) return -1;
      if (!a.info && b.info) return 1;
      if (a.info && b.info) {
        const ta = a.info.arrivalTime || '99:99';
        const tb = b.info.arrivalTime || '99:99';
        return ta.localeCompare(tb);
      }
      return 0;
    });
  }, [isLockedCoach, flights, activeGroupId]);

  const submittedCount = coachOverviewList.filter((item) => item.info).length;

  return (
    <section className="rounded-3xl border border-[#bae6fd] bg-white p-4 shadow-[0_2px_10px_rgba(3,105,161,0.08)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#e0f2fe] text-[#0369a1]">
            <Plane className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[17.5px] font-bold text-[#0f293a]">航班與抵達資訊</h3>
            <p className="truncate text-[12px] font-semibold text-[#0369a1]">
              {activeGroup.label}（{activeGroup.dateRange}）· 供教練安排接機與入住
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-[#f0f9ff] px-2.5 py-1 text-[11px] font-extrabold text-[#0c4a6e]">
            {isLockedCoach
              ? `👑 ${submittedCount}/${coachOverviewList.length} 已填`
              : savedMine
              ? '✓ 已回報'
              : '🔒 僅教練可見'}
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f4f0e8] text-[#57534e]">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="mt-3">
      {!myClaimedMember ? (
        <div className="rounded-2xl border border-dashed border-[#bae6fd] bg-[#f0f9ff]/70 p-4 text-center">
          <p className="text-[14px] font-bold text-[#0c4a6e]">
            請先認領並鎖定你的團隊身分
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#57534e]">
            團員鎖定身分後即可填寫自己的航班與抵達時間；兩位帶隊教練（潘潘、家輝）免填，鎖定後可直接查看團員總表。
          </p>
          <button
            type="button"
            onClick={onOpenClaimModal}
            className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#0369a1] px-5 text-[13.5px] font-extrabold text-white shadow-xs transition active:scale-95"
          >
            <Lock className="h-4 w-4" />
            <span>前往認領並鎖定身分</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 個人航班回報表單（兩位帶隊教練免填） */}
          {!isLockedCoach && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl bg-[#faf7f2] p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-extrabold text-[#0f293a]">
                {myClaimedMember.emoji} 我的航班回報（{myClaimedMember.name}）
              </span>
              {savedMine && (
                <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[11px] font-extrabold text-[#15803d]">
                  ✓ 已回報
                </span>
              )}
            </div>

            {/* 僅教練可見的真實姓名／綽號欄位 */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-[12px] font-bold text-[#57534e]">
                  姓名／綽號（僅教練可見）
                </label>
                <span className="text-[11px] font-semibold text-[#64748b]">
                  公開頁面仍顯示「{myClaimedMember.name}」
                </span>
              </div>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="例：王小明（方便教練辨識接機與入住）"
                maxLength={30}
                className="min-h-10 w-full rounded-xl border border-[#e7e2d8] bg-white px-3 text-[14px] font-bold text-[#0f293a] placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#0369a1] focus:outline-none"
              />
            </div>

            {/* 常用台灣→沖繩去程航班快速帶入 */}
            <div>
              <p className="mb-1.5 text-[11.5px] font-bold text-[#64748b]">
                點選常見去程班機，或直接輸入編號／航空公司即時搜尋帶入時間：
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {QUICK_ARRIVAL_CODES.map((code) => {
                  const item = OKINAWA_ARRIVAL_FLIGHTS[code];
                  const active = normalizedArrival === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleArrivalFlightChange(code)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition active:scale-95 ${
                        active
                          ? 'border-[#0369a1] bg-[#0369a1] text-white'
                          : 'border-[#e2e8f0] bg-white text-[#0f293a]'
                      }`}
                    >
                      {code} · {item.time}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#57534e]">
                  去程航班編號
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={arrivalFlight}
                    onChange={(e) => handleArrivalFlightChange(e.target.value)}
                    placeholder="輸入 CI120 / 星宇 / 羽田"
                    maxLength={20}
                    className="min-h-10 w-full rounded-xl border border-[#e7e2d8] bg-white pl-3 pr-9 text-[14px] font-bold text-[#0f293a] placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#0369a1] focus:outline-none"
                  />
                  {normalizedArrival ? (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        `${normalizedArrival} 航班時間`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="在 Google 查詢此去程航班時刻"
                      aria-label="在 Google 查詢去程航班時刻"
                      className="absolute right-1.5 grid h-7 w-7 place-items-center rounded-lg bg-[#f0f9ff] text-[#0369a1] transition active:scale-95"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="pointer-events-none absolute right-2.5 text-[#9ca3af]">
                      <Search className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#57534e]">
                  預計抵達那霸時間
                </label>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="min-h-10 w-full rounded-xl border border-[#e7e2d8] bg-white px-3 text-[14px] font-bold text-[#0f293a] focus:border-[#0369a1] focus:outline-none"
                />
              </div>
            </div>

            {arrivalSuggestions.length > 0 && (
              <div className="-mt-1 flex flex-wrap gap-1.5">
                {arrivalSuggestions.map(({ code, preset }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleArrivalFlightChange(code)}
                    className="rounded-full border border-[#bae6fd] bg-[#f0f9ff] px-2.5 py-1 text-[11.5px] font-extrabold text-[#0c4a6e] transition active:scale-95"
                  >
                    {code} {preset.airline}（{preset.route} {preset.time}）
                  </button>
                ))}
              </div>
            )}

            {matchedArrival ? (
              <p className="-mt-1.5 text-[11.5px] font-bold text-[#0369a1]">
                ✓ {matchedArrival.airline} {matchedArrival.route}・已自動帶入表定 {matchedArrival.time} 抵達（若機票有季調可直接微調）
              </p>
            ) : (
              normalizedArrival.length >= 3 &&
              arrivalSuggestions.length === 0 && (
                <div className="-mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11.5px] font-semibold text-[#64748b]">
                  <span>非內建常用班機，可核對後直接手動填寫時間</span>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `${normalizedArrival} 航班時間`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-extrabold text-[#0369a1] underline"
                  >
                    <span>Google 查 {normalizedArrival}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )
            )}

            {/* 常用沖繩→台灣回程航班快速帶入 */}
            <div>
              <p className="mb-1.5 text-[11.5px] font-bold text-[#64748b]">
                點選常見回程班機，或直接輸入編號／航空公司即時搜尋帶入起飛時間：
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {QUICK_DEPARTURE_CODES.map((code) => {
                  const item = OKINAWA_DEPARTURE_FLIGHTS[code];
                  const active = normalizedDeparture === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleDepartureFlightChange(code)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition active:scale-95 ${
                        active
                          ? 'border-[#0369a1] bg-[#0369a1] text-white'
                          : 'border-[#e2e8f0] bg-white text-[#0f293a]'
                      }`}
                    >
                      {code} · {item.time}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#57534e]">
                  回程航班（選填）
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={departureFlight}
                    onChange={(e) => handleDepartureFlightChange(e.target.value)}
                    placeholder="輸入 CI121 / 星宇 / 高雄"
                    maxLength={20}
                    className="min-h-10 w-full rounded-xl border border-[#e7e2d8] bg-white pl-3 pr-9 text-[14px] font-bold text-[#0f293a] placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#0369a1] focus:outline-none"
                  />
                  {normalizedDeparture ? (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        `${normalizedDeparture} 航班時間`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="在 Google 查詢此回程航班時刻"
                      aria-label="在 Google 查詢回程航班時刻"
                      className="absolute right-1.5 grid h-7 w-7 place-items-center rounded-lg bg-[#f0f9ff] text-[#0369a1] transition active:scale-95"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="pointer-events-none absolute right-2.5 text-[#9ca3af]">
                      <Search className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#57534e]">
                  回程起飛（選填）
                </label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="min-h-10 w-full rounded-xl border border-[#e7e2d8] bg-white px-3 text-[14px] font-bold text-[#0f293a] focus:border-[#0369a1] focus:outline-none"
                />
              </div>
            </div>

            {departureSuggestions.length > 0 && (
              <div className="-mt-1 flex flex-wrap gap-1.5">
                {departureSuggestions.map(({ code, preset }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleDepartureFlightChange(code)}
                    className="rounded-full border border-[#bae6fd] bg-[#f0f9ff] px-2.5 py-1 text-[11.5px] font-extrabold text-[#0c4a6e] transition active:scale-95"
                  >
                    {code} {preset.airline}（{preset.route} {preset.time}）
                  </button>
                ))}
              </div>
            )}

            {matchedDeparture ? (
              <p className="-mt-1.5 text-[11.5px] font-bold text-[#0369a1]">
                ✓ {matchedDeparture.airline} {matchedDeparture.route}・已自動帶入表定 {matchedDeparture.time} 起飛（可依機票微調）
              </p>
            ) : (
              normalizedDeparture.length >= 3 &&
              departureSuggestions.length === 0 && (
                <div className="-mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11.5px] font-semibold text-[#64748b]">
                  <span>非內建常用班機，可核對後直接手動填寫時間</span>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `${normalizedDeparture} 航班時間`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-extrabold text-[#0369a1] underline"
                  >
                    <span>Google 查 {normalizedDeparture}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )
            )}

            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#57534e]">
                到飯店時間／入住備註（選填）
              </label>
              <input
                type="text"
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                placeholder="例：約 14:30 到飯店大廳、先寄放行李再去國際通"
                maxLength={100}
                className="min-h-10 w-full rounded-xl border border-[#e7e2d8] bg-white px-3 text-[13.5px] font-semibold text-[#0f293a] placeholder:font-normal placeholder:text-[#9ca3af] focus:border-[#0369a1] focus:outline-none"
              />
            </div>

            {formError && (
              <p className="text-[12.5px] font-bold text-[#b91c1c]">⚠️ {formError}</p>
            )}
            {savedNotice && (
              <p className="text-[12.5px] font-bold text-[#15803d]">✓ {savedNotice}</p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#0369a1] text-[14px] font-extrabold text-white shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              <Plane className="h-4 w-4" />
              <span>
                {isSaving
                  ? '儲存中...'
                  : savedMine
                  ? '更新我的航班資訊'
                  : '儲存並送出給教練'}
              </span>
            </button>
          </form>
          )}

          {/* 僅兩位帶隊教練（潘潘、家輝）鎖定身分後可見的團員航班總表 */}
          {isLockedCoach && (
            <div className="rounded-2xl border border-[#bae6fd] bg-[#f0f9ff] p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-[14.5px] font-extrabold text-[#0c4a6e]">
                    👑 教練專屬：團員航班＆入住總表
                  </h4>
                  <p className="mt-0.5 text-[11.5px] font-semibold text-[#0369a1]/80">
                    兩位帶隊教練免填，僅列出 {coachOverviewList.length} 位團員回報狀態
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold text-[#0369a1] shadow-2xs">
                  {submittedCount} / {coachOverviewList.length} 已填
                </span>
              </div>

              <div className="space-y-2">
                {coachOverviewList.map(({ member, info }) => (
                  <div
                    key={member.id}
                    className={`rounded-2xl border p-3 ${
                      info
                        ? 'border-[#bae6fd] bg-white'
                        : 'border-dashed border-[#d6d3d1] bg-white/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-extrabold text-[#0f293a]">
                        <span className="shrink-0">{member.emoji}</span>
                        {info?.realName ? (
                          <>
                            <span className="truncate">{info.realName}</span>
                            <span className="shrink-0 rounded-md bg-[#f4f0e8] px-1.5 py-0.5 text-[11px] font-bold text-[#57534e]">
                              {member.name}
                            </span>
                          </>
                        ) : (
                          <span>{member.name}</span>
                        )}
                      </span>
                      {info ? (
                        <span className="rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-[12px] font-extrabold text-[#0369a1]">
                          {info.arrivalTime ? `抵達 ${info.arrivalTime}` : '已填航班'}
                        </span>
                      ) : (
                        <span className="text-[12px] font-semibold text-[#9ca3af]">
                          尚未填寫
                        </span>
                      )}
                    </div>

                    {info && (
                      <div className="mt-1.5 space-y-1 text-[13px] text-[#334155]">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-semibold">
                          <span>
                            ✈️ 去程：
                            <strong className="text-[#0f293a]">
                              {info.arrivalFlight || '未填'}
                            </strong>
                            {info.arrivalTime ? `（${info.arrivalTime}）` : ''}
                          </span>
                          {(info.departureFlight || info.departureTime) && (
                            <span>
                              🛫 回程：
                              <strong className="text-[#0f293a]">
                                {info.departureFlight || '未填'}
                              </strong>
                              {info.departureTime ? `（${info.departureTime}）` : ''}
                            </span>
                          )}
                        </div>
                        {info.checkInNote && (
                          <p className="rounded-xl bg-[#faf7f2] px-2.5 py-1.5 text-[12.5px] font-medium text-[#57534e]">
                            📝 {info.checkInNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// 5.8 Visit Japan Web 住宿資訊一鍵複製卡
// ============================================================================

const VISIT_JAPAN_WEB_FIELDS: {
  id: string;
  label: string;
  value: string;
  display?: string;
  hint?: string;
}[] = [
  {
    id: 'vjw-zip',
    label: '郵遞區號（輸入後點「自動輸入」）',
    value: '9000015',
    display: '900-0015（複製純數字 9000015）',
  },
  {
    id: 'vjw-hotel-en',
    label: '飯店名稱（英文）',
    value: 'Almont Hotel Naha Kenchomae',
  },
  {
    id: 'vjw-hotel-ja',
    label: '飯店名稱（日文）',
    value: 'アルモントホテル那覇県庁前',
  },
  {
    id: 'vjw-addr-en',
    label: '住宿地址（英文）',
    value: '1-3-5 Kumoji, Naha-shi, Okinawa',
  },
  {
    id: 'vjw-addr-ja',
    label: '門牌與飯店（日文後續地址）',
    value: '1-3-5 アルモントホテル那覇県庁前',
    hint: '自動帶出「沖縄県 那覇市 久茂地」後直接貼這段',
  },
  {
    id: 'vjw-phone',
    label: '日本聯絡電話（純數字）',
    value: '0988663811',
    display: '098-866-3811（複製 0988663811）',
  },
];

function VisitJapanWebCopyBox() {
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
      setCopiedFieldId(id);
      setTimeout(() => setCopiedFieldId((cur) => (cur === id ? null : cur)), 1800);
    } catch {
      // 忽略剪貼簿權限錯誤
    }
  };

  return (
    <div className="mb-3 rounded-2xl border border-[#bfdbfe] bg-[#f8fbff] p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="text-[14px] font-extrabold text-[#1e3a8a]">
          📋 VJW 住宿填寫資料（點一下快速複製）
        </h4>
        <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[11px] font-bold text-[#1d4ed8]">
          那霸 OKA
        </span>
      </div>

      <div className="space-y-2">
        {VISIT_JAPAN_WEB_FIELDS.map((field) => {
          const isCopied = copiedFieldId === field.id;
          return (
            <div
              key={field.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-bold text-[#64748b]">{field.label}</p>
                <p className="mt-0.5 break-all text-[13.5px] font-extrabold text-[#0f293a]">
                  {field.display || field.value}
                </p>
                {field.hint && (
                  <p className="mt-0.5 text-[11px] font-medium text-[#0369a1]">
                    {field.hint}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(field.id, field.value)}
                className={`flex min-h-9 shrink-0 items-center gap-1 rounded-xl px-3 text-[12px] font-extrabold transition active:scale-95 ${
                  isCopied
                    ? 'bg-[#dcfce7] text-[#15803d]'
                    : 'bg-[#eff6ff] text-[#1d4ed8]'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>已複製</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>複製</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[12px] font-semibold leading-relaxed text-[#1e40af]">
        💡 填寫提示：入境目的選「觀光」、預計停留填 <strong>4 天</strong>、入境機場選{' '}
        <strong>那霸（OKA）</strong>；完成後請務必把 QR Code 截圖存手機相簿！
      </p>
    </div>
  );
}

// ============================================================================
// 5.9 美食與資料頁簽：可收折區塊外框 (CollapsibleInfoSection)
// ============================================================================

type InfoSectionKey =
  | 'calc'
  | 'flight'
  | 'line'
  | 'rental'
  | 'hotel'
  | 'food'
  | 'market'
  | 'vjw';

interface CollapsibleInfoSectionProps {
  title: string;
  subtitle?: string;
  subtitleClass?: string;
  icon: React.ReactNode;
  iconBgClass: string;
  borderClass?: string;
  shadowClass?: string;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleInfoSection({
  title,
  subtitle,
  subtitleClass = 'text-[#6b7280]',
  icon,
  iconBgClass,
  borderClass = 'border-[#e7e2d8]',
  shadowClass = 'shadow-[0_2px_10px_rgba(12,74,110,0.04)]',
  badge,
  isOpen,
  onToggle,
  children,
}: CollapsibleInfoSectionProps) {
  return (
    <section className={`rounded-3xl border bg-white p-4 ${borderClass} ${shadowClass}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${iconBgClass}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[17.5px] font-bold text-[#0f293a]">{title}</h3>
            {subtitle && (
              <p className={`truncate text-[12px] font-semibold ${subtitleClass}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f4f0e8] text-[#57534e]">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </div>
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </section>
  );
}

// ============================================================================
// 5.10 大翅鯨圖鑑 (WhaleGuideTab - 生態、行為辨識、觀察禮儀與狀態測驗)
// ============================================================================

type WhaleGuideSection = 'behaviors' | 'biology' | 'etiquette' | 'quiz';
type WhaleSafetyCategory = 'all' | 'swim' | 'caution' | 'boat';

interface WhaleBehaviorEntry {
  id: string;
  zhName: string;
  enName: string;
  zoneLabel: string;
  safetyCategory: Exclude<WhaleSafetyCategory, 'all'>;
  statusText: string;
  statusTone: 'safe' | 'caution' | 'boat';
  imageFile: string;
  photoCredit: string;
  summary: string;
  meaning: string;
  underwaterCue: string;
  photoTip: string;
}

const WHALE_ASSET_BASE = `${import.meta.env.BASE_URL}src/assets/images/`;

const WHALE_HERO_IMAGE = `${WHALE_ASSET_BASE}whale_hero_noaa.jpg`;

const WHALE_BEHAVIORS: WhaleBehaviorEntry[] = [
  {
    id: 'breaching',
    zhName: '躍身擊浪',
    enName: 'Breaching',
    zoneLabel: '水面高能量行為',
    safetyCategory: 'boat',
    statusText: '船上遠觀・勿貿然下水',
    statusTone: 'boat',
    imageFile: `${WHALE_ASSET_BASE}whale_breaching_noaa.jpg`,
    photoCredit: '實景攝影：NOAA HIHWNMS（公眾領域）',
    summary: '將身體大幅（常見超過 40% 至近全身）躍出水面並在空中翻轉重擊海面，激起數公尺高浪花。',
    meaning:
      '學界對躍身的確切功能尚無單一定論，常見假說包括：水面撞擊聲可能有助於遠距離聲學聯繫、展示體型或能量、協助脫落老廢角質或體表寄生生物，或屬於幼鯨活動與探索表現。',
    underwaterCue:
      '成鯨體重可達數十噸、落水能量極高；若水下觀察到鯨魚突然加速垂直上衝，可能即將躍出水面，應立即拉開水平距離。',
    photoTip:
      '以船上拍攝最安全清楚：快門拉高至 1/1600s 以上並開啟連拍；有時個體會連續躍身數次，第一跳後可先將鏡頭保持在附近海域觀察。',
  },
  {
    id: 'lobtailing',
    zhName: '鯨尾擊浪',
    enName: 'Lobtailing / Tail Slap',
    zoneLabel: '高能量水面拍擊',
    safetyCategory: 'boat',
    statusText: '高衝擊風險・勿靠近',
    statusTone: 'boat',
    imageFile: `${WHALE_ASSET_BASE}whale_lobtailing_wikimedia.jpg`,
    photoCredit: '實景攝影：Giles Laurent / Wikimedia（CC BY-SA 4.0）',
    summary: '倒立或側身將寬約 4–5 公尺的尾鰭舉出水面，用力拍擊海面發出巨響。',
    meaning:
      '學界推測此行為可能與聲學訊號傳遞、社交或雄性競爭互動有關；若於船隻或泳客接近時出現，亦可能反映干擾或警戒反應（大翅鯨並非固定領地性動物，實際意涵需視情境判讀）。',
    underwaterCue:
      '若原本平緩游動的鯨魚突然連續甩尾、猛拍尾柄或朝人群方向噴出大量氣泡，可能代表受到干擾或進入警戒狀態；安全起見應立刻停止靠近並依教練手勢撤回船邊。',
    photoTip:
      '船上拍攝有機會清楚記錄尾鰭腹面具高度個體辨識度的黑白斑紋與缺刻；水下切勿停留在鯨尾後方擺動與尾流範圍內。',
  },
  {
    id: 'pec-slap',
    zhName: '胸鰭拍水',
    enName: 'Pectoral Fin Slap',
    zoneLabel: '水面拍擊行為',
    safetyCategory: 'caution',
    statusText: '謹慎觀察・保持側距',
    statusTone: 'caution',
    imageFile: `${WHALE_ASSET_BASE}whale_pec_slap_noaa.jpg`,
    photoCredit: '實景攝影：NOAA HIHWNMS（公眾領域）',
    summary: '側躺或仰躺於海面，將可達體長約三分之一的長胸鰭高舉空中並反覆拍擊水面。',
    meaning:
      '目前多推測與近距離聲學訊號或社交互動有關，在獨行個體、求偶競爭群體或母子鯨皆曾觀察到，但確切生物學功能仍未完全定論。',
    underwaterCue:
      '此時個體動作幅度大且胸鰭拍擊具潛在衝擊風險；須待船長與教練確認周遭無其他高速靠近個體後，再決定是否由側前方保持安全距離緩慢入水觀察。',
    photoTip:
      '水下拍攝可由側面廣角捕捉長胸鰭展開與光影層次，務必避開胸鰭拍擊的正上方與正下方。',
  },
  {
    id: 'spyhopping',
    zhName: '浮窺行為',
    enName: 'Spyhopping',
    zoneLabel: '垂直探頭行為',
    safetyCategory: 'swim',
    statusText: '動作緩慢・適合靜止觀察',
    statusTone: 'safe',
    imageFile: `${WHALE_ASSET_BASE}whale_spyhop_noaa.jpg`,
    photoCredit: '實景攝影：NOAA National Marine Sanctuaries（公眾領域）',
    summary: '身體垂直上浮，緩慢將頭部與眼睛探出水面停留數秒後，再垂直沉回水中。',
    meaning:
      '研究普遍推測可能與觀察水面周遭環境、辨識船隻或聲音來源有關；不過鯨魚的實際動機難以直接證實，仍須將其視為大型野生動物並維持安全距離。',
    underwaterCue:
      '水下若見鯨魚放慢速度、側身望向泳客並緩緩靠近，保持靜止、減少動作與噪音通常較不易造成驚擾，也較有機會自然延長相遇時間。',
    photoTip:
      '雙手穩住相機、停止踢蛙鞋並輕柔呼吸，用廣角鏡預留周圍藍水空間，有機會拍到自然對視的構圖。',
  },
  {
    id: 'mother-calf',
    zhName: '母子靜止休息',
    enName: 'Resting Mother & Calf',
    zoneLabel: '育幼期低干擾觀察',
    safetyCategory: 'swim',
    statusText: '高度敏感・嚴禁下潛打擾',
    statusTone: 'safe',
    imageFile: `${WHALE_ASSET_BASE}whale_mother_calf_noaa.jpg`,
    photoCredit: '實景攝影：NOAA HIHWNMS（公眾領域）',
    summary: '常見母鯨懸停於約 5–15 公尺深處休息，幼鯨多停留在母鯨胸鰭附近，每隔數分鐘（約 3–6 分鐘）自行浮上水面換氣。',
    meaning:
      '新生幼鯨閉氣能力仍在發展且需頻繁哺乳與休息；沖繩慶良間一帶冬季水溫較暖、部分珊瑚礁周圍風浪相對平緩，被認為較有利於母子鯨減少能量消耗。',
    underwaterCue:
      '這類相遇對人為干擾高度敏感。母鯨通常會留意周遭動靜並保護幼鯨；若泳客隨意下潛逼近，容易引發護幼反應或促使母鯨帶離幼鯨而結束相遇。',
    photoTip:
      '全程維持水面水平浮潛、減少水花與動作，待幼鯨自然浮上水面換氣時以自然光平視拍攝，切勿主動游近。',
  },
  {
    id: 'fluke-dive',
    zhName: '舉尾深潛',
    enName: 'Fluke-Up Deep Dive',
    zoneLabel: '換氣週期結束',
    safetyCategory: 'swim',
    statusText: '即將下潛・停留時間不一',
    statusTone: 'safe',
    imageFile: `${WHALE_ASSET_BASE}whale_fluke_dive_noaa.jpg`,
    photoCredit: '實景攝影：NOAA HIHWNMS（公眾領域）',
    summary: '連續數次水面換氣後，明顯高拱背部（Peduncle Arch），隨後將整個尾鰭舉出水面並以較陡角度下潛。',
    meaning:
      '通常表示這輪水面換氣結束、個體準備進行角度較陡的下潛，之後可能在水下停留數分鐘至十餘分鐘以上，實際時間依活動狀態而異。',
    underwaterCue:
      '水下看到鯨魚頭部下壓、背部大幅彎曲準備下潛時，切勿追著尾鰭下壓；保持原位目送即可安全記錄背影與尾鰭展開的瞬間。',
    photoTip:
      '舉尾那 2–3 秒是拍攝尾鰭腹面紋路（Fluke ID）與水下光束的絕佳時機，建議提前將快門設在 1/320s 以上等待。',
  },
  {
    id: 'heat-run',
    zhName: '競爭追逐群',
    enName: 'Competitive Group / Heat Run',
    zoneLabel: '多鯨高速競逐',
    safetyCategory: 'caution',
    statusText: '高速移動・嚴格聽從教練',
    statusTone: 'caution',
    imageFile: `${WHALE_ASSET_BASE}whale_heat_run_noaa.png`,
    photoCredit: '實景攝影：Ed Lyman / NOAA HIHWNMS（公眾領域）',
    summary: '數頭（有時可達 5–10 頭以上）雄鯨高速追逐一頭核心雌鯨，常伴隨頻繁噴氣、身體推擠與大量氣泡。',
    meaning:
      '冬季繁殖季常見的雄性競爭群體，多頭雄鯨彼此競逐，爭取成為緊隨核心雌鯨身旁的「主護衛鯨（Primary Escort）」。',
    underwaterCue:
      '通常移動速度快、方向可能突變且具碰撞風險，難以跟游；是否適合下水須由船長與教練評估，僅在允許時由側前方保持安全距離短暫觀察並迅速上船。',
    photoTip:
      '提前確認相機已開機並切換廣角錄影或高速連拍，入水後身體貼近水面、絕不阻擋行進路徑，專注記錄多頭個體通過的畫面。',
  },
];

const WHALE_BIOLOGY_FACTS = [
  { label: '成鯨體長', value: '約 12–16 m', note: '雌鯨平均略大於雄鯨（約多 1 公尺左右）' },
  { label: '成鯨體重', value: '約 25–35 t', note: '大型個體可達近 40 噸；新生幼鯨約 4 m、1 噸上下' },
  { label: '胸鰭長度', value: '約 4–5 m', note: '可達體長約三分之一；屬名 Megaptera 意為「大翼」' },
  { label: '常見潛水時間', value: '約 5–20 min', note: '依活動狀態而異；幼鯨多每 3–6 分鐘浮上換氣' },
];

const WHALE_ETIQUETTE_RULES = [
  {
    num: '01.',
    title: '絕不追逐、不攔截游動路線',
    body: '永遠由側前方適當距離靜音入水，把主導權留給鯨魚。切勿猛踢蛙鞋從正後方追趕或包圍鯨群。',
  },
  {
    num: '02.',
    title: '滑入式靜音入水（Slide-in）',
    body: '禁止跨步式跳水或翻滾落水，避免巨大水花與氣泡驚擾鯨魚；入水後保持身體水平、動作緩慢。',
  },
  {
    num: '03.',
    title: '面對母子鯨維持水面浮潛，不隨意下潛',
    body: '母子鯨對上方干擾特別敏感，任意自由潛水下壓容易引發護幼反應或促使母鯨帶幼鯨離去，縮短觀察機會。',
  },
  {
    num: '04.',
    title: '全程關閉閃光燈與水下補光燈',
    body: '嚴禁使用閃光燈（Strobe）或強力手電筒照射鯨魚眼睛，善用慶良間高能見度的自然光拍攝即可。',
  },
  {
    num: '05.',
    title: '留意警戒與干擾徵兆、即時拉開距離',
    body: '原則維持安全觀察距離（依現場船隻規範；若鯨魚主動靠近則保持靜止、絕不觸碰）。若出現連續拍尾、噴出大量氣泡或突然轉向加速等變化，立刻配合退開。',
  },
  {
    num: '06.',
    title: '統一聽從船長與帶隊教練手勢',
    body: '沖繩追鯨有嚴格海域規範，每次入水人數、停留時間與上船撤離時機皆以船長與教練指示為準；且全團禁用長蛙鞋。',
  },
];

interface WhaleQuizItem {
  id: string;
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const WHALE_QUIZ_ITEMS: WhaleQuizItem[] = [
  {
    id: 'q1',
    question: '水下看到母鯨停在約 10 公尺深處休息、幼鯨自行浮上水面換氣時，最合適的做法是？',
    options: [
      '立刻深潛到母鯨正上方近距離自拍',
      '保持水面水平靜止浮潛，輕柔呼吸並保持安全距離',
      '大力踢蛙鞋游到幼鯨與母鯨中間',
    ],
    correctIdx: 1,
    explanation:
      '母子鯨休息時對上方下潛與明顯水花相當敏感。維持水面平穩浮潛、減少動作與噪音，較能降低干擾並自然延續觀察時間。',
  },
  {
    id: 'q2',
    question: '原本平穩游動的大翅鯨突然大力拍尾（Lobtailing）並朝人群吐出一大片氣泡幕，最謹慎的判讀是？',
    options: [
      '牠正在開心邀請大家游更近一起玩',
      '可能代表受到干擾或處於高警戒狀態，應停止靠近並依教練指示退開',
      '牠正準備在原地睡覺',
    ],
    correctIdx: 1,
    explanation:
      '在近距離接觸時突然出現頻繁拍尾或大量氣泡噴吐，學界與現場實務多視為可能的干擾或警戒徵兆；不論實際動機為何，主動拉開距離都是保護人鯨安全的正確做法。',
  },
  {
    id: 'q3',
    question: '船邊看到大翅鯨連續躍身擊浪（Breaching），這時候應該怎麼做？',
    options: [
      '趁浪花很大立刻跳下水游到落水點旁拍攝',
      '先留在船上安全觀賞與拍攝，絕不貿然靠近落水範圍',
      '開閃光燈朝海面吸引牠游向船邊',
    ],
    correctIdx: 1,
    explanation:
      '成鯨體重可達 25–35 噸以上，躍身落水能量極高且可能再次跳躍，留在船上遠距觀賞並以高速快門拍攝最安全。',
  },
  {
    id: 'q4',
    question: '看到大翅鯨高拱背部並將整個尾鰭垂直舉出水面（Fluke-up），代表接下來最可能發生什麼？',
    options: [
      '牠多半準備進行角度較陡的下潛，此時也適合記錄尾鰭腹面花紋',
      '牠準備停在原地不動讓大家摸背',
      '牠受傷了需要人類靠近協助',
    ],
    correctIdx: 0,
    explanation:
      '拱背舉尾通常表示這輪水面換氣結束、準備下潛（停留時間從數分鐘到十餘分鐘不等）；成鯨尾鰭腹面的黑白斑紋與後緣缺刻具高度個體辨識度，也是海洋研究常用的紀錄部位。',
  },
];

function WhaleGuidePhoto({
  src,
  alt,
  aspectClass = 'aspect-[4/3]',
  credit,
  creditPosition = 'bottom',
}: {
  src: string;
  alt: string;
  aspectClass?: string;
  credit?: string;
  creditPosition?: 'bottom' | 'top';
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex ${aspectClass} w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#0c4a6e] via-[#0369a1] to-[#082f49] px-4 text-center text-white`}
      >
        <Waves className="h-7 w-7 text-[#bae6fd]" />
        <span className="text-[13px] font-bold text-[#e0f2fe]">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${aspectClass} w-full overflow-hidden bg-[#0c4a6e]`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {credit && (
        <span
          className={`pointer-events-none absolute right-2 ${
            creditPosition === 'top' ? 'top-2' : 'bottom-2'
          } rounded-md bg-[#061824]/65 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-[2px]`}
        >
          {credit}
        </span>
      )}
    </div>
  );
}

function WhaleGuideTab() {
  const [section, setSection] = useState<WhaleGuideSection>('behaviors');
  const [safetyFilter, setSafetyFilter] = useState<WhaleSafetyCategory>('all');
  const [expandedBehaviorId, setExpandedBehaviorId] = useState<string>('breaching');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  const filteredBehaviors = useMemo(() => {
    if (safetyFilter === 'all') return WHALE_BEHAVIORS;
    return WHALE_BEHAVIORS.filter((b) => b.safetyCategory === safetyFilter);
  }, [safetyFilter]);

  const answeredCount = Object.keys(quizAnswers).length;
  const correctCount = WHALE_QUIZ_ITEMS.filter(
    (q) => quizAnswers[q.id] === q.correctIdx
  ).length;

  const sectionTabs: { id: WhaleGuideSection; label: string }[] = [
    { id: 'behaviors', label: '行為辨識' },
    { id: 'biology', label: '生態檔案' },
    { id: 'etiquette', label: '攝影禮儀' },
    { id: 'quiz', label: '狀態測驗' },
  ];

  const filterButtons: { id: WhaleSafetyCategory; label: string }[] = [
    { id: 'all', label: '全部行為' },
    { id: 'swim', label: '適合下水' },
    { id: 'caution', label: '謹慎警戒' },
    { id: 'boat', label: '船上觀賞' },
  ];

  return (
    <div className="space-y-4">
      {/* 視覺主圖 Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#0c4a6e]/15 bg-[#082f49] shadow-[0_8px_24px_rgba(8,47,73,0.16)]">
        <WhaleGuidePhoto
          src={WHALE_HERO_IMAGE}
          alt="大翅鯨母子共游水下實景攝影（NOAA）"
          aspectClass="aspect-[16/10]"
          credit="實景攝影：NOAA HIHWNMS（公眾領域）"
          creditPosition="top"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061824]/92 via-[#061824]/42 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[11.5px] font-semibold tracking-wide text-[#bae6fd]">
            Megaptera novaeangliae · 慶良間追鯨水下攝影手冊
          </p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight [text-wrap:balance]">
            大翅鯨生態與行為圖鑑
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-[#e0f2fe]/95">
            認識躍身擊浪、鯨尾擊浪與母子休息等常見行為及安全判讀原則，讓水下觀察更安心低干擾。
          </p>
        </div>
      </section>

      {/* 分頁切換 Segmented Control */}
      <div
        role="tablist"
        aria-label="大翅鯨圖鑑章節"
        className="grid grid-cols-4 gap-1 rounded-2xl border border-[#e7e2d8] bg-[#f4f0e8] p-1"
      >
        {sectionTabs.map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(tab.id)}
              className={`min-h-[42px] whitespace-nowrap rounded-xl px-2 text-[13px] font-bold transition-colors ${
                active
                  ? 'bg-[#0369a1] text-white shadow-xs'
                  : 'text-[#57534e] hover:text-[#0f293a]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== 1. 行為辨識 ==================== */}
      {section === 'behaviors' && (
        <div className="space-y-3.5">
          {/* 狀態篩選列 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {filterButtons.map((btn) => {
              const active = safetyFilter === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSafetyFilter(btn.id)}
                  className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl border px-3 text-[12.5px] font-bold transition-colors ${
                    active
                      ? 'border-[#0369a1] bg-[#0f293a] text-white'
                      : 'border-[#e7e2d8] bg-white text-[#57534e]'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* 行為圖鑑卡片清單 */}
          <div className="space-y-3.5">
            {filteredBehaviors.map((item) => {
              const isExpanded = expandedBehaviorId === item.id;
              const statusColorClass =
                item.statusTone === 'safe'
                  ? 'text-[#0f766e]'
                  : item.statusTone === 'caution'
                  ? 'text-[#b45309]'
                  : 'text-[#b91c1c]';

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-[#e7e2d8] bg-white shadow-[0_2px_10px_rgba(12,74,110,0.05)]"
                >
                  <WhaleGuidePhoto
                    src={item.imageFile}
                    alt={`${item.zhName}（${item.enName}）`}
                    aspectClass="aspect-[4/3]"
                    credit={item.photoCredit}
                  />

                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-[#64748b]">
                      <span className="truncate">
                        {item.enName} · {item.zoneLabel}
                      </span>
                      <span className={`shrink-0 font-extrabold ${statusColorClass}`}>
                        {item.statusText}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <h2 className="text-[19px] font-extrabold text-[#0f293a]">
                        {item.zhName}
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBehaviorId(isExpanded ? '' : item.id)
                        }
                        aria-expanded={isExpanded}
                        className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl bg-[#f4f0e8] px-3 text-[12.5px] font-bold text-[#0f293a] transition active:scale-95"
                      >
                        <span>{isExpanded ? '收合解析' : '水下判讀'}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    <p className="mt-2 text-[14px] leading-relaxed text-[#44403c]">
                      {item.summary}
                    </p>

                    {isExpanded && (
                      <div className="mt-3.5 divide-y divide-[#ede8df] border-t border-[#ede8df] pt-1 text-[13.5px] leading-relaxed text-[#334155]">
                        <div className="py-2.5">
                          <h3 className="text-[12.5px] font-extrabold text-[#0f293a]">
                            行為意涵
                          </h3>
                          <p className="mt-1">{item.meaning}</p>
                        </div>
                        <div className="py-2.5">
                          <h3 className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#0369a1]">
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                            <span>水下狀態判讀</span>
                          </h3>
                          <p className="mt-1">{item.underwaterCue}</p>
                        </div>
                        <div className="pt-2.5">
                          <h3 className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#0f766e]">
                            <Camera className="h-3.5 w-3.5 shrink-0" />
                            <span>水下攝影建議</span>
                          </h3>
                          <p className="mt-1">{item.photoTip}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="px-1 text-[12px] leading-relaxed text-[#64748b]">
            註：多數大翅鯨水面與水下行為的確切生物學功能仍在持續研究中，上列解析以現行海洋生態觀察與研究假說為基礎；實際下水與距離控制請一律以現場船長與教練判斷為準。
          </p>
        </div>
      )}

      {/* ==================== 2. 生態檔案 ==================== */}
      {section === 'biology' && (
        <div className="space-y-4">
          {/* 基本數據 2x2 網格 */}
          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">
              鬚鯨科 · 北太平洋族群基礎數據
            </p>
            <h2 className="mt-0.5 text-[19px] font-extrabold text-[#0f293a]">
              大翅鯨基本檔案
            </h2>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {WHALE_BIOLOGY_FACTS.map((fact) => (
                <div
                  key={fact.label}
                  className="rounded-2xl border border-[#ede8df] bg-[#faf7f2] p-3"
                >
                  <p className="text-[12px] font-semibold text-[#64748b]">{fact.label}</p>
                  <p className="mt-1 text-[21px] font-extrabold tracking-tight text-[#0369a1] tabular-nums">
                    {fact.value}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-[#57534e]">{fact.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 慶良間遷徙故事 */}
          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#0369a1]">
              每年 1 月至 3 月高峰 · 長達數千公里南下遷徙
            </p>
            <h2 className="mt-0.5 text-[18px] font-extrabold text-[#0f293a]">
              為什麼冬天會來到沖繩慶良間？
            </h2>
            <div className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-[#44403c]">
              <p>
                每年夏秋兩季，西北太平洋族群的大翅鯨主要在堪察加半島、阿留申群島、白令海與阿拉斯加周邊等高緯度海域大量進食磷蝦與小型魚群，儲存厚實的皮下脂肪。
              </p>
              <p>
                入冬後牠們南下數千公里至水溫約 20–22°C、珊瑚礁地形相對平緩的沖繩慶良間諸島周邊海域，進行<strong>繁殖互動、分娩與育幼</strong>。冬季繁殖期間成鯨極少進食，主要仰賴夏季儲存的脂肪能量，因此降低干擾、減少母子鯨額外體力消耗相當重要。
              </p>
            </div>
          </section>

          {/* 三大辨識特徵 */}
          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#64748b]">
              水下觀察與紀錄重點
            </p>
            <h2 className="mt-0.5 text-[18px] font-extrabold text-[#0f293a]">
              三大招牌身體特徵
            </h2>
            <div className="mt-3 divide-y divide-[#ede8df] text-[14px] leading-relaxed text-[#44403c]">
              <div className="pb-3">
                <h3 className="font-extrabold text-[#0f293a]">
                  01. 尾鰭腹面花紋（Photo-ID 個體辨識）
                </h3>
                <p className="mt-1 text-[13.5px]">
                  成鯨尾鰭腹面的黑白斑塊與後緣鋸齒缺刻具高度個體差異，常被海洋研究用於辨識個體與追蹤遷徙；拍攝清晰尾鰭照片也能留下珍貴的生態紀錄。
                </p>
              </div>
              <div className="py-3">
                <h3 className="font-extrabold text-[#0f293a]">
                  02. 超長胸鰭與前緣結節（Tubercles）
                </h3>
                <p className="mt-1 text-[13.5px]">
                  胸鰭可達 4–5 公尺（北太平洋個體常見背面深色、腹面帶白斑），前緣排列著瘤狀結節；流體力學研究顯示其有助於延緩水流失速、提升轉向靈活度。
                </p>
              </div>
              <div className="pt-3">
                <h3 className="font-extrabold text-[#0f293a]">
                  03. 雄鯨水下歌聲（Whale Song）
                </h3>
                <p className="mt-1 text-[13.5px]">
                  冬季在慶良間水下常能聽見雄鯨發出具重複結構的鳴唱，單輪旋律可持續約 5–30 分鐘並反覆循環；學界對歌聲的具體功能（吸引異性或雄性間互動）仍在持續研究中。
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ==================== 3. 攝影禮儀 ==================== */}
      {section === 'etiquette' && (
        <div className="space-y-4">
          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#0369a1]">
              Okinawa Whale Swim Etiquette · 尊重野生動物
            </p>
            <h2 className="mt-0.5 text-[19px] font-extrabold text-[#0f293a]">
              沖繩追鯨觀察與水下禮儀
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#57534e]">
              理想的水下紀錄，來自在低干擾前提下與鯨魚自然相遇的時刻。出發前請全團熟記以下 6 項原則：
            </p>

            <ol className="mt-3 divide-y divide-[#ede8df]">
              {WHALE_ETIQUETTE_RULES.map((rule) => (
                <li key={rule.num} className="py-3 first:pt-2 last:pb-0">
                  <h3 className="text-[15px] font-extrabold text-[#0f293a]">
                    <span className="mr-1.5 font-mono text-[#0369a1] tabular-nums">
                      {rule.num}
                    </span>
                    {rule.title}
                  </h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[#57534e]">
                    {rule.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <p className="text-[12px] font-semibold text-[#0f766e]">
              水下攝影實戰參數參考
            </p>
            <h2 className="mt-0.5 text-[18px] font-extrabold text-[#0f293a]">
              慶良間追鯨拍攝小抄
            </h2>
            <div className="mt-3 divide-y divide-[#ede8df] text-[13.5px] leading-relaxed text-[#44403c]">
              <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                <span className="shrink-0 font-bold text-[#0f293a]">建議焦段</span>
                <span className="text-right">超廣角 14–24mm、魚眼或運動相機超廣角模式</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <span className="shrink-0 font-bold text-[#0f293a]">快門與光圈</span>
                <span className="text-right tabular-nums">1/250s–1/500s · F5.6–F8 · 自動 ISO 上限 1600</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <span className="shrink-0 font-bold text-[#0f293a]">光線與構圖</span>
                <span className="text-right">關閃光燈、順光拍清澈細節，或逆光拍慶良間丁達爾光束</span>
              </div>
              <div className="flex items-start justify-between gap-3 pt-2.5">
                <span className="shrink-0 font-bold text-[#0f293a]">裝備規範</span>
                <span className="text-right">使用一般蛙鞋（禁止長蛙鞋），防寒衣與手腕防丟繩必備</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ==================== 4. 狀態測驗 ==================== */}
      {section === 'quiz' && (
        <div className="space-y-3.5">
          <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold text-[#0369a1]">
                  出海前實戰情境練習
                </p>
                <h2 className="mt-0.5 text-[19px] font-extrabold text-[#0f293a]">
                  水下鯨魚狀態判讀測驗
                </h2>
              </div>
              <span className="text-[14px] font-extrabold text-[#0369a1] tabular-nums">
                {correctCount} / {WHALE_QUIZ_ITEMS.length}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#57534e]">
              點選各題最合適的水下應對方式，確認上船前都已掌握大翅鯨訊號。
            </p>
          </section>

          {WHALE_QUIZ_ITEMS.map((q, qIdx) => {
            const picked = quizAnswers[q.id];
            const isAnswered = typeof picked === 'number';
            const isCorrect = picked === q.correctIdx;

            return (
              <section
                key={q.id}
                className="rounded-3xl border border-[#e7e2d8] bg-white p-4"
              >
                <p className="text-[12px] font-bold text-[#64748b] tabular-nums">
                  情境 0{qIdx + 1} / 0{WHALE_QUIZ_ITEMS.length}
                </p>
                <h3 className="mt-1 text-[15.5px] font-extrabold leading-snug text-[#0f293a]">
                  {q.question}
                </h3>

                <div className="mt-3 space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const selected = picked === optIdx;
                    const showRight = isAnswered && optIdx === q.correctIdx;
                    const showWrong = selected && optIdx !== q.correctIdx;

                    let btnClass =
                      'border-[#e7e2d8] bg-[#faf7f2] text-[#0f293a] hover:border-[#0369a1]';
                    if (showRight) {
                      btnClass = 'border-[#0f766e] bg-[#f0fdfa] text-[#115e59]';
                    } else if (showWrong) {
                      btnClass = 'border-[#dc2626] bg-[#fef2f2] text-[#991b1b]';
                    }

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                        }
                        className={`flex min-h-[46px] w-full items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition-colors ${btnClass}`}
                      >
                        <span>{opt}</span>
                        {showRight && <Check className="h-4 w-4 shrink-0 text-[#0f766e]" />}
                      </button>
                    );
                  })}
                </div>

                {isAnswered && (
                  <p
                    className={`mt-3 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      isCorrect
                        ? 'bg-[#f0fdfa] text-[#115e59]'
                        : 'bg-[#fffbeb] text-[#92400e]'
                    }`}
                  >
                    <strong>{isCorrect ? '判讀正確：' : '提醒：'}</strong>
                    {q.explanation}
                  </p>
                )}
              </section>
            );
          })}

          {answeredCount === WHALE_QUIZ_ITEMS.length && (
            <section className="rounded-3xl border border-[#bae6fd] bg-[#f0f9ff] p-4 text-center">
              <p className="text-[16px] font-extrabold text-[#0c4a6e] tabular-nums">
                完成測驗：{correctCount} / {WHALE_QUIZ_ITEMS.length} 題正確
              </p>
              <p className="mt-1 text-[13px] text-[#0369a1]">
                {correctCount === WHALE_QUIZ_ITEMS.length
                  ? '滿分過關！你已經準備好在慶良間優雅迎接大翅鯨了。'
                  : '可以回頭複習「行為辨識」與「攝影禮儀」，出海時更有把握。'}
              </p>
              <button
                type="button"
                onClick={() => setQuizAnswers({})}
                className="mt-3 min-h-[42px] rounded-xl bg-[#0369a1] px-5 text-[13.5px] font-bold text-white transition active:scale-95"
              >
                重新測驗
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. 主應用程式 (App)
// ============================================================================

export default function App() {
  const todayStr = useMemo(() => getLocalTodayStr(), []);
  const [activeGroupId, setActiveGroupId] = useState(() => {
    const matched = TRIP_GROUPS.find((g) => {
      const start = g.daysMeta[0].isoDate;
      const end = g.daysMeta[g.daysMeta.length - 1].isoDate;
      return todayStr >= start && todayStr <= end;
    });
    return matched ? matched.id : TRIP_GROUPS[0].id;
  });

  const activeGroup = useMemo(
    () => TRIP_GROUPS.find((g) => g.id === activeGroupId) || TRIP_GROUPS[0],
    [activeGroupId]
  );

  const tripDays = useMemo(() => buildTripDays(activeGroup), [activeGroup]);
  const tripStatus = useMemo(
    () => getTripStatus(todayStr, tripDays, `${activeGroup.label} ${activeGroup.dateRange}`),
    [todayStr, tripDays, activeGroup]
  );

  const [activeTab, setActiveTab] = useState<'today' | 'itinerary' | 'map' | 'whales' | 'info' | 'checklist'>('today');
  const [selectedDayIdx, setSelectedDayIdx] = useState(tripStatus.defaultDayIdx);

  // 雲端登入與跨裝置即時同步狀態
  const [user, setUser] = useState<AppUser | null>(null);
  const [claims, setClaims] = useState<Record<string, MemberClaim>>({});
  const [checkData, setCheckData] = useState<Record<string, MemberChecklistState>>({});
  const [gameScores, setGameScores] = useState<Record<string, GameScoreEntry>>({});
  const [flights, setFlights] = useState<Record<string, MemberFlightInfo>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('okinawa_whale_avatars_v1');
      return saved ? (JSON.parse(saved) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  // 介面互動與表單狀態
  const [previewMemberId, setPreviewMemberId] = useState<string>(MEMBERS[0].id);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [cropTargetMember, setCropTargetMember] = useState<Member | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [showCoachPanel, setShowCoachPanel] = useState(false);
  const [coachPinInput, setCoachPinInput] = useState('');
  const [coachPinError, setCoachPinError] = useState<string | null>(null);
  const [isCoachUnlocked, setIsCoachUnlocked] = useState(false);
  const [openInfoSections, setOpenInfoSections] = useState<Record<InfoSectionKey, boolean>>({
    calc: true,
    flight: false,
    line: false,
    rental: false,
    hotel: false,
    food: false,
    market: false,
    vjw: false,
  });
  const calcRef = useRef<HTMLElement | null>(null);

  const toggleInfoSection = useCallback((key: InfoSectionKey) => {
    setOpenInfoSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setAllInfoSections = useCallback((open: boolean) => {
    setOpenInfoSections({
      calc: open,
      flight: open,
      line: open,
      rental: open,
      hotel: open,
      food: open,
      market: open,
      vjw: open,
    });
  }, []);

  // (1) 初始化驗證並監聽登入狀態（若尚未設定 Firebase 則自動切換為本機儲存模式）
  useEffect(() => {
    if (!auth) {
      setUser({ uid: 'local-device' });
      try {
        const savedClaims = localStorage.getItem('okinawa_whale_claims_v1');
        if (savedClaims) setClaims(JSON.parse(savedClaims) as Record<string, MemberClaim>);
        const savedChecks = localStorage.getItem('okinawa_whale_checks_v1');
        if (savedChecks) setCheckData(JSON.parse(savedChecks) as Record<string, MemberChecklistState>);
        const savedScores = localStorage.getItem('okinawa_whale_scores_v1');
        if (savedScores) setGameScores(JSON.parse(savedScores) as Record<string, GameScoreEntry>);
        const savedFlights = localStorage.getItem('okinawa_whale_flights_v1');
        if (savedFlights) setFlights(JSON.parse(savedFlights) as Record<string, MemberFlightInfo>);
      } catch {
        // 忽略本機讀取異常
      }
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('驗證失敗:', err);
        setSyncError('連線驗證異常，請稍後重新整理頁面。');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? { uid: fbUser.uid } : null);
    });
    return () => unsubscribe();
  }, []);

  // (2) 驗證完成後，即時監聽全團認領狀態與打包清單
  useEffect(() => {
    if (!user || !db) return;

    const claimsCol = collection(db, 'artifacts', appId, 'public', 'data', 'member_claims');
    const unsubClaims = onSnapshot(
      claimsCol,
      (snapshot) => {
        const nextClaims: Record<string, MemberClaim> = {};
        snapshot.forEach((docSnap) => {
          nextClaims[docSnap.id] = docSnap.data() as MemberClaim;
        });
        setClaims(nextClaims);
      },
      (err) => {
        console.error('同步成員認領狀態失敗:', err);
        setSyncError('無法取得最新認領狀態，請確認網路連線。');
      }
    );

    const checklistsCol = collection(db, 'artifacts', appId, 'public', 'data', 'member_checklists');
    const unsubChecklists = onSnapshot(
      checklistsCol,
      (snapshot) => {
        const nextCheckData: Record<string, MemberChecklistState> = {};
        snapshot.forEach((docSnap) => {
          nextCheckData[docSnap.id] = docSnap.data() as MemberChecklistState;
        });
        setCheckData(nextCheckData);
      },
      (err) => {
        console.error('同步裝備清單失敗:', err);
      }
    );

    const scoresCol = collection(db, 'artifacts', appId, 'public', 'data', 'whale_game_scores');
    const unsubScores = onSnapshot(
      scoresCol,
      (snapshot) => {
        const nextScores: Record<string, GameScoreEntry> = {};
        snapshot.forEach((docSnap) => {
          nextScores[docSnap.id] = docSnap.data() as GameScoreEntry;
        });
        setGameScores(nextScores);
      },
      (err) => {
        console.error('同步小遊戲排行榜失敗:', err);
      }
    );

    const avatarsCol = collection(db, 'artifacts', appId, 'public', 'data', 'member_avatars');
    const unsubAvatars = onSnapshot(
      avatarsCol,
      (snapshot) => {
        const nextAvatars: Record<string, string> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (typeof data?.dataUrl === 'string') nextAvatars[docSnap.id] = data.dataUrl;
        });
        setAvatars(nextAvatars);
        try {
          localStorage.setItem('okinawa_whale_avatars_v1', JSON.stringify(nextAvatars));
        } catch {
          // 忽略儲存空間限制
        }
      },
      (err) => {
        console.error('同步火柴人頭像失敗:', err);
      }
    );

    return () => {
      unsubClaims();
      unsubChecklists();
      unsubScores();
      unsubAvatars();
    };
  }, [user]);

  // 計算目前團別中，本裝置已認領的成員身分
  const myClaimedMemberId = useMemo(() => {
    if (!user) return null;
    const found = MEMBERS.find(
      (m) => claims[`${activeGroupId}_${m.id}`]?.ownerUid === user.uid
    );
    return found ? found.id : null;
  }, [claims, activeGroupId, user]);

  const myClaimedMember = useMemo(
    () => (myClaimedMemberId ? MEMBERS.find((m) => m.id === myClaimedMemberId) || null : null),
    [myClaimedMemberId]
  );

  const isLockedCoach = Boolean(myClaimedMemberId && isCoachMember(myClaimedMemberId));
  const isMemberLocked = Boolean(myClaimedMemberId);
  const activeMemberId = myClaimedMemberId || previewMemberId;

  // (3) 航班資訊即時同步：僅兩位已鎖定的帶隊教練會讀取全團總表，一般團員只讀取自己的紀錄
  useEffect(() => {
    if (!user || !db) return;
    if (!myClaimedMemberId) {
      setFlights({});
      return;
    }

    if (isLockedCoach) {
      const flightsCol = collection(db, 'artifacts', appId, 'public', 'data', 'member_flights');
      const unsubAllFlights = onSnapshot(
        flightsCol,
        (snapshot) => {
          const nextFlights: Record<string, MemberFlightInfo> = {};
          snapshot.forEach((docSnap) => {
            nextFlights[docSnap.id] = docSnap.data() as MemberFlightInfo;
          });
          setFlights(nextFlights);
        },
        (err) => {
          console.error('同步全團航班資訊失敗:', err);
        }
      );
      return () => unsubAllFlights();
    }

    const myKey = `${activeGroupId}_${myClaimedMemberId}`;
    const myFlightRef = doc(db, 'artifacts', appId, 'public', 'data', 'member_flights', myKey);
    const unsubMyFlight = onSnapshot(
      myFlightRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setFlights({ [myKey]: docSnap.data() as MemberFlightInfo });
        } else {
          setFlights({});
        }
      },
      (err) => {
        console.error('同步個人航班資訊失敗:', err);
      }
    );
    return () => unsubMyFlight();
  }, [user, myClaimedMemberId, isLockedCoach, activeGroupId]);

  // 儲存個人航班與抵達資訊（需鎖定身分）
  const handleSaveFlight = useCallback(
    async (form: {
      realName: string;
      arrivalFlight: string;
      arrivalTime: string;
      departureFlight: string;
      departureTime: string;
      checkInNote: string;
    }): Promise<boolean> => {
      if (!user || !myClaimedMember) return false;
      const flightKey = `${activeGroupId}_${myClaimedMember.id}`;
      const payload: MemberFlightInfo = {
        groupId: activeGroupId,
        memberId: myClaimedMember.id,
        memberName: myClaimedMember.name,
        realName: form.realName,
        arrivalFlight: form.arrivalFlight,
        arrivalTime: form.arrivalTime,
        departureFlight: form.departureFlight,
        departureTime: form.departureTime,
        checkInNote: form.checkInNote,
        updatedAt: Date.now(),
      };

      if (!db) {
        setFlights((prev) => {
          const next = { ...prev, [flightKey]: payload };
          try {
            localStorage.setItem('okinawa_whale_flights_v1', JSON.stringify(next));
          } catch {
            // 忽略儲存限制
          }
          return next;
        });
        return true;
      }

      try {
        const flightRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'member_flights',
          flightKey
        );
        await setDoc(flightRef, payload);
        return true;
      } catch (err) {
        console.error('儲存航班資訊失敗:', err);
        return false;
      }
    },
    [user, myClaimedMember, activeGroupId]
  );

  // 認領並鎖定成員身分（跨裝置唯一認領）
  const handleClaimMember = useCallback(
    async (memberId: string) => {
      if (!user || isClaiming) return;
      setSyncError(null);

      if (myClaimedMemberId === memberId) {
        setShowMemberModal(false);
        return;
      }

      const claimKey = `${activeGroupId}_${memberId}`;
      const existing = claims[claimKey];
      if (existing && existing.ownerUid !== user.uid) {
        setSyncError('這個身分已經被其他旅伴認領囉，請選擇其他編號！');
        return;
      }
      if (myClaimedMemberId && myClaimedMemberId !== memberId) {
        setSyncError('你已經認領過其他身分，請先按「解除認領」再更換。');
        return;
      }

      const claimPayload: MemberClaim = {
        groupId: activeGroupId,
        memberId,
        ownerUid: user.uid,
        claimedAt: Date.now(),
      };

      if (!db) {
        setClaims((prev) => {
          const next = { ...prev, [claimKey]: claimPayload };
          try {
            localStorage.setItem('okinawa_whale_claims_v1', JSON.stringify(next));
          } catch {
            // 忽略儲存限制
          }
          return next;
        });
        setPreviewMemberId(memberId);
        setShowMemberModal(false);
        return;
      }

      setIsClaiming(true);
      try {
        const claimRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'member_claims',
          claimKey
        );
        await setDoc(claimRef, claimPayload);
        setPreviewMemberId(memberId);
        setShowMemberModal(false);
      } catch (err) {
        console.error('認領身分失敗:', err);
        setSyncError('認領失敗，請確認網路連線後再試一次。');
      } finally {
        setIsClaiming(false);
      }
    },
    [user, isClaiming, activeGroupId, claims, myClaimedMemberId]
  );

  // 解除目前團別的認領鎖定，釋放名額給其他人
  const handleReleaseClaim = useCallback(async () => {
    if (!user || !myClaimedMemberId || isClaiming) return;
    setSyncError(null);
    const claimKey = `${activeGroupId}_${myClaimedMemberId}`;
    if (!db) {
      setClaims((prev) => {
        const next = { ...prev };
        delete next[claimKey];
        try {
          localStorage.setItem('okinawa_whale_claims_v1', JSON.stringify(next));
        } catch {
          // 忽略儲存限制
        }
        return next;
      });
      return;
    }
    setIsClaiming(true);
    try {
      const claimRef = doc(
        db,
        'artifacts',
        appId,
        'public',
        'data',
        'member_claims',
        claimKey
      );
      await deleteDoc(claimRef);
    } catch (err) {
      console.error('解除認領失敗:', err);
      setSyncError('解除鎖定失敗，請稍後再試。');
    } finally {
      setIsClaiming(false);
    }
  }, [user, myClaimedMemberId, isClaiming, activeGroupId]);

  const closeMemberModal = useCallback(() => {
    setShowMemberModal(false);
    setShowCoachPanel(false);
    setCoachPinInput('');
    setCoachPinError(null);
    setIsCoachUnlocked(false);
  }, []);

  const handleVerifyCoachPin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (coachPinInput.trim() === '1105') {
        setIsCoachUnlocked(true);
        setCoachPinInput('');
        setCoachPinError(null);
      } else {
        setCoachPinError('密碼錯誤，請重新輸入。');
      }
    },
    [coachPinInput]
  );

  // 教練強制解鎖指定團員的認領名額
  const handleForceReleaseClaim = useCallback(
    async (memberId: string) => {
      if (!isCoachUnlocked || isClaiming) return;
      setSyncError(null);
      const claimKey = `${activeGroupId}_${memberId}`;
      if (!db) {
        setClaims((prev) => {
          const next = { ...prev };
          delete next[claimKey];
          try {
            localStorage.setItem('okinawa_whale_claims_v1', JSON.stringify(next));
          } catch {
            // 忽略儲存限制
          }
          return next;
        });
        return;
      }
      setIsClaiming(true);
      try {
        const claimRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'member_claims',
          claimKey
        );
        await deleteDoc(claimRef);
      } catch (err) {
        console.error('強制解鎖失敗:', err);
        setSyncError('強制解鎖失敗，請確認網路連線後再試。');
      } finally {
        setIsClaiming(false);
      }
    },
    [isCoachUnlocked, isClaiming, activeGroupId]
  );

  // 教練一鍵解鎖目前團別所有已認領名額
  const handleForceReleaseAllClaims = useCallback(async () => {
    if (!isCoachUnlocked || isClaiming) return;
    const lockedMembers = MEMBERS.filter((m) => Boolean(claims[`${activeGroupId}_${m.id}`]));
    if (lockedMembers.length === 0) return;
    setSyncError(null);

    if (!db) {
      setClaims((prev) => {
        const next = { ...prev };
        lockedMembers.forEach((m) => {
          delete next[`${activeGroupId}_${m.id}`];
        });
        try {
          localStorage.setItem('okinawa_whale_claims_v1', JSON.stringify(next));
        } catch {
          // 忽略儲存限制
        }
        return next;
      });
      return;
    }

    setIsClaiming(true);
    try {
      await Promise.all(
        lockedMembers.map((m) =>
          deleteDoc(
            doc(
              db,
              'artifacts',
              appId,
              'public',
              'data',
              'member_claims',
              `${activeGroupId}_${m.id}`
            )
          )
        )
      );
    } catch (err) {
      console.error('全部強制解鎖失敗:', err);
      setSyncError('全部解鎖失敗，請確認網路連線後再試。');
    } finally {
      setIsClaiming(false);
    }
  }, [isCoachUnlocked, isClaiming, activeGroupId, claims]);

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      const targetGroup = TRIP_GROUPS.find((g) => g.id === groupId) || TRIP_GROUPS[0];
      const targetDays = buildTripDays(targetGroup);
      const targetStatus = getTripStatus(
        todayStr,
        targetDays,
        `${targetGroup.label} ${targetGroup.dateRange}`
      );
      setActiveGroupId(targetGroup.id);
      setSelectedDayIdx(targetStatus.defaultDayIdx);
      setSyncError(null);
    },
    [todayStr]
  );

  const activeMember = useMemo(
    () => MEMBERS.find((m) => m.id === activeMemberId) || MEMBERS[0],
    [activeMemberId]
  );

  const currentDay = tripDays[selectedDayIdx] || tripDays[0];
  const checklistStorageKey = `${activeGroupId}_${activeMemberId}`;

  const groupLeaderboard = useMemo(() => {
    return Object.values(gameScores)
      .filter((s) => s.groupId === activeGroupId)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [gameScores, activeGroupId]);

  const handleSaveGameScore = useCallback(
    async (finalScore: number) => {
      if (!user || finalScore <= 0) return;
      const scoreKey = `${activeGroupId}_${activeMemberId}`;
      const prevBest = gameScores[scoreKey]?.score || 0;
      if (finalScore <= prevBest) return;

      const payload: GameScoreEntry = {
        groupId: activeGroupId,
        memberId: activeMemberId,
        name: activeMember.name,
        emoji: activeMember.emoji,
        score: finalScore,
        updatedAt: Date.now(),
      };
      setGameScores((prev) => {
        const next = { ...prev, [scoreKey]: payload };
        if (!db) {
          try {
            localStorage.setItem('okinawa_whale_scores_v1', JSON.stringify(next));
          } catch {
            // 忽略儲存限制
          }
        }
        return next;
      });
      if (!db) return;
      try {
        const scoreRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'whale_game_scores',
          scoreKey
        );
        await setDoc(scoreRef, payload);
      } catch (err) {
        console.error('儲存小遊戲分數失敗:', err);
      }
    },
    [user, activeGroupId, activeMemberId, activeMember, gameScores]
  );

  // 依目前團別解析各成員對應頭像：兩位帶隊教練共用、7 位團員兩團各自獨立
  const groupAvatars = useMemo(() => {
    const mapped: Record<string, string> = {};
    MEMBERS.forEach((m) => {
      const url = avatars[getAvatarKey(activeGroupId, m.id)];
      if (url) mapped[m.id] = url;
    });
    return mapped;
  }, [avatars, activeGroupId]);

  const handleSaveAvatar = useCallback(
    async (memberId: string, dataUrl: string) => {
      const avatarKey = getAvatarKey(activeGroupId, memberId);
      setAvatars((prev) => {
        const next = { ...prev, [avatarKey]: dataUrl };
        try {
          localStorage.setItem('okinawa_whale_avatars_v1', JSON.stringify(next));
        } catch {
          // 忽略儲存空間限制
        }
        return next;
      });
      if (!user || !db) return;
      try {
        const avatarRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'member_avatars',
          avatarKey
        );
        await setDoc(avatarRef, {
          memberId,
          groupId: isCoachMember(memberId) ? 'shared' : activeGroupId,
          dataUrl,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error('同步火柴人頭像失敗:', err);
      }
    },
    [user, activeGroupId]
  );

  const handleRemoveAvatar = useCallback(
    async (memberId: string) => {
      const avatarKey = getAvatarKey(activeGroupId, memberId);
      setAvatars((prev) => {
        const next = { ...prev };
        delete next[avatarKey];
        try {
          localStorage.setItem('okinawa_whale_avatars_v1', JSON.stringify(next));
        } catch {
          // 忽略儲存空間限制
        }
        return next;
      });
      if (!user || !db) return;
      try {
        const avatarRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'member_avatars',
          avatarKey
        );
        await deleteDoc(avatarRef);
      } catch (err) {
        console.error('移除火柴人頭像失敗:', err);
      }
    },
    [user, activeGroupId]
  );

  const openCurrencyConverter = useCallback(() => {
    setActiveTab('info');
    setOpenInfoSections((prev) => ({ ...prev, calc: true }));
    setTimeout(() => {
      if (calcRef.current) {
        calcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 60);
  }, []);

  const jumpToDay = (idx: number) => {
    setSelectedDayIdx(idx);
    setActiveTab('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const memberChecklistState: MemberChecklistState = checkData[checklistStorageKey] || {
    checked: {},
    custom: [],
  };

  const allMemberItems = useMemo(
    () => [...DEFAULT_CHECKLIST, ...(memberChecklistState.custom || [])],
    [memberChecklistState.custom]
  );

  const completedCount = useMemo(
    () => allMemberItems.filter((it) => memberChecklistState.checked?.[it.id]).length,
    [allMemberItems, memberChecklistState.checked]
  );

  // 寫入雲端同步個人裝備清單（未設 Firebase 時自動存本機）
  const saveMemberChecklist = useCallback(
    async (nextState: MemberChecklistState) => {
      if (!user) return;
      if (!db) {
        try {
          const saved = JSON.parse(localStorage.getItem('okinawa_whale_checks_v1') || '{}');
          saved[checklistStorageKey] = nextState;
          localStorage.setItem('okinawa_whale_checks_v1', JSON.stringify(saved));
        } catch {
          // 忽略儲存限制
        }
        return;
      }
      try {
        const listRef = doc(
          db,
          'artifacts',
          appId,
          'public',
          'data',
          'member_checklists',
          checklistStorageKey
        );
        await setDoc(listRef, nextState);
      } catch (err) {
        console.error('儲存裝備清單失敗:', err);
        setSyncError('清單同步失敗，請檢查網路連線。');
      }
    },
    [user, checklistStorageKey]
  );

  const toggleCheckItem = (itemId: string) => {
    if (!user) return;
    const cur = checkData[checklistStorageKey] || { checked: {}, custom: [] };
    const nextState: MemberChecklistState = {
      ...cur,
      checked: {
        ...(cur.checked || {}),
        [itemId]: !cur.checked?.[itemId],
      },
    };
    setCheckData((prev) => ({ ...prev, [checklistStorageKey]: nextState }));
    saveMemberChecklist(nextState);
  };

  const handleAddCustomItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    const newItem: ChecklistItem = {
      id: `custom-${Date.now()}`,
      cat: '自訂項目',
      text: trimmed,
      isCustom: true,
    };
    const cur = checkData[checklistStorageKey] || { checked: {}, custom: [] };
    const nextState: MemberChecklistState = {
      ...cur,
      custom: [...(cur.custom || []), newItem],
    };
    setCheckData((prev) => ({ ...prev, [checklistStorageKey]: nextState }));
    setNewItemText('');
    saveMemberChecklist(nextState);
  };

  const handleDeleteCustomItem = (itemId: string) => {
    if (!user) return;
    const cur = checkData[checklistStorageKey] || { checked: {}, custom: [] };
    const nextChecked = { ...(cur.checked || {}) };
    delete nextChecked[itemId];
    const nextState: MemberChecklistState = {
      ...cur,
      checked: nextChecked,
      custom: (cur.custom || []).filter((i) => i.id !== itemId),
    };
    setCheckData((prev) => ({ ...prev, [checklistStorageKey]: nextState }));
    saveMemberChecklist(nextState);
  };

  const navItems: {
    id: 'today' | 'itinerary' | 'map' | 'whales' | 'info' | 'checklist';
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'today', label: '今天', Icon: Home },
    { id: 'itinerary', label: '行程', Icon: CalendarDays },
    { id: 'map', label: '地圖', Icon: MapIcon },
    { id: 'whales', label: '鯨圖鑑', Icon: BookOpen },
    { id: 'info', label: '資料', Icon: Info },
    { id: 'checklist', label: '裝備', Icon: ListChecks },
  ];

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#0f293a] antialiased selection:bg-[#bae6fd] selection:text-[#0c4a6e]">
      {/* ==================== 頂部 Sticky Header (65px) ==================== */}
      <header className="sticky top-0 z-30 h-[65px] border-b border-[#e7e2d8] bg-[#faf7f2]/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-md items-center justify-between gap-2 px-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('today');
              setSelectedDayIdx(tripStatus.defaultDayIdx);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex min-w-0 items-center gap-2 text-left transition active:scale-95"
          >
            <span className="shrink-0 text-2xl leading-none">🐋</span>
            <span className="truncate text-[19px] font-extrabold tracking-tight text-[#0f293a]">
              沖繩大翅鯨之旅
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openCurrencyConverter}
              aria-label="日圓匯率換算"
              className="grid h-11 w-11 place-items-center rounded-full border border-[#e7e2d8] bg-white text-[16px] font-extrabold text-[#0f293a] shadow-xs transition active:scale-95"
            >
              ¥
            </button>

            <button
              type="button"
              onClick={() => setShowGameModal(true)}
              aria-label="追鯨小遊戲"
              className="grid h-11 w-11 place-items-center rounded-full border border-[#e7e2d8] bg-white text-[#0369a1] shadow-xs transition active:scale-95"
            >
              <Gamepad2 className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSyncError(null);
                setShowMemberModal(true);
              }}
              aria-label={isMemberLocked ? `目前身分：${activeMember.name}` : '認領成員身分'}
              title={isMemberLocked ? `${activeMember.name}（已鎖定）` : '點此認領身分'}
              className="relative grid h-11 w-11 place-items-center rounded-full border-2 border-white text-[20px] text-white shadow-sm transition active:scale-95"
              style={{ backgroundColor: activeMember.color }}
            >
              {groupAvatars[activeMember.id] ? (
                <img
                  src={groupAvatars[activeMember.id]}
                  alt={activeMember.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span>{activeMember.emoji}</span>
              )}
              {isMemberLocked ? (
                <span className="absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full border border-white bg-[#0369a1] text-white">
                  <Lock className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#f59e0b]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ==================== 追鯨互動小遊戲 Modal ==================== */}
      {showGameModal && (
        <WhaleMiniGameModal
          onClose={() => setShowGameModal(false)}
          activeGroup={activeGroup}
          activeMember={activeMember}
          leaderboard={groupLeaderboard}
          onSaveScore={handleSaveGameScore}
        />
      )}

      {/* ==================== 火柴人頭部貼紙裁切 Modal ==================== */}
      {cropTargetMember && (
        <AvatarCropModal
          initialMember={cropTargetMember}
          activeGroupLabel={activeGroup.label}
          avatars={groupAvatars}
          onClose={() => setCropTargetMember(null)}
          onSaveAvatar={handleSaveAvatar}
          onRemoveAvatar={handleRemoveAvatar}
        />
      )}

      {/* ==================== 成員唯一認領與鎖定 Modal ==================== */}
      {showMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
          onClick={closeMemberModal}
        >
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-[#e7e2d8] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-[#0f293a]">
                  {isMemberLocked ? '已認領並鎖定身分' : '認領你的團隊身分'}
                </h2>
                <p className="text-[13px] text-[#6b7280]">
                  {activeGroup.label}（{activeGroup.dateRange}）· 認領後其他人無法重複選取
                </p>
              </div>
              <button
                type="button"
                onClick={closeMemberModal}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#faf7f2] text-[#57534e]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {syncError && (
              <div className="mb-3 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2 text-[12.5px] font-bold text-[#b91c1c]">
                ⚠️ {syncError}
              </div>
            )}

            {isMemberLocked && (
              <div className="mb-3.5 flex items-center justify-between gap-2 rounded-2xl border border-[#bae6fd] bg-[#f0f9ff] px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#0c4a6e]">
                  <Lock className="h-4 w-4 shrink-0 text-[#0369a1]" />
                  <span>本人已鎖定：{activeMember.name}</span>
                </div>
                <button
                  type="button"
                  disabled={isClaiming}
                  onClick={handleReleaseClaim}
                  className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12.5px] font-extrabold text-[#c2410c] shadow-xs transition active:scale-95 disabled:opacity-50"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>{isClaiming ? '處理中...' : '解除認領'}</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {MEMBERS.map((m) => {
                const mKey = `${activeGroupId}_${m.id}`;
                const claimInfo = claims[mKey];
                const isMine = Boolean(user && claimInfo?.ownerUid === user.uid);
                const isClaimedByOther = Boolean(
                  claimInfo && (!user || claimInfo.ownerUid !== user.uid)
                );
                const isDisabled =
                  !user || isClaiming || isClaimedByOther || (isMemberLocked && !isMine);

                const mData = checkData[mKey] || { checked: {}, custom: [] };
                const total = DEFAULT_CHECKLIST.length + (mData.custom?.length || 0);
                const done = [...DEFAULT_CHECKLIST, ...(mData.custom || [])].filter(
                  (it) => mData.checked?.[it.id]
                ).length;

                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleClaimMember(m.id)}
                    className={`relative flex flex-col items-center rounded-2xl border-2 px-2 py-3 transition ${
                      isMine
                        ? 'border-[#0369a1] bg-[#f0f9ff]'
                        : isClaimedByOther
                        ? 'border-[#e5e7eb] bg-[#f3f4f6] opacity-55'
                        : 'border-[#e7e2d8] bg-[#faf7f2]/60 hover:bg-[#faf7f2]'
                    } ${
                      isDisabled ? 'cursor-not-allowed' : 'active:scale-95'
                    }`}
                  >
                    {m.hasCrown && (
                      <span className="absolute top-1.5 right-1.5 text-[12px]">👑</span>
                    )}
                    {groupAvatars[m.id] ? (
                      <img
                        src={groupAvatars[m.id]}
                        alt={m.name}
                        className="h-11 w-10 object-contain drop-shadow-sm"
                      />
                    ) : (
                      <span
                        className="grid h-10 w-10 place-items-center rounded-full text-[19px] text-white shadow-sm"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.emoji}
                      </span>
                    )}
                    <span className="mt-1.5 text-[14px] font-bold text-[#0f293a]">
                      {m.name}
                    </span>
                    <span
                      className={`mt-0.5 text-[10.5px] font-bold ${
                        isMine
                          ? 'text-[#0369a1]'
                          : isClaimedByOther
                          ? 'text-[#6b7280]'
                          : 'text-[#0f766e]'
                      }`}
                    >
                      {isMine
                        ? '🔒 本人'
                        : isClaimedByOther
                        ? '🔒 已認領'
                        : `可認領 · ${done}/${total}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                closeMemberModal();
                setCropTargetMember(activeMember);
              }}
              className="mt-3.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-[#bae6fd] bg-[#f0f9ff] text-[13px] font-extrabold text-[#0369a1] transition active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span>設定 / 裁切火柴人照片頭像</span>
            </button>

            {/* 帶隊教練密碼強制解鎖區塊 */}
            <div className="mt-3 rounded-2xl border border-[#e7e2d8] bg-[#faf7f2] p-3">
              {!showCoachPanel ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCoachPanel(true);
                    setCoachPinError(null);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-[12.5px] font-bold text-[#57534e] transition active:scale-95"
                >
                  <Unlock className="h-3.5 w-3.5 text-[#c2410c]" />
                  <span>帶隊教練管理：強制解鎖團員名額</span>
                </button>
              ) : !isCoachUnlocked ? (
                <form onSubmit={handleVerifyCoachPin} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-extrabold text-[#0f293a]">
                      🔐 輸入教練密碼以解鎖名額
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCoachPanel(false);
                        setCoachPinInput('');
                        setCoachPinError(null);
                      }}
                      className="text-[11.5px] font-bold text-[#6b7280]"
                    >
                      取消
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={coachPinInput}
                      onChange={(e) => {
                        setCoachPinInput(e.target.value);
                        if (coachPinError) setCoachPinError(null);
                      }}
                      placeholder="請輸入教練密碼"
                      className="min-h-10 flex-1 rounded-xl border border-[#d6d3d1] bg-white px-3 text-[14px] font-bold text-[#0f293a] focus:border-[#0369a1] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-10 rounded-xl bg-[#0c4a6e] px-4 text-[13px] font-extrabold text-white transition active:scale-95"
                    >
                      驗證
                    </button>
                  </div>
                  {coachPinError && (
                    <p className="text-[12px] font-bold text-[#b91c1c]">{coachPinError}</p>
                  )}
                </form>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-extrabold text-[#c2410c]">
                      🔓 教練強制解鎖模式（{activeGroup.label}）
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCoachUnlocked(false);
                        setShowCoachPanel(false);
                      }}
                      className="text-[11.5px] font-bold text-[#6b7280]"
                    >
                      結束
                    </button>
                  </div>

                  {(() => {
                    const lockedList = MEMBERS.filter((m) =>
                      Boolean(claims[`${activeGroupId}_${m.id}`])
                    );
                    if (lockedList.length === 0) {
                      return (
                        <p className="rounded-xl bg-white px-3 py-2 text-center text-[12px] font-semibold text-[#6b7280]">
                          目前沒有已鎖定的名額
                        </p>
                      );
                    }
                    return (
                      <>
                        <div className="space-y-1.5">
                          {lockedList.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between rounded-xl border border-[#e7e2d8] bg-white px-3 py-2"
                            >
                              <div className="flex items-center gap-2 text-[13px] font-bold text-[#0f293a]">
                                <span>{m.emoji}</span>
                                <span>{m.name}</span>
                              </div>
                              <button
                                type="button"
                                disabled={isClaiming}
                                onClick={() => handleForceReleaseClaim(m.id)}
                                className="flex items-center gap-1 rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] font-extrabold text-[#c2410c] transition active:scale-95 disabled:opacity-50"
                              >
                                <Unlock className="h-3 w-3" />
                                <span>強制解鎖</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        {lockedList.length >= 2 && (
                          <button
                            type="button"
                            disabled={isClaiming}
                            onClick={handleForceReleaseAllClaims}
                            className="flex min-h-9 w-full items-center justify-center gap-1 rounded-xl border border-[#fed7aa] bg-[#fff7ed] text-[12px] font-extrabold text-[#c2410c] transition active:scale-95 disabled:opacity-50"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span>一鍵解鎖本團全部（{lockedList.length} 人）</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {user && (
              <div className="mt-3 rounded-xl bg-[#faf7f2] px-3 py-2 text-[11px] break-all text-[#6b7280]">
                連線代碼：{user.uid}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 主內容區 (max-w-md) ==================== */}
      <main className="mx-auto w-full max-w-md px-4 pt-3.5 pb-28">
        {/* ---------- TAB 1: 今天 ---------- */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            {/* 兩團切換器 */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#e7e2d8] bg-white p-1.5 shadow-xs">
              {TRIP_GROUPS.map((g) => {
                const isActive = g.id === activeGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGroup(g.id)}
                    className={`min-h-10 rounded-xl px-2 py-1.5 text-[13.5px] font-extrabold transition ${
                      isActive
                        ? 'bg-[#0369a1] text-white shadow-sm'
                        : 'text-[#57534e] hover:bg-[#faf7f2]'
                    }`}
                  >
                    {g.label} · {g.dateRange}
                  </button>
                );
              })}
            </div>

            <CrewPlayground
              activeMemberId={activeMemberId}
              avatars={groupAvatars}
              onOpenAvatarCrop={(member) => setCropTargetMember(member)}
              onSelectMember={(id) => {
                if (!isMemberLocked) {
                  setPreviewMemberId(id);
                }
              }}
            />

            <div className="rounded-3xl bg-[#0c4a6e] px-5 py-4 text-[17px] font-bold leading-snug text-white shadow-sm">
              {tripStatus.banner}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="前一天"
                disabled={selectedDayIdx === 0}
                onClick={() => setSelectedDayIdx((i) => Math.max(0, i - 1))}
                className="grid h-12 w-12 place-items-center rounded-full border border-[#e7e2d8] bg-white text-[#0f293a] shadow-xs transition active:scale-95 disabled:opacity-30"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <div className="text-center">
                <div className="text-[16px] font-bold text-[#0f293a]">
                  Day {currentDay.day} · {currentDay.shortDate}
                </div>
                {selectedDayIdx !== tripStatus.defaultDayIdx && (
                  <button
                    type="button"
                    onClick={() => setSelectedDayIdx(tripStatus.defaultDayIdx)}
                    className="mt-0.5 text-[12px] font-bold text-[#0369a1] underline underline-offset-2"
                  >
                    {tripStatus.phase === 'during' ? '回到今天' : '回到出發日'}
                  </button>
                )}
              </div>

              <button
                type="button"
                aria-label="後一天"
                disabled={selectedDayIdx === tripDays.length - 1}
                onClick={() =>
                  setSelectedDayIdx((i) => Math.min(tripDays.length - 1, i + 1))
                }
                className="grid h-12 w-12 place-items-center rounded-full border border-[#e7e2d8] bg-white text-[#0f293a] shadow-xs transition active:scale-95 disabled:opacity-30"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            <div
              className="overflow-hidden rounded-3xl text-white shadow-lg"
              style={{ backgroundColor: currentDay.theme }}
            >
              <div className="bg-gradient-to-br from-white/15 via-transparent to-black/25 p-5">
                <div className="flex items-baseline justify-between gap-3 text-[14px] font-semibold opacity-95">
                  <span>{currentDay.badge}</span>
                  <span>{currentDay.dateLabel}</span>
                </div>
                <h1 className="mt-2 text-[24px] font-extrabold leading-tight">
                  {currentDay.title}
                </h1>
                <p className="mt-1.5 text-[15px] font-medium opacity-90">
                  {currentDay.route}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e7e2d8] bg-white px-3.5 py-3">
                <span className="shrink-0 text-[#ea580c]">
                  <Sunset className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#6b7280]">日落</div>
                  <div className="truncate text-[15px] font-bold text-[#0f293a]">
                    {currentDay.sunset}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e7e2d8] bg-white px-3.5 py-3">
                <span className="shrink-0 text-[#0369a1]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#6b7280]">住宿</div>
                  <div className="truncate text-[15px] font-bold text-[#0f293a]">
                    {currentDay.hotelShort}
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#e7e2d8] bg-white px-3.5 py-3">
                <span className="shrink-0 text-[#0284c7]">
                  <CloudSun className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-[#6b7280]">
                    氣候 / 海況參考
                  </div>
                  <div className="text-[15px] font-bold text-[#0f293a]">
                    {currentDay.weather}
                  </div>
                </div>
              </div>
            </div>

            <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.05)]">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="text-[18px] font-extrabold text-[#0f293a]">
                  預計行程安排
                </h2>
                <span className="text-[11.5px] font-semibold text-[#6b7280]">
                  依現場海況調整
                </span>
              </div>
              <ol className="relative">
                {currentDay.timeline.map((item, idx) => {
                  const isLast = idx === currentDay.timeline.length - 1;
                  return (
                    <li key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                      <div className="flex w-[58px] shrink-0 flex-col items-center">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[12.5px] font-bold text-white"
                          style={{ backgroundColor: currentDay.theme }}
                        >
                          {item.time}
                        </span>
                        {!isLast && (
                          <span className="mt-1.5 w-[2px] flex-1 bg-[#e7e2d8]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[15.5px] font-medium leading-snug text-[#0f293a]">
                          {item.text}
                        </p>
                        {item.tag && (
                          <span
                            className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                              item.tag === '06:10 集合' || item.tag === '出海追鯨'
                                ? 'bg-[#e0f2fe] text-[#0369a1]'
                                : item.tag === '買明日早／午餐'
                                ? 'bg-[#fff7ed] text-[#c2410c]'
                                : 'bg-[#faf7f2] text-[#57534e]'
                            }`}
                          >
                            {item.tag}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-3xl border border-[#f5e1b9] bg-[#fffaf0] p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]">
              <h2 className="mb-2.5 text-[18px] font-extrabold text-[#9a3412]">
                💡 追鯨與行前小提醒
              </h2>
              <ul className="space-y-2">
                {currentDay.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-[15px] font-medium leading-snug text-[#451a03]"
                  >
                    <span className="font-bold text-[#d97706]">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* ---------- TAB 2: 行程總覽 ---------- */}
        {activeTab === 'itinerary' && (
          <div className="space-y-4">
            <div className="px-1">
              <h1 className="text-[22px] font-extrabold text-[#0f293a]">
                沖繩大翅鯨 4 日行程總覽
              </h1>
              <p className="mt-0.5 text-[14px] text-[#6b7280]">
                {activeGroup.label}（{activeGroup.fullRange}）· 2 教練 + 7 團員
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#e7e2d8] bg-white p-1.5 shadow-xs">
              {TRIP_GROUPS.map((g) => {
                const isActive = g.id === activeGroupId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGroup(g.id)}
                    className={`min-h-10 rounded-xl px-2 py-1.5 text-[13.5px] font-extrabold transition ${
                      isActive
                        ? 'bg-[#0369a1] text-white shadow-sm'
                        : 'text-[#57534e] hover:bg-[#faf7f2]'
                    }`}
                  >
                    {g.label} · {g.dateRange}
                  </button>
                );
              })}
            </div>

            {tripDays.map((day, idx) => {
              const showGroupHeader =
                idx === 0 || tripDays[idx - 1].regionGroup !== day.regionGroup;

              return (
                <div key={day.day} className="space-y-2.5">
                  {showGroupHeader && (
                    <div className="flex items-center gap-2 pt-1 pl-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0369a1]" />
                      <span className="text-[13px] font-extrabold tracking-wide text-[#0369a1]">
                        {day.regionGroup}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => jumpToDay(idx)}
                    className="w-full rounded-3xl border border-[#e7e2d8] bg-white p-4 text-left shadow-[0_2px_10px_rgba(12,74,110,0.04)] transition active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-3 py-0.5 text-[12px] font-bold text-white"
                        style={{ backgroundColor: day.theme }}
                      >
                        Day {day.day} · {day.shortDate}
                      </span>
                      <ChevronRight className="h-5 w-5 text-[#9ca3af]" />
                    </div>

                    <h3 className="mt-2.5 text-[18px] font-extrabold text-[#0f293a]">
                      {day.title}
                    </h3>
                    <p className="mt-1 text-[14px] text-[#57534e]">{day.route}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {day.highlights.map((h) => (
                        <span
                          key={h}
                          className="rounded-full bg-[#f0f9ff] px-2.5 py-1 text-[12px] font-semibold text-[#0c4a6e]"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------- TAB 3: 沖繩互動地圖 ---------- */}
        {activeTab === 'map' && <OkinawaMapTab />}

        {/* ---------- TAB 4: 大翅鯨圖鑑 ---------- */}
        {activeTab === 'whales' && <WhaleGuideTab />}

        {/* ---------- TAB 5: 美食、超市與沖繩實用資料 ---------- */}
        {activeTab === 'info' && (
          <div className="space-y-3">
            {/* 全部展開 / 收合快捷列 */}
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[12.5px] font-bold text-[#57534e]">
                點選各區塊標題可展開／收合
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllInfoSections(true)}
                  className="rounded-full border border-[#e7e2d8] bg-white px-3 py-1 text-[12px] font-bold text-[#0369a1] shadow-2xs transition active:scale-95"
                >
                  全部展開
                </button>
                <button
                  type="button"
                  onClick={() => setAllInfoSections(false)}
                  className="rounded-full border border-[#e7e2d8] bg-white px-3 py-1 text-[12px] font-bold text-[#57534e] shadow-2xs transition active:scale-95"
                >
                  全部收合
                </button>
              </div>
            </div>

            <JpyCalculator
              calcRef={calcRef}
              isOpen={openInfoSections.calc}
              onToggle={() => toggleInfoSection('calc')}
            />

            {/* 航班與抵達入住回報（鎖定身分填寫，僅兩位教練可見總表） */}
            <FlightInfoCard
              activeGroup={activeGroup}
              activeGroupId={activeGroupId}
              myClaimedMember={myClaimedMember}
              isLockedCoach={isLockedCoach}
              flights={flights}
              isOpen={openInfoSections.flight}
              onToggle={() => toggleInfoSection('flight')}
              onSaveFlight={handleSaveFlight}
              onOpenClaimModal={() => {
                setSyncError(null);
                setShowMemberModal(true);
              }}
            />

            {/* 團隊編成與 LINE 聯繫方式 */}
            <CollapsibleInfoSection
              title="團隊聯繫方式（LINE 為主）"
              subtitle={`${activeGroup.label}（${activeGroup.dateRange}）· 共 9 位成員`}
              subtitleClass="text-[#15803d]"
              icon={<MessageCircle className="h-5 w-5" />}
              iconBgClass="bg-[#dcfce7] text-[#06C755]"
              borderClass="border-[#bbf7d0]"
              shadowClass="shadow-[0_2px_10px_rgba(6,199,85,0.08)]"
              isOpen={openInfoSections.line}
              onToggle={() => toggleInfoSection('line')}
            >
              <div className="space-y-2.5 rounded-2xl bg-[#f0fdf4] p-3.5 text-[14px] text-[#0f293a]">
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" />
                  <span>
                    <strong>團隊編成：</strong>2 位帶隊教練（潘潘、家輝）＋ 7 位團員（團員 1～7）
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#0369a1] shadow-2xs">
                    🐋 潘潘（LINE：潘ᶜʸ）
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#0c4a6e] shadow-2xs">
                    🧭 家輝（LINE：輝）
                  </span>
                </div>
                <p className="leading-relaxed text-[#14532d]">
                  <strong>重要通知管道：</strong>
                  每日集合時間、出海碼頭接駁、海況異動與任何緊急聯繫，皆以{' '}
                  <strong>LINE 團隊專屬群組</strong> 為主。
                </p>
                <p className="text-[13px] leading-relaxed text-[#166534]">
                  💡 出發前請確認日本 eSIM / 漫遊已開通且可正常收發 LINE，並請開啟群組通知避免漏接出海集合訊息。
                </p>
              </div>
            </CollapsibleInfoSection>

            {/* 裝備租借費用（現場繳交日幣） */}
            <CollapsibleInfoSection
              title="裝備租借費用"
              subtitle="僅限一般蛙鞋（不可使用長蛙鞋）"
              subtitleClass="text-[#b45309]"
              icon={<Coins className="h-5 w-5" />}
              iconBgClass="bg-[#fef3c7] text-[#b45309]"
              borderClass="border-[#fde68a]"
              shadowClass="shadow-[0_2px_10px_rgba(217,119,6,0.08)]"
              isOpen={openInfoSections.rental}
              onToggle={() => toggleInfoSection('rental')}
            >
              <div className="divide-y divide-[#f4f0e8] rounded-2xl bg-[#faf7f2] px-3.5 py-1 text-[14.5px]">
                {RENTAL_ITEMS.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2.5">
                    <span className="font-bold text-[#0f293a]">{item.name}</span>
                    <span className="rounded-full bg-white px-3 py-0.5 font-extrabold text-[#b45309] shadow-2xs">
                      {item.price}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl bg-[#fffbeb] px-3.5 py-2.5 text-[13.5px] font-bold leading-relaxed text-[#92400e]">
                ⚠️ 若有租借上述裝備，請於現場繳交「日幣現金」給帶隊教練，建議出發前先備妥日幣零錢！
              </div>
            </CollapsibleInfoSection>

            {/* 住宿介紹：Almont Hotel Naha Kenchomae */}
            <CollapsibleInfoSection
              title="住宿：Almont Hotel 那霸縣廳前"
              subtitle="Almont Hotel Naha Kenchomae"
              icon={<Building2 className="h-5 w-5" />}
              iconBgClass="bg-[#e0f2fe] text-[#0369a1]"
              isOpen={openInfoSections.hotel}
              onToggle={() => toggleInfoSection('hotel')}
            >
              <div className="space-y-2 rounded-2xl bg-[#faf7f2] p-3.5 text-[14px] text-[#0f293a]">
                <p>
                  <strong className="text-[#0369a1]">交通極便利：</strong>
                  單軌電車「縣廳前站」步行 3 分鐘、國際通入口 2 分鐘、對面就是 RYUBO 百貨。
                </p>
                <p>
                  <strong className="text-[#0369a1]">追鯨必泡大浴場：</strong>
                  飯店 12F 附設男女分開準天然光明石大浴場，出海吹海風回來泡湯超解疲勞！
                </p>
                <p>
                  <strong className="text-[#0369a1]">地址：</strong>
                  沖繩縣那霸市久茂地 1-3-5
                </p>
              </div>

              <a
                href="https://www.google.com/maps/search/?api=1&query=Almont+Hotel+Naha+Kenchomae"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#0369a1] text-[14px] font-bold text-white transition active:scale-95"
              >
                <Navigation className="h-4 w-4" />
                <span>在 Google Maps 查看飯店位置</span>
              </a>
            </CollapsibleInfoSection>

            {/* 沖繩那霸美食推薦 */}
            <CollapsibleInfoSection
              title="沖繩那霸美食推薦"
              subtitle={`皆位於飯店步行可達範圍 · ${OKINAWA_RESTAURANTS.length} 間精選`}
              icon={<Utensils className="h-5 w-5" />}
              iconBgClass="bg-[#fff7ed] text-[#c2410c]"
              isOpen={openInfoSections.food}
              onToggle={() => toggleInfoSection('food')}
            >
              <div className="space-y-2.5">
                {OKINAWA_RESTAURANTS.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-[#f0ece3] bg-[#faf7f2]/70 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="rounded-full bg-[#fff7ed] px-2.5 py-0.5 text-[11.5px] font-bold text-[#c2410c]">
                        {r.tag} · {r.walk}
                      </span>
                      <span className="text-[12.5px] font-extrabold text-[#0f293a]">
                        {r.price}
                      </span>
                    </div>
                    <h4 className="mt-1.5 text-[16px] font-extrabold text-[#0f293a]">
                      {r.zh}
                    </h4>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-[#57534e]">
                      {r.desc}
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        r.query
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-[#0369a1]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Google Maps 導航</span>
                    </a>
                  </div>
                ))}
              </div>
            </CollapsibleInfoSection>

            {/* 飯店周邊超市、藥妝與市場 */}
            <CollapsibleInfoSection
              title="沖繩超市・藥妝・採買推薦"
              subtitle={`那霸縣廳前＆國際通周邊 · ${OKINAWA_MARKETS.length} 處`}
              icon={<ShoppingBag className="h-5 w-5" />}
              iconBgClass="bg-[#ccfbf1] text-[#0f766e]"
              isOpen={openInfoSections.market}
              onToggle={() => toggleInfoSection('market')}
            >
              <div className="space-y-2.5">
                {OKINAWA_MARKETS.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-[#f0ece3] bg-[#faf7f2]/70 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="rounded-full bg-[#ccfbf1] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0f766e]">
                        {m.tag} · {m.walk}
                      </span>
                      <span className="text-[12px] font-semibold text-[#57534e]">
                        {m.hours}
                      </span>
                    </div>
                    <h4 className="mt-1.5 text-[16px] font-extrabold text-[#0f293a]">
                      {m.zh}
                    </h4>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-[#57534e]">
                      {m.desc}
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        m.query
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-[#0f766e]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Google Maps 導航</span>
                    </a>
                  </div>
                ))}
              </div>
            </CollapsibleInfoSection>

            {/* Visit Japan Web 與沖繩入境/追鯨須知 */}
            <CollapsibleInfoSection
              title="Visit Japan Web & 沖繩須知"
              subtitle="飯店地址郵遞區號一鍵複製・入境電壓提醒"
              subtitleClass="text-[#1d4ed8]"
              icon={<ShieldAlert className="h-5 w-5" />}
              iconBgClass="bg-[#eff6ff] text-[#1d4ed8]"
              isOpen={openInfoSections.vjw}
              onToggle={() => toggleInfoSection('vjw')}
            >
              <a
                href="https://services.digital.go.jp/zh-cmn-hant/visit-japan-web/"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 flex min-h-12 items-center justify-between rounded-2xl bg-[#1d4ed8] px-4 text-[14.5px] font-bold text-white shadow-xs transition active:scale-95"
              >
                <span>前往 Visit Japan Web 填寫入境申報</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>

              <VisitJapanWebCopyBox />

              <div className="grid grid-cols-1 gap-2 rounded-2xl bg-[#fffaf0] p-3.5 text-[13.5px] font-medium text-[#451a03]">
                <div className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" />
                  <span>
                    <strong>電壓 100V・A 型兩腳扁平：</strong>
                    與台灣雙孔插頭相同，一般手機/相機充電器<strong>免轉接頭</strong>（三孔筆電才需 3 轉 2）。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" />
                  <span>
                    <strong>時差與簽證：</strong>比台灣快 1 小時（UTC+9）；台灣護照觀光免簽停留 90 天。
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Waves className="mt-0.5 h-4 w-4 shrink-0 text-[#0369a1]" />
                  <span>
                    <strong>3 月追鯨保暖：</strong>
                    水溫約 21–22°C、船上風大，務必備妥防寒衣、毛巾衣、厚防風外套／雨衣與長效暈船藥。
                  </span>
                </div>
              </div>
            </CollapsibleInfoSection>
          </div>
        )}

        {/* ---------- TAB 5: 個人化裝備與打包清單 ---------- */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-[19px] font-extrabold text-[#0f293a]">
                  {activeMember.emoji} {activeMember.name} 的清單
                </h1>
                <span className="shrink-0 rounded-full bg-[#e0f2fe] px-3 py-1 text-[13px] font-extrabold text-[#0369a1]">
                  {completedCount} / {allMemberItems.length}
                </span>
              </div>

              {isMemberLocked ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#bae6fd] bg-[#f0f9ff] px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#0c4a6e]">
                    <Lock className="h-4 w-4 shrink-0 text-[#0369a1]" />
                    <span>已認領鎖定（其他人無法重複選取）</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSyncError(null);
                      setShowMemberModal(true);
                    }}
                    className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-extrabold text-[#0369a1] shadow-2xs transition active:scale-95"
                  >
                    管理 / 解鎖
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[12px] font-semibold text-[#c2410c]">
                    👇 尚未認領身分，請點選你的編號完成唯一鎖定：
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {MEMBERS.map((m) => {
                      const claimInfo = claims[`${activeGroupId}_${m.id}`];
                      const isClaimedByOther = Boolean(
                        claimInfo && (!user || claimInfo.ownerUid !== user.uid)
                      );
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isClaimedByOther || isClaiming || !user}
                          onClick={() => handleClaimMember(m.id)}
                          className={`flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-[13px] font-bold transition ${
                            isClaimedByOther
                              ? 'cursor-not-allowed border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af]'
                              : m.id === activeMemberId
                              ? 'border-transparent text-white shadow-xs'
                              : 'border-[#e7e2d8] bg-[#faf7f2] text-[#57534e]'
                          }`}
                          style={
                            !isClaimedByOther && m.id === activeMemberId
                              ? { backgroundColor: m.color }
                              : undefined
                          }
                        >
                          <span>{isClaimedByOther ? '🔒' : m.emoji}</span>
                          <span>
                            {m.name}
                            {isClaimedByOther ? ' (已認領)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-[#f0ece3]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      allMemberItems.length
                        ? Math.round((completedCount / allMemberItems.length) * 100)
                        : 0
                    }%`,
                    backgroundColor: activeMember.color,
                  }}
                />
              </div>
            </section>

            <form onSubmit={handleAddCustomItem} className="flex gap-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder={`幫「${activeMember.name}」新增裝備或行李...`}
                className="min-h-12 flex-1 rounded-2xl border border-[#e7e2d8] bg-white px-4 text-[15px] text-[#0f293a] placeholder:text-[#9ca3af] focus:border-[#0369a1] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="新增項目"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#0369a1] text-white shadow-xs transition active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </button>
            </form>

            {CHECKLIST_CATEGORIES.map((category) => {
              const items = allMemberItems.filter((it) => it.cat === category);
              if (items.length === 0) return null;

              return (
                <section
                  key={category}
                  className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]"
                >
                  <h2 className="mb-2.5 text-[16px] font-extrabold text-[#0369a1]">
                    {category}
                  </h2>
                  <ul className="divide-y divide-[#f4f0e8]">
                    {items.map((item) => {
                      const checked = Boolean(memberChecklistState.checked?.[item.id]);
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 py-2.5 first:pt-0.5 last:pb-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => toggleCheckItem(item.id)}
                            className="flex min-h-9 flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition ${
                                checked
                                  ? 'border-transparent text-white'
                                  : 'border-[#d6cfc2] bg-white'
                              }`}
                              style={
                                checked
                                  ? { backgroundColor: activeMember.color }
                                  : undefined
                              }
                            >
                              {checked && <Check className="h-4 w-4 stroke-[3]" />}
                            </span>
                            <span
                              className={`text-[15px] leading-snug transition ${
                                checked
                                  ? 'text-[#9ca3af] line-through'
                                  : 'font-medium text-[#0f293a]'
                              }`}
                            >
                              {item.text}
                            </span>
                          </button>

                          {item.isCustom && (
                            <button
                              type="button"
                              aria-label="刪除項目"
                              onClick={() => handleDeleteCustomItem(item.id)}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#9ca3af] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* ==================== 底部 6 分頁導覽列 (68px) ==================== */}
      <nav className="fixed inset-x-0 bottom-0 z-30 h-[68px] border-t border-[#e7e2d8] bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-full max-w-md grid-cols-6">
          {navItems.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  setActiveTab(id);
                  if (id === 'today') {
                    setSelectedDayIdx(tripStatus.defaultDayIdx);
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 transition ${
                  isActive ? 'text-[#0369a1]' : 'text-[#78716c]'
                }`}
              >
                <span
                  className={`grid h-9 w-11 place-items-center rounded-full transition-colors ${
                    isActive ? 'bg-[#e0f2fe]' : 'bg-transparent'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`}
                  />
                </span>
                <span className="whitespace-nowrap text-[10.5px] font-bold leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
