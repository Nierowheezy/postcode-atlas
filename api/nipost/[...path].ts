/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Function for `/api/nipost/*`, the server-side NIPOST NDAPS proxy.
 *
 * Production entry point only. Dev usage goes through the identical handler
 * mounted as Vite middleware in `vite.config.ts`, so `npm run dev` needs no
 * separate server. `NIPOST_PUBLISHABLE_KEY` is read from `process.env` here and
 * never reaches the browser. See `src/server/nipost/handler.ts` for why the
 * proxy exists.
 */

import { handleNipostProxy } from '../../src/server/nipost/handler.js';
import { isWebRequest, toWebRequest } from '../../src/server/http/toWebRequest.js';

export const config = {
  runtime: 'nodejs',
};

async function proxy(request: unknown): Promise<Response> {
  const webRequest = isWebRequest(request) ? request : await toWebRequest(request);
  return handleNipostProxy(webRequest, process.env);
}

export function GET(request: unknown): Promise<Response> {
  return proxy(request);
}

export function POST(request: unknown): Promise<Response> {
  return proxy(request);
}
