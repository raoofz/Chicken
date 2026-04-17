/**
 * ══════════════════════════════════════════════════════════════════════════
 *  Device-Aware Adaptive System — محرك التكيّف الذكي مع الجهاز
 *
 *  يكتشف: iOS / Android / Desktop / Low-end hardware
 *  يضبط: الأداء، الرسوم المتحركة، استراتيجية التحميل
 * ══════════════════════════════════════════════════════════════════════════
 */

export type DeviceOS = "ios" | "android" | "desktop" | "unknown";
export type DevicePerf = "high" | "medium" | "low";

export interface DeviceProfile {
  os:            DeviceOS;
  perf:          DevicePerf;
  isStandalone:  boolean;  // launched from PWA home screen
  isTouchDevice: boolean;
  isIPhone:      boolean;
  isSamsung:     boolean;
  supportsSafeArea: boolean;
  devicePixelRatio: number;
  prefersReducedMotion: boolean;
  isOnline:      boolean;
  // Adaptive flags
  enableAnimations: boolean;
  enableHeavyUI:    boolean;
  useNativeScroll:  boolean;
}

function detectOS(): DeviceOS {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/Macintosh|Windows|Linux/.test(ua) && !("ontouchstart" in window)) return "desktop";
  return "unknown";
}

function detectPerf(): DevicePerf {
  const mem = (navigator as any).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 2;
  if (mem !== undefined) {
    if (mem <= 1 || cores <= 2) return "low";
    if (mem <= 3 || cores <= 4) return "medium";
  } else {
    if (cores <= 2) return "low";
    if (cores <= 4) return "medium";
  }
  return "high";
}

export function getDeviceProfile(): DeviceProfile {
  const ua = navigator.userAgent;
  const os = detectOS();
  const perf = detectPerf();
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as any).standalone === true;
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isIPhone  = /iPhone/.test(ua);
  const isSamsung = /SamsungBrowser|SM-/.test(ua);
  const supportsSafeArea = CSS.supports("padding: env(safe-area-inset-top)");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const enableAnimations = !prefersReducedMotion && perf !== "low";
  const enableHeavyUI    = perf === "high";
  const useNativeScroll  = os === "ios";

  return {
    os, perf, isStandalone, isTouchDevice, isIPhone, isSamsung,
    supportsSafeArea, devicePixelRatio: window.devicePixelRatio ?? 1,
    prefersReducedMotion, isOnline: navigator.onLine,
    enableAnimations, enableHeavyUI, useNativeScroll,
  };
}

let _profile: DeviceProfile | null = null;

/** Cached device profile — computed once at startup */
export function deviceProfile(): DeviceProfile {
  if (!_profile) _profile = getDeviceProfile();
  return _profile;
}

/** Apply device-specific CSS classes and meta adjustments to <html> */
export function applyDeviceAdaptations(): void {
  const p = deviceProfile();
  const html = document.documentElement;

  html.classList.add(`device-${p.os}`);
  html.classList.add(`perf-${p.perf}`);
  if (p.isStandalone)        html.classList.add("pwa-standalone");
  if (!p.enableAnimations)   html.classList.add("reduce-motion");
  if (!p.enableHeavyUI)      html.classList.add("lite-mode");
  if (p.isTouchDevice)       html.classList.add("touch-device");
  if (p.isIPhone)            html.classList.add("device-iphone");

  if (p.perf === "low") {
    console.info("[DeviceAdapter] Lite Mode activated — animations disabled, heavy UI reduced");
  }
}
