import { mobileHandoff } from '@/lib/mobile-handoff';

// Paystack redirects the user's system browser here after checkout —
// regardless of whether the payment succeeded, failed, or was cancelled.
// The actual wallet credit is applied by /api/paystack/webhook (the
// authoritative, signature-verified server-to-server notification); this
// route only verifies the transaction directly with Paystack so it can hand
// the app an accurate immediate status instead of just assuming success
// because the redirect happened. See google_auth_service.dart /
// app/api/auth/google/callback for the same two-hop mobile handoff pattern.
const MOBILE_SCHEME = 'liproacademy://payment';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
  if (!reference) return mobileHandoff(`${MOBILE_SCHEME}?type=wallet&status=failed`);

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || secret.startsWith('sk_test_xxxx')) {
    // Demo mode never reaches Paystack in the first place (wallet/fund
    // credits immediately and returns no authorizationUrl), so this branch
    // is unreachable in practice — kept only so a misconfigured env fails
    // toward "failed" rather than a thrown error.
    return mobileHandoff(`${MOBILE_SCHEME}?type=wallet&status=failed`);
  }

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    const success = data?.status && data?.data?.status === 'success';
    return mobileHandoff(
      `${MOBILE_SCHEME}?type=wallet&status=${success ? 'success' : 'failed'}&reference=${encodeURIComponent(reference)}`
    );
  } catch {
    return mobileHandoff(`${MOBILE_SCHEME}?type=wallet&status=failed&reference=${encodeURIComponent(reference)}`);
  }
}
