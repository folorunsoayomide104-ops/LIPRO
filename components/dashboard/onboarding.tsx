import Link from 'next/link';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';

export function OnboardingChecklist({
  hasCourseActivity,
  hasMaterial,
  hasAttempt,
  hasNote,
}: {
  hasCourseActivity: boolean;
  hasMaterial: boolean;
  hasAttempt: boolean;
  hasNote: boolean;
}) {
  const steps = [
    {
      done: hasCourseActivity,
      label: 'Browse courses for your faculty',
      href: '/courses',
      cta: 'Open courses',
    },
    {
      done: hasMaterial,
      label: 'Upload one study PDF (or open a course material)',
      href: '/cbt',
      cta: 'Upload / CBT',
    },
    {
      done: hasAttempt,
      label: 'Complete your first practice CBT',
      href: '/cbt',
      cta: 'Start practice',
    },
    {
      done: hasNote,
      label: 'Save a revision note',
      href: '/notes',
      cta: 'Notes',
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <section className="studio-rise rounded-2xl bg-studio-surface p-5 shadow-studio-border sm:p-6">
      <div className="mb-4 flex items-start gap-2">
        <Sparkles className="mt-0.5 h-5 w-5 text-studio-primary" />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">Getting started</p>
          <h2 className="mt-1 font-studio-display text-xl tracking-tight text-studio-fg">
            Finish setup — {remaining} step{remaining === 1 ? '' : 's'} left
          </h2>
          <p className="mt-1 text-sm text-studio-muted">
            A short path to your first scored practice and spaced review.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-studio-elevated px-3.5 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              {s.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-studio-subtle" />
              )}
              <span className={`text-sm ${s.done ? 'text-studio-subtle line-through' : 'text-studio-fg'}`}>
                {s.label}
              </span>
            </div>
            {!s.done && (
              <Link href={s.href} className="shrink-0 text-xs font-semibold text-studio-primary hover:underline">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
