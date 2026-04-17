/**
 * api.ts — Central API Client
 * ═══════════════════════════════════════════════════════════════════════════
 * SINGLE fetch entry-point for the entire frontend.
 *
 * Contract:
 *   • Every successful call returns T (auto-unwrapped from { success, data })
 *   • Every failed call throws an Error with a human-readable message
 *   • 401 → redirects to /login automatically
 *
 * Usage:
 *   import { apiFetch } from "@/lib/api";
 *   const summary = await apiFetch<DashboardSummary>("/api/dashboard/summary");
 * ═══════════════════════════════════════════════════════════════════════════
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`;

  const hasBody = init?.body !== undefined && !(init.body instanceof FormData);
  const contentTypeHeaders: Record<string, string> =
    hasBody && !init?.headers ? { "Content-Type": "application/json" } : {};

  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { ...contentTypeHeaders, ...(init?.headers as Record<string, string> | undefined) },
  });

  if (res.status === 401) {
    window.location.href = `${BASE}/login`;
    throw new Error("غير مصرح — يتم إعادة التوجيه");
  }

  let body: unknown;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (body && typeof body === "object" && "success" in (body as object)) {
    const shaped = body as { success: boolean; data?: T; error?: string };
    if (!shaped.success) {
      throw new Error(shaped.error ?? "فشل الطلب");
    }
    return shaped.data as T;
  }

  if (!res.ok) {
    const msg =
      (body as Record<string, unknown>)?.["error"] ??
      (body as Record<string, unknown>)?.["message"] ??
      `HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  return body as T;
}

/** Convenience: POST with JSON body */
export async function apiPost<T = unknown>(
  path: string,
  payload?: unknown,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    ...init,
  });
}

/** Convenience: PUT with JSON body */
export async function apiPut<T = unknown>(
  path: string,
  payload?: unknown,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
    ...init,
  });
}

/** Convenience: DELETE */
export async function apiDelete<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE", ...init });
}
