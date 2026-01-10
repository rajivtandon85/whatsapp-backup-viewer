import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
