import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Plane, Plus, MapPin, Calendar, Trash2, ArrowRight, Compass, Loader2, LogIn,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

const COVER_COLORS = [
  "#1e293b", "#312e81", "#164e63", "#14532d",
  "#7c2d12", "#4a1d96", "#0f172a", "#1c1917",
];

type TripFormData = {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverColor: string;
  description: string;
};

const defaultForm: TripFormData = {
  name: "", destination: "", startDate: "", endDate: "",
  coverColor: COVER_COLORS[0], description: "",
};

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTrip, setEditTrip] = useState<number | null>(null);
  const [form, setForm] = useState<TripFormData>(defaultForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: trips, isLoading } = trpc.trips.list.useQuery(undefined, { enabled: isAuthenticated });

  const createMutation = trpc.trips.create.useMutation({
    onSuccess: () => { utils.trips.list.invalidate(); setDialogOpen(false); setForm(defaultForm); toast.success("여행이 생성되었습니다!"); },
    onError: () => toast.error("여행 생성에 실패했습니다."),
  });

  const updateMutation = trpc.trips.update.useMutation({
    onSuccess: () => { utils.trips.list.invalidate(); setDialogOpen(false); setEditTrip(null); setForm(defaultForm); toast.success("여행이 수정되었습니다!"); },
    onError: () => toast.error("여행 수정에 실패했습니다."),
  });

  const deleteMutation = trpc.trips.delete.useMutation({
    onSuccess: () => { utils.trips.list.invalidate(); setDeleteConfirm(null); toast.success("여행이 삭제되었습니다."); },
    onError: () => toast.error("여행 삭제에 실패했습니다."),
  });

  const openCreate = () => { setEditTrip(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (trip: NonNullable<typeof trips>[number], e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTrip(trip.id);
    setForm({ name: trip.name, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, coverColor: trip.coverColor ?? COVER_COLORS[0], description: trip.description ?? "" });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.destination.trim() || !form.startDate || !form.endDate) {
      toast.error("필수 항목을 모두 입력해주세요."); return;
    }
    if (editTrip) updateMutation.mutate({ id: editTrip, ...form });
    else createMutation.mutate(form);
  };

  const getDuration = (start: string, end: string) => {
    try { return `${differenceInDays(parseISO(end), parseISO(start)) + 1}일`; }
    catch { return "-"; }
  };

  const formatDate = (d: string) => {
    try { return format(parseISO(d), "yyyy.MM.dd", { locale: ko }); }
    catch { return d; }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not logged in ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Compass className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif font-semibold text-foreground tracking-tight mb-2">Travel Journal</h1>
          <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
            항공편, 숙박, 일정, 일기까지 나만의 여행을 기록하고 관리하세요.
          </p>
        </div>
        <Button size="lg" className="gap-2 px-8" onClick={() => window.location.href = getLoginUrl()}>
          <LogIn className="w-4 h-4" />
          로그인하여 시작하기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-semibold text-foreground tracking-tight">
              Travel Journal
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
              {user?.name ? `${user.name}님의 여행 기록` : "나만의 여행을 기록하세요"}
            </p>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">새 여행</span>
            <span className="sm:hidden">추가</span>
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : !trips || trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Compass className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-serif font-semibold text-foreground mb-2">첫 여행을 기록해보세요</h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                항공편, 숙박, 일정, 일기까지 모든 여행 기록을 한 곳에서 관리하세요.
              </p>
            </div>
            <Button onClick={openCreate} size="lg" className="gap-2">
              <Plus className="w-4 h-4" />
              첫 여행 만들기
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {trips.map(trip => (
              <div
                key={trip.id}
                onClick={() => setLocation(`/trips/${trip.id}`)}
                className="group cursor-pointer rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                {/* Cover */}
                <div className="h-32 sm:h-36 relative flex items-end p-4" style={{ backgroundColor: trip.coverColor ?? "#1e293b" }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="relative z-10 flex items-end justify-between w-full gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3 h-3 text-white/70 shrink-0" />
                        <span className="text-white/70 text-xs font-medium truncate">{trip.destination}</span>
                      </div>
                      <h3 className="text-white font-serif font-semibold text-base sm:text-lg leading-tight truncate">
                        {trip.name}
                      </h3>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2.5">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="truncate">{formatDate(trip.startDate)} — {formatDate(trip.endDate)}</span>
                    <span className="ml-auto shrink-0 text-xs font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full">
                      {getDuration(trip.startDate, trip.endDate)}
                    </span>
                  </div>
                  {trip.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">{trip.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2.5 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Plane className="w-3 h-3" />
                      <span>여행 기록 보기</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => openEdit(trip, e)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">수정</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(trip.id); }} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Card */}
            <button
              onClick={openCreate}
              className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-transparent hover:bg-primary/4 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-8 min-h-[200px] sm:min-h-[220px] group"
            >
              <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors font-medium">새 여행 추가</span>
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl p-5 sm:p-6">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-lg font-semibold">{editTrip ? "여행 수정" : "새 여행 만들기"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">여행 이름 <span className="text-destructive">*</span></Label>
              <Input className="h-10" placeholder="2024 도쿄 여행" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">목적지 <span className="text-destructive">*</span></Label>
              <Input className="h-10" placeholder="일본 도쿄" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} />
            </div>
            {/* 날짜 — 단일 컬럼으로 분리 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">출발일 <span className="text-destructive">*</span></Label>
              <Input className="h-10" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">귀국일 <span className="text-destructive">*</span></Label>
              <Input className="h-10" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            {/* 커버 색상 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">커버 색상</Label>
              <div className="flex gap-2 flex-wrap">
                {COVER_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, coverColor: c }))}
                    className={`w-8 h-8 rounded-lg transition-all ${form.coverColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">설명</Label>
              <Textarea className="resize-none" placeholder="여행 메모..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTrip ? "수정" : "만들기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">여행 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            이 여행의 모든 기록(항공편, 숙박, 일정, 일기 등)이 함께 삭제됩니다. 계속하시겠습니까?
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>취소</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteConfirm !== null && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
