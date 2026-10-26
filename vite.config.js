import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "MobílIA",
        short_name: "MobílIA",
        description: "Desenhe seus próprios móveis com a ajuda de uma IA e encomende a fabricação.",
        theme_color: "#1E1C1A",
        background_color: "#1E1C1A",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell; chat calls to the AI provider and Firebase
        // always go to the network — never cache those responses.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html}"],
      },
    }),
  ],
  server: {
    // In dev, /api/* goes to the deployed Hosting site (which forwards to the
    // Cloud Function). Point API_PROXY_TARGET at the emulator to test locally,
    // e.g. http://127.0.0.1:5000 with `firebase emulators:start`.
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "https://mobilia-99550.web.app",
        changeOrigin: true,
      },
    },
  },
});
