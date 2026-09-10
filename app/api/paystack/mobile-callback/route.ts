import { mobileHandoff } from '@/lib/mobile-handoff';

// See app/api/wallet/mobile-callback for the full reasoning — same pattern,
// for subscription checkout instead of wallet funding. The actual tier
// upgrade is applied by /api/paystack/webhook; this only verifies the
// transaction for an accurate immediate status.
const MOBILE_SCHEME = 'liproacademy://payment';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
  if (!reference) return mobileHandoff(`${MOBILE_SCHEME}?type=subscription&status=failed`);

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || secret.startsWith('sk_test_xxxx')) {
    return mobileHandoff(`${MOBILE_SCHEME}?type=subscription&status=failed`);
  }

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    const success = data?.status && data?.data?.status === 'success';
    return mobileHandoff(
      `${MOBILE_SCHEME}?type=subscription&status=${success ? 'success' : 'failed'}&reference=${encodeURIComponent(reference)}`
    );
  } catch {
    return mobileHandoff(`${MOBILE_SCHEME}?type=subscription&status=failed&reference=${encodeURIComponent(reference)}`);
  }
}
