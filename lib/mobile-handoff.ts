import { NextResponse } from 'next/server';

// A raw HTTP redirect (Location header) from an HTTPS page straight to a
// custom scheme is NOT reliably honored — confirmed live against the Google
// OAuth callback: a real device ended up stuck on the plain web content
// instead of returning to the app. Some Android browsers/Custom Tabs only
// hand a non-http(s) scheme off to the OS on a user gesture or client-side
// navigation, not an automatic server redirect (an anti-hijack measure).
// Returning a tiny HTML page that navigates via JS instead — with a visible
// fallback link in case even that's blocked — is the fix, shared here so
// every mobile handoff (Google OAuth, wallet funding, subscription
// checkout) uses the same proven approach instead of re-deriving it.
export function mobileHandoff(target: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Returning to LIPRO Academy…</title></head><body style="font-family:system-ui,sans-serif;background:#0f0a1a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><p>Returning you to the app…</p><p style="opacity:.6;font-size:14px">If nothing happens, <a href="${target}" style="color:#c084fc">tap here to continue</a>.</p></div>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
