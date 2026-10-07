import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import path from 'path';
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {fileURLToPath} from 'url';
import {defineConfig, type Plugin} from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/**
 * Emits version.json into the build output.
 *
 * The running bundle knows the version it was built with (inlined via
 * `__APP_VERSION__`). This file is fetched with cache-busting at runtime, so a
 * client can compare the two and detect that a newer deploy has shipped.
 */
function versionManifest(): Plugin {
  return {
    name: 'postcode-atlas-version-manifest',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'dist'
      );
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        path.join(outDir, 'version.json'),
        JSON.stringify(
          {
            version: pkg.version,
            builtAt: new Date().toISOString(),
          },
          null,
          2
        )
      );
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      versionManifest(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-512.png'],
        manifest: {
          name: 'Postcode Atlas',
          short_name: 'NPA',
          description:
            "Explore Nigeria's National Digital Alphanumeric Postcode System (NDAPS) as an interactive cartographic data visualization.",
          start_url: '/',
          display: 'standalone',
          background_color: '#FAFAF9',
          theme_color: '#008751',
          orientation: 'portrait-primary',
          scope: '/',
          icons: [
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
          ],
          categories: ['maps', 'navigation', 'utilities'],
          shortcuts: [
            {
              name: 'Surprise me',
              short_name: 'Random',
              description: 'Jump to a random verified postcode in Nigeria',
              url: '/?action=random',
              icons: [{ src: '/icon-512.png', sizes: '192x192' }],
            },
            {
              name: 'Postcode Hunt',
              short_name: 'Hunt',
              description: 'Play the geolocation challenge',
              url: '/?action=hunt',
              icons: [{ src: '/icon-512.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          navigateFallbackAllowlist: [/^\/$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.postcode\.gov\.ng\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'nipost-api',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-stylesheets',
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            {
              urlPattern: /^https:\/\/{s}\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3001,
    },
  };
});
