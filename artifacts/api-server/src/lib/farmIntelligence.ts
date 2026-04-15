type Lang = "ar" | "sv";
function L(ar: string, sv: string, lang: Lang): string { return lang === "sv" ? sv : ar; }

interface TimeSeriesPoint { date: string; value: number; }
interface Alert { level: "critical" | "warning" | "info"; message: string; category: string; timestamp: string; }
interface Recommendation { priority: "high" | "medium" | "low"; action: string; reason: string; category: string; }
interface Prediction { metric: string; current: number; predicted: number; trend: "up" | "down" | "stable"; confidence: number; }
interface Anomaly { metric: string; date: string; expected: number; actual: number; severity: "critical" | "warning"; description: string; }

export interface IntelligenceReport {
  kpis: {
    avgProduction: number;
    feedEfficiency: number;
    mortalityRate: number;
    waterPerBird: number;
    costPerEgg: number;
    hatchRate: number;
  };
  alerts: Alert[];
  recommendations: Recommendation[];
  predictions: Prediction[];
  anomalies: Anomaly[];
  trends: {
    production: TimeSeriesPoint[];
    feed: TimeSeriesPoint[];
    mortality: TimeSeriesPoint[];
    environment: TimeSeriesPoint[];
  };
  score: number;
  generatedAt: string;
}

function movingAverage(data: number[], window: number): number {
  if (data.length === 0) return 0;
  const slice = data.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function detectTrend(data: number[]): "up" | "down" | "stable" {
  if (data.length < 3) return "stable";
  const recent = data.slice(-3);
  const older = data.slice(-6, -3);
  if (older.length === 0) return "stable";
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const change = ((recentAvg - olderAvg) / (olderAvg || 1)) * 100;
  if (change > 5) return "up";
  if (change < -5) return "down";
  return "stable";
}

function detectAnomalies(data: TimeSeriesPoint[], metricName: string, lang: Lang): Anomaly[] {
  if (data.length < 5) return [];
  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
  const anomalies: Anomaly[] = [];
  for (const point of data.slice(-7)) {
    const zScore = Math.abs((point.value - mean) / (stdDev || 1));
    if (zScore > 2) {
      anomalies.push({
        metric: metricName,
        date: point.date,
        expected: Math.round(mean * 10) / 10,
        actual: point.value,
        severity: zScore > 3 ? "critical" : "warning",
        description: point.value > mean
          ? L(`ارتفاع غير طبيعي في ${metricName}`, `Onormalt hög ${metricName}`, lang)
          : L(`انخفاض غير طبيعي في ${metricName}`, `Onormalt låg ${metricName}`, lang),
      });
    }
  }
  return anomalies;
}

export interface FarmData {
  flocks: { id: number; name: string; count: number; ageDays: number; purpose: string }[];
  production: { date: string; eggsCollected: number; eggsBroken: number; eggsWeight: number | null; flockId: number | null }[];
  feed: { date: string; quantityKg: number; totalCost: number | null; feedType: string; flockId: number | null }[];
  water: { date: string; quantityLiters: number; flockId: number | null }[];
  environment: { date: string; temperatureC: number; humidityPct: number | null }[];
  mortality: { date: string; count: number; cause: string | null; flockId: number | null }[];
  hatching: { eggsSet: number; eggsHatched: number | null; status: string }[];
  transactions: { type: string; amount: number; category: string }[];
}

export function generateIntelligenceReport(data: FarmData, lang: Lang): IntelligenceReport {
  const now = new Date().toISOString();
  const totalBirds = data.flocks.reduce((s, f) => s + f.count, 0);

  const prodValues = data.production.map(p => p.eggsCollected);
  const feedValues = data.feed.map(f => Number(f.quantityKg));
  const mortalityValues = data.mortality.map(m => m.count);
  const totalEggs = prodValues.reduce((a, b) => a + b, 0);
  const totalFeedKg = feedValues.reduce((a, b) => a + b, 0);
  const totalMortality = mortalityValues.reduce((a, b) => a + b, 0);
  const totalWater = data.water.reduce((s, w) => s + Number(w.quantityLiters), 0);
  const totalFeedCost = data.feed.reduce((s, f) => s + Number(f.totalCost || 0), 0);
  const hatchedCycles = data.hatching.filter(h => h.eggsHatched !== null && h.eggsHatched > 0);
  const avgHatchRate = hatchedCycles.length > 0
    ? hatchedCycles.reduce((s, h) => s + ((h.eggsHatched! / h.eggsSet) * 100), 0) / hatchedCycles.length
    : 0;

  const kpis = {
    avgProduction: data.production.length > 0 ? Math.round((totalEggs / data.production.length) * 10) / 10 : 0,
    feedEfficiency: totalFeedKg > 0 ? Math.round((totalEggs / totalFeedKg) * 100) / 100 : 0,
    mortalityRate: totalBirds > 0 ? Math.round((totalMortality / totalBirds) * 10000) / 100 : 0,
    waterPerBird: totalBirds > 0 && data.water.length > 0 ? Math.round((totalWater / data.water.length / totalBirds) * 100) / 100 : 0,
    costPerEgg: totalEggs > 0 ? Math.round((totalFeedCost / totalEggs) * 100) / 100 : 0,
    hatchRate: Math.round(avgHatchRate * 10) / 10,
  };

  const alerts: Alert[] = [];
  const recommendations: Recommendation[] = [];

  // ─── Rule Engine ────────────────────────────────────────────────
  if (kpis.mortalityRate > 5) {
    alerts.push({
      level: "critical", category: L("نفوق", "Dödlighet", lang), timestamp: now,
      message: L(
        `معدل النفوق مرتفع جداً (${kpis.mortalityRate}%) — يجب اتخاذ إجراء فوري`,
        `Dödlighetsgraden är mycket hög (${kpis.mortalityRate}%) — omedelbara åtgärder krävs`,
        lang
      ),
    });
    recommendations.push({
      priority: "high", category: L("صحة", "Hälsa", lang),
      action: L("اتصل بالطبيب البيطري فوراً وافحص القطيع", "Kontakta veterinären omedelbart och undersök flocken", lang),
      reason: L("معدل النفوق تجاوز الحد الطبيعي", "Dödlighetsgraden överstiger normalvärdet", lang),
    });
  } else if (kpis.mortalityRate > 2) {
    alerts.push({
      level: "warning", category: L("نفوق", "Dödlighet", lang), timestamp: now,
      message: L(
        `معدل النفوق ${kpis.mortalityRate}% — يحتاج مراقبة`,
        `Dödlighetsgrad ${kpis.mortalityRate}% — behöver övervakning`,
        lang
      ),
    });
  }

  if (data.production.length >= 5) {
    const recentProd = prodValues.slice(-5);
    const olderProd = prodValues.slice(-10, -5);
    if (olderProd.length >= 3) {
      const recentAvg = recentProd.reduce((a, b) => a + b, 0) / recentProd.length;
      const olderAvg = olderProd.reduce((a, b) => a + b, 0) / olderProd.length;
      if (recentAvg < olderAvg * 0.85) {
        alerts.push({
          level: "warning", category: L("إنتاج", "Produktion", lang), timestamp: now,
          message: L(
            `انخفاض الإنتاج بنسبة ${Math.round((1 - recentAvg / olderAvg) * 100)}% مقارنة بالفترة السابقة`,
            `Produktionsminskning med ${Math.round((1 - recentAvg / olderAvg) * 100)}% jämfört med föregående period`,
            lang
          ),
        });
        recommendations.push({
          priority: "high", category: L("إنتاج", "Produktion", lang),
          action: L("تحقق من جودة العلف ونظام الإضاءة والحرارة", "Kontrollera foderkvalitet, belysning och temperatur", lang),
          reason: L("انخفاض ملحوظ في إنتاج البيض", "Märkbar minskning av äggproduktionen", lang),
        });
      }
    }
  }

  if (data.feed.length >= 5 && data.production.length >= 5) {
    const recentFeed = feedValues.slice(-5);
    const recentFeedAvg = recentFeed.reduce((a, b) => a + b, 0) / recentFeed.length;
    const olderFeed = feedValues.slice(-10, -5);
    const recentProdAvg = movingAverage(prodValues, 5);
    if (olderFeed.length >= 3) {
      const olderFeedAvg = olderFeed.reduce((a, b) => a + b, 0) / olderFeed.length;
      if (recentFeedAvg > olderFeedAvg * 1.15 && detectTrend(prodValues) !== "up") {
        alerts.push({
          level: "warning", category: L("علف", "Foder", lang), timestamp: now,
          message: L(
            "زيادة استهلاك العلف بدون زيادة في الإنتاج — احتمال هدر",
            "Ökat foderintag utan ökad produktion — möjligt slöseri",
            lang
          ),
        });
        recommendations.push({
          priority: "medium", category: L("علف", "Foder", lang),
          action: L("راجع كميات العلف وتأكد من عدم وجود هدر أو سرقة", "Granska fodermängder och kontrollera att det inte finns slöseri eller stöld", lang),
          reason: L("كفاءة التحويل الغذائي انخفضت", "Foderomvandlingseffektiviteten har sjunkit", lang),
        });
      }
    }
  }

  const envTemps = data.environment.map(e => Number(e.temperatureC));
  if (envTemps.length > 0) {
    const lastTemp = envTemps[envTemps.length - 1];
    if (lastTemp > 35) {
      alerts.push({
        level: "critical", category: L("بيئة", "Miljö", lang), timestamp: now,
        message: L(`حرارة المزرعة مرتفعة جداً (${lastTemp}°م) — خطر إجهاد حراري`, `Gårdstemperaturen är mycket hög (${lastTemp}°C) — risk för värmestress`, lang),
      });
      recommendations.push({
        priority: "high", category: L("بيئة", "Miljö", lang),
        action: L("شغّل التهوية فوراً ووفّر ماء بارد", "Sätt igång ventilationen omedelbart och erbjud kallt vatten", lang),
        reason: L("الحرارة فوق 35°م تسبب إجهاد حراري وانخفاض الإنتاج", "Temperatur över 35°C orsakar värmestress och minskad produktion", lang),
      });
    } else if (lastTemp < 15) {
      alerts.push({
        level: "warning", category: L("بيئة", "Miljö", lang), timestamp: now,
        message: L(`حرارة المزرعة منخفضة (${lastTemp}°م) — تحتاج تدفئة`, `Gårdstemperaturen är låg (${lastTemp}°C) — behöver uppvärmning`, lang),
      });
    }
  }

  const envHumidity = data.environment.filter(e => e.humidityPct != null).map(e => Number(e.humidityPct));
  if (envHumidity.length > 0) {
    const lastH = envHumidity[envHumidity.length - 1];
    if (lastH > 80) {
      alerts.push({
        level: "warning", category: L("بيئة", "Miljö", lang), timestamp: now,
        message: L("رطوبة المزرعة مرتفعة — خطر أمراض تنفسية", "Hög fuktighet i gården — risk för luftvägssjukdomar", lang),
      });
    }
  }

  if (kpis.feedEfficiency > 0 && kpis.feedEfficiency < 3) {
    recommendations.push({
      priority: "medium", category: L("علف", "Foder", lang),
      action: L("حسّن جودة العلف أو غيّر نوعه لزيادة كفاءة التحويل", "Förbättra foderkvaliteten eller byt typ för bättre omvandlingseffektivitet", lang),
      reason: L(`كفاءة التحويل الحالية ${kpis.feedEfficiency} بيضة/كغ — أقل من المعدل`, `Nuvarande omvandlingseffektivitet ${kpis.feedEfficiency} ägg/kg — under genomsnittet`, lang),
    });
  }

  if (kpis.hatchRate > 0 && kpis.hatchRate < 70) {
    alerts.push({
      level: "warning", category: L("تفقيس", "Kläckning", lang), timestamp: now,
      message: L(`معدل التفقيس ${kpis.hatchRate}% — أقل من المعدل الطبيعي (70%+)`, `Kläckningsgrad ${kpis.hatchRate}% — under normalvärdet (70%+)`, lang),
    });
    recommendations.push({
      priority: "medium", category: L("تفقيس", "Kläckning", lang),
      action: L("تحقق من إعدادات الفقاسة (الحرارة والرطوبة والتقليب)", "Kontrollera kläckmaskinens inställningar (temperatur, fuktighet och vändning)", lang),
      reason: L("معدل التفقيس منخفض يشير لمشكلة في الفقاسة أو جودة البيض", "Låg kläckningsgrad tyder på problem med kläckmaskinen eller äggkvaliteten", lang),
    });
  }

  const totalIncome = data.transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = data.transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  if (totalExpense > totalIncome && totalIncome > 0) {
    alerts.push({
      level: "warning", category: L("مالية", "Ekonomi", lang), timestamp: now,
      message: L("المصاريف تتجاوز الدخل — المزرعة تعمل بخسارة", "Kostnaderna överstiger inkomsten — gården går med förlust", lang),
    });
    recommendations.push({
      priority: "high", category: L("مالية", "Ekonomi", lang),
      action: L("راجع بنود المصاريف الكبرى وابحث عن فرص لتقليلها", "Granska de största utgiftsposterna och sök möjligheter att minska dem", lang),
      reason: L("المزرعة تعمل بخسارة مالية", "Gården går med ekonomisk förlust", lang),
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "info", category: L("عام", "Allmänt", lang), timestamp: now,
      message: L("✅ لا توجد تنبيهات حالياً — المزرعة في وضع جيد", "✅ Inga varningar för närvarande — gården är i gott skick", lang),
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low", category: L("عام", "Allmänt", lang),
      action: L("استمر في تسجيل البيانات يومياً لتحسين دقة التحليل", "Fortsätt registrera data dagligen för att förbättra analysens noggrannhet", lang),
      reason: L("البيانات الحالية كافية لكن المزيد يحسن التوقعات", "Nuvarande data räcker men mer data förbättrar prognoserna", lang),
    });
  }

  // ─── Prediction Engine (Moving Averages) ─────────────────────
  const predictions: Prediction[] = [];
  if (prodValues.length >= 3) {
    const ma3 = movingAverage(prodValues, 3);
    const ma7 = movingAverage(prodValues, 7);
    predictions.push({
      metric: L("إنتاج البيض (غداً)", "Äggproduktion (imorgon)", lang),
      current: prodValues[prodValues.length - 1] || 0,
      predicted: Math.round(ma3),
      trend: detectTrend(prodValues),
      confidence: Math.min(85, 50 + prodValues.length * 2),
    });
    if (prodValues.length >= 7) {
      predictions.push({
        metric: L("إنتاج البيض (أسبوع)", "Äggproduktion (vecka)", lang),
        current: Math.round(ma3),
        predicted: Math.round(ma7),
        trend: detectTrend(prodValues),
        confidence: Math.min(75, 40 + prodValues.length),
      });
    }
  }
  if (feedValues.length >= 3) {
    predictions.push({
      metric: L("استهلاك العلف (غداً)", "Foderåtgång (imorgon)", lang),
      current: feedValues[feedValues.length - 1] || 0,
      predicted: Math.round(movingAverage(feedValues, 3) * 10) / 10,
      trend: detectTrend(feedValues),
      confidence: Math.min(80, 50 + feedValues.length * 2),
    });
  }

  // ─── Anomaly Detection ───────────────────────────────────────
  const prodSeries: TimeSeriesPoint[] = data.production.map(p => ({ date: p.date, value: p.eggsCollected }));
  const feedSeries: TimeSeriesPoint[] = data.feed.map(f => ({ date: f.date, value: Number(f.quantityKg) }));
  const mortSeries: TimeSeriesPoint[] = data.mortality.map(m => ({ date: m.date, value: m.count }));
  const envSeries: TimeSeriesPoint[] = data.environment.map(e => ({ date: e.date, value: Number(e.temperatureC) }));

  const anomalies = [
    ...detectAnomalies(prodSeries, L("الإنتاج", "Produktion", lang), lang),
    ...detectAnomalies(feedSeries, L("العلف", "Foder", lang), lang),
    ...detectAnomalies(mortSeries, L("النفوق", "Dödlighet", lang), lang),
    ...detectAnomalies(envSeries, L("الحرارة", "Temperatur", lang), lang),
  ];

  // ─── Farm Score ──────────────────────────────────────────────
  let score = 100;
  score -= alerts.filter(a => a.level === "critical").length * 20;
  score -= alerts.filter(a => a.level === "warning").length * 10;
  score -= anomalies.filter(a => a.severity === "critical").length * 15;
  score -= anomalies.filter(a => a.severity === "warning").length * 5;
  if (kpis.mortalityRate > 3) score -= 15;
  if (kpis.feedEfficiency > 0 && kpis.feedEfficiency < 3) score -= 10;
  score = Math.max(0, Math.min(100, score));

  return {
    kpis,
    alerts,
    recommendations,
    predictions,
    anomalies,
    trends: { production: prodSeries, feed: feedSeries, mortality: mortSeries, environment: envSeries },
    score,
    generatedAt: now,
  };
}
