import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

export interface DiagnosticEvent {
  timestamp: string;
  uid: string | null;
  authState: "authenticated" | "unauthenticated";
  operation: string;
  path: string | null;
  collection: string | null;
  docId: string | null;
  query: Array<Record<string, unknown>> | null;
  hook: string;
  code: string | null;
  message: string;
  profileResolved: boolean;
  dashboardMounted: boolean;
}

const MAX_DIAGNOSTICS_BUFFER = 100;
const diagnosticsBuffer: DiagnosticEvent[] = [];

// Helper to sanitize text fields for secrets/tokens/passwords
export function sanitizeText(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/apiKey=[^\s&]+/gi, "apiKey=[REDACTED]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]")
    .replace(/token=[^\s&]+/gi, "token=[REDACTED]")
    .replace(/bearer\s+[^\s]+/gi, "bearer [REDACTED]")
    .replace(/secret=[^\s&]+/gi, "secret=[REDACTED]");
}

// Redact any object recursively if keys look sensitive or query fields refer to sensitive names
export function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  const isQueryConstraint = typeof record.field === "string" || typeof record.type === "string";
  const fieldName = String(record.field || "");
  const fieldIsSensitive = /password|token|secret|key|auth|cookie|credential/i.test(fieldName);

  for (const [key, val] of Object.entries(record)) {
    if (/password|token|secret|key|auth|cookie|credential/i.test(key)) {
      result[key] = "[REDACTED]";
    } else if (key === "value" && (isQueryConstraint && fieldIsSensitive)) {
      result[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      result[key] = sanitizeObject(val);
    } else if (typeof val === "string") {
      result[key] = sanitizeText(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function processDiagnosticPayload(body: any): DiagnosticEvent {
  return {
    timestamp: body.timestamp || new Date().toISOString(),
    uid: body.uid ? sanitizeText(String(body.uid)) : null,
    authState: body.authState === "authenticated" ? "authenticated" : "unauthenticated",
    operation: sanitizeText(String(body.operation || "unknown")),
    path: body.path ? sanitizeText(String(body.path)) : null,
    collection: body.collection ? sanitizeText(String(body.collection)) : null,
    docId: body.docId ? sanitizeText(String(body.docId)) : null,
    query: Array.isArray(body.query) ? (sanitizeObject(body.query) as Array<Record<string, unknown>>) : null,
    hook: sanitizeText(String(body.hook || "unknown")),
    code: body.code ? sanitizeText(String(body.code)) : null,
    message: sanitizeText(String(body.message || "")),
    profileResolved: Boolean(body.profileResolved),
    dashboardMounted: Boolean(body.dashboardMounted),
  };
}

const router: IRouter = Router();

// Endpoint for receiving diagnostic payloads from worker portal client
router.post("/diagnostics", (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const event = processDiagnosticPayload(body);

    // Store in ring buffer
    diagnosticsBuffer.unshift(event);
    if (diagnosticsBuffer.length > MAX_DIAGNOSTICS_BUFFER) {
      diagnosticsBuffer.pop();
    }

    logger.info({ event }, "[RemoteDiagnostic] Diagnostic event recorded");

    res.status(200).json({ status: "ok", recorded: true });
  } catch (err) {
    logger.error({ err }, "[RemoteDiagnostic] Failed to process diagnostic event");
    // Always return 200/ok so diagnostic reporting never throws on client
    res.status(200).json({ status: "ok", recorded: false });
  }
});

// Admin-only endpoint to retrieve recent diagnostics
router.get("/diagnostics/recent", (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_DIAGNOSTIC_SECRET || "admin-secret-key";
  const authHeader = req.headers["x-admin-token"] || req.headers["authorization"];

  const providedToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!providedToken || (providedToken !== adminSecret && providedToken !== `Bearer ${adminSecret}`)) {
    res.status(403).json({ error: "Unauthorized access to diagnostics" });
    return;
  }

  res.status(200).json({
    status: "ok",
    count: diagnosticsBuffer.length,
    events: diagnosticsBuffer,
  });
});

export function clearDiagnosticsBufferForTesting() {
  diagnosticsBuffer.length = 0;
}

export function getDiagnosticsBufferForTesting() {
  return diagnosticsBuffer;
}

export default router;
