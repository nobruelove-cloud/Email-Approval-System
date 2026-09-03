import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";

const CURRENT_BUILD_ID = (import.meta.env.VITE_APP_BUILD_ID as string) || "dev";

export async function clearAppCachesAndUnregisterSW(): Promise<void> {
  // 1. Unregister Service Workers if present
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        console.log("[AutoUpdate] Unregistered ServiceWorker:", reg);
      }
    } catch (err) {
      console.warn("[AutoUpdate] SW unregister notice:", err);
    }
  }

  // 2. Clear CacheStorage if supported
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        console.log("[AutoUpdate] Cleared CacheStorage:", name);
      }
    } catch (err) {
      console.warn("[AutoUpdate] CacheStorage clear notice:", err);
    }
  }
}

export function useAutoUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [location] = useLocation();

  const checkForUpdate = useCallback(async () => {
    if (hasUpdate) return;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      const serverVersion = data?.version;

      if (
        serverVersion &&
        CURRENT_BUILD_ID &&
        CURRENT_BUILD_ID !== "dev" &&
        String(serverVersion).trim() !== String(CURRENT_BUILD_ID).trim()
      ) {
        console.log(`[AutoUpdate] New version detected: ${serverVersion} (current: ${CURRENT_BUILD_ID})`);
        setHasUpdate(true);
      }
    } catch (err) {
      // Ignore network errors during version check
    }
  }, [hasUpdate]);

  // Clean stale SW on mount & check for update
  useEffect(() => {
    clearAppCachesAndUnregisterSW().catch(() => {});

    // Initial check after 3s
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  // Check on route change
  useEffect(() => {
    checkForUpdate();
  }, [location, checkForUpdate]);

  // Check on window focus / visibility change
  useEffect(() => {
    function handleFocus() {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [checkForUpdate]);

  // Periodic check every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkForUpdate();
    }, 60000);

    return () => clearInterval(interval);
  }, [checkForUpdate]);

  const applyUpdate = async () => {
    setUpdating(true);
    await clearAppCachesAndUnregisterSW();
    // Force reload bypassing HTTP cache
    window.location.reload();
  };

  return {
    hasUpdate,
    updating,
    applyUpdate,
  };
}
