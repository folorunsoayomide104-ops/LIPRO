import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create your free LIPRO ACADEMY account — join thousands of Nigerian university students using structured notes, past questions and CBT practice to improve their grades.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
