import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Level B: app shell offline, KHÔNG cache dữ liệu người dùng.
      // - Không khai báo `runtimeCaching` nào ⇒ mọi request Supabase (REST /auth/v1,
      //   /rest/v1, /storage/v1) và mọi request khác đều đi thẳng ra mạng.
      // - Supabase là cross-origin, và `navigateFallback` chỉ áp dụng cho request
      //   điều hướng cùng origin ⇒ dữ liệu học viên không bao giờ vào cache của SW.
      registerType: 'prompt', // có bản mới thì báo, KHÔNG tự reload
      injectRegister: false, // tự đăng ký trong React để kiểm soát UX cập nhật
      strategies: 'generateSW',
      // Icon đã khớp globPatterns ⇒ không chèn trùng từ manifest vào precache.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'E-Master Personal Coaching',
        short_name: 'E-Master',
        description:
          'Guided self-study cùng huấn luyện viên cá nhân — lộ trình, nhiệm vụ tuần và phản hồi từ coach.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#2A4272',
        background_color: '#2A4272',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Chỉ precache asset tĩnh của app shell (JS/CSS/HTML/icon/manifest).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Mọi điều hướng cùng origin khi offline đều trả về app shell.
        navigateFallback: '/index.html',
        // Dọn cache của các bản build cũ.
        cleanupOutdatedCaches: true,
        // KHÔNG tự chiếm quyền tab đang mở và KHÔNG skipWaiting:
        // học viên đang làm bài chỉ nhận SW mới khi họ bấm "Cập nhật".
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: {
        // SW không chạy ở dev để tránh cache gây nhiễu khi phát triển.
        enabled: false,
      },
    }),
  ],
  server: {
    // Cổng khác app thi thử (5173) để tránh trùng khi chạy song song
    port: 5174,
  },
});
