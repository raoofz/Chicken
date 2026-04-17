/**
 * usePWAInstall — نافذة تثبيت التطبيق الذكية
 *
 * تراقب حدث BeforeInstallPrompt وتتيح تشغيله برمجياً
 * تتعقّب ما إذا كان التطبيق مثبّتاً بالفعل
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const appInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("appinstalled", appInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!installPrompt) return "unavailable";
    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setInstallPrompt(null);
      return outcome;
    } catch {
      return "unavailable";
    } finally {
      setIsInstalling(false);
    }
  };

  const canInstall = !!installPrompt && !isInstalled;

  return { canInstall, isInstalled, isInstalling, triggerInstall };
}
