export type Role = "admin" | "worker";
export type UserStatus = "pending" | "approved" | "rejected" | "inactive";
export type UserTier = 1 | 2 | 3;
export type SubmissionStatus = "pending" | "approved" | "available" | "sold" | "rejected";
export type WithdrawalStatus = "pending" | "processing" | "success" | "rejected";

export type PortalUser = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  tier: UserTier;
  balance: number;
  createdAt?: unknown;
};

export type EmailSubmission = {
  id: string;
  workerId: string;
  email: string;
  password: string;
  status: SubmissionStatus;
  submittedAt?: unknown;
  reviewedAt?: unknown;
  reviewNote?: string;
  soldAt?: unknown;
  updatedAt?: unknown;
};

export type Withdrawal = {
  id: string;
  workerId: string;
  amount: number;
  method: string;
  account: string;
  accountName?: string;
  status: WithdrawalStatus;
  requestedAt?: unknown;
  processedAt?: unknown;
  note?: string;
};

// Stored at settings/rules in Firestore. Editable from the admin dashboard,
// read live everywhere via useSettings("rules", DEFAULT_RULES).
export type PortalRules = {
  pricePerEmail: number;
  minWithdraw: number;
  maxWithdraw: number;
  withdrawFeePercent: number;
  paymentMethods: string[];
  submissionNotes: string[];
  updatedAt?: unknown;
};

export const DEFAULT_RULES: PortalRules = {
  pricePerEmail: 2000,
  minWithdraw: 50000,
  maxWithdraw: 5000000,
  withdrawFeePercent: 0,
  paymentMethods: ["DANA", "OVO", "GoPay", "ShopeePay", "Bank Transfer"],
  submissionNotes: [
    "Pastikan seluruh email yang dimasukkan berstatus aktif.",
    "Gunakan satu kata sandi yang sama untuk seluruh email dalam satu kali kirim.",
    "Satu email per baris.",
    "Proses verifikasi memerlukan waktu maksimal 1x24 jam.",
  ],
};