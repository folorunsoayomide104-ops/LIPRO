import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const dir = path.join(process.cwd(), 'animation-landing');
  const part1 = readFileSync(path.join(dir, 'landing.part1.txt'), 'utf-8').trim();
  const part2 = readFileSync(path.join(dir, 'landing.part2.txt'), 'utf-8').trim();
  const gz = Buffer.from(part1 + part2, 'base64');
  const html = gunzipSync(gz).toString('utf-8');
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
