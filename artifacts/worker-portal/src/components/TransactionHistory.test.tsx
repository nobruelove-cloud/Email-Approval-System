// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { TransactionHistory, type TransactionItem } from "./TransactionHistory";

describe("TransactionHistory Component", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTransactions: TransactionItem[] = Array.from({ length: 15 }, (_, i) => {
    const isCredit = i % 2 === 0;
    const status = i % 3 === 0 ? "success" : i % 3 === 1 ? "pending" : "rejected";
    return {
      id: `tx-${i + 1}`,
      date: new Date(2025, 2, 1, 10, i).toISOString(),
      type: isCredit ? "Bonus Referral" : "Penarikan Saldo",
      description: isCredit ? "Bonus referral downline" : "DANA · 08123456789 (a.n. Worker)",
      amount: (i + 1) * 10000,
      isCredit,
      status,
      note: i === 2 ? "Rekening tidak valid" : undefined,
    };
  });

  it("renders transaction history header, status filter pills, and pagination indicator", () => {
    render(<TransactionHistory transactions={mockTransactions} />);

    expect(screen.getByText("Riwayat Transaksi")).toBeTruthy();
    expect(screen.getByText("Semua (15)")).toBeTruthy();
    expect(screen.getByText("Berhasil (5)")).toBeTruthy();
    expect(screen.getByText("Pending (5)")).toBeTruthy();
    expect(screen.getByText("Ditolak (5)")).toBeTruthy();

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 2");
  });

  it("filters transactions when status filter pills are clicked", () => {
    render(<TransactionHistory transactions={mockTransactions} />);

    const approvedBtn = screen.getByText("Berhasil (5)");
    fireEvent.click(approvedBtn);

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 1");

    const pendingBtn = screen.getByText("Pending (5)");
    fireEvent.click(pendingBtn);
    expect(indicator.textContent).toContain("Page 1 of 1");

    const rejectedBtn = screen.getByText("Ditolak (5)");
    fireEvent.click(rejectedBtn);
    expect(indicator.textContent).toContain("Page 1 of 1");
  });

  it("filters transactions by search query input", () => {
    render(<TransactionHistory transactions={mockTransactions} />);

    const searchInput = screen.getByPlaceholderText("Cari transaksi / ID...");
    fireEvent.change(searchInput, { target: { value: "tx-3" } });

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 1");
    expect(screen.getAllByText(/Rekening tidak valid/).length).toBeGreaterThan(0);
  });

  it("navigates pages using Next and Previous buttons", () => {
    render(<TransactionHistory transactions={mockTransactions} />);

    const indicator = screen.getByTestId("pagination-page-indicator");
    expect(indicator.textContent).toContain("Page 1 of 2");

    const nextBtn = screen.getByText("Next");
    fireEvent.click(nextBtn);

    expect(indicator.textContent).toContain("Page 2 of 2");

    const prevBtn = screen.getByText("Previous");
    fireEvent.click(prevBtn);

    expect(indicator.textContent).toContain("Page 1 of 2");
  });

  it("displays correct color-coded signs and amounts for credit vs debit", () => {
    render(<TransactionHistory transactions={mockTransactions.slice(0, 2)} />);

    // Credit item (+ Rp 10.000)
    expect(screen.getAllByText(/\+\s*Rp\s*10\.000/).length).toBeGreaterThan(0);
    // Debit item (- Rp 20.000)
    expect(screen.getAllByText(/-\s*Rp\s*20\.000/).length).toBeGreaterThan(0);
  });

  it("renders empty state message when no transactions exist", () => {
    render(<TransactionHistory transactions={[]} />);

    expect(screen.getByText("Belum Ada Riwayat Transaksi")).toBeTruthy();
  });
});
