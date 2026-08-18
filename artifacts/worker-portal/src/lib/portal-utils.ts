import { Timestamp } from "firebase/firestore";
import { DEFAULT_TIERS, type EmailSubmission, type TierConfig } from "./portal-types";

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
