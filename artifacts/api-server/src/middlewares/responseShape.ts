/**
 * responseShape.ts — API Contract Enforcement Middleware
 * ═══════════════════════════════════════════════════════════════════════════
 * Guarantees that EVERY JSON response follows the contract:
 *   Success → { success: true,  data: T }
 *   Failure → { success: false, error: string }
 *
 * Rule: if a route already returns a body with a `success` field it is
 * passed through unchanged (no double-wrapping).
 * Streaming responses (SSE) and non-JSON responses are not touched.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { Request, Response, NextFunction } from "express";

export function responseShape(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res) as (body: unknown) => Response;

  res.json = function shapedJson(body: unknown): Response {
    if (body === null || body === undefined) {
      return originalJson(body);
    }

    if (typeof body !== "object" || Array.isArray(body)) {
      const isError = res.statusCode >= 400;
      const wrapped = isError
        ? { success: false, error: typeof body === "string" ? body : "Request failed" }
        : { success: true, data: body };
      return originalJson(wrapped);
    }

    const obj = body as Record<string, unknown>;

    if ("success" in obj) {
      return originalJson(obj);
    }

    if (res.statusCode >= 400) {
      return originalJson({
        success: false,
        error:
          (obj["error"] as string) ??
          (obj["message"] as string) ??
          "Request failed",
        ...(obj["details"] !== undefined ? { details: obj["details"] } : {}),
      });
    }

    return originalJson({ success: true, data: obj });
  } as Response["json"];

  next();
}
