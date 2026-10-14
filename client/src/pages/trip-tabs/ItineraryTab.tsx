import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  CalendarDays, Loader2, MapPin, Clock, CheckCircle2, Circle,
  Plus, Utensils, Camera, ShoppingBag, Hotel, GripVertical, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { searchOfflineSuggestions, matchOfflineLandmark, type OfflineLandmark } from "@/lib/offlineGeo";

// dnd-kit
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ItineraryItem = {
  id: number;
  placeName: string;
  address?: string | null;
  lat?: string | null;
  lng?: string | null;
  visitTime?: string | null;
  duration?: number | null;
  visited?: boolean | null;
  memo?: string | null;
  category?: string | null;
  sourceType?: string | null;
  order?: number | null;
};

type FormData = {
  placeName: string;
  address: string;
  lat: string;
  lng: string;
  visitTime: string;
  duration: string;
  memo: string;
  category: string;
};

const defaultForm: FormData = {
  placeName: "", address: "", lat: "", lng: "", visitTime: "", duration: "", memo: "", category: "place",
};

const CATEGORIES = [
  { value: "place", label: "장소", icon: MapPin },
  { value: "food", label: "식당/카페", icon: Utensils },
  { value: "activity", label: "액티비티", icon: Camera },
  { value: "shopping", label: "쇼핑", icon: ShoppingBag },
];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  place: MapPin, food: Utensils, activity: Camera, shopping: ShoppingBag, accommodation: Hotel,
};

const CATEGORY_COLORS: Record<string, string> = {
  place: "bg-blue-50 text-blue-600 border-blue-200",
  food: "bg-orange-50 text-orange-600 border-orange-200",
  activity: "bg-green-50 text-green-600 border-green-200",
  shopping: "bg-purple-50 text-purple-600 border-purple-200",
  accommodation: "bg-indigo-50 text-indigo-600 border-indigo-200",
};

function SortableItem({
  item,
  idx,
  total,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ItineraryItem;
  idx: number;
  total: number;
  onToggle: (item: ItineraryItem) => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const CategoryIcon = CATEGORY_ICONS[item.category ?? "place"] ?? MapPin;
  const isAccommodation = item.sourceType === "accommodation";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 bg-card border rounded-xl p-4 transition-all ${
        item.visited ? "opacity-60 border-border" : "border-border hover:shadow-sm"
      } ${isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
    >
      {!isAccommodation && (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
          aria-label="순서 변경"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      {isAccommodation && <div className="w-4 shrink-0" />}

      <div className="flex flex-col items-center gap-1 shrink-0">
        <button onClick={() => onToggle(item)} className="transition-colors">
          {item.visited
            ? <CheckCircle2 className="w-5 h-5 text-accent" />
            : <Circle className="w-5 h-5 text-muted-foreground hover:text-accent" />
          }
        </button>
        {idx < total - 1 && <div className="w-px h-4 bg-border" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[item.category ?? "place"] ?? CATEGORY_COLORS.place}`}>
                <CategoryIcon className="w-3 h-3 inline mr-1" />
                {CATEGORIES.find(c => c.value === item.category)?.label ?? "장소"}
              </span>
              {item.visitTime && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />{item.visitTime}
                </span>
              )}
            </div>
            <p className={`font-semibold text-sm ${item.visited ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {item.placeName}
            </p>
            {item.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />{item.address}
              </p>
            )}
            {item.memo && (
              <p className="text-xs text-muted-foreground mt-1 italic">{item.memo}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {isAccommodation ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 border border-indigo-200 font-medium">숙박 연동</span>
            ) : (
              <>
                <button onClick={() => onEdit(item)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">수정</button>
                <button onClick={() => onDelete(item.id)} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors">삭제</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItineraryTab({ tripId, tripDays }: { tripId: number; tripDays: Date[] }) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (tripDays.length > 0) return format(tripDays[0], "yyyy-MM-dd");
    return format(new Date(), "yyyy-MM-dd");
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);
  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.itinerary.listByDate.useQuery(
    { tripId, date: selectedDate },
    { refetchInterval: 3000 }
  );

  // 오프라인 내장 장소 자동완성 추천
  const suggestions = useMemo(() => searchOfflineSuggestions(form.placeName, 4), [form.placeName]);

  const applySuggestion = (s: OfflineLandmark) => {
    setForm(f => ({
      ...f,
      placeName: s.name,
      address: s.address,
      lat: String(s.lat),
      lng: String(s.lng),
      category: s.category ?? f.category,
    }));
  };

  const displayItems: ItineraryItem[] = (() => {
    if (!items || !Array.isArray(items)) return [];
    if (!localOrder) return items as ItineraryItem[];
    const map = new Map((items as ItineraryItem[]).map(i => [i.id, i]));
    return localOrder.map(id => map.get(id)).filter((x): x is ItineraryItem => x !== undefined);
  })();

  const createMutation = trpc.itinerary.create.useMutation({
    onSuccess: () => {
      utils.itinerary.listByDate.invalidate();
      setDialogOpen(false);
      setForm(defaultForm);
      toast.success("장소가 추가되었습니다.");
    },
    onError: () => toast.error("장소 추가에 실패했습니다."),
  });

  const updateMutation = trpc.itinerary.update.useMutation({
    onSuccess: () => {
      utils.itinerary.listByDate.invalidate();
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
      toast.success("장소가 수정되었습니다.");
    },
    onError: () => toast.error("장소 수정에 실패했습니다."),
  });

  const deleteMutation = trpc.itinerary.delete.useMutation({
    onSuccess: () => {
      utils.itinerary.listByDate.invalidate();
      toast.success("장소가 삭제되었습니다.");
    },
    onError: () => toast.error("장소 삭제에 실패했습니다."),
  });

  const reorderMutation = trpc.itinerary.reorder.useMutation({
    onSuccess: () => utils.itinerary.listByDate.invalidate(),
    onError: () => {
      toast.error("순서 저장에 실패했습니다.");
      setLocalOrder(null);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !items) return;

    const oldIds = displayItems.map(i => i.id);
    const oldIndex = oldIds.indexOf(active.id as number);
    const newIndex = oldIds.indexOf(over.id as number);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(oldIds, oldIndex, newIndex);
    setLocalOrder(newOrder);
    reorderMutation.mutate({ tripId, orderedIds: newOrder });
  };

  const toggleVisited = (item: ItineraryItem) => {
    updateMutation.mutate({ id: item.id, visited: !item.visited });
  };

  const openCreate = () => { setEditId(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (item: ItineraryItem) => {
    setEditId(item.id);
    setForm({
      placeName: item.placeName,
      address: item.address ?? "",
      lat: item.lat ?? "",
      lng: item.lng ?? "",
      visitTime: item.visitTime ?? "",
      duration: item.duration?.toString() ?? "",
      memo: item.memo ?? "",
      category: item.category ?? "place",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.placeName) { toast.error("장소명을 입력해주세요."); return; }
    // 오프라인 사전에서 좌표/주소 자동 보완
    let lat = form.lat || undefined;
    let lng = form.lng || undefined;
    let address = form.address || undefined;
    if (!lat || !lng) {
      const matched = matchOfflineLandmark(`${form.placeName} ${form.address}`);
      if (matched) {
        lat = String(matched.lat);
        lng = String(matched.lng);
        if (!address) address = matched.address;
      }
    }
    const data = {
      placeName: form.placeName,
      address,
      lat,
      lng,
      visitTime: form.visitTime || undefined,
      duration: form.duration ? parseInt(form.duration) : undefined,
      memo: form.memo || undefined,
      category: form.category,
    };
    if (editId) updateMutation.mutate({ id: editId, ...data });
    else createMutation.mutate({ tripId, date: selectedDate, order: (items?.length ?? 0), ...data });
  };

  const visitedCount = displayItems.filter(i => i.visited).length;
  const totalCount = displayItems.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">하루별 일정</h2>
          <p className="text-sm text-muted-foreground mt-0.5">날짜를 선택하고 방문 장소를 관리하세요. 드래그로 순서를 변경할 수 있습니다.</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 self-start sm:self-auto shrink-0">
          <Plus className="w-3.5 h-3.5" />장소 추가
        </Button>
      </div>

      {/* 날짜 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tripDays.map((day, idx) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              onClick={() => { setSelectedDate(dateStr); setLocalOrder(null); }}
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

      {/* 진행률 */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">
                {format(new Date(selectedDate + "T00:00:00"), "M월 d일 (EEE)", { locale: ko })} 일정
              </span>
              <span className="text-sm text-muted-foreground">{visitedCount}/{totalCount} 완료</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (visitedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {totalCount > 1 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GripVertical className="w-3.5 h-3.5" />
          왼쪽 핸들을 드래그해서 순서를 변경하면 지도에도 반영됩니다
        </p>
      )}

      {/* 아이템 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-dashed border-border bg-muted/30">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">이 날의 일정이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">방문할 장소를 추가해보세요.</p>
          </div>
          <Button onClick={openCreate} size="sm" variant="outline" className="gap-1.5">
            <Plus className="w-4 h-4" />장소 추가
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayItems.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {displayItems.map((item, idx) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  idx={idx}
                  total={displayItems.length}
                  onToggle={toggleVisited}
                  onEdit={openEdit}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl p-5 sm:p-6">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-lg font-semibold">{editId ? "장소 수정" : "장소 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">카테고리</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">장소명 <span className="text-destructive">*</span></Label>
              <Input
                className="h-10"
                placeholder="아사쿠사 센소지, 도쿄타워, 도톤보리..."
                value={form.placeName}
                onChange={e => setForm(f => ({ ...f, placeName: e.target.value, lat: "", lng: "" }))}
              />
              {/* 오프라인 내장 장소 추천 칩 */}
              {suggestions.length > 0 && (
                <div className="pt-1 space-y-1">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary/70" />
                    내장 오프라인 여행지 추천 (클릭 시 주소·좌표 자동 입력)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/15 border border-primary/20 text-primary font-medium transition-colors text-left"
                      >
                        📍 {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">주소</Label>
              <Input className="h-10" placeholder="도쿄 다이토구 아사쿠사 2-3-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">방문 시간</Label>
              <Input className="h-10" type="time" value={form.visitTime} onChange={e => setForm(f => ({ ...f, visitTime: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">소요 시간 (분)</Label>
              <Input className="h-10" type="number" placeholder="60" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">메모</Label>
              <Textarea className="resize-none" placeholder="방문 메모..." value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editId ? "수정" : "추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
