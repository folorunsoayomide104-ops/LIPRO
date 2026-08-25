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
        <h2>4. AI-generated content</h2>
        <p>LIPRO AI chat responses, CBT practice and exam questions, generated explanations, and any grading feedback are produced by artificial intelligence models and may be incomplete, outdated, or factually incorrect. They are study aids, not a substitute for your course materials, lecturer guidance, or official examination content. LIPRO Academy does not guarantee the accuracy of AI-generated content and is not liable for decisions made in reliance on it.</p>
        <h2>5. User-uploaded content</h2>
        <p>You may upload documents (notes, past questions, lecture slides, textbooks) for personal study and AI processing. You must have the right to upload and use any document you submit; you are solely responsible for ensuring your uploads do not infringe another party&apos;s copyright or violate your institution&apos;s policies. We will remove uploaded content that is reported as infringing or unlawful. See our Privacy Policy for how uploaded documents are processed by third-party AI providers.</p>
        <h2>6. Subscriptions & refunds</h2>
        <p>Premium (₦1,700/mo) and Ultimate (₦3,000/mo) subscriptions are billed monthly via Paystack. Refunds for unused months may be requested within 7 days of payment.</p>
        <h2>7. Content ownership</h2>
        <p>Course materials remain the property of their authors. Your personal notes remain yours. LIPRO Academy holds a limited license to display content for the purpose of providing the service.</p>
        <h2>8. Limitation of liability</h2>
        <p>LIPRO Academy is provided &quot;as is&quot;. We are not liable for academic outcomes resulting from AI-assisted study.</p>
        <h2>9. Governing law & dispute resolution</h2>
        <p>These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute arising from your use of LIPRO Academy that cannot be resolved informally will first be referred to mediation, and failing that, settled by arbitration under the Arbitration and Conciliation Act, seated in Nigeria, rather than through court litigation or class action, except where applicable law does not permit this.</p>
        <h2>10. Changes</h2>
        <p>These terms may be updated; continued use after changes constitutes acceptance.</p>
      </main>
      <LandingFooter />
    </div>
  );
}