import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const PARTS = ['c00.txt', 'c01.txt', 'c02.txt', 'c03.txt', 'c04.txt', 'c05.txt', 'c06.txt', 'c07.txt', 'c08.txt'];

const OLD_MARK =
  '<img src="/logo/lipro-mark.svg" alt="LIPRO Academy" width="34" height="34" style="width: 34px; height: 34px; border-radius: 9px; display: block;" />';

const NEW_MARK =
  '<span style="width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: oklch(0.78 0.18 140); flex-shrink: 0;" aria-hidden="true"><svg viewBox="0 0 100 100" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 14 A26 26 0 0 1 22 66 L22 88 L78 88" stroke="oklch(0.14 0.02 250)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>';

export async function GET() {
  const dir = path.join(process.cwd(), 'animation-landing', 'payload');
  const b64 = PARTS.map((f) => readFileSync(path.join(dir, f), 'utf-8').trim()).join('');
  let html = gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8');
  html = html.split(OLD_MARK).join(NEW_MARK);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
