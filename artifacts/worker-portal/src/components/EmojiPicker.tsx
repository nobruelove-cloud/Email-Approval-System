import React, { useState } from "react";
import { Smile, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  disabled?: boolean;
}

const EMOJI_CATEGORIES = [
  {
    name: "Populer",
    emojis: ["👍", "🙏", "❤️", "😊", "🔥", "✅", "🎉", "👌", "💡", "💯"],
  },
  {
    name: "Ekspresi",
    emojis: ["😄", "😃", "😁", "😆", "😅", "😂", "🤣", "😉", "😍", "🥰", "😎", "🤔", "😌", "🤩", "🤝"],
  },
  {
    name: "Tangan & Gestur",
    emojis: ["👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇"],
  },
  {
    name: "Simbol & Objek",
    emojis: ["💬", "📢", "🔔", "⭐", "🌟", "✨", "🔥", "⚡", "🎯", "🔑", "💼", "💰", "💵", "✅", "❌", "⚠️"],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, disabled }) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-10 w-10 min-h-[44px] min-w-[44px] text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors focus:outline-none shrink-0"
          title="Pilih Emoji"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 sm:w-80 p-3 bg-white border border-slate-200 shadow-xl rounded-2xl z-50 space-y-2"
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-amber-500" />
            <span>Pilih Emoji</span>
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-colors ${
                activeCategory === idx
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Emojis Grid */}
        <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto p-1">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => {
                onSelectEmoji(emoji);
                setOpen(false);
              }}
              className="w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center text-lg hover:bg-amber-50 rounded-xl transition-transform hover:scale-125 focus:outline-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
