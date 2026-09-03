import { render } from "@testing-library/react";
import WorkerDashboard from "./worker-dashboard";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/hooks/use-portal", () => ({
  useWorkerData: () => ({ submissions: { data: [], loading: false }, withdrawals: { data: [], loading: false } }),
  useWorkerEngagementData: () => ({ referrals: { data: [] }, referralClaims: { data: [] }, rewardLedger: { data: [] } }),
  useSettings: (name: string, initial: any) => {
    if (name === "maintenance") {
      return { data: { enabled: true, message: "Maintenance test", targetEndTime: "2026-12-31T23:59:59Z" }, loading: false };
    }
    return { data: initial, loading: false };
  },
  useMyReferral: () => ({ data: null }),
  useAnnouncements: () => ({ data: [], loading: false }),
  claimReferralCode: vi.fn(),
  claimReferralReward: vi.fn(),
  createSubmission: vi.fn(),
  createWithdrawal: vi.fn(),
}));

describe("WorkerDashboard Maintenance Mode", () => {
  it("renders maintenance screen when maintenance.enabled is true and role is worker", () => {
    const profile: any = { uid: "w1", name: "Worker", role: "worker", balance: 0 };
    const { getByText } = render(<WorkerDashboard profile={profile} onLogout={() => {}} />);
    expect(getByText("Sistem Sedang Dalam Perbaikan / Maintenance")).toBeTruthy();
    expect(getByText("Maintenance test")).toBeTruthy();
  });
});
