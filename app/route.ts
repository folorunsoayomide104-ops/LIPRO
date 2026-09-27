import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const PARTS = ['c00.txt', 'c01.txt', 'c02.txt', 'c03.txt', 'c04.txt', 'c05.txt', 'c06.txt', 'c07.txt', 'c08.txt'];

export async function GET() {
  const dir = path.join(process.cwd(), 'animation-landing', 'payload');
  const b64 = PARTS.map((f) => readFileSync(path.join(dir, f), 'utf-8').trim()).join('');
  const html = gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8');
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
