import fs from "fs";
import path from "path";
import { ENV } from "./env";
import { getLocalStoragePath } from "../storage";

const DEFAULT_OCR_SPACE_FREE_KEY = "helloworld";

type OcrSpaceParsedResult = {
  ParsedText?: string;
};

type OcrSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[] | string;
  ParsedResults?: OcrSpaceParsedResult[];
};

// ─── 내장 항공사 사전 (IATA 2자리 코드 → 항공사명) ──────────────────────────────
const AIRLINE_BY_CODE: Record<string, string> = {
  KE: "대한항공",
  OZ: "아시아나항공",
  "7C": "제주항공",
  LJ: "진에어",
  TW: "티웨이항공",
  BX: "에어부산",
  RS: "에어서울",
  YP: "에어프레미아",
  RF: "에어로케이",
  ZE: "이스타항공",
  NH: "전일본공수(ANA)",
  JL: "일본항공(JAL)",
  MM: "피치항공",
  GK: "젯스타 재팬",
  ZG: "집에어(ZIPAIR)",
  NQ: "에어재팬",
  SQ: "싱가포르항공",
  TR: "스쿠트항공",
  CX: "캐세이퍼시픽",
  UO: "홍콩익스프레스",
  CI: "중화항공",
  BR: "에바항공",
  VN: "베트남항공",
  VJ: "비엣젯항공",
  TG: "타이항공",
  PR: "필리핀항공",
  "5J": "세부퍼시픽",
  AA: "아메리칸항공",
  UA: "유나이티드항공",
  DL: "델타항공",
  HA: "하와이안항공",
  AF: "에어프랑스",
  LH: "루프트한자",
  BA: "영국항공",
  KL: "KLM네덜란드항공",
  AY: "핀에어",
  TK: "터키항공",
  EK: "에미레이트항공",
  QR: "카타르항공",
  EY: "에티하드항공",
  QF: "콴타스항공",
};

// ─── 주요 공항/도시명 → IATA 3자리 코드 매핑 ──────────────────────────────────
const AIRPORT_ALIASES: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /인천|INCHEON|\bICN\b/i, code: "ICN" },
  { pattern: /김포|GIMPO|\bGMP\b/i, code: "GMP" },
  { pattern: /김해|부산|GIMHAE|BUSAN|\bPUS\b/i, code: "PUS" },
  { pattern: /제주|JEJU|\bCJU\b/i, code: "CJU" },
  { pattern: /청주|CHEONGJU|\bCJJ\b/i, code: "CJJ" },
  { pattern: /대구|DAEGU|\bTAE\b/i, code: "TAE" },
  { pattern: /나리타|NARITA|成田|\bNRT\b/i, code: "NRT" },
  { pattern: /하네다|HANEDA|羽田|\bHND\b/i, code: "HND" },
  { pattern: /간사이|오사카|KANSAI|OSAKA|関西|\bKIX\b/i, code: "KIX" },
  { pattern: /후쿠오카|FUKUOKA|福岡|\bFUK\b/i, code: "FUK" },
  { pattern: /삿포로|신치토세|SAPPORO|CHITOSE|新千歳|\bCTS\b/i, code: "CTS" },
  { pattern: /나고야|주부|NAGOYA|CHUBU|中部|\bNGO\b/i, code: "NGO" },
  { pattern: /오키나와|나하|OKINAWA|NAHA|那覇|\bOKA\b/i, code: "OKA" },
  { pattern: /타오위안|타이베이|TAOYUAN|TAIPEI|\bTPE\b/i, code: "TPE" },
  { pattern: /송산|SONGSHAN|\bTSA\b/i, code: "TSA" },
  { pattern: /홍콩|HONG\s*KONG|\bHKG\b/i, code: "HKG" },
  { pattern: /마카오|MACAU|\bMFM\b/i, code: "MFM" },
  { pattern: /다낭|DA\s*NANG|\bDAD\b/i, code: "DAD" },
  { pattern: /나트랑|깜란|NHA\s*TRANG|CAM\s*RANH|\bCXR\b/i, code: "CXR" },
  { pattern: /하노이|노이바이|HANOI|\bHAN\b/i, code: "HAN" },
  { pattern: /호치민|탄손누트|HO\s*CHI\s*MINH|\bSGN\b/i, code: "SGN" },
  { pattern: /푸꾸옥|PHU\s*QUOC|\bPQC\b/i, code: "PQC" },
  { pattern: /방콕|수완나품|BANGKOK|SUVARNABHUMI|\bBKK\b/i, code: "BKK" },
  { pattern: /돈므앙|DON\s*MUEANG|\bDMK\b/i, code: "DMK" },
  { pattern: /푸켓|PHUKET|\bHKT\b/i, code: "HKT" },
  { pattern: /치앙마이|CHIANG\s*MAI|\bCNX\b/i, code: "CNX" },
  { pattern: /싱가포르|창이|SINGAPORE|CHANGI|\bSIN\b/i, code: "SIN" },
  { pattern: /마닐라|MANILA|\bMNL\b/i, code: "MNL" },
  { pattern: /세부|막탄|CEBU|\bCEB\b/i, code: "CEB" },
  { pattern: /발리|덴파사르|BALI|DENPASAR|\bDPS\b/i, code: "DPS" },
  { pattern: /괌|GUAM|\bGUM\b/i, code: "GUM" },
  { pattern: /사이판|SAIPAN|\bSPN\b/i, code: "SPN" },
  { pattern: /호놀룰루|하와이|HONOLULU|\bHNL\b/i, code: "HNL" },
  { pattern: /로스앤젤레스|LOS\s*ANGELES|\bLAX\b/i, code: "LAX" },
  { pattern: /샌프란시스코|SAN\s*FRANCISCO|\bSFO\b/i, code: "SFO" },
  { pattern: /뉴욕|존\s*F\s*케네디|NEW\s*YORK|\bJFK\b/i, code: "JFK" },
  { pattern: /파리|샤를\s*드\s*골|PARIS|\bCDG\b/i, code: "CDG" },
  { pattern: /런던|히드로|LONDON|HEATHROW|\bLHR\b/i, code: "LHR" },
  { pattern: /프랑크푸르트|FRANKFURT|\bFRA\b/i, code: "FRA" },
  { pattern: /로마|피우미치노|ROME|\bFCO\b/i, code: "FCO" },
  { pattern: /바르셀로나|BARCELONA|\bBCN\b/i, code: "BCN" },
  { pattern: /시드니|SYDNEY|\bSYD\b/i, code: "SYD" },
];

const KNOWN_IATA_CODES = new Set([
  "ICN", "GMP", "PUS", "CJU", "CJJ", "TAE", "MWX", "RSU", "USN", "KUV", "WJU",
  "NRT", "HND", "KIX", "ITM", "FUK", "CTS", "NGO", "OKA", "UKB", "HIJ", "SDJ", "KMJ", "KOJ", "MYJ", "TAK", "OIT",
  "TPE", "TSA", "KHH", "RMQ", "HKG", "MFM", "PEK", "PKX", "PVG", "SHA", "CAN", "SZX", "TAO", "DLC",
  "DAD", "CXR", "HAN", "SGN", "PQC", "BKK", "DMK", "HKT", "CNX", "SIN", "KUL", "BKI", "MNL", "CEB", "CRK", "TAG", "DPS", "CGK",
  "GUM", "SPN", "HNL", "LAX", "SFO", "SEA", "JFK", "EWR", "IAD", "ORD", "DFW", "ATL", "BOS", "LAS", "YVR", "YYZ",
  "CDG", "LHR", "LGW", "FRA", "MUC", "FCO", "MXP", "MAD", "BCN", "AMS", "ZRH", "VIE", "PRG", "BUD", "IST", "HEL",
  "DXB", "AUH", "DOH", "SYD", "MEL", "BNE", "AKL",
]);

/** 로컬 `/manus-storage/...` URL을 Base64 Data URL로 변환 */
async function resolveImageToBase64IfNeeded(imageUrl: string): Promise<{ isBase64: boolean; value: string }> {
  if (imageUrl.startsWith("data:image/")) {
    return { isBase64: true, value: imageUrl };
  }
  const storageMatch = imageUrl.match(/\/manus-storage\/(.+)$/);
  if (storageMatch?.[1]) {
    const localPath = getLocalStoragePath(storageMatch[1]);
    if (fs.existsSync(localPath)) {
      const buf = await fs.promises.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return { isBase64: true, value: `data:${mime};base64,${buf.toString("base64")}` };
    }
  }
  return { isBase64: false, value: imageUrl };
}

export async function extractTextWithFreeOcr(imageUrl: string): Promise<string> {
  const resolved = await resolveImageToBase64IfNeeded(imageUrl);
  const form = new URLSearchParams();
  if (resolved.isBase64) {
    form.set("base64Image", resolved.value);
  } else {
    form.set("url", resolved.value);
  }
  // 한국어+영어 동시 지원 (OCR.space Engine 1/2)
  form.set("language", "kor");
  form.set("isOverlayRequired", "false");
  form.set("OCREngine", "2");

  const response = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: {
      apikey: ENV.ocrSpaceApiKey || DEFAULT_OCR_SPACE_FREE_KEY,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(`OCR API failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OcrSpaceResponse;
  if (data.IsErroredOnProcessing) {
    const err = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(", ")
      : data.ErrorMessage ?? "Unknown OCR error";
    throw new Error(err);
  }

  return (data.ParsedResults ?? [])
    .map(result => result.ParsedText ?? "")
    .join("\n")
    .trim();
}

const firstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return null;
};

/** 영문 월 약어 매핑 */
const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/**
 * 다양한 날짜 문자열을 YYYY-MM-DD 로 정규화 (인식 불가 시 원본 반환)
 * 지원: 2026-05-10, 2026.05.10, 2026/05/10, 2026년 5월 10일, 10 MAY 2026, May 10, 2026
 */
export function normalizeDateStr(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // 1. YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYY년 M월 D일
  const ymd = trimmed.match(/(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 2. DD MMM YYYY (e.g. 10 MAY 2026 or 10May26)
  const dmy = trimmed.match(/\b(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s,.-]*(\d{2,4})\b/i);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const mon = MONTH_MAP[dmy[2].slice(0, 3).toUpperCase()];
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    if (mon) return `${year}-${mon}-${day}`;
  }

  // 3. MMM DD, YYYY (e.g. May 10, 2026)
  const mdy = trimmed.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})[\s,.-]+(\d{4})\b/i);
  if (mdy) {
    const mon = MONTH_MAP[mdy[1].slice(0, 3).toUpperCase()];
    const day = mdy[2].padStart(2, "0");
    const year = mdy[3];
    if (mon) return `${year}-${mon}-${day}`;
  }

  return trimmed;
}

/**
 * 날짜+시간 문자열을 YYYY-MM-DDTHH:mm 형태로 정규화
 */
export function normalizeDateTimeStr(raw: string | null, fallbackDate?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // 이미 ISO 포맷(YYYY-MM-DDTHH:mm)인 경우
  const isoMatch = trimmed.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (isoMatch) return isoMatch[1];

  const datePart = normalizeDateStr(trimmed);
  const timeMatch = trimmed.match(/(?:오전|오후|AM|PM)?\s*(\d{1,2}):(\d{2})\s*(?:AM|PM)?/i);

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2];
    const isPM = /오후|PM/i.test(trimmed);
    const isAM = /오전|AM/i.test(trimmed);
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
    const hhmm = `${String(hour).padStart(2, "0")}:${minute}`;

    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return `${datePart}T${hhmm}`;
    }
    if (fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
      return `${fallbackDate}T${hhmm}`;
    }
    return hhmm;
  }

  return trimmed;
}

// ─── 항공권 스마트 파서 (한국어/영어/일본어 + 공항·항공사 사전 결합) ─────────────
export function parseFlightFromText(text: string) {
  const upper = text.toUpperCase();

  // 1. 출발/도착 공항 추출: "ICN -> NRT", "ICN - NRT", "인천(ICN) → 나리타(NRT)" 등
  let departureAirport: string | null = null;
  let arrivalAirport: string | null = null;

  const iataArrow = upper.match(/\b([A-Z]{3})\b\s*(?:-|->|→|▶|⇒|~|TO|에서)\s*\b([A-Z]{3})\b/);
  if (iataArrow && (KNOWN_IATA_CODES.has(iataArrow[1]) || KNOWN_IATA_CODES.has(iataArrow[2]) || /^[A-Z]{3}$/.test(iataArrow[1]))) {
    departureAirport = iataArrow[1];
    arrivalAirport = iataArrow[2];
  }

  if (!departureAirport || !arrivalAirport) {
    const depLabel = firstMatch(text, [
      /(?:출발(?:지|공항)?|DEPART(?:URE)?|FROM)\s*[:#-]?\s*([^\n]+)/i,
    ]);
    const arrLabel = firstMatch(text, [
      /(?:도착(?:지|공항)?|ARRIV(?:AL)?|TO)\s*[:#-]?\s*([^\n]+)/i,
    ]);
    if (depLabel) {
      for (const a of AIRPORT_ALIASES) {
        if (a.pattern.test(depLabel)) { departureAirport = a.code; break; }
      }
    }
    if (arrLabel) {
      for (const a of AIRPORT_ALIASES) {
        if (a.pattern.test(arrLabel)) { arrivalAirport = a.code; break; }
      }
    }
  }

  // 본문 전체에서 알려진 공항 코드/별칭 순서대로 2개 탐색 폴백
  if (!departureAirport || !arrivalAirport) {
    const foundCodes: string[] = [];
    for (const token of upper.match(/\b[A-Z]{3}\b/g) ?? []) {
      if (KNOWN_IATA_CODES.has(token) && !foundCodes.includes(token)) {
        foundCodes.push(token);
      }
    }
    if (foundCodes.length < 2) {
      for (const a of AIRPORT_ALIASES) {
        if (a.pattern.test(text) && !foundCodes.includes(a.code)) {
          foundCodes.push(a.code);
        }
      }
    }
    if (!departureAirport && foundCodes[0]) departureAirport = foundCodes[0];
    if (!arrivalAirport && foundCodes[1]) arrivalAirport = foundCodes[1];
  }

  // 2. 편명 추출 (e.g. KE123, OZ 102, 7C1102, TW201, LJ203)
  let flightNumber = firstMatch(upper, [
    /(?:FLIGHT\s*(?:NO\.?|NUMBER)?|편명|항공편(?:명)?)\s*[:#-]?\s*([A-Z0-9]{2}\s?\d{2,4})\b/i,
  ]);
  if (!flightNumber) {
    const candidates = upper.match(/\b([A-Z0-9]{2})\s?(\d{2,4})\b/g) ?? [];
    for (const cand of candidates) {
      const m = cand.match(/^([A-Z0-9]{2})\s?(\d{2,4})$/);
      if (m && (AIRLINE_BY_CODE[m[1]] || /^[A-Z]{2}$/.test(m[1]))) {
        // 연도(2024~2030)나 좌석번호 등 오탐 제외
        if (!/^(20\d{2}|19\d{2})$/.test(cand.replace(/\s/g, ""))) {
          flightNumber = `${m[1]}${m[2]}`;
          break;
        }
      }
    }
  } else {
    flightNumber = flightNumber.replace(/\s+/g, "");
  }

  // 3. 항공사명 추출 (라벨 매칭 → 알려진 항공사 한글/영문명 매칭 → 편명 코드로 자동 추론)
  let airline = firstMatch(text, [
    /(?:AIRLINE|항공사|운항사)\s*[:#-]?\s*([^\n|]+)/i,
  ]);
  if (!airline) {
    const knownAirlineNames = [
      "대한항공", "Korean Air", "아시아나항공", "Asiana Airlines", "제주항공", "Jeju Air",
      "진에어", "Jin Air", "티웨이항공", "T'way Air", "에어부산", "Air Busan",
      "에어서울", "Air Seoul", "에어프레미아", "Air Premia", "이스타항공", "Eastar Jet",
      "전일본공수", "ANA", "일본항공", "Japan Airlines", "JAL", "피치항공", "Peach",
      "싱가포르항공", "Singapore Airlines", "비엣젯", "VietJet", "베트남항공", "Vietnam Airlines",
      "타이항공", "Thai Airways", "캐세이퍼시픽", "Cathay Pacific",
    ];
    for (const name of knownAirlineNames) {
      if (new RegExp(name, "i").test(text)) {
        airline = name;
        break;
      }
    }
  }
  if (!airline && flightNumber) {
    const prefix = flightNumber.slice(0, 2).toUpperCase();
    if (AIRLINE_BY_CODE[prefix]) {
      airline = AIRLINE_BY_CODE[prefix];
    }
  }

  // 4. 기준 날짜 추출 (티켓 상단에 날짜가 따로 적힌 경우 대비)
  const generalDateMatch = text.match(/(\d{4}\s*[-./년]\s*\d{1,2}\s*[-./월]\s*\d{1,2})|(\b\d{1,2}\s*(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s,.-]*\d{2,4}\b)/i);
  const fallbackDate = generalDateMatch ? normalizeDateStr(generalDateMatch[0]) : null;

  // 5. 출발/도착 시간 추출
  const rawDepTime = firstMatch(text, [
    /(?:DEPART(?:URE)?\s*(?:TIME|DATE)?|출발\s*(?:일시|시간)?|STD)\s*[:#-]?\s*([^\n]+)/i,
  ]);
  const rawArrTime = firstMatch(text, [
    /(?:ARRIV(?:AL)?\s*(?:TIME|DATE)?|도착\s*(?:일시|시간)?|STA)\s*[:#-]?\s*([^\n]+)/i,
  ]);

  let departureTime = normalizeDateTimeStr(rawDepTime, fallbackDate);
  let arrivalTime = normalizeDateTimeStr(rawArrTime, fallbackDate);

  // 라벨 없이 "09:20 -> 11:30" 형태로 적힌 경우
  if (!departureTime && !arrivalTime) {
    const timePair = text.match(/\b(\d{2}:\d{2})\b\s*(?:-|->|→|~)\s*\b(\d{2}:\d{2})\b/);
    if (timePair) {
      departureTime = normalizeDateTimeStr(timePair[1], fallbackDate);
      arrivalTime = normalizeDateTimeStr(timePair[2], fallbackDate);
    }
  }

  // 6. 예약번호(PNR) & 좌석번호 추출
  const bookingRef = firstMatch(upper, [
    /(?:BOOKING\s*(?:REF(?:ERENCE)?|NO\.?)?|PNR|RESERVATION\s*(?:NO\.?|REF|CODE)?|CONFIRMATION\s*(?:NO\.?|CODE)?|예약\s*(?:번호|코드)|항공권\s*예약번호)\s*[:#-\n]?\s*([A-Z0-9]{5,8})\b/i,
  ]);
  const seatNumber = firstMatch(upper, [
    /(?:SEAT(?:\s*NO\.?)?|좌석(?:\s*번호)?)\s*[:#-]?\s*(\d{1,2}[A-K])\b/i,
    /SEAT\s*[:#-]?\s*([A-Z0-9]{1,4})/i,
  ]);

  // 7. 출발편/귀국편 자동 추론 (한국 공항 출발이면 departure, 한국 공항 도착이면 return)
  const krAirports = new Set(["ICN", "GMP", "PUS", "CJU", "CJJ", "TAE"]);
  let type: "departure" | "return" | "transit" | null = null;
  if (departureAirport && arrivalAirport) {
    if (krAirports.has(departureAirport) && !krAirports.has(arrivalAirport)) type = "departure";
    else if (!krAirports.has(departureAirport) && krAirports.has(arrivalAirport)) type = "return";
  }

  return {
    airline,
    flightNumber,
    departureAirport,
    arrivalAirport,
    departureTime,
    arrivalTime,
    bookingRef,
    seatNumber,
    type,
  };
}

// ─── 렌트카 스마트 파서 (한국어/영어/일본어) ─────────────────────────────────
export function parseRentalFromText(text: string) {
  let company = firstMatch(text, [
    /(?:RENTAL\s*COMPANY|COMPANY|렌트(?:카)?\s*업체|대여\s*업체|업체명)\s*[:#-]?\s*([^\n]+)/i,
  ]);
  if (!company) {
    const knownRentalCompanies = [
      "Hertz", "허츠", "Avis", "에이비스", "Budget", "버젯", "Europcar", "유럽카",
      "Sixt", "식스트", "Alamo", "알라모", "Enterprise", "엔터프라이즈",
      "Toyota Rent a Car", "도요타 렌터카", "토요타 렌트카", "Nippon Rent-A-Car", "닛폰 렌터카",
      "Times Car Rental", "타임즈 카 렌탈", "Orix Rent a Car", "오릭스 렌터카",
      "롯데렌터카", "SK렌터카", "쏘카", "제주패스렌트카",
    ];
    for (const c of knownRentalCompanies) {
      if (new RegExp(c, "i").test(text)) { company = c; break; }
    }
  }

  const carModel = firstMatch(text, [
    /(?:CAR\s*(?:MODEL|TYPE)?|VEHICLE|차종|차량(?:명|모델)?|대여\s*차량)\s*[:#-]?\s*([^\n]+)/i,
  ]);

  const pickupLocation = firstMatch(text, [
    /(?:PICK[ -]?UP\s*(?:LOCATION|PLACE|BRANCH|OFFICE)|픽업\s*(?:장소|지점|위치)|인수\s*(?:장소|지점)|대여\s*(?:장소|지점))\s*[:#-]?\s*([^\n]+)/i,
    /PICK[ -]?UP\s*[:#-]?\s*([A-Za-z가-힣][^\n\d]{2,})/i,
  ]);

  const dropoffLocation = firstMatch(text, [
    /(?:DROP[ -]?OFF\s*(?:LOCATION|PLACE|BRANCH|OFFICE)|RETURN\s*(?:LOCATION|PLACE)|반납\s*(?:장소|지점|위치))\s*[:#-]?\s*([^\n]+)/i,
    /DROP[ -]?OFF\s*[:#-]?\s*([A-Za-z가-힣][^\n\d]{2,})/i,
  ]);

  const rawPickupTime = firstMatch(text, [
    /(?:PICK[ -]?UP\s*(?:DATE(?:\s*&\s*TIME)?|TIME)|픽업\s*(?:일시|날짜|시간)|인수\s*(?:일시|날짜)|대여\s*일시)\s*[:#-]?\s*([^\n]+)/i,
  ]);
  const rawDropoffTime = firstMatch(text, [
    /(?:DROP[ -]?OFF\s*(?:DATE(?:\s*&\s*TIME)?|TIME)|RETURN\s*(?:DATE|TIME)|반납\s*(?:일시|날짜|시간))\s*[:#-]?\s*([^\n]+)/i,
  ]);

  const pickupTime = normalizeDateTimeStr(rawPickupTime);
  const dropoffTime = normalizeDateTimeStr(rawDropoffTime);

  const bookingRef = firstMatch(text, [
    /(?:BOOKING|RESERVATION|CONFIRMATION|VOUCHER)\s*(?:NO\.?|REF|NUMBER|ID|CODE)?\s*[:#-]?\s*([A-Z0-9-]{5,14})/i,
    /(?:예약\s*(?:번호|코드)|바우처\s*번호)\s*[:#-]?\s*([A-Z0-9-]{5,14})/i,
  ]);

  const { price, currency } = extractPriceAndCurrency(text);

  return {
    company,
    carModel,
    pickupLocation,
    dropoffLocation,
    pickupTime,
    dropoffTime,
    bookingRef,
    price,
    currency,
  };
}

function extractPriceAndCurrency(text: string): { price: string | null; currency: string | null } {
  const rawPrice = firstMatch(text, [
    /(?:TOTAL(?:\s*PRICE|\s*AMOUNT)?|AMOUNT|PRICE|결제\s*금액|총\s*(?:금액|요금)|요금|숙박비)\s*[:#-]?\s*(?:KRW|USD|JPY|EUR|GBP|CNY|AUD|CAD|₩|\$|¥|€)?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(?:₩|¥|\$)\s*([\d,]+(?:\.\d{1,2})?)/,
    /([\d,]{3,})\s*(?:원|엔|KRW|USD|JPY|EUR)/i,
  ]);
  const price = rawPrice ? rawPrice.replace(/,/g, "") : null;

  let currency = firstMatch(text, [/\b(USD|EUR|KRW|JPY|GBP|CNY|AUD|CAD|THB|VND|TWD|SGD|HKD)\b/i]);
  if (currency) {
    currency = currency.toUpperCase();
  } else if (/₩|[0-9]\s*원/.test(text)) {
    currency = "KRW";
  } else if (/¥|[0-9]\s*엔/.test(text)) {
    currency = "JPY";
  } else if (/\$/.test(text)) {
    currency = "USD";
  } else if (/€/.test(text)) {
    currency = "EUR";
  }
  return { price, currency };
}

// ─── 숙박 바우처 스마트 파서 (한국어/영어/일본어) ────────────────────────────
export function parseAccommodationFromText(text: string) {
  // 1. 숙소명 추출 (라벨 매칭 → 호텔/료칸/리조트/호스텔 패턴 매칭)
  let name = firstMatch(text, [
    /(?:HOTEL(?:\s*NAME)?|PROPERTY(?:\s*NAME)?|ACCOMMODATION|숙소(?:명|이름)?|호텔(?:명|이름)?|숙박\s*시설)\s*[:#-]?\s*([^\n]+)/i,
  ]);
  if (!name) {
    const hotelLine = firstMatch(text, [
      /^([^\n:]{2,40}(?:호텔|료칸|리조트|스테이|호스텔|펜션|게스트하우스|Hotel|Resort|Ryokan|Inn|Hostel|Suites|Palace|Grand)[^\n:]{0,25})$/im,
    ]);
    if (hotelLine) name = hotelLine.trim();
  }

  // 2. 주소 추출
  const address = firstMatch(text, [
    /(?:ADDRESS|LOCATION|주소|위치|소재지)\s*[:#-]?\s*([^\n]+)/i,
  ]);

  // 3. 체크인 / 체크아웃 날짜 추출 및 YYYY-MM-DD 정규화
  const rawCheckIn = firstMatch(text, [
    /(?:CHECK[ -]?IN(?:\s*DATE)?|체크인(?:\s*날짜|\s*일시)?|입실(?:일)?)\s*[:#-\n]?\s*([^\n]+)/i,
  ]);
  const rawCheckOut = firstMatch(text, [
    /(?:CHECK[ -]?OUT(?:\s*DATE)?|체크아웃(?:\s*날짜|\s*일시)?|퇴실(?:일)?)\s*[:#-\n]?\s*([^\n]+)/i,
  ]);

  let checkIn = normalizeDateStr(rawCheckIn);
  let checkOut = normalizeDateStr(rawCheckOut);

  // "2026-05-10 ~ 2026-05-12" 형태 범위 매칭 폴백
  if (!checkIn || !checkOut) {
    const rangeMatch = text.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*(?:~|-|–|부터|to)\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i);
    if (rangeMatch) {
      if (!checkIn) checkIn = normalizeDateStr(rangeMatch[1]);
      if (!checkOut) checkOut = normalizeDateStr(rangeMatch[2]);
    }
  }

  // 4. 예약번호 & 금액
  const bookingRef = firstMatch(text, [
    /(?:BOOKING|CONFIRMATION|RESERVATION|ITINERARY)\s*(?:NO\.?|REF|NUMBER|ID|CODE)?\s*[:#-\n]?\s*([A-Z0-9-]{5,15})/i,
    /(?:예약\s*(?:번호|코드)|확인\s*번호)\s*[:#-\n]?\s*([A-Z0-9-]{5,15})/i,
  ]);

  const { price, currency } = extractPriceAndCurrency(text);

  return {
    name,
    address,
    checkIn,
    checkOut,
    bookingRef,
    price,
    currency,
  };
}
