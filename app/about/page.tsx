import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';
import { GraduationCap, BookOpen, Wallet, HeartHandshake, Target, Award } from 'lucide-react';

const VALUES = [
  { icon: Target, title: 'Built for Nigeria', desc: 'Designed around Nigerian curricula, faculties and matric conventions — from 100 to 500 level.' },
  { icon: Award, title: 'Independent', desc: 'A self-owned platform, not tied to any institution. We answer only to the students who use us.' },
  { icon: HeartHandshake, title: 'Student-first', desc: 'Affordable pricing, premium experience, and no gatekeeping on quality.' },
  { icon: Wallet, title: 'Honest value', desc: 'One platform for revision materials, CBT practice and results tracking — without the cost of private tutoring.' },
];

export default function AboutPage() {
  return (
    <div>
      <LandingNav />
      <main>
        <section className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">About LIPRO ACADEMY</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-lipro-700/80 dark:text-lipro-200/80">
            LIPRO ACADEMY exists to make serious revision possible for every Nigerian university
            student — structured notes, past questions and CBT practice that follow your curriculum,
            at a price any student can afford.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-4">
          <h2 className="text-2xl font-bold tracking-tight">Our story</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-lipro-700/80 dark:text-lipro-200/75">
            <p>
              LIPRO ACADEMY was founded by LIPRO and his colleagues — an independent team who saw
              the same problem repeat itself: smart students failing courses they could have passed —
              not because they lacked ability, but because they had no organised way to revise.
            </p>
            <p>
              Most students were stuck with scattered lecture notes, half-finished past questions and
              no way to know whether they were actually ready for an exam. So we sat down, studied
              the curriculum from 100 to 500 level, and built the revision system we wish had existed
              when we were students.
            </p>
            <p>
              Today that system is LIPRO ACADEMY: course materials that follow your syllabus,
              question banks that mirror real exam patterns, timed CBT practice that conditions you
              for the real thing, and progress tracking that shows you exactly where you stand.
            </p>
            <p>
              We are fully independent — owned and run by our founding team, not by any university.
              That independence is what keeps us focused on one thing: helping students pass.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-10">
          <div className="grid gap-4 md:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="card">
                <v.icon className="h-6 w-6 text-lipro-500" />
                <h3 className="mt-3 font-semibold">{v.title}</h3>
                <p className="mt-1 text-sm text-lipro-600/70 dark:text-lipro-200/70">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10 text-center">
          <div className="card">
            <GraduationCap className="mx-auto h-8 w-8 text-lipro-500" />
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Our promise</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-lipro-700/80 dark:text-lipro-200/75">
              We hold every note, question and study guide to the standard we demanded as students:
              accurate, well-organised and genuinely useful for passing.
              If it is not up to that standard, it does not ship.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-lipro-600 dark:text-lipro-300">
              <BookOpen className="h-4 w-4" /> Built by the founding team. Reviewed with care.
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
