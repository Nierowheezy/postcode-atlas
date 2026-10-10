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
 * Vercel's Node runtime invokes the default export with a Node-style
 * IncomingMessage (headers as a plain object, body as a readable stream),
 * while `handleAsk` expects the Web `Request` API. This mirrors the dev
 * middleware in `vite.config.ts`: drain the stream, copy the headers, and
 * build a `Request`. A real Web `Request` passes through unchanged.
 */
type NodeIncomingMessage = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | number | undefined>;
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
};

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

export default async function ask(request: unknown): Promise<Response> {
  const webRequest = request instanceof Request ? request : await toWebRequest(request);
  return handleAsk(webRequest, process.env);
}