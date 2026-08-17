'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { SpotlightCard } from './spotlight-card';

const PLANS = [
  { name: 'Free', price: '₦0', period: 'forever', features: ['Browse public notes', 'Limited AI questions', 'Practice mode (5 questions/day)', 'Community leaderboard'], cta: 'Start free', href: '/register', highlight: false },
  { name: 'Premium', price: '₦1,700', period: '/month', features: ['Unlimited AI tutor', 'PDF intelligence', 'Full CBT engine', 'Notes & course tools', 'Study planner'], cta: 'Choose Premium', href: '/register?plan=premium', highlight: true },
  { name: 'Ultimate', price: '₦3,000', period: '/month', features: ['Everything in Premium', 'Priority AI responses', 'Custom AI prompts', 'Flashcards & auto-summaries', 'Analytics dashboard', 'Wallet top-ups'], cta: 'Choose Ultimate', href: '/register?plan=ultimate', highlight: false },
];

export function LandingCTA() {
  return (
    <section id="pricing" className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <div className="mb-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, affordable pricing</h2>
            <p className="mt-4 text-lipro-700/70 dark:text-lipro-200/70">Less than the cost of a textbook per term.</p>
          </div>
        </motion.div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.08 * i }}>
              <SpotlightCard
                className={`card ${plan.highlight ? 'border-lipro-400 ring-2 ring-lipro-400/40' : ''}`}
                spotlightColor={plan.highlight ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.2)'}
              >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-lipro-500 to-lipro-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-3xl font-extrabold tracking-tight">{plan.price}</span>
                <span className="mb-1 text-sm text-lipro-700/60 dark:text-lipro-200/60">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-lipro-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href={plan.href}><Button className="w-full" variant={plan.highlight ? 'primary' : 'outline'}>{plan.cta}</Button></Link>
              </div>
              </SpotlightCard>
          </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
