// @vitest-environment happy-dom
import { render, cleanup } from "@testing-library/react";
import WorkerDashboard from "./worker-dashboard";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent } from "@testing-library/react";

const mockAnnouncementsData = [
  { id: "notif-1", title: "Update Jam Operasional", content: "Jam operasional disesuaikan.", badge: "PENTING", createdAt: new Date() },
  { id: "notif-2", title: "Penarikan Saldo Lancar", content: "Pencairan saldo DANA normal.", badge: "INFO", createdAt: new Date() },
];

vi.mock("@/hooks/use-portal", () => ({
  useWorkerData: () => ({ submissions: { data: [], loading: false }, withdrawals: { data: [], loading: false } }),
  useWorkerEngagementData: () => ({ referrals: { data: [] }, referralClaims: { data: [] }, rewardLedger: { data: [] } }),
  useReferralTransactions: () => ({ data: [], loading: false }),
  useDownlineWorkers: () => ({ data: [], loading: false }),
  useSettings: (name: string, initial: any) => {
    if (name === "maintenance") {
      return { data: (globalThis as any).__mockMaintenance ?? { enabled: false, message: "" }, loading: false };
    }
    return { data: initial, loading: false };
  },
  useMyReferral: () => ({ data: null }),
  useAnnouncements: () => ({ data: mockAnnouncementsData, loading: false }),
  useWorkerChat: () => ({ conversation: null, loading: false }),
  useConversationMessages: () => ({ messages: [], loading: false }),
  claimReferralCode: vi.fn(),
  claimReferralReward: vi.fn(),
  createSubmission: vi.fn(),
  createWithdrawal: vi.fn(),
  markConversationAsRead: vi.fn(),
  deleteMessageForMe: vi.fn(),
  deleteMessageForAll: vi.fn(),
}));

import { MaintenanceScreen } from "@/components/MaintenanceScreen";

describe("WorkerDashboard Maintenance Mode", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders notification bell badge and opens dropdown menu with clear/delete options", () => {
    (globalThis as any).__mockMaintenance = { enabled: false, message: "" };
    const profile: any = { uid: "w1", name: "Worker", role: "worker", balance: 100000 };
    const { getByTestId, queryByTestId, getByText, queryByText, getAllByText } = render(<WorkerDashboard profile={profile} onLogout={() => {}} />);

    // Notification badge shows unread announcements
    const bellBtn = getByTestId("notification-bell-btn");
    expect(bellBtn).toBeTruthy();
    expect(bellBtn.textContent).toContain("2");

    // Click bell to open dropdown
    fireEvent.click(bellBtn);
    expect(getByText("Pemberitahuan")).toBeTruthy();
    expect(getAllByText("Update Jam Operasional").length).toBeGreaterThan(0);
    expect(getByText("Penarikan Saldo Lancar")).toBeTruthy();

    // Delete single notification
    const deleteBtn1 = getByTestId("delete-notif-notif-1");
    fireEvent.click(deleteBtn1);

    // Badge updates to 1 and deleted notification item is removed from dropdown
    expect(bellBtn.textContent).toContain("1");
    expect(queryByTestId("delete-notif-notif-1")).toBeNull();

    // Click clear all notifications button
    const clearAllBtn = getByTestId("clear-all-notifs-btn");
    fireEvent.click(clearAllBtn);

    // Notification count becomes 0, badge removed and empty state displayed
    expect(bellBtn.textContent).not.toContain("1");
    expect(getByText("Belum Ada Notifikasi")).toBeTruthy();
  });

  it("renders maintenance screen when maintenance.enabled is true and role is worker", () => {
    (globalThis as any).__mockMaintenance = { enabled: true, message: "Maintenance test", targetEndTime: "2026-12-31T23:59:59Z" };
    const profile: any = { uid: "w1", name: "Worker", role: "worker", balance: 0 };
    const { getByText } = render(<WorkerDashboard profile={profile} onLogout={() => {}} />);
    expect(getByText("Sistem Sedang Dalam Perbaikan")).toBeTruthy();
    expect(getByText("Maintenance test")).toBeTruthy();
  });

  it("handles missing or invalid targetEndTime gracefully without breaking UI", () => {
    const { getAllByText, getByText } = render(
      <MaintenanceScreen maintenance={{ enabled: true, message: "Server Upgrade", targetEndTime: "invalid-date" }} />
    );
    expect(getAllByText("Sistem Sedang Dalam Perbaikan")[0]).toBeTruthy();
    expect(getByText("Server Upgrade")).toBeTruthy();
    expect(getByText("Dalam Perbaikan")).toBeTruthy();
  });
});
