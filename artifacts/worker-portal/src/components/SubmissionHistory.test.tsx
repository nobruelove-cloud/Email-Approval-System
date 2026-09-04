// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SubmissionHistory } from "./SubmissionHistory";
import { DEFAULT_RULES, type EmailSubmission } from "@/lib/portal-types";

describe("SubmissionHistory Component", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSubmissions: EmailSubmission[] = Array.from({ length: 15 }, (_, i) => ({
    id: `sub-${i + 1}`,
    workerId: "w1",
    workerName: "Worker One",
    items: [
      { email: `test${i + 1}@example.com`, password: "pass", status: i % 3 === 0 ? "approved" : i % 3 === 1 ? "pending" : "rejected" },
    ],
    itemCount: 1,
    approvedItemCount: i % 3 === 0 ? 1 : 0,
    rejectedItemCount: i % 3 === 2 ? 1 : 0,
    currentTier: 1,
    currentPricePerItem: 2000,
    appliedTier: 1,
    appliedPricePerItem: 2000,
    totalAmount: i % 3 === 0 ? 2000 : 0,
    status: i % 3 === 0 ? "approved" : i % 3 === 1 ? "pending" : "rejected",
    submittedAt: new Date(2025, 2, 1, 10, i).toISOString(),
    reviewNote: i === 2 ? "Format salah" : undefined,
  }));

  it("renders submission history list with status count badges", () => {
    const handleViewDetail = vi.fn();
    render(
      <SubmissionHistory
        submissions={mockSubmissions}
        rules={DEFAULT_RULES}
        userTier={1}
        onViewDetail={handleViewDetail}
      />
    );

    expect(screen.getByText("Riwayat Storan Email")).toBeTruthy();
    expect(screen.getByText("Semua (15)")).toBeTruthy();
    expect(screen.getByText("ACC / Terjual (5)")).toBeTruthy();
    expect(screen.getByText("Pending (5)")).toBeTruthy();
    expect(screen.getByText("Ditolak (5)")).toBeTruthy();

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 2");
  });

  it("filters submissions when quick filter pill is clicked", () => {
    render(
      <SubmissionHistory
        submissions={mockSubmissions}
        rules={DEFAULT_RULES}
        userTier={1}
        onViewDetail={() => {}}
      />
    );

    const approvedBtn = screen.getByText("ACC / Terjual (5)");
    fireEvent.click(approvedBtn);

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 1");
    expect(screen.getByText(/Menampilkan/)).toBeTruthy();
  });

  it("filters submissions by search query", () => {
    render(
      <SubmissionHistory
        submissions={mockSubmissions}
        rules={DEFAULT_RULES}
        userTier={1}
        onViewDetail={() => {}}
      />
    );

    const searchInput = screen.getByPlaceholderText("Cari ID / email...");
    fireEvent.change(searchInput, { target: { value: "test1@example.com" } });

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 1");
  });

  it("navigates pages using Next and Previous buttons", () => {
    render(
      <SubmissionHistory
        submissions={mockSubmissions}
        rules={DEFAULT_RULES}
        userTier={1}
        onViewDetail={() => {}}
      />
    );

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 2");

    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);

    expect(indicator.textContent).toContain("Page 2 of 2");

    const prevBtn = screen.getByText("Previous");
    fireEvent.click(prevBtn);

    expect(indicator.textContent).toContain("Page 1 of 2");
  });

  it("toggles expandable detail card on mobile view", () => {
    render(
      <SubmissionHistory
        submissions={mockSubmissions.slice(0, 2)}
        rules={DEFAULT_RULES}
        userTier={1}
        onViewDetail={() => {}}
      />
    );

    const toggleBtns = screen.getAllByTitle("Tampilkan detail");
    expect(toggleBtns.length).toBeGreaterThan(0);

    fireEvent.click(toggleBtns[0]);

    // Card expand should reveal additional details inside expanded card
    const viewBtns = screen.getAllByText("Lihat Email");
    expect(viewBtns.length).toBeGreaterThan(1);
  });

  it("calls onViewDetail when 'Lihat Email' button is clicked", () => {
    const handleViewDetail = vi.fn();
    render(
      <SubmissionHistory
        submissions={mockSubmissions.slice(0, 1)}
        rules={DEFAULT_RULES}
        userTier={1}
        onViewDetail={handleViewDetail}
      />
    );

    const viewBtns = screen.getAllByText("Lihat Email");
    const targetBtn = viewBtns[0].closest("button")!;
    fireEvent.click(targetBtn);

    expect(handleViewDetail).toHaveBeenCalledWith(mockSubmissions[0]);
  });
});
