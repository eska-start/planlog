export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const url = new URL("/api/auth/guest-login", window.location.origin);
  const redirectTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  url.searchParams.set("redirect", redirectTarget || "/");

  return url.toString();
};
