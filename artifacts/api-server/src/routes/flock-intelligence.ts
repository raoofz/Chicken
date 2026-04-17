/**
 * Flock Intelligence API Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Additive intelligence layer for the Chickens module.
 * Does NOT modify any other module's tables or routes.
 */

import { Router, type IRouter } from "express";
import {
  analyzeFlockIntelligence,
  parseFlockNote,
  saveFlockEvent,
  getFlockTimeline,
} from "../lib/chickens-ai-engine/index.js";
import { requireAuth } from "./index.js";

const router: IRouter = Router();

// ── POST /api/flocks/:id/intelligence/analyze ─────────────────────────────
// Run full intelligence analysis for a flock.
// Returns: scores, anomalies, decisions, predictions, confidence

router.post("/flocks/:id/intelligence/analyze", requireAuth, async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) {
    res.status(400).json({ success: false, error: "معرف غير صحيح" });
    return;
  }
  try {
    const result = await analyzeFlockIntelligence(flockId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      res.status(404).json({ success: false, error: "القطيع غير موجود" });
    } else {
      res.status(500).json({ success: false, error: "خطأ في التحليل" });
    }
  }
});

// ── POST /api/flocks/:id/intelligence/parse-note ─────────────────────────
// Parse free Arabic text about a flock and return structured events + confidence.
// If the parsed note contains mortality events, they are saved to flock_events.

router.post("/flocks/:id/intelligence/parse-note", requireAuth, async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) {
    res.status(400).json({ success: false, error: "معرف غير صحيح" });
    return;
  }

  const { text } = req.body as { text?: string };
  if (!text || text.trim().length < 2) {
    res.status(400).json({ success: false, error: "النص مطلوب" });
    return;
  }

  try {
    const parsed = parseFlockNote(text);

    // Persist parsed events (excluding analysis-type overhead events)
    for (const evt of parsed.events) {
      if (evt.severity !== "positive") {
        await saveFlockEvent(
          flockId, evt.type, evt.subtype, evt.severity,
          { value: evt.value, signalAr: evt.signalAr, text: text.slice(0, 200) },
          evt.confidence
        );
      }
    }

    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: "خطأ في التحليل اللغوي" });
  }
});

// ── GET /api/flocks/:id/intelligence/timeline ─────────────────────────────
// Retrieve event timeline for a flock (last N events).

router.get("/flocks/:id/intelligence/timeline", requireAuth, async (req, res) => {
  const flockId = Number(req.params.id);
  if (isNaN(flockId)) {
    res.status(400).json({ success: false, error: "معرف غير صحيح" });
    return;
  }
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  try {
    const events = await getFlockTimeline(flockId, limit);
    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, error: "خطأ في جلب التاريخ" });
  }
});

export default router;
