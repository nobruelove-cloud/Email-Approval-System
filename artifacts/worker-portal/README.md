# Worker Portal Deployment & Firestore Diagnostics Guide

## Enabling Firestore Diagnostics in Netlify / Vercel

To capture exact Firestore operation diagnostics when `permission-denied` or other Firestore errors occur in production, set the following environment variable in your deployment platform:

```env
VITE_FIRESTORE_DIAGNOSTICS=true
```

### Netlify Deployment Configuration
1. Go to **Site Configuration** > **Environment variables**.
2. Click **Add a variable** / **Edit variables**.
3. Add Key: `VITE_FIRESTORE_DIAGNOSTICS`, Value: `true`.
4. Trigger a new deployment build.

### Vercel Deployment Configuration
1. Go to **Project Settings** > **Environment Variables**.
2. Add Key: `VITE_FIRESTORE_DIAGNOSTICS`, Value: `true`.
3. Select environments (**Production**, **Preview**).
4. Save and redeploy.

When enabled, any failing Firestore operation will output a structured console log entry prefixed with `[FirestoreDiagnostic]`.
