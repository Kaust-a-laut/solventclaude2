import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-d3': ['d3-force', 'd3-selection', 'd3-zoom', 'd3-drag'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
    target: 'es2020',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/files': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/generated_images': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/dev-secret': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
