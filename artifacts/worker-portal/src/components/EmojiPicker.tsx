import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  disabled?: boolean;
  buttonClassName?: string;
}

const EMOJI_CATEGORIES = [
  {
    name: "Populer",
    emojis: ["👍", "❤️", "😊", "🙏", "📌", "✅", "❌", "🎉", "🔥", "💰", "📩", "⭐"],
  },
  {
    name: "Ekspresi",
    emojis: [
      "😀", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍",
      "🥰", "😘", "😋", "😜", "🤩", "🥳", "😎", "🧐", "🤔", "🤭", "🤫", "😏",
      "😒", "😔", "😟", "😕", "🥺", "😢", "😭", "😤", "😠", "🤯", "😳", "😱",
    ],
  },
  {
    name: "Tangan & Gestur",
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉",
      "👆", "👇", "✋", "👋", "🤝", "👏", "🙌", "👐", "🤲", "🙏", "✍️", "💪",
    ],
  },
  {
    name: "Simbol & Pekerjaan",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "📌", "📍", "💬",
      "📢", "🔔", "⚠️", "✅", "❌", "💯", "💸", "💵", "💰", "💳", "📩", "📧",
      "📦", "🎉", "🌟", "⭐", "⚡", "🔥", "✨", "🎯", "⏰", "⏱️", "⏳", "🛑",
    ],
  },
];

export function EmojiPicker({ onSelectEmoji, disabled, buttonClassName }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={buttonClassName || "p-2 h-10 w-10 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"}
          title="Pilih Emoji"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 p-2 bg-white border border-slate-200 shadow-xl rounded-2xl z-50"
      >
        <div className="flex items-center gap-1 border-b border-slate-100 pb-1.5 mb-2 overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCategory(idx)}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition-colors min-h-[32px] ${
                activeCategory === idx
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => {
                onSelectEmoji(emoji);
              }}
              className="w-9 h-9 text-lg flex items-center justify-center hover:bg-amber-50 rounded-xl transition-transform active:scale-95 min-h-[36px] min-w-[36px]"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
