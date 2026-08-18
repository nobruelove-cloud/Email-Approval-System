export type Role = "admin" | "worker";
export type UserStatus = "pending" | "approved" | "active" | "rejected" | "inactive";
export type UserTier = number;
export type SubmissionStatus = "pending" | "approved" | "available" | "sold" | "rejected";
export type WithdrawalStatus = "pending" | "processing" | "success" | "rejected";

export type TierConfig = {
  tier: number;
  name: string;
  minQty: number;
  maxQty: number;
  pricePerItem: number;
};

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

export type EmailBatchItem = {
  email: string;
  password?: string;
};

export type EmailSubmission = {
  id: string;
  workerId: string;
  workerName?: string;
  // Legacy / single email support
  email?: string;
  password?: string;
  // Batch submission support
  items?: EmailBatchItem[];
  itemCount?: number;
  // Snapshot/info at submission time
  currentTier?: number;
  currentPricePerItem?: number;
  // Snapshot saved upon approval
  appliedTier?: number;
  appliedPricePerItem?: number;
  totalAmount?: number;

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
  tiers: TierConfig[];
  updatedAt?: unknown;
};

export const DEFAULT_TIERS: TierConfig[] = [
  { tier: 1, name: "Tier 1", minQty: 1, maxQty: 3, pricePerItem: 2000 },
  { tier: 2, name: "Tier 2", minQty: 4, maxQty: 10, pricePerItem: 2500 },
  { tier: 3, name: "Tier 3", minQty: 11, maxQty: 999999, pricePerItem: 3000 },
];

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
  tiers: DEFAULT_TIERS,
};
