import { useRef, useState } from "react";
import { Camera, FolderOpen, FileText, Loader2, X, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { extractTextOnDevice, fileToDataUrl } from "@/lib/localOcrParser";

export type ExtractPayload = {
  imageUrl?: string;
  rawText?: string;
};

interface OcrUploadButtonProps {
  onExtracted: (data: Record<string, string | null>) => void;
  uploadEndpoint?: string;
  extractEndpoint: (payload: string | ExtractPayload) => Promise<Record<string, string | null>>;
  label?: string;
}

/**
 * 외부 API 없이도 작동하는 하이브리드 스마트 자동 입력 컴포넌트
 * 1) 카메라 촬영 (모바일 기기 내장 OCR 우선 실행 + 서버 다국어 파서)
 * 2) 갤러리/파일 선택 (Base64 폴백 지원으로 외부 S3 없이도 100% 작동)
 * 3) 예약 문자/바우처 텍스트 붙여넣기 (완전 오프라인 및 모바일 라이브 텍스트 즉시 파싱)
 */
export function OcrUploadButton({ onExtracted, extractEndpoint }: OcrUploadButtonProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [showTextPaste, setShowTextPaste] = useState(false);
  const [pastedText, setPastedText] = useState("");

  const callExtract = async (imageUrl?: string, rawText?: string) => {
    // 하위 호환성: extractEndpoint가 문자열 또는 객체를 받을 수 있도록 처리
    try {
      return await extractEndpoint({ imageUrl, rawText });
    } catch {
      return await extractEndpoint(imageUrl ?? "");
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("파일 크기는 16MB 이하여야 합니다.");
      return;
    }

    setLoading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const dataUrl = await fileToDataUrl(file);

      // 1. 기기 내장 온디바이스 OCR 우선 시도 (네이티브 브릿지 / TextDetector / Tesseract)
      const localText = await extractTextOnDevice(file, dataUrl);

      // 2. 서버 업로드 시도 (실패하거나 외부 스토리지 없을 시 Base64 Data URL 사용)
      let imageUrl = dataUrl;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload-ocr", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (uploadRes.ok) {
          const uploaded = (await uploadRes.json()) as { url?: string; dataUrl?: string };
          imageUrl = uploaded.dataUrl || uploaded.url || dataUrl;
        }
      } catch {
        // 오프라인이거나 업로드 실패 시 dataUrl 그대로 사용
        imageUrl = dataUrl;
      }

      // 3. 정보 추출 실행
      const extracted = await callExtract(imageUrl, localText || undefined);
      const hasAnyValue = Object.values(extracted ?? {}).some(v => v !== null && v !== undefined && String(v).trim() !== "");

      if (hasAnyValue) {
        onExtracted(extracted);
        toast.success("정보가 자동으로 입력되었습니다. 확인 후 수정해주세요.");
      } else {
        toast.info("자동 인식된 항목이 적습니다. '텍스트 붙여넣기'나 직접 입력을 이용해보세요.");
      }
    } catch (e) {
      console.error(e);
      toast.error("이미지 분석에 실패했습니다. 텍스트 붙여넣기 또는 직접 입력을 이용해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextExtract = async () => {
    const trimmed = pastedText.trim();
    if (!trimmed) {
      toast.error("예약 문자나 바우처 텍스트를 붙여넣어 주세요.");
      return;
    }
    setLoading(true);
    try {
      const extracted = await callExtract(undefined, trimmed);
      const hasAnyValue = Object.values(extracted ?? {}).some(v => v !== null && v !== undefined && String(v).trim() !== "");
      if (hasAnyValue) {
        onExtracted(extracted);
        setShowTextPaste(false);
        setPastedText("");
        toast.success("텍스트에서 예약 정보가 자동으로 입력되었습니다!");
      } else {
        toast.info("추출 가능한 항목을 찾지 못했습니다. 형식을 확인해주세요.");
      }
    } catch (e) {
      console.error(e);
      toast.error("텍스트 분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  return (
    <div className="mb-4 space-y-2">
      {/* 숨겨진 인풋 - 카메라 전용 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />
      {/* 숨겨진 인풋 - 파일 선택 전용 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        className="hidden"
        onChange={onInputChange}
      />

      {loading ? (
        <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-sm font-medium text-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>예약 정보 스마트 추출 중...</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {/* 카메라 촬영 버튼 */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all text-xs sm:text-sm font-medium text-primary"
          >
            <Camera className="w-4 h-4 shrink-0" />
            <span>카메라 촬영</span>
          </button>

          {/* 파일 선택 버튼 */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-all text-xs sm:text-sm font-medium text-indigo-600"
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>사진 선택</span>
          </button>

          {/* 예약 텍스트 붙여넣기 버튼 (오프라인/무-API 100% 대응) */}
          <button
            type="button"
            onClick={() => setShowTextPaste(v => !v)}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border-2 border-dashed transition-all text-xs sm:text-sm font-medium ${
              showTextPaste
                ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>텍스트 입력</span>
          </button>
        </div>
      )}

      {/* 텍스트 붙여넣기 패널 */}
      {showTextPaste && !loading && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
          <p className="text-xs text-emerald-800 font-medium">
            예약 문자·이메일·카톡 알림톡이나 사진에서 복사한 텍스트를 붙여넣으세요 (인터넷·외부 API 없이 즉시 자동 분류)
          </p>
          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            placeholder={"예시:\n대한항공 KE123\nICN -> NRT\n출발일시: 2026-05-10 09:20\n도착일시: 2026-05-10 11:30\n예약번호: ABC12D / 좌석: 12A"}
            rows={4}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowTextPaste(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleTextExtract}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              자동 채우기
            </button>
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      {!loading && !showTextPaste && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Sparkles className="w-3 h-3 text-primary/60 shrink-0" />
          티켓 사진 촬영·업로드 또는 예약 문자를 붙여넣으면 온디바이스/스마트 파서가 자동 입력합니다
        </p>
      )}

      {/* 미리보기 */}
      {preview && !loading && (
        <div className="mt-1 relative inline-block">
          <img
            src={preview}
            alt="업로드된 이미지"
            className="h-20 w-auto rounded-lg object-cover border border-border shadow-sm"
          />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 hover:bg-muted shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
