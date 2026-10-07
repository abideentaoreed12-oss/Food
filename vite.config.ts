import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
      ),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      sourcemap: false, // Ensure sourcemaps are completely disabled in production
      minify: 'esbuild', // Minify and scramble code
      cssMinify: true,
      rollupOptions: {
        output: {
          // Dynamic chunk splitting to prevent single big bundle scans
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('lucide')) {
                return 'vendor-icons';
              }
              return 'vendor-helpers';
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

