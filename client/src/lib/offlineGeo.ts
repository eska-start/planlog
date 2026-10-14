/**
 * 외부 유료 API 없이 작동하는 오프라인/오픈소스 지오코딩 및 거리·동선 계산 엔진
 * 1) 내장 주요 여행지·관광지·공항·도시 좌표 사전 (100% 오프라인 즉시 매칭)
 * 2) OpenStreetMap Nominatim 무료 지오코딩 폴백 + localStorage 영구 캐시
 * 3) Haversine 직선거리 및 도보/차량 예상 소요시간 계산
 */

export type GeoPoint = {
  lat: number;
  lng: number;
  displayName?: string;
  address?: string;
};

export type OfflineLandmark = {
  keywords: string[];
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: "place" | "food" | "activity" | "shopping" | "accommodation";
};

// ─── 주요 여행 도시·랜드마크·공항 오프라인 좌표 사전 ──────────────────────────
export const OFFLINE_LANDMARKS: OfflineLandmark[] = [
  // 도쿄 (Tokyo)
  { keywords: ["아사쿠사", "센소지", " 카미나리몬", "sensoji", "asakusa"], name: "아사쿠사 센소지", address: "도쿄 다이토구 아사쿠사 2-3-1", lat: 35.714765, lng: 139.796655, category: "place" },
  { keywords: ["도쿄타워", "도쿄 타워", "tokyo tower"], name: "도쿄타워", address: "도쿄 미나토구 시바코엔 4-2-8", lat: 35.658581, lng: 139.745433, category: "place" },
  { keywords: ["스카이트리", "도쿄 스카이트리", "skytree"], name: "도쿄 스카이트리", address: "도쿄 스미다구 오시아게 1-1-2", lat: 35.710063, lng: 139.8107, category: "place" },
  { keywords: ["시부야 스카이", "시부야스카이", "시부야 스크램블", "시부야역", "시부야", "shibuya"], name: "시부야 스카이 / 스크램블 교차로", address: "도쿄 시부야구 시부야 2-24-12", lat: 35.658514, lng: 139.70133, category: "place" },
  { keywords: ["신주쿠 그랜드", "신주쿠역", "신주쿠", "가부키초", "신주쿠 교엔", "shinjuku"], name: "신주쿠", address: "도쿄 신주쿠구 신주쿠 3-38-1", lat: 35.689607, lng: 139.700571, category: "place" },
  { keywords: ["하라주쿠", "다케시타", "메이지신궁", "메이지 신궁", "harajuku", "meiji"], name: "하라주쿠 / 메이지신궁", address: "도쿄 시부야구 진구마에 1", lat: 35.670168, lng: 139.702687, category: "place" },
  { keywords: ["긴자", "ginza"], name: "긴자 거리", address: "도쿄 주오구 긴자 4-6-16", lat: 35.671223, lng: 139.766486, category: "shopping" },
  { keywords: ["우에노 공원", "우에노", "아메요코", "ueno"], name: "우에노 공원", address: "도쿄 다이토구 우에노코엔", lat: 35.714756, lng: 139.773431, category: "place" },
  { keywords: ["오다이바", "아쿠아시티", "도쿄만", "odaiba"], name: "오다이바 해변공원", address: "도쿄 미나토구 다이바 1-4", lat: 35.629953, lng: 139.775326, category: "place" },
  { keywords: ["롯폰기", "롯폰기 힐즈", "모리 타워", "아자부다이", "roppongi", "azabudai"], name: "롯폰기 힐즈 / 아자부다이 힐즈", address: "도쿄 미나토구 롯폰기 6-10-1", lat: 35.660464, lng: 139.729249, category: "place" },
  { keywords: ["도쿄 디즈니랜드", "도쿄 디즈니씨", "디즈니랜드", "디즈니씨", "tokyo disney"], name: "도쿄 디즈니 리조트", address: "지바현 우라야스시 마이하마 1-1", lat: 35.632896, lng: 139.880394, category: "activity" },
  { keywords: ["아키하바라", "akihabara"], name: "아키하바라 전자상가", address: "도쿄 지요다구 소토칸다 1", lat: 35.698383, lng: 139.773072, category: "shopping" },
  { keywords: ["도쿄역", "마루노우치", "tokyo station"], name: "도쿄역", address: "도쿄 지요다구 마루노우치 1", lat: 35.681236, lng: 139.767125, category: "place" },
  { keywords: ["츠키지", "쓰키지", "도요스", "tsukiji", "toyosu"], name: "츠키지 장외시장", address: "도쿄 주오구 츠키지 4-16-2", lat: 35.665486, lng: 139.770667, category: "food" },
  { keywords: ["나리타 공항", "나리타국제공항", "나리타", "nrt", "narita"], name: "나리타 국제공항 (NRT)", address: "지바현 나리타시 후리고메 1-1", lat: 35.771987, lng: 140.39285, category: "place" },
  { keywords: ["하네다 공항", "하네다국제공항", "하네다", "hnd", "haneda"], name: "하네다 국제공항 (HND)", address: "도쿄 오타구 하네다쿠코 3-3-2", lat: 35.549393, lng: 139.779839, category: "place" },

  // 오사카 & 교토 (Osaka & Kyoto)
  { keywords: ["도톤보리", "글리코상", "글리코", "신사이바시", "dotonbori", "shinsaibashi"], name: "도톤보리 / 신사이바시", address: "오사카 주오구 도톤보리 1", lat: 34.668725, lng: 135.501297, category: "place" },
  { keywords: ["오사카성", "오사카 성", "osaka castle"], name: "오사카성", address: "오사카 주오구 오사카조 1-1", lat: 34.687315, lng: 135.526201, category: "place" },
  { keywords: ["유니버설 스튜디오", "유니버셜 스튜디오", "usj", "universal studios japan"], name: "유니버설 스튜디오 재팬 (USJ)", address: "오사카 고노하나구 사쿠라지마 2-1-33", lat: 34.665442, lng: 135.432338, category: "activity" },
  { keywords: ["우메다", "공중정원", "헵파이브", "오사카역", "umeda"], name: "우메다 스카이빌딩 / 오사카역", address: "오사카 기타구 오요도나카 1-1-88", lat: 34.705505, lng: 135.489668, category: "place" },
  { keywords: ["난바", "구로몬", "덴덴타운", "namba", "kuromon"], name: "난바 / 구로몬 시장", address: "오사카 주오구 난바 5-1-60", lat: 34.66418, lng: 135.50223, category: "food" },
  { keywords: ["간사이 공항", "간사이국제공항", "kix", "kansai"], name: "간사이 국제공항 (KIX)", address: "오사카 이즈미사노시 센슈쿠코키타 1", lat: 34.432002, lng: 135.230394, category: "place" },
  { keywords: ["기요미즈데라", "청수사", "산넨자카", "니넨자카", "kiyomizu"], name: "기요미즈데라 (청수사)", address: "교토 히가시야마구 기요미즈 1-294", lat: 34.994856, lng: 135.785046, category: "place" },
  { keywords: ["후시미 이나리", "후시미이나리", "여우신사", "fushimi inari"], name: "후시미 이나리 신사", address: "교토 후시미구 후카쿠사 야부노우치초 68", lat: 34.96714, lng: 135.772672, category: "place" },
  { keywords: ["아라시야마", "치쿠린", "도게츠교", "arashiyama"], name: "아라시야마 치쿠린", address: "교토 우쿄구 사가텐류지", lat: 35.016964, lng: 135.671301, category: "place" },
  { keywords: ["금각사", "킨카쿠지", "kinkakuji"], name: "금각사 (킨카쿠지)", address: "교토 기타구 킨카쿠지초 1", lat: 35.03937, lng: 135.729243, category: "place" },
  { keywords: ["교토역", "기온", "가와라마치", "kyoto station", "gion"], name: "교토역 / 기온 거리", address: "교토 시모교구 히가시시오코지초", lat: 34.985849, lng: 135.758767, category: "place" },

  // 후쿠오카 & 삿포로 & 오키나와
  { keywords: ["하카타역", "하카타", "캐널시티", "hakata", "canal city"], name: "하카타역 / 캐널시티", address: "후쿠오카 하카타구 하카타에키추오가이 1-1", lat: 33.589728, lng: 130.420727, category: "place" },
  { keywords: ["텐진", "다이묘", "나카스", "tenjin", "nakasu"], name: "텐진 / 나카스 포장마차 거리", address: "후쿠오카 주오구 텐진 2", lat: 33.590355, lng: 130.399722, category: "food" },
  { keywords: ["오호리 공원", "오호리공원", "모모치 해변", "후쿠오카 타워", "ohori", "fukuoka tower"], name: "오호리 공원 / 후쿠오카 타워", address: "후쿠오카 주오구 오호리코엔 1-2", lat: 33.586135, lng: 130.37645, category: "place" },
  { keywords: ["다자이후", "dazaifu"], name: "다자이후 텐만구", address: "후쿠오카 다자이후시 사이후 4-7-1", lat: 33.521484, lng: 130.534857, category: "place" },
  { keywords: ["후쿠오카 공항", "fuk", "fukuoka airport"], name: "후쿠오카 국제공항 (FUK)", address: "후쿠오카 하카타구 시모우스이 778-1", lat: 33.585942, lng: 130.450686, category: "place" },
  { keywords: ["삿포로역", "오도리 공원", "스스키노", "sapporo", "odori", "susukino"], name: "삿포로 오도리 공원 / 스스키노", address: "홋카이도 삿포로 주오구 오도리니시", lat: 43.059884, lng: 141.351406, category: "place" },
  { keywords: ["오타루", "오타루 운하", "otaru"], name: "오타루 운하", address: "홋카이도 오타루시 미나토마치 5", lat: 43.199422, lng: 141.001679, category: "place" },
  { keywords: ["신치토세", "cts", "chitose"], name: "신치토세 공항 (CTS)", address: "홋카이도 지토세시 비비", lat: 42.775199, lng: 141.69228, category: "place" },
  { keywords: ["국제거리", "나하", "아메리칸 빌리지", "오키나와", "츄라우미", "okinawa", "naha", "churaumi"], name: "오키나와 나하 국제거리", address: "오키나와 나하시 마키시 3", lat: 26.215206, lng: 127.685364, category: "place" },

  // 대한민국 (서울 · 제주 · 부산)
  { keywords: ["인천공항", "인천국제공항", "icn", "incheon airport"], name: "인천국제공항 (ICN)", address: "인천 중구 공항로 272", lat: 37.460191, lng: 126.440696, category: "place" },
  { keywords: ["김포공항", "gmp", "gimpo airport"], name: "김포국제공항 (GMP)", address: "서울 강서구 하늘길 112", lat: 37.558655, lng: 126.794474, category: "place" },
  { keywords: ["경복궁", "광화문", "북촌", "인사동", "gyeongbokgung"], name: "경복궁 / 광화문", address: "서울 종로구 사직로 161", lat: 37.579617, lng: 126.977041, category: "place" },
  { keywords: ["명동", "남산타워", "n서울타워", "서울역", "myeongdong", "seoul"], name: "명동 / 남산 N서울타워", address: "서울 용산구 남산공원길 105", lat: 37.551169, lng: 126.988227, category: "place" },
  { keywords: ["홍대", "연남동", "성수동", "강남", "잠실", "롯데월드타워"], name: "서울 핫플레이스", address: "서울 마포구 양화로 160", lat: 37.55628, lng: 126.92363, category: "place" },
  { keywords: ["제주공항", "제주국제공항", "cju", "jeju airport"], name: "제주국제공항 (CJU)", address: "제주 제주시 공항로 2", lat: 33.510414, lng: 126.491353, category: "place" },
  { keywords: ["성산일출봉", "우도", "섭지코지", "seongsan"], name: "성산일출봉", address: "제주 서귀포시 성산읍 일출로 284-12", lat: 33.458056, lng: 126.9425, category: "place" },
  { keywords: ["애월", "협재", "한림", "곽지", "aewol", "hyeopjae"], name: "애월 카페거리 / 협재해수욕장", address: "제주 제주시 애월읍 애월로1길 24", lat: 33.46282, lng: 126.30956, category: "food" },
  { keywords: ["서귀포", "중문", "천지연", "올레시장", "seogwipo"], name: "서귀포 매일올레시장 / 중문", address: "제주 서귀포시 중앙로62번길 18", lat: 33.24942, lng: 126.56368, category: "food" },
  { keywords: ["해운대", "광안리", "더베이101", "센텀시티", "부산역", "부산", "haeundae", "gwangalli", "busan"], name: "부산 해운대 / 광안리 해변", address: "부산 해운대구 해운대해변로 264", lat: 35.158698, lng: 129.160384, category: "place" },

  // 동남아 · 대만 · 구미주 주요 도시
  { keywords: ["다낭", "미케비치", "한시장", "바나힐", "호이안", "danang", "hoi an", "dad"], name: "다낭 미케비치 / 한시장", address: "Da Nang, Vietnam", lat: 16.054407, lng: 108.202167, category: "place" },
  { keywords: ["방콕", "아속", "수쿰빗", "왕궁", "왓아룬", "아이콘시암", "수완나품", "bangkok", "bkk"], name: "방콕 시내 / 아이콘시암", address: "Bangkok, Thailand", lat: 13.756331, lng: 100.501765, category: "place" },
  { keywords: ["타이베이", "시먼딩", "타이베이 101", "지우펀", "단수이", "타오위안", "taipei", "ximending", "tpe"], name: "타이베이 시먼딩 / 101 타워", address: "Taipei, Taiwan", lat: 25.033964, lng: 121.564468, category: "place" },
  { keywords: ["싱가포르", "마리나베이", "가든스 바이 더 베이", "센토사", "창이", "singapore", "marina bay", "sin"], name: "싱가포르 마리나 베이 샌즈", address: "10 Bayfront Ave, Singapore", lat: 1.283375, lng: 103.860726, category: "place" },
  { keywords: ["파리", "에펠탑", "루브르", "개선문", "몽마르뜨", "paris", "eiffel", "cdg"], name: "파리 에펠탑 / 루브르", address: "Champ de Mars, Paris, France", lat: 48.85837, lng: 2.294481, category: "place" },
  { keywords: ["런던", "빅벤", "타워브릿지", "대영박물관", "히드로", "london", "lhr"], name: "런던 빅벤 / 웨스트민스터", address: "London, UK", lat: 51.500729, lng: -0.124625, category: "place" },
  { keywords: ["로마", "콜로세움", "트레비", "바티칸", "rome", "colosseum", "fco"], name: "로마 콜로세움", address: "Piazza del Colosseo, Rome, Italy", lat: 41.89021, lng: 12.492231, category: "place" },
  { keywords: ["뉴욕", "타임스퀘어", "센트럴파크", "자유의 여신상", "맨해튼", "new york", "times square", "jfk"], name: "뉴욕 타임스퀘어", address: "Manhattan, NY 10036, USA", lat: 40.758, lng: -73.9855, category: "place" },
  { keywords: ["하와이", "와이키키", "호놀룰루", "알라모아나", "waikiki", "honolulu", "hnl"], name: "하와이 와이키키 비치", address: "Honolulu, HI 96815, USA", lat: 21.279346, lng: -157.829185, category: "place" },
];

const GEO_CACHE_KEY = "planlog-geo-cache-v1";

function loadGeoCache(): Record<string, GeoPoint> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGeoCache(cache: Record<string, GeoPoint>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

/**
 * 오프라인 사전에서 장소명/주소와 매칭되는 랜드마크 검색
 */
export function matchOfflineLandmark(query: string): OfflineLandmark | null {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return null;

  for (const item of OFFLINE_LANDMARKS) {
    for (const kw of item.keywords) {
      if (normalized.includes(kw.toLowerCase()) || kw.toLowerCase().includes(normalized)) {
        return item;
      }
    }
  }
  return null;
}

/**
 * 입력어 기준 오프라인 자동완성 추천 목록 반환 (ItineraryTab 장소 추가용)
 */
export function searchOfflineSuggestions(query: string, limit = 5): OfflineLandmark[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return OFFLINE_LANDMARKS.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.address.toLowerCase().includes(q) ||
    item.keywords.some(k => k.toLowerCase().includes(q))
  ).slice(0, limit);
}

/**
 * 외부 유료 API 없이 장소명/주소를 위도·경도로 변환
 * 1순위: localStorage 캐시
 * 2순위: 내장 오프라인 여행지 사전 (0ms, 오프라인 작동)
 * 3순위: OpenStreetMap Nominatim 무료 지오코딩 (API 키 불필요)
 */
export async function resolvePlaceCoordinates(
  placeName?: string | null,
  address?: string | null,
): Promise<GeoPoint | null> {
  const cleanName = (placeName ?? "").replace(/^🏨\s*(?:체크인|체크아웃|숙박)\s*—\s*/, "").trim();
  const cleanAddr = (address ?? "").trim();
  const cacheKey = `${cleanName}|${cleanAddr}`.toLowerCase();
  if (!cleanName && !cleanAddr) return null;

  const cache = loadGeoCache();
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // 1. 내장 오프라인 사전 우선 매칭
  const offlineHit = matchOfflineLandmark(`${cleanName} ${cleanAddr}`);
  if (offlineHit) {
    const point: GeoPoint = {
      lat: offlineHit.lat,
      lng: offlineHit.lng,
      displayName: offlineHit.name,
      address: offlineHit.address,
    };
    cache[cacheKey] = point;
    saveGeoCache(cache);
    return point;
  }

  // 2. OpenStreetMap Nominatim 무료 지오코딩 폴백 (온라인 시)
  const queries = [cleanAddr, cleanName].filter(Boolean);
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "ko,en,ja" },
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
        if (data?.[0]) {
          const point: GeoPoint = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: cleanName || data[0].display_name,
            address: data[0].display_name,
          };
          cache[cacheKey] = point;
          saveGeoCache(cache);
          return point;
        }
      }
    } catch {
      // 오프라인 환경에서는 무시하고 다음 단계 진행
    }
  }

  return null;
}

/**
 * Haversine 공식으로 두 좌표 간 직선거리(km) 계산
 */
export function computeDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 거리(km)를 바탕으로 여행 동선 표시용 문자열 생성 (외부 Directions API 불필요)
 * 도로 굴곡 계수(1.25배)를 반영한 예상 이동 거리 및 도보/차량 시간 산출
 */
export function formatTravelLeg(straightKm: number): {
  distanceText: string;
  durationText: string;
} {
  const estRoadKm = straightKm * 1.25;
  const distanceText =
    estRoadKm < 1
      ? `${Math.max(50, Math.round((estRoadKm * 1000) / 10) * 10)}m`
      : `${estRoadKm.toFixed(1)}km`;

  // 도보 시속 4.2km 기준, 3km 초과 시 대중교통/차량(시속 25km) 기준 안내
  if (estRoadKm <= 3.0) {
    const walkMin = Math.max(2, Math.round((estRoadKm / 4.2) * 60));
    return { distanceText, durationText: `도보 약 ${walkMin}분` };
  }
  const transitMin = Math.max(5, Math.round((estRoadKm / 24) * 60) + 5);
  return { distanceText, durationText: `이동 약 ${transitMin}분` };
}
