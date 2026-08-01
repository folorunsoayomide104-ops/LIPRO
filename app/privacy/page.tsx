import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';

export default function PrivacyPage() {
  return (
    <div>
      <LandingNav />
      <main className="mx-auto max-w-3xl px-4 py-16 prose prose-headings:tracking-tight">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Last updated: {new Date().getFullYear()}.</p>
        <h2>1. Data we collect</h2>
        <p>When you register for LIPRO Academy we collect your name, email address, matric number, university, faculty, department, level and semester — the minimum required to personalize your learning experience. We also store course materials, notes, exam attempts and chat history with LIPRO AI that you create.</p>
        <h2>2. How we use data</h2>
        <p>Your information is used to provide educational features, to enforce role-based access, to improve AI quality, and to send academic and payment notifications. We never sell your data to third parties.</p>
        <h2>3. Payments</h2>
        <p>Subscriptions and wallet funding are processed by Paystack. We do not store your card details on our servers.</p>
        <h2>4. Data retention</h2>
        <p>Your account remains until you request deletion by contacting support. Unused accounts may be archived after extended inactivity.</p>
        <h2>5. Security</h2>
        <p>Passwords are stored as bcrypt hashes. Authentication uses signed JWT cookies over HTTPS. Database access is restricted to production infrastructure.</p>
        <h2>6. Contact</h2>
        <p>For privacy inquiries, contact privacy@lipro.academy.</p>
      </main>
      <LandingFooter />
    </div>
  );
}