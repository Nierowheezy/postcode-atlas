/**
 * Verify a rendered MP4 by decoding it in Chromium and reporting its real
 * duration and dimensions. Run from video/:
 *
 *   node scripts/verify-video.mjs [path/to/file.mp4]
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const file = path.resolve(process.argv[2] ?? 'out/postcode-atlas-demo.mp4');

const server = http.createServer(async (_req, res) => {
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': buf.length });
    res.end(buf);
  } catch (err) {
    res.writeHead(404).end(String(err));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const meta = await page.evaluate(
  async (url) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.src = url;
    await new Promise((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error('video decode error'));
      setTimeout(() => reject(new Error('timed out reading metadata')), 20000);
    });
    return {
      duration: Math.round(v.duration * 100) / 100,
      width: v.videoWidth,
      height: v.videoHeight,
    };
  },
  `http://127.0.0.1:${port}/video.mp4`,
);

await browser.close();
server.close();
console.log(JSON.stringify(meta, null, 2));
