import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";

export function AutoUpdateBanner() {
  const { hasUpdate, updating, applyUpdate } = useAutoUpdate();

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 shadow-lg border-b border-amber-400/30 backdrop-blur-md animate-in slide-in-from-top duration-300">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-full bg-white/20 text-amber-100 shrink-0">
            <Sparkles className="w-4 h-4 text-amber-200" />
          </span>
          <span>
            <strong className="font-extrabold text-white">Versi Baru Portal Tersedia!</strong>{" "}
            <span className="hidden sm:inline text-amber-100/90">
              Pembaruan telah siap untuk meningkatkan performa & stabilitas portal.
            </span>
          </span>
        </div>

        <Button
          size="sm"
          disabled={updating}
          onClick={applyUpdate}
          className="bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs h-8 px-3.5 rounded-xl shadow-md border border-amber-200 shrink-0 gap-1.5 active:scale-95 transition-transform"
        >
          {updating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
          )}
          {updating ? "Memperbarui..." : "Perbarui Sekarang"}
        </Button>
      </div>
    </div>
  );
}
