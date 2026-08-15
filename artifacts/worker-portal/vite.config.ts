import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig(async ({ mode }) => {
  // Load environment variables from .env files
  const loadedEnv = loadEnv(mode, path.resolve(import.meta.dirname), '');

  // Merge loaded env with process.env (process.env takes precedence)
  const mergedEnv = {
    ...loadedEnv,
    ...process.env,
  };

  // Safe build-time diagnostics for Vercel production build analysis
  const diagnosticVars = [
    'VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID'
  ];

  console.log('=== Vercel Build-time Environment Diagnostics ===');
  diagnosticVars.forEach((varName) => {
    const val = mergedEnv[varName];
    if (val !== undefined) {
      const typeOfVal = typeof val;
      const len = String(val).length;
      const hasContent = len > 0;
      const prefix = len > 4 ? String(val).slice(0, 4) : '...';
      console.log(`[Diagnostic] ${varName}: Present (Type: ${typeOfVal}, Length: ${len}, HasContent: ${hasContent}, Prefix: ${prefix}***)`);
    } else {
      console.log(`[Diagnostic] ${varName}: Missing/Undefined`);
    }
  });
  console.log('==================================================');

  // Helper to filter out dummy/placeholder values and select the actual configuration
  const getRealEnvValue = (...vals: (string | undefined)[]): string => {
    for (const val of vals) {
      if (val !== undefined) {
        const trimmed = String(val).trim();
        const lower = trimmed.toLowerCase();
        const isPlaceholder =
          lower.startsWith('nilai') ||
          lower.includes('placeholder') ||
          lower.includes('your-') ||
          lower.includes('your_') ||
          trimmed === '';
        if (!isPlaceholder) {
          return trimmed;
        }
      }
    }
    return '';
  };

  // Safe fallbacks for PORT and BASE_PATH to prevent failures on non-interactive / Vercel build systems
  const rawPort = mergedEnv.PORT || '3000';
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = mergedEnv.BASE_PATH || '/';

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        getRealEnvValue(mergedEnv.VITE_FIREBASE_API_KEY, mergedEnv.FIREBASE_API_KEY)
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        getRealEnvValue(mergedEnv.VITE_FIREBASE_AUTH_DOMAIN, mergedEnv.FIREBASE_AUTH_DOMAIN)
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        getRealEnvValue(mergedEnv.VITE_FIREBASE_PROJECT_ID, mergedEnv.FIREBASE_PROJECT_ID)
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        getRealEnvValue(mergedEnv.VITE_FIREBASE_STORAGE_BUCKET, mergedEnv.FIREBASE_STORAGE_BUCKET)
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        getRealEnvValue(mergedEnv.VITE_FIREBASE_MESSAGING_SENDER_ID, mergedEnv.FIREBASE_MESSAGING_SENDER_ID)
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        getRealEnvValue(mergedEnv.VITE_FIREBASE_APP_ID, mergedEnv.FIREBASE_APP_ID)
      ),
    },
    envPrefix: ['VITE_', 'FIREBASE_'],
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(mergedEnv.NODE_ENV !== 'production' &&
      mergedEnv.REPL_ID !== undefined
        ? [
            await import('@replit/vite-plugin-cartographer').then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, '..'),
              }),
            ),
            await import('@replit/vite-plugin-dev-banner').then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'attached_assets',
        ),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
