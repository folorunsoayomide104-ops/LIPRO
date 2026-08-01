'use client';
import { motion } from 'framer-motion';
import { Brain, BookOpen, Trophy, Wallet, Bell, Sparkles, FileText, Calendar } from 'lucide-react';

const FEATURES = [
  { icon: Brain, title: 'LIPRO AI', desc: 'A tutor that understands your courses and PDFs. Generate summaries, flashcards, MCQs, essays and revision guides on demand.' },
  { icon: Trophy, title: 'CBT Engine', desc: 'Practice and Exam modes with question types matching university formats — MCQ, Theory, True/False, Fill-in-the-Blank.' },
  { icon: BookOpen, title: 'Courses & Notes', desc: 'Organized course notes by faculty, department and level. Tag, search and revisit material anytime.' },
  { icon: FileText, title: 'PDF Intelligence', desc: 'Upload any lecture PDF and let LIPRO AI extract, summarize and quiz you on the key concepts.' },
  { icon: Calendar, title: 'Study Planner', desc: 'Build a personalized revision timetable that adapts to your exam dates and weak topics.' },
  { icon: Wallet, title: 'Wallet & Subscriptions', desc: 'Pay seamlessly with Paystack. Premium ₦1,700/mo, Ultimate ₦3,000/mo with full AI access.' },
  { icon: Bell, title: 'Notifications', desc: 'Never miss a quiz deadline, exam schedule or payment update with real-time alerts.' },
  { icon: Sparkles, title: 'Premium UX', desc: 'Glassmorphism design, dark/light modes and cinematic motion — Apple-grade polish on every page.' },
];

export function LandingFeatures() {
  return (
    <section id="features" className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
<div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything a serious student needs</h2>
          <p className="mt-4 text-lipro-700/70 dark:text-lipro-200/70">A complete toolkit for academic excellence.</p>
        </div>
      </motion.div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 * i }}>
              <div className="card">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-lipro-500/20 to-lipro-700/20 text-lipro-600 dark:text-lipro-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-lipro-700/70 dark:text-lipro-200/70">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
