/**
 * api.ts — Shared API Contract Types
 * ═══════════════════════════════════════════════════════════════════════════
 * SINGLE SOURCE OF TRUTH for all API response shapes.
 * Both backend (response helpers) and frontend (API client) reference these.
 *
 * Contract rule: EVERY endpoint MUST return one of these shapes:
 *   Success → { success: true,  data: T,         error?: never   }
 *   Failure → { success: false, data?: never,     error: string   }
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

/** Type-guard: narrows to success branch */
export function isApiSuccess<T>(r: ApiResponse<T>): r is ApiSuccess<T> {
  return r.success === true;
}

/** Type-guard: narrows to error branch */
export function isApiError<T>(r: ApiResponse<T>): r is ApiError {
  return r.success === false;
}
