
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Provide a shim for process.env to prevent "process is not defined" errors in the browser
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {
        API_KEY: process.env.API_KEY || ''
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  }
});
