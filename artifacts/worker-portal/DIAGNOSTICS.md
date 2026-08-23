# Production Firestore Diagnostic Instrumentation Guide

This guide explains how to enable and disable production diagnostic instrumentation for the Worker Portal application deployed on Netlify.

---

## Enabling Diagnostic Logging in Netlify

Because Vite embeds `import.meta.env` environment variables into the client JavaScript bundle at build-time, enabling or disabling diagnostics requires setting the environment variable in Netlify and triggering a new build.

### Steps to Enable:

1. Log in to the **Netlify Dashboard**.
2. Navigate to your site: **Site** → **Project configuration** → **Environment variables**.
3. Click **Add variable** (or edit if it already exists):
   - **Key**: `VITE_FIRESTORE_DIAGNOSTICS`
   - **Value**: `true`
4. Save the variable.
5. Go to **Deploys** → **Trigger deploy** → **Deploy site** to trigger a new build.

When enabled (`VITE_FIRESTORE_DIAGNOSTICS=true`), the Worker Portal client bundle logs structured `[FirestoreDiagnostic]` payloads to the browser console for both active operations and errors.

---

## Disabling Diagnostic Logging

To return to standard production logging mode (where only error diagnostics are logged upon failures, and verbose traces are suppressed):

1. Go to **Netlify Dashboard** → **Project configuration** → **Environment variables**.
2. Edit `VITE_FIRESTORE_DIAGNOSTICS`:
   - **Value**: `false`
3. Save the variable.
4. Go to **Deploys** → **Trigger deploy** → **Deploy site** to rebuild and redeploy.

---

## Diagnostic Output Format

All diagnostic logs use the `[FirestoreDiagnostic]` prefix and follow a strict, secret-free JSON structure:

```json
[FirestoreDiagnostic] {
  "timestamp": "2026-08-24T12:34:56.789Z",
  "uid": "worker_uid_123",
  "authState": "authenticated",
  "operation": "onSnapshot",
  "path": "users/worker_uid_123",
  "collection": "users",
  "docId": "worker_uid_123",
  "query": null,
  "hook": "usePortalAuth",
  "code": "permission-denied",
  "message": "FirebaseError: [code=permission-denied]: Missing or insufficient permissions.",
  "profileResolved": true,
  "dashboardMounted": true
}
```

### Query Constraints

Query constraints are formatted as structured objects and never serialize to `"[object Object]"`:

```json
"query": [
  {
    "type": "where",
    "field": "workerId",
    "operator": "==",
    "value": "worker_uid_123"
  }
]
```

---

## Security Guarantees

Diagnostic logs **NEVER** expose:
- Firebase ID tokens / Refresh tokens
- User passwords
- API keys
- Authorization headers or cookies
- Payment credentials

Any query field containing sensitive keywords (such as `password`, `token`, `secret`, `key`, `auth`) has its value automatically redacted to `"[REDACTED]"`.
