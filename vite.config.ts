import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {fileURLToPath} from 'url';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import {handleAsk} from './src/server/ask/handler';

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

/**
 * Mounts the Ask Atlas API handler as Vite dev middleware so `npm run dev`
 * serves `POST /api/ask` exactly like the Vercel Function in production.
 * Env vars come from Vite's `loadEnv` (the .env file); they are passed to the
 * handler directly and never exposed through `import.meta.env`.
 */
function askDevMiddleware(env: Record<string, string>): Plugin {
  return {
    name: 'postcode-atlas-ask-middleware',
    configureServer(server) {
      server.middlewares.use('/api/ask', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'bad_request', message: 'Use POST to ask Ask Atlas a question.' } }));
          return;
        }

        // Collect the request body so the shared handler can parse it, and
        // forward the client's content-length so the handler's body-size
        // guard behaves in dev exactly as it does on Vercel.
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const contentLength = req.headers['content-length'];
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (contentLength) headers['content-length'] = contentLength;
        const request = new Request('http://localhost/api/ask', {
          method: 'POST',
          headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        });

        const response = await handleAsk(request, env);
        res.statusCode = response.status;
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      versionManifest(),
      askDevMiddleware(env),
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
