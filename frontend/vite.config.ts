import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-118.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'LOTISEC',
        short_name: 'LOTISEC',
        description: 'Urgence routière, Secours et Réservation Zemidjan au Togo.',
        theme_color: '#071A2E',
        background_color: '#F3F6FA',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  }
});
