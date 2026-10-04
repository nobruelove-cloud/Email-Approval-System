import React, { createContext, useContext, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ViewModeContextType {
  isDesktopView: boolean;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType>({
  isDesktopView: false,
  toggleViewMode: () => {},
});

export const useViewMode = () => useContext(ViewModeContext);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [isDesktopView, setIsDesktopView] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("view_mode_preference");
      if (saved === "desktop") return true;
      if (saved === "mobile") return false;
    }
    return false;
  });

  useEffect(() => {
    const preference = isDesktopView ? "desktop" : "mobile";
    localStorage.setItem("view_mode_preference", preference);

    const metaViewport =
      document.getElementById("viewport-meta") ||
      document.querySelector('meta[name="viewport"]');

    if (metaViewport) {
      if (isDesktopView) {
        metaViewport.setAttribute("content", "width=1280");
      } else {
        metaViewport.setAttribute("content", "width=device-width, initial-scale=1.0");
      }
    }
  }, [isDesktopView]);

  const toggleViewMode = () => {
    setIsDesktopView((prev) => !prev);
  };

  return (
    <ViewModeContext.Provider value={{ isDesktopView, toggleViewMode }}>
      <div className={isDesktopView ? "min-w-[1280px] overflow-x-auto" : ""}>
        {children}
      </div>
    </ViewModeContext.Provider>
  );
}

export function ViewModeToggle({ className }: { className?: string }) {
  const { isDesktopView, toggleViewMode } = useViewMode();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid="view-mode-toggle-btn"
      onClick={toggleViewMode}
      className={`min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200/80 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${className || ""}`}
      title={isDesktopView ? "Switch to Mobile View" : "Switch to Desktop View"}
    >
      <span>{isDesktopView ? "📱 Mode Mobile" : "🖥️ Mode Desktop"}</span>
    </Button>
  );
}
