import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Project pages are served from /<repo>/, so assets need that prefix in the
// built output. Local dev stays at the root.
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/Sendflow/' : '/',
  plugins: [react()],
});
