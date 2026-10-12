import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Cổng khác app thi thử (5173) để tránh trùng khi chạy song song
    port: 5174,
  },
});
