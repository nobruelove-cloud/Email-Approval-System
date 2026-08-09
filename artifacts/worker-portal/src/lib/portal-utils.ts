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