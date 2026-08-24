import type { FirestoreDiagnosticPayload } from "../hooks/use-portal";

/**
 * Best-effort remote diagnostic reporter.
 * Sends diagnostic payloads (especially Firestore error payloads like permission-denied)
 * to the backend API server.
 *
 * Guarantees:
 * 1. NEVER throws an error.
 * 2. NEVER alters client execution or suppresses original Firestore errors.
 * 3. Best-effort delivery.
 */
export async function sendRemoteDiagnostic(payload: FirestoreDiagnosticPayload): Promise<void> {
  try {
    const endpoint = "/api/diagnostics";

    // Perform best-effort async fetch
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch((err) => {
      // Quietly ignore network or endpoint errors to guarantee zero impact on user experience
      if (import.meta.env.DEV) {
        console.debug("[sendRemoteDiagnostic] Network delivery failed (ignored):", err);
      }
    });
  } catch (err) {
    // Quietly ignore any unexpected exceptions
    if (import.meta.env.DEV) {
      console.debug("[sendRemoteDiagnostic] Best-effort handler exception (ignored):", err);
    }
  }
}
