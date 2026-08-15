import { Timestamp } from "firebase/firestore";

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
 * Validates a submitted password against password format rules found in submission notes.
 * Returns an error string in Indonesian if validation fails, or null if valid.
 */
export function validatePasswordAgainstRules(password: string, submissionNotes: string[] = []): string | null {
  if (!password || password.trim().length === 0) {
    return "Kata sandi akun tidak boleh kosong.";
  }

  const allNotesText = submissionNotes.join("\n");

  // Check for explicit min length rule in notes (e.g., "Minimal 8 karakter", "Kata sandi min. 10 karakter")
  const minLengthMatch = allNotesText.match(/min(?:imal)?\.?\s*(\d+)\s*karakter/i) || allNotesText.match(/(\d+)\s*karakter/i);
  let requiredMinLength = 6; // default minimum length for password safety
  if (minLengthMatch && minLengthMatch[1]) {
    const parsedMin = parseInt(minLengthMatch[1], 10);
    if (!isNaN(parsedMin) && parsedMin > 0) {
      requiredMinLength = parsedMin;
    }
  }

  if (password.length < requiredMinLength) {
    return `Kata sandi harus terdiri dari minimal ${requiredMinLength} karakter.`;
  }

  // Check for uppercase letter requirement if mentioned in notes
  if (/huruf besar|kapital|uppercase/i.test(allNotesText) && !/[A-Z]/.test(password)) {
    return "Kata sandi harus mengandung minimal satu huruf kapital (A-Z).";
  }

  // Check for lowercase letter requirement if mentioned in notes
  if (/huruf kecil|lowercase/i.test(allNotesText) && !/[a-z]/.test(password)) {
    return "Kata sandi harus mengandung minimal satu huruf kecil (a-z).";
  }

  // Check for number requirement if mentioned in notes
  if (/(?:mengandung|dengan|ada)\s*angka|number/i.test(allNotesText) && !/\d/.test(password)) {
    return "Kata sandi harus mengandung minimal satu angka (0-9).";
  }

  // Check for special symbol requirement if mentioned in notes
  if (/simbol|karakter khusus|special character/i.test(allNotesText) && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return "Kata sandi harus mengandung minimal satu karakter khusus/simbol.";
  }

  return null;
}
