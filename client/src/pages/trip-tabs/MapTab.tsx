import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  MapPin, Navigation, Loader2, CheckCircle2, GripVertical,
  Crosshair, Compass, Footprints,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  resolvePlaceCoordinates,
  computeDistanceKm,
  formatTravelLeg,
} from "@/lib/offlineGeo";

const CATEGORY_COLORS: Record<string, string> = {
  place: "#6366f1",
  food: "#f97316",
  activity: "#22c55e",
  shopping: "#a855f7",
  accommodation: "#0ea5e9",
};

const CATEGORY_LABELS: Record<string, string> = {
  place: "장소",
  food: "음식",
  activity: "활동",
  shopping: "쇼핑",
  accommodation: "숙소",
};

type ItemType = {
  id: number;
  placeName: string;
  address?: string | null;
  visitTime?: string | null;
  visited?: boolean | null;
  category?: string | null;
  lat?: string | null;
  lng?: string | null;
  order?: number | null;
  sourceType?: string | null;
};

type ResolvedPoint = {
  item: ItemType;
  lat: number;
  lng: number;
  index: number;
};

declare global {
  interface Window {
    L?: any;
  }
}

/** Leaflet (OpenStreetMap 무료 타일 엔진) 동적 로더 — 유료 API 키 불필요 */
function loadLeaflet(): Promise<any | null> {
  return new Promise(resolve => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.L) {
      resolve(window.L);
      return;
    }

    if (!document.querySelector('link[data-leaflet="true"]')) {
      const link = document.createElement("link");
      link.dataset.leaflet = "true";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L ?? null), { once: true });
      existing.addEventListener("error", () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.leaflet = "true";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

// 드래그 가능한 방문 순서 아이템
function SortableVisitItem({
  item,
  index,
  total,
  hasCoords,
  legInfo,
  isPickingLocation,
  onStartPickLocation,
}: {
  item: ItemType;
  index: number;
  total: number;
  hasCoords: boolean;
  legInfo?: { distanceText: string; durationText: string } | null;
  isPickingLocation: boolean;
  onStartPickLocation: (item: ItemType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const color = CATEGORY_COLORS[item.category ?? "place"] ?? "#6366f1";

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div
        className={`flex items-center gap-3 bg-card border rounded-xl px-3 py-3 transition-shadow ${
          isDragging ? "shadow-lg ring-2 ring-primary/30" : ""
        } ${isPickingLocation ? "ring-2 ring-amber-500 border-amber-400 bg-amber-50/30" : ""} ${
          item.visited ? "opacity-60" : ""
        }`}
      >
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none p-0.5 shrink-0"
          aria-label="순서 변경"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* 번호 뱃지 */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
          style={{ backgroundColor: item.visited ? "#9ca3af" : color }}
        >
          {index + 1}
        </div>

        {/* 장소 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium truncate ${item.visited ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {item.placeName}
            </p>
            {!hasCoords && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                위치 미지정
              </span>
            )}
          </div>
          {item.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.address}</span>
            </p>
          )}
        </div>

        {/* 우측 액션 및 정보 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {item.visitTime && (
            <span className="text-xs text-muted-foreground">{item.visitTime}</span>
          )}
          <button
            type="button"
            onClick={() => onStartPickLocation(item)}
            title="지도에서 위치 직접 찍기"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
              isPickingLocation
                ? "bg-amber-500 text-white border-amber-600"
                : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span className="hidden sm:inline">{isPickingLocation ? "지도 클릭 대기" : "위치 지정"}</span>
          </button>
          {item.visited && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
      </div>

      {/* 다음 장소까지 이동 거리 / 예상 도보·이동 시간 배지 */}
      {index < total - 1 && legInfo && (
        <div className="flex items-center gap-2 pl-9 py-0.5 text-[11px] text-muted-foreground">
          <Footprints className="w-3 h-3 text-primary/60" />
          <span>다음 장소까지 약 <strong className="text-foreground/80">{legInfo.distanceText}</strong> · {legInfo.durationText}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 완전 오프라인(비행기 모드 등)에서도 동선과 핀, 위치 찍기가 작동하는 인터랙티브 벡터 캔버스 폴백
 */
function OfflineVectorMap({
  points,
  onPickCoord,
  pickingItem,
}: {
  points: ResolvedPoint[];
  onPickCoord: (lat: number, lng: number) => void;
  pickingItem: ItemType | null;
}) {
  const centerLat = points.length > 0 ? points.reduce((s, p) => s + p.lat, 0) / points.length : 35.6812;
  const centerLng = points.length > 0 ? points.reduce((s, p) => s + p.lng, 0) / points.length : 139.7671;
  const spanLat = Math.max(0.04, ...points.map(p => Math.abs(p.lat - centerLat) * 2.6));
  const spanLng = Math.max(0.04, ...points.map(p => Math.abs(p.lng - centerLng) * 2.6));

  const toXY = (lat: number, lng: number) => {
    const x = 50 + ((lng - centerLng) / spanLng) * 80;
    const y = 50 - ((lat - centerLat) / spanLat) * 80;
    return { x: Math.max(8, Math.min(92, x)), y: Math.max(10, Math.min(90, y)) };
  };

  return (
    <div
      onClick={(e) => {
        if (!pickingItem) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const relY = (e.clientY - rect.top) / rect.height;
        const lat = centerLat + (0.5 - relY) * spanLat;
        const lng = centerLng + (relX - 0.5) * spanLng;
        onPickCoord(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      }}
      className={`w-full h-[400px] sm:h-[480px] relative select-none overflow-hidden bg-slate-50 dark:bg-slate-900 ${
        pickingItem ? "cursor-crosshair" : ""
      }`}
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(99,102,241,0.12) 1px, transparent 1px), linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
        backgroundSize: "24px 24px, 48px 48px, 48px 48px",
      }}
    >
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-card/90 backdrop-blur px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground shadow-sm">
        <Compass className="w-3.5 h-3.5 text-primary" />
        <span>오프라인 스마트 동선 맵 (외부 API 없음)</span>
      </div>

      {/* SVG 경로 연결선 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {points.map((pt, i) => {
          if (i === points.length - 1) return null;
          const p1 = toXY(pt.lat, pt.lng);
          const p2 = toXY(points[i + 1].lat, points[i + 1].lng);
          return (
            <line
              key={`${pt.item.id}-${points[i + 1].item.id}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#6366f1"
              strokeWidth="0.6"
              strokeDasharray="1.5 1"
            />
          );
        })}
      </svg>

      {/* 마커 핀 렌더링 */}
      {points.map((pt) => {
        const pos = toXY(pt.lat, pt.lng);
        const color = CATEGORY_COLORS[pt.item.category ?? "place"] ?? "#6366f1";
        return (
          <div
            key={pt.item.id}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white transition-transform group-hover:scale-110"
              style={{ backgroundColor: pt.item.visited ? "#9ca3af" : color }}
            >
              {pt.index + 1}
            </div>
            <span className="mt-1 px-2 py-0.5 rounded-md bg-card/95 border border-border text-[11px] font-medium text-foreground shadow-sm whitespace-nowrap max-w-[140px] truncate">
              {pt.item.placeName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function MapTab({ tripId, tripDays }: { tripId: number; tripDays: Date[] }) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (tripDays.length > 0) return format(tripDays[0], "yyyy-MM-dd");
    return format(new Date(), "yyyy-MM-dd");
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any | null>(null);
  const leafletLayerGroupRef = useRef<any | null>(null);
  const [useOfflineCanvas, setUseOfflineCanvas] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [resolvedPoints, setResolvedPoints] = useState<ResolvedPoint[]>([]);
  const [pickingItem, setPickingItem] = useState<ItemType | null>(null);
  const pickingItemRef = useRef<ItemType | null>(null);
  pickingItemRef.current = pickingItem;

  // 로컬 순서 상태 (드래그 즉시 반영)
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const utils = trpc.useUtils();

  const { data: serverItems, isLoading } = trpc.itinerary.listByDate.useQuery(
    { tripId, date: selectedDate },
    { refetchInterval: 3000 }
  );

  useEffect(() => {
    setLocalOrder(null);
  }, [selectedDate, serverItems]);

  const items: ItemType[] = useMemo(() => {
    if (!serverItems) return [];
    if (!localOrder) return serverItems as ItemType[];
    const map = new Map((serverItems as ItemType[]).map(i => [i.id, i]));
    return localOrder.map(id => map.get(id)).filter((x): x is ItemType => x !== undefined);
  }, [serverItems, localOrder]);

  const reorderMutation = trpc.itinerary.reorder.useMutation({
    onSuccess: () => {
      utils.itinerary.listByDate.invalidate({ tripId, date: selectedDate });
    },
    onError: () => {
      toast.error("순서 저장에 실패했습니다.");
      setLocalOrder(null);
    },
  });

  const updateItemMutation = trpc.itinerary.update.useMutation({
    onSuccess: () => {
      utils.itinerary.listByDate.invalidate({ tripId, date: selectedDate });
      setPickingItem(null);
      toast.success("지도 위치가 저장되었습니다.");
    },
    onError: () => {
      toast.error("위치 저장에 실패했습니다.");
    },
  });

  const handlePickCoordinate = useCallback((lat: number, lng: number) => {
    const target = pickingItemRef.current;
    if (!target) return;
    updateItemMutation.mutate({
      id: target.id,
      lat: String(lat),
      lng: String(lng),
    });
  }, [updateItemMutation]);

  // dnd-kit 센서
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentIds = items.map(i => i.id);
    const oldIndex = currentIds.indexOf(active.id as number);
    const newIndex = currentIds.indexOf(over.id as number);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(currentIds, oldIndex, newIndex);
    setLocalOrder(newOrder);

    reorderMutation.mutate(
      { tripId, orderedIds: newOrder },
      {
        onSuccess: () => {
          utils.itinerary.listByDate.invalidate({ tripId, date: selectedDate });
          toast.success("방문 순서가 저장되었습니다.");
        },
      }
    );
  }, [items, reorderMutation, tripId, selectedDate, utils]);

  // 1. 오프라인 사전 + 무료 지오코딩으로 각 일정 항목의 좌표 해석
  useEffect(() => {
    let cancelled = false;
    async function resolveAll() {
      if (!items || items.length === 0) {
        setResolvedPoints([]);
        return;
      }
      setGeocoding(true);
      const nextPoints: ResolvedPoint[] = [];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        if (item.lat && item.lng && !Number.isNaN(Number(item.lat)) && !Number.isNaN(Number(item.lng))) {
          nextPoints.push({ item, lat: Number(item.lat), lng: Number(item.lng), index: idx });
          continue;
        }
        const geo = await resolvePlaceCoordinates(item.placeName, item.address);
        if (geo) {
          nextPoints.push({ item, lat: geo.lat, lng: geo.lng, index: idx });
        }
      }

      if (!cancelled) {
        setResolvedPoints(nextPoints);
        setGeocoding(false);
      }
    }
    resolveAll();
    return () => { cancelled = true; };
  }, [items]);

  // 2. Leaflet (OpenStreetMap) 초기화 및 마커/폴리라인 렌더링
  useEffect(() => {
    let mounted = true;
    async function initOrUpdateLeaflet() {
      const L = await loadLeaflet();
      if (!mounted) return;
      if (!L || !mapContainerRef.current) {
        setUseOfflineCanvas(true);
        return;
      }

      if (!leafletMapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [35.6812, 139.7671],
          zoom: 12,
          zoomControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        map.on("click", (e: any) => {
          if (pickingItemRef.current && e?.latlng) {
            handlePickCoordinate(
              Number(e.latlng.lat.toFixed(6)),
              Number(e.latlng.lng.toFixed(6))
            );
          }
        });

        leafletMapRef.current = map;
        leafletLayerGroupRef.current = L.layerGroup().addTo(map);
      }

      const map = leafletMapRef.current;
      const layerGroup = leafletLayerGroupRef.current;
      layerGroup.clearLayers();

      if (resolvedPoints.length === 0) return;

      const latlngs: Array<[number, number]> = [];

      resolvedPoints.forEach(({ item, lat, lng, index }) => {
        latlngs.push([lat, lng]);
        const color = CATEGORY_COLORS[item.category ?? "place"] ?? "#6366f1";
        const bg = item.visited ? "#9ca3af" : color;

        const icon = L.divIcon({
          className: "planlog-custom-pin",
          html: `
            <div style="
              width: 34px; height: 34px; border-radius: 50% 50% 50% 0;
              background: ${bg}; border: 2.5px solid white;
              box-shadow: 0 3px 10px rgba(0,0,0,0.28);
              display: flex; align-items: center; justify-content: center;
              transform: rotate(-45deg);
            ">
              <span style="transform: rotate(45deg); color: white; font-size: 12px; font-weight: 700;">
                ${index + 1}
              </span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup(`
          <div style="font-family: Pretendard, sans-serif; min-width: 150px; padding: 2px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #1e293b;">
              ${index + 1}. ${item.placeName}
            </div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
              ${CATEGORY_LABELS[item.category ?? "place"] ?? "장소"}
            </div>
            ${item.visitTime ? `<div style="font-size: 11px; color: #64748b;">⏰ ${item.visitTime}</div>` : ""}
            ${item.address ? `<div style="font-size: 11px; color: #64748b;">📍 ${item.address}</div>` : ""}
          </div>
        `);
        marker.addTo(layerGroup);
      });

      if (latlngs.length >= 2) {
        L.polyline(latlngs, {
          color: "#6366f1",
          weight: 3.5,
          opacity: 0.8,
          dashArray: "8, 6",
        }).addTo(layerGroup);
      }

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    }

    initOrUpdateLeaflet();
    return () => { mounted = false; };
  }, [resolvedPoints, handlePickCoordinate]);

  // 컴포넌트 언마운트 시 지도 정리
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // 각 아이템별 좌표 매핑 및 구간 거리/소요시간 계산
  const coordByItemId = useMemo(() => {
    const m = new Map<number, { lat: number; lng: number }>();
    resolvedPoints.forEach(p => m.set(p.item.id, { lat: p.lat, lng: p.lng }));
    return m;
  }, [resolvedPoints]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">동선 지도</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            외부 유료 API 없이 내장 여행지 사전과 오픈소스 지도로 동선과 이동 시간을 자동 계산합니다.
          </p>
        </div>
      </div>

      {/* 날짜 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tripDays.map((day, idx) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              onClick={() => { setSelectedDate(dateStr); setPickingItem(null); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border transition-all shrink-0 ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-primary/30 hover:bg-muted/50"
              }`}
            >
              <span className="text-xs font-medium">{format(day, "EEE", { locale: ko })}</span>
              <span className="text-lg font-bold leading-none">{format(day, "d")}</span>
              <span className="text-xs opacity-70">{format(day, "M.d")}</span>
              <span className={`text-xs mt-0.5 ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                Day {idx + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* 위치 직접 지정 안내 배너 */}
      {pickingItem && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
            <span>
              지도 위에서 <strong>"{pickingItem.placeName}"</strong>의 위치를 클릭하세요.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPickingItem(null)}
            className="px-2 py-1 rounded bg-amber-200/70 hover:bg-amber-200 text-xs"
          >
            취소
          </button>
        </div>
      )}

      {/* 지도 영역 */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm relative">
        {(geocoding || isLoading) && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">동선 좌표 계산 중...</span>
            </div>
          </div>
        )}
        {useOfflineCanvas ? (
          <OfflineVectorMap
            points={resolvedPoints}
            pickingItem={pickingItem}
            onPickCoord={handlePickCoordinate}
          />
        ) : (
          <div
            ref={mapContainerRef}
            className={`w-full h-[400px] sm:h-[480px] z-0 ${pickingItem ? "cursor-crosshair" : ""}`}
          />
        )}
      </div>

      {/* 방문 순서 목록 (드래그 앤 드롭 + 구간별 이동시간) */}
      {items && items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {format(new Date(selectedDate + "T00:00:00"), "M월 d일", { locale: ko })} 방문 순서
            </h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <GripVertical className="w-3.5 h-3.5" />
              드래그해서 순서 변경 · '위치 지정'으로 핀 직접 찍기
            </span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {items.map((item, idx) => {
                  const c1 = coordByItemId.get(item.id);
                  const nextItem = idx < items.length - 1 ? items[idx + 1] : null;
                  const c2 = nextItem ? coordByItemId.get(nextItem.id) : undefined;
                  const legInfo = c1 && c2 ? formatTravelLeg(computeDistanceKm(c1, c2)) : null;

                  return (
                    <SortableVisitItem
                      key={item.id}
                      item={item}
                      index={idx}
                      total={items.length}
                      hasCoords={Boolean(c1)}
                      legInfo={legInfo}
                      isPickingLocation={pickingItem?.id === item.id}
                      onStartPickLocation={(target) =>
                        setPickingItem(prev => (prev?.id === target.id ? null : target))
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          <p className="text-xs text-muted-foreground text-center pt-1">
            순서를 변경하면 지도 마커 번호, 경로, 예상 이동시간, 일정 탭이 자동으로 업데이트됩니다
          </p>
        </div>
      )}

      {(!items || items.length === 0) && !isLoading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl border border-dashed border-border bg-muted/30">
          <MapPin className="w-8 h-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">이 날의 방문 장소가 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">일정 탭에서 방문 장소를 추가하면 지도에 표시됩니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
