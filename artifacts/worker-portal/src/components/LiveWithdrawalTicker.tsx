interface PaymentEntry {
  id: string;
  worker: string;
  amount: string;
  method: string;
  timeAgo: string;
}

const SAMPLE_PAYMENTS: PaymentEntry[] = [
  { id: "1", worker: "@dimas_p***", amount: "Rp 5.000", method: "DANA", timeAgo: "2m lalu" },
  { id: "2", worker: "@fajar_a***", amount: "Rp 10.000", method: "OVO", timeAgo: "5m lalu" },
  { id: "3", worker: "@rizky_k***", amount: "Rp 15.000", method: "GoPay", timeAgo: "9m lalu" },
  { id: "4", worker: "@m_fauzi***", amount: "Rp 7.000", method: "ShopeePay", timeAgo: "14m lalu" },
  { id: "5", worker: "@dewi_a***", amount: "Rp 25.000", method: "LinkAja", timeAgo: "18m lalu" },
  { id: "6", worker: "@budi_s***", amount: "Rp 12.000", method: "DANA", timeAgo: "23m lalu" },
  { id: "7", worker: "@siti_m***", amount: "Rp 17.500", method: "OVO", timeAgo: "29m lalu" },
  { id: "8", worker: "@andri_w***", amount: "Rp 35.000", method: "GoPay", timeAgo: "34m lalu" },
  { id: "9", worker: "@bayu_r***", amount: "Rp 18.000", method: "ShopeePay", timeAgo: "41m lalu" },
  { id: "10", worker: "@hendra_k***", amount: "Rp 10.000", method: "LinkAja", timeAgo: "47m lalu" },
  { id: "11", worker: "@rida_n***", amount: "Rp 50.000", method: "DANA", timeAgo: "53m lalu" },
  { id: "12", worker: "@wahyu_t***", amount: "Rp 15.000", method: "OVO", timeAgo: "1j lalu" },
];

export function LiveWithdrawalTicker() {
  // Duplicate array so marquee can scroll infinitely without gaps
  const tickerItems = [...SAMPLE_PAYMENTS, ...SAMPLE_PAYMENTS];

  return (
    <div className="w-full bg-slate-900/90 border-y border-slate-800/80 backdrop-blur-md overflow-hidden relative z-30 py-2.5 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3">
        {/* Left Green Glowing Indicator Badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold shrink-0 tracking-wide uppercase">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </span>
          <span className="whitespace-nowrap">Live Pencairan</span>
        </div>

        {/* Separator line */}
        <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

        {/* Continuous Ticker Viewport Area */}
        <div className="overflow-hidden flex-1 relative [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="animate-ticker flex items-center gap-3 sm:gap-4">
            {tickerItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-xs text-slate-300 whitespace-nowrap shrink-0 shadow-sm hover:border-emerald-500/40 transition-colors"
              >
                <span className="text-amber-400 font-medium font-mono">{item.worker}</span>
                <span className="text-slate-500">mencairkan</span>
                <span className="text-emerald-400 font-bold">{item.amount}</span>
                <span className="text-[10px] bg-slate-800/90 border border-slate-700/60 text-slate-200 px-1.5 py-0.5 rounded font-semibold">
                  {item.method}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">({item.timeAgo})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
