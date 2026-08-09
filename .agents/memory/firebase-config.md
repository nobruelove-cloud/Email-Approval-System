---
name: Firebase browser configuration
description: Firebase web configuration is stored as shared Replit Secrets without the VITE_ prefix.
---

The Firebase web app values are kept as shared secrets named `FIREBASE_*`; Vite needs an explicit build-time bridge to expose them to browser code as `VITE_FIREBASE_*`.

**Why:** Browser-exposed Vite variables must use the `VITE_` prefix, while the secure project configuration uses the unprefixed secret names.

**How to apply:** Preserve the bridge in the web app's Vite configuration when adding or changing Firebase client initialization; never print or copy the secret values into source files.