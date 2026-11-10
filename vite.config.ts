import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base + hash routing means the site works on any GitHub Pages path
// (user.github.io/repo) as well as on a custom domain, with no configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
