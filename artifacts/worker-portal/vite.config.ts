import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname), '');

  return {
    base: basePath,
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        env.FIREBASE_API_KEY ?? env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY ?? '',
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        env.FIREBASE_AUTH_DOMAIN ??
          env.VITE_FIREBASE_AUTH_DOMAIN ??
          process.env.FIREBASE_AUTH_DOMAIN ??
          process.env.VITE_FIREBASE_AUTH_DOMAIN ??
          '',
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        env.FIREBASE_PROJECT_ID ??
          env.VITE_FIREBASE_PROJECT_ID ??
          process.env.FIREBASE_PROJECT_ID ??
          process.env.VITE_FIREBASE_PROJECT_ID ??
          '',
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        env.FIREBASE_STORAGE_BUCKET ??
          env.VITE_FIREBASE_STORAGE_BUCKET ??
          process.env.FIREBASE_STORAGE_BUCKET ??
          process.env.VITE_FIREBASE_STORAGE_BUCKET ??
          '',
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        env.FIREBASE_MESSAGING_SENDER_ID ??
          env.VITE_FIREBASE_MESSAGING_SENDER_ID ??
          process.env.FIREBASE_MESSAGING_SENDER_ID ??
          process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ??
          '',
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        env.FIREBASE_APP_ID ?? env.VITE_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? process.env.VITE_FIREBASE_APP_ID ?? '',
      ),
    },
    plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
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
