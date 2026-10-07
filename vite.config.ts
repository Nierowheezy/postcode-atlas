import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
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
    plugins: [react(), tailwindcss(), versionManifest()],
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
