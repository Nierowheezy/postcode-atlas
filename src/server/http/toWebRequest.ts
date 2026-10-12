/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel's Node runtime invokes a named HTTP method export with a Web
 * `Request` and honors the returned `Response`. A default export would be
 * treated as `(req, res) => void` and its return ignored, which hangs the
 * request. These helpers let a function accept either a Web `Request` or a
 * Node-style `IncomingMessage` (headers as a plain object, body as a readable
 * stream), so the same function works in production and in dev middleware.
 */

type NodeIncomingMessage = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | number | undefined>;
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
};

export function isWebRequest(value: unknown): value is Request {
  return typeof (value as { headers?: { get?: unknown } } | null)?.headers?.get === 'function';
}

export async function toWebRequest(value: unknown): Promise<Request> {
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
