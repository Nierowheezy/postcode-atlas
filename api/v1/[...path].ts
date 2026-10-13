/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Function for the public developer API (feature 21a): `/api/v1/*`.
 *
 * Production entry point only. Dev usage goes through the identical handler
 * mounted as Vite middleware in `vite.config.ts`, so `npm run dev` needs no
 * separate server. The NIPOST gateway key is read from `process.env` here and
 * never reaches the browser.
 */

import { handleApi } from '../../src/server/api/handler.js';
import { isWebRequest, toWebRequest } from '../../src/server/http/toWebRequest.js';

export const config = {
  runtime: 'nodejs',
};

async function api(request: unknown): Promise<Response> {
  const webRequest = isWebRequest(request) ? request : await toWebRequest(request);
  return handleApi(webRequest, process.env);
}

export function GET(request: unknown): Promise<Response> {
  return api(request);
}

export function OPTIONS(request: unknown): Promise<Response> {
  return api(request);
}
