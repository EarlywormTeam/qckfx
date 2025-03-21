import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { splitVendorChunkPlugin } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react(),
      splitVendorChunkPlugin(),
      createHtmlPlugin({
        minify: isProduction,
        inject: {
          data: {
            title: 'QCKFX Agent',
          },
        },
      }),
    ],
    build: {
      outDir: 'dist/ui',
      emptyOutDir: true,
      cssCodeSplit: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('src/ui/components/ui/')) {
              return 'ui-vendor';
            }
          }
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/ui')
      }
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true
        }
      },
      open: '/index.html',
      port: 5173,
    },
  };
});