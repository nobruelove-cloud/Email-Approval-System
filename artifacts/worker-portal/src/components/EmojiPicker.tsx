import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJI_CATEGORIES = [
  {
    name: "Populer",
    emojis: ["👍", "🙏", "✅", "🔥", "❤️", "😊", "👌", "👏", "💯", "🚀"],
  },
  {
    name: "Ekspresi",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥹", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳"],
  },
  {
    name: "Tangan & Gestur",
    emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏"],
  },
  {
    name: "Simbol & Objek",
    emojis: ["✅", "❌", "❓", "❗", "💬", "💰", "💵", "💸", "💳", "📱", "💻", "📧", "📩", "📦", "📌", "📍", "⏰", "⏳", "🔔", "⭐", "🎉", "⚡", "✨", "🛡️"],
  },
];

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

export function EmojiPicker({ onSelectEmoji }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Populer");

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl shrink-0"
          title="Pilih Emoji"
        >
          <Smile className="w-5 h-5 text-amber-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 sm:w-80 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl z-50"
      >
        <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(cat.name)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeCategory === cat.name
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1">
          {EMOJI_CATEGORIES.find((c) => c.name === activeCategory)?.emojis.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectEmoji(emoji);
                setIsOpen(false);
              }}
              className="p-1.5 text-base sm:text-lg hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-transform active:scale-95 flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
