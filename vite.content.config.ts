import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: 'src/content.ts',
      name: 'LinkedInJobRecency',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
