import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';

export default function TermsPage() {
  return (
    <div>
      <LandingNav />
      <main className="mx-auto max-w-3xl px-4 py-16 prose prose-headings:tracking-tight">
        <h1>Terms of Service</h1>
        <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Last updated: {new Date().getFullYear()}.</p>
        <h2>1. Acceptance</h2>
        <p>By creating an account on LIPRO Academy you agree to these terms. If you do not agree, do not use the platform.</p>
        <h2>2. Eligibility</h2>
        <p>LIPRO Academy is designed for students, lecturers and administrators of Nigerian universities. You must provide accurate academic information during registration.</p>
        <h2>3. Acceptable use</h2>
        <p>You agree not to misuse the platform, attempt to access other users data, share your credentials, or post abusive content. LIPRO AI is an educational aid; verify AI outputs against authoritative sources before relying on them in examinations.</p>
        <h2>4. Subscriptions & refunds</h2>
        <p>Premium (₦1,700/mo) and Ultimate (₦3,000/mo) subscriptions are billed monthly via Paystack. Refunds for unused months may be requested within 7 days of payment.</p>
        <h2>5. Content ownership</h2>
        <p>Course materials remain the property of their authors. Your personal notes remain yours. LIPRO Academy holds a limited license to display content for the purpose of providing the service.</p>
        <h2>6. Limitation of liability</h2>
        <p>LIPRO Academy is provided "as is". We are not liable for academic outcomes resulting from AI-assisted study.</p>
        <h2>7. Changes</h2>
        <p>These terms may be updated; continued use after changes constitutes acceptance.</p>
      </main>
      <LandingFooter />
    </div>
  );
}