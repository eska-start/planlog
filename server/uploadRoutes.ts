import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드 가능합니다."));
  },
});

export function registerUploadRoutes(app: import("express").Express) {
  const router = Router();

  router.post("/api/upload-ocr", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "파일이 없습니다." });
        return;
      }
      const ext = req.file.originalname.split(".").pop() ?? "jpg";
      const key = `ocr/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      try {
        const { url } = await storagePut(key, req.file.buffer, req.file.mimetype);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const absoluteUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
        res.json({ url: absoluteUrl, dataUrl, key });
      } catch (storageErr) {
        // 스토리지 저장이 실패하더라도 Base64 Data URL로 OCR이 즉시 동작하도록 폴백
        console.warn("[upload-ocr] storage fallback to inline dataUrl:", storageErr);
        res.json({ url: dataUrl, dataUrl, key });
      }
    } catch (e) {
      console.error("[upload-ocr]", e);
      res.status(500).json({ error: "업로드 실패" });
    }
  });

  app.use(router);
}
