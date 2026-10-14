import { trpc } from "@/lib/trpc";
import { OcrUploadButton } from "@/components/OcrUploadButton";
import { useState } from "react";
import { toast } from "sonner";
import { Plane, Loader2, ArrowRight, Hash, Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import TabShell from "./TabShell";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type FlightType = "departure" | "return" | "transit";

type FormData = {
  type: FlightType;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  bookingRef: string;
  seatNumber: string;
  memo: string;
};

const defaultForm: FormData = {
  type: "departure",
  airline: "",
  flightNumber: "",
  departureAirport: "",
  arrivalAirport: "",
  departureTime: "",
  arrivalTime: "",
  bookingRef: "",
  seatNumber: "",
  memo: "",
};

const TYPE_LABELS: Record<FlightType, string> = {
  departure: "출발편",
  return: "귀국편",
  transit: "경유편",
};

const TYPE_STYLES: Record<FlightType, string> = {
  departure: "bg-blue-50 text-blue-700 border-blue-200",
  return: "bg-emerald-50 text-emerald-700 border-emerald-200",
  transit: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatDT(dt?: string | null) {
  if (!dt) return "-";
  try { return format(new Date(dt), "MM.dd (EEE) HH:mm", { locale: ko }); }
  catch { return dt; }
}

export default function FlightsTab({ tripId }: { tripId: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const utils = trpc.useUtils();

  const { data: flights, isLoading } = trpc.flights.list.useQuery({ tripId });

  const createMutation = trpc.flights.create.useMutation({
    onSuccess: () => { utils.flights.list.invalidate(); setDialogOpen(false); setForm(defaultForm); toast.success("항공편이 추가되었습니다."); },
    onError: () => toast.error("항공편 추가에 실패했습니다."),
  });

  const updateMutation = trpc.flights.update.useMutation({
    onSuccess: () => { utils.flights.list.invalidate(); setDialogOpen(false); setEditId(null); setForm(defaultForm); toast.success("항공편이 수정되었습니다."); },
    onError: () => toast.error("항공편 수정에 실패했습니다."),
  });

  const deleteMutation = trpc.flights.delete.useMutation({
    onSuccess: () => { utils.flights.list.invalidate(); toast.success("항공편이 삭제되었습니다."); },
    onError: () => toast.error("항공편 삭제에 실패했습니다."),
  });

  const extractMutation = trpc.flights.extractFromImage.useMutation();

  const openCreate = () => { setEditId(null); setForm(defaultForm); setDialogOpen(true); };
  const openEdit = (f: NonNullable<typeof flights>[number]) => {
    setEditId(f.id);
    setForm({
      type: (f.type ?? "departure") as FlightType,
      airline: f.airline ?? "",
      flightNumber: f.flightNumber ?? "",
      departureAirport: f.departureAirport ?? "",
      arrivalAirport: f.arrivalAirport ?? "",
      departureTime: f.departureTime ?? "",
      arrivalTime: f.arrivalTime ?? "",
      bookingRef: f.bookingRef ?? "",
      seatNumber: f.seatNumber ?? "",
      memo: f.memo ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editId) updateMutation.mutate({ id: editId, ...form });
    else createMutation.mutate({ tripId, ...form });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <TabShell
        title="항공편"
        description="출발편, 귀국편, 경유편을 기록하세요."
        onAdd={openCreate}
        addLabel="항공편 추가"
        isEmpty={!flights || flights.length === 0}
        emptyIcon={<Plane className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="등록된 항공편이 없습니다"
        emptyDescription="항공편 정보를 추가해보세요."
      >
        <div className="space-y-3">
          {flights?.map(f => (
            <div key={f.id} className="card-hover p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border shrink-0 ${TYPE_STYLES[f.type as FlightType]}`}>
                    {TYPE_LABELS[f.type as FlightType]}
                  </span>
                  {f.airline && <span className="text-sm font-semibold text-foreground truncate">{f.airline}</span>}
                  {f.flightNumber && <span className="text-xs text-muted-foreground">{f.flightNumber}</span>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(f)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">수정</button>
                  <button onClick={() => deleteMutation.mutate({ id: f.id })} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors">삭제</button>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 mb-3 bg-muted/40 rounded-lg p-3">
                <div className="text-center min-w-0 flex-1">
                  <p className="text-base sm:text-lg font-bold text-foreground">{f.departureAirport || "-"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDT(f.departureTime)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="w-6 sm:w-8 h-px bg-border" />
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="w-6 sm:w-8 h-px bg-border" />
                </div>
                <div className="text-center min-w-0 flex-1">
                  <p className="text-base sm:text-lg font-bold text-foreground">{f.arrivalAirport || "-"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDT(f.arrivalTime)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {f.bookingRef && (
                  <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> 예약번호: <span className="font-mono font-medium text-foreground">{f.bookingRef}</span></span>
                )}
                {f.seatNumber && (
                  <span className="flex items-center gap-1"><Armchair className="w-3 h-3" /> 좌석: <span className="font-medium text-foreground">{f.seatNumber}</span></span>
                )}
              </div>
              {f.memo && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{f.memo}</p>}
            </div>
          ))}
        </div>
      </TabShell>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl p-5 sm:p-6">
          <DialogHeader className="mb-1">
            <DialogTitle className="text-lg font-semibold">{editId ? "항공편 수정" : "항공편 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 max-h-[70vh] overflow-y-auto">
            {/* OCR 자동 입력 */}
            <OcrUploadButton
              uploadEndpoint="/api/upload-ocr"
              extractEndpoint={async (payload) =>
                typeof payload === "string"
                  ? extractMutation.mutateAsync({ imageUrl: payload })
                  : extractMutation.mutateAsync(payload)
              }
              onExtracted={(data) => {
                setForm(f => ({
                  ...f,
                  airline: data.airline ?? f.airline,
                  flightNumber: data.flightNumber ?? f.flightNumber,
                  departureAirport: data.departureAirport ?? f.departureAirport,
                  arrivalAirport: data.arrivalAirport ?? f.arrivalAirport,
                  departureTime: data.departureTime ?? f.departureTime,
                  arrivalTime: data.arrivalTime ?? f.arrivalTime,
                  bookingRef: data.bookingRef ?? f.bookingRef,
                  seatNumber: data.seatNumber ?? f.seatNumber,
                  type: (data.type as typeof f.type) ?? f.type,
                }));
              }}
            />
            {/* 구분 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">구분</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as FlightType }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="departure">출발편</SelectItem>
                  <SelectItem value="return">귀국편</SelectItem>
                  <SelectItem value="transit">경유편</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* 항공사 / 편명 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">항공사</Label>
                <Input className="h-10" placeholder="대한항공" value={form.airline} onChange={e => setForm(f => ({ ...f, airline: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">편명</Label>
                <Input className="h-10" placeholder="KE001" value={form.flightNumber} onChange={e => setForm(f => ({ ...f, flightNumber: e.target.value }))} />
              </div>
            </div>
            {/* 출발 공항 / 도착 공항 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">출발 공항</Label>
                <Input className="h-10" placeholder="ICN" value={form.departureAirport} onChange={e => setForm(f => ({ ...f, departureAirport: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">도착 공항</Label>
                <Input className="h-10" placeholder="NRT" value={form.arrivalAirport} onChange={e => setForm(f => ({ ...f, arrivalAirport: e.target.value }))} />
              </div>
            </div>
            {/* 출발 일시 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">출발 일시</Label>
              <Input className="h-10" type="datetime-local" value={form.departureTime} onChange={e => setForm(f => ({ ...f, departureTime: e.target.value }))} />
            </div>
            {/* 도착 일시 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">도착 일시</Label>
              <Input className="h-10" type="datetime-local" value={form.arrivalTime} onChange={e => setForm(f => ({ ...f, arrivalTime: e.target.value }))} />
            </div>
            {/* 예약번호 / 좌석 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">예약번호</Label>
                <Input className="h-10" placeholder="ABC123" value={form.bookingRef} onChange={e => setForm(f => ({ ...f, bookingRef: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">좌석</Label>
                <Input className="h-10" placeholder="12A" value={form.seatNumber} onChange={e => setForm(f => ({ ...f, seatNumber: e.target.value }))} />
              </div>
            </div>
            {/* 메모 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">메모</Label>
              <Textarea placeholder="추가 메모..." value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2} className="resize-none" />
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
    </>
  );
}
