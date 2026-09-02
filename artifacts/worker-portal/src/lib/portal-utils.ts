import { Timestamp } from "firebase/firestore";
import {
  DEFAULT_TIERS,
  DEFAULT_REFERRAL_TIERS,
  DEFAULT_OPERATING_HOURS,
  DEFAULT_PAYMENT_METHOD_FEES,
  type EmailSubmission,
  type TierConfig,
  type ReferralTierConfig,
  type OperatingHoursConfig,
  type Referral,
  type PaymentMethodFeeConfig,
  type WithdrawalSettings,
  type PortalRules,
} from "./portal-types";

export function formatDate(value: unknown, fallback = "Menunggu tanggal") {
  if (!value) return fallback;
  const date = value instanceof Timestamp ? value.toDate() : new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: unknown, fallback = "Menunggu waktu") {
  if (!value) return fallback;
  const date = value instanceof Timestamp ? value.toDate() : new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 5)}…${id.slice(-4)}` : id;
}

/**
 * Resolves fee configuration for a specific payment method from WithdrawalSettings or fallback PortalRules.
 */
export function getPaymentMethodFeeConfig(
  methodName: string,
  withdrawalSettings?: WithdrawalSettings | null,
  fallbackRules?: PortalRules | null
): PaymentMethodFeeConfig {
  const normName = (methodName || "").trim().toLowerCase();

  if (withdrawalSettings?.methods && Array.isArray(withdrawalSettings.methods)) {
    const found = withdrawalSettings.methods.find((m) => m.method.trim().toLowerCase() === normName);
    if (found) return found;
  }

  const defaultFound = DEFAULT_PAYMENT_METHOD_FEES.find((m) => m.method.trim().toLowerCase() === normName);
  if (defaultFound) return defaultFound;

  // Fallback if legacy withdrawFeePercent is set in rules
  const legacyPercent = fallbackRules?.withdrawFeePercent ?? 0;
  return {
    method: methodName || "Transfer Bank",
    enabled: true,
    feeType: legacyPercent > 0 ? "percentage" : "free",
    feeValue: legacyPercent,
  };
}

/**
 * Calculates withdrawal fee based on provider configuration and withdrawal amount.
 */
export function calculateWithdrawalFee(amount: number, feeConfig?: PaymentMethodFeeConfig | null): number {
  if (!feeConfig || feeConfig.feeType === "free" || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  if (feeConfig.feeType === "fixed") {
    return Math.max(0, Math.round(feeConfig.feeValue));
  }

  if (feeConfig.feeType === "percentage") {
    const fee = (amount * Math.max(0, feeConfig.feeValue)) / 100;
    return Math.max(0, Math.round(fee));
  }

  return 0;
}

/**
 * Formats a fee configuration into a human-readable badge text.
 * e.g. "Bebas Biaya", "Biaya Rp 2.500", or "Biaya 1.5%"
 */
export function formatFeeBadge(feeConfig?: PaymentMethodFeeConfig | null): string {
  if (!feeConfig || feeConfig.feeType === "free" || feeConfig.feeValue <= 0) {
    return "Bebas Biaya";
  }

  if (feeConfig.feeType === "fixed") {
    return `Biaya ${formatMoney(feeConfig.feeValue)}`;
  }

  if (feeConfig.feeType === "percentage") {
    return `Biaya ${feeConfig.feeValue}%`;
  }

  return "Bebas Biaya";
}

/**
 * Returns item count for a submission (supports both batch items array and single legacy email submission)
 */
export function getItemCountOfSubmission(sub: EmailSubmission): number {
  if (typeof sub.itemCount === "number" && sub.itemCount > 0) {
    return sub.itemCount;
  }
  if (Array.isArray(sub.items) && sub.items.length > 0) {
    return sub.items.length;
  }
  if (sub.email) {
    return 1;
  }
  return 0;
}

/**
 * Returns the tier configuration for a specified tier number or falls back to Tier 1 / default tier.
 */
export function getTierConfig(tierNum: number, tiersList?: TierConfig[]): TierConfig {
  const activeTiers = Array.isArray(tiersList) && tiersList.length > 0 ? tiersList : DEFAULT_TIERS;
  const found = activeTiers.find((t) => Number(t.tier) === Number(tierNum));
  if (found) return found;
  return activeTiers[0] ?? DEFAULT_TIERS[0];
}

/**
 * Calculates recommended tier based on worker's accumulated approved/submitted quantity.
 */
export function getRecommendedTier(accumulatedQty: number, tiersList?: TierConfig[]): TierConfig {
  const activeTiers = Array.isArray(tiersList) && tiersList.length > 0 ? tiersList : DEFAULT_TIERS;
  const qty = Math.max(0, accumulatedQty);

  // Find matching tier range
  const matched = activeTiers.find((t) => qty >= t.minQty && qty <= t.maxQty);
  if (matched) return matched;

  // Fallback: if quantity exceeds all maxQty, recommend highest tier
  const sorted = [...activeTiers].sort((a, b) => a.minQty - b.minQty);
  if (qty > (sorted[sorted.length - 1]?.maxQty ?? 0)) {
    return sorted[sorted.length - 1];
  }

  return sorted[0] ?? DEFAULT_TIERS[0];
}

/**
 * Validates a list of TierConfigs to avoid invalid ranges, negative values, or overlapping thresholds.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateTierConfigs(tiers: TierConfig[]): string | null {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return "Konfigurasi tier tidak boleh kosong.";
  }

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!t.name || !t.name.trim()) {
      return `Nama tier ke-${i + 1} tidak boleh kosong.`;
    }
    if (t.minQty < 1) {
      return `Jumlah minimal untuk ${t.name} harus minimal 1.`;
    }
    if (t.maxQty < t.minQty) {
      return `Jumlah maksimal (${t.maxQty}) untuk ${t.name} tidak boleh lebih kecil dari jumlah minimal (${t.minQty}).`;
    }
    if (t.pricePerItem < 0) {
      return `Harga per item untuk ${t.name} tidak boleh negatif.`;
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      if (t.minQty <= prev.maxQty) {
        return `Rentang tier bertabrakan: ${prev.name} (${prev.minQty}–${prev.maxQty}) dan ${t.name} (${t.minQty}–${t.maxQty}).`;
      }
    }
  }

  return null;
}

/**
 * Returns a YYYY-MM period key string based on transaction date.
 */
export function getMonthlyPeriodKey(inputDate?: Date | unknown): string {
  if (!inputDate) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const date = inputDate instanceof Timestamp ? inputDate.toDate() : inputDate instanceof Date ? inputDate : new Date(inputDate as string | number);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Formats a "YYYY-MM" string into Indonesian month and year (e.g., "2026-08" -> "Agustus 2026").
 */
export function formatMonthYear(periodKey: string): string {
  if (!periodKey || typeof periodKey !== "string" || !/^\d{4}-\d{2}$/.test(periodKey.trim())) {
    return periodKey || "Periode Tidak Valid";
  }
  const [yearStr, monthStr] = periodKey.trim().split("-");
  const monthNum = parseInt(monthStr, 10);
  const yearNum = parseInt(yearStr, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12 || isNaN(yearNum)) {
    return periodKey;
  }
  const dummyDate = new Date(yearNum, monthNum - 1, 1);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(dummyDate);
}

/**
 * Returns sorted unique monthly period options for UI select dropdown.
 * Generates options for recent past months (default 12 months), the current month, and the active selected month.
 */
export function getPeriodOptions(
  transactions: { period: string }[] = [],
  activePeriod?: string,
  monthsCount = 12
): { value: string; label: string }[] {
  const periodSet = new Set<string>();

  // Add current month and past N months
  const now = new Date();
  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodSet.add(getMonthlyPeriodKey(d));
  }

  if (activePeriod && /^\d{4}-\d{2}$/.test(activePeriod.trim())) {
    periodSet.add(activePeriod.trim());
  }

  transactions.forEach((tx) => {
    if (tx.period && typeof tx.period === "string" && /^\d{4}-\d{2}$/.test(tx.period.trim())) {
      periodSet.add(tx.period.trim());
    }
  });

  const sortedPeriods = Array.from(periodSet).sort((a, b) => b.localeCompare(a));

  return sortedPeriods.map((period) => ({
    value: period,
    label: formatMonthYear(period),
  }));
}

/**
 * Validates HH:mm time string format strictly (00:00 - 23:59).
 */
export function validateTimeString(time: string): boolean {
  if (typeof time !== "string") return false;
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Validates OperatingHoursConfig object.
 * Returns null if valid, or "Jam operasional tidak valid." if invalid.
 */
export function validateOperatingHours(config: OperatingHoursConfig): string | null {
  if (!config || typeof config !== "object" || !config.days) {
    return "Jam operasional tidak valid.";
  }

  const dayKeys: (keyof OperatingHoursConfig["days"])[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  for (const dayKey of dayKeys) {
    const day = config.days[dayKey];
    if (!day) {
      return "Jam operasional tidak valid.";
    }
    if (day.enabled) {
      if (!validateTimeString(day.open) || !validateTimeString(day.close)) {
        return "Jam operasional tidak valid.";
      }
      const [openH, openM] = day.open.split(":").map(Number);
      const [closeH, closeM] = day.close.split(":").map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      if (openMinutes >= closeMinutes) {
        return "Jam operasional tidak valid.";
      }
    }
  }

  return null;
}

/**
 * Calculates operating status based on Asia/Jakarta timezone or configured timezone.
 */
export function getOperatingStatus(
  config?: OperatingHoursConfig,
  nowDate?: Date,
): { isOpen: boolean; isDisabled: boolean; statusText: string } {
  const activeConfig = config ?? DEFAULT_OPERATING_HOURS;
  if (!activeConfig || activeConfig.enabled === false) {
    return { isOpen: false, isDisabled: true, statusText: "Jam operasional tidak tersedia." };
  }

  const date = nowDate || new Date();
  const tz = activeConfig.timezone || "Asia/Jakarta";

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    let weekdayStr = "";
    let hourStr = "";
    let minuteStr = "";

    for (const part of parts) {
      if (part.type === "weekday") weekdayStr = part.value.toLowerCase();
      if (part.type === "hour") hourStr = part.value;
      if (part.type === "minute") minuteStr = part.value;
    }

    const dayKeyMap: Record<string, keyof OperatingHoursConfig["days"]> = {
      monday: "monday",
      tuesday: "tuesday",
      wednesday: "wednesday",
      thursday: "thursday",
      friday: "friday",
      saturday: "saturday",
      sunday: "sunday",
    };

    const dayKey = dayKeyMap[weekdayStr];
    const dayCfg = dayKey ? activeConfig.days?.[dayKey] : null;

    if (!dayCfg || !dayCfg.enabled) {
      return { isOpen: false, isDisabled: false, statusText: "🔴 Sedang Tutup" };
    }

    const curH = parseInt(hourStr, 10);
    const curM = parseInt(minuteStr, 10);
    const currMin = curH * 60 + curM;

    const [openH, openM] = dayCfg.open.split(":").map((v) => parseInt(v, 10));
    const [closeH, closeM] = dayCfg.close.split(":").map((v) => parseInt(v, 10));

    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;

    if (currMin >= openMin && currMin < closeMin) {
      return { isOpen: true, isDisabled: false, statusText: "🟢 Sedang Buka" };
    } else {
      return { isOpen: false, isDisabled: false, statusText: "🔴 Sedang Tutup" };
    }
  } catch (e) {
    console.error("[getOperatingStatus] Error formatting date:", e);
    return { isOpen: false, isDisabled: false, statusText: "🔴 Sedang Tutup" };
  }
}

/**
 * Validates whether a URL is a valid Telegram HTTPS URL.
 * Accepts formats like https://t.me/username or https://telegram.me/username.
 * Rejects http://, javascript:, data:, and unrelated domains.
 */
export function isValidTelegramUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "t.me" && parsed.hostname !== "telegram.me") return false;
    if (!parsed.pathname || parsed.pathname.length <= 1) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a specific referral tier (by minAcc) has already been claimed for a referral.
 */
export function isReferralTierClaimed(
  referral?: Partial<Referral> | null,
  minAcc?: number,
  referralTiers?: ReferralTierConfig[]
): boolean {
  if (!referral || typeof minAcc !== "number") return false;
  const key = String(minAcc);
  if (referral.claimedTiers && typeof referral.claimedTiers[key] === "boolean") {
    return referral.claimedTiers[key];
  }
  // Fallback for legacy PAID referrals created before per-tier tracking
  if ((referral.status === "PAID" || referral.status === "REWARDED") && (!referral.claimedTiers || Object.keys(referral.claimedTiers).length === 0)) {
    const acc = referral.currentAccCount ?? 0;
    const tierReward = getReferralRewardForAccCount(minAcc, referralTiers);
    const paidReward = referral.rewardAmount ?? 0;
    if (acc >= minAcc && tierReward > 0 && paidReward >= tierReward) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a specific referral tier (by minAcc) is eligible to be claimed for a referral.
 */
export function isReferralTierClaimable(
  referral?: Partial<Referral> | null,
  minAcc?: number,
  referralTiers?: ReferralTierConfig[]
): boolean {
  if (!referral || typeof minAcc !== "number") return false;
  if (referral.status === "REJECTED") return false;
  const acc = referral.currentAccCount ?? 0;
  if (acc < minAcc) return false;
  return !isReferralTierClaimed(referral, minAcc, referralTiers);
}

/**
 * Returns total reward for a given ACC count based on highest reached tier.
 */
export function getReferralRewardForAccCount(accCount: number, referralTiers?: ReferralTierConfig[]): number {
  const activeTiers = Array.isArray(referralTiers) && referralTiers.length > 0 ? referralTiers : DEFAULT_REFERRAL_TIERS;
  const count = Math.max(0, accCount);
  const sorted = [...activeTiers].sort((a, b) => a.minAcc - b.minAcc);

  let reward = 0;
  for (const t of sorted) {
    if (count >= t.minAcc) {
      reward = t.reward;
    }
  }
  return reward;
}

/**
 * Returns the highest qualified referral tier for a given ACC count, or null if below lowest tier.
 */
export function getReferralTierForAccCount(accCount: number, referralTiers?: ReferralTierConfig[]): ReferralTierConfig | null {
  const activeTiers = Array.isArray(referralTiers) && referralTiers.length > 0 ? referralTiers : DEFAULT_REFERRAL_TIERS;
  const count = Math.max(0, accCount);
  const sorted = [...activeTiers].sort((a, b) => a.minAcc - b.minAcc);

  let matched: ReferralTierConfig | null = null;
  for (const t of sorted) {
    if (count >= t.minAcc) {
      matched = t;
    }
  }
  return matched;
}

/**
 * Returns the next referral tier that has not been reached yet, or null if highest tier reached.
 */
export function getNextReferralTierForAccCount(accCount: number, referralTiers?: ReferralTierConfig[]): ReferralTierConfig | null {
  const activeTiers = Array.isArray(referralTiers) && referralTiers.length > 0 ? referralTiers : DEFAULT_REFERRAL_TIERS;
  const count = Math.max(0, accCount);
  const sorted = [...activeTiers].sort((a, b) => a.minAcc - b.minAcc);

  for (const t of sorted) {
    if (count < t.minAcc) {
      return t;
    }
  }
  return null;
}

/**
 * Validates a list of ReferralTierConfigs.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateReferralTiers(tiers: ReferralTierConfig[]): string | null {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return "Konfigurasi tier referral tidak boleh kosong.";
  }

  const seenMinAcc = new Set<number>();
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (typeof t.minAcc !== "number" || !Number.isInteger(t.minAcc) || t.minAcc <= 0) {
      return `Syarat minimal ACC (baris ke-${i + 1}) harus berupa bilangan bulat positif (minimal 1).`;
    }
    if (typeof t.reward !== "number" || isNaN(t.reward) || t.reward < 0) {
      return `Hadiah reward (baris ke-${i + 1}) tidak boleh negatif.`;
    }
    if (seenMinAcc.has(t.minAcc)) {
      return `Ditemukan syarat minimal ACC ganda: ${t.minAcc} ACC.`;
    }
    seenMinAcc.add(t.minAcc);
  }

  const sorted = [...tiers].sort((a, b) => a.minAcc - b.minAcc);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].reward < sorted[i - 1].reward) {
      return `Hadiah reward untuk ${sorted[i].minAcc} ACC (${sorted[i].reward}) tidak boleh lebih kecil dari tier ${sorted[i - 1].minAcc} ACC (${sorted[i - 1].reward}).`;
    }
  }

  return null;
}

/**
 * Returns a YYYY-MM-DD date key string in local/Indonesian timezone.
 */
export function getDailyPeriodKey(inputDate?: Date | unknown): string {
  const date = inputDate instanceof Timestamp ? inputDate.toDate() : inputDate instanceof Date ? inputDate : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns a ISO YYYY-Www week period key string (e.g. 2026-W34).
 */
export function getWeeklyPeriodKey(inputDate?: Date | unknown): string {
  const date = inputDate instanceof Timestamp ? inputDate.toDate() : inputDate instanceof Date ? new Date(inputDate as Date) : new Date();
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Monday = 0
  target.setDate(target.getDate() - dayNr + 3); // Thursday of same week
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Returns the start date (00:00:00) and end date (23:59:59.999) of the current day.
 */
export function getStartAndEndOfDay(inputDate?: Date): { start: Date; end: Date } {
  const base = inputDate ? new Date(inputDate) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/**
 * Returns the start date (Monday 00:00:00) and end date (Sunday 23:59:59.999) of the current week.
 */
export function getStartAndEndOfWeek(inputDate?: Date): { start: Date; end: Date } {
  const base = inputDate ? new Date(inputDate) : new Date();
  const day = base.getDay();
  const diffToMon = (day === 0 ? -6 : 1) - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/**
 * Calculates valid ACC (approved) email count for a worker within a time window.
 */
export function getWorkerAccInPeriod(
  submissions: EmailSubmission[],
  startDate: Date,
  endDate: Date,
  workerId?: string,
): number {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  return submissions.reduce((sum, sub) => {
    if (workerId && sub.workerId !== workerId) return sum;

    let subDate: Date | null = null;
    if (sub.submittedAt) {
      subDate = sub.submittedAt instanceof Timestamp ? sub.submittedAt.toDate() : new Date(sub.submittedAt as string | number);
    }
    if (!subDate || isNaN(subDate.getTime())) return sum;

    const t = subDate.getTime();
    if (t < startMs || t > endMs) return sum;

    const isFinalized = sub.status === "approved" || sub.status === "available" || sub.status === "sold";
    if (!isFinalized) return sum;

    let approvedCount = 0;
    if (typeof sub.approvedItemCount === "number") {
      approvedCount = sub.approvedItemCount;
    } else if (Array.isArray(sub.items) && sub.items.length > 0) {
      approvedCount = sub.items.filter((i) => i.status === "approved").length;
    } else if (sub.email) {
      approvedCount = 1;
    }

    return sum + approvedCount;
  }, 0);
}

/**
 * Validates a submitted password against password format rules found in submission notes.
 * Returns an error string in Indonesian if validation fails, or null if valid.
 */
export function validatePasswordAgainstRules(password: string, submissionNotes: string[] = []): string | null {
  if (!password || password.trim().length === 0) {
    return "Kata sandi akun tidak boleh kosong.";
  }

  const allNotesText = submissionNotes.join("\n");

  const minLengthMatch = allNotesText.match(/min(?:imal)?\.?\s*(\d+)\s*karakter/i) || allNotesText.match(/(\d+)\s*karakter/i);
  let requiredMinLength = 6;
  if (minLengthMatch && minLengthMatch[1]) {
    const parsedMin = parseInt(minLengthMatch[1], 10);
    if (!isNaN(parsedMin) && parsedMin > 0) {
      requiredMinLength = parsedMin;
    }
  }

  if (password.length < requiredMinLength) {
    return `Kata sandi harus terdiri dari minimal ${requiredMinLength} karakter.`;
  }

  if (/huruf besar|kapital|uppercase/i.test(allNotesText) && !/[A-Z]/.test(password)) {
    return "Kata sandi harus mengandung minimal satu huruf kapital (A-Z).";
  }

  if (/huruf kecil|lowercase/i.test(allNotesText) && !/[a-z]/.test(password)) {
    return "Kata sandi harus mengandung minimal satu huruf kecil (a-z).";
  }

  if (/(?:mengandung|dengan|ada)\s*angka|number/i.test(allNotesText) && !/\d/.test(password)) {
    return "Kata sandi harus mengandung minimal satu angka (0-9).";
  }

  if (/simbol|karakter khusus|special character/i.test(allNotesText) && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "Kata sandi harus mengandung minimal satu karakter khusus/simbol.";
  }

  return null;
}
