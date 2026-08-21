import { Timestamp } from "firebase/firestore";
import { DEFAULT_TIERS, DEFAULT_REFERRAL_TIERS, type EmailSubmission, type TierConfig, type ReferralTierConfig } from "./portal-types";

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
