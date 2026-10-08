/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Function for `/api/ask`.
 *
 * Production entry point only. Dev usage goes through the identical handler
 * mounted as Vite middleware in `vite.config.ts`, so `npm run dev` needs no
 * separate server. Provider keys are read from `process.env` here and never
 * reach the browser.
 */

import { handleAsk } from '../src/server/ask/handler';

/** Give LLM providers up to 60 s (they can be slow at peak times). */
export const maxDuration = 60;

export const config = {
  runtime: 'nodejs',
};

export default async function ask(request: Request): Promise<Response> {
  return handleAsk(request, process.env);
}