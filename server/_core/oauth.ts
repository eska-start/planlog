import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sanitizeGuestRedirect } from "./redirect";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function parseStateOrigin(state: string): { origin: string; returnPath: string } {
  try {
    // state is base64(redirectUri) where redirectUri = `${origin}/api/oauth/callback`
    const redirectUri = atob(state);
    const url = new URL(redirectUri);
    return { origin: url.origin, returnPath: "/" };
  } catch {
    return { origin: "", returnPath: "/" };
  }
}

export function registerOAuthRoutes(app: Express) {
  // Trust the proxy so req.protocol reflects the real HTTPS upstream
  app.set("trust proxy", 1);

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // Parse the frontend origin from state so the redirect lands on the correct domain
    const { origin: frontendOrigin, returnPath } = parseStateOrigin(state);

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect back to the frontend origin (not just "/" which may resolve to the server)
      const redirectTarget = frontendOrigin ? `${frontendOrigin}${returnPath}` : "/";
      console.log("[OAuth] Redirecting to", redirectTarget);
      res.redirect(302, redirectTarget);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      const errorTarget = frontendOrigin ? `${frontendOrigin}/?error=auth_failed` : "/?error=auth_failed";
      res.redirect(302, errorTarget);
    }
  });

  app.get("/api/auth/guest-login", async (req: Request, res: Response) => {
    const redirect = sanitizeGuestRedirect(
      typeof req.query.redirect === "string" ? req.query.redirect : undefined
    );
    try {
      const openId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const name = `게스트-${openId.slice(-4)}`;

      await db.upsertUser({
        openId,
        name,
        email: null,
        loginMethod: "guest",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, redirect);
    } catch (error) {
      console.error("[GuestAuth] Login failed", error);
      res.redirect(302, "/?error=guest_auth_failed");
    }
  });
}
