import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'supabase/functions/_shared/domain'),
      '@shared': path.resolve(__dirname, 'supabase/functions/_shared'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
