import { describe, it, expect, vi } from "vitest";

// Mock Firestore transaction object
function createMockTransaction(store) {
  const reads = [];
  const writes = [];

  return {
    get: vi.fn(async (ref) => {
      if (writes.length > 0) {
        throw new Error("Firestore transactions require all reads to be executed before all writes.");
      }
      reads.push(ref.path);
      return {
        exists: () => ref.path in store,
        data: () => store[ref.path],
      };
    }),
    update: vi.fn((ref, updates) => {
      writes.push({ type: "update", ref: ref.path, updates });
      store[ref.path] = { ...store[ref.path], ...updates };
    }),
    set: vi.fn((ref, data) => {
      writes.push({ type: "set", ref: ref.path, data });
      store[ref.path] = data;
    }),
    delete: vi.fn((ref) => {
      writes.push({ type: "delete", ref: ref.path });
      delete store[ref.path];
    }),
    _writes: writes,
    _reads: reads,
  };
}

// Transaction logic under test (matching reviewSubmission and reviewWithdrawal implementation)
async function reviewSubmissionTx(tx, submissionId, decision, reviewNote, pricePerEmail, store) {
  const submissionPath = `emailSubmissions/${submissionId}`;
  const submissionSnap = await tx.get({ path: submissionPath });
  if (!submissionSnap.exists()) throw new Error("Setoran tidak ditemukan.");
  const submission = submissionSnap.data();
  if (submission.status !== "pending") {
    throw new Error("Setoran ini sudah pernah ditinjau.");
  }

  const newStatus = decision === "approved" ? "available" : decision;
  const isApproval = newStatus === "available" || decision === "approved";
  const userPath = isApproval ? `users/${submission.workerId}` : null;
  const userSnap = userPath ? await tx.get({ path: userPath }) : null;

  tx.update({ path: submissionPath }, {
    status: newStatus,
    reviewNote,
    reviewedAt: "TIMESTAMP",
    updatedAt: "TIMESTAMP",
  });

  if (isApproval && userPath && userSnap && userSnap.exists()) {
    const current = userSnap.data().balance ?? 0;
    tx.update({ path: userPath }, { balance: current + pricePerEmail });
  }
}

async function reviewWithdrawalTx(tx, withdrawalId, status, note, store) {
  const withdrawalPath = `withdrawals/${withdrawalId}`;
  const withdrawalSnap = await tx.get({ path: withdrawalPath });
  if (!withdrawalSnap.exists()) throw new Error("Penarikan tidak ditemukan.");
  const withdrawal = withdrawalSnap.data();
  if (withdrawal.status !== "pending" && withdrawal.status !== "processing") {
    throw new Error("Penarikan ini sudah selesai diproses.");
  }

  const isRejected = status === "rejected";
  const userPath = isRejected ? `users/${withdrawal.workerId}` : null;
  const userSnap = userPath ? await tx.get({ path: userPath }) : null;

  tx.update({ path: withdrawalPath }, { status, note, processedAt: "TIMESTAMP" });

  if (isRejected && userPath && userSnap && userSnap.exists()) {
    const current = userSnap.data().balance ?? 0;
    tx.update({ path: userPath }, { balance: current + withdrawal.amount });
  }
}

describe("Firestore Transaction Read-Before-Write Tests", () => {
  it("successfully approves email submission, credits balance, and executes all reads before writes", async () => {
    const store = {
      "emailSubmissions/sub_1": {
        workerId: "worker_123",
        status: "pending",
        email: "test@example.com",
      },
      "users/worker_123": {
        uid: "worker_123",
        name: "Worker One",
        balance: 10000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewSubmissionTx(tx, "sub_1", "approved", "Good submission", 5000, store);

    // Verify submission status updated to available
    expect(store["emailSubmissions/sub_1"].status).toBe("available");
    // Verify worker balance credited by pricePerEmail (10000 + 5000 = 15000)
    expect(store["users/worker_123"].balance).toBe(15000);
    // Verify reads occurred before writes without throwing transaction error
    expect(tx._reads).toEqual(["emailSubmissions/sub_1", "users/worker_123"]);
    expect(tx._writes.length).toBe(2);
  });

  it("prevents duplicate approval when submission is not pending", async () => {
    const store = {
      "emailSubmissions/sub_1": {
        workerId: "worker_123",
        status: "available",
        email: "test@example.com",
      },
      "users/worker_123": {
        uid: "worker_123",
        name: "Worker One",
        balance: 15000,
      },
    };

    const tx = createMockTransaction(store);
    await expect(
      reviewSubmissionTx(tx, "sub_1", "approved", "Second try", 5000, store)
    ).rejects.toThrow("Setoran ini sudah pernah ditinjau.");

    // Verify balance unchanged
    expect(store["users/worker_123"].balance).toBe(15000);
  });

  it("rejection flow works correctly without updating worker balance and preserves read-before-write", async () => {
    const store = {
      "emailSubmissions/sub_1": {
        workerId: "worker_123",
        status: "pending",
        email: "bad@example.com",
      },
      "users/worker_123": {
        uid: "worker_123",
        name: "Worker One",
        balance: 10000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewSubmissionTx(tx, "sub_1", "rejected", "Invalid email", 5000, store);

    // Verify status rejected
    expect(store["emailSubmissions/sub_1"].status).toBe("rejected");
    // Verify balance unaffected
    expect(store["users/worker_123"].balance).toBe(10000);
    // Verify only 1 write was performed
    expect(tx._writes.length).toBe(1);
  });

  it("reviewWithdrawal handles rejection balance refund with reads before writes", async () => {
    const store = {
      "withdrawals/w_1": {
        workerId: "worker_123",
        amount: 50000,
        status: "pending",
      },
      "users/worker_123": {
        uid: "worker_123",
        name: "Worker One",
        balance: 20000,
      },
    };

    const tx = createMockTransaction(store);
    await reviewWithdrawalTx(tx, "w_1", "rejected", "Invalid bank info", store);

    // Verify withdrawal status rejected and balance refunded
    expect(store["withdrawals/w_1"].status).toBe("rejected");
    expect(store["users/worker_123"].balance).toBe(70000);
    expect(tx._reads).toEqual(["withdrawals/w_1", "users/worker_123"]);
  });
});
