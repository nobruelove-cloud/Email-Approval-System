export interface Announcement {
  id: string;
  title: string;
  content: string;
  badge?: string; // e.g., "BARU", "IMPORTANT", "INFO"
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  createdBy: string; // Admin UID
  isActive: boolean;
}

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
  referredBy?: string;
  createdAt?: unknown;
};

export type ReferralStatus = "PENDING" | "QUALIFIED" | "REWARDED" | "PAID" | "REJECTED";

export type Referral = {
  id: string; // e.g. referredWorkerId
  referrerId: string;
  referrerName?: string;
  referredWorkerId: string;
  referredWorkerName?: string;
  currentAccCount?: number;
  status: ReferralStatus;
  createdAt?: unknown;
  qualifiedAt?: unknown;
  rewardedAt?: unknown;
  rewardAmount?: number;
  reviewNote?: string;
  claimedTiers?: Record<string, boolean>;
};

export type ReferralClaimStatus = "pending" | "approved" | "rejected";

export type ReferralClaim = {
  id: string;
  referralId: string;
  referrerId: string;
  referredWorkerId: string;
  minAcc: number;
  rewardAmount: number;
  status: ReferralClaimStatus;
  requestedAt?: unknown;
  processedAt?: unknown;
  note?: string;
};

export type MissionType = "daily" | "weekly";

export type MissionConfig = {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  targetAccCount: number;
  rewardAmount: number;
  enabled: boolean;
};

export type MissionClaim = {
  id: string; // `${workerId}_${missionId}_${periodKey}`
  workerId: string;
  missionId: string;
  periodKey: string;
  status?: "pending" | "approved" | "rejected";
  rewardAmount: number;
  claimedAt?: unknown;
};

export type LeaderboardRewardConfig = {
  rank: number;
  rewardAmount: number;
};

export type LeaderboardPayout = {
  id: string; // `${periodKey}_rank${rank}_${workerId}`
  workerId: string;
  workerName?: string;
  periodKey: string;
  rank: number;
  validAccCount: number;
  rewardAmount: number;
  paidAt?: unknown;
};

export type RewardType = "referral" | "mission" | "leaderboard";

export type RewardLedgerEntry = {
  id: string;
  workerId: string;
  workerName?: string;
  rewardType: RewardType;
  amount: number;
  sourceRefId: string;
  description: string;
  createdAt?: unknown;
};

export type FinancialTransactionType = "income" | "expense";

export type FinancialTransaction = {
  id: string;
  type: FinancialTransactionType;
  amount: number;
  description: string;
  note?: string;
  transactionDate: unknown;
  period: string; // "YYYY-MM"
  createdAt?: unknown;
  createdBy?: string;
};

export type EmailItemStatus = "pending" | "approved" | "rejected";

export type EmailBatchItem = {
  email: string;
  password?: string;
  status?: EmailItemStatus;
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
  approvedItemCount?: number;
  rejectedItemCount?: number;
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

export type MethodFeeType = "free" | "fixed" | "percentage";

export type PaymentMethodFeeConfig = {
  method: string;
  category?: "bank" | "ewallet" | "other";
  enabled: boolean;
  feeType: MethodFeeType;
  feeValue: number; // e.g. 0 for free, 1000 for fixed Rp 1.000, 1.5 for 1.5%
};

export type WithdrawalSettings = {
  minWithdraw: number;
  maxWithdraw: number;
  methods: PaymentMethodFeeConfig[];
  updatedAt?: unknown;
};

export const DEFAULT_PAYMENT_METHOD_FEES: PaymentMethodFeeConfig[] = [
  { method: "BCA", category: "bank", enabled: true, feeType: "fixed", feeValue: 2500 },
  { method: "BRI", category: "bank", enabled: true, feeType: "fixed", feeValue: 2500 },
  { method: "BNI", category: "bank", enabled: true, feeType: "fixed", feeValue: 2500 },
  { method: "Mandiri", category: "bank", enabled: true, feeType: "fixed", feeValue: 2500 },
  { method: "DANA", category: "ewallet", enabled: true, feeType: "free", feeValue: 0 },
  { method: "OVO", category: "ewallet", enabled: true, feeType: "percentage", feeValue: 1.5 },
  { method: "GoPay", category: "ewallet", enabled: true, feeType: "free", feeValue: 0 },
  { method: "ShopeePay", category: "ewallet", enabled: true, feeType: "fixed", feeValue: 1000 },
];

export const DEFAULT_WITHDRAWAL_SETTINGS: WithdrawalSettings = {
  minWithdraw: 50000,
  maxWithdraw: 5000000,
  methods: DEFAULT_PAYMENT_METHOD_FEES,
};

export type Withdrawal = {
  id: string;
  workerId: string;
  amount: number;
  method: string;
  account: string;
  accountName?: string;
  accountHolderName?: string;
  fee?: number;
  netAmount?: number;
  status: WithdrawalStatus;
  requestedAt?: unknown;
  processedAt?: unknown;
  note?: string;
};

export type ReferralTierConfig = {
  minAcc: number;
  reward: number;
};

export type SupportConfig = {
  enabled: boolean;
  title: string;
  description: string;
  telegramUrl: string;
};

export type DayOperatingHours = {
  enabled: boolean;
  open: string;
  close: string;
};

export type OperatingHoursConfig = {
  enabled: boolean;
  timezone: string;
  days: {
    monday: DayOperatingHours;
    tuesday: DayOperatingHours;
    wednesday: DayOperatingHours;
    thursday: DayOperatingHours;
    friday: DayOperatingHours;
    saturday: DayOperatingHours;
    sunday: DayOperatingHours;
  };
};

export const DEFAULT_OPERATING_HOURS: OperatingHoursConfig = {
  enabled: true,
  timezone: "Asia/Jakarta",
  days: {
    monday: { enabled: true, open: "08:00", close: "18:00" },
    tuesday: { enabled: true, open: "08:00", close: "18:00" },
    wednesday: { enabled: true, open: "08:00", close: "18:00" },
    thursday: { enabled: true, open: "08:00", close: "18:00" },
    friday: { enabled: true, open: "08:00", close: "18:00" },
    saturday: { enabled: false, open: "08:00", close: "18:00" },
    sunday: { enabled: false, open: "08:00", close: "18:00" },
  },
};

export const DEFAULT_REFERRAL_TIERS: ReferralTierConfig[] = [
  { minAcc: 5, reward: 500 },
  { minAcc: 10, reward: 1000 },
  { minAcc: 20, reward: 2000 },
  { minAcc: 50, reward: 5000 },
];

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

  // Referral Settings
  referralEnabled?: boolean;
  referralReward?: number;
  referralMinAcc?: number;
  referralMinEarnings?: number;
  referralTiers?: ReferralTierConfig[];

  // Mission Settings
  missions?: MissionConfig[];

  // Leaderboard Settings
  leaderboardEnabled?: boolean;
  leaderboardRewards?: LeaderboardRewardConfig[];

  // Reward Budget Settings
  rewardBudgetEnabled?: boolean;
  rewardBudget?: number;

  // Support / Help Center Settings
  supportConfig?: SupportConfig;

  // Operating Hours Settings
  operatingHours?: OperatingHoursConfig;

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

  referralEnabled: true,
  referralReward: 500,
  referralMinAcc: 5,
  referralMinEarnings: 0,
  referralTiers: DEFAULT_REFERRAL_TIERS,

  missions: [
    {
      id: "daily_acc_3",
      type: "daily",
      title: "Setor 3 Email ACC",
      description: "Capai 3 email ACC/terjual hari ini",
      targetAccCount: 3,
      rewardAmount: 3000,
      enabled: true,
    },
    {
      id: "weekly_acc_15",
      type: "weekly",
      title: "Pahlawan Mingguan",
      description: "Capai 15 email ACC/terjual minggu ini",
      targetAccCount: 15,
      rewardAmount: 15000,
      enabled: true,
    },
  ],

  leaderboardEnabled: true,
  leaderboardRewards: [
    { rank: 1, rewardAmount: 50000 },
    { rank: 2, rewardAmount: 30000 },
    { rank: 3, rewardAmount: 15000 },
  ],

  rewardBudgetEnabled: false,
  rewardBudget: 1000000,

  supportConfig: {
    enabled: true,
    title: "Pusat Bantuan",
    description: "Ada kendala? Hubungi Customer Service kami melalui Telegram.",
    telegramUrl: "",
  },

  operatingHours: DEFAULT_OPERATING_HOURS,
};
