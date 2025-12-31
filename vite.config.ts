import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Inject environment variables directly as strings for the client bundle
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {
        API_KEY: process.env.API_KEY || ''
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  }
});