/**
 * 클라이언트 측 온디바이스 OCR 및 다국어(한/영/일) 스마트 예약 파서
 * - 모바일 OS 내장 OCR 브릿지(window.__NATIVE_OCR__) / 브라우저 TextDetector / Tesseract.js 연동
 * - 서버 연결이 끊기거나 외부 API가 없을 때도 기기 자체에서 항공·숙박·렌트카 정보를 즉시 추출
 */

declare global {
  interface Window {
    __NATIVE_OCR__?: {
      recognizeText: (dataUrl: string) => Promise<string>;
    };
    TextDetector?: new () => {
      detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    };
    Tesseract?: {
      recognize: (
        image: File | string,
        langs: string,
      ) => Promise<{ data?: { text?: string } }>;
    };
  }
}

export async function extractTextOnDevice(file: File, dataUrl: string): Promise<string> {
  // 1. 모바일 네이티브 브릿지 (Capacitor / React Native WebView ML Kit / Apple Vision 연동 시)
  if (typeof window !== "undefined" && window.__NATIVE_OCR__?.recognizeText) {
    try {
      const nativeText = await window.__NATIVE_OCR__.recognizeText(dataUrl);
      if (nativeText && nativeText.trim().length > 0) return nativeText.trim();
    } catch (e) {
      console.warn("[OnDeviceOCR] Native bridge failed:", e);
    }
  }

  // 2. 브라우저 내장 Shape Detection API (TextDetector - Chrome Android / macOS / Windows 지원)
  if (typeof window !== "undefined" && "TextDetector" in window && window.TextDetector) {
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.TextDetector();
      const blocks = await detector.detect(bitmap);
      const text = blocks.map(b => b.rawValue).join("\n").trim();
      if (text.length > 0) return text;
    } catch (e) {
      console.warn("[OnDeviceOCR] TextDetector failed:", e);
    }
  }

  // 3. Tesseract.js (로드되어 있는 경우 클라이언트 워커 실행)
  if (typeof window !== "undefined" && window.Tesseract?.recognize) {
    try {
      const res = await window.Tesseract.recognize(file, "kor+eng");
      const text = res?.data?.text?.trim() ?? "";
      if (text.length > 0) return text;
    } catch (e) {
      console.warn("[OnDeviceOCR] Tesseract failed:", e);
    }
  }

  return "";
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}
