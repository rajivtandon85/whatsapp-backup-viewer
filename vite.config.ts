import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom plugin to inject build version into service worker
function injectServiceWorkerVersion(): Plugin {
  return {
    name: 'inject-sw-version',
    writeBundle() {
      // Generate version from current timestamp
      const version = Date.now().toString();

      // Read service worker from public folder
      const swPath = path.resolve(__dirname, 'public/service-worker.js');
      const distSwPath = path.resolve(__dirname, 'dist/service-worker.js');

      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8');

        // Replace the version placeholder
        swContent = swContent.replace('__BUILD_VERSION__', version);

        // Write to dist folder
        fs.writeFileSync(distSwPath, swContent);

        console.log(`✓ Service worker version injected: ${version}`);
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    injectServiceWorkerVersion()
  ],
  build: {
    // Ensure service worker is copied
    rollupOptions: {
      input: {
        main: './index.html',
      }
    }
  },
  // Configure for PWA
  server: {
    // IMPORTANT:
    // We intentionally avoid port 5173 because a previously-registered Service Worker
    // can control http://localhost:5173 and cache old dev assets, breaking Vite HMR.
    // Using a different port immediately proves the app is loading fresh code.
    port: 5174,
    strictPort: true,
    host: true // Allow access from network (for testing on iPhone)
  }
})
