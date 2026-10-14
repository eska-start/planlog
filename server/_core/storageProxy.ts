import type { Express } from "express";
import fs from "fs";
import { getLocalStoragePath } from "../storage";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Serve from local disk if Forge API is not configured or local file exists
    const localPath = getLocalStoragePath(key);
    if (fs.existsSync(localPath)) {
      try {
        let contentType = "application/octet-stream";
        const metaPath = `${localPath}.meta.json`;
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
          if (meta.contentType) contentType = meta.contentType;
        }
        res.set("Content-Type", contentType);
        res.set("Cache-Control", "public, max-age=3600");
        fs.createReadStream(localPath).pipe(res);
        return;
      } catch (err) {
        console.error("[StorageProxy] local file read error:", err);
      }
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(404).send("File not found in local storage");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
