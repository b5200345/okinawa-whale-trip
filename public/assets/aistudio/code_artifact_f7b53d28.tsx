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
}: {
  calcRef: React.RefObject<HTMLElement | null>;
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#e0f2fe] text-[#0369a1]">
            <ArrowRightLeft className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[18px] font-bold text-[#0f293a]">即時日圓換算器</h3>
            <p className="text-[12px] font-semibold text-[#0369a1]">
              1 JPY ≈ {formatNumber(twdPerJpy, 4)} TWD
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchLiveRates(true)}
          disabled={liveRates.status === 'loading'}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#e7e2d8] bg-[#faf7f2] px-3 text-[12px] font-bold text-[#0f293a] transition active:scale-95 disabled:opacity-60"
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
      </div>

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

  const [activeTab, setActiveTab] = useState<'today' | 'itinerary' | 'map' | 'info' | 'checklist'>('today');
  const [selectedDayIdx, setSelectedDayIdx] = useState(tripStatus.defaultDayIdx);

  // 雲端登入與跨裝置即時同步狀態
  const [user, setUser] = useState<AppUser | null>(null);
  const [claims, setClaims] = useState<Record<string, MemberClaim>>({});
  const [checkData, setCheckData] = useState<Record<string, MemberChecklistState>>({});
  const [gameScores, setGameScores] = useState<Record<string, GameScoreEntry>>({});
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
  const calcRef = useRef<HTMLElement | null>(null);

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

  const isMemberLocked = Boolean(myClaimedMemberId);
  const activeMemberId = myClaimedMemberId || previewMemberId;

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
    id: 'today' | 'itinerary' | 'map' | 'info' | 'checklist';
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'today', label: '今天', Icon: Home },
    { id: 'itinerary', label: '行程', Icon: CalendarDays },
    { id: 'map', label: '地圖', Icon: MapIcon },
    { id: 'info', label: '美食與資料', Icon: Info },
    { id: 'checklist', label: '裝備清單', Icon: ListChecks },
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

        {/* ---------- TAB 4: 美食、超市與沖繩實用資料 ---------- */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <JpyCalculator calcRef={calcRef} />

            {/* 團隊編成與 LINE 聯繫方式 */}
            <section className="rounded-3xl border border-[#bbf7d0] bg-white p-4 shadow-[0_2px_10px_rgba(6,199,85,0.08)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#dcfce7] text-[#06C755]">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0f293a]">
                    團隊聯繫方式（LINE 為主）
                  </h3>
                  <p className="text-[12px] font-semibold text-[#15803d]">
                    {activeGroup.label}（{activeGroup.dateRange}）· 共 9 位成員
                  </p>
                </div>
              </div>

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
            </section>

            {/* 裝備租借費用（現場繳交日幣） */}
            <section className="rounded-3xl border border-[#fde68a] bg-white p-4 shadow-[0_2px_10px_rgba(217,119,6,0.08)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#fef3c7] text-[#b45309]">
                  <Coins className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0f293a]">
                    裝備租借費用
                  </h3>
                  <p className="text-[12px] font-semibold text-[#b45309]">
                    僅限一般蛙鞋（不可使用長蛙鞋）
                  </p>
                </div>
              </div>

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
            </section>

            {/* 住宿介紹：Almont Hotel Naha Kenchomae */}
            <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#e0f2fe] text-[#0369a1]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0f293a]">
                    住宿：Almont Hotel 那霸縣廳前
                  </h3>
                  <p className="text-[12px] font-semibold text-[#6b7280]">
                    Almont Hotel Naha Kenchomae
                  </p>
                </div>
              </div>

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
            </section>

            {/* 沖繩那霸美食推薦 */}
            <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#fff7ed] text-[#c2410c]">
                  <Utensils className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0f293a]">
                    沖繩那霸美食推薦
                  </h3>
                  <p className="text-[12px] font-semibold text-[#6b7280]">
                    皆位於飯店步行可達範圍
                  </p>
                </div>
              </div>

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
            </section>

            {/* 飯店周邊超市、藥妝與市場 */}
            <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#ccfbf1] text-[#0f766e]">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0f293a]">
                    沖繩超市・藥妝・採買推薦
                  </h3>
                  <p className="text-[12px] font-semibold text-[#6b7280]">
                    那霸縣廳前＆國際通周邊
                  </p>
                </div>
              </div>

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
            </section>

            {/* Visit Japan Web 與沖繩入境/追鯨須知 */}
            <section className="rounded-3xl border border-[#e7e2d8] bg-white p-4 shadow-[0_2px_10px_rgba(12,74,110,0.04)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#eff6ff] text-[#1d4ed8]">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <h3 className="text-[18px] font-bold text-[#0f293a]">
                  Visit Japan Web & 沖繩須知
                </h3>
              </div>

              <a
                href="https://services.digital.go.jp/zh-cmn-hant/visit-japan-web/"
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 flex min-h-12 items-center justify-between rounded-2xl bg-[#1d4ed8] px-4 text-[14.5px] font-bold text-white shadow-xs transition active:scale-95"
              >
                <span>前往 Visit Japan Web 填寫入境申報</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>

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
            </section>
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

      {/* ==================== 底部 5 分頁導覽列 (68px) ==================== */}
      <nav className="fixed inset-x-0 bottom-0 z-30 h-[68px] border-t border-[#e7e2d8] bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-full max-w-md grid-cols-5">
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
                className={`flex flex-col items-center justify-center gap-0.5 py-1 transition ${
                  isActive ? 'text-[#0369a1]' : 'text-[#78716c]'
                }`}
              >
                <span
                  className={`grid h-9 w-14 place-items-center rounded-full transition-colors ${
                    isActive ? 'bg-[#e0f2fe]' : 'bg-transparent'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`}
                  />
                </span>
                <span className="text-[11px] font-bold leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
