'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Brain, BookOpen, Trophy } from 'lucide-react';
import { BorderBeam } from './border-beam';

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 py-20 md:py-32">
      <div className="mx-auto max-w-5xl text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-lipro-700 dark:text-lipro-200">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Learning for Nigerian Universities
          </div>
        </motion.div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
          Master your degree with <span className="bg-gradient-to-r from-lipro-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent">LIPRO AI</span>
        </h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-base text-lipro-700/80 dark:text-lipro-200/70 md:text-lg">
          From CBT exams to instant AI-generated revision guides, LIPRO Academy is the all-in-one platform built for Nigerian students who want to study smarter, not harder.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="relative overflow-hidden rounded-xl">
            <Link href="/register"><Button size="lg">Start learning free <ArrowRight className="h-4 w-4" /></Button></Link>
            <BorderBeam size={60} duration={6} colorFrom="#c084fc" colorTo="#818cf8" />
          </div>
          <Link href="/login"><Button variant="outline" size="lg">Try the demo</Button></Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}
          className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: Brain, title: 'LIPRO AI Tutor', desc: 'ChatGPT-level guidance with context from your courses, notes and past questions.' },
            { icon: BookOpen, title: 'Notes & Courses', desc: 'Structured material, organized by faculty and level, available anywhere.' },
            { icon: Trophy, title: 'CBT Engine', desc: 'Practice and timed exam modes that mimic the real university CBT experience.' },
          ].map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * i }} className="card text-left">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-lipro-500/20 to-lipro-700/20 text-lipro-600 dark:text-lipro-300">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-lipro-700/70 dark:text-lipro-200/70">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-lipro-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
    </section>
  );
}
