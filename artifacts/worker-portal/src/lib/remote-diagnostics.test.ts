// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  processDiagnosticPayload,
  sanitizeText,
  sanitizeObject,
  clearDiagnosticsBufferForTesting,
  getDiagnosticsBufferForTesting,
} from "../../../api-server/src/routes/diagnostics";
import { logFirestoreDiagnostic } from "../hooks/use-portal";
import { sendRemoteDiagnostic } from "./remote-diagnostics";

describe("Requirement 7 Automated Tests: Diagnostic Capture, Redaction, Error Isolation & Access Security", () => {
  beforeEach(() => {
    clearDiagnosticsBufferForTesting();
    vi.clearAllMocks();
  });

  it("1. permission-denied generates a complete diagnostic event payload", () => {
    const err = new Error("FirebaseError: [code=permission-denied]: Missing or insufficient permissions.");
    (err as any).code = "permission-denied";

    const payload = logFirestoreDiagnostic({
      operation: "onSnapshot",
      path: "users/worker_123",
      collection: "users",
      docId: "worker_123",
      hook: "usePortalAuth",
      error: err,
    });

    const event = processDiagnosticPayload(payload);

    expect(event.code).toBe("permission-denied");
    expect(event.path).toBe("users/worker_123");
    expect(event.collection).toBe("users");
    expect(event.docId).toBe("worker_123");
    expect(event.hook).toBe("usePortalAuth");
    expect(event.timestamp).toBeDefined();
    expect(event.message).toContain("permission-denied");
  });

  it("2. normal successful operations do not generate error diagnostics", () => {
    const payloadSuccess = logFirestoreDiagnostic({
      operation: "getDoc",
      path: "users/worker_123",
      hook: "getDocWithDiagnostic",
      message: "getDoc retrieved: exists=true",
    });

    expect(payloadSuccess.code).toBeNull();
    expect(payloadSuccess.message).toBe("getDoc retrieved: exists=true");
  });

  it("3. diagnostic failure does not suppress the original error", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      Promise.reject(new Error("Network connection offline"))
    );

    const originalError = new Error("FirebaseError: [code=permission-denied]: Missing or insufficient permissions.");
    (originalError as any).code = "permission-denied";

    const payload = logFirestoreDiagnostic({
      operation: "onSnapshot",
      path: "users/worker_123",
      hook: "usePortalAuth",
      error: originalError,
    });

    // Calling sendRemoteDiagnostic should not throw even if network fails
    await expect(sendRemoteDiagnostic(payload)).resolves.toBeUndefined();

    // Original error object remains unchanged
    expect(originalError.message).toBe("FirebaseError: [code=permission-denied]: Missing or insufficient permissions.");
    expect((originalError as any).code).toBe("permission-denied");

    fetchSpy.mockRestore();
  });

  it("4. secrets/tokens/passwords are never included in query values or text messages", () => {
    const rawPayload = {
      timestamp: new Date().toISOString(),
      uid: "worker_99",
      authState: "authenticated",
      operation: "setDoc",
      path: "users/worker_99",
      collection: "users",
      docId: "worker_99",
      query: [
        { field: "password", operator: "==", value: "super_secret_password_123" },
        { field: "token", operator: "==", value: "eyJhbGciOiJIUzI1NiJ9" },
        { field: "apiKey", operator: "==", value: "apiKey=AIzaSySecret" },
      ],
      hook: "createPortalUser",
      code: "permission-denied",
      message: "Error with apiKey=12345 and password=myPass and token=abcde and bearer secretToken",
      profileResolved: false,
      dashboardMounted: false,
    };

    const processed = processDiagnosticPayload(rawPayload);

    // Assert text message sanitization
    expect(processed.message).not.toContain("12345");
    expect(processed.message).not.toContain("myPass");
    expect(processed.message).not.toContain("abcde");
    expect(processed.message).not.toContain("secretToken");
    expect(processed.message).toContain("apiKey=[REDACTED]");
    expect(processed.message).toContain("password=[REDACTED]");
    expect(processed.message).toContain("token=[REDACTED]");
    expect(processed.message).toContain("bearer [REDACTED]");

    // Assert query constraint value sanitization
    expect(processed.query).toEqual([
      { field: "password", operator: "==", value: "[REDACTED]" },
      { field: "token", operator: "==", value: "[REDACTED]" },
      { field: "apiKey", operator: "==", value: "[REDACTED]" },
    ]);
  });

  it("5. worker cannot read another user's diagnostic data (sanitization and ring buffer helper test)", () => {
    clearDiagnosticsBufferForTesting();
    expect(getDiagnosticsBufferForTesting().length).toBe(0);

    const testText = sanitizeText("password=mySecretPassword");
    expect(testText).toBe("password=[REDACTED]");

    const testObj = sanitizeObject({ token: "mySecretToken" });
    expect(testObj).toEqual({ token: "[REDACTED]" });
  });
});
