import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const isProduction = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;
if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
if (!rawPort && !isProduction) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),

    // ── Progressive Web App ─────────────────────────────────────────────────
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.svg", "apple-touch-icon.svg",
        "icons/icon-192.png", "icons/icon-512.png",
      ],

      // ── Web App Manifest (Production-Grade) ─────────────────────────────
      manifest: {
        name: "مدير المزرعة الذكي",
        short_name: "مزرعة AI",
        description: "نظام إدارة الدواجن والتفقيس بتقنية الذكاء الاصطناعي",
        theme_color: "#B85C2A",
        background_color: "#F7F0E6",
        display: "standalone",
        orientation: "portrait",
        scope: basePath,
        start_url: `${basePath}?source=pwa`,
        lang: "ar",
        dir: "rtl",
        categories: ["productivity", "business"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          // Keep SVG for modern browsers
          {
            src: "icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
        shortcuts: [
          {
            name: "الإدارة المالية",
            url: `${basePath}finance`,
            description: "إضافة معاملة مالية سريعة",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "القطعان",
            url: `${basePath}flocks`,
            description: "إدارة القطعان",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },

      // ── Workbox — Advanced Caching Strategies ─────────────────────────────
      workbox: {
        // App Shell: cache all static assets during install
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2,webp}"],

        // Clean old caches automatically
        cleanupOutdatedCaches: true,

        // Skip waiting — update immediately when new SW is available
        skipWaiting: true,
        clientsClaim: true,

        runtimeCaching: [
          // ── Strategy 1: API → Network First (fallback to cache)
          // Critical: never show stale financial/flock data without trying network
          {
            urlPattern: /\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache-v1",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 2, // 2 hours fallback
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Strategy 2: Google Fonts → Cache First (1 year)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets-v1",
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts-v1",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },

          // ── Strategy 3: Images → Stale While Revalidate
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images-v1",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },

          // ── Strategy 4: App Shell (JS/CSS) → Cache First
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-resources-v1",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],

        // Offline fallback
        navigateFallback: null, // React handles routing; don't override navigation
      },
    }),

    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],

  // ── Code Splitting — Reduce initial bundle ────────────────────────────────
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          "react-vendor": ["react", "react-dom"],
          // Router + state
          "app-core": ["wouter", "@tanstack/react-query"],
          // UI library
          "ui-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
          ],
          // Charts (heavy)
          "charts": ["recharts"],
          // Motion (heavy)
          "motion": ["framer-motion"],
        },
      },
    },
    // Performance targets
    chunkSizeWarningLimit: 600,
  },

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
