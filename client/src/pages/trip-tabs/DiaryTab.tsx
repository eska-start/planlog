import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Sun, Cloud, CloudRain, Snowflake, Wind, Smile, Heart, Meh, Frown, Battery } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Mood = "amazing" | "happy" | "neutral" | "tired" | "sad";
type Weather = "sunny" | "cloudy" | "rainy" | "snowy" | "windy";

const MOODS: { value: Mood; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: "amazing", label: "최고", icon: Heart, color: "text-rose-500" },
  { value: "happy", label: "좋음", icon: Smile, color: "text-amber-500" },
  { value: "neutral", label: "보통", icon: Meh, color: "text-blue-500" },
  { value: "tired", label: "피곤", icon: Battery, color: "text-orange-500" },
  { value: "sad", label: "아쉬움", icon: Frown, color: "text-slate-500" },
];

const WEATHERS: { value: Weather; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: "sunny", label: "맑음", icon: Sun, color: "text-yellow-500" },
  { value: "cloudy", label: "흐림", icon: Cloud, color: "text-slate-400" },
  { value: "rainy", label: "비", icon: CloudRain, color: "text-blue-500" },
  { value: "snowy", label: "눈", icon: Snowflake, color: "text-sky-400" },
  { value: "windy", label: "바람", icon: Wind, color: "text-teal-500" },
];

export default function DiaryTab({ tripId, tripDays }: { tripId: number; tripDays: Date[] }) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (tripDays.length > 0) return format(tripDays[0], "yyyy-MM-dd");
    return format(new Date(), "yyyy-MM-dd");
  });
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", mood: "happy" as Mood, weather: "sunny" as Weather });
  const utils = trpc.useUtils();

  const { data: entry, isLoading } = trpc.diary.getByDate.useQuery({ tripId, date: selectedDate });

  useEffect(() => {
    if (entry && !isEditing) {
      setForm({
        title: entry.title ?? "",
        content: entry.content ?? "",
        mood: (entry.mood ?? "happy") as Mood,
        weather: (entry.weather ?? "sunny") as Weather,
      });
    }
  }, [entry, isEditing]);

  const upsertMutation = trpc.diary.upsert.useMutation({
    onSuccess: () => {
      utils.diary.getByDate.invalidate();
      utils.diary.listByTrip.invalidate();
      setIsEditing(false);
      toast.success("일기가 저장되었습니다.");
    },
    onError: () => toast.error("일기 저장에 실패했습니다."),
  });

  const deleteMutation = trpc.diary.delete.useMutation({
    onSuccess: () => {
      utils.diary.getByDate.invalidate();
      utils.diary.listByTrip.invalidate();
      setIsEditing(false);
      setForm({ title: "", content: "", mood: "happy", weather: "sunny" });
      toast.success("일기가 삭제되었습니다.");
    },
    onError: () => toast.error("일기 삭제에 실패했습니다."),
  });

  const startEdit = () => {
    if (entry) {
      setForm({
        title: entry.title ?? "",
        content: entry.content ?? "",
        mood: (entry.mood ?? "happy") as Mood,
        weather: (entry.weather ?? "sunny") as Weather,
      });
    } else {
      setForm({ title: "", content: "", mood: "happy", weather: "sunny" });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({ tripId, date: selectedDate, ...form });
  };

  const currentMood = MOODS.find(m => m.value === (isEditing ? form.mood : entry?.mood ?? "happy"));
  const currentWeather = WEATHERS.find(w => w.value === (isEditing ? form.weather : entry?.weather ?? "sunny"));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">여행 일기</h2>
        <p className="text-sm text-muted-foreground mt-0.5">하루하루의 감동을 기록하세요.</p>
      </div>

      {/* Date Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tripDays.map((day, idx) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              onClick={() => { setSelectedDate(dateStr); setIsEditing(false); }}
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

      {/* Diary Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : isEditing ? (
        /* Edit Mode */
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold text-foreground">
              {format(new Date(selectedDate + "T00:00:00"), "M월 d일 (EEE)", { locale: ko })}
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>취소</Button>
              <Button size="sm" onClick={handleSave} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                저장
              </Button>
            </div>
          </div>

          {/* Mood & Weather - single column on mobile */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">오늘의 기분</Label>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map(m => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                        form.mood === m.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${m.color}`} />
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">날씨</Label>
              <div className="flex gap-2 flex-wrap">
                {WEATHERS.map(w => {
                  const Icon = w.icon;
                  return (
                    <button
                      key={w.value}
                      onClick={() => setForm(f => ({ ...f, weather: w.value }))}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                        form.weather === w.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${w.color}`} />
                      <span className="text-xs text-muted-foreground">{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>제목</Label>
            <Input placeholder="오늘 하루를 한 문장으로..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>일기</Label>
            <Textarea
              placeholder="오늘 하루는 어땠나요? 자유롭게 기록해보세요..."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={10}
              className="resize-none font-sans text-sm leading-relaxed"
            />
          </div>
        </div>
      ) : entry ? (
        /* View Mode */
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground mb-1">
                {format(new Date(selectedDate + "T00:00:00"), "M월 d일 (EEE)", { locale: ko })}
              </h3>
              <div className="flex items-center gap-3">
                {currentMood && (
                  <div className="flex items-center gap-1.5">
                    <currentMood.icon className={`w-4 h-4 ${currentMood.color}`} />
                    <span className="text-xs text-muted-foreground">{currentMood.label}</span>
                  </div>
                )}
                {currentWeather && (
                  <div className="flex items-center gap-1.5">
                    <currentWeather.icon className={`w-4 h-4 ${currentWeather.color}`} />
                    <span className="text-xs text-muted-foreground">{currentWeather.label}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startEdit}>수정</Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => entry && deleteMutation.mutate({ id: entry.id })}
                disabled={deleteMutation.isPending}
              >
                삭제
              </Button>
            </div>
          </div>

          {entry.title && (
            <h4 className="font-serif text-xl font-semibold text-foreground mb-3 border-l-2 border-accent pl-3">
              {entry.title}
            </h4>
          )}
          {entry.content ? (
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">내용이 없습니다.</p>
          )}
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
            {format(new Date(entry.updatedAt), "yyyy.MM.dd HH:mm 수정", { locale: ko })}
          </p>
        </div>
      ) : (
        /* Empty */
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-dashed border-border bg-muted/30">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">이 날의 일기가 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">오늘 하루를 기록해보세요.</p>
          </div>
          <Button onClick={startEdit} size="sm" variant="outline" className="gap-1.5">
            <BookOpen className="w-4 h-4" />일기 쓰기
          </Button>
        </div>
      )}
    </div>
  );
}
