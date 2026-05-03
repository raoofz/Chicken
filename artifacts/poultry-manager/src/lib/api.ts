const APP_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function apiPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}/api${normalizedPath}`;
}
