export const runtime = 'nodejs';

const FALLBACK_URL =
  'https://raw.githubusercontent.com/folorunsoayomide104-ops/LIPRO/2b684c7a8fd1ef755c4b98c832a4cce9ee6d2759/animation-landing/index.html';

export async function GET() {
  try {
    const res = await fetch(FALLBACK_URL, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const html = await res.text();
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem;background:#0b1020;color:#fff"><h1>LIPRO</h1><p>Landing temporarily unavailable (${message}).</p><p><a href="/login" style="color:#a3e635">Login</a> · <a href="/register" style="color:#a3e635">Register</a></p></body></html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }
}
