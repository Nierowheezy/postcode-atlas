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

import { handleAsk } from '../src/server/ask/handler.js';

/** Give LLM providers up to 60 s (they can be slow at peak times). */
export const maxDuration = 60;

export const config = {
  runtime: 'nodejs',
};

/**
 * Vercel's Node runtime invokes a named HTTP method (here `POST`) with a Web
 * `Request` and honors the returned `Response`. A default export would be
 * treated as `(req, res) => void` and its return ignored, which hangs the
 * request. This code still defends against a Node-style IncomingMessage
 * (headers as a plain object, body as a readable stream) by converting it the
 * same way the dev middleware in `vite.config.ts` does.
 */
type NodeIncomingMessage = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | number | undefined>;
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
};

function isWebRequest(value: unknown): value is Request {
  return typeof (value as { headers?: { get?: unknown } } | null)?.headers?.get === 'function';
}

async function toWebRequest(value: unknown): Promise<Request> {
  const message = value as Partial<NodeIncomingMessage>;
  const headers = new Headers();
  for (const [name, raw] of Object.entries(message.headers ?? {})) {
    if (Array.isArray(raw)) {
      for (const item of raw) headers.append(name, item);
    } else if (raw !== undefined) {
      headers.set(name, String(raw));
    }
  }
  const chunks: Buffer[] = [];
  if (message[Symbol.asyncIterator]) {
    for await (const chunk of message as NodeIncomingMessage) {
      chunks.push(Buffer.from(chunk));
    }
  }
  const method = message.method ?? 'GET';
  const init: RequestInit = { method, headers };
  if (chunks.length > 0 && method !== 'GET' && method !== 'HEAD') {
    init.body = Buffer.concat(chunks).toString('utf-8');
  }
  return new Request(new URL(message.url ?? '/', 'http://localhost').toString(), init);
}

export async function POST(request: unknown): Promise<Response> {
  const webRequest = isWebRequest(request) ? request : await toWebRequest(request);
  return handleAsk(webRequest, process.env);
}