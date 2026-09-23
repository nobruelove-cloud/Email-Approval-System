// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MessageManager, type EmailMessageItem } from "./MessageManager";

describe("MessageManager", () => {
  afterEach(() => {
    cleanup();
  });

  const sampleMessages: EmailMessageItem[] = [
    {
      id: "m1",
      email: "test1@gmail.com",
      subject: "Pesan Pertama",
      sender: "Sender 1",
      date: new Date(),
      snippet: "Isi pesan 1",
      category: "setoran",
    },
    {
      id: "m2",
      email: "test2@gmail.com",
      subject: "Pesan Kedua",
      sender: "Sender 2",
      date: new Date(),
      snippet: "Isi pesan 2",
      category: "admin",
    },
  ];

  it("renders messages list correctly", () => {
    render(<MessageManager initialMessages={sampleMessages} />);
    expect(screen.getByText("Pesan Pertama")).toBeTruthy();
    expect(screen.getByText("Pesan Kedua")).toBeTruthy();
  });

  it("deletes individual message item on Trash icon click", () => {
    const handleChange = vi.fn();
    render(<MessageManager initialMessages={sampleMessages} onMessagesChange={handleChange} />);

    const trashButtons = screen.getAllByTitle("Hapus Pesan Ini");
    expect(trashButtons.length).toBe(2);

    fireEvent.click(trashButtons[0]);

    expect(screen.queryByText("Pesan Pertama")).toBeNull();
    expect(screen.getByText("Pesan Kedua")).toBeTruthy();
    expect(handleChange).toHaveBeenCalledWith([sampleMessages[1]]);
  });

  it("selects all messages when Select All checkbox is clicked", () => {
    render(<MessageManager initialMessages={sampleMessages} />);

    const selectAllContainer = screen.getByText(/Pilih Semua/i);
    fireEvent.click(selectAllContainer);

    expect(screen.getByText("2 Dipilih")).toBeTruthy();
    expect(screen.getByText("Hapus yang Dipilih (2)")).toBeTruthy();
  });

  it("performs mass delete on selected messages", () => {
    const handleChange = vi.fn();
    render(<MessageManager initialMessages={sampleMessages} onMessagesChange={handleChange} />);

    // Select all
    const selectAllContainer = screen.getByText(/Pilih Semua/i);
    fireEvent.click(selectAllContainer);

    // Click mass delete button
    const deleteSelectedBtn = screen.getByText("Hapus yang Dipilih (2)");
    fireEvent.click(deleteSelectedBtn);

    expect(screen.queryByText("Pesan Pertama")).toBeNull();
    expect(screen.queryByText("Pesan Kedua")).toBeNull();
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it("clears all messages on Bersihkan Semua click", () => {
    const handleChange = vi.fn();
    render(<MessageManager initialMessages={sampleMessages} onMessagesChange={handleChange} />);

    const clearAllBtn = screen.getByTestId("clear-all-btn");
    fireEvent.click(clearAllBtn);

    expect(screen.queryByText("Pesan Pertama")).toBeNull();
    expect(screen.queryByText("Pesan Kedua")).toBeNull();
    expect(screen.getByText("Daftar Pesan / Email Kosong")).toBeTruthy();
    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
