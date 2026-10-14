export const ENV = {
  appId: process.env.VITE_APP_ID || "planlog-local-app",
  cookieSecret: process.env.JWT_SECRET || "planlog-local-default-jwt-secret-key-2026",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
